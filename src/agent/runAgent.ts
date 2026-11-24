import { t } from '../i18n';
import { executeTool, systemPrompt, TOOLS, ToolError, type AgentContext, type ToolDef } from './tools';
import type { AgentProvider } from './settings';

export interface AgentConfig {
  provider: AgentProvider;
  apiKey: string;
  model: string;
}

export type AgentEvent =
  | { type: 'tool'; name: string; input: Record<string, unknown>; ok: boolean; error?: string }
  | { type: 'text'; text: string };

const MAX_STEPS = 12;

/** A self-contained agent job: instructions, tools, the user's message, and how to run a tool. */
export interface AgentTask {
  system: string;
  tools: ToolDef[];
  user: string;
  execute: (name: string, input: Record<string, any>) => unknown;
  maxTokens?: number;
}

function runTool(name: string, input: Record<string, unknown>, task: AgentTask, onEvent: (e: AgentEvent) => void) {
  try {
    const result = task.execute(name, input);
    onEvent({ type: 'tool', name, input, ok: true });
    return { content: JSON.stringify(result), isError: false };
  } catch (e) {
    const msg = e instanceof ToolError ? e.message : `Tool failed: ${(e as Error).message}`;
    onEvent({ type: 'tool', name, input, ok: false, error: msg });
    return { content: msg, isError: true };
  }
}

async function post(url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message ?? `HTTP ${res.status}`;
    throw new Error(res.status === 401 ? t('The API key was rejected ({msg}).', { msg }) : msg);
  }
  return json;
}

/** Claude — Messages API with tool use. */
async function runAnthropic(cfg: AgentConfig, task: AgentTask, onEvent: (e: AgentEvent) => void, signal?: AbortSignal) {
  const messages: any[] = [{ role: 'user', content: task.user }];
  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await post(
      'https://api.anthropic.com/v1/messages',
      {
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        // required for calls made straight from a browser (personal-key MVP)
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      { model: cfg.model, max_tokens: task.maxTokens ?? 2048, system: task.system, tools: task.tools, messages },
      signal,
    );
    messages.push({ role: 'assistant', content: res.content });
    const uses = (res.content as any[]).filter((b) => b.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || uses.length === 0) {
      const final = (res.content as any[]).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      onEvent({ type: 'text', text: final });
      return final;
    }
    messages.push({
      role: 'user',
      content: uses.map((u) => {
        const r = runTool(u.name, u.input ?? {}, task, onEvent);
        return { type: 'tool_result', tool_use_id: u.id, content: r.content, is_error: r.isError };
      }),
    });
  }
  throw new Error(t('The assistant took too many steps and was stopped.'));
}

/** Reasoning models (GPT-5 family, o-series) get a reasoning effort; older models don't accept one. */
export const isReasoningModel = (model: string) => /^(gpt-5|o\d)/.test(model);

/** Text of a Responses API reply (output_text, or the message parts). */
function responseText(res: any): string {
  if (typeof res.output_text === 'string') return res.output_text.trim();
  return (res.output ?? [])
    .filter((o: any) => o.type === 'message')
    .flatMap((o: any) => o.content ?? [])
    .filter((c: any) => c.type === 'output_text')
    .map((c: any) => c.text)
    .join('\n')
    .trim();
}

/**
 * OpenAI — Responses API with function calling. OpenAI's guidance for GPT-5.x is to call tools
 * through /v1/responses: reasoning runs between tool calls, and its (encrypted) reasoning items
 * are sent back each turn so the model keeps its chain of thought across steps. Stateless:
 * store=false, nothing is kept on OpenAI's side.
 */
async function runOpenAI(cfg: AgentConfig, task: AgentTask, onEvent: (e: AgentEvent) => void, signal?: AbortSignal) {
  const input: any[] = [{ role: 'user', content: task.user }];
  const tools = task.tools.map((t) => ({ type: 'function', name: t.name, description: t.description, parameters: t.input_schema, strict: false }));
  const reasoning = isReasoningModel(cfg.model);
  for (let step = 0; step < MAX_STEPS; step++) {
    const body: Record<string, unknown> = { model: cfg.model, instructions: task.system, input, tools, store: false };
    if (reasoning) {
      body.reasoning = { effort: 'low' };
      body.include = ['reasoning.encrypted_content'];
    }
    const res = await post('https://api.openai.com/v1/responses', { authorization: `Bearer ${cfg.apiKey}` }, body, signal);
    if (res.status === 'incomplete' && !res.output?.length) throw new Error(t('Empty response from OpenAI.'));
    const output: any[] = res.output ?? [];
    // keep reasoning, messages and calls in the conversation, as the API expects
    input.push(...output);
    const calls = output.filter((o) => o.type === 'function_call');
    if (calls.length === 0) {
      const final = responseText(res);
      if (!final && !output.length) throw new Error(t('Empty response from OpenAI.'));
      onEvent({ type: 'text', text: final });
      return final;
    }
    for (const c of calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(c.arguments || '{}');
      } catch {
        /* fall through with empty input — the tool will report what is missing */
      }
      const r = runTool(c.name, args, task, onEvent);
      input.push({ type: 'function_call_output', call_id: c.call_id, output: r.content });
    }
  }
  throw new Error(t('The assistant took too many steps and was stopped.'));
}

export function runAgentTask(cfg: AgentConfig, task: AgentTask, onEvent: (e: AgentEvent) => void, signal?: AbortSignal) {
  return cfg.provider === 'anthropic' ? runAnthropic(cfg, task, onEvent, signal) : runOpenAI(cfg, task, onEvent, signal);
}

/** The food & training logger. */
export function runAgent(cfg: AgentConfig, text: string, ctx: AgentContext, onEvent: (e: AgentEvent) => void, signal?: AbortSignal) {
  return runAgentTask(
    cfg,
    {
      system: systemPrompt(ctx),
      tools: ctx.allowEstimates ? TOOLS : TOOLS.filter((x) => x.name !== 'create_food'),
      user: text,
      execute: (name, input) => executeTool(name, input, ctx),
    },
    onEvent,
    signal,
  );
}

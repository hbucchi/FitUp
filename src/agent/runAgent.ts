import { executeTool, systemPrompt, TOOLS, ToolError, type AgentContext } from './tools';
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

function runTool(name: string, input: Record<string, unknown>, ctx: AgentContext, onEvent: (e: AgentEvent) => void) {
  try {
    const result = executeTool(name, input, ctx);
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
    throw new Error(res.status === 401 ? `The API key was rejected (${msg}).` : msg);
  }
  return json;
}

/** Claude — Messages API with tool use. */
async function runAnthropic(cfg: AgentConfig, text: string, ctx: AgentContext, onEvent: (e: AgentEvent) => void, signal?: AbortSignal) {
  const messages: any[] = [{ role: 'user', content: text }];
  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await post(
      'https://api.anthropic.com/v1/messages',
      {
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        // required for calls made straight from a browser (personal-key MVP)
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      { model: cfg.model, max_tokens: 2048, system: systemPrompt(ctx), tools: TOOLS, messages },
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
        const r = runTool(u.name, u.input ?? {}, ctx, onEvent);
        return { type: 'tool_result', tool_use_id: u.id, content: r.content, is_error: r.isError };
      }),
    });
  }
  throw new Error('The assistant took too many steps and was stopped.');
}

/** OpenAI — Chat Completions with function calling. */
async function runOpenAI(cfg: AgentConfig, text: string, ctx: AgentContext, onEvent: (e: AgentEvent) => void, signal?: AbortSignal) {
  const messages: any[] = [{ role: 'system', content: systemPrompt(ctx) }, { role: 'user', content: text }];
  const tools = TOOLS.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } }));
  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await post('https://api.openai.com/v1/chat/completions', { authorization: `Bearer ${cfg.apiKey}` }, { model: cfg.model, messages, tools }, signal);
    const msg = res.choices?.[0]?.message;
    if (!msg) throw new Error('Empty response from OpenAI.');
    messages.push(msg);
    const calls: any[] = msg.tool_calls ?? [];
    if (calls.length === 0) {
      const final = String(msg.content ?? '').trim();
      onEvent({ type: 'text', text: final });
      return final;
    }
    for (const c of calls) {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(c.function.arguments || '{}');
      } catch {
        /* fall through with empty input — the tool will report what is missing */
      }
      const r = runTool(c.function.name, input, ctx, onEvent);
      messages.push({ role: 'tool', tool_call_id: c.id, content: r.content });
    }
  }
  throw new Error('The assistant took too many steps and was stopped.');
}

export function runAgent(cfg: AgentConfig, text: string, ctx: AgentContext, onEvent: (e: AgentEvent) => void, signal?: AbortSignal) {
  return cfg.provider === 'anthropic' ? runAnthropic(cfg, text, ctx, onEvent, signal) : runOpenAI(cfg, text, ctx, onEvent, signal);
}

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fromRaw } from '../data/catalog';
import { buildIndex } from '../data/search';
import { useStore } from '../data/store';
import { SEED_EXERCISES } from '../domain/exercises';
import { runAgent, type AgentEvent } from '../agent/runAgent';
import { executeTool, type AgentContext } from '../agent/tools';
import { transcribeAudio } from '../agent/transcribe';

const foods = JSON.parse(readFileSync(new URL('../../public/data/usda-foods.json', import.meta.url), 'utf8')).foods.map(fromRaw);
const index = buildIndex(foods);
const byId = new Map(foods.map((f: any) => [f.id, f]));
const ctx = (): AgentContext => ({ date: '2026-11-22', index, byId: byId as any, exercises: SEED_EXERCISES, weightKg: 80, logged: [], created: new Map() });
const banana = foods.find((f: any) => f.name === 'Bananas, raw');
const medium = banana.portions.find((p: any) => p.label.startsWith('medium')).label;

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
  useStore.getState().resetAll();
  vi.restoreAllMocks();
});

describe('tools', () => {
  test('search returns ids and portions', () => {
    const r = (executeTool('search_foods', { queries: ['banana'] }, ctx()) as any).matches;
    expect(r[0].id).toBe(banana.id);
    expect(r[0].portions.some((p: any) => p.unit === medium)).toBe(true);
  });
  test('only foods returned by search can be logged — no foods from memory', () => {
    const c = { ...ctx(), seen: new Set<string>() };
    expect(() => executeTool('log_food', { said: 'a banana', food_id: banana.id, quantity: 1, unit: medium, meal: 'snack' }, c)).toThrow(/not returned by search_foods/);
    executeTool('search_foods', { queries: ['banana', 'bananas raw'] }, c);
    executeTool('log_food', { said: 'a banana', food_id: banana.id, quantity: 1, unit: medium, meal: 'snack' }, c);
    const e = useStore.getState().foodEntries[0];
    expect(e).toMatchObject({ foodId: banana.id, said: 'a banana', via: 'agent' });
    // nutrients come from the database record, scaled by grams
    expect(e.nutrients.kcal).toBeCloseTo((banana.nutrients.kcal! * e.grams) / 100);
  });
  test('regex_foods lists every variant, accent-insensitive, and makes them loggable', () => {
    const c = { ...ctx(), seen: new Set<string>() };
    const r = executeTool('regex_foods', { pattern: '^bananas?, ', exclude: 'dehydrated|powder' }, c) as any;
    expect(r.total).toBeGreaterThan(1);
    expect(r.matches[0].name).toBe('Bananas, raw'); // shortest name first
    expect(r.matches.every((m: any) => !/dehydrated|powder/i.test(m.name))).toBe(true);
    executeTool('log_food', { said: 'banana', food_id: r.matches[0].id, quantity: 100, unit: 'g', meal: 'snack' }, c);
    expect(useStore.getState().foodEntries).toHaveLength(1);
  });
  test('regex_foods rejects broken or explosive patterns with a fixable error', () => {
    expect(() => executeTool('regex_foods', { pattern: '([a-z' }, ctx())).toThrow(/Invalid pattern/);
    expect(() => executeTool('regex_foods', { pattern: '(a+)+$' }, ctx())).toThrow(/nested repetition/);
  });
  test('log_bowel_movement records a Bristol type, undoable like other entries', () => {
    const c = ctx();
    const r = executeTool('log_bowel_movement', { bristol: 4, time: '08:15', note: 'after coffee' }, c) as any;
    expect(r).toMatchObject({ logged: true, bristol: 4, description: 'Smooth and soft' });
    expect(useStore.getState().bowelMovements[0]).toMatchObject({ bristol: 4, time: '08:15', via: 'agent' });
    expect(c.logged[0].kind).toBe('bowel');
    expect(() => executeTool('log_bowel_movement', { bristol: 9 }, c)).toThrow(/1 to 7/);
  });
  test('estimates are off unless allowed', () => {
    const args = { name: 'Burrito bowl', serving_label: 'bowl', serving_grams: 500, kcal: 750, protein_g: 45, carbs_g: 80, fat_g: 25 };
    expect(() => executeTool('create_food', args, ctx())).toThrow(/Estimates are turned off/);
  });
  test('implausible amounts must be confirmed', () => {
    expect(() => executeTool('log_food', { said: 'banana', food_id: banana.id, quantity: 200, unit: medium, meal: 'snack' }, ctx())).toThrow(/check quantity and unit/);
  });
  test('invalid unit is a correctable error', () => {
    expect(() => executeTool('log_food', { food_id: banana.id, quantity: 1, unit: 'banana', meal: 'snack' }, ctx())).toThrow(/Valid units/);
  });
  test('create_food then log it; log training', () => {
    const c = { ...ctx(), allowEstimates: true };
    const f = executeTool('create_food', { name: 'Chicken burrito bowl', serving_label: 'bowl', serving_grams: 500, kcal: 750, protein_g: 45, carbs_g: 80, fat_g: 25 }, c) as any;
    executeTool('log_food', { food_id: f.id, quantity: 1, unit: 'bowl', meal: 'lunch' }, c);
    executeTool('log_training', { exercise_id: 'ex:run', duration_min: 30, distance_km: 5 }, c);
    const s = useStore.getState();
    expect(s.foodEntries[0].nutrients.kcal).toBeCloseTo(750);
    expect(s.customFoods[0].source).toBe('AI estimate');
    expect(s.trainingEntries[0].kcal).toBe(421); // 5 km in 30 min = 10 km/h → running equation, MET 10.52
  });
});

test('log_checkin merges into the day and validates scales', () => {
  const c = ctx();
  executeTool('log_checkin', { sleep_hours: 6.3, energy: 2 }, c);
  executeTool('log_checkin', { soreness: 4, note: 'legs from squats' }, c);
  expect(useStore.getState().checkIns).toEqual([{ date: '2026-11-22', sleepHours: 6.5, energy: 2, soreness: 4, note: 'legs from squats' }]);
  expect(() => executeTool('log_checkin', { mood: 9 }, c)).toThrow(/1 to 5/);
});

test('log_symptom records one entry per symptom and validates', () => {
  const c = ctx();
  executeTool('log_symptom', { kind: 'headache', severity: 3, time: '15:00' }, c);
  executeTool('log_symptom', { kind: 'cramp', severity: 2, body_part: 'left calf', note: 'during the run' }, c);
  const s = useStore.getState().symptoms;
  expect(s.map((x) => [x.kind, x.severity, x.bodyPart ?? null])).toEqual([['headache', 3, null], ['cramp', 2, 'left calf']]);
  expect(() => executeTool('log_symptom', { kind: 'migraine', severity: 3 }, c)).toThrow(/kind must be/);
});

describe('agent loop', () => {
  test('Claude: search → bad unit → fix → summary', async () => {
    const replies = [
      { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'search_foods', input: { query: 'banana' } }] },
      { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't2', name: 'log_food', input: { food_id: banana.id, quantity: 1, unit: 'one', meal: 'breakfast' } }] },
      { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't3', name: 'log_food', input: { food_id: banana.id, quantity: 1, unit: medium, meal: 'breakfast' } }] },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: '1 medium banana — 105 kcal' }] },
    ];
    const fetchMock = vi.fn(async () => ok(replies.shift()));
    vi.stubGlobal('fetch', fetchMock);
    const events: AgentEvent[] = [];
    const out = await runAgent({ provider: 'anthropic', apiKey: 'k', model: 'claude-sonnet-5-5' }, 'a banana for breakfast', ctx(), (e) => events.push(e));
    expect(out).toMatch(/banana/);
    expect(useStore.getState().foodEntries).toHaveLength(1);
    expect(useStore.getState().foodEntries[0].via).toBe('agent');
    // request shape
    const [url, init] = fetchMock.mock.calls[1] as any;
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('k');
    const body = JSON.parse(init.body);
    expect(body.tools.map((t: any) => t.name)).toContain('log_food');
    expect(body.messages[2].content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 't1', is_error: false });
    // the failed call was reported back as an error so the model could fix it
    const third = JSON.parse((fetchMock.mock.calls[2] as any)[1].body);
    expect(third.messages[4].content[0]).toMatchObject({ tool_use_id: 't2', is_error: true });
    expect(events.filter((e) => e.type === 'tool' && !e.ok)).toHaveLength(1);
  });

  // Responses API helpers: a function call item and a final message
  const fcall = (id: string, name: string, args: object) => ({ type: 'function_call', call_id: id, name, arguments: JSON.stringify(args) });
  const reply = (...output: object[]) => ({ output });
  const say = (text: string) => ({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] });

  test('OpenAI: Responses API function-calling round trip', async () => {
    const replies = [
      reply(fcall('c1', 'log_food', { food_id: banana.id, quantity: 120, unit: 'g', meal: 'snack' })),
      reply(say('Logged 120 g banana.')),
    ];
    const fetchMock = vi.fn(async () => ok(replies.shift()));
    vi.stubGlobal('fetch', fetchMock);
    const out = await runAgent({ provider: 'openai', apiKey: 'k', model: 'gpt-4.1-mini' }, 'banana', ctx(), () => {});
    expect(out).toBe('Logged 120 g banana.');
    expect(useStore.getState().foodEntries[0].grams).toBe(120);
    expect((fetchMock.mock.calls[0] as any)[0]).toBe('https://api.openai.com/v1/responses');
    const first = JSON.parse((fetchMock.mock.calls[0] as any)[1].body);
    expect(first.reasoning).toBeUndefined(); // not a reasoning model
    const body = JSON.parse((fetchMock.mock.calls[1] as any)[1].body);
    // the call and its result are both sent back
    expect(body.input.at(-2)).toMatchObject({ type: 'function_call', call_id: 'c1' });
    expect(body.input.at(-1)).toMatchObject({ type: 'function_call_output', call_id: 'c1' });
  });

  test('OpenAI GPT-5: reasoning on, reasoning items carried between steps, database ids only, no estimate tool', async () => {
    const thought = { type: 'reasoning', id: 'rs_1', summary: [], encrypted_content: 'enc' };
    const replies = [
      reply(thought, fcall('c1', 'log_food', { said: 'a banana', food_id: banana.id, quantity: 1, unit: medium, meal: 'snack' })),
      reply(fcall('c2', 'search_foods', { queries: ['banana', 'bananas raw'] })),
      reply(fcall('c3', 'log_food', { said: 'a banana', food_id: banana.id, quantity: 1, unit: medium, meal: 'snack' })),
      reply(say('1 banana')),
    ];
    const fetchMock = vi.fn(async () => ok(replies.shift()));
    vi.stubGlobal('fetch', fetchMock);
    const events: AgentEvent[] = [];
    await runAgent({ provider: 'openai', apiKey: 'k', model: 'gpt-5.4-mini' }, 'a banana', { ...ctx(), seen: new Set(), allowEstimates: false }, (e) => events.push(e));
    const first = JSON.parse((fetchMock.mock.calls[0] as any)[1].body);
    expect(first).toMatchObject({ model: 'gpt-5.4-mini', reasoning: { effort: 'low' }, store: false, include: ['reasoning.encrypted_content'] });
    expect(first.tools.map((t: any) => t.name)).not.toContain('create_food');
    expect(first.instructions).toMatch(/NEVER log a food from memory/);
    expect(first.input[0]).toEqual({ role: 'user', content: 'a banana' });
    // the model's reasoning item goes back with the next request
    const second = JSON.parse((fetchMock.mock.calls[1] as any)[1].body);
    expect(second.input).toContainEqual(thought);
    // the log before any search is refused, the one after it is accepted
    expect(events.filter((e) => e.type === 'tool').map((e: any) => e.ok)).toEqual([false, true, true]);
    expect(useStore.getState().foodEntries).toHaveLength(1);
  });

  test('a rejected key surfaces a clear error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'invalid x-api-key' } }) })));
    await expect(runAgent({ provider: 'anthropic', apiKey: 'bad', model: 'm' }, 'x', ctx(), () => {})).rejects.toThrow(/rejected/);
  });
});

test('ElevenLabs Scribe request', async () => {
  const fetchMock = vi.fn(async () => ok({ text: 'two eggs and toast' }));
  vi.stubGlobal('fetch', fetchMock);
  const t = await transcribeAudio(new Blob(['x'], { type: 'audio/webm' }), { provider: 'elevenlabs', apiKey: 'xi', model: 'scribe_v1' });
  expect(t).toBe('two eggs and toast');
  const [url, init] = fetchMock.mock.calls[0] as any;
  expect(url).toBe('https://api.elevenlabs.io/v1/speech-to-text');
  expect(init.headers['xi-api-key']).toBe('xi');
  expect((init.body as FormData).get('model_id')).toBe('scribe_v1');
});

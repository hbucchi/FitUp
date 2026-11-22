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
    const r = executeTool('search_foods', { query: 'banana' }, ctx()) as any[];
    expect(r[0].id).toBe(banana.id);
    expect(r[0].portions.some((p: any) => p.unit === medium)).toBe(true);
  });
  test('invalid unit is a correctable error', () => {
    expect(() => executeTool('log_food', { food_id: banana.id, quantity: 1, unit: 'banana', meal: 'snack' }, ctx())).toThrow(/Valid units/);
  });
  test('create_food then log it; log training', () => {
    const c = ctx();
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

  test('OpenAI: function calling round trip', async () => {
    const replies = [
      { choices: [{ message: { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'log_food', arguments: JSON.stringify({ food_id: banana.id, quantity: 120, unit: 'g', meal: 'snack' }) } }] } }] },
      { choices: [{ message: { role: 'assistant', content: 'Logged 120 g banana.' } }] },
    ];
    const fetchMock = vi.fn(async () => ok(replies.shift()));
    vi.stubGlobal('fetch', fetchMock);
    await runAgent({ provider: 'openai', apiKey: 'k', model: 'm' }, 'banana', ctx(), () => {});
    expect(useStore.getState().foodEntries[0].grams).toBe(120);
    const body = JSON.parse((fetchMock.mock.calls[1] as any)[1].body);
    expect(body.messages.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'c1' });
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

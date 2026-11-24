/**
 * Live check of the logging agent against the real OpenAI API (not part of the test suite).
 *   OPENAI_API_KEY=… npx vite-node scripts/live-agent.ts [model]
 * Prints, per transcript: reasoning tokens used, each tool call, and what was logged.
 */
import { readFileSync } from 'node:fs';
import { fromRaw } from '../src/data/catalog';
import { buildIndex } from '../src/data/search';
import { runAgent, type AgentEvent } from '../src/agent/runAgent';
import { SEED_EXERCISES } from '../src/domain/exercises';
import { useStore } from '../src/data/store';
import type { AgentContext } from '../src/agent/tools';

const model = process.argv[2] ?? 'gpt-5.4-mini';
const key = process.env.OPENAI_API_KEY ?? '';
const foods = [...JSON.parse(readFileSync('public/data/usda-foods.json', 'utf8')).foods, ...JSON.parse(readFileSync('public/data/taco-foods.json', 'utf8')).foods].map(fromRaw);
const index = buildIndex(foods);
const byId = new Map(foods.map((f) => [f.id, f]));

// record usage of every OpenAI call
const usage: any[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init: any) => {
  const res = await realFetch(url, init);
  const clone = res.clone();
  clone.json().then((j: any) => usage.push({ status: res.status, usage: j.usage, error: j.error?.message })).catch(() => {});
  return res;
}) as typeof fetch;

const ALL = [
  'For breakfast I had two scrambled eggs, a slice of whole wheat toast and a black coffee',
  'Lunch: 200 grams of grilled chicken breast, a cup of white rice and a small salad with olive oil',
  'No almoço comi duas conchas de feijão carioca, quatro colheres de sopa de arroz branco e um bife grelhado',
  'pós-treino tomei um scoop de whey com 300 ml de leite integral e uma banana',
  'Jantei moqueca de peixe, uma concha, e um pouco de farofa. Corri 5 km em 30 minutos de manhã',
  'Fiz cocô depois do café da manhã, normal. Dormi 7 horas e acordei com dor de cabeça',
  'Pooped twice today, the second one was pretty loose',
];

const CASES = process.argv[3] ? ALL.slice(Number(process.argv[3])) : ALL;
for (const text of CASES) {
  useStore.getState().resetAll();
  usage.length = 0;
  const ctx: AgentContext = { date: '2026-11-24', index, byId: byId as any, exercises: SEED_EXERCISES, weightKg: 80, logged: [], created: new Map(), seen: new Set(), allowEstimates: false };
  const events: AgentEvent[] = [];
  const t0 = Date.now();
  try {
    const out = await runAgent({ provider: 'openai', apiKey: key, model }, text, ctx, (e) => events.push(e));
    await new Promise((r) => setTimeout(r, 50));
    console.log(`\n=== ${text}\n  ${((Date.now() - t0) / 1000).toFixed(1)} s, ${usage.length} API calls, reasoning tokens per call: ${usage.map((u) => u.usage?.output_tokens_details?.reasoning_tokens ?? '?').join(', ')}`);
    for (const e of events) if (e.type === 'tool') console.log(`  ${e.ok ? '✓' : '✗'} ${e.name} ${JSON.stringify(e.input).slice(0, 140)}${e.error ? '  → ' + e.error.slice(0, 120) : ''}`);
    for (const l of ctx.logged) {
      if (l.kind === 'food') console.log(`  LOGGED ${l.entry.quantity} × ${l.entry.unit} ${l.entry.foodName} = ${Math.round(l.entry.grams)} g, ${Math.round(l.entry.nutrients.kcal ?? 0)} kcal`);
      if (l.kind === 'bowel') console.log(`  LOGGED bowel movement type ${l.entry.bristol} ${l.entry.time ?? ''} ${l.entry.note ?? ''}`);
      if (l.kind === 'symptom') console.log(`  LOGGED symptom ${l.entry.kind} ${l.entry.severity}/5`);
      if (l.kind === 'checkin') console.log(`  LOGGED check-in ${JSON.stringify(l.entry)}`);
      if (l.kind === 'training') console.log(`  LOGGED ${l.entry.exerciseName} ${l.entry.durationMin} min ${l.entry.distanceKm ?? ''} km, ${l.entry.kcal} kcal`);
    }
    console.log('  SUMMARY: ' + out.replace(/\n/g, ' | ').slice(0, 300));
  } catch (e) {
    console.log(`\n=== ${text}\n  FAILED: ${(e as Error).message}`, JSON.stringify(usage));
  }
}

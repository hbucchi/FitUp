/** Live token measurement for one voice note: transcription + logging agent (gpt-5.4-mini). */
import { readFileSync } from 'node:fs';
import { fromRaw } from '../src/data/catalog';
import { buildIndex } from '../src/data/search';
import { runAgent } from '../src/agent/runAgent';
import { SEED_EXERCISES } from '../src/domain/exercises';
import { useStore } from '../src/data/store';

const key = process.env.OPENAI_API_KEY ?? '';
const foods = [...JSON.parse(readFileSync('public/data/usda-foods.json', 'utf8')).foods, ...JSON.parse(readFileSync('public/data/taco-foods.json', 'utf8')).foods].map(fromRaw);
const index = buildIndex(foods);
const byId = new Map(foods.map((f) => [f.id, f]));
const usage: any[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init: any) => {
  const res = await realFetch(url, init);
  if (String(url).includes('/v1/responses')) res.clone().json().then((j: any) => usage.push(j.usage)).catch(() => {});
  return res;
}) as typeof fetch;

const NOTES = [
  'For breakfast I had two scrambled eggs, a slice of whole wheat toast and a black coffee.',
  'No almoço comi duas conchas de feijão carioca, quatro colheres de sopa de arroz branco e um bife grelhado.',
  'Pós-treino tomei um scoop de whey com trezentos ml de leite integral e uma banana. Dormi sete horas e fiz cocô normal de manhã.',
];
for (const said of NOTES) {
  const tts = await realFetch('https://api.openai.com/v1/audio/speech', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: 'alloy', input: said, response_format: 'mp3' }) });
  const audio = new Blob([await tts.arrayBuffer()], { type: 'audio/mpeg' });
  const form = new FormData();
  form.append('file', audio, 'note.mp3');
  form.append('model', 'gpt-4o-mini-transcribe');
  const tr = await (await realFetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${key}` }, body: form })).json();
  useStore.getState().resetAll();
  usage.length = 0;
  await runAgent({ provider: 'openai', apiKey: key, model: 'gpt-5.4-mini' }, tr.text, { date: '2026-11-24', index, byId: byId as any, exercises: SEED_EXERCISES, weightKg: 80, logged: [], created: new Map(), seen: new Set(), allowEstimates: false }, () => {});
  await new Promise((r) => setTimeout(r, 100));
  const sum = (f: (u: any) => number) => usage.reduce((s, u) => s + (f(u) || 0), 0);
  console.log(JSON.stringify({
    said: said.slice(0, 50), transcription: tr.usage,
    agent: { calls: usage.length, input: sum((u) => u.input_tokens), cached: sum((u) => u.input_tokens_details?.cached_tokens), output: sum((u) => u.output_tokens), reasoning: sum((u) => u.output_tokens_details?.reasoning_tokens) },
  }));
}

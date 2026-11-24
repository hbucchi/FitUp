#!/usr/bin/env node
// Lists every string that needs a translation: t('…') literals in src/, plus data shown through t()
// (exercise names/groups/equipment, program names, taglines, descriptions, notes, session-title parts).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
const walk = (d) => readdirSync(d).forEach((f) => {
  const p = join(d, f);
  if (statSync(p).isDirectory()) { if (!p.includes('__tests__') && !p.endsWith('i18n')) walk(p); }
  else if (/\.(ts|tsx)$/.test(f)) files.push(p);
});
walk('src');
const keys = new Set();
const unesc = (s) => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bt\('((?:[^'\\]|\\.)*)'/g)) keys.add(unesc(m[1]));
  for (const m of src.matchAll(/\bt\("((?:[^"\\]|\\.)*)"/g)) keys.add(m[1]);
}
const prog = readFileSync('src/domain/programs.ts', 'utf8');
for (const m of prog.matchAll(/\b(?:name|tagline|description|title|note): '((?:[^'\\]|\\.)*)'/g)) keys.add(unesc(m[1]));
for (const m of prog.matchAll(/notes: \['((?:[^'\\]|\\.)*)'\]/g)) keys.add(unesc(m[1]));
for (const m of prog.matchAll(/\{ name: '(Heavy|Moderate|Light)'/g)) keys.add(m[1]);
keys.add('Lighter week');
const ex = readFileSync('src/domain/exercises.ts', 'utf8');
for (const m of ex.matchAll(/(?:aerobic|strength)\('[^']+', '((?:[^'\\]|\\.)*)', '((?:[^'\\]|\\.)*)'(?:, [\d.]+)?(?:, (?:true|false))?(?:, '((?:[^'\\]|\\.)*)')?/g)) {
  keys.add(unesc(m[1])); keys.add(unesc(m[2])); if (m[3]) keys.add(unesc(m[3]));
}
for (const m of ex.matchAll(/strength\('[^']+', '[^']+', '[^']+', '((?:[^'\\]|\\.)*)'/g)) keys.add(unesc(m[1]));
for (const m of ex.matchAll(/(?:aerobic|strength)\('[^']+', "([^"]+)"/g)) keys.add(m[1]);
const types = readFileSync('src/domain/types.ts', 'utf8');
const sk = types.match(/SYMPTOM_KINDS = \{([\s\S]*?)\}/)[1];
for (const m of sk.matchAll(/: '([^']+)'/g)) keys.add(m[1]);
keys.add('symptom');
const br = types.match(/BRISTOL = \{([\s\S]*?)\}/)[1];
for (const m of br.matchAll(/: '([^']+)'/g)) keys.add(m[1]);
const xp = readFileSync('src/domain/xp.ts', 'utf8');
const tiersSrc = xp.slice(xp.indexOf('export const TIERS'), xp.indexOf('export const RANKS'));
for (const m of tiersSrc.matchAll(/'((?:[^'\\]|\\.)*)'/g)) keys.add(unesc(m[1]));
const app = readFileSync('src/App.tsx', 'utf8');
for (const m of app.matchAll(/label: '([^']+)'/g)) keys.add(m[1]);
for (const d of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) keys.add(d);
const out = [...keys].filter((k) => /[A-Za-z]/.test(k)).sort();
if (process.argv.includes('--missing')) {
  const pt = readFileSync('src/i18n/pt.ts', 'utf8');
  const have = new Set([...pt.matchAll(/^\s*'((?:[^'\\]|\\.)*)':/gm)].map((m) => unesc(m[1])).concat([...pt.matchAll(/^\s*"((?:[^"\\]|\\.)*)":/gm)].map((m) => m[1])));
  const missing = out.filter((k) => !have.has(k));
  console.log(JSON.stringify(missing, null, 1));
  console.error(`${missing.length} missing of ${out.length}`);
  process.exit(missing.length ? 1 : 0);
}
console.log(JSON.stringify(out, null, 1));
console.error(`${out.length} keys`);

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { PT } from '../i18n/pt';
import { SEED_EXERCISES } from '../domain/exercises';
import { PROGRAMS } from '../domain/programs';
import { SYMPTOM_KINDS } from '../domain/types';

function sources(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (!/__tests__|i18n$/.test(p)) sources(p, out); }
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}

test('every t() literal has a Portuguese translation', () => {
  const missing: string[] = [];
  for (const f of sources('src')) {
    for (const m of readFileSync(f, 'utf8').matchAll(/\bt\((?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g)) {
      const key = m[1] != null ? m[1].replace(/\\'/g, "'") : m[2];
      if (!(key in PT)) missing.push(`${f}: ${key}`);
    }
  }
  expect(missing).toEqual([]);
});

test('exercise, program and symptom labels are translated', () => {
  const keys = [
    ...SEED_EXERCISES.flatMap((e) => [e.name, e.group, e.equipment].filter((x): x is string => !!x)),
    ...PROGRAMS.flatMap((p) => [p.name, p.tagline, p.description, ...(p.notes ?? [])]),
    ...Object.values(SYMPTOM_KINDS),
  ];
  expect(keys.filter((k) => !(k in PT))).toEqual([]);
});

test('translations keep their {placeholders}', () => {
  const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  const broken = Object.entries(PT).filter(([en, pt]) => vars(en) !== vars(pt));
  expect(broken).toEqual([]);
});

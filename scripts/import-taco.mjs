#!/usr/bin/env node
/**
 * Builds the Brazilian food catalog from TACO — Tabela Brasileira de Composição de Alimentos,
 * 4ª ed. (NEPA/UNICAMP, 2011): 597 foods per 100 g, with household measures (IBGE POF 2008-2009).
 * "É permitida a reprodução total ou parcial do material, desde que seja citada a fonte."
 *
 * The processed tables come from the npm package taco-br-mcp@0.2.0 (MIT), which embeds them as
 * data literals. They are extracted with a JSON5 parser — the package's code is never executed.
 *
 *   node scripts/import-taco.mjs            → public/data/taco-foods.json
 *
 * Also adds "Moqueca de peixe" as a recipe calculated from TACO ingredients (TACO has no moqueca).
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, strFromU8 } from 'fflate';
import JSON5 from 'json5';

const PKG = 'https://registry.npmjs.org/taco-br-mcp/-/taco-br-mcp-0.2.0.tgz';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'public/data/taco-foods.json');

/** minimal tar reader: returns the text of one file */
function untarFile(buf, wanted) {
  for (let off = 0; off + 512 <= buf.length; ) {
    const name = strFromU8(buf.subarray(off, off + 100)).replace(/\0.*$/s, '');
    if (!name) break;
    const size = parseInt(strFromU8(buf.subarray(off + 124, off + 136)).replace(/\0.*$/s, '').trim() || '0', 8);
    if (name === wanted) return strFromU8(buf.subarray(off + 512, off + 512 + size));
    off += 512 + Math.ceil(size / 512) * 512;
  }
  throw new Error(`${wanted} not in package`);
}

function literal(src, name) {
  const start = src.indexOf(`var ${name} = {`);
  if (start < 0) throw new Error(`literal ${name} not found`);
  let depth = 0, inStr = null, esc = false;
  const i = src.indexOf('{', start);
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return JSON5.parse(src.slice(i, j + 1));
  }
  throw new Error(`literal ${name} unterminated`);
}

console.log(`Downloading ${PKG}`);
const res = await fetch(PKG);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const src = untarFile(gunzipSync(new Uint8Array(await res.arrayBuffer())), 'package/dist/server.js');
const foods = literal(src, 'foods_default');
const household = literal(src, 'household_default');
const profiles = literal(src, 'profiles_default');

const num = (v) => (v == null ? undefined : typeof v === 'object' && v.trace ? 0 : Number(v));
const round = (v) => (Math.abs(v) >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100);

// TACO nutrient key → Micenae key
const MAP = {
  energy_kcal: 'kcal', protein_g: 'protein', carbohydrate_g: 'carbs', lipids_g: 'fat', dietary_fiber_g: 'fiber',
  cholesterol_mg: 'cholesterol', sodium_mg: 'sodium', potassium_mg: 'potassium', calcium_mg: 'calcium', iron_mg: 'iron',
  magnesium_mg: 'magnesium', phosphorus_mg: 'phosphorus', zinc_mg: 'zinc', rae_mcg: 'vitA', vitamin_c_mg: 'vitC',
  thiamine_mg: 'thiamin', riboflavin_mg: 'riboflavin', niacin_mg: 'niacin', pyridoxine_mg: 'vitB6', moisture_pct: 'water',
};
const fa = profiles.tables.fatty_acids;
const faIdx = Object.fromEntries(fa.columns.map((c, i) => [c.key, i]));
const transKey = fa.columns.find((c) => /trans/i.test(c.key))?.key;
const faById = new Map(fa.foods.map((f) => [f.id, f.v]));
const measuresById = new Map(household.foods.map((h) => [h.taco_id, h.measures]));

function convert(f) {
  const n = {};
  for (const [k, ours] of Object.entries(MAP)) {
    const v = num(f.nutrients[k]);
    if (v != null && !Number.isNaN(v)) n[ours] = round(v);
  }
  const v = faById.get(f.id);
  if (v) {
    const pick = (key) => (key && faIdx[key] != null ? num(v[faIdx[key]]) : undefined);
    const sat = pick('saturated_g'), mono = pick('monounsaturated_g'), poly = pick('polyunsaturated_g'), trans = pick(transKey);
    if (sat != null) n.satFat = round(sat);
    if (mono != null) n.monoFat = round(mono);
    if (poly != null) n.polyFat = round(poly);
    if (trans != null) n.transFat = round(trans);
  }
  if (n.kcal == null) return null; // TACO leaves energy and macros blank for a few foods (fluid milks, salt) — skip rather than guess; USDA covers milk
  const p = (measuresById.get(f.id) ?? []).map((m) => ({ l: m.measure, g: round(m.grams) }));
  return { id: `taco:${f.id}`, name: f.name.replace(/\s+/g, ' ').trim(), cat: f.category, src: 'TACO', n, p };
}

const out = foods.foods.map(convert).filter(Boolean);

// ── Moqueca de peixe: recipe calculated from TACO ingredients ──
// Bahian-style, 4 servings. Raw weights in grams; ~10 % water lost while simmering.
const RECIPE = [[283, 800] /* cação, posta, crua */, [157, 300] /* tomate */, [107, 200] /* cebola */, [145, 100] /* pimentão vermelho */,
  [144, 100] /* pimentão verde */, [523, 200] /* leite de coco */, [259, 30] /* azeite de dendê */, [219, 30] /* limão, suco */];
const YIELD = 0.9;
const byId = new Map(foods.foods.map((f) => [f.id, f]));
const raw = RECIPE.reduce((s, [, g]) => s + g, 0);
const cooked = raw * YIELD;
const total = {};
for (const [id, g] of RECIPE) {
  const c = convert(byId.get(id));
  for (const [k, v] of Object.entries(c.n)) if (k !== 'water') total[k] = (total[k] ?? 0) + (v * g) / 100;
}
const moqueca = {
  id: 'taco-recipe:moqueca-peixe',
  name: 'Moqueca de peixe (receita calculada)',
  cat: 'Alimentos preparados',
  src: 'TACO (receita)',
  n: Object.fromEntries(Object.entries(total).map(([k, v]) => [k, round((v / cooked) * 100)])),
  p: [{ l: 'porção (1/4 da receita)', g: round(cooked / 4) }, { l: 'concha', g: 150 }],
  recipe: RECIPE.map(([id, g]) => `${byId.get(id).name}: ${g} g`).join('; ') + `; rendimento ${Math.round(YIELD * 100)} %`,
};
out.push(moqueca);

writeFileSync(
  OUT,
  JSON.stringify({
    generatedAt: new Date().toISOString().slice(0, 10),
    sources: ['TACO 4ª ed. (NEPA/UNICAMP, 2011)', 'IBGE POF 2008-2009 — medidas caseiras', 'via taco-br-mcp@0.2.0 (MIT)'],
    license: 'TACO: reprodução permitida citando a fonte. IBGE: reutilização permitida citando a fonte.',
    basis: 'per 100 g',
    foods: out,
  }),
);
console.log(`Wrote ${out.length} foods to ${OUT}`);
console.log('Moqueca per 100 g:', JSON.stringify(moqueca.n));

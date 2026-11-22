#!/usr/bin/env node
/**
 * Builds Micenae's food catalog from USDA FoodData Central (public domain, CC0).
 *
 * Sources (https://fdc.nal.usda.gov/download-datasets/):
 *   - Foundation Foods  (analytical data, newest, highest quality)
 *   - SR Legacy         (the classic USDA Standard Reference — the same base
 *                        dataset most consumer apps, MyFitnessPal included,
 *                        built their generic-food entries on)
 *
 * Usage:
 *   node scripts/import-usda.mjs                       # download + build
 *   node scripts/import-usda.mjs --foundation f.json --sr sr.json   # local files
 *
 * Output: public/data/usda-foods.json — values are per 100 g of edible portion.
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';

const FOUNDATION_URL =
  'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-10-29.zip';
const SR_URL = 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_json_2018-04.zip';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'public/data/usda-foods.json');

/**
 * Our nutrient key -> FDC nutrient ids, in priority order (first one present wins).
 * Keep in sync with src/domain/nutrients.ts.
 */
const NUTRIENTS = {
  kcal: [1008, 2048, 2047],
  protein: [1003],
  carbs: [1005, 1050],
  fat: [1004, 1085],
  fiber: [1079],
  sugar: [2000, 1063],
  satFat: [1258],
  monoFat: [1292],
  polyFat: [1293],
  transFat: [1257],
  cholesterol: [1253],
  sodium: [1093],
  potassium: [1092],
  calcium: [1087],
  iron: [1089],
  magnesium: [1090],
  phosphorus: [1091],
  zinc: [1095],
  selenium: [1103],
  vitA: [1106],
  vitC: [1162],
  vitD: [1114],
  vitE: [1109],
  vitK: [1185],
  thiamin: [1165],
  riboflavin: [1166],
  niacin: [1167],
  vitB6: [1175],
  folate: [1177, 1190],
  vitB12: [1178],
  choline: [1180],
  caffeine: [1057],
  water: [1051],
};

const EXCLUDED_CATEGORIES = new Set(['Baby Foods']);

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function loadDataset(localPath, url, key) {
  if (localPath) return JSON.parse(readFileSync(localPath, 'utf8'))[key];
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const files = unzipSync(new Uint8Array(await res.arrayBuffer()));
  const name = Object.keys(files).find((f) => f.endsWith('.json'));
  return JSON.parse(strFromU8(files[name]))[key];
}

const round = (v) => (Math.abs(v) >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100);

function portionsOf(food) {
  const out = [];
  const seen = new Set();
  for (const p of food.foodPortions ?? []) {
    const amount = p.amount || p.value || 1;
    if (!p.gramWeight || p.gramWeight <= 0) continue;
    const unitName = p.measureUnit?.name;
    let label;
    if (unitName === 'RACC') label = 'serving (reference amount)';
    else if (!unitName || unitName === 'undetermined') label = p.modifier || p.portionDescription;
    else label = [unitName, p.modifier].filter(Boolean).join(', ');
    if (!label) continue;
    label = label.replace(/\s+/g, ' ').trim();
    const grams = round(p.gramWeight / amount);
    const k = `${label}|${grams}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ l: label, g: grams });
  }
  return out;
}

function convert(food, source) {
  const byId = new Map();
  for (const n of food.foodNutrients ?? []) {
    if (n.amount == null || !n.nutrient) continue;
    if (!byId.has(n.nutrient.id)) byId.set(n.nutrient.id, n.amount);
  }
  const n = {};
  for (const [key, ids] of Object.entries(NUTRIENTS)) {
    for (const id of ids) {
      if (byId.has(id)) {
        n[key] = round(byId.get(id));
        break;
      }
    }
  }
  if (n.kcal == null && (n.protein != null || n.carbs != null || n.fat != null)) {
    n.kcal = round(4 * (n.protein ?? 0) + 4 * (n.carbs ?? 0) + 9 * (n.fat ?? 0));
  }
  if (n.kcal == null) return null;
  return {
    id: `usda:${food.fdcId}`,
    name: food.description.trim(),
    cat: food.foodCategory?.description ?? 'Other',
    src: source,
    n,
    p: portionsOf(food),
  };
}

const foundation = await loadDataset(arg('--foundation'), FOUNDATION_URL, 'FoundationFoods');
const sr = await loadDataset(arg('--sr'), SR_URL, 'SRLegacyFoods');

const foods = [];
const names = new Set();
for (const [list, src] of [
  [foundation, 'USDA Foundation'],
  [sr, 'USDA SR Legacy'],
]) {
  for (const f of list) {
    if (EXCLUDED_CATEGORIES.has(f.foodCategory?.description)) continue;
    const c = convert(f, src);
    if (!c) continue;
    const key = c.name.toLowerCase();
    if (names.has(key)) continue; // Foundation wins over SR Legacy duplicates
    names.add(key);
    foods.push(c);
  }
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  JSON.stringify({
    generatedAt: new Date().toISOString().slice(0, 10),
    sources: [FOUNDATION_URL, SR_URL],
    license: 'USDA FoodData Central — public domain (CC0 1.0)',
    basis: 'per 100 g',
    foods,
  }),
);
console.log(`Wrote ${foods.length} foods to ${OUT}`);

import type { Food } from '../domain/types';
import type { Nutrients } from '../domain/nutrients';
import { LOCALE } from '../i18n';

/**
 * Packaged products by barcode (EAN-13, EAN-8, UPC-A, GTIN-14).
 *
 *  1. USDA FoodData Central "Branded Foods" — official, manufacturer-submitted label data (US market).
 *  2. Open Food Facts — open global database (strong in Brazil and Europe), community-contributed.
 * US/Canada GS1 prefixes ask USDA first; everything else asks Open Food Facts first.
 */

const USDA_KEY = 'DEMO_KEY'; // free api.data.gov key; rate-limited per IP — Open Food Facts is the fallback

/** GS1 mod-10 check digit — rejects most camera misreads. */
export function validGtin(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop()!;
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

const stripZeros = (s: string) => s.replace(/^0+/, '');
/** GS1 prefixes 000–139 are US/Canada */
const isUsCa = (code: string) => {
  const p = parseInt(code.padStart(13, '0').slice(0, 3), 10);
  return p <= 139;
};

const title = (s: string) =>
  s.length > 3 && s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s,(/-])([a-zà-ú])/g, (_, a, b) => a + b.toUpperCase()) : s;

const r1 = (v: number) => (Math.abs(v) >= 10 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100);

// ── USDA Branded ───────────────────────────────────────────────

const USDA_IDS: Record<number, keyof Nutrients> = {
  1008: 'kcal', 1003: 'protein', 1004: 'fat', 1005: 'carbs', 1079: 'fiber', 2000: 'sugar', 1258: 'satFat', 1257: 'transFat',
  1253: 'cholesterol', 1093: 'sodium', 1092: 'potassium', 1087: 'calcium', 1089: 'iron', 1162: 'vitC', 1090: 'magnesium', 1095: 'zinc',
};

export function fromUsda(item: any, code: string): Food | null {
  const n: Nutrients = {};
  for (const fn of item.foodNutrients ?? []) {
    const key = USDA_IDS[fn.nutrientId];
    if (key && typeof fn.value === 'number') n[key] = r1(fn.value);
  }
  if (n.kcal == null) return null;
  const unit = String(item.servingSizeUnit ?? '').toLowerCase();
  const grams = typeof item.servingSize === 'number' && /^(g|grm|ml|mlt)$/.test(unit) ? item.servingSize : undefined;
  return {
    id: `barcode:${code}`,
    name: title(String(item.description ?? 'Product')),
    brand: item.brandName || item.brandOwner || undefined,
    category: 'Packaged',
    source: 'USDA Branded',
    nutrients: n,
    portions: grams ? [{ label: item.householdServingFullText ? String(item.householdServingFullText).toLowerCase() : 'serving', grams }] : [],
    barcode: code,
  };
}

async function usda(code: string, signal?: AbortSignal): Promise<Food | null> {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${USDA_KEY}&dataType=Branded&pageSize=10&query=${code}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null; // 429 rate limit etc. → let the other source answer
  const json = await res.json();
  const hit = (json.foods ?? []).find((f: any) => stripZeros(String(f.gtinUpc ?? '')) === stripZeros(code));
  return hit ? fromUsda(hit, code) : null;
}

// ── Open Food Facts ────────────────────────────────────────────

/** OFF reports *_100g in grams for every mass nutrient; convert to our units. */
const OFF_MAP: [string, keyof Nutrients, number][] = [
  ['proteins_100g', 'protein', 1], ['carbohydrates_100g', 'carbs', 1], ['fat_100g', 'fat', 1], ['fiber_100g', 'fiber', 1],
  ['sugars_100g', 'sugar', 1], ['saturated-fat_100g', 'satFat', 1], ['trans-fat_100g', 'transFat', 1],
  ['cholesterol_100g', 'cholesterol', 1000], ['sodium_100g', 'sodium', 1000], ['potassium_100g', 'potassium', 1000],
  ['calcium_100g', 'calcium', 1000], ['iron_100g', 'iron', 1000], ['magnesium_100g', 'magnesium', 1000], ['zinc_100g', 'zinc', 1000],
  ['vitamin-c_100g', 'vitC', 1000], ['vitamin-a_100g', 'vitA', 1e6], ['vitamin-d_100g', 'vitD', 1e6],
];

export function fromOff(p: any, code: string): Food | null {
  const nm = p.nutriments ?? {};
  const n: Nutrients = {};
  const kcal = typeof nm['energy-kcal_100g'] === 'number' ? nm['energy-kcal_100g'] : typeof nm.energy_100g === 'number' ? nm.energy_100g / 4.184 : undefined;
  if (kcal == null) return null;
  n.kcal = r1(kcal);
  for (const [k, ours, f] of OFF_MAP) if (typeof nm[k] === 'number') n[ours] = r1(nm[k] * f);
  if (n.sodium == null && typeof nm.salt_100g === 'number') n.sodium = r1((nm.salt_100g / 2.5) * 1000);
  const name =
    (LOCALE === 'pt' ? p.product_name_pt : p.product_name_en) || p.product_name || p.product_name_en || p.product_name_pt || 'Product';
  const grams = typeof p.serving_quantity === 'number' ? p.serving_quantity : parseFloat(p.serving_quantity);
  return {
    id: `barcode:${code}`,
    name: String(name).trim(),
    brand: p.brands ? String(p.brands).split(',')[0].trim() : undefined,
    category: 'Packaged',
    source: 'Open Food Facts',
    nutrients: n,
    portions: grams > 0 ? [{ label: p.serving_size ? `serving (${p.serving_size})` : 'serving', grams }] : [],
    barcode: code,
  };
}

async function openFoodFacts(code: string, signal?: AbortSignal): Promise<Food | null> {
  const fields = 'code,product_name,product_name_pt,product_name_en,brands,nutriments,serving_quantity,serving_size';
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${fields}`, { signal });
  if (!res.ok) return null;
  const json = await res.json();
  return json.status === 1 && json.product ? fromOff(json.product, code) : null;
}

export async function lookupBarcode(raw: string, signal?: AbortSignal): Promise<Food | null> {
  const code = raw.replace(/\D/g, '');
  const order = isUsCa(code) ? [usda, openFoodFacts] : [openFoodFacts, usda];
  for (const source of order) {
    try {
      const food = await source(code, signal);
      if (food) return food;
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
      // network error on one source → try the next
    }
  }
  return null;
}

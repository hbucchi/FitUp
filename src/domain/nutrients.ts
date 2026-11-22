import { t } from '../i18n';
/** Nutrient definitions. All food values are stored per 100 g. */
export type NutrientKey =
  | 'kcal' | 'protein' | 'carbs' | 'fat'
  | 'fiber' | 'sugar' | 'satFat' | 'monoFat' | 'polyFat' | 'transFat' | 'cholesterol'
  | 'sodium' | 'potassium' | 'calcium' | 'iron' | 'magnesium' | 'phosphorus' | 'zinc' | 'selenium'
  | 'vitA' | 'vitC' | 'vitD' | 'vitE' | 'vitK'
  | 'thiamin' | 'riboflavin' | 'niacin' | 'vitB6' | 'folate' | 'vitB12' | 'choline'
  | 'caffeine' | 'water';

export type Nutrients = Partial<Record<NutrientKey, number>>;

export type NutrientGroup = 'energy' | 'macro' | 'detail' | 'mineral' | 'vitamin' | 'other';

export interface NutrientDef {
  key: NutrientKey;
  label: string;
  unit: 'kcal' | 'g' | 'mg' | 'µg';
  group: NutrientGroup;
  /** Daily Value (FDA, adults & children ≥4 y), used for %DV. */
  dv?: number;
}

export const NUTRIENTS: NutrientDef[] = [
  { key: 'kcal', label: t('Energy'), unit: 'kcal', group: 'energy' },
  { key: 'protein', label: t('Protein'), unit: 'g', group: 'macro', dv: 50 },
  { key: 'carbs', label: t('Carbohydrate'), unit: 'g', group: 'macro', dv: 275 },
  { key: 'fat', label: t('Fat'), unit: 'g', group: 'macro', dv: 78 },
  { key: 'fiber', label: t('Fiber'), unit: 'g', group: 'detail', dv: 28 },
  { key: 'sugar', label: t('Sugars'), unit: 'g', group: 'detail' },
  { key: 'satFat', label: t('Saturated fat'), unit: 'g', group: 'detail', dv: 20 },
  { key: 'monoFat', label: t('Monounsaturated fat'), unit: 'g', group: 'detail' },
  { key: 'polyFat', label: t('Polyunsaturated fat'), unit: 'g', group: 'detail' },
  { key: 'transFat', label: t('Trans fat'), unit: 'g', group: 'detail' },
  { key: 'cholesterol', label: t('Cholesterol'), unit: 'mg', group: 'detail', dv: 300 },
  { key: 'sodium', label: t('Sodium'), unit: 'mg', group: 'mineral', dv: 2300 },
  { key: 'potassium', label: t('Potassium'), unit: 'mg', group: 'mineral', dv: 4700 },
  { key: 'calcium', label: t('Calcium'), unit: 'mg', group: 'mineral', dv: 1300 },
  { key: 'iron', label: t('Iron'), unit: 'mg', group: 'mineral', dv: 18 },
  { key: 'magnesium', label: t('Magnesium'), unit: 'mg', group: 'mineral', dv: 420 },
  { key: 'phosphorus', label: t('Phosphorus'), unit: 'mg', group: 'mineral', dv: 1250 },
  { key: 'zinc', label: t('Zinc'), unit: 'mg', group: 'mineral', dv: 11 },
  { key: 'selenium', label: t('Selenium'), unit: 'µg', group: 'mineral', dv: 55 },
  { key: 'vitA', label: t('Vitamin A (RAE)'), unit: 'µg', group: 'vitamin', dv: 900 },
  { key: 'vitC', label: t('Vitamin C'), unit: 'mg', group: 'vitamin', dv: 90 },
  { key: 'vitD', label: t('Vitamin D'), unit: 'µg', group: 'vitamin', dv: 20 },
  { key: 'vitE', label: t('Vitamin E'), unit: 'mg', group: 'vitamin', dv: 15 },
  { key: 'vitK', label: t('Vitamin K'), unit: 'µg', group: 'vitamin', dv: 120 },
  { key: 'thiamin', label: t('Thiamin (B1)'), unit: 'mg', group: 'vitamin', dv: 1.2 },
  { key: 'riboflavin', label: t('Riboflavin (B2)'), unit: 'mg', group: 'vitamin', dv: 1.3 },
  { key: 'niacin', label: t('Niacin (B3)'), unit: 'mg', group: 'vitamin', dv: 16 },
  { key: 'vitB6', label: t('Vitamin B6'), unit: 'mg', group: 'vitamin', dv: 1.7 },
  { key: 'folate', label: t('Folate'), unit: 'µg', group: 'vitamin', dv: 400 },
  { key: 'vitB12', label: t('Vitamin B12'), unit: 'µg', group: 'vitamin', dv: 2.4 },
  { key: 'choline', label: t('Choline'), unit: 'mg', group: 'vitamin', dv: 550 },
  { key: 'caffeine', label: t('Caffeine'), unit: 'mg', group: 'other' },
  { key: 'water', label: t('Water'), unit: 'g', group: 'other' },
];

export const NUTRIENT_BY_KEY = Object.fromEntries(NUTRIENTS.map((n) => [n.key, n])) as Record<
  NutrientKey,
  NutrientDef
>;

/** Scale per-100 g nutrients to an amount in grams. */
export function scaleNutrients(per100: Nutrients, grams: number): Nutrients {
  const f = grams / 100;
  const out: Nutrients = {};
  for (const k in per100) {
    const v = per100[k as NutrientKey];
    if (v != null) out[k as NutrientKey] = v * f;
  }
  return out;
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  const out: Nutrients = {};
  for (const n of list) {
    for (const k in n) {
      const key = k as NutrientKey;
      out[key] = (out[key] ?? 0) + (n[key] ?? 0);
    }
  }
  return out;
}

export function fmt(v: number | undefined, digits = 0): string {
  if (v == null || Number.isNaN(v)) return '—';
  if (digits === 0 && Math.abs(v) < 10 && v !== 0) return v.toFixed(1).replace(/\.0$/, '');
  return v.toFixed(digits);
}

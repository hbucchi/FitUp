import type { Food, Portion } from './types';

/**
 * Converts "quantity + unit" into grams for a given food,
 * using the food's own USDA household measures whenever possible.
 */

const MASS: Record<string, number> = { g: 1, kg: 1000, mg: 0.001, oz: 28.3495, lb: 453.592 };
const ML: Record<string, number> = { ml: 1, l: 1000, cup: 240, glass: 250, tbsp: 15, tsp: 5 };

const UNIT_ALIASES: Record<string, string[]> = {
  cup: ['cup'],
  glass: ['cup', 'fl oz'],
  tbsp: ['tbsp', 'tablespoon'],
  tsp: ['tsp', 'teaspoon'],
  slice: ['slice'],
  piece: ['piece', 'item', 'each', 'unit'],
  scoop: ['scoop'],
  serving: ['serving', 'nlea'],
  bowl: ['cup', 'serving'],
  plate: ['serving'],
  can: ['can'],
  bar: ['bar'],
  fillet: ['fillet'],
  breast: ['breast', 'half breast'],
  large: ['large', 'extra large'],
  medium: ['medium'],
  small: ['small'],
};

/** Portions that describe "one of the thing" — used when someone says "two eggs". */
const COUNT_HINTS = ['large', 'medium', 'whole', 'fruit', 'each', 'piece', 'item', 'egg', 'unit', 'slice', 'breast', 'fillet', 'small', 'bar', 'cookie', 'muffin'];

const BOWL_MULTIPLIER = 1.5; // a bowl ≈ 1.5 cups

const MEASURE_PREFIX = /^(cup|tbsp|tablespoon|tsp|teaspoon|oz|fl oz|lb|container|package|can|jar|serving)\b/i;

function findPortion(food: Food, words: string[]): Portion | undefined {
  const lower = food.portions.map((p) => ({ p, l: p.label.toLowerCase() }));
  for (const w of words) {
    // 1) the label *is* that measure: "large", "slice", "cup, chopped"
    const starts = lower.find((x) => x.l === w || x.l.startsWith(`${w},`) || x.l.startsWith(`${w} `));
    if (starts) return starts.p;
  }
  for (const w of words) {
    // 2) mentioned inside a label that isn't some other measure — avoids "cup (4.86 large eggs)" for "large"
    const inside = lower.find((x) => !MEASURE_PREFIX.test(x.l) && x.l.split(/[\s,()]+/).includes(w));
    if (inside) return inside.p;
  }
  return undefined;
}

export function cupGrams(food: Food): number | undefined {
  const cup = food.portions.find((p) => /^cup\b/i.test(p.label));
  if (cup) return cup.grams;
  const tbsp = food.portions.find((p) => /^(tbsp|tablespoon)\b/i.test(p.label));
  if (tbsp) return tbsp.grams * 16;
  const ml = food.portions.find((p) => /^(milliliter|ml)\b/i.test(p.label));
  if (ml) return ml.grams * 240;
  const floz = food.portions.find((p) => /^fl oz\b/i.test(p.label));
  if (floz) return floz.grams * 8;
  return undefined;
}

export function countPortion(food: Food): Portion | undefined {
  // 1) a bare size label ("large" for eggs is the USDA standard unit)
  for (const exact of ['large', 'medium', 'each', 'piece', 'item', 'slice']) {
    const p = food.portions.find((x) => x.label.toLowerCase() === exact);
    if (p) return p;
  }
  // 2) a label that starts with a size/count word — "medium (7\" to 7-7/8\" long)", not "extra large"
  for (const hint of ['medium', 'large', 'whole', 'fruit', 'small']) {
    const p = food.portions.find((x) => x.label.toLowerCase().startsWith(hint));
    if (p) return p;
  }
  for (const hint of COUNT_HINTS) {
    const p = food.portions.find((x) => x.label.toLowerCase().split(/[\s,()]+/).includes(hint) && !MEASURE_PREFIX.test(x.label));
    if (p) return p;
  }
  return undefined;
}

export interface ResolvedAmount {
  /** unit shown in the diary — "g" or a portion label */
  unit: string;
  quantity: number;
  grams: number;
  /** false when we had to assume (e.g. 100 g serving) */
  confident: boolean;
}

export function resolveAmount(food: Food, quantity: number, unit?: string): ResolvedAmount {
  if (unit && unit in MASS) {
    const grams = quantity * MASS[unit];
    const oz = unit === 'oz' ? food.portions.find((p) => p.label === 'oz') : undefined;
    if (oz) return { unit: oz.label, quantity, grams: quantity * oz.grams, confident: true };
    return { unit: 'g', quantity: Math.round(grams), grams, confident: true };
  }

  if (unit && UNIT_ALIASES[unit]) {
    const p = findPortion(food, UNIT_ALIASES[unit]);
    if (p) {
      const q = unit === 'bowl' && /^cup/i.test(p.label) ? quantity * BOWL_MULTIPLIER : quantity;
      return { unit: p.label, quantity: q, grams: q * p.grams, confident: true };
    }
  }

  if (unit && unit in ML) {
    const ml = quantity * ML[unit];
    const cup = cupGrams(food);
    const grams = cup ? (ml / 240) * cup : ml; // fall back to density of water
    return { unit: 'g', quantity: Math.round(grams), grams, confident: !!cup };
  }

  if (!unit || unit === 'piece' || unit === 'serving') {
    const p = countPortion(food) ?? food.portions.find((x) => !/^(oz|lb)$/.test(x.label));
    if (p) return { unit: p.label, quantity, grams: quantity * p.grams, confident: !!unit || !!countPortion(food) };
  }

  // nothing usable — assume one serving = 100 g
  return { unit: 'g', quantity: Math.round(quantity * 100), grams: quantity * 100, confident: false };
}

/** Units the user can pick for a food in the UI. */
export function unitOptions(food: Food): Portion[] {
  return [{ label: 'g', grams: 1 }, ...food.portions];
}

export function gramsFor(food: Food, quantity: number, unit: string): number {
  if (unit === 'g') return quantity;
  const p = food.portions.find((x) => x.label === unit);
  return p ? quantity * p.grams : quantity;
}

import type { Meal } from '../domain/types';

/**
 * Turns a spoken description into structured items:
 *   "for breakfast I had two scrambled eggs, a slice of toast and 200 g of greek yogurt"
 *   → meal: breakfast
 *     [ {qty 2, food "scrambled eggs"}, {qty 1, unit slice, food "toast"},
 *       {qty 200, unit g, food "greek yogurt"} ]
 */

export interface ParsedItem {
  raw: string;
  quantity: number;
  /** canonical unit (see UNITS) or a size word; undefined = "count" of the food */
  unit?: string;
  food: string;
  /** true when the quantity was explicitly said */
  explicitQty: boolean;
}

export interface ParsedUtterance {
  meal?: Meal;
  time?: string;
  items: ParsedItem[];
}

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, a: 1, an: 1, one: 1, single: 1, two: 2, couple: 2, pair: 2, three: 3, few: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  half: 0.5, quarter: 0.25,
};

/** spoken unit → canonical unit */
export const UNITS: Record<string, string> = {
  g: 'g', gr: 'g', gram: 'g', grams: 'g', gramme: 'g', grammes: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  mg: 'mg', milligram: 'mg', milligrams: 'mg',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  l: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  cup: 'cup', cups: 'cup', mug: 'cup', mugs: 'cup', glass: 'glass', glasses: 'glass',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', spoon: 'tbsp', spoons: 'tbsp', spoonful: 'tbsp', spoonfuls: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  slice: 'slice', slices: 'slice',
  piece: 'piece', pieces: 'piece',
  scoop: 'scoop', scoops: 'scoop',
  serving: 'serving', servings: 'serving', portion: 'serving', portions: 'serving',
  bowl: 'bowl', bowls: 'bowl', plate: 'plate', plates: 'plate',
  can: 'can', cans: 'can', tin: 'can', tins: 'can',
  bar: 'bar', bars: 'bar', handful: 'handful', handfuls: 'handful',
  fillet: 'fillet', fillets: 'fillet', breast: 'breast', breasts: 'breast',
  large: 'large', medium: 'medium', small: 'small', big: 'large',
};

/** Units that are describing the food rather than a measure, e.g. "two chicken breasts". */
const NOUN_UNITS = new Set(['breast', 'fillet']);

const MEAL_PATTERNS: [RegExp, Meal][] = [
  [/\b(after|post)[\s-]*(my |the )?(workout|training|gym|session|lifting)\b/, 'post-workout'],
  [/\b(before|pre)[\s-]*(my |the )?(workout|training|gym|session|lifting)\b/, 'pre-workout'],
  [/\b(breakfast|brekkie|brunch|this morning)\b/, 'breakfast'],
  [/\b(lunch|lunchtime|midday)\b/, 'lunch'],
  [/\b(dinner|supper|tonight|this evening)\b/, 'dinner'],
  [/\b(snack|snacks|snacking)\b/, 'snack'],
];

const FILLER = [
  /\b(for|at|during|as|my|the)\s+(breakfast|brekkie|brunch|lunch|lunchtime|dinner|supper|snack|snacks)\b/g,
  /\b(after|before|post|pre)[\s-]*(my |the )?(workout|training|gym|session|lifting)\b/g,
  /\b(this morning|this evening|tonight|today|yesterday|just now|earlier)\b/g,
  /\b(i|we)\s*('ve|'m|'d| have| am| had| just)?\s*(just\s+)?(had|have|ate|eaten|eat|drank|drunk|drink|having|eating|drinking|grabbed|got)\b/g,
  /\b(please\s+)?(log|add|record|track)\b/g,
  /\b(about|around|approximately|roughly|like|maybe|some|um+|uh+|so|also|then)\b/g,
];

const SPLIT = /\s*(?:,|;|\band then\b|\bthen\b|\bplus\b|\bwith\b|\band\b|&|\balong with\b)\s*/;

const HALF = 'and_a_half';

export function wordsToNumber(tokens: string[], i: number): { value: number; next: number } | null {
  const t = tokens[i];
  if (t == null) return null;
  const frac = (x: string) => {
    const [a, b] = x.split('/').map(Number);
    return b ? a / b : NaN;
  };

  // numerals: "2", "1.5", "1/2", "1 1/2", "2 and a half"
  if (/^\d+(\.\d+)?$/.test(t) || /^\d+\/\d+$/.test(t)) {
    let value = t.includes('/') ? frac(t) : parseFloat(t);
    let next = i + 1;
    if (/^\d+\/\d+$/.test(tokens[next] ?? '')) value += frac(tokens[next++]);
    if (tokens[next] === HALF) {
      value += 0.5;
      next++;
    }
    return { value, next };
  }

  // "a"/"an": "a couple of", "a few", "a dozen", "a half", "a hundred", or just 1
  let j = i;
  let cur = 0;
  let any = false;
  if (t === 'a' || t === 'an') {
    const n = tokens[i + 1];
    if (n && ['couple', 'pair', 'few', 'dozen', 'half', 'hundred'].includes(n)) {
      j = i + 1;
    } else {
      return { value: 1, next: i + 1 };
    }
  }
  while (j < tokens.length) {
    const w = tokens[j];
    if (w === 'hundred') cur = (cur || 1) * 100;
    else if (w === HALF && any) cur += 0.5;
    else if (w in NUMBER_WORDS && w !== 'a' && w !== 'an') cur += NUMBER_WORDS[w];
    else break;
    any = true;
    j++;
  }
  if (!any) return null;
  if (tokens[j] === 'of') j++; // "a couple of", "half of"
  return { value: cur, next: j };
}

function detectMeal(text: string): Meal | undefined {
  for (const [re, meal] of MEAL_PATTERNS) if (re.test(text)) return meal;
  return undefined;
}

function detectTime(text: string): string | undefined {
  const m = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/);
  if (!m) return undefined;
  let h = parseInt(m[1], 10) % 12;
  if (m[3].startsWith('p')) h += 12;
  return `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`;
}

function parseSegment(seg: string): ParsedItem | null {
  const raw = seg.trim();
  // split glued quantities: "200g" → "200 g", "1.5kg" → "1.5 kg"
  const tokens = raw
    .replace(/(\d)([a-z])/g, '$1 $2')
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return null;

  let i = 0;
  let quantity = 1;
  let explicitQty = false;
  const num = wordsToNumber(tokens, i);
  if (num) {
    quantity = num.value;
    explicitQty = true;
    i = num.next;
  }

  let unit: string | undefined;
  const maybeUnit = tokens[i];
  if (maybeUnit && maybeUnit in UNITS && i < tokens.length - 1) {
    unit = UNITS[maybeUnit];
    i++;
    if (tokens[i] === 'of') i++;
  }
  // "a cup and a half of rice"
  if (unit && tokens[i] === HALF) {
    quantity += 0.5;
    i++;
    if (tokens[i] === 'of') i++;
  }
  if (!unit && tokens[i] === 'a' && tokens[i + 1] in UNITS) {
    // "half a cup of rice"
    unit = UNITS[tokens[i + 1]];
    i += 2;
    if (tokens[i] === 'of') i++;
  }

  let foodTokens = tokens.slice(i);
  // size words can also come right before the food after the unit: "two large eggs"
  if (!unit && foodTokens.length > 1 && ['large', 'medium', 'small', 'big'].includes(foodTokens[0])) {
    unit = UNITS[foodTokens[0]];
    foodTokens = foodTokens.slice(1);
  }
  // keep noun-like units as part of the food name, e.g. "2 chicken breasts"
  if (unit && NOUN_UNITS.has(unit)) {
    foodTokens = [...foodTokens, unit];
  }
  const food = foodTokens.join(' ').replace(/^(of|a|an|the)\s+/, '').trim();
  if (!food) return null;
  return { raw, quantity, unit, food, explicitQty };
}

export function parseUtterance(input: string): ParsedUtterance {
  let text = ' ' + input.toLowerCase().replace(/[!?]|\.(?!\d)/g, ' ').replace(/\s+/g, ' ') + ' ';
  const meal = detectMeal(text);
  const time = detectTime(text);
  text = text.replace(/\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(am|pm|a\.m\.|p\.m\.)\b/g, ' ');
  for (const re of FILLER) text = text.replace(re, ' ');
  text = text
    .replace(/\band a half\b/g, ` ${HALF} `)
    .replace(/\bhundred and\b/g, 'hundred')
    .replace(/\bfor\s*$/, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const items: ParsedItem[] = [];
  for (const seg of text.split(SPLIT)) {
    const s = seg.trim().replace(/^(and|with|for|of)\s+/, '');
    if (!s) continue;
    const item = parseSegment(s);
    if (item) items.push(item);
  }
  return { meal, time, items };
}

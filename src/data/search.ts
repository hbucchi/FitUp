import type { Food } from '../domain/types';

/**
 * Lightweight food search tuned for USDA-style names
 * ("Egg, whole, cooked, scrambled") and for spoken queries ("scrambled eggs").
 */

const SYNONYMS: Record<string, string[]> = {
  yoghurt: ['yogurt'],
  oatmeal: ['oat'],
  porridge: ['oat'],
  oats: ['oat'],
  fries: ['french', 'fried', 'potato'],
  chips: ['chip'],
  soda: ['carbonated', 'beverage'],
  coke: ['cola'],
  pb: ['peanut', 'butter'],
  steak: ['beef', 'steak'],
  mince: ['ground'],
  minced: ['ground'],
  hamburger: ['hamburger'],
  prawn: ['shrimp'],
  aubergine: ['eggplant'],
  courgette: ['zucchini'],
  capsicum: ['pepper'],
  coriander: ['cilantro'],
  rocket: ['arugula'],
  scallion: ['onion'],
  garbanzo: ['chickpea'],
  chickpeas: ['chickpea'],
  whey: ['whey'],
  ketchup: ['catsup'],
  spud: ['potato'],
  veggie: ['vegetable'],
  toast: ['toasted'],
  lowfat: ['lowfat'],
  skim: ['nonfat'],
  skimmed: ['nonfat'],
};

const STOP = new Set(['of', 'the', 'a', 'an', 'with', 'and', 'or', 'in', 'some', 'my', 'fresh']);

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9%\s,]/g, ' ');
}

export function stem(t: string): string {
  if (t.length <= 3) return t;
  if (t.endsWith('ies') && t.length > 4) return t.slice(0, -3) + 'y';
  if (/(oes|ches|shes|sses|xes)$/.test(t)) return t.slice(0, -2);
  if (t.endsWith('s') && !t.endsWith('ss') && !t.endsWith('us')) return t.slice(0, -1);
  return t;
}

export function tokenize(s: string): string[] {
  return normalize(s)
    .split(/[\s,]+/)
    .filter((t) => t && !STOP.has(t))
    .map(stem);
}

function expandQuery(tokens: string[]): string[][] {
  // each query token becomes a group of acceptable alternatives
  return tokens.map((t) => [t, ...(SYNONYMS[t] ?? []).map(stem)]);
}

/** USDA names often start with a category ("Beverages, coffee…") — look past it. */
const CATEGORY_PREFIX = new Set([
  'beverages', 'cereals', 'fish', 'nuts', 'seeds', 'spices', 'oil', 'snacks', 'candies',
  'fast foods', 'restaurant', 'cheese', 'cookies', 'crackers', 'sauce', 'soup', 'alcoholic beverage',
]);

/** Processed / unusual forms people rarely mean when they just say the food's name. */
const UNCOMMON = /\b(dried|dehydrated|powder|powdered|dry mix|mix|imitation|frozen|canned|babyfood|substitute|fast foods|restaurant|flour|concentrate|stabilized|industrial|commercial formula|freeze-dried|glaze)\b/i;

/** Everyday staples; a small hand-curated popularity prior until we have real usage data. */
const COMMON: RegExp[] = [
  /^Egg, whole, (raw, fresh|cooked, (hard-boiled|scrambled|fried))/,
  /^Chicken, broiler(s|) or fryers, breast, (meat only|skinless, boneless, meat only), cooked, (roasted|grilled)/,
  /^Chicken, broilers or fryers, thigh, meat only, cooked, roasted/,
  /^Milk, (whole, 3\.25%|reduced fat, fluid, 2%|lowfat, fluid, 1%|nonfat, fluid)/,
  /^Rice, (white|brown), (long-grain|medium-grain), (regular, )?(enriched, )?cooked/,
  /^Cereals, oats, regular and quick and instant, unenriched, cooked with water/,
  /^Beverages, coffee, brewed, prepared with tap water$/,
  /^Beverages, tea, black, brewed, prepared with tap water$/,
  /^Bread, (white|whole-wheat), commercially prepared/,
  /^Fish, salmon, Atlantic, (farmed|wild), (raw|cooked, dry heat)/,
  /^Fish, tuna, light, canned in water, drained solids/,
  /^Beef, ground, (85|90|93)% lean meat \/ (15|10|7)% fat, patty, cooked, pan-broiled/,
  /^Oil, olive, salad or cooking/,
  /^Orange juice, raw/,
  /^Pasta, cooked, enriched, without added salt/,
  /^Bananas, raw$/,
  /^Apples, raw, with skin/,
  /^Potatoes, baked, flesh and skin, without salt/,
  /^Sweet potato, cooked, baked in skin, flesh, without salt/,
  /^Nuts, almonds$/,
  /^Peanut butter, smooth style, without salt/,
  /^Yogurt, Greek, plain, (nonfat|whole milk)/,
  /^Cheese, cheddar$/,
  /^Broccoli, (raw|cooked, boiled, drained, without salt)$/,
  /^Avocados, raw, all commercial varieties/,
  /^Oil, olive, extra virgin/,
  /^Beverages, Whey protein powder isolate/,
];

interface Indexed {
  food: Food;
  tokens: string[];
  head: Set<string>; // tokens of the leading descriptive segment(s)
  prior: number;
}

export interface SearchIndex {
  items: Indexed[];
}

export function buildIndex(foods: Food[]): SearchIndex {
  return {
    items: foods.map((food) => {
      const segs = food.name.split(',').map((x) => x.trim());
      const headSegs = CATEGORY_PREFIX.has(segs[0].toLowerCase()) ? segs.slice(0, 2) : segs.slice(0, 1);
      let prior = 0;
      if (UNCOMMON.test(food.name)) prior -= 0.2;
      if (COMMON.some((r) => r.test(food.name))) prior += 0.45;
      return { food, tokens: tokenize(food.name), head: new Set(tokenize(headSegs.join(' '))), prior };
    }),
  };
}

function tokenScore(alts: string[], it: Indexed): number {
  let best = 0;
  for (const q of alts) {
    for (const t of it.tokens) {
      let s = 0;
      if (t === q) s = 1;
      else if (q.length >= 3 && t.startsWith(q)) s = 0.75;
      else if (t.length >= 4 && q.startsWith(t)) s = 0.55;
      if (s > 0 && it.head.has(t)) s += 0.35;
      if (s > best) best = s;
    }
  }
  return best;
}

export interface SearchOptions {
  limit?: number;
  /** extra score per food id (recency, user foods, …) */
  boost?: Record<string, number>;
}

export interface SearchHit {
  food: Food;
  score: number;
}

export function search(index: SearchIndex, query: string, opts: SearchOptions = {}): SearchHit[] {
  const { limit = 30, boost = {} } = opts;
  const groups = expandQuery(tokenize(query));
  if (groups.length === 0) return [];
  const hits: SearchHit[] = [];
  for (const it of index.items) {
    let total = 0;
    let matched = 0;
    for (const alts of groups) {
      const s = tokenScore(alts, it);
      if (s > 0) matched++;
      total += s;
    }
    // every term must match for short queries; allow one miss for longer spoken phrases
    const allowedMisses = groups.length >= 3 ? 1 : 0;
    if (groups.length - matched > allowedMisses) continue;
    let score = total / groups.length;
    // prefer short, generic names — "Banana, raw" over "Bananas, dehydrated, or banana powder"
    score -= Math.min(0.3, Math.max(0, it.tokens.length - groups.length) * 0.03);
    score += it.prior;
    if (it.food.source === 'USDA Foundation') score += 0.05;
    if (it.food.source === 'Custom') score += 0.25;
    if (/\braw\b/i.test(it.food.name) && it.tokens.length <= 4) score += 0.05;
    score += boost[it.food.id] ?? 0;
    hits.push({ food: it.food, score });
  }
  hits.sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length);
  return hits.slice(0, limit);
}

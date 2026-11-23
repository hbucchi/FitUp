import type { Food } from '../domain/types';
import { LOCALE, type Locale } from '../i18n';

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
  steak: ['steak'],
  baked: ['baked', 'roasted', 'cooked'],
  roasted: ['roasted', 'baked', 'cooked'],
  grilled: ['grilled', 'broiled', 'cooked'],
  boiled: ['boiled', 'cooked'],
  poached: ['poached', 'cooked'],
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
  // Portuguese → English, so USDA foods are findable in Portuguese too
  ovo: ['egg'], arroz: ['rice'], frango: ['chicken'], leite: ['milk'], pao: ['bread'], feijao: ['bean'],
  carne: ['beef'], peixe: ['fish'], batata: ['potato'], queijo: ['cheese'], cafe: ['coffee'], maca: ['apple'],
  aveia: ['oat'], iogurte: ['yogurt'], azeite: ['oil', 'olive'], manteiga: ['butter'], salmao: ['salmon'],
  atum: ['tuna'], camarao: ['shrimp'], porco: ['pork'], tomate: ['tomato'], cenoura: ['carrot'], alface: ['lettuce'],
  brocolis: ['broccoli'], espinafre: ['spinach'], laranja: ['orange'], morango: ['strawberry'], uva: ['grape'],
  abacate: ['avocado'], amendoim: ['peanut'], castanha: ['nut'], amendoa: ['almond'], acucar: ['sugar'],
  mel: ['honey'], suco: ['juice'], agua: ['water'], cerveja: ['beer'], vinho: ['wine'], cozido: ['cooked', 'boiled'],
  grelhado: ['grilled', 'broiled'], frito: ['fried'], assado: ['roasted', 'baked'], cru: ['raw'], integral: ['whole'],
  peito: ['breast'], coxa: ['thigh'], file: ['fillet'], branco: ['white', 'tipo'], branca: ['white'], mexido: ['scrambled'],
  moida: ['moido', 'ground'], moido: ['moido', 'ground'], bife: ['steak', 'bovina', 'bife'], macarrao: ['macarrao', 'pasta'],
  para: ['para', 'brasil'], desnatado: ['nonfat', 'skim'], semidesnatado: ['reduced', 'lowfat'],
};

const STOP = new Set(['of', 'the', 'a', 'an', 'with', 'and', 'or', 'in', 'some', 'my', 'fresh', 'de', 'do', 'da', 'dos', 'das', 'e', 'o', 'os', 'as', 'em', 'no', 'na']);

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
const UNCOMMON = /\b(candies|sauce|gravy|puffed|dry(?! heat)|0% moisture|dried|dehydrated|powder|powdered|dry mix|mix|imitation|frozen|canned|babyfood|substitute|fast foods|restaurant|flour|concentrate|stabilized|industrial|commercial formula|freeze-dried|glaze)\b/i;

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
  /^Beef, top sirloin, steak, separable lean only, trimmed to 0" fat, all grades, cooked, broiled/,
  /^Fish, salmon, Atlantic, farmed, cooked, dry heat/,
  /^Beans, (black|kidney, red|pinto), mature seeds, cooked, boiled, without salt/,
  /^Lentils, mature seeds, cooked, boiled, without salt/,
  /^Chickpeas \(garbanzo beans, bengal gram\), mature seeds, cooked, boiled, without salt/,
];

/** TACO: processed forms ("pó" = powder) and staples nobody eats raw. */
const UNCOMMON_PT = /(?<![a-zà-ú])(extrato|pó|desidratad[ao]s?|industrializad[ao]s?|conserva|instantâneo|congelad[ao]|xarope|glucose)(?![a-zà-ú])/i;
const RAW_PT = /(?<![a-zà-ú])cru[as]?(?![a-zà-ú])/i;
const COOKED_PT = /(?<![a-zà-ú])(cozid|assad|grelhad|frit|refogad)[ao]s?(?![a-zà-ú])/i;
/** "Feijão, carioca, cru" → "Feijão, carioca": raw and cooked versions share the name before the last part. */
const stemName = (name: string) => name.split(',').slice(0, -1).join(',').trim();

/** Brazilian everyday staples (TACO names). */
const COMMON_PT: RegExp[] = [
  /^Arroz, tipo 1, cozido/, // "arroz" means white rice; "arroz integral" still finds brown by its words
  /^Feijão, carioca, cozido/, // the most eaten bean nationally (preto leads in Rio)
  /^Ovo, de galinha, inteiro, (cozido|frito)/,
  /^Pão, trigo, francês/,
  /^Frango, peito, sem pele, (grelhado|cozido)/,
  /^Carne, bovina, (patinho|miolo de alcatra), sem gordura, grelhado/,
  /^Banana, (prata|nanica), crua/,
  /^Batata, inglesa, cozida/,
  /^Mandioca, cozida/,
  /^Mandioca, farofa, temperada/,
  /^Cuscuz, de milho, cozido com sal/,
  /^Queijo, minas, frescal/,
  /^Café, infusão 10%/,
  /^Iogurte, natural$/,
  /^Aveia, flocos, crua/,
  /^Tomate, com semente, cru/,
  /^Castanha-do-Brasil, crua/,
];

/** USDA foods that fill gaps in TACO (it leaves fluid milk blank) — ranked like TACO in Portuguese. */
const FILLS_PT: RegExp[] = [/^Milk, (whole, 3\.25%|reduced fat, fluid, 2%|lowfat, fluid, 1%|nonfat, fluid)/, /^Pasta, cooked, enriched, without added salt/];

/** Meat, fish and staples people eat cooked: the raw entry only wins when "raw"/"cru" is said. */
const USDA_RAW_MEAT = /^(Beef|Pork|Lamb|Veal|Chicken|Turkey|Fish|Crustaceans|Mollusks|Beans|Lentils|Chickpeas|Rice|Pasta|Quinoa)\b.*\braw\b/i;
const COOK_FIRST_PT = /^(Macarrão|Arroz|Feijão|Lentilha|Grão-de-bico|Carne|Frango|Peixe|Pescada|Sardinha|Ovo|Porco|Linguiça)/;
const SAYS_RAW = new Set(['raw', 'cru', 'crua']);

interface Indexed {
  food: Food;
  tokens: string[];
  head: Set<string>; // tokens of the leading descriptive segment(s)
  prior: number;
  /** a raw version of something normally eaten cooked */
  rawish: boolean;
  /** TACO, or a USDA food standing in for a TACO gap */
  brazil: boolean;
}

export interface SearchIndex {
  items: Indexed[];
}

export function buildIndex(foods: Food[]): SearchIndex {
  // TACO foods that also come cooked: the raw version is rarely what people mean (rice, beans, pão de queijo)
  const cookedToo = new Set(foods.filter((f) => f.source.startsWith('TACO') && COOKED_PT.test(f.name)).map((f) => stemName(f.name)));
  return {
    items: foods.map((food) => {
      const segs = food.name.split(',').map((x) => x.trim());
      const headSegs = CATEGORY_PREFIX.has(segs[0].toLowerCase()) ? segs.slice(0, 2) : segs.slice(0, 1);
      let prior = 0;
      if (UNCOMMON.test(food.name)) prior -= 0.2;
      if (COMMON.some((r) => r.test(food.name))) prior += 0.45;
      if (food.source.startsWith('TACO')) {
        if (UNCOMMON_PT.test(food.name)) prior -= 0.2;
        if (COMMON_PT.some((r) => r.test(food.name))) prior += 0.25;
      }
      const brazil = food.source.startsWith('TACO') || FILLS_PT.some((r) => r.test(food.name));
      const taco = food.source.startsWith('TACO');
      const rawish = taco ? RAW_PT.test(food.name) && (cookedToo.has(stemName(food.name)) || COOK_FIRST_PT.test(food.name)) : USDA_RAW_MEAT.test(food.name);
      return { food, tokens: tokenize(food.name), head: new Set(tokenize(headSegs.join(' '))), prior, brazil, rawish };
    }),
  };
}

function tokenScore(alts: string[], it: Indexed): number {
  let best = 0;
  for (const [i, q] of alts.entries()) {
    // the word itself beats its synonyms: "grilled" prefers "grilled" over "cooked"
    const weight = i === 0 || q.startsWith(alts[0]) ? 1 : 0.8; // "toast" → "toasted" is the same word
    for (const t of it.tokens) {
      let s = 0;
      if (t === q) s = 1;
      else if (q.length >= 3 && t.startsWith(q)) s = 0.75;
      else if (t.length >= 4 && q.startsWith(t)) s = 0.55;
      if (s > 0 && it.head.has(t)) s += 0.35;
      s *= weight;
      if (s > best) best = s;
    }
  }
  return best;
}

export interface SearchOptions {
  limit?: number;
  /** extra score per food id (recency, user foods, …) */
  boost?: Record<string, number>;
  /** ranks the Brazilian table first for 'pt' (default: the app language) */
  lang?: Locale;
}

export interface SearchHit {
  food: Food;
  score: number;
}

export function search(index: SearchIndex, query: string, opts: SearchOptions = {}): SearchHit[] {
  const { limit = 30, boost = {}, lang = LOCALE } = opts;
  const groups = expandQuery(tokenize(query));
  if (groups.length === 0) return [];
  const saysRaw = groups.some((g) => g.some((t) => SAYS_RAW.has(t)));
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
    if (it.rawish && !saysRaw) score -= 0.15;
    if (it.food.source === 'USDA Foundation') score += 0.05;
    if (it.food.source === 'Custom' || it.food.source === 'Label photo') score += 0.25;
    // Brazilian table first in Portuguese, USDA first in English
    if (it.brazil) score += lang === 'pt' ? 0.4 : it.food.source.startsWith('TACO') ? -0.05 : 0;
    if (/\braw\b/i.test(it.food.name) && it.tokens.length <= 4) score += 0.05;
    score += boost[it.food.id] ?? 0;
    hits.push({ food: it.food, score });
  }
  hits.sort((a, b) => b.score - a.score || a.food.name.length - b.food.name.length);
  return hits.slice(0, limit);
}

import type { Meal } from '../domain/types';
import { LOCALE, type Locale } from '../i18n';

/**
 * Turns a spoken description into structured items:
 *   "for breakfast I had two scrambled eggs, a slice of toast and 200 g of greek yogurt"
 *   → meal: breakfast
 *     [ {qty 2, food "scrambled eggs"}, {qty 1, unit slice, food "toast"},
 *       {qty 200, unit g, food "greek yogurt"} ]
 *
 * Brazilian Portuguese works the same way:
 *   "no almoço comi duas conchas de feijão, 150 g de arroz e um bife"
 *   → meal: lunch; [ {qty 2, unit ladle, food "feijão"}, {qty 150, unit g, food "arroz"}, {qty 1, unit fillet, food "bife"} ]
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
  // português
  um: 1, uma: 1, dois: 2, duas: 2, três: 3, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70,
  oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300,
  quatrocentos: 400, quatrocentas: 400, quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600,
  setecentos: 700, setecentas: 700, oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900,
  meio: 0.5, meia: 0.5, metade: 0.5, dúzia: 12, duzia: 12, dúzias: 12, duzias: 12, par: 2,
};
const PT_NUMBER = Object.keys(NUMBER_WORDS).filter((w) => /^(um|uma|dois|duas|tr[eê]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|(?:c|qu)atorze|quinze|deze\w+|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|cento|\w+centos|\w+centas|duzent\w+|trezent\w+)$/.test(w));

/** Letters incl. accents: JS \b treats "ã" as a non-word character, so Portuguese needs these. */
const L = 'a-z0-9_à-öø-ÿ';
const W = (body: string, flags = '') => new RegExp(`(?<![${L}])(?:${body})(?![${L}])`, flags);

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
  // português (multi-word measures like "colher de sopa" are rewritten first, see PT_MEASURES)
  grama: 'g', gramas: 'g', quilo: 'kg', quilos: 'kg', quilograma: 'kg', quilogramas: 'kg',
  miligrama: 'mg', miligramas: 'mg', mililitro: 'ml', mililitros: 'ml', litro: 'l', litros: 'l',
  xícara: 'cup', xícaras: 'cup', xicara: 'cup', xicaras: 'cup', caneca: 'cup', canecas: 'cup',
  copo: 'glass', copos: 'glass', colher: 'tbsp', colheres: 'tbsp',
  fatia: 'slice', fatias: 'slice', rodela: 'slice', rodelas: 'slice',
  pedaço: 'piece', pedaços: 'piece', pedaco: 'piece', pedacos: 'piece', unidade: 'piece', unidades: 'piece',
  dose: 'scoop', doses: 'scoop', medida: 'scoop', medidas: 'scoop',
  porção: 'serving', porções: 'serving', porcao: 'serving', porcoes: 'serving',
  prato: 'plate', pratos: 'plate', tigela: 'bowl', tigelas: 'bowl', pote: 'bowl', potes: 'bowl',
  lata: 'can', latas: 'can', barra: 'bar', barras: 'bar', barrinha: 'bar', barrinhas: 'bar',
  punhado: 'handful', punhados: 'handful', concha: 'ladle', conchas: 'ladle', escumadeira: 'skimmer', escumadeiras: 'skimmer',
  filé: 'fillet', filés: 'fillet', file: 'fillet', files: 'fillet', bife: 'fillet', bifes: 'fillet', peito: 'breast', peitos: 'breast',
  grande: 'large', grandes: 'large', médio: 'medium', média: 'medium', médios: 'medium', médias: 'medium',
  medio: 'medium', media: 'medium', medios: 'medium', medias: 'medium',
  pequeno: 'small', pequena: 'small', pequenos: 'small', pequenas: 'small',
};

/** Two-word Brazilian household measures → a single unit token. */
const PT_MEASURES: [string, string][] = [
  ['colher(?:es)? de sopa', 'tbsp'],
  ['colher(?:es)? de (?:chá|cha)', 'tsp'],
  ['colher(?:es)? de sobremesa', 'dsp'],
  ['colher(?:es)? de (?:arroz|servir)', 'servingspoon'],
  ['x[íi]caras? de (?:chá|cha)', 'cup'],
  ['copos? americanos?', 'glass'],
  ['pratos? fundos?', 'bowl'],
];
const PT_MEASURE_ANY = W(PT_MEASURES.map(([re]) => re).join('|'), 'g');
/** "colheres_de_sopa" (joined so the words survive in \`raw\`) → "tbsp" */
function unitOf(token: string | undefined): string | undefined {
  if (!token) return undefined;
  if (token in UNITS) return UNITS[token];
  if (!token.includes('_')) return undefined;
  const words = token.replace(/_/g, ' ');
  return PT_MEASURES.find(([re]) => new RegExp(`^(?:${re})$`).test(words))?.[1];
}

/** Words that are both a measure and part of the name: "2 chicken breasts", "um filé de frango". */
const NOUN_WORDS: Record<string, string> = { filé: 'filé', filés: 'filé', file: 'filé', files: 'filé', bife: 'bife', bifes: 'bife', peito: 'peito', peitos: 'peito' };
const OF = new Set(['of', 'de', 'do', 'da', 'dos', 'das']);

/** Units that are describing the food rather than a measure, e.g. "two chicken breasts". */
const NOUN_UNITS = new Set(['breast', 'fillet']);

const MEAL_PATTERNS: [RegExp, Meal][] = [
  [/\b(after|post)[\s-]*(my |the )?(workout|training|gym|session|lifting)\b/, 'post-workout'],
  [/\b(before|pre)[\s-]*(my |the )?(workout|training|gym|session|lifting)\b/, 'pre-workout'],
  [/\b(breakfast|brekkie|brunch|this morning)\b/, 'breakfast'],
  [/\b(lunch|lunchtime|midday)\b/, 'lunch'],
  [/\b(dinner|supper|tonight|this evening)\b/, 'dinner'],
  [/\b(snack|snacks|snacking)\b/, 'snack'],
  [W('p[óo]s[ -]?treino|depois do treino|ap[óo]s o treino|depois da academia'), 'post-workout'],
  [W('pr[ée][ -]?treino|antes do treino|antes da academia'), 'pre-workout'],
  [W('caf[ée] da manh[ãa]|desjejum|de manh[ãa]|hoje cedo'), 'breakfast'],
  [W('almo[çc]o|almocei|almo[çc]ar'), 'lunch'],
  [W('jantar|janta|jantei|hoje [àa] noite'), 'dinner'],
  [W('lanche|lanches|lanchei|lanchinho|ceia|lanche da tarde'), 'snack'],
];

const FILLER_EN = [
  /\b(for|at|during|as|my|the)\s+(breakfast|brekkie|brunch|lunch|lunchtime|dinner|supper|snack|snacks)\b/g,
  /\b(after|before|post|pre)[\s-]*(my |the )?(workout|training|gym|session|lifting)\b/g,
  /\b(this morning|this evening|tonight|today|yesterday|just now|earlier)\b/g,
  /\b(i|we)\s*('ve|'m|'d| have| am| had| just)?\s*(just\s+)?(had|have|ate|eaten|eat|drank|drunk|drink|having|eating|drinking|grabbed|got)\b/g,
  /\b(please\s+)?(log|add|record|track)\b/g,
  /\b(about|around|approximately|roughly|like|maybe|some|so|also|then)\b/g,
];
/** English hesitations — "um" is the number one in Portuguese, so only for English. */
const EN_HESITATION = /\b(um+|uh+|erm+)\b/g;

const FILLER_PT = [
  W('(?:no|na|pro|para o|de|do|nos|meu|minha)?\\s*(?:caf[ée] da manh[ãa]|lanche da tarde|almo[çc]o|jantar|janta|lanche|ceia|desjejum)', 'g'),
  W('p[óo]s[ -]?treino|pr[ée][ -]?treino|(?:depois|antes) do treino|ap[óo]s o treino|(?:depois|antes) da academia', 'g'),
  W('hoje de manh[ãa]|de manh[ãa]|hoje cedo|mais cedo|[àa] tarde|[àa] noite|hoje|ontem|agora há pouco|agora', 'g'),
  W('(?:eu |n[óo]s |a gente )?(?:acabei de |acabamos de )?(?:comi|comemos|comer|como|tomei|tomamos|tomar|tomo|bebi|bebemos|beber|bebo|almocei|jantei|lanchei|peguei|ingeri|consumi)', 'g'),
  W('(?:por favor )?(?:registr[ae]r?|adicion[ae]r?|anot[ae]r?|coloc[ae]r?)', 'g'),
  W('cerca de|mais ou menos|aproximadamente|uns|umas|tipo|s[óo]|tamb[ée]m|a[íi]|n[ée]|ent[ãa]o|hum+|por favor', 'g'),
];

const SPLIT_EN = /\s*(?:,|;|\band then\b|\bthen\b|\bplus\b|\bwith\b|\band\b|&|\balong with\b)\s*/;
const SPLIT_PT = new RegExp(`\\s*(?:,|;|&|(?<![${L}])(?:e depois|depois|junto com|e|com|mais|and then|then|plus|with|and)(?![${L}]))\\s*`);

const HALF = 'and_a_half';
/** "and a half" / "e meia" / "e meio" — kept as one token (underscores) so the said words survive in `raw`. */
const isHalf = (t: string | undefined) => t === HALF || t === 'e_meia' || t === 'e_meio';

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
    if (isHalf(tokens[next])) {
      value += 0.5;
      next++;
    }
    return { value, next };
  }

  // "a"/"an": "a couple of", "a few", "a dozen", "a half", "a hundred", or just 1
  let j = i;
  let cur = 0;
  let any = false;
  if (t === 'a' || t === 'an' || t === 'um' || t === 'uma') {
    const n = tokens[i + 1];
    if (n && ['couple', 'pair', 'few', 'dozen', 'half', 'hundred', 'dúzia', 'duzia', 'par'].includes(n)) {
      j = i + 1;
    } else {
      return { value: 1, next: i + 1 };
    }
  }
  while (j < tokens.length) {
    const w = tokens[j];
    if (w === 'hundred') cur = (cur || 1) * 100;
    else if (any && /^(dozen|d[úu]zias?)$/.test(w)) cur *= 12; // "meia dúzia" = 6, "duas dúzias" = 24
    else if (isHalf(w) && any) cur += 0.5;
    else if (w in NUMBER_WORDS && w !== 'a' && w !== 'an' && !(any && (w === 'um' || w === 'uma'))) cur += NUMBER_WORDS[w];
    else break;
    any = true;
    j++;
  }
  if (!any) return null;
  if (OF.has(tokens[j])) j++; // "a couple of", "half of", "meia dúzia de"
  return { value: cur, next: j };
}

function detectMeal(text: string): Meal | undefined {
  for (const [re, meal] of MEAL_PATTERNS) if (re.test(text)) return meal;
  return undefined;
}

const PT_TIME = W('(?:[àa]s |a )?(\\d{1,2})(?:h(\\d{2})?|:(\\d{2}))(?:min)?');

function detectTime(text: string): string | undefined {
  const m = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/);
  if (!m) {
    // 24-hour clock: "às 8h", "8h30", "20:15"
    const p = text.match(PT_TIME);
    const h = p ? parseInt(p[1], 10) : NaN;
    const min = p ? p[2] ?? p[3] ?? '00' : '';
    return h >= 0 && h < 24 && +min < 60 ? `${String(h).padStart(2, '0')}:${min}` : undefined;
  }
  let h = parseInt(m[1], 10) % 12;
  if (m[3].startsWith('p')) h += 12;
  return `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`;
}

function parseSegment(seg: string): ParsedItem | null {
  const raw = seg.trim().replace(/_/g, ' ');
  // split glued quantities: "200g" → "200 g", "1.5kg" → "1.5 kg"
  const tokens = seg.trim()
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
  let noun: string | undefined;
  if (unitOf(maybeUnit) && i < tokens.length - 1) {
    unit = unitOf(maybeUnit);
    noun = NOUN_WORDS[maybeUnit];
    i++;
    if (OF.has(tokens[i])) i++;
  } else if (maybeUnit && NOUN_WORDS[maybeUnit] && i === tokens.length - 1) {
    // "um bife" on its own: the noun is the food
    unit = UNITS[maybeUnit];
  }
  // "a cup and a half of rice"
  if (unit && isHalf(tokens[i])) {
    quantity += 0.5;
    i++;
    if (OF.has(tokens[i])) i++;
  }
  if (!unit && tokens[i] === 'a' && tokens[i + 1] in UNITS) {
    // "half a cup of rice"
    unit = UNITS[tokens[i + 1]];
    i += 2;
    if (OF.has(tokens[i])) i++;
  }

  let foodTokens = tokens.slice(i);
  // size words can also come right before the food after the unit: "two large eggs"
  if (!unit && foodTokens.length > 1 && UNITS[foodTokens[0]] && ['large', 'medium', 'small'].includes(UNITS[foodTokens[0]])) {
    unit = UNITS[foodTokens[0]];
    foodTokens = foodTokens.slice(1);
  }
  // keep noun-like units as part of the food name, e.g. "2 chicken breasts"
  if (noun) {
    foodTokens = [noun, 'de', ...foodTokens]; // "filé de frango"
  } else if (unit && NOUN_UNITS.has(unit) && !NOUN_WORDS[maybeUnit ?? '']) {
    foodTokens = [...foodTokens, unit];
  }
  // Portuguese puts sizes after the food: "duas bananas médias"
  if (!unit && foodTokens.length > 1) {
    const last = UNITS[foodTokens[foodTokens.length - 1]];
    if (last === 'large' || last === 'medium' || last === 'small') {
      unit = last;
      foodTokens = foodTokens.slice(0, -1);
    }
  }
  const food = foodTokens.join(' ').replace(/^(of|a|an|the|de|do|da|o|os|as)\s+/, '').trim();
  if (!food) return null;
  return { raw, quantity, unit, food, explicitQty };
}

export function parseUtterance(input: string, lang: Locale = LOCALE): ParsedUtterance {
  const pt = lang === 'pt';
  // "1,5 kg" is 1.5 kg in Portuguese
  let text = ' ' + input.toLowerCase().replace(/(\d),(\d{1,2})(?!\d)/g, pt ? '$1.$2' : '$&').replace(/[!?]|[.:](?!\d)/g, ' ').replace(/\s+/g, ' ') + ' ';
  const meal = detectMeal(text);
  const time = detectTime(text);
  text = text.replace(/\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(am|pm|a\.m\.|p\.m\.)\b/g, ' ').replace(new RegExp(PT_TIME.source, 'g'), ' ');
  text = text.replace(PT_MEASURE_ANY, (m) => m.replace(/ /g, '_'));
  if (pt) {
    // "duzentos e cinquenta" is one number, not two items; "e meio/e meia" is "and a half"
    text = text.replace(W('e mei[ao]', 'g'), (m) => ` ${m.replace(' ', '_')} `);
    const num = `(?:${PT_NUMBER.join('|')})`;
    text = text.replace(new RegExp(`(?<![${L}])(${num}) e (?=${num}(?![${L}]))`, 'g'), '$1 ');
  }
  for (const re of pt ? [...FILLER_PT, ...FILLER_EN] : [...FILLER_EN, EN_HESITATION]) text = text.replace(re, ' ');
  text = text
    .replace(/\band a half\b/g, ` ${HALF} `)
    .replace(/\bhundred and\b/g, 'hundred')
    .replace(/\bfor\s*$/, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const items: ParsedItem[] = [];
  for (const seg of text.split(pt ? SPLIT_PT : SPLIT_EN)) {
    const s = seg.trim().replace(/^(and|with|for|of|e|com|de|mais)\s+/, '');
    if (!s) continue;
    const item = parseSegment(s);
    if (item) items.push(item);
  }
  return { meal, time, items };
}

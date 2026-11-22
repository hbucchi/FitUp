import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { fromRaw } from '../data/catalog';
import { buildIndex, search } from '../data/search';
import type { Locale } from '../i18n';

/**
 * Retrieval check for the assistant: each case is what the agent sends to search_foods for one
 * item (the user's words + database-style names) and the record that must come out on top.
 */
const usda = JSON.parse(readFileSync(new URL('../../public/data/usda-foods.json', import.meta.url), 'utf8'));
const taco = JSON.parse(readFileSync(new URL('../../public/data/taco-foods.json', import.meta.url), 'utf8'));
const index = buildIndex([...usda.foods, ...taco.foods].map(fromRaw));

function top(queries: string[], lang: Locale) {
  const best = new Map<string, { name: string; score: number }>();
  for (const q of queries) for (const h of search(index, q, { limit: 10, lang })) {
    const p = best.get(h.food.id);
    if (!p || h.score > p.score) best.set(h.food.id, { name: h.food.name, score: h.score });
  }
  return [...best.values()].sort((a, b) => b.score - a.score)[0]?.name ?? '(nothing)';
}

const EN: [string[], RegExp][] = [
  [['scrambled eggs', 'egg scrambled'], /^Egg, whole, cooked, scrambled/],
  [['grilled chicken breast', 'chicken breast grilled'], /^Chicken, broiler or fryers, breast, .*grilled/],
  [['white rice', 'rice white cooked'], /^Rice, white, .*cooked/],
  [['brown rice', 'rice brown cooked'], /^Rice, brown, .*cooked/],
  [['black beans', 'beans black cooked'], /^Beans, black, mature seeds, cooked/],
  [['baked salmon', 'salmon cooked'], /^Fish, salmon, Atlantic, .*cooked/],
  [['steak', 'beef steak cooked'], /^Beef, .*steak.*cooked/],
  [['ground beef', 'beef ground cooked'], /^Beef, ground, .*cooked/],
  [['banana', 'bananas raw'], /^Bananas, raw$/],
  [['apple', 'apples raw'], /^Apples, raw, with skin/],
  [['oatmeal', 'oats cooked'], /^Cereals, oats, .*cooked/],
  [['whey protein', 'whey protein powder'], /^Beverages, Whey protein powder isolate/],
  [['olive oil', 'oil olive'], /^Oil, olive/],
  [['greek yogurt', 'yogurt greek plain'], /^Yogurt, Greek, plain/],
  [['whole milk', 'milk whole'], /^Milk, whole/],
  [['peanut butter'], /^Peanut butter, smooth style/],
  [['sweet potato', 'sweet potato baked'], /^Sweet potato, cooked/],
  [['pasta', 'pasta cooked'], /^Pasta, cooked/],
  [['avocado', 'avocados raw'], /^Avocados, raw/],
  [['coffee', 'coffee brewed'], /^Beverages, coffee, brewed/],
];

const PT: [string[], RegExp][] = [
  [['feijão', 'feijão carioca cozido'], /^Feijão, carioca, cozido/],
  [['feijão preto', 'feijão preto cozido'], /^Feijão, preto, cozido/],
  [['arroz branco', 'arroz tipo 1 cozido'], /^Arroz, tipo 1, cozido/],
  [['arroz integral', 'arroz integral cozido'], /^Arroz, integral, cozido/],
  [['frango grelhado', 'frango peito grelhado'], /^Frango, peito, sem pele, grelhado/],
  [['carne moída', 'carne bovina moída cozida'], /^Carne, bovina, acém, moído, cozido/],
  [['picanha', 'picanha grelhada'], /^Carne, bovina, picanha, .*grelhada/],
  [['ovo cozido', 'ovo de galinha cozido'], /^Ovo, de galinha, inteiro, cozido/],
  [['ovo mexido', 'egg scrambled'], /^Egg, whole, cooked, scrambled/],
  [['pão francês'], /^Pão, trigo, francês/],
  [['pão de queijo'], /^Pão, de queijo, assado/],
  [['tapioca'], /^Tapioca/],
  [['cuscuz', 'cuscuz de milho'], /^Cuscuz, de milho/],
  [['açaí', 'açaí polpa'], /^Açaí, polpa/],
  [['farofa'], /^Mandioca, farofa/],
  [['batata doce', 'batata doce cozida'], /^Batata, doce, cozida/],
  [['mandioca', 'mandioca cozida'], /^Mandioca, cozida/],
  [['banana prata'], /^Banana, prata/],
  [['queijo minas'], /^Queijo, minas/],
  [['leite integral', 'milk whole'], /^Milk, whole/],
  [['macarrão', 'macarrão cozido', 'pasta cooked'], /^Pasta, cooked/],
  [['moqueca de peixe'], /^Moqueca de peixe/],
  [['suco de laranja', 'laranja suco'], /^Laranja, .*suco/],
  [['castanha do pará', 'castanha-do-brasil'], /^Castanha-do-Brasil/],
  [['tomate', 'tomate cru'], /^Tomate, com semente, cru/],
  [['café', 'café infusão'], /^Café, infusão/],
];

describe('assistant retrieval: the right database record comes first', () => {
  test.each(EN)('en %j', (q, want) => expect(top(q, 'en')).toMatch(want));
  test.each(PT)('pt %j', (q, want) => expect(top(q, 'pt')).toMatch(want));
});

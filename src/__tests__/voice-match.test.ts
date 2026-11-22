import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { fromRaw } from '../data/catalog';
import { buildIndex, search } from '../data/search';
import { matchTranscript } from '../voice/matcher';

const raw = JSON.parse(readFileSync(new URL('../../public/data/usda-foods.json', import.meta.url), 'utf8'));
const index = buildIndex(raw.foods.map(fromRaw));

describe('voice → catalog', () => {
  test('breakfast', () => {
    const r = matchTranscript('for breakfast I had two scrambled eggs, a slice of toast and a banana', index);
    expect(r.meal).toBe('breakfast');
    const [eggs, toast, banana] = r.items;
    expect(eggs.food?.name).toMatch(/^Egg, whole, cooked, scrambled/);
    expect(toast.food?.name).toMatch(/^Bread, .*toasted/);
    expect(toast.amount?.unit).toMatch(/slice/);
    expect(banana.food?.name).toBe('Bananas, raw');
    expect(banana.amount?.grams).toBeGreaterThan(80);
    expect(banana.amount?.grams).toBeLessThan(160);
  });
  test('weights', () => {
    const r = matchTranscript('200 grams of chicken breast and a cup of white rice', index);
    expect(r.items[0].food?.name).toMatch(/^Chicken, broilers? or fryers, breast/);
    expect(r.items[0].amount?.grams).toBe(200);
    expect(r.items[1].food?.name).toMatch(/^Rice, white/);
    expect(r.items[1].amount?.unit).toMatch(/^cup/);
  });
});

describe('portion resolution', () => {
  test('"large eggs" uses the per-egg portion, not "cup (4.86 large eggs)"', () => {
    const r = matchTranscript('two large eggs', index);
    expect(r.items[0].amount?.unit).toBe('large');
    expect(r.items[0].amount?.grams).toBeGreaterThan(90);
    expect(r.items[0].amount?.grams).toBeLessThan(115);
  });
  test('tablespoon of olive oil', () => {
    const r = matchTranscript('a tablespoon of olive oil', index);
    expect(r.items[0].food?.name).toMatch(/^Oil, olive/);
    expect(Math.abs(r.items[0].amount!.grams - 13.6)).toBeLessThan(0.6); // oil density, not water
  });
});

test('a banana defaults to a medium one', () => {
  const r = matchTranscript('a banana', index);
  expect(r.items[0].amount?.unit).toMatch(/^medium/);
});

describe('voz → catálogo (pt-BR, USDA + TACO)', () => {
  const taco = JSON.parse(readFileSync(new URL('../../public/data/taco-foods.json', import.meta.url), 'utf8'));
  const both = buildIndex([...raw.foods, ...taco.foods].map(fromRaw));
  const pt = (s: string) => matchTranscript(s, both, { lang: 'pt' });

  test('almoço brasileiro com medidas caseiras', () => {
    const r = pt('No almoço comi duas conchas de feijão carioca, quatro colheres de sopa de arroz e um bife');
    expect(r.meal).toBe('lunch');
    const [feijao, arroz, bife] = r.items;
    expect(feijao.food?.name).toMatch(/^Feijão, carioca, cozido/);
    expect(feijao.amount).toMatchObject({ unit: 'concha', quantity: 2, grams: 280 });
    expect(arroz.food?.source).toBe('TACO');
    expect(arroz.food?.name).toMatch(/^Arroz/);
    expect(arroz.amount?.unit).toBe('colher de sopa');
    expect(bife.food?.source).toBe('TACO');
  });

  test('ovos, pão e números por extenso', () => {
    const r = pt('café da manhã: dois ovos cozidos, um pão francês e duzentos e cinquenta ml de leite integral');
    expect(r.meal).toBe('breakfast');
    const [ovos, pao, leite] = r.items;
    expect(ovos.food?.name).toMatch(/^Ovo, de galinha, inteiro, cozido/);
    expect(ovos.amount).toMatchObject({ unit: 'unidade', quantity: 2 });
    expect(pao.food?.name).toMatch(/^Pão, trigo, francês/);
    expect(pao.amount?.grams).toBe(50);
    expect(leite.parsed.quantity).toBe(250);
    // TACO only has powdered whole milk ("pó"), so fluid milk comes from USDA
    expect(leite.food?.name).toMatch(/^Milk, whole/);
    expect(leite.amount?.grams).toBeGreaterThan(240);
  });

  test('busca: o que se come, não o cru', () => {
    const top = (q: string) => search(both, q, { limit: 1, lang: 'pt' })[0]?.food.name;
    expect(top('feijão')).toMatch(/^Feijão, (preto|carioca), cozido/);
    expect(top('arroz')).toMatch(/^Arroz, .*cozido/);
    expect(top('pão de queijo')).toBe('Pão, de queijo, assado');
    expect(top('banana')).toMatch(/^Banana, (prata|nanica), crua/);
    expect(top('leite')).toMatch(/^Milk, whole/); // TACO has no fluid milk values
    expect(search(both, 'scrambled eggs', { limit: 1, lang: 'en' })[0].food.name).toMatch(/^Egg, whole, cooked, scrambled/);
  });

  test('moqueca de peixe', () => {
    const r = pt('jantei uma concha de moqueca de peixe');
    expect(r.meal).toBe('dinner');
    expect(r.items[0].food?.name).toMatch(/^Moqueca de peixe/);
    expect(r.items[0].amount).toMatchObject({ unit: 'concha', grams: 150 });
  });
});

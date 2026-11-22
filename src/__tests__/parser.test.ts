import { describe, expect, test } from 'vitest';
import { parseUtterance, wordsToNumber } from '../voice/parser';

const items = (s: string) => parseUtterance(s).items.map((i) => [i.quantity, i.unit ?? null, i.food]);

describe('wordsToNumber', () => {
  test.each([
    ['two', 2], ['twenty five', 25], ['two hundred fifty', 250], ['a couple of', 2],
    ['half', 0.5], ['a dozen', 12], ['1.5', 1.5], ['1/2', 0.5], ['1 1/2', 1.5], ['an', 1],
  ])('%s → %d', (s, n) => expect(wordsToNumber(s.split(' '), 0)?.value).toBe(n));
});

describe('parseUtterance', () => {
  test('meal + multiple items', () => {
    const r = parseUtterance('For breakfast I had two scrambled eggs, a slice of toast and 200g of greek yogurt');
    expect(r.meal).toBe('breakfast');
    expect(items('For breakfast I had two scrambled eggs, a slice of toast and 200g of greek yogurt')).toEqual([
      [2, null, 'scrambled eggs'], [1, 'slice', 'toast'], [200, 'g', 'greek yogurt'],
    ]);
  });
  test('size words and fractions', () => {
    expect(items('I ate two large eggs and half a cup of oatmeal')).toEqual([[2, 'large', 'eggs'], [0.5, 'cup', 'oatmeal']]);
  });
  test('and a half / hundred and', () => {
    expect(items('one and a half cups of rice')).toEqual([[1.5, 'cup', 'rice']]);
    expect(items('two hundred and fifty grams of chicken breast')).toEqual([[250, 'g', 'chicken breast']]);
    expect(items('a cup and a half of milk')).toEqual([[1.5, 'cup', 'milk']]);
  });
  test('workout meals and time', () => {
    const r = parseUtterance('after my workout I drank a scoop of whey protein with 300 ml of milk at 6 pm');
    expect(r.meal).toBe('post-workout');
    expect(r.time).toBe('18:00');
    expect(r.items.map((i) => [i.quantity, i.unit, i.food])).toEqual([[1, 'scoop', 'whey protein'], [300, 'ml', 'milk']]);
  });
  test('decimals survive punctuation stripping', () => {
    expect(items('1.5 kg of potatoes.')).toEqual([[1.5, 'kg', 'potatoes']]);
  });
  test('noun units stay part of the food', () => {
    expect(items('2 chicken breasts')).toEqual([[2, null, 'chicken breasts']]);
    expect(items('a banana')).toEqual([[1, null, 'banana']]);
  });
});

describe('português (pt-BR)', () => {
  const pt = (s: string) => parseUtterance(s, 'pt');
  const ptItems = (s: string) => pt(s).items.map((i) => [i.quantity, i.unit ?? null, i.food]);

  test('refeição, medidas caseiras e "e" separando itens', () => {
    const r = pt('No almoço comi duas conchas de feijão, 150 g de arroz e um bife');
    expect(r.meal).toBe('lunch');
    expect(ptItems('No almoço comi duas conchas de feijão, 150 g de arroz e um bife')).toEqual([
      [2, 'ladle', 'feijão'], [150, 'g', 'arroz'], [1, 'fillet', 'bife'],
    ]);
  });
  test('números por extenso, "e meia" e dúzias', () => {
    expect(ptItems('duzentos e cinquenta gramas de frango grelhado e uma xícara e meia de arroz')).toEqual([
      [250, 'g', 'frango grelhado'], [1.5, 'cup', 'arroz'],
    ]);
    expect(ptItems('meia dúzia de ovos e duas bananas médias')).toEqual([[6, null, 'ovos'], [2, 'medium', 'bananas']]);
  });
  test('colher de sopa / de chá, vírgula decimal e as palavras originais em raw', () => {
    const r = pt('jantei quatro colheres de sopa de farofa, uma colher de chá de azeite e 1,5 xícara de açaí');
    expect(r.meal).toBe('dinner');
    expect(r.items.map((i) => [i.quantity, i.unit, i.food])).toEqual([[4, 'tbsp', 'farofa'], [1, 'tsp', 'azeite'], [1.5, 'cup', 'açaí']]);
    expect(r.items[0].raw).toBe('quatro colheres de sopa de farofa');
  });
  test('pós-treino e horário 24 h', () => {
    const r = pt('pós-treino tomei uma dose de whey com 300 ml de leite às 18h30');
    expect(r).toMatchObject({ meal: 'post-workout', time: '18:30' });
    expect(r.items.map((i) => [i.quantity, i.unit, i.food])).toEqual([[1, 'scoop', 'whey'], [300, 'ml', 'leite']]);
  });
  test('"um" is a number in Portuguese, a hesitation in English; "vitamin e" stays whole', () => {
    expect(ptItems('um pão francês')).toEqual([[1, null, 'pão francês']]);
    expect(parseUtterance('um, I had two eggs and vitamin e', 'en').items.map((i) => i.food)).toEqual(['eggs', 'vitamin e']);
  });
});


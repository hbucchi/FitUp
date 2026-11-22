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

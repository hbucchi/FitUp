import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { fromRaw } from '../data/catalog';
import { buildIndex } from '../data/search';
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

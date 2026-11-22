import { expect, test } from 'vitest';
import { bodyMetrics, dailyTargets, exerciseKcal, idealGap } from '../domain/metrics';
import type { Profile } from '../domain/types';

const p: Profile = { name: 'T', sex: 'male', birthYear: 1995, heightCm: 180, weightKg: 80, bodyFatPct: 20, activity: 'moderate', goal: 'recomp', createdAt: '' };

test('body metrics', () => {
  const m = bodyMetrics(p);
  expect(m.leanMassKg).toBe(64);
  expect(m.ffmi).toBeCloseTo(19.75, 2);
  expect(m.ffmiNormalized).toBeCloseTo(19.75, 2); // at 1.80 m no correction
  expect(m.bmr).toBeCloseTo(370 + 21.6 * 64);
  expect(m.tdee).toBeCloseTo(m.bmr * 1.55);
});

test('targets add up', () => {
  const t = dailyTargets(p);
  expect(t.protein).toBe(141);
  expect(Math.abs(t.protein * 4 + t.fat * 9 + t.carbs * 4 - t.kcal)).toBeLessThan(10);
});

test('ideal gap', () => {
  const g = idealGap(p);
  expect(g.targetLeanKg).toBeCloseTo(22.5 * 1.8 * 1.8, 1);
  expect(g.leanToGainKg).toBeCloseTo(72.9 - 64, 1);
  expect(g.progress).toBeGreaterThan(0.5);
  expect(g.progress).toBeLessThan(1);
});

test('MET kcal', () => expect(exerciseKcal(9.8, 80, 30)).toBe(392));

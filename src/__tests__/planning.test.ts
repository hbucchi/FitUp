import { describe, expect, test } from 'vitest';
import type { BodyLog, FoodEntry, PlannedSession, Profile } from '../domain/types';
import { planWeek, applyChanges } from '../domain/reschedule';
import { buildNutritionPlan, reviewNutrition } from '../domain/nutritionPlan';
import { ascent, snapshot, defaultTarget, estimateTimeline, recommendPhase } from '../domain/objective';
import { addDays } from '../domain/programs';

const p: Profile = { name: 'T', sex: 'male', birthYear: 1995, heightCm: 180, weightKg: 80, bodyFatPct: 20, activity: 'moderate', goal: 'recomp', createdAt: '' };

const sess = (id: string, date: string, order: number, status: PlannedSession['status'] = 'planned'): PlannedSession => ({
  id, planId: 'p', date, week: 1, order, phase: 'accumulation', focus: 'Heavy', title: id, exercises: [], status,
});

describe('rescheduling', () => {
  // week of Mon 2026-11-23 … Sun 2026-11-29; training Mon/Tue/Thu/Fri
  const days = [1, 2, 4, 5];
  test('nothing missed → no changes', () => {
    const s = [sess('UA', '2026-11-23', 0, 'done'), sess('LA', '2026-11-24', 1), sess('UB', '2026-11-26', 2)];
    expect(planWeek(s, '2026-11-24', days)).toEqual([]);
  });
  const week = () => [sess('UA', '2026-11-23', 0, 'done'), sess('LA', '2026-11-24', 1), sess('UB', '2026-11-26', 2), sess('LB', '2026-11-27', 3)];
  test('missed Tuesday, opened Wednesday → do it today, rest of the week unchanged', () => {
    const after = applyChanges(week(), planWeek(week(), '2026-11-25', days));
    expect(after.map((x) => [x.id, x.date])).toEqual([
      ['UA', '2026-11-23'], ['LA', '2026-11-25'], ['UB', '2026-11-26'], ['LB', '2026-11-27'],
    ]);
  });
  test('missed Tuesday, opened Thursday → order kept, and no three lifting days in a row', () => {
    const after = applyChanges(week(), planWeek(week(), '2026-11-26', days));
    expect(after.map((x) => [x.id, x.date])).toEqual([
      ['UA', '2026-11-23'], ['LA', '2026-11-26'], ['UB', '2026-11-27'], ['LB', '2026-11-29'], // Sun, not Sat
    ]);
  });
  test('too many sessions for the days left → extras skipped', () => {
    const s = [sess('UA', '2026-11-23', 0), sess('LA', '2026-11-24', 1), sess('UB', '2026-11-26', 2), sess('LB', '2026-11-27', 3)];
    const after = applyChanges(s, planWeek(s, '2026-11-28', days));
    expect(after.filter((x) => x.status === 'skipped').length).toBe(2);
    expect(after.filter((x) => x.status === 'planned').map((x) => x.date)).toEqual(['2026-11-28', '2026-11-29']);
  });
  test('misses from previous weeks are closed, not chased', () => {
    const s = [sess('old', '2026-11-19', 0), sess('UA', '2026-11-23', 1)];
    const c = planWeek(s, '2026-11-23', days);
    expect(c).toHaveLength(1);
    expect(c[0].sessionId).toBe('old');
    expect(c[0].to).toBeUndefined();
  });
});

describe('nutrition plan', () => {
  test('targets follow the evidence-based ranges', () => {
    const cut = buildNutritionPlan(p, { phase: 'cut', trainingDaysPerWeek: 4 });
    const lbm = 64;
    expect(cut.training.protein / lbm).toBeGreaterThanOrEqual(2.3);
    expect(cut.training.protein / lbm).toBeLessThanOrEqual(3.1);
    expect(cut.training.fat).toBeGreaterThanOrEqual(0.6 * p.weightKg);
    const build = buildNutritionPlan(p, { phase: 'build', trainingDaysPerWeek: 4, experience: 'intermediate' });
    expect(build.training.protein / p.weightKg).toBeGreaterThanOrEqual(1.6);
    // weekly average equals the phase target despite training/rest split
    const avg = (pl: typeof cut) => (pl.training.kcal * 4 + pl.rest.kcal * 3) / 7;
    expect(avg(build)).toBeGreaterThan(avg(cut) + 500);
    expect(build.training.kcal).toBeGreaterThan(build.rest.kcal);
    expect(build.training.carbs).toBeGreaterThan(build.rest.carbs);
  });

  const plan = buildNutritionPlan(p, { phase: 'cut', trainingDaysPerWeek: 4 }); // target −0.5 %/wk at 20 % BF
  const today = '2026-12-10';
  const food = (kcal: number): FoodEntry[] =>
    Array.from({ length: 10 }, (_, i) => ({
      id: `${i}`, date: addDays(today, -10 + i), meal: 'lunch', foodId: 'x', foodName: 'x', quantity: 1, unit: 'g', grams: 1,
      nutrients: { kcal, protein: plan.training.protein },
    }));
  const weights = (perWeek: number): BodyLog[] =>
    Array.from({ length: 5 }, (_, i) => ({ date: addDays(today, -12 + i * 3), weightKg: 80 + (perWeek / 7) * i * 3 }));
  const run = (kcal: number, perWeek: number) =>
    reviewNutrition({ plan, profile: p, foodEntries: food(kcal), bodyLog: weights(perWeek), today, isTrainingDay: () => false });

  test('on track → unchanged', () => {
    const r = run(plan.rest.kcal, -0.4); // −0.5 %/wk of 80 kg
    expect(r.changed).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/on track/);
  });
  test('stalled with good adherence → lower calories, damped and capped', () => {
    const r = run(plan.rest.kcal, 0);
    expect(r.changed).toBe(true);
    expect(r.plan.rest.kcal).toBeLessThan(plan.rest.kcal);
    expect(plan.rest.kcal - r.plan.rest.kcal).toBeLessThanOrEqual(200);
    expect(r.plan.rest.protein).toBe(plan.rest.protein);
  });
  test('stalled but eating 25 % over target → fix adherence, not the plan', () => {
    const r = run(plan.rest.kcal * 1.25, 0);
    expect(r.changed).toBe(false);
    expect(r.reasons.join(' ')).toMatch(/hit the current targets/);
  });
  test('losing too fast → calories go up even with imperfect adherence', () => {
    const r = run(plan.rest.kcal * 0.8, -1.4);
    expect(r.changed).toBe(true);
    expect(r.plan.rest.kcal).toBeGreaterThan(plan.rest.kcal);
  });
  test('not enough logging → unchanged', () => {
    const r = reviewNutrition({ plan, profile: p, foodEntries: food(2000).slice(0, 3), bodyLog: weights(0), today, isTrainingDay: () => false });
    expect(r.changed).toBe(false);
  });
});

describe('ascent', () => {
  const objective = { createdAt: '', experience: 'novice' as const, start: snapshot(p, '2026-01-01'), target: defaultTarget(p), levelSeen: 0 };
  test('0 % at the start, 100 % at the target', () => {
    expect(ascent(objective, p).progress).toBe(0);
    const t = objective.target;
    expect(ascent(objective, { weightKg: t.weightKg, bodyFatPct: t.bodyFatPct }).progress).toBeCloseTo(1, 2);
  });
  test('progress counts kilograms of composition change toward the target', () => {
    const a0 = ascent(objective, p);
    // lose 5 kg of pure fat
    const a1 = ascent(objective, { weightKg: 75, bodyFatPct: ((16 - 5) / 75) * 100 });
    expect(a1.lostFatKg).toBeCloseTo(5, 1);
    expect(a1.progress).toBeCloseTo(5 / (a0.needFatKg + a0.needLeanKg), 2);
  });
  test('phase + timeline', () => {
    expect(recommendPhase('male', 20, { bodyFatPct: 11 }, 8)).toBe('cut');
    expect(recommendPhase('male', 14, { bodyFatPct: 11 }, 8)).toBe('build');
    const t = estimateTimeline(p, objective);
    expect(t.cutWeeks).toBeGreaterThan(5);
    expect(t.buildWeeks).toBeGreaterThan(20);
  });
});

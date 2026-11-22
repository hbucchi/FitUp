import { describe, expect, test } from 'vitest';
import type { TrainingEntry } from '../domain/types';
import { PROGRAMS, generatePlan, weekOptions } from '../domain/programs';
import { chooseByRules, recoverySignals, targetWeek, trainingSignals } from '../domain/weekly';
import { estimateActivity } from '../domain/energy';
import { SEED_EXERCISES } from '../domain/exercises';

const p = PROGRAMS.find((x) => x.id === 'upper-lower')!;
const { plan, sessions } = generatePlan(p, { weeks: 8, startDate: '2026-11-23', trainingDays: [1, 2, 4, 5], id: 'p' });
const opts = weekOptions(p, plan, 3);
const sig = (o: Partial<ReturnType<typeof trainingSignals>>) => ({ due: 8, done: 8, adherence: 1, improved: 0, declined: 0, trends: [], weeksSinceLighter: 2, recovery: { checkIns: 0, poor: false }, ...o });

describe('choosing next week by rules', () => {
  test.each([
    [{ adherence: 0.4, done: 3 }, 'condensed'],
    [{ adherence: 0.6 }, 'repeat'],
    [{ declined: 3, improved: 1 }, 'lighter'],
    [{ weeksSinceLighter: 6 }, 'lighter'],
    [{ improved: 3 }, 'standard'],
  ])('%o → %s', (s, expected) => {
    expect(chooseByRules(opts, sig(s)).option.id).toBe(expected);
  });
  test('poor recovery from check-ins → lighter week, and no skipping a scheduled one', () => {
    const tired = recoverySignals(
      ['2026-11-25', '2026-11-26', '2026-11-27'].map((date) => ({ date, sleepHours: 5.5, energy: 2 })),
      '2026-11-28',
    );
    expect(tired.poor).toBe(true);
    const r = chooseByRules(opts, sig({ recovery: tired, improved: 3 }));
    expect(r.option.id).toBe('lighter');
    expect(r.reason).toMatch(/5\.5 h/);
    expect(chooseByRules(weekOptions(p, plan, 4), sig({ recovery: tired, improved: 3 })).option.id).toBe('standard');
    // two check-ins aren't enough to act on
    expect(recoverySignals([{ date: '2026-11-27', sleepHours: 4 }, { date: '2026-11-28', sleepHours: 4 }], '2026-11-28').poor).toBe(false);
  });
  test('severe pain logged in the last days → lighter week', () => {
    const r = recoverySignals([], '2026-11-28', [{ id: 'x', date: '2026-11-27', kind: 'pain', severity: 4, bodyPart: 'Knee' }]);
    expect(r.poor).toBe(true);
    expect(chooseByRules(opts, sig({ recovery: r })).reason).toMatch(/Knee pain rated 4\/5/);
    // mild pain or an old episode doesn't count
    expect(recoverySignals([], '2026-11-28', [{ id: 'y', date: '2026-11-27', kind: 'pain', severity: 2 }]).poor).toBe(false);
    expect(recoverySignals([], '2026-11-28', [{ id: 'z', date: '2026-11-15', kind: 'pain', severity: 5 }]).poor).toBe(false);
  });
  test('skip a scheduled lighter week only when everything is going well', () => {
    const before = weekOptions(p, plan, 4);
    expect(chooseByRules(before, sig({ improved: 3 })).option.id).toBe('skip-deload');
    expect(chooseByRules(before, sig({ improved: 1 })).option.id).toBe('standard');
  });
});

test('signals: adherence and strength trend from logged sets', () => {
  const done = sessions.map((s) => (s.week === 1 ? { ...s, status: s.order === 101 ? ('planned' as const) : ('done' as const) } : s));
  const lift = (date: string, kg: number): TrainingEntry => ({ id: date, date, exerciseId: 'ex:bench', exerciseName: 'Bench', kind: 'strength', durationMin: 10, kcal: 50, sets: [{ reps: 8, weightKg: kg }] });
  const s = trainingSignals(plan, done, [lift('2026-11-23', 80), lift('2026-11-26', 76)], '2026-11-30', 2);
  expect([s.done, s.due]).toEqual([3, 4]);
  expect(s.declined).toBe(1);
  expect(targetWeek(plan, done, '2026-11-30')).toBe(2);
  expect(targetWeek(plan, done, '2026-11-27')).toBe(2);
});

describe('energy estimates', () => {
  const ex = (id: string) => SEED_EXERCISES.find((e) => e.id === id)!;
  test('running ≈ 1 kcal per kg per km', () => {
    const r = estimateActivity({ exercise: ex('ex:run'), minutes: 60, distanceKm: 10, weightKg: 80 });
    expect(r.kcal).toBeGreaterThan(720);
    expect(r.kcal).toBeLessThan(900);
    expect(r.method).toMatch(/running equation/);
  });
  test('walking pace matters', () => {
    const slow = estimateActivity({ exercise: ex('ex:walk'), minutes: 60, distanceKm: 4, weightKg: 80 });
    const fast = estimateActivity({ exercise: ex('ex:walk'), minutes: 60, distanceKm: 6, weightKg: 80 });
    expect(fast.kcal).toBeGreaterThan(slow.kcal);
    expect(slow.kcal).toBeGreaterThan(200);
  });
  test('net excludes resting energy; range brackets the estimate', () => {
    const r = estimateActivity({ exercise: ex('ex:yoga'), minutes: 60, weightKg: 80 });
    expect(r.netKcal).toBe(Math.round(1.5 * 80));
    expect(r.low).toBeLessThan(r.kcal);
    expect(r.high).toBeGreaterThan(r.kcal);
  });
  test('cycling uses speed bands', () => {
    expect(estimateActivity({ exercise: ex('ex:cycle'), minutes: 60, distanceKm: 28, weightKg: 80 }).met).toBe(12);
  });
});

import { describe, expect, test } from 'vitest';
import { PROGRAMS, generatePlan, weekStructure, weeklySets, estimateMinutes, weekday } from '../domain/programs';
import { SEED_EXERCISES } from '../domain/exercises';

const ids = new Set(SEED_EXERCISES.map((e) => e.id));
const gen = (id: string, weeks: number) => {
  const p = PROGRAMS.find((x) => x.id === id)!;
  const days = { 3: [1, 3, 5], 4: [1, 2, 4, 5], 6: [1, 2, 3, 4, 5, 6] }[p.daysPerWeek]!;
  return generatePlan(p, { weeks, startDate: '2026-11-23', trainingDays: days, id: 'p' });
};

describe('week structure', () => {
  test.each([
    [2, 'AA'], [4, 'AAAA'], [6, 'AAAAAD'], [8, 'AAADAAAD'], [10, 'AAAADAAAAD'], [12, 'AAAAADAAAAAD'], [7, 'AAADAAD'],
  ])('%i weeks → %s', (n, shape) => {
    expect(weekStructure(n).map((w) => (w.phase === 'deload' ? 'D' : 'A')).join('')).toBe(shape);
  });
});

describe('programs', () => {
  for (const p of PROGRAMS) {
    test(`${p.name}: valid exercises, dates on training days, sane sessions`, () => {
      const { sessions, plan } = gen(p.id, p.defaultWeeks);
      expect(sessions.length).toBe(p.daysPerWeek * plan.weeks);
      for (const s of sessions) {
        expect(plan.trainingDays).toContain(weekday(s.date));
        for (const e of s.exercises) expect(ids.has(e.exerciseId), e.exerciseId).toBe(true);
        const mins = estimateMinutes(s);
        expect(mins).toBeGreaterThan(s.phase === 'deload' ? 10 : 30);
        expect(mins).toBeLessThan(110);
      }
    });
  }

  test('hypertrophy programs land in the evidence-based weekly volume range', () => {
    for (const id of ['upper-lower', 'ppl']) {
      const { sessions } = gen(id, 8);
      const byWeek = (w: number) => weeklySets(sessions.filter((s) => s.week === w));
      const w1 = byWeek(1);
      const w3 = byWeek(3);
      for (const m of ['chest', 'back', 'quads', 'hamstrings', 'shoulders'] as const) {
        expect(w1[m], `${id} ${m} wk1`).toBeGreaterThanOrEqual(6);
        expect(w3[m], `${id} ${m} wk3`).toBeGreaterThanOrEqual(w1[m]); // volume builds
        expect(w3[m], `${id} ${m} wk3`).toBeLessThanOrEqual(24);
      }
      expect(Object.values(byWeek(4)).reduce((a, b) => a + b)).toBeLessThan(Object.values(w3).reduce((a, b) => a + b) * 0.7); // lighter week
    }
  });

  test('effort rises through a block, then backs off', () => {
    const { sessions } = gen('upper-lower', 8);
    const rir = (w: number) => sessions.find((s) => s.week === w)!.exercises[0].rir;
    expect([rir(1), rir(2), rir(3), rir(4)]).toEqual([3, 2, 1, 4]);
  });

  test('rep ranges rotate week to week; main lifts change between mesocycles; accessories every 2 weeks', () => {
    const { sessions } = gen('upper-lower', 8);
    const first = (w: number) => sessions.find((s) => s.week === w && s.title.startsWith('Upper A'))!;
    expect(new Set([1, 2, 3].map((w) => first(w).focus)).size).toBe(3);
    expect(first(1).exercises[0].exerciseId).toBe(first(3).exercises[0].exerciseId); // same block
    expect(first(5).exercises[0].exerciseId).not.toBe(first(1).exercises[0].exerciseId); // new block
    const lateral = (w: number) => first(w).exercises.find((e) => e.kind === 'isolation')!.exerciseId;
    expect(lateral(1)).toBe(lateral(2));
    expect(lateral(3)).not.toBe(lateral(1));
  });

  test('cut program keeps 1+ RIR, adds progressive cardio', () => {
    const { sessions } = gen('lean-out', 8);
    expect(sessions.every((s) => s.exercises.every((e) => e.kind === 'cardio' || e.rir >= 1))).toBe(true);
    const cardio = sessions.flatMap((s) => s.exercises.filter((e) => e.kind === 'cardio').map((e) => ({ ...e, phase: s.phase })));
    expect(cardio.length).toBe(16);
    const acc = cardio.filter((c) => c.phase === 'accumulation');
    expect(acc[acc.length - 1].minutes!).toBeGreaterThan(acc[0].minutes!);
  });
});

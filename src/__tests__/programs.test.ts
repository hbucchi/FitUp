import { describe, expect, test } from 'vitest';
import { PROGRAMS, DEFAULT_DAYS, generatePlan, weekStructure, weeklySets, estimateMinutes, weekday, weekOptions, rebuildFrom, hardSets } from '../domain/programs';
import { SEED_EXERCISES } from '../domain/exercises';

const ids = new Set(SEED_EXERCISES.map((e) => e.id));
const gen = (id: string, weeks: number) => {
  const p = PROGRAMS.find((x) => x.id === id)!;
  const days = DEFAULT_DAYS[p.daysPerWeek];
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
        expect(mins).toBeGreaterThan(s.phase === 'deload' ? 10 : p.category === 'sport' ? 20 : 30);
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

describe('sport programs', () => {
  test('power work stays explosive (low reps, far from failure), robustness work is included', () => {
    for (const id of ['boxing', 'football', 'swimming', 'running', 'athletic']) {
      const { sessions } = gen(id, 8);
      const all = sessions.flatMap((x) => x.exercises);
      for (const e of all.filter((x) => x.kind === 'power' && x.exerciseId !== 'ex:sled-push')) { // sled: reps are metres
        expect(e.repsMax, `${id} ${e.name}`).toBeLessThanOrEqual(15);
        expect(e.rir).toBeGreaterThanOrEqual(3);
      }
      expect(all.some((x) => x.kind === 'prehab'), id).toBe(true);
    }
  });
  test('football includes Nordics and Copenhagen planks every week', () => {
    const { sessions } = gen('football', 8);
    for (let w = 1; w <= 8; w++) {
      const names = sessions.filter((x) => x.week === w).flatMap((x) => x.exercises.map((e) => e.exerciseId));
      expect(names).toContain('ex:nordic');
      expect(names).toContain('ex:copenhagen');
    }
  });
  test('conditioning rounds build through a block and drop in the lighter week', () => {
    const { sessions } = gen('boxing', 8);
    const rounds = (w: number) => sessions.filter((x) => x.week === w).flatMap((x) => x.exercises).find((e) => e.exerciseId === 'ex:boxing')!.rounds!;
    expect([rounds(1), rounds(2), rounds(3), rounds(4)]).toEqual([4, 5, 6, 2]);
  });
});

describe('week choices (deterministic weeks, chosen by the review)', () => {
  const p = PROGRAMS.find((x) => x.id === 'upper-lower')!;
  const base = generatePlan(p, { weeks: 8, startDate: '2026-11-23', trainingDays: [1, 2, 4, 5], id: 'p' });

  test('options for week 3: progress, repeat, lighter, condensed', () => {
    const opts = weekOptions(p, base.plan, 3);
    expect(opts.map((o) => o.id)).toEqual(['standard', 'repeat', 'lighter', 'condensed']);
    const by = Object.fromEntries(opts.map((o) => [o.id, o]));
    expect(by.lighter.hardSets).toBeLessThan(by.standard.hardSets * 0.7);
    expect(by.condensed.sessions).toBe(3);
    expect(by.repeat.hardSets).toBeLessThanOrEqual(by.standard.hardSets);
  });
  test('before a scheduled lighter week, the review may skip it', () => {
    expect(weekOptions(p, base.plan, 4).map((o) => o.id)).toContain('skip-deload');
  });
  test('the same choice always produces the same week', () => {
    const a = rebuildFrom(p, base.plan, weekOptions(p, base.plan, 3)[0].choice);
    expect(a.sessions.filter((x) => x.week === 3)).toEqual(base.sessions.filter((x) => x.week === 3));
  });
  test('repeating a week extends the program by a week and shifts the rest', () => {
    const repeat = weekOptions(p, base.plan, 3).find((o) => o.id === 'repeat')!;
    const r = rebuildFrom(p, base.plan, repeat.choice);
    expect(r.plan.weeks).toBe(9);
    expect(hardSets(r.sessions.filter((x) => x.week === 3))).toBe(hardSets(base.sessions.filter((x) => x.week === 2)));
    expect(r.sessions.filter((x) => x.week === 4).map((x) => x.focus)).toEqual(base.sessions.filter((x) => x.week === 3).map((x) => x.focus));
  });
  test('skipping the lighter week shortens the program', () => {
    const skip = weekOptions(p, base.plan, 4).find((o) => o.id === 'skip-deload')!;
    const r = rebuildFrom(p, base.plan, skip.choice);
    expect(r.plan.weeks).toBe(7);
    expect(r.sessions.find((x) => x.week === 4)!.phase).toBe('accumulation');
  });
});

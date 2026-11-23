import { describe, expect, test } from 'vitest';
import { SEED_EXERCISES } from '../domain/exercises';
import { addDays } from '../domain/programs';
import type { TrainingEntry } from '../domain/types';
import { DAILY_CAP, decayFor, RANKS, THRESHOLDS, TIERS, ZEUS_POINTS, setPoints, standing, trainingPoints } from '../domain/xp';

const ex = (id: string) => SEED_EXERCISES.find((e) => e.id === `ex:${id}`)!;
const BW = 80;

describe('points', () => {
  test('1 hour of cardio = 1 point', () => {
    const e: TrainingEntry = { id: 'a', date: '2026-01-01', exerciseId: 'ex:run', exerciseName: 'Run', kind: 'aerobic', durationMin: 60, kcal: 600 };
    expect(trainingPoints([e], SEED_EXERCISES, [], BW).total).toBeCloseTo(1);
  });
  test('heavier sets and harder exercises score more', () => {
    const squat = (kg: number) => setPoints(ex('squat'), { reps: 8, weightKg: kg }, BW);
    expect(squat(80)).toBeCloseTo(0.13); // standard load (1× body weight): 0.1 × difficulty 1.3
    expect(squat(120)).toBeGreaterThan(squat(80));
    expect(squat(40)).toBeLessThan(squat(80));
    // same relative effort, harder movement → more points
    expect(squat(80)).toBeGreaterThan(setPoints(ex('leg-ext'), { reps: 8, weightKg: 40 }, BW));
  });
  test('bodyweight moves count body weight, added weight on top', () => {
    const pull = (kg: number) => setPoints(ex('pullup'), { reps: 8, weightKg: kg }, BW);
    expect(pull(0)).toBeCloseTo(0.11);
    expect(pull(20)).toBeGreaterThan(pull(0));
  });
  test('a challenging 20-set session ≈ 2 points', () => {
    const plan = [['squat', 4, 8, 90], ['rdl', 4, 8, 75], ['leg-press', 4, 10, 150], ['leg-curl', 4, 12, 35], ['calf', 4, 12, 70]] as const;
    const pts = plan.reduce((s, [id, n, reps, kg]) => s + n * setPoints(ex(id), { reps, weightKg: kg }, BW), 0);
    expect(pts).toBeGreaterThan(1.7);
    expect(pts).toBeLessThan(2.6);
  });
  test('a day is capped, so a typo cannot buy a rank', () => {
    const e: TrainingEntry = { id: 'a', date: '2026-01-01', exerciseId: 'ex:walk', exerciseName: 'Walk', kind: 'aerobic', durationMin: 6000, kcal: 0 };
    expect(trainingPoints([e], SEED_EXERCISES, [], BW).total).toBe(DAILY_CAP);
  });
});

describe('ranks', () => {
  test('36 ranks in 7 tiers, Villager → Zeus, real Greek demigods and gods at the top', () => {
    expect(RANKS).toHaveLength(36);
    expect(RANKS[0].name).toBe('Villager');
    expect(RANKS.at(-1)!.name).toBe('Zeus');
    expect(TIERS[5].ranks).toEqual(['Perseus', 'Theseus', 'Achilles', 'Heracles']);
    expect(TIERS[6].ranks.at(-1)).toBe('Zeus');
  });
  test('the curve is exponential: each rank costs ~18.5 % more than the last', () => {
    const steps = THRESHOLDS.slice(1).map((v, i) => v - THRESHOLDS[i]);
    for (let i = 12; i < steps.length - 2; i++) expect(steps[i + 1] / steps[i]).toBeCloseTo(1.185, 1); // early steps are rounded to whole points
  });

  // 7 years of the reference week, logged like a real user would
  function simulate(years: number) {
    const entries: TrainingEntry[] = [];
    const days = Math.round(years * 365.25);
    for (let d = 0; d < days; d++) {
      const date = addDays('2026-01-05', d);
      entries.push({ id: `c${d}`, date, exerciseId: 'ex:run-easy', exerciseName: 'Run', kind: 'aerobic', durationMin: 60, kcal: 0 });
      if (d % 7 < 5) {
        const lifts = d % 2 ? [['squat', 90], ['rdl', 75], ['leg-press', 150], ['leg-curl', 35], ['calf', 70]] : [['bench', 70], ['row-bb', 60], ['ohp', 40], ['lat-pulldown', 55], ['lateral', 8]];
        for (const [id, kg] of lifts as [string, number][])
          entries.push({ id: `${id}${d}`, date, exerciseId: `ex:${id}`, exerciseName: id, kind: 'strength', sets: Array(4).fill({ reps: 8, weightKg: kg }), kcal: 0 });
      }
    }
    return trainingPoints(entries, SEED_EXERCISES, [], BW).total;
  }
  test('Zeus takes about 7 years of 5×/week heavy lifting + 1 h cardio daily', () => {
    expect(standing(simulate(6.3)).name).not.toBe('Zeus');
    const seven = simulate(7.3);
    expect(standing(seven).name).toBe('Zeus');
    expect(ZEUS_POINTS).toBe(6209);
  });
  test('standing reports the next rank and progress within the current one', () => {
    const s = standing(THRESHOLDS[3] + 1);
    expect(s.name).toBe('Lumberjack');
    expect(s.next?.name).toBe('Fisherman');
    expect(s.toNext).toBeGreaterThan(0);
    expect(s.toNext).toBeLessThan(1);
  });
});

describe('inactivity drain', () => {
  const run = (date: string, min = 600): TrainingEntry => ({ id: date, date, exerciseId: 'ex:run', exerciseName: 'Run', kind: 'aerobic', durationMin: min, kcal: 0 });
  // 6 points on Jan 1 (10 h, capped) … well, use several days to bank 60 points
  const bank = Array.from({ length: 10 }, (_, i) => run(addDays('2026-01-01', i))); // 10 × 6 = 60 points, last on Jan 10
  test('schedule: free for 7 days, then 1/day, after 3 weeks 2/day, after 6 weeks 3/day', () => {
    expect([1, 7, 8, 21, 22, 42, 43, 100].map(decayFor)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });
  test('a week off costs nothing; the 8th idle day costs 1', () => {
    expect(trainingPoints(bank, SEED_EXERCISES, [], BW, '2026-01-17').total).toBeCloseTo(60);
    const s = trainingPoints(bank, SEED_EXERCISES, [], BW, '2026-01-18');
    expect(s.total).toBeCloseTo(59);
    expect(s).toMatchObject({ idleDays: 8, drainToday: 1 });
  });
  test('three and six weeks off', () => {
    // idle days 8–21 = 14 × 1, 22–42 = 21 × 2 → 56 lost after 6 weeks, leaving 4
    expect(trainingPoints(bank, SEED_EXERCISES, [], BW, addDays('2026-01-10', 42)).total).toBeCloseTo(4);
    // never below zero
    const s = trainingPoints(bank, SEED_EXERCISES, [], BW, addDays('2026-01-10', 60));
    expect(s.total).toBe(0);
    expect(s.drainToday).toBe(3);
  });
  test('a workout resets the clock', () => {
    const back = [...bank, run('2026-01-25', 60)]; // idle days 8–14 cost 7, then +1
    const s = trainingPoints(back, SEED_EXERCISES, [], BW, '2026-01-30');
    expect(s.total).toBeCloseTo(60 - 7 + 1);
    expect(s.idleDays).toBe(5);
    expect(s.lost).toBeCloseTo(7);
  });
});


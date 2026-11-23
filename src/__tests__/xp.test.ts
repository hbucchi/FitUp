import { describe, expect, test } from 'vitest';
import { SEED_EXERCISES } from '../domain/exercises';
import { addDays } from '../domain/programs';
import type { TrainingEntry } from '../domain/types';
import { DAILY_CAP, RANKS, THRESHOLDS, TIERS, ZEUS_POINTS, setPoints, standing, trainingPoints } from '../domain/xp';

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

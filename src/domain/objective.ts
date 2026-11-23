import type { BodySnapshot, Experience, Goal, Objective, Profile, Sex } from './types';
import { IDEAL, bodyMetrics } from './metrics';

/**
 * Progress toward the physique objective (ranks are earned by training — see xp.ts).
 *
 * Progress is measured in kilograms of body-composition change, not in points:
 *   needed   = lean mass to build + fat to lose        (fixed when the objective is set)
 *   achieved = lean gained so far + fat lost so far     (each capped at what was needed)
 *   progress = achieved / needed
 * so the percentage means the same thing for everyone: a share of *your* road travelled.
 */

export function snapshot(p: Pick<Profile, 'weightKg' | 'bodyFatPct'>, date: string): BodySnapshot {
  const leanKg = p.weightKg * (1 - p.bodyFatPct / 100);
  return { date, weightKg: p.weightKg, bodyFatPct: p.bodyFatPct, leanKg, fatKg: p.weightKg - leanKg };
}

/** Lean mass that gives a normalised FFMI at a height: inverse of FFMI + 6.1·(1.8 − h). */
export function leanForFfmi(ffmiNorm: number, heightCm: number): number {
  const h = heightCm / 100;
  return (ffmiNorm - 6.1 * (1.8 - h)) * h * h;
}

export function makeTarget(heightCm: number, currentLeanKg: number, bodyFatPct: number, ffmiNorm: number) {
  const leanKg = Math.max(currentLeanKg, leanForFfmi(ffmiNorm, heightCm));
  const weightKg = leanKg / (1 - bodyFatPct / 100);
  return { bodyFatPct, ffmiNorm, leanKg, fatKg: weightKg - leanKg, weightKg };
}

export function defaultTarget(p: Profile) {
  const ideal = IDEAL[p.sex];
  return makeTarget(p.heightCm, bodyMetrics(p).leanMassKg, ideal.bodyFatPct, ideal.ffmi);
}

export interface Ascent {
  progress: number;
  needLeanKg: number;
  needFatKg: number;
  gainedLeanKg: number;
  lostFatKg: number;
  remainingLeanKg: number;
  remainingFatKg: number;
}

export function ascent(o: Objective, now: Pick<Profile, 'weightKg' | 'bodyFatPct'>): Ascent {
  const cur = snapshot(now, '');
  const needLeanKg = Math.max(0, o.target.leanKg - o.start.leanKg);
  const needFatKg = Math.max(0, o.start.fatKg - o.target.fatKg);
  const gainedLeanKg = Math.min(needLeanKg, Math.max(0, cur.leanKg - o.start.leanKg));
  const lostFatKg = Math.min(needFatKg, Math.max(0, o.start.fatKg - cur.fatKg));
  const need = needLeanKg + needFatKg;
  const progress = need <= 0.05 ? 1 : Math.min(1, (gainedLeanKg + lostFatKg) / need);
  return {
    progress, needLeanKg, needFatKg, gainedLeanKg, lostFatKg,
    remainingLeanKg: needLeanKg - gainedLeanKg, remainingFatKg: needFatKg - lostFatKg,
  };
}

/**
 * Rough monthly lean-mass gain by training age (kg/month, men; women ≈ half).
 * Practitioner models (e.g. Lyle McDonald's / Alan Aragon's) — estimates, not promises.
 */
const LEAN_PER_MONTH: Record<Experience, number> = { novice: 0.7, intermediate: 0.35, advanced: 0.15 };

/** Which phase should come first. Cutting first when clearly above target body fat. */
export function recommendPhase(sex: Sex, bodyFatPct: number, target: { bodyFatPct: number }, leanToGain: number): Goal {
  const margin = sex === 'male' ? 6 : 7;
  if (bodyFatPct > target.bodyFatPct + margin) return 'cut';
  if (leanToGain > 1.5) return 'build';
  return 'recomp';
}

export interface Timeline {
  cutWeeks: number;
  buildWeeks: number;
  totalWeeks: number;
}

/** Sequential estimate: lose the fat at ~0.7 %BW/week, then build lean mass at the experience rate. */
export function estimateTimeline(p: Profile, o: Pick<Objective, 'experience' | 'target'>): Timeline {
  const m = bodyMetrics(p);
  const fatToLose = Math.max(0, m.fatMassKg - o.target.fatKg);
  const leanToGain = Math.max(0, o.target.leanKg - m.leanMassKg);
  const cutWeeks = fatToLose > 0 ? Math.ceil(fatToLose / (0.007 * p.weightKg)) : 0;
  const perMonth = LEAN_PER_MONTH[o.experience] * (p.sex === 'female' ? 0.5 : 1);
  const buildWeeks = leanToGain > 0 ? Math.ceil((leanToGain / perMonth) * 4.35) : 0;
  return { cutWeeks, buildWeeks, totalWeeks: cutWeeks + buildWeeks };
}

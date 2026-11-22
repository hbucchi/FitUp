import type { ActivityLevel, Goal, Profile, Sex } from './types';

/**
 * Body-composition maths.
 *
 *  Lean body mass  LBM  = weight × (1 − BF%)
 *  FFMI                 = LBM / height²             (kg/m²)
 *  Normalised FFMI      = FFMI + 6.1 × (1.8 − height) (Kouri et al., 1995)
 *  BMR (Katch–McArdle)  = 370 + 21.6 × LBM           (uses LBM, so needs BF%)
 *  TDEE                 = BMR × activity factor
 */

export const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary — desk job, little exercise',
  light: 'Light — training 1–3×/week',
  moderate: 'Moderate — training 3–5×/week',
  active: 'Active — training 6–7×/week',
  athlete: 'Athlete — twice a day or physical job',
};

export const GOAL_LABEL: Record<Goal, string> = {
  cut: 'Lean out — lose fat, keep muscle',
  recomp: 'Recomposition — build muscle at maintenance',
  build: 'Build — gain muscle with a small surplus',
};

const GOAL_KCAL_DELTA: Record<Goal, number> = { cut: -0.2, recomp: 0, build: 0.1 };

/**
 * The "classical ideal": a lean, muscular, natural physique.
 * Values sit near the upper end of what is attainable without drugs
 * (normalised FFMI ≈ 22–23 for men, ≈ 18–19 for women).
 */
export const IDEAL: Record<Sex, { ffmi: number; bodyFatPct: number }> = {
  male: { ffmi: 22.5, bodyFatPct: 11 },
  female: { ffmi: 18.5, bodyFatPct: 19 },
};

export function age(p: Pick<Profile, 'birthYear'>, now = new Date()): number {
  return now.getFullYear() - p.birthYear;
}

export interface BodyMetrics {
  bmi: number;
  leanMassKg: number;
  fatMassKg: number;
  ffmi: number;
  ffmiNormalized: number;
  bmr: number;
  tdee: number;
}

export function bodyMetrics(p: Profile): BodyMetrics {
  const h = p.heightCm / 100;
  const leanMassKg = p.weightKg * (1 - p.bodyFatPct / 100);
  const ffmi = leanMassKg / (h * h);
  const bmr = 370 + 21.6 * leanMassKg;
  return {
    bmi: p.weightKg / (h * h),
    leanMassKg,
    fatMassKg: p.weightKg - leanMassKg,
    ffmi,
    ffmiNormalized: ffmi + 6.1 * (1.8 - h),
    bmr,
    tdee: bmr * ACTIVITY_FACTOR[p.activity],
  };
}

export interface DailyTargets {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
}

/**
 * Protein: 2.2 g per kg of lean mass (≈1.8–2.0 g/kg body weight for most),
 * which covers the evidence-based 1.6–2.2 g/kg range for hypertrophy.
 * Fat: 27.5% of energy. Carbohydrate: the remainder.
 */
export function dailyTargets(p: Profile): DailyTargets {
  const m = bodyMetrics(p);
  const kcal = Math.round(m.tdee * (1 + GOAL_KCAL_DELTA[p.goal]));
  const protein = Math.round(2.2 * m.leanMassKg);
  const fat = Math.round((kcal * 0.275) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, fat, carbs, fiber: Math.round((kcal / 1000) * 14) };
}

export interface IdealGap {
  targetLeanKg: number;
  targetWeightKg: number;
  leanToGainKg: number;
  fatToLoseKg: number;
  /** 0..1 — how close the user is to the ideal, averaged over muscle and leanness. */
  progress: number;
}

export function idealGap(p: Profile): IdealGap {
  const m = bodyMetrics(p);
  const h = p.heightCm / 100;
  const ideal = IDEAL[p.sex];
  // invert normalised FFMI to get the lean mass target at this height
  const targetLeanKg = Math.max(m.leanMassKg, (ideal.ffmi - 6.1 * (1.8 - h)) * h * h);
  const targetWeightKg = targetLeanKg / (1 - ideal.bodyFatPct / 100);
  const targetFatKg = targetWeightKg - targetLeanKg;
  const muscle = Math.min(1, m.ffmiNormalized / ideal.ffmi);
  const lean = Math.min(1, ideal.bodyFatPct / Math.max(p.bodyFatPct, 1));
  return {
    targetLeanKg,
    targetWeightKg,
    leanToGainKg: Math.max(0, targetLeanKg - m.leanMassKg),
    fatToLoseKg: Math.max(0, m.fatMassKg - targetFatKg),
    progress: (muscle + lean) / 2,
  };
}

/** Energy expenditure: kcal = MET × kg × hours. */
export function exerciseKcal(met: number, weightKg: number, minutes: number): number {
  return Math.round(met * weightKg * (minutes / 60));
}

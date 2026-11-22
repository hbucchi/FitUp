import type { BodyLog, Experience, FoodEntry, Goal, MacroDay, NutritionPlan, Profile } from './types';
import { bodyMetrics } from './metrics';
import { addDays } from './programs';

/**
 * Nutrition plan matched to the phase and the training plan (sources in docs/EVIDENCE.md).
 *
 *  Energy   maintenance (Katch–McArdle BMR × activity) ± the energy for a target rate of change:
 *             cut    −0.5 to −0.75 % body weight / week (Helms 2014; slower keeps more lean mass, Garthe 2011)
 *             build  +0.1 to +0.3 % / week by training age — small surpluses; bigger ones mostly add fat
 *                    (Iraki 2019; Helms 2023)
 *             recomp maintenance
 *  Protein  build/recomp ≥ 1.6 g/kg body weight (Morton 2018) → 2.2 g/kg lean mass;
 *           cut 2.6 g/kg lean mass (2.3–3.1 range, Helms 2014)
 *  Fat      22 % (cut) / 27 % of energy, never below 0.6 g/kg
 *  Carbs    the rest — a little more on training days, a little less on rest days (same weekly total)
 *  Meals    4 protein feedings of ~0.4–0.55 g/kg (Schoenfeld & Aragon 2018)
 *  Fiber    14 g per 1000 kcal (Dietary Guidelines for Americans)
 */

const KCAL_PER_KG = 7700;

export function targetRate(phase: Goal, p: Profile, experience: Experience = 'novice'): number {
  if (phase === 'cut') {
    const high = p.sex === 'male' ? p.bodyFatPct > 20 : p.bodyFatPct > 28;
    return high ? -0.75 : -0.5;
  }
  if (phase === 'build') return { novice: 0.3, intermediate: 0.2, advanced: 0.1 }[experience];
  return 0;
}

export function kcalFloor(p: Profile): number {
  return Math.round(Math.max(bodyMetrics(p).bmr, p.sex === 'male' ? 1500 : 1200));
}

function macroDay(kcal: number, protein: number, fatPct: number, weightKg: number): MacroDay {
  const fat = Math.max(Math.round((kcal * fatPct) / 9), Math.round(0.6 * weightKg));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal: Math.round(kcal), protein, carbs, fat };
}

export function buildNutritionPlan(
  p: Profile,
  opts: { phase: Goal; trainingDaysPerWeek: number; experience?: Experience; now?: string },
): NutritionPlan {
  const m = bodyMetrics(p);
  const rate = targetRate(opts.phase, p, opts.experience);
  let kcal = m.tdee + ((rate / 100) * p.weightKg * KCAL_PER_KG) / 7;
  kcal = Math.min(kcal, m.tdee * 1.15); // surplus cap
  kcal = Math.max(kcal, m.tdee * 0.75, kcalFloor(p)); // deficit cap + floor
  const protein = Math.round(
    opts.phase === 'cut' ? Math.max(2.6 * m.leanMassKg, 1.8 * p.weightKg) : Math.max(2.2 * m.leanMassKg, 1.6 * p.weightKg),
  );
  const fatPct = opts.phase === 'cut' ? 0.22 : 0.27;
  const T = Math.min(7, Math.max(0, opts.trainingDaysPerWeek));
  const delta = T > 0 && T < 7 ? Math.round(kcal * 0.06) : 0;
  const trainingKcal = kcal + delta;
  const restKcal = T < 7 ? kcal - (delta * T) / (7 - T) : kcal;
  const now = opts.now ?? new Date().toISOString();
  return {
    createdAt: now,
    updatedAt: now,
    phase: opts.phase,
    targetRatePct: rate,
    training: macroDay(trainingKcal, protein, fatPct, p.weightKg),
    rest: macroDay(Math.max(restKcal, kcalFloor(p)), protein, fatPct, p.weightKg),
    fiber: Math.round((kcal / 1000) * 14),
    mealsPerDay: 4,
    proteinPerMeal: Math.round(protein / 4),
  };
}

export function weeklyAverage(plan: NutritionPlan, trainingDaysPerWeek: number): number {
  const T = trainingDaysPerWeek;
  return (plan.training.kcal * T + plan.rest.kcal * (7 - T)) / 7;
}

// ── Review ─────────────────────────────────────────────────────

export interface NutritionReview {
  changed: boolean;
  plan: NutritionPlan;
  reasons: string[];
  metrics: {
    trackedDays: number;
    avgKcal?: number;
    avgTargetKcal?: number;
    adherencePct?: number;
    avgProtein?: number;
    weighIns: number;
    ratePct?: number;
    targetRatePct: number;
  };
}

/** Least-squares slope of weight against day number (kg/day). */
export function weightSlope(logs: BodyLog[]): number | undefined {
  if (logs.length < 3) return undefined;
  const t0 = new Date(logs[0].date).getTime();
  const xs = logs.map((l) => (new Date(l.date).getTime() - t0) / 86400000);
  if (xs[xs.length - 1] - xs[0] < 7) return undefined;
  const ys = logs.map((l) => l.weightKg);
  const mx = xs.reduce((a, b) => a + b) / xs.length;
  const my = ys.reduce((a, b) => a + b) / ys.length;
  let num = 0;
  let den = 0;
  xs.forEach((x, i) => {
    num += (x - mx) * (ys[i] - my);
    den += (x - mx) ** 2;
  });
  return den ? num / den : undefined;
}

export function reviewNutrition(args: {
  plan: NutritionPlan;
  profile: Profile;
  foodEntries: FoodEntry[];
  bodyLog: BodyLog[];
  today: string;
  isTrainingDay: (date: string) => boolean;
  now?: string;
}): NutritionReview {
  const { plan, profile: p, today } = args;
  const reasons: string[] = [];
  const from = addDays(today, -10);

  // intake over the last 10 full days
  const days: { date: string; kcal: number; protein: number; target: number }[] = [];
  for (let d = from; d < today; d = addDays(d, 1)) {
    const entries = args.foodEntries.filter((e) => e.date === d);
    const kcal = entries.reduce((s, e) => s + (e.nutrients.kcal ?? 0), 0);
    const protein = entries.reduce((s, e) => s + (e.nutrients.protein ?? 0), 0);
    const target = (args.isTrainingDay(d) ? plan.training : plan.rest).kcal;
    if (kcal >= target * 0.4) days.push({ date: d, kcal, protein, target });
  }
  const weighIns = args.bodyLog.filter((b) => b.date >= addDays(today, -14) && b.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  const slope = weightSlope(weighIns);
  const meanW = weighIns.length ? weighIns.reduce((s, b) => s + b.weightKg, 0) / weighIns.length : p.weightKg;
  const ratePct = slope != null ? ((slope * 7) / meanW) * 100 : undefined;

  const metrics: NutritionReview['metrics'] = { trackedDays: days.length, weighIns: weighIns.length, ratePct, targetRatePct: plan.targetRatePct };
  if (days.length) {
    metrics.avgKcal = days.reduce((s, d) => s + d.kcal, 0) / days.length;
    metrics.avgTargetKcal = days.reduce((s, d) => s + d.target, 0) / days.length;
    metrics.adherencePct = (metrics.avgKcal / metrics.avgTargetKcal) * 100;
    metrics.avgProtein = days.reduce((s, d) => s + d.protein, 0) / days.length;
  }
  const unchanged = (msg: string[]): NutritionReview => ({ changed: false, plan, reasons: msg, metrics });

  if (metrics.avgProtein != null && metrics.avgProtein < plan.training.protein * 0.9) {
    reasons.push(`Protein low: ${Math.round(metrics.avgProtein)} of ${plan.training.protein} g.`);
  }
  if (days.length < 5) return unchanged([...reasons, `Nutrition unchanged: only ${days.length}/10 days logged.`]);
  if (ratePct == null) return unchanged([...reasons, 'Nutrition unchanged: need 3+ weigh-ins over a week.']);

  const deviation = ratePct - plan.targetRatePct;
  const tolerance = plan.phase === 'cut' ? 0.25 : 0.15;
  const fmtRate = (r: number) => `${r > 0 ? '+' : ''}${r.toFixed(2)} %/week`;

  // safety first: losing too fast costs muscle
  const tooFast = plan.phase === 'cut' && ratePct < -1.2;
  if (!tooFast && Math.abs(deviation) <= tolerance) {
    return unchanged([...reasons, `Nutrition on track (${fmtRate(ratePct)}).`]);
  }
  const adherence = metrics.adherencePct!;
  if (!tooFast && Math.abs(adherence - 100) > 10) {
    return unchanged([...reasons, `Nutrition unchanged: you ate ${Math.round(adherence)} % of target — hit the current targets first.`]);
  }

  // energy correction: the trend says real maintenance differs from the estimate
  let delta = ((-deviation / 100) * meanW * KCAL_PER_KG) / 7;
  delta = Math.max(-200, Math.min(200, delta * 0.5)); // damped: water weight makes trends noisy
  if (tooFast) delta = Math.max(delta, 150);
  delta = Math.round(delta / 10) * 10;
  if (Math.abs(delta) < 50) return unchanged([...reasons, `Nutrition on track (${fmtRate(ratePct)}).`]);

  const floor = kcalFloor(p);
  const adjust = (d: MacroDay): MacroDay => {
    const kcal = Math.max(floor, d.kcal + delta);
    const carbs = Math.max(0, Math.round((kcal - d.protein * 4 - d.fat * 9) / 4));
    return { ...d, kcal: Math.round(d.protein * 4 + d.fat * 9 + carbs * 4), carbs };
  };
  const next: NutritionPlan = { ...plan, training: adjust(plan.training), rest: adjust(plan.rest), updatedAt: args.now ?? new Date().toISOString() };
  reasons.push(
    tooFast
      ? `Losing too fast (${fmtRate(ratePct)}): +${delta} kcal/day.`
      : `Trend ${fmtRate(ratePct)} vs target ${fmtRate(plan.targetRatePct)}: ${delta > 0 ? '+' : ''}${delta} kcal/day.`,
  );
  return { changed: true, plan: next, reasons, metrics };
}

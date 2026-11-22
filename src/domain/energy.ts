import type { Exercise } from './types';
import { INTENSITY, type Intensity } from './exercises';

/**
 * Energy burned by an activity.
 *
 *   kcal = MET × body weight (kg) × hours           (1 MET ≈ 1 kcal/kg/h — resting)
 *
 * Where we know speed (walking / running with a distance), we use the ACSM metabolic equations
 * instead of a fixed MET, so a fast walk counts more than a slow one:
 *   walking  VO2 = 3.5 + 0.1·v + 1.8·v·grade        v in m/min, VO2 in ml/kg/min
 *   running  VO2 = 3.5 + 0.2·v + 0.9·v·grade
 *   MET = VO2 / 3.5
 * Cycling with a distance uses the Compendium's speed bands.
 *
 * "Net" is the part above resting (MET − 1): that is what an activity adds on top of a day you'd
 * have lived anyway, and what we add to the food budget for extra, unplanned activity.
 *
 * Accuracy: the equations carry roughly 8–24 % error, MET tables more; wrist trackers were off by
 * 27–93 % in a Stanford study. So we show a range, not a falsely precise number.
 */

export interface EnergyEstimate {
  kcal: number;
  netKcal: number;
  low: number;
  high: number;
  met: number;
  method: string;
  /** km/h, when computed from distance */
  speedKmh?: number;
}

const WALK = new Set(['ex:walk', 'ex:walk-brisk', 'ex:walk-incline', 'ex:hike']);
const RUN = new Set(['ex:run-easy', 'ex:run', 'ex:run-tempo', 'ex:sprints']);

/** Compendium of Physical Activities — bicycling by speed (km/h upper bound → MET). */
const CYCLE_BANDS: [number, number][] = [
  [16, 4.0],
  [19.2, 6.8],
  [22.4, 8.0],
  [25.6, 10.0],
  [30.6, 12.0],
  [Infinity, 15.8],
];

export function paceLabel(minutes: number, km: number): string {
  if (!km || !minutes) return '';
  const secPerKm = (minutes * 60) / km;
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

export function estimateActivity(args: {
  exercise: Pick<Exercise, 'id' | 'met' | 'kind'>;
  minutes: number;
  weightKg: number;
  distanceKm?: number;
  intensity?: Intensity;
  inclinePct?: number;
}): EnergyEstimate {
  const { exercise, minutes, weightKg } = args;
  const hours = Math.max(0, minutes) / 60;
  const grade = (args.inclinePct ?? (exercise.id === 'ex:walk-incline' ? 8 : 0)) / 100;
  const km = args.distanceKm ?? 0;
  let met: number;
  let method: string;
  let spread = 0.3; // MET tables: ±30 %
  let speedKmh: number | undefined;

  const v = minutes > 0 && km > 0 ? (km * 1000) / minutes : 0; // m/min
  if (v > 0) speedKmh = (v * 60) / 1000;

  if (v > 0 && (WALK.has(exercise.id) || RUN.has(exercise.id))) {
    // walking equation up to ~8 km/h unless it's a run; running equation above that
    const running = RUN.has(exercise.id) ? v >= 100 : v > 134;
    const vo2 = running ? 3.5 + 0.2 * v + 0.9 * v * grade : 3.5 + 0.1 * v + 1.8 * v * grade;
    met = vo2 / 3.5;
    method = `${running ? 'running' : 'walking'} equation at ${speedKmh!.toFixed(1)} km/h`;
    spread = 0.2;
  } else if (v > 0 && exercise.id === 'ex:cycle') {
    met = CYCLE_BANDS.find(([max]) => speedKmh! < max)![1];
    method = `cycling at ${speedKmh!.toFixed(1)} km/h`;
  } else {
    const factor = exercise.kind === 'aerobic' ? INTENSITY[args.intensity ?? 'moderate'].factor : 1;
    met = exercise.met * factor;
    method = `MET ${met.toFixed(1)}${exercise.kind === 'aerobic' ? ` (${INTENSITY[args.intensity ?? 'moderate'].label.toLowerCase()})` : ''}`;
  }

  const kcal = Math.round(met * weightKg * hours);
  return {
    kcal,
    netKcal: Math.round(Math.max(0, met - 1) * weightKg * hours),
    low: Math.round(kcal * (1 - spread)),
    high: Math.round(kcal * (1 + spread)),
    met,
    method,
    speedKmh,
  };
}

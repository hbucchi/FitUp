import type { BodyLog, Exercise, TrainingEntry } from './types';
import { t } from '../i18n';

/**
 * Training points and ranks — the game layer.
 *
 * Points (XP)
 *   Aerobic        1 point per hour (minutes ÷ 60).
 *   Weight sets    0.1 × difficulty × effort per set, where
 *                    difficulty  = how demanding the movement is (1.3 squat/deadlift … 0.5 core/prehab)
 *                    effort      = (relative load × reps ÷ 8) ^ 0.75, clamped to 0.2–2
 *                    rel. load   = weight lifted ÷ (the exercise's standard working weight for
 *                                  your body weight), so 80 kg squatted by an 80 kg lifter = 1.0
 *                  A challenging hour of lifting (~20 hard sets at standard loads) ≈ 2 points.
 *   Daily cap      6 points, so a typo (500 sets, 10 h) can't buy a rank.
 *
 * Inactivity       After 7 days without any training logged, points drain every day:
 *                  days 8–21 −1, days 22–42 −2, day 43 on −3. Logging anything resets the
 *                  clock. Points never go below 0, so a long break can cost ranks.
 *
 * Ranks
 *   36 ranks in 7 tiers, Villager → Zeus. Thresholds grow geometrically:
 *     points(n) = A · (rⁿ − 1),  n = 0 … 35
 *   with the first step at 3 points and Zeus at the points of the reference athlete after 7 years:
 *     5 challenging lifting sessions + 7 hours of aerobic work every week = 17 points/week
 *     7 years × 52.18 weeks × 17 ≈ 6,209 points
 *   r is solved from those two numbers (≈ 1.185: each rank costs ~18.5 % more than the last).
 */

export const POINTS_PER_AEROBIC_HOUR = 1;
export const POINTS_PER_REFERENCE_SET = 0.1;
export const DAILY_CAP = 6;

// ── Exercise difficulty and standard loads ──────────────────────────────

interface Spec {
  /** how demanding the movement is */
  d: number;
  /** standard working weight for ~8 reps, as a fraction of body weight (per dumbbell for dumbbells) */
  std?: number;
  /** bodyweight movements: share of body weight moved (pull-up 1.0, push-up 0.65); added weight counts on top */
  bw?: number;
  /** reps are logged as seconds (planks) or metres (sled) */
  per?: 'seconds' | 'metres';
}

const SPEC: Record<string, Spec> = {
  // big barbell lifts
  'ex:squat': { d: 1.3, std: 1.0 }, 'ex:front-squat': { d: 1.3, std: 0.8 }, 'ex:deadlift': { d: 1.3, std: 1.25 },
  'ex:clean': { d: 1.3, std: 0.6 }, 'ex:rdl': { d: 1.1, std: 0.9 }, 'ex:hack-squat': { d: 1.2, std: 1.0 },
  'ex:bench': { d: 1.0, std: 0.75 }, 'ex:incline-bb': { d: 1.0, std: 0.6 }, 'ex:cgbp': { d: 1.0, std: 0.6 },
  'ex:row-bb': { d: 1.0, std: 0.6 }, 'ex:ohp': { d: 1.0, std: 0.45 }, 'ex:push-press': { d: 1.1, std: 0.55 },
  'ex:hip-thrust': { d: 1.0, std: 1.2 }, 'ex:jump-squat-loaded': { d: 1.0, std: 0.3 },
  'ex:landmine-press': { d: 0.8, std: 0.3 }, 'ex:landmine-rot': { d: 0.6, std: 0.25 },
  // dumbbells (per hand)
  'ex:db-bench': { d: 1.0, std: 0.3 }, 'ex:incline-db': { d: 1.0, std: 0.25 }, 'ex:db-press': { d: 1.0, std: 0.2 },
  'ex:row-db': { d: 1.0, std: 0.3 }, 'ex:split-squat': { d: 1.1, std: 0.2 }, 'ex:lunge': { d: 1.1, std: 0.2 },
  'ex:reverse-lunge': { d: 1.1, std: 0.2 }, 'ex:db-rdl': { d: 1.0, std: 0.3 }, 'ex:sl-rdl': { d: 1.0, std: 0.2 },
  'ex:farmer': { d: 1.1, std: 0.4 }, 'ex:lateral': { d: 0.7, std: 0.08 }, 'ex:rear-delt': { d: 0.7, std: 0.08 },
  'ex:db-fly': { d: 0.7, std: 0.15 }, 'ex:curl-hammer': { d: 0.7, std: 0.15 }, 'ex:incline-curl': { d: 0.7, std: 0.12 },
  'ex:ytw': { d: 0.5, std: 0.03 },
  // machines
  'ex:leg-press': { d: 1.1, std: 1.8 }, 'ex:machine-press': { d: 1.0, std: 0.6 }, 'ex:incline-machine': { d: 1.0, std: 0.5 },
  'ex:machine-shoulder': { d: 1.0, std: 0.4 }, 'ex:chest-row': { d: 1.0, std: 0.6 }, 'ex:leg-ext': { d: 0.7, std: 0.5 },
  'ex:leg-curl': { d: 0.7, std: 0.4 }, 'ex:leg-curl-seated': { d: 0.7, std: 0.4 }, 'ex:calf': { d: 0.6, std: 0.9 },
  'ex:calf-seated': { d: 0.6, std: 0.6 }, 'ex:calf-legpress': { d: 0.6, std: 1.2 }, 'ex:pec-deck': { d: 0.7, std: 0.5 },
  'ex:reverse-pec-deck': { d: 0.7, std: 0.3 }, 'ex:machine-lateral': { d: 0.7, std: 0.2 },
  // cables
  'ex:lat-pulldown': { d: 1.0, std: 0.65 }, 'ex:neutral-pulldown': { d: 1.0, std: 0.65 }, 'ex:cable-row': { d: 1.0, std: 0.65 },
  'ex:cable-cross': { d: 0.7, std: 0.2 }, 'ex:face-pull': { d: 0.6, std: 0.25 }, 'ex:pushdown': { d: 0.7, std: 0.3 },
  'ex:cable-curl': { d: 0.7, std: 0.25 }, 'ex:overhead-ext': { d: 0.7, std: 0.25 }, 'ex:cable-crunch': { d: 0.6, std: 0.4 },
  'ex:cable-lateral': { d: 0.7, std: 0.06 }, 'ex:pallof': { d: 0.5, std: 0.15 }, 'ex:straight-arm-pulldown': { d: 0.7, std: 0.3 },
  'ex:curl-bb': { d: 0.7, std: 0.35 }, 'ex:skullcrusher': { d: 0.7, std: 0.3 }, 'ex:preacher-curl': { d: 0.7, std: 0.3 },
  // bodyweight
  'ex:pullup': { d: 1.1, bw: 1.0 }, 'ex:chinup': { d: 1.1, bw: 1.0 }, 'ex:dip': { d: 1.0, bw: 0.9 }, 'ex:pushup': { d: 0.9, bw: 0.65 },
  'ex:hlr': { d: 0.8, bw: 0.35 }, 'ex:ab-wheel': { d: 0.8, bw: 0.5 }, 'ex:burpee': { d: 1.0, bw: 1.0 }, 'ex:nordic': { d: 0.9, bw: 0.6 },
  'ex:dead-bug': { d: 0.4, bw: 0.2 }, 'ex:plank': { d: 0.5, bw: 0.6, per: 'seconds' }, 'ex:copenhagen': { d: 0.6, bw: 0.4, per: 'seconds' },
  // power & conditioning
  'ex:box-jump': { d: 0.8, bw: 1.0 }, 'ex:broad-jump': { d: 0.8, bw: 1.0 }, 'ex:squat-jump': { d: 0.8, bw: 1.0 },
  'ex:pogo': { d: 0.6, bw: 1.0 }, 'ex:lateral-bound': { d: 0.8, bw: 1.0 }, 'ex:kb-swing': { d: 1.0, std: 0.3 },
  'ex:tgu': { d: 1.0, std: 0.2 }, 'ex:mb-rot-throw': { d: 0.8, std: 0.06 }, 'ex:mb-slam': { d: 0.8, std: 0.08 },
  'ex:sled-push': { d: 1.1, std: 1.0, per: 'metres' },
  // prehab: light by design — the band has no logged weight
  'ex:ext-rotation': { d: 0.4, bw: 0 }, 'ex:band-pull-apart': { d: 0.4, bw: 0 }, 'ex:neck': { d: 0.4, std: 0.1 },
};

/** Custom exercises: a sensible default from the equipment. */
function specFor(ex: Exercise | undefined): Spec {
  if (ex && SPEC[ex.id]) return SPEC[ex.id];
  switch (ex?.equipment) {
    case 'Barbell': return { d: 1.0, std: 0.6 };
    case 'Dumbbells': return { d: 0.9, std: 0.2 };
    case 'Machine': return { d: 0.9, std: 0.6 };
    case 'Cable': return { d: 0.8, std: 0.35 };
    case 'Bodyweight': return { d: 0.9, bw: 0.7 };
    default: return { d: 0.8, std: 0.3 };
  }
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Points for one set. */
export function setPoints(ex: Exercise | undefined, set: { reps: number; weightKg: number }, bodyWeightKg: number): number {
  const s = specFor(ex);
  const bw = Math.max(30, bodyWeightKg);
  let rel: number;
  if (s.bw != null) {
    // bodyweight move: the body is the load, added weight counts on top; bands (bw 0) count as standard
    rel = s.bw > 0 ? (s.bw * bw + (set.weightKg || 0)) / (s.bw * bw) : 1;
  } else {
    rel = (set.weightKg || 0) / (s.std! * bw);
  }
  // 30 s of plank or 20 m of sled ≈ a set of 8
  const reps = s.per === 'seconds' ? (set.reps / 30) * 8 : s.per === 'metres' ? (set.reps / 20) * 8 : set.reps;
  const effort = clamp(Math.pow(Math.max(0, rel) * (reps / 8), 0.75), 0.2, 2);
  return POINTS_PER_REFERENCE_SET * s.d * effort;
}

/** Points for one diary entry (before the daily cap). */
export function entryPoints(e: TrainingEntry, ex: Exercise | undefined, bodyWeightKg: number): number {
  if (e.kind === 'strength' && e.sets?.length) {
    return e.sets.filter((s) => s.reps > 0).reduce((sum, s) => sum + setPoints(ex, s, bodyWeightKg), 0);
  }
  return ((e.durationMin || 0) / 60) * POINTS_PER_AEROBIC_HOUR;
}

/** Body weight on a date: the latest weigh-in on or before it, else the profile weight. */
function weightOn(date: string, logs: BodyLog[], fallback: number) {
  let w = fallback;
  for (const l of logs) if (l.date <= date) w = l.weightKg;
  return w;
}

/** Points lost on the n-th consecutive day without training (n = 1 is the day after the last workout). */
export function decayFor(idleDay: number): number {
  if (idleDay <= 7) return 0;
  if (idleDay <= 21) return 1;
  if (idleDay <= 42) return 2;
  return 3;
}

const dayMs = 86400000;
const toDay = (iso: string) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / dayMs);

export interface PointsSummary {
  total: number;
  /** points earned (before inactivity losses) */
  earned: number;
  /** points lost to inactivity so far */
  lost: number;
  /** days since the last training (0 = trained today) */
  idleDays: number;
  /** points being lost per day right now, and per day from tomorrow */
  drainToday: number;
  drainTomorrow: number;
  byDate: Map<string, number>;
  /** per training entry id, after the daily cap */
  byEntry: Map<string, number>;
}

/**
 * Total points with the daily cap and, when `today` is given, the inactivity drain applied day by
 * day in order (so a later workout earns on top of what was left, and the total can't go below 0).
 */
export function trainingPoints(entries: TrainingEntry[], exercises: Exercise[], bodyLog: BodyLog[], profileWeightKg: number, today?: string): PointsSummary {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const logs = [...bodyLog].sort((a, b) => a.date.localeCompare(b.date));
  const raw = new Map<string, { id: string; pts: number }[]>();
  for (const e of entries) {
    const pts = entryPoints(e, byId.get(e.exerciseId), weightOn(e.date, logs, profileWeightKg));
    const list = raw.get(e.date) ?? [];
    list.push({ id: e.id, pts });
    raw.set(e.date, list);
  }
  const byDate = new Map<string, number>();
  const byEntry = new Map<string, number>();
  let earned = 0;
  for (const [date, list] of raw) {
    const sum = list.reduce((s, x) => s + x.pts, 0);
    const scale = sum > DAILY_CAP ? DAILY_CAP / sum : 1;
    for (const x of list) byEntry.set(x.id, x.pts * scale);
    byDate.set(date, sum * scale);
    earned += sum * scale;
  }
  if (!today || byDate.size === 0) return { total: earned, earned, lost: 0, idleDays: 0, drainToday: 0, drainTomorrow: 0, byDate, byEntry };

  // walk the calendar from the first workout to today
  const days = [...byDate.entries()].map(([d, p]) => [toDay(d), p] as const).sort((a, b) => a[0] - b[0]);
  const end = toDay(today);
  let total = 0;
  let lost = 0;
  let idle = 0;
  let i = 0;
  for (let d = days[0][0]; d <= end; d++) {
    if (i < days.length && days[i][0] === d) {
      total += days[i][1];
      idle = 0;
      i++;
      while (i < days.length && days[i][0] === d) i++;
    } else {
      idle++;
      const take = Math.min(total, decayFor(idle));
      total -= take;
      lost += take;
    }
  }
  // entries dated in the future (planned ahead) still count
  for (; i < days.length; i++) total += days[i][1];
  return { total, earned, lost, idleDays: idle, drainToday: decayFor(idle), drainTomorrow: decayFor(idle + 1), byDate, byEntry };
}

// ── Ranks ──────────────────────────────────────────────────────────────

export const TIERS: { name: string; blurb: string; ranks: string[] }[] = [
  { name: 'Villager', blurb: 'Every ascent starts at the foot of the mountain.', ranks: ['Villager', 'Shepherd', 'Farmer', 'Lumberjack', 'Fisherman', 'Blacksmith'] },
  { name: 'Hardman', blurb: 'The habits are forming. The body has started to answer.', ranks: ['Hunter', 'Stonemason', 'Wrestler', 'Boxer', 'Pankratiast'] },
  { name: 'Soldier', blurb: 'Disciplined and consistent — training is part of who you are.', ranks: ['Recruit', 'Soldier', 'Hoplite', 'Spartan', 'Captain'] },
  { name: 'General', blurb: 'Years of work. Others start to follow your lead.', ranks: ['Commander', 'General', 'Polemarch', 'King'] },
  { name: 'Champion', blurb: 'A physique built with intent, tested in the arena.', ranks: ['Athlete of Olympia', 'Olympic victor', 'Champion', 'Living legend'] },
  { name: 'Semi-god', blurb: 'Heroes of myth — half mortal, half divine.', ranks: ['Perseus', 'Theseus', 'Achilles', 'Heracles'] },
  { name: 'God', blurb: 'Olympus. Seven years of discipline lead to Zeus.', ranks: ['Hermes', 'Apollo', 'Artemis', 'Ares', 'Athena', 'Hades', 'Poseidon', 'Zeus'] },
];

export const RANKS = TIERS.flatMap((tier, ti) => tier.ranks.map((name) => ({ name, tier: ti })));

/** The reference athlete's week: 5 challenging lifting sessions (~20 hard sets) + 1 h aerobic every day. */
export const REFERENCE_WEEK_POINTS = 5 * 20 * POINTS_PER_REFERENCE_SET + 7 * POINTS_PER_AEROBIC_HOUR;
export const ZEUS_YEARS = 7;
export const ZEUS_POINTS = Math.round(ZEUS_YEARS * (365.25 / 7) * REFERENCE_WEEK_POINTS);
export const FIRST_RANK_POINTS = 3;

/** Growth factor r with A·(r − 1) = first step and A·(r^N − 1) = Zeus — bisection. */
function solveRatio(steps: number, first: number, last: number) {
  const target = last / first; // (r^N − 1)/(r − 1)
  let lo = 1.0001;
  let hi = 2;
  for (let i = 0; i < 100; i++) {
    const r = (lo + hi) / 2;
    if ((r ** steps - 1) / (r - 1) < target) lo = r;
    else hi = r;
  }
  return (lo + hi) / 2;
}

export const RATIO = solveRatio(RANKS.length - 1, FIRST_RANK_POINTS, ZEUS_POINTS);
const A = FIRST_RANK_POINTS / (RATIO - 1);
/** points needed for each rank (index 0 = Villager = 0 points, last = Zeus) */
export const THRESHOLDS = RANKS.map((_, n) => (n === RANKS.length - 1 ? ZEUS_POINTS : Math.round(A * (RATIO ** n - 1))));

export interface Standing {
  index: number;
  name: string;
  tier: number;
  tierName: string;
  points: number;
  next?: { name: string; at: number };
  /** 0..1 within the current rank */
  toNext: number;
}

export function standing(points: number): Standing {
  let index = 0;
  THRESHOLDS.forEach((at, i) => {
    if (points >= at) index = i;
  });
  const r = RANKS[index];
  const nextAt = THRESHOLDS[index + 1];
  return {
    index,
    name: t(r.name),
    tier: r.tier,
    tierName: t(TIERS[r.tier].name),
    points,
    next: nextAt != null ? { name: t(RANKS[index + 1].name), at: nextAt } : undefined,
    toNext: nextAt != null ? (points - THRESHOLDS[index]) / (nextAt - THRESHOLDS[index]) : 1,
  };
}

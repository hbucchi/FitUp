import type { ActivePlan, Goal, PlannedExercise, PlannedSession, SlotKind } from './types';
import { SEED_EXERCISES } from './exercises';

/**
 * Periodised training programs.
 *
 * Design rules (see docs/EVIDENCE.md for sources):
 *  - Volume: ~10–20 hard sets per muscle per week, starting lower and adding sets across a
 *    mesocycle (Schoenfeld 2017; Pelland 2024 — more volume helps, with diminishing returns).
 *  - Frequency: each muscle ~2×/week, mainly as a way to spread the volume (Pelland 2024).
 *  - Load: 5–30 reps all build muscle when sets are hard (Lopez 2021); rep ranges rotate weekly
 *    (heavy / moderate / light) — undulation helps strength and keeps training fresh (Moesgaard 2022).
 *  - Effort: RIR 3 → 1 across each block; isolation work reaches ~0 RIR in the last week
 *    (Refalo 2023, Robinson 2024).
 *  - Rest: 2–3 min on compounds, ≥ 90 s on isolation (Singer 2024).
 *  - Variation: main lifts change each mesocycle, accessories every 2 weeks — moderate, planned
 *    variation, not random rotation (Kassiano 2022).
 *  - Lighter week after each 3–5-week block in longer programs, for fatigue and joints. It does
 *    not add muscle by itself (Coleman 2024), so short programs skip it.
 *  - Exercise picks favour long muscle lengths: overhead triceps, incline curls, seated leg curls,
 *    RDLs (Maeo 2023; Wolf 2025).
 */

export type Muscle = 'chest' | 'back' | 'quads' | 'hamstrings' | 'glutes' | 'shoulders' | 'rearDelts' | 'biceps' | 'triceps' | 'calves' | 'abs';

interface SlotDef {
  pool: string[];
  kind: SlotKind;
  primary: Muscle[];
  /** muscles that get half-credit (e.g. biceps on rows) */
  secondary?: Muscle[];
}

export const SLOTS = {
  squat: { pool: ['ex:squat', 'ex:hack-squat', 'ex:leg-press', 'ex:front-squat'], kind: 'compound', primary: ['quads', 'glutes'] },
  hinge: { pool: ['ex:rdl', 'ex:db-rdl'], kind: 'compound', primary: ['hamstrings', 'glutes'] },
  legCurl: { pool: ['ex:leg-curl-seated', 'ex:leg-curl'], kind: 'isolation', primary: ['hamstrings'] },
  quadIso: { pool: ['ex:leg-ext'], kind: 'isolation', primary: ['quads'] },
  lunge: { pool: ['ex:split-squat', 'ex:reverse-lunge', 'ex:lunge'], kind: 'compound', primary: ['quads', 'glutes'] },
  hipThrust: { pool: ['ex:hip-thrust'], kind: 'compound', primary: ['glutes'], secondary: ['hamstrings'] },
  calf: { pool: ['ex:calf', 'ex:calf-seated', 'ex:calf-legpress'], kind: 'isolation', primary: ['calves'] },
  hPress: { pool: ['ex:bench', 'ex:db-bench', 'ex:machine-press'], kind: 'compound', primary: ['chest'], secondary: ['triceps', 'shoulders'] },
  iPress: { pool: ['ex:incline-db', 'ex:incline-bb', 'ex:incline-machine'], kind: 'compound', primary: ['chest'], secondary: ['triceps', 'shoulders'] },
  fly: { pool: ['ex:cable-cross', 'ex:pec-deck', 'ex:db-fly'], kind: 'isolation', primary: ['chest'] },
  vPull: { pool: ['ex:lat-pulldown', 'ex:pullup', 'ex:neutral-pulldown', 'ex:chinup'], kind: 'compound', primary: ['back'], secondary: ['biceps'] },
  row: { pool: ['ex:chest-row', 'ex:cable-row', 'ex:row-bb', 'ex:row-db'], kind: 'compound', primary: ['back'], secondary: ['biceps', 'rearDelts'] },
  vPress: { pool: ['ex:ohp', 'ex:db-press', 'ex:machine-shoulder'], kind: 'compound', primary: ['shoulders'], secondary: ['triceps'] },
  lateral: { pool: ['ex:lateral', 'ex:cable-lateral', 'ex:machine-lateral'], kind: 'isolation', primary: ['shoulders'] },
  rearDelt: { pool: ['ex:rear-delt', 'ex:face-pull', 'ex:reverse-pec-deck'], kind: 'isolation', primary: ['rearDelts'] },
  biceps: { pool: ['ex:incline-curl', 'ex:curl-bb', 'ex:curl-hammer', 'ex:preacher-curl', 'ex:cable-curl'], kind: 'isolation', primary: ['biceps'] },
  triceps: { pool: ['ex:overhead-ext', 'ex:pushdown', 'ex:skullcrusher'], kind: 'isolation', primary: ['triceps'] },
  abs: { pool: ['ex:cable-crunch', 'ex:hlr', 'ex:ab-wheel'], kind: 'isolation', primary: ['abs'] },
  cardio: { pool: ['ex:cycle-stationary', 'ex:walk-incline', 'ex:row'], kind: 'cardio', primary: [] },
} satisfies Record<string, SlotDef>;

export type SlotKey = keyof typeof SLOTS;

/** [slot, base sets, variant offset] — offset lets day A and day B use different variants. */
type SlotUse = [SlotKey, number, number?];

interface SessionTemplate {
  key: string;
  title: string;
  slots: SlotUse[];
}

export interface Program {
  id: string;
  name: string;
  tagline: string;
  description: string;
  goal: Goal[];
  level: 'novice' | 'intermediate' | 'all';
  daysPerWeek: number;
  minWeeks: number;
  maxWeeks: number;
  defaultWeeks: number;
  sessions: SessionTemplate[];
  /** cut programs: hold volume a little lower and never train to failure */
  cut?: boolean;
  /** cardio sessions appended per week (cut programs) */
  cardioPerWeek?: number;
}

const FULL_BODY: SessionTemplate[] = [
  { key: 'A', title: 'Full body A', slots: [['squat', 3], ['hPress', 3], ['row', 3], ['legCurl', 2], ['lateral', 2], ['triceps', 2]] },
  { key: 'B', title: 'Full body B', slots: [['hinge', 3], ['vPull', 3], ['vPress', 2], ['lunge', 2], ['biceps', 2], ['calf', 2], ['abs', 2]] },
  { key: 'C', title: 'Full body C', slots: [['squat', 3, 1], ['iPress', 3], ['row', 2, 1], ['vPull', 2, 1], ['lateral', 2, 1], ['biceps', 2, 1], ['triceps', 2, 1]] },
];

const UPPER_LOWER: SessionTemplate[] = [
  { key: 'UA', title: 'Upper A', slots: [['hPress', 3], ['row', 3], ['vPress', 2], ['vPull', 2], ['lateral', 2], ['triceps', 2], ['biceps', 2]] },
  { key: 'LA', title: 'Lower A', slots: [['squat', 3], ['hinge', 3], ['legCurl', 2], ['quadIso', 2], ['calf', 3], ['abs', 2]] },
  { key: 'UB', title: 'Upper B', slots: [['iPress', 3], ['vPull', 3, 1], ['row', 2, 1], ['fly', 2], ['lateral', 2, 1], ['rearDelt', 2], ['biceps', 2, 1], ['triceps', 2, 1]] },
  { key: 'LB', title: 'Lower B', slots: [['squat', 3, 2], ['lunge', 2], ['hinge', 2, 1], ['legCurl', 3, 1], ['hipThrust', 2], ['calf', 3, 1], ['abs', 2, 1]] },
];

const PPL: SessionTemplate[] = [
  { key: 'PA', title: 'Push A', slots: [['hPress', 3], ['vPress', 3], ['iPress', 2, 1], ['lateral', 3], ['triceps', 3]] },
  { key: 'PLA', title: 'Pull A', slots: [['vPull', 3], ['row', 3], ['rearDelt', 3], ['biceps', 3], ['abs', 2]] },
  { key: 'LGA', title: 'Legs A', slots: [['squat', 3], ['hinge', 3], ['legCurl', 3], ['quadIso', 2], ['calf', 3]] },
  { key: 'PB', title: 'Push B', slots: [['iPress', 3], ['hPress', 2, 1], ['fly', 2], ['lateral', 3, 1], ['triceps', 3, 1]] },
  { key: 'PLB', title: 'Pull B', slots: [['row', 3, 1], ['vPull', 3, 1], ['rearDelt', 2, 1], ['biceps', 3, 1], ['abs', 2, 1]] },
  { key: 'LGB', title: 'Legs B', slots: [['squat', 3, 1], ['lunge', 2], ['legCurl', 3, 1], ['hipThrust', 2], ['calf', 3, 1]] },
];

export const PROGRAMS: Program[] = [
  {
    id: 'kickstart',
    name: 'Kickstart',
    tagline: '2 weeks · 3 days · full body',
    description: 'A short on-ramp: learn the main lifts, find your working weights and build the habit before a longer block.',
    goal: ['cut', 'recomp', 'build'],
    level: 'all',
    daysPerWeek: 3,
    minWeeks: 2,
    maxWeeks: 2,
    defaultWeeks: 2,
    sessions: FULL_BODY,
  },
  {
    id: 'foundation',
    name: 'Foundation',
    tagline: 'Full body · 3 days',
    description: 'Each muscle twice or more a week with moderate volume. The best start for newer lifters, or for a busy schedule.',
    goal: ['recomp', 'build'],
    level: 'novice',
    daysPerWeek: 3,
    minWeeks: 4,
    maxWeeks: 12,
    defaultWeeks: 8,
    sessions: FULL_BODY,
  },
  {
    id: 'upper-lower',
    name: 'Hypertrophy — Upper / Lower',
    tagline: 'Upper/lower · 4 days',
    description: 'The workhorse split: 2× frequency per muscle, volume building through each block, rep ranges rotating weekly.',
    goal: ['recomp', 'build'],
    level: 'intermediate',
    daysPerWeek: 4,
    minWeeks: 4,
    maxWeeks: 12,
    defaultWeeks: 8,
    sessions: UPPER_LOWER,
  },
  {
    id: 'ppl',
    name: 'Hypertrophy — Push / Pull / Legs',
    tagline: 'PPL · 6 days',
    description: 'Highest volume. Each muscle twice a week with room for more sets — for trained lifters who recover well.',
    goal: ['build'],
    level: 'intermediate',
    daysPerWeek: 6,
    minWeeks: 6,
    maxWeeks: 12,
    defaultWeeks: 12,
    sessions: PPL,
  },
  {
    id: 'lean-out',
    name: 'Lean Out',
    tagline: 'Upper/lower · 4 days + cardio',
    description: 'Keep the muscle while the fat comes off: keep loads heavy, hold volume moderate and add easy cardio that doesn\'t compete with lifting.',
    goal: ['cut'],
    level: 'all',
    daysPerWeek: 4,
    minWeeks: 4,
    maxWeeks: 12,
    defaultWeeks: 8,
    sessions: UPPER_LOWER,
    cut: true,
    cardioPerWeek: 2,
  },
];

export const programById = (id: string) => PROGRAMS.find((p) => p.id === id);

// ── Week structure ─────────────────────────────────────────────

export interface WeekInfo {
  week: number; // 1-based
  meso: number; // 0-based mesocycle index
  phase: 'accumulation' | 'deload';
  /** index within the mesocycle's accumulation weeks */
  k: number;
  /** number of accumulation weeks in this mesocycle */
  accWeeks: number;
  /** running count of accumulation weeks (drives the weekly rep-range rotation) */
  accIndex: number;
}

/**
 * ≤ 4 weeks: one block, no lighter week.
 * Longer: blocks of 4–6 weeks, each ending with a lighter week (e.g. 8 → 3+1, 3+1; 12 → 5+1, 5+1).
 */
export function weekStructure(totalWeeks: number): WeekInfo[] {
  const blocks: number[] = [];
  if (totalWeeks <= 4) blocks.push(totalWeeks);
  else {
    const m = Math.ceil(totalWeeks / 6);
    const base = Math.floor(totalWeeks / m);
    for (let i = 0; i < m; i++) blocks.push(base + (i < totalWeeks % m ? 1 : 0));
  }
  const out: WeekInfo[] = [];
  let week = 1;
  let accIndex = 0;
  blocks.forEach((len, meso) => {
    const hasDeload = totalWeeks > 4;
    const accWeeks = hasDeload ? len - 1 : len;
    for (let k = 0; k < len; k++) {
      const deload = hasDeload && k === len - 1;
      out.push({ week: week++, meso, phase: deload ? 'deload' : 'accumulation', k: deload ? accWeeks : k, accWeeks, accIndex: deload ? accIndex : accIndex++ });
    }
  });
  return out;
}

export const FOCUSES = [
  { name: 'Heavy', compound: [6, 8], isolation: [8, 12] },
  { name: 'Moderate', compound: [8, 12], isolation: [10, 15] },
  { name: 'Light', compound: [10, 15], isolation: [15, 20] },
] as const;

function rirFor(w: WeekInfo, kind: SlotKind, cut: boolean): number {
  if (w.phase === 'deload') return 4;
  const base = w.accWeeks <= 1 ? 2 : Math.round(3 - (2 * w.k) / (w.accWeeks - 1));
  const last = w.k === w.accWeeks - 1;
  if (kind === 'isolation' && last && !cut) return Math.max(0, base - 1);
  return Math.max(cut ? 1 : kind === 'compound' ? 1 : 0, base);
}

function setsFor(base: number, w: WeekInfo, kind: SlotKind, cut: boolean): number {
  const b = cut && kind === 'isolation' ? Math.max(2, base - 1) : base;
  if (w.phase === 'deload') return Math.max(1, Math.round(b * 0.5));
  // volume climbs through the block: +1 set from week 2, isolations +1 more from week 4
  const add = (w.k >= 1 ? 1 : 0) + (kind === 'isolation' && w.k >= 3 ? 1 : 0);
  return Math.min(5, b + add);
}

const restFor = (kind: SlotKind) => (kind === 'compound' ? 150 : 90);

const EXERCISE_NAME = new Map(SEED_EXERCISES.map((e) => [e.id, e.name]));

/**
 * Variant choice: main lifts stay the same for a whole mesocycle, then change;
 * accessories change every two weeks — planned, moderate variation.
 */
export function variantFor(slot: SlotKey, offset: number, w: WeekInfo): string {
  const def = SLOTS[slot];
  const pool = def.pool;
  const step = def.kind === 'compound' ? w.meso : w.meso * 2 + Math.floor(w.k / 2);
  return pool[(offset + step) % pool.length];
}

export function buildSession(t: SessionTemplate, w: WeekInfo, program: Program): { focus: string; exercises: PlannedExercise[] } {
  const focus = w.phase === 'deload' ? null : FOCUSES[w.accIndex % FOCUSES.length];
  const exercises: PlannedExercise[] = t.slots.map(([slot, base, offset = 0]) => {
    const def = SLOTS[slot];
    const id = variantFor(slot, offset, w);
    const range = focus ? (def.kind === 'compound' ? focus.compound : focus.isolation) : def.kind === 'compound' ? [8, 10] : [12, 15];
    // in a cut keep compounds on the heavier side to protect strength and muscle
    const reps = program.cut && def.kind === 'compound' && focus?.name === 'Light' ? [8, 12] : range;
    return {
      exerciseId: id,
      name: EXERCISE_NAME.get(id) ?? id,
      kind: def.kind,
      sets: setsFor(base, w, def.kind, !!program.cut),
      repsMin: reps[0],
      repsMax: reps[1],
      rir: rirFor(w, def.kind, !!program.cut),
      restSec: restFor(def.kind),
    };
  });
  return { focus: w.phase === 'deload' ? 'Lighter week' : focus!.name, exercises };
}

function cardioExercise(w: WeekInfo, totalWeeks: number, i: number): PlannedExercise {
  // easy, low-impact cardio (cycling / incline walking interfere least with lifting — Wilson 2012),
  // growing from 25 to 40 minutes over the program
  const minutes = Math.min(40, 25 + Math.floor(((w.week - 1) / Math.max(1, totalWeeks - 1)) * 15 / 5) * 5);
  const id = SLOTS.cardio.pool[i % 2];
  return {
    exerciseId: id, name: EXERCISE_NAME.get(id) ?? id, kind: 'cardio', sets: 1, repsMin: 0, repsMax: 0, rir: 0, restSec: 0,
    minutes: w.phase === 'deload' ? Math.round(minutes * 0.6) : minutes,
    note: 'Easy pace — you should be able to talk.',
  };
}

// ── Calendar ───────────────────────────────────────────────────

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s: string, n: number) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const weekday = (s: string) => parse(s).getDay();

export const DEFAULT_DAYS: Record<number, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};

export interface GeneratedPlan {
  plan: ActivePlan;
  sessions: PlannedSession[];
}

export function generatePlan(program: Program, opts: { weeks: number; startDate: string; trainingDays: number[]; id: string; now?: string }): GeneratedPlan {
  const weeks = Math.min(program.maxWeeks, Math.max(program.minWeeks, opts.weeks));
  const days = [...new Set(opts.trainingDays)].sort();
  const structure = weekStructure(weeks);
  const sessions: PlannedSession[] = [];
  let order = 0;
  let templateIdx = 0;
  for (const w of structure) {
    const weekStart = addDays(opts.startDate, (w.week - 1) * 7);
    let cardioDone = 0;
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d);
      if (!days.includes(weekday(date))) continue;
      const t = program.sessions[templateIdx++ % program.sessions.length];
      const built = buildSession(t, w, program);
      // cut programs: easy cardio after the upper-body days
      if (program.cardioPerWeek && cardioDone < program.cardioPerWeek && t.key.startsWith('U')) {
        built.exercises.push(cardioExercise(w, weeks, cardioDone));
        cardioDone++;
      }
      sessions.push({
        id: `${opts.id}-w${w.week}-${t.key}-${order}`,
        planId: opts.id,
        date,
        week: w.week,
        order: order++,
        phase: w.phase,
        focus: built.focus,
        title: `${t.title} — ${built.focus}`,
        exercises: built.exercises,
        status: 'planned',
      });
    }
  }
  const last = sessions[sessions.length - 1];
  return {
    plan: {
      id: opts.id,
      programId: program.id,
      name: program.name,
      weeks,
      startDate: opts.startDate,
      endDate: last ? last.date : opts.startDate,
      trainingDays: days,
      createdAt: opts.now ?? new Date().toISOString(),
    },
    sessions,
  };
}

/** Weekly hard sets per muscle (secondary muscles count half) — used to sanity-check programs. */
export function weeklySets(sessions: PlannedSession[]): Record<Muscle, number> {
  const out = Object.fromEntries(
    ['chest', 'back', 'quads', 'hamstrings', 'glutes', 'shoulders', 'rearDelts', 'biceps', 'triceps', 'calves', 'abs'].map((m) => [m, 0]),
  ) as Record<Muscle, number>;
  const slotOf = new Map<string, SlotDef>();
  for (const def of Object.values(SLOTS) as SlotDef[]) for (const id of def.pool) if (!slotOf.has(id)) slotOf.set(id, def);
  for (const s of sessions)
    for (const e of s.exercises) {
      const def = slotOf.get(e.exerciseId);
      if (!def || def.kind === 'cardio') continue;
      def.primary.forEach((m) => (out[m] += e.sets));
      def.secondary?.forEach((m) => (out[m] += e.sets / 2));
    }
  return out;
}

export function estimateMinutes(s: Pick<PlannedSession, 'exercises'>): number {
  let sec = 0;
  for (const e of s.exercises) sec += e.kind === 'cardio' ? (e.minutes ?? 0) * 60 : e.sets * (e.restSec + 45);
  return Math.round(sec / 60 / 5) * 5;
}

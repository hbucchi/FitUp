import type { ActivePlan, Goal, PlannedExercise, PlannedSession, SlotKind, WeekChoice, WeekVariant } from './types';
import { SEED_EXERCISES } from './exercises';

/**
 * Deterministic, periodised training programs (sources: docs/EVIDENCE.md).
 *
 * Every week of every program is fully determined by (program, week structure step, variant).
 * The weekly review — rules or the AI coach — only *chooses* which pre-designed week runs next:
 * progress as planned, repeat, a lighter week, a condensed (fewer-days) week, or skip a lighter week.
 *
 * Physique rules:
 *  - ~10–20 hard sets per muscle per week, building through each block (Schoenfeld 2017; Pelland 2024)
 *  - each muscle ~2×/week (Pelland 2024)
 *  - rep ranges rotate weekly Heavy / Moderate / Light (Lopez 2021; Moesgaard 2022)
 *  - effort 3 → 1 reps in reserve across a block (Refalo 2023; Robinson 2024)
 *  - rest 2–3 min compounds, ≥ 90 s isolation (Singer 2024)
 *  - main lifts change each block, accessories every 2 weeks (Kassiano 2022)
 *  - lighter week after 3–5-week blocks in longer programs (fatigue; Coleman 2024)
 * Sport rules: power before fatigue, heavy strength 3–6 reps, robustness work that cuts injuries
 * (Nordics, Copenhagen, FIFA 11+), conditioning matched to the sport.
 */

export type Muscle = 'chest' | 'back' | 'quads' | 'hamstrings' | 'glutes' | 'shoulders' | 'rearDelts' | 'biceps' | 'triceps' | 'calves' | 'abs';

interface SlotDef {
  pool: string[];
  kind: SlotKind;
  primary: Muscle[];
  /** muscles that get half-credit (e.g. biceps on rows) */
  secondary?: Muscle[];
}

const slot = (pool: string[], kind: SlotKind, primary: Muscle[] = [], secondary?: Muscle[]): SlotDef => ({ pool, kind, primary, secondary });

export const SLOTS = {
  // physique
  squat: slot(['ex:squat', 'ex:hack-squat', 'ex:leg-press', 'ex:front-squat'], 'compound', ['quads', 'glutes']),
  hinge: slot(['ex:rdl', 'ex:db-rdl'], 'compound', ['hamstrings', 'glutes']),
  legCurl: slot(['ex:leg-curl-seated', 'ex:leg-curl'], 'isolation', ['hamstrings']),
  quadIso: slot(['ex:leg-ext'], 'isolation', ['quads']),
  lunge: slot(['ex:split-squat', 'ex:reverse-lunge', 'ex:lunge'], 'compound', ['quads', 'glutes']),
  hipThrust: slot(['ex:hip-thrust'], 'compound', ['glutes'], ['hamstrings']),
  calf: slot(['ex:calf', 'ex:calf-seated', 'ex:calf-legpress'], 'isolation', ['calves']),
  hPress: slot(['ex:bench', 'ex:db-bench', 'ex:machine-press'], 'compound', ['chest'], ['triceps', 'shoulders']),
  iPress: slot(['ex:incline-db', 'ex:incline-bb', 'ex:incline-machine'], 'compound', ['chest'], ['triceps', 'shoulders']),
  fly: slot(['ex:cable-cross', 'ex:pec-deck', 'ex:db-fly'], 'isolation', ['chest']),
  vPull: slot(['ex:lat-pulldown', 'ex:pullup', 'ex:neutral-pulldown', 'ex:chinup'], 'compound', ['back'], ['biceps']),
  row: slot(['ex:chest-row', 'ex:cable-row', 'ex:row-bb', 'ex:row-db'], 'compound', ['back'], ['biceps', 'rearDelts']),
  vPress: slot(['ex:ohp', 'ex:db-press', 'ex:machine-shoulder'], 'compound', ['shoulders'], ['triceps']),
  lateral: slot(['ex:lateral', 'ex:cable-lateral', 'ex:machine-lateral'], 'isolation', ['shoulders']),
  rearDelt: slot(['ex:rear-delt', 'ex:face-pull', 'ex:reverse-pec-deck'], 'isolation', ['rearDelts']),
  biceps: slot(['ex:incline-curl', 'ex:curl-bb', 'ex:curl-hammer', 'ex:preacher-curl', 'ex:cable-curl'], 'isolation', ['biceps']),
  triceps: slot(['ex:overhead-ext', 'ex:pushdown', 'ex:skullcrusher'], 'isolation', ['triceps']),
  abs: slot(['ex:cable-crunch', 'ex:hlr', 'ex:ab-wheel'], 'isolation', ['abs']),
  cardio: slot(['ex:cycle-stationary', 'ex:walk-incline', 'ex:row'], 'cardio'),
  // functional & sport
  pullup: slot(['ex:pullup', 'ex:chinup', 'ex:lat-pulldown'], 'compound', ['back'], ['biceps']),
  pushup: slot(['ex:pushup', 'ex:db-bench'], 'compound', ['chest'], ['triceps']),
  slHinge: slot(['ex:sl-rdl'], 'compound', ['hamstrings', 'glutes']),
  landminePress: slot(['ex:landmine-press'], 'compound', ['shoulders', 'chest']),
  saPull: slot(['ex:straight-arm-pulldown'], 'isolation', ['back']),
  carry: slot(['ex:farmer'], 'compound', []),
  tgu: slot(['ex:tgu'], 'prehab', ['abs']),
  jumpVert: slot(['ex:box-jump', 'ex:squat-jump'], 'power'),
  jumpHoriz: slot(['ex:broad-jump', 'ex:lateral-bound'], 'power'),
  jumpLoaded: slot(['ex:jump-squat-loaded'], 'power'),
  reactive: slot(['ex:pogo'], 'power'),
  rotPower: slot(['ex:mb-rot-throw', 'ex:landmine-rot'], 'power'),
  slam: slot(['ex:mb-slam'], 'power'),
  swing: slot(['ex:kb-swing'], 'power'),
  pushPress: slot(['ex:push-press'], 'power'),
  sled: slot(['ex:sled-push'], 'power'),
  nordic: slot(['ex:nordic'], 'prehab', ['hamstrings']),
  copenhagen: slot(['ex:copenhagen'], 'prehab'),
  antiRot: slot(['ex:pallof', 'ex:dead-bug'], 'prehab', ['abs']),
  cuff: slot(['ex:ext-rotation', 'ex:ytw'], 'prehab', ['rearDelts']),
  scap: slot(['ex:band-pull-apart', 'ex:face-pull'], 'prehab', ['rearDelts']),
  neck: slot(['ex:neck'], 'prehab'),
  bagRounds: slot(['ex:boxing'], 'conditioning'),
  shadow: slot(['ex:shadowbox', 'ex:rope'], 'conditioning'),
  rsa: slot(['ex:sprints', 'ex:shuttle'], 'conditioning'),
  longIntervals: slot(['ex:interval-run'], 'conditioning'),
  circuit: slot(['ex:circuit'], 'conditioning'),
  easyRun: slot(['ex:run-easy'], 'cardio'),
  swim: slot(['ex:swim'], 'cardio'),
} satisfies Record<string, SlotDef>;

export type SlotKey = keyof typeof SLOTS;

interface SlotOpts {
  /** fixed rep range (e.g. heavy strength 3–6) instead of the weekly rotation */
  reps?: [number, number];
  /** conditioning */
  workSec?: number;
  restSec?: number;
  /** continuous cardio base minutes */
  minutes?: number;
  note?: string;
}

/** [slot, base sets (or rounds), variant offset, options] */
type SlotUse = [SlotKey, number, number?, SlotOpts?];

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
  category: 'physique' | 'sport';
  goal: Goal[];
  level: 'novice' | 'intermediate' | 'all';
  daysPerWeek: number;
  minWeeks: number;
  maxWeeks: number;
  defaultWeeks: number;
  sessions: SessionTemplate[];
  /** a shorter week (fewer days) the review can choose when life gets busy */
  condensed?: SessionTemplate[];
  /** cut programs: hold volume a little lower and never train to failure */
  cut?: boolean;
  /** cardio sessions appended per week (cut programs) */
  cardioPerWeek?: number;
  /** practical notes shown with the program */
  notes?: string[];
}

// ── Physique templates ─────────────────────────────────────────

const FULL_BODY: SessionTemplate[] = [
  { key: 'A', title: 'Full body A', slots: [['squat', 3], ['hPress', 3], ['row', 3], ['legCurl', 2], ['lateral', 2], ['triceps', 2]] },
  { key: 'B', title: 'Full body B', slots: [['hinge', 3], ['vPull', 3], ['vPress', 2], ['lunge', 2], ['biceps', 2], ['calf', 2], ['abs', 2]] },
  { key: 'C', title: 'Full body C', slots: [['squat', 3, 1], ['iPress', 3], ['row', 2, 1], ['vPull', 2, 1], ['lateral', 2, 1], ['biceps', 2, 1], ['triceps', 2, 1]] },
];

/** two longer full-body days that still hit every major muscle */
const FULL_BODY_2: SessionTemplate[] = [
  { key: 'X', title: 'Full body X', slots: [['squat', 3], ['hPress', 3], ['row', 3], ['hinge', 2], ['lateral', 2], ['biceps', 2], ['triceps', 2]] },
  { key: 'Y', title: 'Full body Y', slots: [['hinge', 3], ['iPress', 3], ['vPull', 3], ['lunge', 2], ['legCurl', 2], ['lateral', 2, 1], ['abs', 2]] },
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

// ── Sport templates ────────────────────────────────────────────
const HEAVY: SlotOpts = { reps: [3, 6] };

const BOXING: SessionTemplate[] = [
  { key: 'BX1', title: 'Power & lower body', slots: [['jumpVert', 3, 0, { reps: [3, 5] }], ['jumpLoaded', 3, 0, { reps: [4, 6], note: 'Light bar, ~30 % of your squat' }], ['squat', 3, 0, HEAVY], ['slHinge', 2, 0, { reps: [6, 8] }], ['antiRot', 2], ['neck', 2, 0, { reps: [12, 15] }]] },
  { key: 'BX2', title: 'Upper body & rounds', slots: [['rotPower', 3, 0, { reps: [4, 6], note: 'Each side' }], ['pushPress', 3, 0, { reps: [3, 5] }], ['pullup', 3], ['landminePress', 2, 0, { reps: [6, 8] }], ['cuff', 2, 0, { reps: [12, 15] }], ['bagRounds', 4, 0, { workSec: 180, restSec: 60, note: 'Heavy bag' }]] },
  { key: 'BX3', title: 'Explosive conditioning', slots: [['swing', 3, 0, { reps: [8, 10] }], ['slam', 3, 0, { reps: [5, 6] }], ['lunge', 3, 0, { reps: [6, 8] }], ['row', 3, 0, { reps: [6, 8] }], ['antiRot', 2, 1], ['shadow', 6, 0, { workSec: 120, restSec: 60, note: 'Shadowbox or rope, fight pace' }]] },
];

const FOOTBALL: SessionTemplate[] = [
  { key: 'FB1', title: 'Strength & power', slots: [['jumpVert', 3, 0, { reps: [3, 5] }], ['squat', 3, 0, HEAVY], ['hipThrust', 3, 0, { reps: [5, 8] }], ['nordic', 2, 0, { reps: [4, 6], note: 'Lower slowly' }], ['copenhagen', 2, 0, { reps: [15, 30], note: 'Seconds per side' }], ['calf', 3, 0, { reps: [8, 12] }]] },
  { key: 'FB2', title: 'Speed & change of direction', slots: [['jumpHoriz', 3, 0, { reps: [3, 5] }], ['reactive', 2, 0, { reps: [10, 15] }], ['rsa', 6, 0, { workSec: 6, restSec: 24, note: 'All-out 20–30 m sprints' }], ['slHinge', 3, 0, { reps: [6, 8] }], ['antiRot', 2]] },
  { key: 'FB3', title: 'Upper body & robustness', slots: [['hPress', 3, 0, { reps: [6, 8] }], ['pullup', 3], ['row', 2, 1, { reps: [8, 10] }], ['nordic', 2, 0, { reps: [4, 6] }], ['copenhagen', 2], ['longIntervals', 4, 0, { workSec: 240, restSec: 180, note: 'Hard, ~90 % max heart rate' }]] },
];

const SWIM: SessionTemplate[] = [
  { key: 'SW1', title: 'Pull & shoulder health', slots: [['pullup', 3], ['saPull', 3, 0, { reps: [10, 12] }], ['row', 3, 1, { reps: [8, 10] }], ['cuff', 3, 0, { reps: [15, 20], note: 'Light band' }], ['scap', 2, 0, { reps: [15, 20] }], ['antiRot', 2, 1]] },
  { key: 'SW2', title: 'Legs & power (starts and turns)', slots: [['jumpVert', 3, 1, { reps: [3, 5] }], ['jumpHoriz', 3, 0, { reps: [3, 5] }], ['squat', 3, 0, { reps: [5, 8] }], ['hinge', 3, 0, { reps: [6, 8] }], ['calf', 2], ['antiRot', 2]] },
  { key: 'SW3', title: 'Full body & core', slots: [['landminePress', 3, 0, { reps: [8, 10] }], ['vPull', 3, 2], ['pushup', 2], ['cuff', 2, 1, { reps: [12, 15] }], ['tgu', 2, 0, { reps: [2, 3], note: 'Per side' }], ['swim', 1, 0, { minutes: 30, note: 'Steady pace' }]] },
];

const RUNNING: SessionTemplate[] = [
  { key: 'RN1', title: 'Strength A', slots: [['squat', 3, 0, HEAVY], ['hinge', 3, 0, { reps: [4, 6] }], ['reactive', 3, 0, { reps: [10, 15] }], ['calf', 3, 0, { reps: [6, 10], note: 'Heavy' }], ['antiRot', 2]] },
  { key: 'RN2', title: 'Easy run', slots: [['easyRun', 1, 0, { minutes: 30, note: 'Easy pace' }]] },
  { key: 'RN3', title: 'Intervals', slots: [['longIntervals', 5, 0, { workSec: 180, restSec: 120, note: '5 km race pace' }]] },
  { key: 'RN4', title: 'Strength B', slots: [['lunge', 3, 0, { reps: [5, 8] }], ['hipThrust', 3, 0, HEAVY], ['jumpVert', 3, 0, { reps: [3, 5] }], ['nordic', 2, 0, { reps: [4, 6] }], ['calf', 3, 1, { reps: [8, 12] }]] },
  { key: 'RN5', title: 'Long run', slots: [['easyRun', 1, 0, { minutes: 50, note: 'Easy pace' }]] },
];

const ATHLETIC: SessionTemplate[] = [
  { key: 'AT1', title: 'Athletic A', slots: [['jumpVert', 3, 0, { reps: [3, 5] }], ['squat', 3, 0, { reps: [5, 8] }], ['pullup', 3], ['carry', 3, 0, { reps: [30, 40], note: 'Metres per set' }], ['antiRot', 2], ['circuit', 4, 0, { workSec: 40, restSec: 20, note: 'Swings, burpees, rope' }]] },
  { key: 'AT2', title: 'Athletic B', slots: [['rotPower', 3, 0, { reps: [4, 6] }], ['slHinge', 3, 0, { reps: [6, 8] }], ['landminePress', 3, 0, { reps: [6, 8] }], ['row', 3, 0, { reps: [8, 10] }], ['tgu', 2, 0, { reps: [2, 3] }], ['sled', 4, 0, { reps: [15, 20], note: 'Metres per push' }]] },
  { key: 'AT3', title: 'Athletic C', slots: [['jumpHoriz', 3, 0, { reps: [3, 5] }], ['swing', 3, 0, { reps: [10, 12] }], ['lunge', 3, 0, { reps: [8, 10] }], ['pushup', 3], ['nordic', 2, 0, { reps: [4, 6] }], ['rsa', 6, 1, { workSec: 15, restSec: 45 }]] },
];

export const PROGRAMS: Program[] = [
  {
    id: 'kickstart', name: 'Kickstart', tagline: '2 weeks · 3 days · full body', category: 'physique',
    description: 'Learn the lifts and build the habit.',
    goal: ['cut', 'recomp', 'build'], level: 'all', daysPerWeek: 3, minWeeks: 2, maxWeeks: 2, defaultWeeks: 2, sessions: FULL_BODY, condensed: FULL_BODY_2,
  },
  {
    id: 'foundation', name: 'Foundation', tagline: 'Full body · 3 days', category: 'physique',
    description: 'Best start for newer lifters.',
    goal: ['recomp', 'build'], level: 'novice', daysPerWeek: 3, minWeeks: 4, maxWeeks: 12, defaultWeeks: 8, sessions: FULL_BODY, condensed: FULL_BODY_2,
  },
  {
    id: 'upper-lower', name: 'Hypertrophy — Upper / Lower', tagline: 'Upper/lower · 4 days', category: 'physique',
    description: 'The classic muscle-building split.',
    goal: ['recomp', 'build'], level: 'intermediate', daysPerWeek: 4, minWeeks: 4, maxWeeks: 12, defaultWeeks: 8, sessions: UPPER_LOWER, condensed: FULL_BODY,
  },
  {
    id: 'ppl', name: 'Hypertrophy — Push / Pull / Legs', tagline: 'PPL · 6 days', category: 'physique',
    description: 'Highest volume, for trained lifters.',
    goal: ['build'], level: 'intermediate', daysPerWeek: 6, minWeeks: 6, maxWeeks: 12, defaultWeeks: 12, sessions: PPL, condensed: UPPER_LOWER,
  },
  {
    id: 'lean-out', name: 'Lean Out', tagline: 'Upper/lower · 4 days + cardio', category: 'physique',
    description: 'Keep the muscle while the fat comes off.',
    goal: ['cut'], level: 'all', daysPerWeek: 4, minWeeks: 4, maxWeeks: 12, defaultWeeks: 8, sessions: UPPER_LOWER, condensed: FULL_BODY, cut: true, cardioPerWeek: 2,
  },
  {
    id: 'boxing', name: 'Boxing S&C', tagline: 'Sport · 3 days alongside boxing', category: 'sport',
    description: 'Leg power, rotation and fight-pace rounds.',
    goal: ['cut', 'recomp', 'build'], level: 'all', daysPerWeek: 3, minWeeks: 4, maxWeeks: 12, defaultWeeks: 8, sessions: BOXING, condensed: BOXING.slice(0, 2),
    notes: ['Keep leg days away from hard sparring.'],
  },
  {
    id: 'football', name: 'Football (soccer) S&C', tagline: 'Sport · 3 days alongside football', category: 'sport',
    description: 'Speed, power and injury-proofing.',
    goal: ['cut', 'recomp', 'build'], level: 'all', daysPerWeek: 3, minWeeks: 4, maxWeeks: 12, defaultWeeks: 8, sessions: FOOTBALL, condensed: FOOTBALL.slice(0, 2),
    notes: ['Do the FIFA 11+ warm-up before team training.'],
  },
  {
    id: 'swimming', name: 'Swimming dryland', tagline: 'Sport · 3 days alongside swimming', category: 'sport',
    description: 'Pulling strength, power and healthy shoulders.',
    goal: ['cut', 'recomp', 'build'], level: 'all', daysPerWeek: 3, minWeeks: 4, maxWeeks: 12, defaultWeeks: 8, sessions: SWIM, condensed: SWIM.slice(0, 2),
    notes: ['Shoulder work: light band, high reps.'],
  },
  {
    id: 'running', name: 'Runner strength', tagline: 'Sport · 2 strength + 3 runs', category: 'sport',
    description: 'Run more efficiently with heavy strength work.',
    goal: ['cut', 'recomp', 'build'], level: 'all', daysPerWeek: 5, minWeeks: 6, maxWeeks: 12, defaultWeeks: 10, sessions: RUNNING, condensed: [RUNNING[0], RUNNING[2], RUNNING[4]],
    notes: ['Keep strength and interval days apart.'],
  },
  {
    id: 'athletic', name: 'Athletic & functional', tagline: 'Function · 3 days', category: 'sport',
    description: 'Strong, fast and robust all round.',
    goal: ['cut', 'recomp', 'build'], level: 'all', daysPerWeek: 3, minWeeks: 4, maxWeeks: 12, defaultWeeks: 8, sessions: ATHLETIC, condensed: ATHLETIC.slice(0, 2),
  },
];

export const programById = (id: string) => PROGRAMS.find((p) => p.id === id);

// ── Week structure ─────────────────────────────────────────────

export interface WeekInfo {
  week: number; // 1-based position in the structure
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
  if (kind === 'power') return 3; // explosive work stays far from failure
  if (kind === 'prehab') return 2;
  const base = w.accWeeks <= 1 ? 2 : Math.round(3 - (2 * w.k) / (w.accWeeks - 1));
  const last = w.k === w.accWeeks - 1;
  if (kind === 'isolation' && last && !cut) return Math.max(0, base - 1);
  return Math.max(cut ? 1 : kind === 'compound' ? 1 : 0, base);
}

function setsFor(base: number, w: WeekInfo, kind: SlotKind, cut: boolean): number {
  const b = cut && kind === 'isolation' ? Math.max(2, base - 1) : base;
  if (w.phase === 'deload') return Math.max(1, Math.round(b * 0.5));
  if (kind === 'power') return Math.min(5, b + (w.k >= 1 ? 1 : 0));
  if (kind === 'prehab') return Math.min(4, b + (w.k >= 2 ? 1 : 0));
  // volume climbs through the block: +1 set from week 2, isolations +1 more from week 4
  const add = (w.k >= 1 ? 1 : 0) + (kind === 'isolation' && w.k >= 3 ? 1 : 0);
  return Math.min(5, b + add);
}

const REST: Record<SlotKind, number> = { compound: 150, isolation: 90, power: 120, prehab: 60, conditioning: 60, cardio: 0 };

const EXERCISE_NAME = new Map(SEED_EXERCISES.map((e) => [e.id, e.name]));

/**
 * Variant choice: main lifts stay the same for a whole mesocycle, then change;
 * accessories change every two weeks — planned, moderate variation.
 */
export function variantFor(slotKey: SlotKey, offset: number, w: WeekInfo): string {
  const def: SlotDef = SLOTS[slotKey];
  const step = def.kind === 'compound' || def.kind === 'power' ? w.meso : w.meso * 2 + Math.floor(w.k / 2);
  return def.pool[(offset + step) % def.pool.length];
}

function buildExercise([key, base, offset = 0, opts = {}]: SlotUse, w: WeekInfo, program: Program, focus: (typeof FOCUSES)[number] | null): PlannedExercise {
  const def: SlotDef = SLOTS[key];
  const id = variantFor(key, offset, w);
  const common = { exerciseId: id, name: EXERCISE_NAME.get(id) ?? id, kind: def.kind, note: opts.note };
  const deload = w.phase === 'deload';

  if (def.kind === 'conditioning') {
    const work = opts.workSec ?? 60;
    const rest = opts.restSec ?? 60;
    const rounds = deload ? Math.max(2, Math.round(base * 0.6)) : base + Math.min(w.k, 3);
    return { ...common, sets: rounds, rounds, workSec: work, repsMin: 0, repsMax: 0, rir: 0, restSec: rest, minutes: Math.round((rounds * (work + rest)) / 60) };
  }
  if (def.kind === 'cardio') {
    const baseMin = opts.minutes ?? 30;
    const minutes = deload ? Math.round(baseMin * 0.7) : Math.min(baseMin + 15, baseMin + 5 * w.k + 5 * w.meso);
    return { ...common, sets: 1, repsMin: 0, repsMax: 0, rir: 0, restSec: 0, minutes };
  }

  let reps: readonly number[];
  if (opts.reps) reps = deload && (def.kind === 'compound' || def.kind === 'isolation') ? [opts.reps[0] + 2, opts.reps[1] + 2] : opts.reps;
  else if (def.kind === 'power') reps = [3, 5];
  else if (def.kind === 'prehab') reps = [8, 12];
  else if (focus) {
    const range = def.kind === 'compound' ? focus.compound : focus.isolation;
    // in a cut keep compounds on the heavier side to protect strength and muscle
    reps = program.cut && def.kind === 'compound' && focus.name === 'Light' ? [8, 12] : range;
  } else reps = def.kind === 'compound' ? [8, 10] : [12, 15];

  return {
    ...common,
    sets: setsFor(base, w, def.kind, !!program.cut),
    repsMin: reps[0],
    repsMax: reps[1],
    rir: rirFor(w, def.kind, !!program.cut),
    restSec: REST[def.kind],
  };
}

export function buildSession(t: SessionTemplate, w: WeekInfo, program: Program): { focus: string; exercises: PlannedExercise[] } {
  const focus = w.phase === 'deload' ? null : FOCUSES[w.accIndex % FOCUSES.length];
  return { focus: w.phase === 'deload' ? 'Lighter week' : focus!.name, exercises: t.slots.map((u) => buildExercise(u, w, program, focus)) };
}

function cutCardio(stepIdx: number, structureLen: number, deload: boolean, i: number): PlannedExercise {
  // easy, low-impact cardio (cycling / incline walking interfere least with lifting — Wilson 2012),
  // growing from 25 to 40 minutes over the program
  const minutes = Math.min(40, 25 + Math.floor(((stepIdx / Math.max(1, structureLen - 1)) * 15) / 5) * 5);
  const id = SLOTS.cardio.pool[i % 2];
  return {
    exerciseId: id, name: EXERCISE_NAME.get(id) ?? id, kind: 'cardio', sets: 1, repsMin: 0, repsMax: 0, rir: 0, restSec: 0,
    minutes: deload ? Math.round(minutes * 0.6) : minutes,
    note: 'Easy pace',
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

/** Monday-first ordering of weekdays */
const mondayFirst = (days: number[]) => [...new Set(days)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));

export const planWeekStart = (plan: Pick<ActivePlan, 'startDate'>, week: number) => addDays(plan.startDate, (week - 1) * 7);

// ── Week choices ───────────────────────────────────────────────

export function defaultChoices(structureWeeks: number): WeekChoice[] {
  return weekStructure(structureWeeks).map((_, i) => ({ week: i + 1, step: i, variant: 'standard' as WeekVariant, by: 'plan' as const }));
}

export function planChoices(plan: ActivePlan): WeekChoice[] {
  return plan.choices ?? defaultChoices(plan.structureWeeks ?? plan.weeks);
}

/** After a choice for week N, later weeks continue the progression from there. */
export function continueChoices(choices: WeekChoice[], structureWeeks: number): WeekChoice[] {
  const out = [...choices];
  let last = out[out.length - 1];
  while (last && last.step + 1 < structureWeeks) {
    last = { week: last.week + 1, step: last.step + 1, variant: 'standard', by: 'plan' };
    out.push(last);
  }
  return out;
}

export interface WeekOption {
  id: WeekVariant;
  title: string;
  description: string;
  choice: WeekChoice;
  sessions: number;
  hardSets: number;
  minutes: number;
}

function weekContent(choice: WeekChoice, structure: WeekInfo[]): WeekInfo {
  const w = structure[Math.min(choice.step, structure.length - 1)];
  return choice.variant === 'lighter' ? { ...w, phase: 'deload' } : w;
}

/** Build one plan week's sessions — pure function of (program, plan, choice). */
export function buildWeek(program: Program, plan: Pick<ActivePlan, 'id' | 'startDate' | 'trainingDays' | 'structureWeeks' | 'weeks'>, choice: WeekChoice): PlannedSession[] {
  const structure = weekStructure(plan.structureWeeks ?? plan.weeks);
  const w = weekContent(choice, structure);
  const templates = choice.variant === 'condensed' && program.condensed ? program.condensed : program.sessions;
  const days = mondayFirst(plan.trainingDays).slice(0, choice.variant === 'condensed' ? templates.length : undefined);
  const start = planWeekStart(plan, choice.week);
  const sessions: PlannedSession[] = [];
  let t = 0;
  let cardioDone = 0;
  for (let d = 0; d < 7 && t < templates.length; d++) {
    const date = addDays(start, d);
    if (!days.includes(weekday(date))) continue;
    const template = templates[t];
    const built = buildSession(template, w, program);
    if (program.cardioPerWeek && cardioDone < program.cardioPerWeek && template.key.startsWith('U')) {
      built.exercises.push(cutCardio(choice.step, structure.length, w.phase === 'deload', cardioDone));
      cardioDone++;
    }
    const order = choice.week * 100 + t;
    sessions.push({
      id: `${plan.id}-w${choice.week}-${template.key}-${order}`,
      planId: plan.id,
      date,
      week: choice.week,
      order,
      phase: w.phase,
      focus: built.focus,
      title: `${template.title} — ${built.focus}`,
      exercises: built.exercises,
      status: 'planned',
    });
    t++;
  }
  return sessions;
}

export function hardSets(sessions: Pick<PlannedSession, 'exercises'>[]): number {
  return sessions.reduce((n, s) => n + s.exercises.filter((e) => e.kind === 'compound' || e.kind === 'isolation' || e.kind === 'power').reduce((m, e) => m + e.sets, 0), 0);
}

/** The pre-designed options for a plan week, given what ran the week before. */
export function weekOptions(program: Program, plan: ActivePlan, week: number): WeekOption[] {
  const structureWeeks = plan.structureWeeks ?? plan.weeks;
  const structure = weekStructure(structureWeeks);
  const choices = planChoices(plan);
  const prevStep = week > 1 ? choices.find((c) => c.week === week - 1)?.step ?? week - 2 : -1;
  const next = prevStep + 1;
  if (next >= structure.length) return [];
  const opts: { id: WeekVariant; title: string; description: string; choice: WeekChoice }[] = [];
  const mk = (variant: WeekVariant, step: number): WeekChoice => ({ week, step, variant, by: 'plan' });
  const nextInfo = structure[next];

  opts.push({
    id: 'standard',
    title: nextInfo.phase === 'deload' ? 'Lighter week, as planned' : `Progress as planned — ${FOCUSES[nextInfo.accIndex % 3].name.toLowerCase()} week`,
    description: nextInfo.phase === 'deload' ? 'The scheduled lighter week: about half the sets, plenty in reserve.' : 'The next step of the program: a little more volume and effort than last week.',
    choice: mk('standard', next),
  });
  if (prevStep >= 0 && structure[prevStep].phase === 'accumulation') {
    opts.push({ id: 'repeat', title: 'Repeat last week', description: 'Same loading again — consolidate before progressing (after missed sessions or a stall).', choice: mk('repeat', prevStep) });
  }
  if (nextInfo.phase !== 'deload' && prevStep >= 0) {
    opts.push({ id: 'lighter', title: 'Lighter week now', description: 'Pull a lighter week forward when fatigue builds or performance drops. Progression resumes after.', choice: mk('lighter', prevStep) });
  }
  if (nextInfo.phase === 'deload' && next + 1 < structure.length) {
    opts.push({ id: 'skip-deload', title: 'Skip the lighter week', description: 'Go straight into the next block when recovery is good and performance is climbing.', choice: mk('skip-deload', next + 1) });
  }
  if (program.condensed) {
    opts.push({ id: 'condensed', title: `Condensed week — ${program.condensed.length} days`, description: `Same progression in ${program.condensed.length} longer sessions, for a busy week.`, choice: mk('condensed', next) });
  }
  return opts.map((o) => {
    const sessions = buildWeek(program, plan, o.choice);
    return { ...o, sessions: sessions.length, hardSets: hardSets(sessions), minutes: sessions.reduce((n, s) => n + estimateMinutes(s), 0) };
  });
}

/** Apply a choice for one week; later weeks are regenerated as a continuation. */
export function rebuildFrom(program: Program, plan: ActivePlan, choice: WeekChoice): { plan: ActivePlan; sessions: PlannedSession[] } {
  const structureWeeks = plan.structureWeeks ?? plan.weeks;
  const kept = planChoices(plan).filter((c) => c.week < choice.week);
  const choices = continueChoices([...kept, choice], structureWeeks);
  const next: ActivePlan = { ...plan, structureWeeks, choices, weeks: choices.length };
  const sessions = choices.filter((c) => c.week >= choice.week).flatMap((c) => buildWeek(program, next, c));
  const lastDate = sessions.length ? sessions[sessions.length - 1].date : plan.endDate;
  return { plan: { ...next, endDate: lastDate }, sessions };
}

export interface GeneratedPlan {
  plan: ActivePlan;
  sessions: PlannedSession[];
}

export function generatePlan(program: Program, opts: { weeks: number; startDate: string; trainingDays: number[]; id: string; now?: string }): GeneratedPlan {
  const weeks = Math.min(program.maxWeeks, Math.max(program.minWeeks, opts.weeks));
  const base: ActivePlan = {
    id: opts.id,
    programId: program.id,
    name: program.name,
    weeks,
    structureWeeks: weeks,
    startDate: opts.startDate,
    endDate: opts.startDate,
    trainingDays: mondayFirst(opts.trainingDays),
    createdAt: opts.now ?? new Date().toISOString(),
    choices: defaultChoices(weeks),
  };
  const sessions = base.choices!.flatMap((c) => buildWeek(program, base, c));
  return { plan: { ...base, endDate: sessions.length ? sessions[sessions.length - 1].date : opts.startDate }, sessions };
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
      if (e.kind !== 'compound' && e.kind !== 'isolation') continue;
      const def = slotOf.get(e.exerciseId);
      if (!def) continue;
      def.primary.forEach((m) => (out[m] += e.sets));
      def.secondary?.forEach((m) => (out[m] += e.sets / 2));
    }
  return out;
}

export function estimateMinutes(s: Pick<PlannedSession, 'exercises'>): number {
  let sec = 0;
  for (const e of s.exercises) {
    if (e.kind === 'cardio' || e.kind === 'conditioning') sec += (e.minutes ?? 0) * 60;
    else if (e.kind === 'power') sec += e.sets * (e.restSec + 20);
    else sec += e.sets * (e.restSec + 45);
  }
  return Math.round(sec / 60 / 5) * 5;
}

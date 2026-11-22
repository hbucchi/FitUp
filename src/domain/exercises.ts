import type { Exercise } from './types';

/**
 * Seed exercise library.
 * MET values are taken from the Compendium of Physical Activities (Ainsworth et al.)
 * for a moderate effort; the training log scales them with the chosen intensity.
 */
const aerobic = (id: string, name: string, group: string, met: number, distance = false, equipment?: string): Exercise => ({
  id: `ex:${id}`, name, kind: 'aerobic', group, met, distance, equipment,
});
const strength = (id: string, name: string, group: string, equipment: string, met = 5.0): Exercise => ({
  id: `ex:${id}`, name, kind: 'strength', group, met, equipment,
});

export const SEED_EXERCISES: Exercise[] = [
  // ── Aerobic ───────────────────────────────────────────
  aerobic('walk', 'Walking', 'Walking & running', 3.5, true),
  aerobic('walk-brisk', 'Brisk walking', 'Walking & running', 5.0, true),
  aerobic('walk-incline', 'Incline treadmill walk', 'Walking & running', 6.0, true, 'Treadmill'),
  aerobic('hike', 'Hiking', 'Walking & running', 6.0, true),
  aerobic('run-easy', 'Running — easy pace', 'Walking & running', 8.3, true),
  aerobic('run', 'Running — steady pace', 'Walking & running', 9.8, true),
  aerobic('run-tempo', 'Running — tempo', 'Walking & running', 11.8, true),
  aerobic('sprints', 'Sprint intervals', 'Walking & running', 14.5, true),
  aerobic('cycle', 'Cycling — outdoor', 'Cycling', 8.0, true, 'Bike'),
  aerobic('cycle-stationary', 'Stationary bike', 'Cycling', 7.0, true, 'Stationary bike'),
  aerobic('spin', 'Spin class', 'Cycling', 8.5, false, 'Stationary bike'),
  aerobic('row', 'Rowing machine', 'Machines', 7.0, true, 'Rower'),
  aerobic('elliptical', 'Elliptical', 'Machines', 5.0, false, 'Elliptical'),
  aerobic('stairs', 'Stair climber', 'Machines', 9.0, false, 'Stair climber'),
  aerobic('swim', 'Swimming — freestyle', 'Water', 6.0, true),
  aerobic('swim-breast', 'Swimming — breaststroke', 'Water', 5.3, true),
  aerobic('rope', 'Jump rope', 'Conditioning', 11.8, false, 'Rope'),
  aerobic('hiit', 'HIIT circuit', 'Conditioning', 8.0),
  aerobic('boxing', 'Boxing — bag work', 'Combat', 5.5, false, 'Heavy bag'),
  aerobic('sparring', 'Boxing / martial arts sparring', 'Combat', 7.8),
  aerobic('football', 'Football (soccer)', 'Sports', 7.0),
  aerobic('basketball', 'Basketball', 'Sports', 6.5),
  aerobic('tennis', 'Tennis — singles', 'Sports', 8.0),
  aerobic('dance', 'Dance / aerobics class', 'Classes', 7.3),
  aerobic('yoga', 'Yoga', 'Mobility', 2.5),
  aerobic('pilates', 'Pilates', 'Mobility', 3.0),

  // ── Strength ──────────────────────────────────────────
  strength('bench', 'Barbell bench press', 'Chest', 'Barbell'),
  strength('incline-db', 'Incline dumbbell press', 'Chest', 'Dumbbells'),
  strength('db-fly', 'Dumbbell fly', 'Chest', 'Dumbbells', 3.5),
  strength('cable-cross', 'Cable crossover', 'Chest', 'Cable', 3.5),
  strength('pushup', 'Push-up', 'Chest', 'Bodyweight', 3.8),
  strength('dip', 'Dip', 'Chest', 'Bodyweight'),

  strength('deadlift', 'Deadlift', 'Back', 'Barbell', 6.0),
  strength('pullup', 'Pull-up', 'Back', 'Bodyweight'),
  strength('chinup', 'Chin-up', 'Back', 'Bodyweight'),
  strength('row-bb', 'Barbell row', 'Back', 'Barbell'),
  strength('row-db', 'Single-arm dumbbell row', 'Back', 'Dumbbells'),
  strength('lat-pulldown', 'Lat pulldown', 'Back', 'Cable', 3.5),
  strength('cable-row', 'Seated cable row', 'Back', 'Cable', 3.5),

  strength('squat', 'Back squat', 'Legs', 'Barbell', 6.0),
  strength('front-squat', 'Front squat', 'Legs', 'Barbell', 6.0),
  strength('rdl', 'Romanian deadlift', 'Legs', 'Barbell'),
  strength('leg-press', 'Leg press', 'Legs', 'Machine'),
  strength('split-squat', 'Bulgarian split squat', 'Legs', 'Dumbbells'),
  strength('lunge', 'Walking lunge', 'Legs', 'Dumbbells'),
  strength('hip-thrust', 'Hip thrust', 'Legs', 'Barbell'),
  strength('leg-ext', 'Leg extension', 'Legs', 'Machine', 3.5),
  strength('leg-curl', 'Leg curl', 'Legs', 'Machine', 3.5),
  strength('calf', 'Standing calf raise', 'Legs', 'Machine', 3.5),

  strength('ohp', 'Overhead press', 'Shoulders', 'Barbell'),
  strength('db-press', 'Seated dumbbell press', 'Shoulders', 'Dumbbells'),
  strength('lateral', 'Lateral raise', 'Shoulders', 'Dumbbells', 3.5),
  strength('rear-delt', 'Rear delt fly', 'Shoulders', 'Dumbbells', 3.5),
  strength('face-pull', 'Face pull', 'Shoulders', 'Cable', 3.5),

  strength('curl-bb', 'Barbell curl', 'Arms', 'Barbell', 3.5),
  strength('curl-hammer', 'Hammer curl', 'Arms', 'Dumbbells', 3.5),
  strength('pushdown', 'Triceps pushdown', 'Arms', 'Cable', 3.5),
  strength('skullcrusher', 'Skull crusher', 'Arms', 'EZ bar', 3.5),
  strength('cgbp', 'Close-grip bench press', 'Arms', 'Barbell'),

  strength('plank', 'Plank (reps = seconds)', 'Core', 'Bodyweight', 3.8),
  strength('hlr', 'Hanging leg raise', 'Core', 'Bodyweight', 3.8),
  strength('cable-crunch', 'Cable crunch', 'Core', 'Cable', 3.5),
  strength('ab-wheel', 'Ab wheel rollout', 'Core', 'Ab wheel', 3.8),

  strength('kb-swing', 'Kettlebell swing', 'Full body', 'Kettlebell', 9.8),
  strength('clean', 'Power clean', 'Full body', 'Barbell', 6.0),
  strength('farmer', "Farmer's carry", 'Full body', 'Dumbbells', 6.0),
  strength('burpee', 'Burpee', 'Full body', 'Bodyweight', 8.0),

  // ── Variants used by the periodised programs ─────────────
  strength('db-bench', 'Dumbbell bench press', 'Chest', 'Dumbbells'),
  strength('machine-press', 'Machine chest press', 'Chest', 'Machine'),
  strength('incline-bb', 'Incline barbell press', 'Chest', 'Barbell'),
  strength('incline-machine', 'Incline machine press', 'Chest', 'Machine'),
  strength('pec-deck', 'Pec deck', 'Chest', 'Machine', 3.5),
  strength('neutral-pulldown', 'Neutral-grip lat pulldown', 'Back', 'Cable', 3.5),
  strength('chest-row', 'Chest-supported row', 'Back', 'Machine'),
  strength('hack-squat', 'Hack squat', 'Legs', 'Machine', 6.0),
  strength('db-rdl', 'Dumbbell Romanian deadlift', 'Legs', 'Dumbbells'),
  strength('leg-curl-seated', 'Seated leg curl', 'Legs', 'Machine', 3.5),
  strength('reverse-lunge', 'Reverse lunge', 'Legs', 'Dumbbells'),
  strength('calf-seated', 'Seated calf raise', 'Legs', 'Machine', 3.5),
  strength('calf-legpress', 'Leg press calf raise', 'Legs', 'Machine', 3.5),
  strength('machine-shoulder', 'Machine shoulder press', 'Shoulders', 'Machine'),
  strength('cable-lateral', 'Cable lateral raise', 'Shoulders', 'Cable', 3.5),
  strength('machine-lateral', 'Machine lateral raise', 'Shoulders', 'Machine', 3.5),
  strength('reverse-pec-deck', 'Reverse pec deck', 'Shoulders', 'Machine', 3.5),
  strength('incline-curl', 'Incline dumbbell curl', 'Arms', 'Dumbbells', 3.5),
  strength('preacher-curl', 'Preacher curl', 'Arms', 'EZ bar', 3.5),
  strength('cable-curl', 'Cable curl', 'Arms', 'Cable', 3.5),
  strength('overhead-ext', 'Overhead cable triceps extension', 'Arms', 'Cable', 3.5),

  // ── Functional & sport-specific ───────────────────────────
  strength('box-jump', 'Box jump', 'Power', 'Box', 8.0),
  strength('broad-jump', 'Broad jump', 'Power', 'Bodyweight', 8.0),
  strength('squat-jump', 'Squat jump', 'Power', 'Bodyweight', 8.0),
  strength('jump-squat-loaded', 'Loaded jump squat (light bar)', 'Power', 'Barbell', 8.0),
  strength('pogo', 'Pogo hops', 'Power', 'Bodyweight', 8.0),
  strength('lateral-bound', 'Lateral bound', 'Power', 'Bodyweight', 8.0),
  strength('mb-rot-throw', 'Medicine ball rotational throw', 'Power', 'Medicine ball', 6.0),
  strength('mb-slam', 'Medicine ball slam', 'Power', 'Medicine ball', 6.0),
  strength('push-press', 'Push press', 'Power', 'Barbell', 6.0),
  strength('nordic', 'Nordic hamstring curl', 'Robustness', 'Bodyweight', 3.5),
  strength('copenhagen', 'Copenhagen adductor plank (reps = seconds)', 'Robustness', 'Bench', 3.5),
  strength('sl-rdl', 'Single-leg Romanian deadlift', 'Legs', 'Dumbbells', 5.0),
  strength('pallof', 'Pallof press', 'Core', 'Cable', 3.5),
  strength('dead-bug', 'Dead bug', 'Core', 'Bodyweight', 3.0),
  strength('landmine-rot', 'Landmine rotation', 'Core', 'Barbell', 5.0),
  strength('landmine-press', 'Landmine press', 'Shoulders', 'Barbell', 5.0),
  strength('ext-rotation', 'Band external rotation', 'Robustness', 'Band', 3.0),
  strength('ytw', 'Prone Y-T-W raise', 'Robustness', 'Dumbbells', 3.0),
  strength('band-pull-apart', 'Band pull-apart', 'Robustness', 'Band', 3.0),
  strength('neck', 'Neck flexion & extension', 'Robustness', 'Plate or band', 3.0),
  strength('straight-arm-pulldown', 'Straight-arm pulldown', 'Back', 'Cable', 3.5),
  strength('sled-push', 'Sled push (reps = metres)', 'Full body', 'Sled', 8.0),
  strength('tgu', 'Turkish get-up', 'Full body', 'Kettlebell', 5.0),
  aerobic('shadowbox', 'Shadowboxing', 'Combat', 5.5),
  aerobic('shuttle', 'Shuttle runs / change of direction', 'Conditioning', 8.0),
  aerobic('interval-run', 'Interval run', 'Walking & running', 11.0),
  aerobic('circuit', 'Functional circuit', 'Conditioning', 8.0),
];

export const INTENSITY = {
  light: { label: 'Light', factor: 0.75 },
  moderate: { label: 'Moderate', factor: 1 },
  vigorous: { label: 'Vigorous', factor: 1.3 },
} as const;
export type Intensity = keyof typeof INTENSITY;

/** Rough working time per strength set, including rest. */
export const MINUTES_PER_SET = 2.5;

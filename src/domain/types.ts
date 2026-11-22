import type { Nutrients } from './nutrients';

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete';
export type Goal = 'cut' | 'recomp' | 'build';

export interface Profile {
  name: string;
  sex: Sex;
  birthYear: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct: number;
  activity: ActivityLevel;
  goal: Goal;
  createdAt: string;
}

/** Weigh-ins over time, so we can chart the path later. */
export interface BodyLog {
  date: string; // YYYY-MM-DD
  weightKg: number;
  bodyFatPct?: number;
}

export interface Portion {
  /** e.g. "cup, chopped", "large", "slice" */
  label: string;
  /** grams for ONE of this portion */
  grams: number;
}

export interface Food {
  id: string;
  name: string;
  category: string;
  source: string; // "USDA Foundation" | "USDA SR Legacy" | "Custom"
  brand?: string;
  /** per 100 g */
  nutrients: Nutrients;
  portions: Portion[];
}

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack', 'pre-workout', 'post-workout'] as const;
export type Meal = (typeof MEALS)[number];

export const MEAL_LABEL: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snacks',
  'pre-workout': 'Pre-workout',
  'post-workout': 'Post-workout',
};

export interface FoodEntry {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM
  meal: Meal;
  foodId: string;
  /** Snapshot so the diary survives catalog changes. */
  foodName: string;
  quantity: number;
  /** "g" or a Portion label */
  unit: string;
  grams: number;
  nutrients: Nutrients; // already scaled to `grams`
  via?: 'manual' | 'voice' | 'agent';
}

export type ExerciseKind = 'aerobic' | 'strength';

export interface Exercise {
  id: string;
  name: string;
  kind: ExerciseKind;
  /** aerobic: modality, strength: primary muscle group */
  group: string;
  equipment?: string;
  /** Metabolic equivalent (Compendium of Physical Activities). */
  met: number;
  /** Whether distance is a meaningful metric. */
  distance?: boolean;
  custom?: boolean;
}

export interface StrengthSet {
  reps: number;
  weightKg: number;
}

export interface TrainingEntry {
  id: string;
  date: string;
  time?: string;
  exerciseId: string;
  exerciseName: string;
  kind: ExerciseKind;
  durationMin: number;
  distanceKm?: number;
  sets?: StrengthSet[];
  kcal: number;
  /** energy above resting (what extra activity adds to the food budget) */
  netKcal?: number;
  notes?: string;
  /** set when this was logged as part of a planned session */
  planSessionId?: string;
}

// ── Objective & levels ─────────────────────────────────────────
export type Experience = 'novice' | 'intermediate' | 'advanced';

export interface BodySnapshot {
  date: string;
  weightKg: number;
  bodyFatPct: number;
  leanKg: number;
  fatKg: number;
}

export interface Objective {
  createdAt: string;
  experience: Experience;
  start: BodySnapshot;
  target: { bodyFatPct: number; ffmiNorm: number; leanKg: number; fatKg: number; weightKg: number };
  targetDate?: string;
  /** highest level index the user has already been shown (for level-up moments) */
  levelSeen: number;
}

// ── Training plans ─────────────────────────────────────────────
/**
 * compound/isolation — hypertrophy & strength work
 * power        — jumps, throws, explosive lifts: low reps, full recovery, maximal intent
 * prehab       — robustness / injury-prevention work (Nordics, Copenhagen, rotator cuff, core)
 * conditioning — intervals: rounds × work/rest
 * cardio       — continuous aerobic work in minutes
 */
export type SlotKind = 'compound' | 'isolation' | 'power' | 'prehab' | 'conditioning' | 'cardio';

export interface PlannedExercise {
  exerciseId: string;
  name: string;
  kind: SlotKind;
  sets: number;
  repsMin: number;
  repsMax: number;
  /** repetitions in reserve on the last set */
  rir: number;
  restSec: number;
  /** cardio / conditioning: total minutes */
  minutes?: number;
  /** conditioning: rounds of work/rest */
  rounds?: number;
  workSec?: number;
  note?: string;
}

export type SessionStatus = 'planned' | 'done' | 'skipped';

export interface PlannedSession {
  id: string;
  planId: string;
  date: string;
  /** 1-based week of the plan */
  week: number;
  /** order within the plan (stable, used to keep sequence when rescheduling) */
  order: number;
  phase: 'accumulation' | 'deload';
  focus: string;
  title: string;
  exercises: PlannedExercise[];
  status: SessionStatus;
  originalDate?: string;
  note?: string;
  completedAt?: string;
}

/** Which pre-designed week runs in a given plan week. The content is deterministic; only the choice varies. */
export type WeekVariant = 'standard' | 'repeat' | 'lighter' | 'condensed' | 'skip-deload';

export interface WeekChoice {
  week: number;
  /** index into the program's week structure whose loading this week uses */
  step: number;
  variant: WeekVariant;
  by: 'plan' | 'rules' | 'assistant' | 'you';
  reason?: string;
}

export interface ActivePlan {
  id: string;
  programId: string;
  name: string;
  weeks: number;
  startDate: string;
  endDate: string;
  /** 0 = Sunday … 6 = Saturday */
  trainingDays: number[];
  createdAt: string;
  /** length of the program's progression (the week structure); `weeks` can grow with repeats */
  structureWeeks?: number;
  choices?: WeekChoice[];
}

// ── Nutrition plan ─────────────────────────────────────────────
export interface MacroDay {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionPlan {
  createdAt: string;
  updatedAt: string;
  phase: Goal;
  /** target body-weight change, % per week (negative = loss) */
  targetRatePct: number;
  training: MacroDay;
  rest: MacroDay;
  fiber: number;
  mealsPerDay: number;
  /** grams of protein per meal */
  proteinPerMeal: number;
}

export interface PlanReview {
  id: string;
  date: string;
  by: 'rules' | 'assistant';
  summary: string;
  changes: string[];
}

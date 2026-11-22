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
  via?: 'manual' | 'voice';
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
  notes?: string;
}

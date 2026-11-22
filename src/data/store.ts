import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BodyLog, Exercise, Food, FoodEntry, Profile, TrainingEntry } from '../domain/types';

/**
 * Local-first app state. Persisted to localStorage for the MVP; the same shape
 * maps 1:1 onto Firestore collections (users/{uid}/foodEntries, …) for the online version.
 */
export interface AppState {
  profile?: Profile;
  bodyLog: BodyLog[];
  customFoods: Food[];
  customExercises: Exercise[];
  foodEntries: FoodEntry[];
  trainingEntries: TrainingEntry[];
  recentFoodIds: string[];

  setProfile: (p: Profile) => void;
  logBody: (b: BodyLog) => void;
  saveCustomFood: (f: Food) => void;
  deleteCustomFood: (id: string) => void;
  addFoodEntries: (e: FoodEntry[]) => void;
  updateFoodEntry: (e: FoodEntry) => void;
  removeFoodEntry: (id: string) => void;
  addTraining: (t: TrainingEntry) => void;
  updateTraining: (t: TrainingEntry) => void;
  removeTraining: (id: string) => void;
  saveCustomExercise: (e: Exercise) => void;
  resetAll: () => void;
}

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

const empty = {
  profile: undefined,
  bodyLog: [],
  customFoods: [],
  customExercises: [],
  foodEntries: [],
  trainingEntries: [],
  recentFoodIds: [],
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      ...empty,
      setProfile: (profile) => set({ profile }),
      logBody: (b) =>
        set((s) => ({
          bodyLog: [...s.bodyLog.filter((x) => x.date !== b.date), b].sort((a, z) => a.date.localeCompare(z.date)),
          profile: s.profile
            ? { ...s.profile, weightKg: b.weightKg, bodyFatPct: b.bodyFatPct ?? s.profile.bodyFatPct }
            : s.profile,
        })),
      saveCustomFood: (f) =>
        set((s) => ({ customFoods: [f, ...s.customFoods.filter((x) => x.id !== f.id)] })),
      deleteCustomFood: (id) => set((s) => ({ customFoods: s.customFoods.filter((x) => x.id !== id) })),
      addFoodEntries: (entries) =>
        set((s) => ({
          foodEntries: [...s.foodEntries, ...entries],
          recentFoodIds: [...new Set([...entries.map((e) => e.foodId).reverse(), ...s.recentFoodIds])].slice(0, 40),
        })),
      updateFoodEntry: (e) => set((s) => ({ foodEntries: s.foodEntries.map((x) => (x.id === e.id ? e : x)) })),
      removeFoodEntry: (id) => set((s) => ({ foodEntries: s.foodEntries.filter((x) => x.id !== id) })),
      addTraining: (t) => set((s) => ({ trainingEntries: [...s.trainingEntries, t] })),
      updateTraining: (t) => set((s) => ({ trainingEntries: s.trainingEntries.map((x) => (x.id === t.id ? t : x)) })),
      removeTraining: (id) => set((s) => ({ trainingEntries: s.trainingEntries.filter((x) => x.id !== id) })),
      saveCustomExercise: (e) =>
        set((s) => ({ customExercises: [e, ...s.customExercises.filter((x) => x.id !== e.id)] })),
      resetAll: () => set({ ...empty }),
    }),
    { name: 'micenae:v1', version: 1 },
  ),
);

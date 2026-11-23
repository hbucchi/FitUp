import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ActivePlan, BodyLog, CheckIn, Symptom, Exercise, Food, FoodEntry, NutritionPlan, Objective, PlanReview, PlannedSession, Profile, TrainingEntry } from '../domain/types';

/**
 * Local-first app state. Persisted to localStorage for the MVP; the same shape
 * maps 1:1 onto Firestore collections (users/{uid}/foodEntries, …) for the online version.
 */
export interface AppState {
  /** Firebase uid whose data this local copy belongs to (undefined = local-only data). */
  ownerUid?: string;
  profile?: Profile;
  bodyLog: BodyLog[];
  customFoods: Food[];
  customExercises: Exercise[];
  foodEntries: FoodEntry[];
  trainingEntries: TrainingEntry[];
  recentFoodIds: string[];
  objective?: Objective;
  activePlan?: ActivePlan;
  nutritionPlan?: NutritionPlan;
  plannedSessions: PlannedSession[];
  reviews: PlanReview[];
  checkIns: CheckIn[];
  symptoms: Symptom[];
  /** highest training rank already celebrated (index into RANKS); undefined until first computed */
  rankSeen?: number;

  setRankSeen: (n: number) => void;
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
  setObjective: (o: Objective | undefined) => void;
  setNutritionPlan: (n: NutritionPlan | undefined) => void;
  /** start a plan: future open sessions of any previous plan are removed, history is kept */
  startPlan: (plan: ActivePlan, sessions: PlannedSession[], today: string) => void;
  endPlan: (today: string) => void;
  updateSessions: (sessions: PlannedSession[]) => void;
  /** apply a week choice: open sessions of this plan from `fromWeek` on are replaced */
  replacePlanFrom: (plan: ActivePlan, fromWeek: number, sessions: PlannedSession[]) => void;
  addReview: (r: PlanReview) => void;
  saveCheckIn: (c: CheckIn) => void;
  removeCheckIn: (date: string) => void;
  saveSymptom: (s: Symptom) => void;
  removeSymptom: (id: string) => void;
  resetAll: () => void;
}

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

const empty = {
  ownerUid: undefined,
  profile: undefined,
  bodyLog: [],
  customFoods: [],
  customExercises: [],
  foodEntries: [],
  trainingEntries: [],
  recentFoodIds: [],
  objective: undefined,
  rankSeen: undefined,
  activePlan: undefined,
  nutritionPlan: undefined,
  plannedSessions: [],
  reviews: [],
  checkIns: [],
  symptoms: [],
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
      setObjective: (objective) => set({ objective }),
      setRankSeen: (rankSeen) => set({ rankSeen }),
      setNutritionPlan: (nutritionPlan) => set({ nutritionPlan }),
      startPlan: (plan, sessions, today) =>
        set((s) => ({
          activePlan: plan,
          plannedSessions: [...s.plannedSessions.filter((x) => x.status !== 'planned' || x.date < today), ...sessions],
        })),
      endPlan: (today) =>
        set((s) => ({ activePlan: undefined, plannedSessions: s.plannedSessions.filter((x) => x.status !== 'planned' || x.date < today) })),
      updateSessions: (changed) =>
        set((s) => {
          const byId = new Map(changed.map((x) => [x.id, x]));
          return { plannedSessions: s.plannedSessions.map((x) => byId.get(x.id) ?? x) };
        }),
      replacePlanFrom: (plan, fromWeek, sessions) =>
        set((s) => ({
          activePlan: plan,
          plannedSessions: [
            ...s.plannedSessions.filter((x) => x.planId !== plan.id || x.week < fromWeek || x.status !== 'planned'),
            ...sessions,
          ],
        })),
      addReview: (r) => set((s) => ({ reviews: [r, ...s.reviews].slice(0, 15) })),
      saveCheckIn: (c) =>
        set((s) => ({ checkIns: [...s.checkIns.filter((x) => x.date !== c.date), c].sort((a, b) => a.date.localeCompare(b.date)) })),
      removeCheckIn: (date) => set((s) => ({ checkIns: s.checkIns.filter((c) => c.date !== date) })),
      saveSymptom: (x) => set((s) => ({ symptoms: [...s.symptoms.filter((y) => y.id !== x.id), x] })),
      removeSymptom: (id) => set((s) => ({ symptoms: s.symptoms.filter((y) => y.id !== id) })),
      resetAll: () => set({ ...empty }),
    }),
    { name: 'micenae:v1', version: 1 },
  ),
);

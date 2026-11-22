import type { AppState } from './store';
import type { DailyTargets } from '../domain/metrics';
import { dailyTargets } from '../domain/metrics';

/** Sessions planned on a date (not skipped). */
export const sessionsOn = (s: Pick<AppState, 'plannedSessions'>, date: string) =>
  s.plannedSessions.filter((x) => x.date === date && x.status !== 'skipped').sort((a, b) => a.order - b.order);

/** Nutrition targets for a date: the plan's training-day or rest-day numbers, else the profile defaults. */
export function targetsFor(s: Pick<AppState, 'profile' | 'nutritionPlan' | 'plannedSessions'>, date: string): DailyTargets & { dayType?: 'training' | 'rest' } {
  if (!s.nutritionPlan) return dailyTargets(s.profile!);
  const training = sessionsOn(s, date).length > 0;
  const d = training ? s.nutritionPlan.training : s.nutritionPlan.rest;
  return { kcal: d.kcal, protein: d.protein, carbs: d.carbs, fat: d.fat, fiber: s.nutritionPlan.fiber, dayType: training ? 'training' : 'rest' };
}

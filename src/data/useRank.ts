import { useMemo } from 'react';
import { useStore } from './store';
import { useExercises } from '../ui/screens/TrainingLog';
import { addDays } from '../domain/programs';
import { todayISO } from '../domain/dates';
import { standing, trainingPoints, type PointsSummary, type Standing } from '../domain/xp';

export interface RankInfo extends Standing {
  summary: PointsSummary;
  /** points over the last 7 days, today included */
  week: number;
}

/** The user's training points and rank, recomputed from the diary. */
export function useRank(): RankInfo {
  const entries = useStore((s) => s.trainingEntries);
  const bodyLog = useStore((s) => s.bodyLog);
  const weight = useStore((s) => s.profile?.weightKg ?? 75);
  const exercises = useExercises();
  return useMemo(() => {
    const today = todayISO();
    const summary = trainingPoints(entries, exercises, bodyLog, weight, today);
    const from = addDays(today, -6);
    let week = 0;
    for (const [d, p] of summary.byDate) if (d >= from && d <= today) week += p;
    return { ...standing(summary.total), summary, week };
  }, [entries, exercises, bodyLog, weight]);
}

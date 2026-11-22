import type { ActivePlan, PlannedSession, TrainingEntry } from './types';
import { addDays, planChoices, planWeekStart, weekStructure, type WeekOption } from './programs';

/**
 * Picking next week's (pre-designed) week from your recent history.
 *
 * Signals
 *  - adherence: sessions done ÷ sessions due, last 14 days
 *  - strength trend: estimated 1-rep max (Epley: kg × (1 + reps/30)) on each lift, latest session vs
 *    the one before, over the last 4 weeks
 *  - weeks since the last lighter week
 *
 * Rules (also the baseline the AI coach sees)
 *  1. adherence < 50 %  → condensed week (fewer, longer sessions you can actually complete)
 *  2. adherence < 75 %  → repeat last week (consolidate before adding load)
 *  3. lifts declining (≥ 2, more down than up) → lighter week now
 *  4. 6+ weeks without a lighter week → lighter week now
 *  5. scheduled lighter week, but adherence high and lifts climbing → skip it (it doesn't add muscle
 *     by itself — Coleman 2024)
 *  6. otherwise → progress as planned
 */

export interface TrainingSignals {
  due: number;
  done: number;
  adherence?: number;
  improved: number;
  declined: number;
  trends: { name: string; changePct: number }[];
  weeksSinceLighter: number;
}

const e1rm = (kg: number, reps: number) => kg * (1 + reps / 30);

export function trainingSignals(plan: ActivePlan, sessions: PlannedSession[], training: TrainingEntry[], today: string, targetWeek: number): TrainingSignals {
  const from = addDays(today, -14);
  const due = sessions.filter((s) => s.date >= from && s.date < today);
  const done = due.filter((s) => s.status === 'done').length;

  // per-exercise best e1RM per day, last 28 days
  const since = addDays(today, -28);
  const byEx = new Map<string, { name: string; points: { date: string; best: number }[] }>();
  for (const t of training) {
    if (t.date < since || t.date > today || !t.sets?.length) continue;
    const best = Math.max(...t.sets.filter((s) => s.weightKg > 0 && s.reps > 0).map((s) => e1rm(s.weightKg, s.reps)), 0);
    if (!best) continue;
    const entry = byEx.get(t.exerciseId) ?? { name: t.exerciseName, points: [] };
    const sameDay = entry.points.find((p) => p.date === t.date);
    if (sameDay) sameDay.best = Math.max(sameDay.best, best);
    else entry.points.push({ date: t.date, best });
    byEx.set(t.exerciseId, entry);
  }
  const trends: TrainingSignals['trends'] = [];
  for (const { name, points } of byEx.values()) {
    if (points.length < 2) continue;
    points.sort((a, b) => a.date.localeCompare(b.date));
    const [prev, last] = points.slice(-2);
    trends.push({ name, changePct: ((last.best - prev.best) / prev.best) * 100 });
  }

  // weeks since a lighter week (scheduled deload or a chosen lighter week)
  const structure = weekStructure(plan.structureWeeks ?? plan.weeks);
  let weeksSinceLighter = 0;
  for (const c of [...planChoices(plan)].filter((c) => c.week < targetWeek).reverse()) {
    const lighter = c.variant === 'lighter' || (c.variant !== 'skip-deload' && structure[c.step]?.phase === 'deload');
    if (lighter) break;
    weeksSinceLighter++;
  }

  return {
    due: due.length,
    done,
    adherence: due.length >= 3 ? done / due.length : undefined,
    improved: trends.filter((t) => t.changePct > 1).length,
    declined: trends.filter((t) => t.changePct < -2).length,
    trends,
    weeksSinceLighter,
  };
}

/** The plan week the review decides: the first one that hasn't started yet. */
export function targetWeek(plan: ActivePlan, sessions: PlannedSession[], today: string): number | undefined {
  for (let w = 1; w <= plan.weeks; w++) {
    const start = planWeekStart(plan, w);
    const inWeek = sessions.filter((s) => s.week === w);
    if (start >= today && !inWeek.some((s) => s.status === 'done')) return w;
  }
  return undefined;
}

export function chooseByRules(options: WeekOption[], s: TrainingSignals): { option: WeekOption; reason: string } {
  const get = (id: WeekOption['id']) => options.find((o) => o.id === id);
  const standard = get('standard')!;
  const pct = s.adherence != null ? Math.round(s.adherence * 100) : undefined;
  if (s.adherence != null && s.adherence < 0.5 && get('condensed'))
    return { option: get('condensed')!, reason: `You completed ${s.done} of ${s.due} sessions in the last two weeks. A shorter week you finish beats a full one you don't.` };
  if (s.adherence != null && s.adherence < 0.75 && get('repeat'))
    return { option: get('repeat')!, reason: `Adherence was ${pct}% — repeating last week's loading before progressing.` };
  if (s.declined >= 2 && s.declined > s.improved && get('lighter'))
    return { option: get('lighter')!, reason: `${s.declined} lifts went down since last time (vs ${s.improved} up) — a sign of accumulated fatigue. Lighter week now.` };
  if (s.weeksSinceLighter >= 6 && get('lighter'))
    return { option: get('lighter')!, reason: `${s.weeksSinceLighter} weeks without a lighter week — taking one to manage fatigue.` };
  if (get('skip-deload') && s.adherence != null && s.adherence >= 0.9 && s.improved >= 2 && s.declined === 0)
    return { option: get('skip-deload')!, reason: `Adherence ${pct}% and ${s.improved} lifts climbing — recovery looks good, so the scheduled lighter week is skipped.` };
  return {
    option: standard,
    reason: s.adherence == null ? 'Not much history yet — following the plan.' : `Adherence ${pct}%${s.improved ? `, ${s.improved} lifts up` : ''} — progressing as planned.`,
  };
}

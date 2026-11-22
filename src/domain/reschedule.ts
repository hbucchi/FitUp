import type { PlannedSession } from './types';
import { addDays, weekday } from './programs';

/**
 * Rule-based weekly rescheduling (works without an AI key; also given to the AI coach as a baseline).
 *
 *  1. Sessions missed in earlier weeks are closed as "skipped" — chasing old sessions piles up
 *     fatigue; the next week's plan already covers those muscles.
 *  2. Sessions missed earlier *this* week are carried forward, keeping their original order.
 *  3. All open sessions for the rest of the week are packed onto the remaining days, preferring
 *     your training days, never two on one day, and avoiding three days in a row where possible.
 *  4. If there are more sessions than days left, the extras are skipped (lowest priority last).
 */

export interface ScheduleChange {
  sessionId: string;
  title: string;
  from: string;
  to?: string; // undefined = skipped
  reason: string;
}

/** Monday-based calendar week end (Sunday) for a date. */
export function endOfWeek(date: string): string {
  const wd = weekday(date); // 0 = Sun
  return addDays(date, wd === 0 ? 0 : 7 - wd);
}
export function startOfWeek(date: string): string {
  const wd = weekday(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

export function planWeek(
  sessions: PlannedSession[],
  today: string,
  trainingDays: number[],
  opts: { trainedToday?: boolean; lastDay?: string } = {},
): ScheduleChange[] {
  const changes: ScheduleChange[] = [];
  const weekStart = startOfWeek(today);
  const calendarEnd = endOfWeek(today);
  // never spill into days that belong to an upcoming (re-planned) week
  const weekEnd = opts.lastDay && opts.lastDay < calendarEnd ? opts.lastDay : calendarEnd;

  // 1. stale misses from earlier weeks
  for (const s of sessions) {
    if (s.status === 'planned' && s.date < weekStart) {
      changes.push({ sessionId: s.id, title: s.title, from: s.date, reason: 'Missed in an earlier week — closed so it doesn\'t pile up.' });
    }
  }

  // 2 + 3. open sessions of this week (missed or upcoming), in plan order
  const open = sessions
    .filter((s) => s.status === 'planned' && s.date >= weekStart && s.date <= calendarEnd)
    .sort((a, b) => a.order - b.order);
  const busy = new Set(sessions.filter((s) => s.status === 'done' && s.date >= weekStart && s.date <= weekEnd).map((s) => s.date));
  const firstDay = opts.trainedToday || busy.has(today) ? addDays(today, 1) : today;

  const days: string[] = [];
  for (let d = firstDay; d <= weekEnd; d = addDays(d, 1)) if (!busy.has(d)) days.push(d);

  // nothing missed this week → the week stands as planned
  if (!open.some((s) => s.date < firstDay)) return changes;

  const preferred = days.filter((d) => trainingDays.includes(weekday(d)));
  const others = days.filter((d) => !trainingDays.includes(weekday(d)));
  const chosen: string[] = [];
  const trained = (x: string) => chosen.includes(x) || busy.has(x);
  const take = (pool: string[], avoidRuns: boolean) => {
    for (const d of pool) {
      if (chosen.length >= open.length) return;
      if (chosen.includes(d)) continue;
      // on extra (non-training) days, avoid a third consecutive training day
      if (avoidRuns && trained(addDays(d, -1)) && trained(addDays(d, -2))) continue;
      chosen.push(d);
    }
  };
  take(preferred, false);
  take(others, true);
  if (chosen.length < open.length) {
    // relax the consecutive-day rule rather than drop sessions
    for (const d of days) if (chosen.length < open.length && !chosen.includes(d)) chosen.push(d);
  }
  chosen.sort();

  open.forEach((s, i) => {
    const to = chosen[i];
    if (!to) {
      changes.push({ sessionId: s.id, title: s.title, from: s.date, reason: 'No days left this week — skipped. Next week starts fresh.' });
    } else if (to !== s.date) {
      changes.push({
        sessionId: s.id, title: s.title, from: s.date, to,
        reason: s.date < firstDay ? 'Missed — moved to the next free day.' : 'Shifted to make room for a missed session.',
      });
    }
  });
  return changes;
}

export function applyChanges(sessions: PlannedSession[], changes: ScheduleChange[]): PlannedSession[] {
  const byId = new Map(changes.map((c) => [c.sessionId, c]));
  return sessions.map((s) => {
    const c = byId.get(s.id);
    if (!c) return s;
    if (!c.to) return { ...s, status: 'skipped' as const, note: c.reason };
    return { ...s, date: c.to, originalDate: s.originalDate ?? s.date };
  });
}

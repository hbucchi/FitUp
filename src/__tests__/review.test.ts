import { afterEach, describe, expect, test, vi } from 'vitest';
import type { PlannedSession, Profile } from '../domain/types';
import { PROGRAMS, generatePlan } from '../domain/programs';
import { buildNutritionPlan } from '../domain/nutritionPlan';
import { SEED_EXERCISES } from '../domain/exercises';
import { coachReview, rulesReview, type ReviewInput } from '../agent/review';

const p: Profile = { name: 'T', sex: 'male', birthYear: 1995, heightCm: 180, weightKg: 80, bodyFatPct: 20, activity: 'moderate', goal: 'cut', createdAt: '' };
const prog = PROGRAMS.find((x) => x.id === 'upper-lower')!;
const { plan, sessions } = generatePlan(prog, { weeks: 8, startDate: '2026-11-23', trainingDays: [1, 2, 4, 5], id: 'p' });
// Mon done, Tue missed; today is Wednesday 25th
const withHistory = (): PlannedSession[] => sessions.map((s) => (s.date === '2026-11-23' ? { ...s, status: 'done' } : s));
const input = (): ReviewInput => ({
  today: '2026-11-25', profile: p, plan, sessions: withHistory(), training: [], food: [], bodyLog: [],
  nutrition: buildNutritionPlan(p, { phase: 'cut', trainingDaysPerWeek: 4 }), exercises: SEED_EXERCISES,
});
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
afterEach(() => vi.restoreAllMocks());

test('rules: missed Tuesday is done today; nutrition untouched without data', () => {
  const r = rulesReview(input());
  expect(r.by).toBe('rules');
  expect(r.sessions).toHaveLength(1);
  expect(r.sessions[0].date).toBe('2026-11-25');
  expect(r.nutrition).toBeUndefined();
  expect(r.summary).toMatch(/not enough|Only 0/i);
});

describe('coach (AI) with guardrails', () => {
  test('reschedules, gets corrected when it breaks a rule, and nutrition limits hold', async () => {
    const tue = withHistory().find((s) => s.date === '2026-11-24')!;
    const thu = withHistory().find((s) => s.date === '2026-11-26')!;
    const replies = [
      // 1) tries to move into the past and onto a busy day, and an unsafe calorie cut
      { stop_reason: 'tool_use', content: [
        { type: 'tool_use', id: 'a', name: 'reschedule_session', input: { session_id: tue.id, new_date: '2026-11-22', reason: 'x' } },
        { type: 'tool_use', id: 'b', name: 'reschedule_session', input: { session_id: tue.id, new_date: '2026-11-26', reason: 'x' } },
        { type: 'tool_use', id: 'c', name: 'set_nutrition_targets', input: { training_day: { kcal: 1200, protein_g: 170, fat_g: 60 }, rest_day: { kcal: 1200, protein_g: 170, fat_g: 60 }, reason: 'x' } },
      ] },
      // 2) corrects itself
      { stop_reason: 'tool_use', content: [
        { type: 'tool_use', id: 'd', name: 'reschedule_session', input: { session_id: tue.id, new_date: '2026-11-25', reason: 'Missed yesterday — do it today' } },
        { type: 'tool_use', id: 'e', name: 'modify_session', input: { session_id: thu.id, exercises: [{ exercise_id: 'ex:incline-db', sets: 3 }, { exercise_id: 'ex:pullup', sets: 3 }], reason: 'Lighter after back-to-back days' } },
      ] },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Moved Lower A to today and trimmed Upper B.' }] },
    ];
    const fetchMock = vi.fn(async () => ok(replies.shift()));
    vi.stubGlobal('fetch', fetchMock);
    const events: { ok: boolean; error?: string }[] = [];
    const r = await coachReview({ provider: 'anthropic', apiKey: 'k', model: 'm' }, input(), (e) => e.type === 'tool' && events.push(e));
    expect(events.filter((e) => !e.ok).map((e) => e.error)).toEqual([
      expect.stringMatching(/between 2026-11-25 and 2026-11-29/),
      expect.stringMatching(/already has/),
      expect.stringMatching(/at least|at most 300/),
    ]);
    expect(r.by).toBe('assistant');
    expect(r.nutrition).toBeUndefined();
    expect(r.sessions.find((s) => s.id === tue.id)!.date).toBe('2026-11-25');
    expect(r.sessions.find((s) => s.id === thu.id)!.exercises.map((e) => e.name)).toEqual(['Incline dumbbell press', 'Pull-up']);
    expect(r.changes).toHaveLength(2);
    // the model saw the 15-day history and the rule-based baseline
    const sent = JSON.parse((fetchMock.mock.calls[0] as any)[1].body).messages[0].content as string;
    expect(sent).toContain('"status": "missed"');
    expect(sent).toContain('ruleBasedSuggestion');
  });
});

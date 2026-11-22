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

test('rules: missed Tuesday is done today; next week progresses; nutrition untouched without data', () => {
  const r = rulesReview(input());
  expect(r.by).toBe('rules');
  expect(r.sessions).toHaveLength(1);
  expect(r.sessions[0].date).toBe('2026-11-25');
  expect(r.week!.decision.week).toBe(2);
  expect(r.week!.decision.chosen.id).toBe('standard');
  expect(r.nutrition).toBeUndefined();
  expect(r.summary).toMatch(/0\/10 days logged/);
});

describe('coach (AI) chooses among pre-designed weeks, with guardrails', () => {
  test('invalid picks and unsafe changes are refused; a valid choice rebuilds the next week deterministically', async () => {
    const tue = withHistory().find((s) => s.date === '2026-11-24')!;
    const replies = [
      { stop_reason: 'tool_use', content: [
        { type: 'tool_use', id: 'a', name: 'choose_week', input: { option_id: 'skip-deload', reason: 'x' } },
        { type: 'tool_use', id: 'b', name: 'reschedule_session', input: { session_id: tue.id, new_date: '2026-11-22', reason: 'x' } },
        { type: 'tool_use', id: 'c', name: 'set_nutrition_targets', input: { training_day: { kcal: 1200, protein_g: 170, fat_g: 60 }, rest_day: { kcal: 1200, protein_g: 170, fat_g: 60 }, reason: 'x' } },
        { type: 'tool_use', id: 'd', name: 'modify_session', input: { session_id: tue.id, exercises: [] } },
      ] },
      { stop_reason: 'tool_use', content: [
        { type: 'tool_use', id: 'e', name: 'choose_week', input: { option_id: 'repeat', reason: 'A session was missed — consolidate.' } },
        { type: 'tool_use', id: 'f', name: 'reschedule_session', input: { session_id: tue.id, new_date: '2026-11-25', reason: 'Do it today' } },
      ] },
      { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Lower A today; next week repeats this week.' }] },
    ];
    const fetchMock = vi.fn(async () => ok(replies.shift()));
    vi.stubGlobal('fetch', fetchMock);
    const errors: string[] = [];
    const r = await coachReview({ provider: 'anthropic', apiKey: 'k', model: 'm' }, input(), (e) => e.type === 'tool' && !e.ok && errors.push(e.error!));
    expect(errors).toEqual([
      expect.stringMatching(/Not an available option/),
      expect.stringMatching(/between 2026-11-25/),
      expect.stringMatching(/at least|at most 300/),
      expect.stringMatching(/Unknown tool modify_session/),
    ]);
    expect(r.week!.decision).toMatchObject({ week: 2, by: 'assistant' });
    expect(r.week!.decision.chosen.id).toBe('repeat');
    expect(r.week!.plan.weeks).toBe(9);
    // week 2 now has week 1's loading: same rep ranges and RIR
    const w = (list: PlannedSession[], n: number) => list.filter((s) => s.week === n).map((s) => s.exercises.map((e) => [e.repsMin, e.rir]));
    expect(w(r.week!.sessions, 2)).toEqual(w(sessions, 1));
    expect(r.sessions.find((s) => s.id === tue.id)!.date).toBe('2026-11-25');
    expect(r.nutrition).toBeUndefined();
    const sent = JSON.parse((fetchMock.mock.calls[0] as any)[1].body).messages[0].content as string;
    expect(sent).toContain('"option_id": "condensed"');
    expect(sent).toContain('ruleBasedSuggestion');
  });

  test('if the coach forgets to choose, the rule-based week applies', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'All good.' }] })));
    const r = await coachReview({ provider: 'anthropic', apiKey: 'k', model: 'm' }, input(), () => {});
    expect(r.week!.decision.by).toBe('rules');
  });
});

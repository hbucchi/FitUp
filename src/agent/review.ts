import type { BodyLog, Exercise, FoodEntry, MacroDay, NutritionPlan, Objective, PlannedSession, Profile, TrainingEntry, ActivePlan } from '../domain/types';
import { addDays, weekday } from '../domain/programs';
import { applyChanges, endOfWeek, planWeek, startOfWeek, type ScheduleChange } from '../domain/reschedule';
import { kcalFloor, reviewNutrition, type NutritionReview } from '../domain/nutritionPlan';
import { bodyMetrics } from '../domain/metrics';
import { ascent, LEVELS } from '../domain/objective';
import { runAgentTask, type AgentConfig, type AgentEvent } from './runAgent';
import { ToolError, type ToolDef } from './tools';

/**
 * "Update plan": look back (training 15 days, nutrition 10 days), adjust the rest of this week's
 * sessions and — only if the data says so — the nutrition targets.
 *
 * Without an AI key the rule-based baseline is applied as-is. With a key, the coach model gets the
 * same data plus the baseline, and acts through tools that enforce safe bounds.
 */

export interface ReviewInput {
  today: string;
  profile: Profile;
  objective?: Objective;
  plan: ActivePlan;
  sessions: PlannedSession[];
  training: TrainingEntry[];
  food: FoodEntry[];
  bodyLog: BodyLog[];
  nutrition?: NutritionPlan;
  exercises: Exercise[];
}

export interface ReviewResult {
  by: 'rules' | 'assistant';
  summary: string;
  changes: string[];
  sessions: PlannedSession[]; // only the sessions that changed
  nutrition?: NutritionPlan; // set when targets changed
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtDay = (d: string) => `${DAY[weekday(d)]} ${d.slice(5)}`;

export function baseline(input: ReviewInput) {
  const trainedToday = input.sessions.some((s) => s.date === input.today && s.status === 'done');
  const schedule = planWeek(input.sessions, input.today, input.plan.trainingDays, { trainedToday });
  const isTrainingDay = (d: string) => input.sessions.some((s) => s.date === d && s.status !== 'skipped');
  const nutrition = input.nutrition
    ? reviewNutrition({ plan: input.nutrition, profile: input.profile, foodEntries: input.food, bodyLog: input.bodyLog, today: input.today, isTrainingDay })
    : undefined;
  return { schedule, nutrition, isTrainingDay };
}

function describeChange(c: ScheduleChange) {
  return c.to ? `${c.title}: ${fmtDay(c.from)} → ${fmtDay(c.to)}` : `${c.title} (${fmtDay(c.from)}) skipped`;
}

function nutritionLine(before: NutritionPlan, after: NutritionPlan) {
  const d = (a: MacroDay, b: MacroDay) => `${a.kcal}→${b.kcal} kcal`;
  return `Calories: training days ${d(before.training, after.training)}, rest days ${d(before.rest, after.rest)}`;
}

export function rulesReview(input: ReviewInput): ReviewResult {
  const { schedule, nutrition } = baseline(input);
  const changedSessions = applyChanges(input.sessions, schedule).filter((s, i) => s !== input.sessions[i]);
  const changes = schedule.map(describeChange);
  const reasons: string[] = [];
  if (!schedule.length) reasons.push('Training: nothing missed this week — schedule unchanged.');
  else reasons.push(`Training: ${schedule.length} session${schedule.length > 1 ? 's' : ''} adjusted.`);
  if (nutrition) {
    if (nutrition.changed && input.nutrition) changes.push(nutritionLine(input.nutrition, nutrition.plan));
    reasons.push(...nutrition.reasons);
  }
  return {
    by: 'rules',
    summary: reasons.join('\n'),
    changes,
    sessions: changedSessions,
    nutrition: nutrition?.changed ? nutrition.plan : undefined,
  };
}

// ── AI coach ───────────────────────────────────────────────────

function summarizeExecuted(entries: TrainingEntry[]) {
  return entries
    .map((t) =>
      t.sets?.length
        ? `${t.exerciseName}: ${t.sets.map((s) => `${s.reps}${s.weightKg ? `×${s.weightKg}kg` : ''}`).join(', ')}`
        : `${t.exerciseName}: ${t.durationMin} min`,
    )
    .join('; ');
}

export function coachContext(input: ReviewInput, base: ReturnType<typeof baseline>) {
  const { today } = input;
  const m = bodyMetrics(input.profile);
  const from15 = addDays(today, -15);
  const weekEnd = endOfWeek(today);
  const weekStart = startOfWeek(today);
  const a = input.objective ? ascent(input.objective, input.profile) : undefined;
  const sessionsSorted = [...input.sessions].sort((x, y) => x.date.localeCompare(y.date) || x.order - y.order);
  const exec = (s: PlannedSession) => input.training.filter((t) => t.planSessionId === s.id);

  return {
    today: `${fmtDay(today)} (${today})`,
    athlete: {
      sex: input.profile.sex,
      age: new Date(today).getFullYear() - input.profile.birthYear,
      heightCm: input.profile.heightCm,
      weightKg: input.profile.weightKg,
      bodyFatPct: input.profile.bodyFatPct,
      leanMassKg: Math.round(m.leanMassKg * 10) / 10,
      experience: input.objective?.experience,
      phase: input.nutrition?.phase ?? input.profile.goal,
    },
    objective: input.objective && a && {
      targetBodyFatPct: input.objective.target.bodyFatPct,
      targetLeanMassKg: Math.round(input.objective.target.leanKg * 10) / 10,
      progressPct: Math.round(a.progress * 100),
      level: LEVELS[a.level].name,
    },
    plan: {
      name: input.plan.name,
      weeks: input.plan.weeks,
      trainingDays: input.plan.trainingDays.map((d) => DAY[d]),
      currentWeek: sessionsSorted.find((s) => s.date >= today)?.week,
    },
    last15Days: sessionsSorted
      .filter((s) => s.date >= from15 && s.date < today)
      .map((s) => ({
        session_id: s.id,
        date: fmtDay(s.date),
        title: s.title,
        status: s.status === 'planned' ? 'missed' : s.status,
        planned: s.exercises.map((e) => (e.kind === 'cardio' ? `${e.name} ${e.minutes} min` : `${e.name} ${e.sets}×${e.repsMin}-${e.repsMax} @RIR${e.rir}`)).join('; '),
        executed: summarizeExecuted(exec(s)) || undefined,
      })),
    unplannedTraining: input.training
      .filter((t) => !t.planSessionId && t.date >= from15 && t.date < today)
      .map((t) => `${fmtDay(t.date)} ${t.exerciseName}`),
    restOfWeek: sessionsSorted
      .filter((s) => s.status === 'planned' && s.date >= weekStart && s.date <= weekEnd)
      .map((s) => ({
        session_id: s.id,
        date: s.date,
        day: DAY[weekday(s.date)],
        overdue: s.date < today,
        title: s.title,
        exercises: s.exercises.map((e) => ({
          exercise_id: e.exerciseId, name: e.name, kind: e.kind,
          ...(e.kind === 'cardio' ? { minutes: e.minutes } : { sets: e.sets, reps: `${e.repsMin}-${e.repsMax}`, rir: e.rir }),
        })),
      })),
    nutrition: input.nutrition && {
      targetRatePctPerWeek: input.nutrition.targetRatePct,
      trainingDay: input.nutrition.training,
      restDay: input.nutrition.rest,
    },
    last10DaysIntake: Array.from({ length: 10 }, (_, i) => addDays(today, -10 + i)).map((d) => {
      const e = input.food.filter((f) => f.date === d);
      return {
        date: fmtDay(d),
        trainingDay: base.isTrainingDay(d),
        kcal: Math.round(e.reduce((s, x) => s + (x.nutrients.kcal ?? 0), 0)),
        protein: Math.round(e.reduce((s, x) => s + (x.nutrients.protein ?? 0), 0)),
      };
    }),
    weighIns: input.bodyLog.filter((b) => b.date >= addDays(today, -21)).map((b) => ({ date: b.date, weightKg: b.weightKg, bodyFatPct: b.bodyFatPct })),
    ruleBasedSuggestion: {
      schedule: base.schedule.map(describeChange),
      nutrition: base.nutrition && { wouldChange: base.nutrition.changed, reasons: base.nutrition.reasons, metrics: base.nutrition.metrics, proposed: base.nutrition.changed ? { trainingDay: base.nutrition.plan.training, restDay: base.nutrition.plan.rest } : undefined },
    },
  };
}

export const COACH_TOOLS: ToolDef[] = [
  {
    name: 'reschedule_session',
    description: 'Move an open session of this week (including an overdue one) to a date between today and Sunday. One session per day.',
    input_schema: {
      type: 'object',
      properties: { session_id: { type: 'string' }, new_date: { type: 'string', description: 'YYYY-MM-DD' }, reason: { type: 'string' } },
      required: ['session_id', 'new_date', 'reason'],
    },
  },
  {
    name: 'skip_session',
    description: 'Mark an open session of this week as skipped (e.g. no days left, or it is redundant after merging).',
    input_schema: { type: 'object', properties: { session_id: { type: 'string' }, reason: { type: 'string' } }, required: ['session_id', 'reason'] },
  },
  {
    name: 'modify_session',
    description:
      'Replace the exercise list of an open session this week — e.g. to fold the key lifts of a skipped session into another one, or reduce volume. Use exercise ids from the plan or the library list.',
    input_schema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        exercises: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              exercise_id: { type: 'string' },
              sets: { type: 'integer', minimum: 1, maximum: 6 },
              reps_min: { type: 'integer', minimum: 3, maximum: 30 },
              reps_max: { type: 'integer', minimum: 3, maximum: 30 },
              rir: { type: 'integer', minimum: 0, maximum: 5 },
              minutes: { type: 'integer', minimum: 5, maximum: 90, description: 'cardio only' },
            },
            required: ['exercise_id'],
          },
        },
        reason: { type: 'string' },
      },
      required: ['session_id', 'exercises', 'reason'],
    },
  },
  {
    name: 'set_nutrition_targets',
    description:
      'Change daily targets. Only when the last 10 days show it is necessary. Carbohydrate is computed from the rest. Limits: calories within ±300 of current and above a safe floor; protein 1.6 g/kg body weight to 3.1 g/kg lean mass; fat ≥ 0.6 g/kg and ≥ 20 % of calories.',
    input_schema: {
      type: 'object',
      properties: {
        training_day: { type: 'object', properties: { kcal: { type: 'integer' }, protein_g: { type: 'integer' }, fat_g: { type: 'integer' } }, required: ['kcal', 'protein_g', 'fat_g'] },
        rest_day: { type: 'object', properties: { kcal: { type: 'integer' }, protein_g: { type: 'integer' }, fat_g: { type: 'integer' } }, required: ['kcal', 'protein_g', 'fat_g'] },
        reason: { type: 'string' },
      },
      required: ['training_day', 'rest_day', 'reason'],
    },
  },
];

export const COACH_SYSTEM = `You are the coach inside Micenae, a training and nutrition app. You review the athlete's last 15 days of training and last 10 days of nutrition, then adjust the REST OF THIS WEEK. The data is in the user message as JSON.

Training principles (evidence-based):
- Weekly hard sets per muscle (~10–20) matter more than which day they happen on; frequency mostly distributes volume.
- If a session was missed, prefer moving it to a free day this week. If there aren't enough days, keep the most important work: fold the missed session's main compound lifts (2–3 sets) into another session with modify_session, or skip the least important session. Don't stack two full sessions in one day.
- Avoid three hard lifting days in a row and avoid training the same muscles on consecutive days when possible.
- Never move sessions into the past or beyond Sunday. Only touch sessions listed in restOfWeek.
- If training performance is dropping (fewer reps at the same load across sessions) or sessions are being missed repeatedly, it is fine to reduce volume (fewer sets) for the rest of the week.

Nutrition principles:
- Change targets ONLY if necessary. "ruleBasedSuggestion.nutrition" is a careful, damped analysis of weight trend vs target rate and adherence — follow it unless the data clearly says otherwise.
- If adherence is poor (intake far from target), the fix is adherence, not new targets.
- Fat loss faster than ~1 % body weight per week risks muscle loss; keep protein high in a deficit.

Work through tools. If nothing needs to change, change nothing. Finish with a short summary for the athlete: what you changed and why (one line each), and anything they should focus on this week. No preamble.`;

interface CoachState {
  sessions: Map<string, PlannedSession>;
  nutrition?: NutritionPlan;
  changes: string[];
}

export function executeCoachTool(name: string, input: Record<string, any>, ctx: { input: ReviewInput; state: CoachState }) {
  const { input: ri, state } = ctx;
  const weekStart = startOfWeek(ri.today);
  const weekEnd = endOfWeek(ri.today);
  const open = (id: string) => {
    const s = state.sessions.get(id);
    if (!s) throw new ToolError(`Unknown session_id "${id}".`);
    if (s.status !== 'planned' || s.date < weekStart || s.date > weekEnd) throw new ToolError(`Session ${id} is not an open session of this week.`);
    return s;
  };
  switch (name) {
    case 'reschedule_session': {
      const s = open(String(input.session_id));
      const to = String(input.new_date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(to) || to < ri.today || to > weekEnd) throw new ToolError(`new_date must be between ${ri.today} and ${weekEnd}.`);
      const clash = [...state.sessions.values()].find((x) => x.id !== s.id && x.date === to && x.status !== 'skipped');
      if (clash) throw new ToolError(`${to} already has "${clash.title}". Move or skip that one first, or choose another day.`);
      state.sessions.set(s.id, { ...s, date: to, originalDate: s.originalDate ?? s.date, note: String(input.reason ?? '') });
      state.changes.push(`${s.title}: ${fmtDay(s.date)} → ${fmtDay(to)} — ${input.reason}`);
      return { ok: true };
    }
    case 'skip_session': {
      const s = open(String(input.session_id));
      state.sessions.set(s.id, { ...s, status: 'skipped', note: String(input.reason ?? '') });
      state.changes.push(`${s.title} (${fmtDay(s.date)}) skipped — ${input.reason}`);
      return { ok: true };
    }
    case 'modify_session': {
      const s = open(String(input.session_id));
      const list = Array.isArray(input.exercises) ? input.exercises : [];
      if (!list.length) throw new ToolError('exercises must not be empty — use skip_session instead.');
      const byId = new Map(ri.exercises.map((e) => [e.id, e]));
      const existing = new Map(s.exercises.map((e) => [e.exerciseId, e]));
      const exercises = list.map((x: Record<string, any>) => {
        const ex = byId.get(String(x.exercise_id));
        if (!ex) throw new ToolError(`Unknown exercise_id "${x.exercise_id}".`);
        const prev = existing.get(ex.id);
        if (ex.kind === 'aerobic') {
          return { exerciseId: ex.id, name: ex.name, kind: 'cardio' as const, sets: 1, repsMin: 0, repsMax: 0, rir: 0, restSec: 0, minutes: Number(x.minutes) || prev?.minutes || 30 };
        }
        const repsMin = Number(x.reps_min ?? prev?.repsMin ?? 8);
        const repsMax = Math.max(repsMin, Number(x.reps_max ?? prev?.repsMax ?? 12));
        const compound = prev ? prev.kind === 'compound' : ex.met >= 5;
        return {
          exerciseId: ex.id, name: ex.name, kind: compound ? ('compound' as const) : ('isolation' as const),
          sets: Math.min(6, Math.max(1, Number(x.sets ?? prev?.sets ?? 3))), repsMin, repsMax,
          rir: Math.min(5, Math.max(0, Number(x.rir ?? prev?.rir ?? 2))), restSec: compound ? 150 : 90,
        };
      });
      const total = exercises.reduce((n: number, e: { sets: number }) => n + e.sets, 0);
      if (total > 30) throw new ToolError(`That is ${total} sets in one session — keep it to 30 or fewer.`);
      state.sessions.set(s.id, { ...s, exercises, note: String(input.reason ?? '') });
      state.changes.push(`${s.title} (${fmtDay(s.date)}) adjusted — ${input.reason}`);
      return { ok: true, sets: total };
    }
    case 'set_nutrition_targets': {
      const cur = state.nutrition;
      if (!cur) throw new ToolError('There is no nutrition plan to change.');
      const p = ri.profile;
      const lbm = bodyMetrics(p).leanMassKg;
      const floor = kcalFloor(p);
      const check = (d: Record<string, number>, before: MacroDay, label: string): MacroDay => {
        const kcal = Math.round(Number(d.kcal));
        const protein = Math.round(Number(d.protein_g));
        const fat = Math.round(Number(d.fat_g));
        if (!(kcal >= floor)) throw new ToolError(`${label}: calories must be at least ${floor}.`);
        if (Math.abs(kcal - before.kcal) > 300) throw new ToolError(`${label}: change calories by at most 300 per update (currently ${before.kcal}).`);
        if (protein < Math.round(1.6 * p.weightKg) || protein > Math.round(3.1 * lbm)) throw new ToolError(`${label}: protein must be between ${Math.round(1.6 * p.weightKg)} and ${Math.round(3.1 * lbm)} g.`);
        if (fat < Math.round(0.6 * p.weightKg) || fat * 9 < 0.2 * kcal) throw new ToolError(`${label}: fat must be ≥ ${Math.round(0.6 * p.weightKg)} g and ≥ 20 % of calories.`);
        const carbs = Math.round((kcal - protein * 4 - fat * 9) / 4);
        if (carbs < 0) throw new ToolError(`${label}: protein and fat exceed the calories.`);
        return { kcal, protein, fat, carbs };
      };
      const training = check(input.training_day ?? {}, cur.training, 'Training day');
      const rest = check(input.rest_day ?? {}, cur.rest, 'Rest day');
      state.nutrition = { ...cur, training, rest, proteinPerMeal: Math.round(training.protein / cur.mealsPerDay), updatedAt: new Date().toISOString() };
      state.changes.push(`Calories: training days ${cur.training.kcal}→${training.kcal}, rest days ${cur.rest.kcal}→${rest.kcal} kcal — ${input.reason}`);
      return { ok: true, training_day: training, rest_day: rest };
    }
    default:
      throw new ToolError(`Unknown tool ${name}`);
  }
}

export async function coachReview(cfg: AgentConfig, input: ReviewInput, onEvent: (e: AgentEvent) => void, signal?: AbortSignal): Promise<ReviewResult> {
  // stale misses from earlier weeks are closed by rule before the coach looks
  const base = baseline(input);
  const stale = base.schedule.filter((c) => !c.to && c.from < startOfWeek(input.today));
  const sessions = applyChanges(input.sessions, stale);
  const working: ReviewInput = { ...input, sessions };
  const state: CoachState = { sessions: new Map(sessions.map((s) => [s.id, s])), nutrition: input.nutrition, changes: stale.map(describeChange) };
  const library = input.exercises.map((e) => `${e.id} ${e.name} (${e.kind}, ${e.group})`).join('\n');
  const user = `Review data:\n${JSON.stringify(coachContext(working, { ...base, schedule: base.schedule.filter((c) => !stale.includes(c)) }), null, 1)}\n\nExercise library (id name):\n${library}`;
  const summary = await runAgentTask(
    cfg,
    { system: COACH_SYSTEM, tools: COACH_TOOLS, user, execute: (n, i) => executeCoachTool(n, i, { input: working, state }), maxTokens: 3000 },
    onEvent,
    signal,
  );
  const changed = [...state.sessions.values()].filter((s) => {
    const orig = input.sessions.find((o) => o.id === s.id);
    return orig !== s;
  });
  return {
    by: 'assistant',
    summary,
    changes: state.changes,
    sessions: changed,
    nutrition: state.nutrition !== input.nutrition ? state.nutrition : undefined,
  };
}

export type { NutritionReview };

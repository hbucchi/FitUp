import type { ActivePlan, BodyLog, CheckIn, Exercise, FoodEntry, MacroDay, NutritionPlan, Objective, PlannedSession, Profile, TrainingEntry, WeekChoice } from '../domain/types';
import { addDays, planWeekStart, programById, rebuildFrom, weekday, weekOptions, type Program, type WeekOption } from '../domain/programs';
import { applyChanges, endOfWeek, planWeek, startOfWeek, type ScheduleChange } from '../domain/reschedule';
import { kcalFloor, reviewNutrition } from '../domain/nutritionPlan';
import { chooseByRules, targetWeek, trainingSignals, type TrainingSignals } from '../domain/weekly';
import { bodyMetrics } from '../domain/metrics';
import { ascent, LEVELS } from '../domain/objective';
import { runAgentTask, type AgentConfig, type AgentEvent } from './runAgent';
import { ToolError, type ToolDef } from './tools';

/**
 * "Update plan".
 *  - Training content is deterministic: every week of a program is pre-designed.
 *  - The review decides (a) which pre-designed week runs next, from your last weeks of data, and
 *    (b) where this week's missed sessions go.
 *  - Nutrition targets change only when the last 10 days say so.
 * Without an AI key, rules decide. With one, the AI coach decides through tools that only allow
 * choosing among the pre-designed options and safe nutrition bounds.
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
  exercises?: Exercise[];
  checkIns?: CheckIn[];
}

export interface WeekDecision {
  week: number;
  startDate: string;
  chosen: WeekOption;
  reason: string;
  options: WeekOption[];
  by: 'rules' | 'assistant';
}

export interface ReviewResult {
  by: 'rules' | 'assistant';
  summary: string;
  changes: string[];
  /** sessions moved/skipped this week */
  sessions: PlannedSession[];
  /** next week's choice: updated plan + regenerated sessions from that week on */
  week?: { decision: WeekDecision; plan: ActivePlan; fromWeek: number; sessions: PlannedSession[] };
  nutrition?: NutritionPlan;
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const fmtDay = (d: string) => `${DAY[weekday(d)]} ${d.slice(5)}`;

function describeChange(c: ScheduleChange) {
  return c.to ? `${c.title}: ${fmtDay(c.from)} → ${fmtDay(c.to)}` : `${c.title} (${fmtDay(c.from)}) skipped`;
}

export function baseline(input: ReviewInput) {
  const program = programById(input.plan.programId);
  const tw = targetWeek(input.plan, input.sessions, input.today);
  // this week's rescheduling stays within the weeks before the target week
  const current = tw ? input.sessions.filter((s) => s.week < tw) : input.sessions;
  const trainedToday = input.sessions.some((s) => s.date === input.today && s.status === 'done');
  const lastDay = tw ? addDays(planWeekStart(input.plan, tw), -1) : undefined;
  const schedule = planWeek(current, input.today, input.plan.trainingDays, { trainedToday, lastDay });

  const options = program && tw ? weekOptions(program, input.plan, tw) : [];
  const signals = tw ? trainingSignals(input.plan, input.sessions, input.training, input.today, tw, input.checkIns ?? []) : undefined;
  const ruleChoice = options.length && signals ? chooseByRules(options, signals) : undefined;

  const isTrainingDay = (d: string) => input.sessions.some((s) => s.date === d && s.status !== 'skipped');
  const nutrition = input.nutrition
    ? reviewNutrition({ plan: input.nutrition, profile: input.profile, foodEntries: input.food, bodyLog: input.bodyLog, today: input.today, isTrainingDay })
    : undefined;
  return { program, targetWeek: tw, schedule, options, signals, ruleChoice, nutrition, isTrainingDay };
}

function applyWeek(program: Program | undefined, input: ReviewInput, tw: number | undefined, option: WeekOption | undefined, reason: string, by: 'rules' | 'assistant', options: WeekOption[]) {
  if (!program || !tw || !option) return undefined;
  const choice: WeekChoice = { ...option.choice, by, reason };
  const { plan, sessions } = rebuildFrom(program, input.plan, choice);
  return { decision: { week: tw, startDate: planWeekStart(input.plan, tw), chosen: option, reason, options, by }, plan, fromWeek: tw, sessions };
}

export function rulesReview(input: ReviewInput): ReviewResult {
  const base = baseline(input);
  const changedSessions = applyChanges(input.sessions, base.schedule).filter((s, i) => s !== input.sessions[i]);
  const changes = base.schedule.map(describeChange);
  const lines: string[] = [];
  const week = base.ruleChoice ? applyWeek(base.program, input, base.targetWeek, base.ruleChoice.option, base.ruleChoice.reason, 'rules', base.options) : undefined;
  if (week && week.decision.chosen.id !== 'standard') changes.push(`Week ${week.decision.week}: ${week.decision.chosen.title}`);
  if (base.nutrition) {
    if (base.nutrition.changed && input.nutrition) {
      const n = base.nutrition.plan;
      changes.push(`Calories: training days ${input.nutrition.training.kcal}→${n.training.kcal}, rest days ${input.nutrition.rest.kcal}→${n.rest.kcal} kcal`);
    }
    lines.push(...base.nutrition.reasons);
  }
  return { by: 'rules', summary: lines.join('\n'), changes, sessions: changedSessions, week, nutrition: base.nutrition?.changed ? base.nutrition.plan : undefined };
}

// ── AI coach ───────────────────────────────────────────────────

function summarizeExecuted(entries: TrainingEntry[]) {
  return entries
    .map((t) => (t.sets?.length ? `${t.exerciseName}: ${t.sets.map((s) => `${s.reps}${s.weightKg ? `×${s.weightKg}kg` : ''}`).join(', ')}` : `${t.exerciseName}: ${t.durationMin} min`))
    .join('; ');
}

export function coachContext(input: ReviewInput, base: ReturnType<typeof baseline>) {
  const { today } = input;
  const m = bodyMetrics(input.profile);
  const from15 = addDays(today, -15);
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const a = input.objective ? ascent(input.objective, input.profile) : undefined;
  const sorted = [...input.sessions].sort((x, y) => x.date.localeCompare(y.date) || x.order - y.order);
  const tw = base.targetWeek;
  return {
    today: `${fmtDay(today)} (${today})`,
    athlete: {
      sex: input.profile.sex,
      age: new Date(today).getFullYear() - input.profile.birthYear,
      weightKg: input.profile.weightKg,
      bodyFatPct: input.profile.bodyFatPct,
      leanMassKg: Math.round(m.leanMassKg * 10) / 10,
      experience: input.objective?.experience,
      phase: input.nutrition?.phase ?? input.profile.goal,
    },
    objective: input.objective && a && { progressPct: Math.round(a.progress * 100), level: LEVELS[a.level].name, targetBodyFatPct: input.objective.target.bodyFatPct },
    program: { name: input.plan.name, weeks: input.plan.weeks, trainingDays: input.plan.trainingDays.map((d) => DAY[d]) },
    last15Days: sorted
      .filter((s) => s.date >= from15 && s.date < today)
      .map((s) => ({
        date: fmtDay(s.date),
        title: s.title,
        status: s.status === 'planned' ? 'missed' : s.status,
        executed: summarizeExecuted(input.training.filter((t) => t.planSessionId === s.id)) || undefined,
      })),
    otherTraining: input.training.filter((t) => !t.planSessionId && t.date >= from15 && t.date < today).map((t) => `${fmtDay(t.date)} ${t.exerciseName} ${t.durationMin} min`),
    signals: base.signals && {
      adherenceLast14Days: base.signals.adherence != null ? `${base.signals.done}/${base.signals.due}` : 'not enough history',
      liftsImproved: base.signals.improved,
      liftsDeclined: base.signals.declined,
      liftTrends: base.signals.trends.map((t) => `${t.name} ${t.changePct > 0 ? '+' : ''}${t.changePct.toFixed(1)}%`),
      weeksSinceLighterWeek: base.signals.weeksSinceLighter,
    },
    checkInsLast14Days: (input.checkIns ?? [])
      .filter((c) => c.date >= addDays(today, -14) && c.date <= today)
      .map((c) => ({ date: fmtDay(c.date), sleepHours: c.sleepHours, sleepQuality: c.sleepQuality, mood: c.mood, energy: c.energy, stress: c.stress, soreness: c.soreness, note: c.note })),
    thisWeekOpenSessions: sorted
      .filter((s) => s.status === 'planned' && s.date >= weekStart && s.date <= weekEnd && (!tw || s.week < tw))
      .map((s) => ({ session_id: s.id, date: s.date, day: DAY[weekday(s.date)], overdue: s.date < today, title: s.title })),
    nextWeek: tw && {
      week: tw,
      starts: fmtDay(planWeekStart(input.plan, tw)),
      options: base.options.map((o) => ({ option_id: o.id, title: o.title, description: o.description, sessions: o.sessions, hardSets: o.hardSets, minutes: o.minutes })),
    },
    nutrition: input.nutrition && { targetRatePctPerWeek: input.nutrition.targetRatePct, trainingDay: input.nutrition.training, restDay: input.nutrition.rest },
    last10DaysIntake: Array.from({ length: 10 }, (_, i) => addDays(today, -10 + i)).map((d) => {
      const e = input.food.filter((f) => f.date === d);
      return { date: fmtDay(d), trainingDay: base.isTrainingDay(d), kcal: Math.round(e.reduce((s, x) => s + (x.nutrients.kcal ?? 0), 0)), protein: Math.round(e.reduce((s, x) => s + (x.nutrients.protein ?? 0), 0)) };
    }),
    weighIns: input.bodyLog.filter((b) => b.date >= addDays(today, -21)).map((b) => ({ date: b.date, weightKg: b.weightKg, bodyFatPct: b.bodyFatPct })),
    ruleBasedSuggestion: {
      thisWeek: base.schedule.map(describeChange),
      nextWeek: base.ruleChoice && { option_id: base.ruleChoice.option.id, reason: base.ruleChoice.reason },
      nutrition: base.nutrition && { wouldChange: base.nutrition.changed, reasons: base.nutrition.reasons, proposed: base.nutrition.changed ? { trainingDay: base.nutrition.plan.training, restDay: base.nutrition.plan.rest } : undefined },
    },
  };
}

export const COACH_TOOLS: ToolDef[] = [
  {
    name: 'choose_week',
    description: 'Choose which pre-designed week the athlete runs next (nextWeek.options). Call exactly once when nextWeek is present.',
    input_schema: {
      type: 'object',
      properties: { option_id: { type: 'string', enum: ['standard', 'repeat', 'lighter', 'condensed', 'skip-deload'] }, reason: { type: 'string', description: 'One sentence for the athlete.' } },
      required: ['option_id', 'reason'],
    },
  },
  {
    name: 'reschedule_session',
    description: 'Move an open session of this week (thisWeekOpenSessions, including overdue ones) to a date between today and the end of this week. One session per day.',
    input_schema: {
      type: 'object',
      properties: { session_id: { type: 'string' }, new_date: { type: 'string', description: 'YYYY-MM-DD' }, reason: { type: 'string' } },
      required: ['session_id', 'new_date', 'reason'],
    },
  },
  {
    name: 'skip_session',
    description: 'Mark an open session of this week as skipped (e.g. no days left).',
    input_schema: { type: 'object', properties: { session_id: { type: 'string' }, reason: { type: 'string' } }, required: ['session_id', 'reason'] },
  },
  {
    name: 'set_nutrition_targets',
    description:
      'Change daily targets — only when the last 10 days show it is necessary. Carbohydrate is computed from the rest. Limits: calories within ±300 of current and above a safe floor; protein 1.6 g/kg body weight to 3.1 g/kg lean mass; fat ≥ 0.6 g/kg and ≥ 20 % of calories.',
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

export const COACH_SYSTEM = `You are the coach inside Micenae, a training and nutrition app. The training programs are fixed and evidence-based: every week is pre-designed. Your job is to DECIDE, from the athlete's data (JSON in the user message):

1. Which pre-designed week runs next (choose_week, exactly once if nextWeek is present):
   - standard: progress as planned — the default when training is going well.
   - repeat: same loading again — when several sessions were missed, or lifts stalled without signs of fatigue.
   - lighter: pull a lighter week forward — when lifts are declining, recovery is poor (short sleep, low energy, high soreness or stress in checkInsLast14Days), or many weeks passed without one.
   - condensed: fewer, longer sessions — when the athlete clearly can't fit the full number of days (repeated misses), so the week is still completed.
   - skip-deload: skip a scheduled lighter week — only when adherence is high and lifts are climbing (lighter weeks don't add muscle by themselves).
   "ruleBasedSuggestion.nextWeek" is a careful rule-based pick; agree unless the data gives you a clear reason not to.
2. Where this week's missed sessions go (reschedule_session / skip_session): prefer a free day this week; never two sessions on one day; avoid three lifting days in a row; skip if no days remain.
3. Nutrition: change targets ONLY if necessary. Follow "ruleBasedSuggestion.nutrition" unless the data clearly says otherwise. Poor adherence → fix adherence, not targets. Losing faster than ~1 %/week risks muscle.

Finish with a short summary for the athlete: what you decided and why (one line each), and one thing to focus on this week. No preamble.`;

interface CoachState {
  sessions: Map<string, PlannedSession>;
  nutrition?: NutritionPlan;
  changes: string[];
  week?: { option: WeekOption; reason: string };
}

export function executeCoachTool(name: string, input: Record<string, any>, ctx: { input: ReviewInput; state: CoachState; options: WeekOption[]; targetWeek?: number }) {
  const { input: ri, state } = ctx;
  const weekStart = startOfWeek(ri.today);
  const lastAllowed = ctx.targetWeek ? addDays(planWeekStart(ri.plan, ctx.targetWeek), -1) : endOfWeek(ri.today);
  const weekEnd = lastAllowed < endOfWeek(ri.today) ? lastAllowed : endOfWeek(ri.today);
  const open = (id: string) => {
    const s = state.sessions.get(id);
    if (!s) throw new ToolError(`Unknown session_id "${id}".`);
    if (s.status !== 'planned' || s.date < weekStart || s.date > endOfWeek(ri.today) || (ctx.targetWeek && s.week >= ctx.targetWeek))
      throw new ToolError(`Session ${id} is not an open session of this week.`);
    return s;
  };
  switch (name) {
    case 'choose_week': {
      if (!ctx.options.length) throw new ToolError('There is no upcoming week to choose (the program is complete).');
      const option = ctx.options.find((o) => o.id === input.option_id);
      if (!option) throw new ToolError(`Not an available option. Choose one of: ${ctx.options.map((o) => o.id).join(', ')}.`);
      state.week = { option, reason: String(input.reason ?? '') };
      return { ok: true, chosen: option.title };
    }
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
  const base = baseline(input);
  // misses from earlier weeks are closed by rule before the coach looks
  const stale = base.schedule.filter((c) => !c.to && c.from < startOfWeek(input.today));
  const sessions = applyChanges(input.sessions, stale);
  const working: ReviewInput = { ...input, sessions };
  const state: CoachState = { sessions: new Map(sessions.map((s) => [s.id, s])), nutrition: input.nutrition, changes: stale.map(describeChange) };
  const user = `Review data:\n${JSON.stringify(coachContext(working, { ...base, schedule: base.schedule.filter((c) => !stale.includes(c)) }), null, 1)}`;
  const summary = await runAgentTask(
    cfg,
    {
      system: COACH_SYSTEM,
      tools: COACH_TOOLS,
      user,
      execute: (n, i) => executeCoachTool(n, i, { input: working, state, options: base.options, targetWeek: base.targetWeek }),
      maxTokens: 2500,
    },
    onEvent,
    signal,
  );
  // if the coach didn't choose, fall back to the rule-based pick
  const pick = state.week ?? (base.ruleChoice ? { option: base.ruleChoice.option, reason: `${base.ruleChoice.reason} (rule-based — the assistant didn't choose)` } : undefined);
  const week = pick ? applyWeek(base.program, working, base.targetWeek, pick.option, pick.reason, state.week ? 'assistant' : 'rules', base.options) : undefined;
  if (week && week.decision.chosen.id !== 'standard') state.changes.push(`Week ${week.decision.week}: ${week.decision.chosen.title}`);
  const changed = [...state.sessions.values()].filter((s) => input.sessions.find((o) => o.id === s.id) !== s);
  return { by: 'assistant', summary, changes: state.changes, sessions: changed, week, nutrition: state.nutrition !== input.nutrition ? state.nutrition : undefined };
}

export type { TrainingSignals };

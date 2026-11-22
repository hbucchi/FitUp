import type { CheckIn, Exercise, Food, FoodEntry, Meal, Symptom, SymptomKind, TrainingEntry } from '../domain/types';
import { SYMPTOM_KINDS } from '../domain/types';
import { MEALS } from '../domain/types';
import { scaleNutrients } from '../domain/nutrients';
import { gramsFor } from '../domain/portions';
import { INTENSITY, MINUTES_PER_SET, type Intensity } from '../domain/exercises';
import { estimateActivity } from '../domain/energy';
import { normalize, search, type SearchIndex } from '../data/search';
import { uid, useStore } from '../data/store';

/** Provider-neutral tool definition (JSON Schema input). */
export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type LoggedItem =
  | { kind: 'food'; entry: FoodEntry }
  | { kind: 'training'; entry: TrainingEntry }
  | { kind: 'checkin'; entry: CheckIn & { id: string }; previous?: CheckIn }
  | { kind: 'symptom'; entry: Symptom };

export interface AgentContext {
  date: string;
  index: SearchIndex;
  byId: Map<string, Food>;
  boost?: Record<string, number>;
  exercises: Exercise[];
  weightKg: number;
  /** filled while the agent runs */
  logged: LoggedItem[];
  /** the day's check-in as it was before this run (for undo); null = there was none */
  checkInBefore?: CheckIn | null;
  created: Map<string, Food>;
}

const HHMM = { type: 'string', pattern: '^\\d{2}:\\d{2}$', description: '24h time, e.g. "13:30"' };

export const TOOLS: ToolDef[] = [
  {
    name: 'search_foods',
    description:
      "Search the user's food catalog (USDA FoodData Central plus the user's own foods). Returns up to 8 matches with nutrients per 100 g and the household portions you can log with. Search with short generic names, e.g. 'chicken breast roasted', 'rice white cooked', 'egg scrambled'.",
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'log_food',
    description:
      "Write one food entry to the diary. `unit` must be 'g' or EXACTLY one of the portion labels returned by search_foods for that food; quantity is how many of that unit.",
    input_schema: {
      type: 'object',
      properties: {
        food_id: { type: 'string' },
        quantity: { type: 'number', exclusiveMinimum: 0 },
        unit: { type: 'string' },
        meal: { type: 'string', enum: [...MEALS] },
        time: HHMM,
      },
      required: ['food_id', 'quantity', 'unit', 'meal'],
    },
  },
  {
    name: 'create_food',
    description:
      'Create a food that is not in the catalog (restaurant dish, branded product), with your best nutrition estimate PER SERVING. Only use this after searching found nothing suitable. Returns the new food id to log.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        serving_label: { type: 'string', description: 'e.g. "plate", "bar", "burrito"' },
        serving_grams: { type: 'number', exclusiveMinimum: 0 },
        kcal: { type: 'number', minimum: 0 },
        protein_g: { type: 'number', minimum: 0 },
        carbs_g: { type: 'number', minimum: 0 },
        fat_g: { type: 'number', minimum: 0 },
        fiber_g: { type: 'number', minimum: 0 },
      },
      required: ['name', 'serving_label', 'serving_grams', 'kcal', 'protein_g', 'carbs_g', 'fat_g'],
    },
  },
  {
    name: 'search_exercises',
    description: "Search the user's exercise library (aerobic and weight training). Empty query lists everything.",
    input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
  {
    name: 'log_training',
    description:
      'Write one exercise to the diary. Aerobic: give duration_min (and distance_km if known). Weight training: give sets (reps and weight_kg, 0 for bodyweight).',
    input_schema: {
      type: 'object',
      properties: {
        exercise_id: { type: 'string' },
        duration_min: { type: 'number', exclusiveMinimum: 0 },
        distance_km: { type: 'number', minimum: 0 },
        intensity: { type: 'string', enum: ['light', 'moderate', 'vigorous'] },
        sets: {
          type: 'array',
          items: {
            type: 'object',
            properties: { reps: { type: 'number', minimum: 1 }, weight_kg: { type: 'number', minimum: 0 } },
            required: ['reps', 'weight_kg'],
          },
        },
        time: HHMM,
      },
      required: ['exercise_id'],
    },
  },
  {
    name: 'log_checkin',
    description:
      "Record the user's daily check-in when they mention sleep, mood, energy, stress or soreness. Scales are 1 (low) to 5 (high). Only include what they said; it merges with what's already logged today.",
    input_schema: {
      type: 'object',
      properties: {
        sleep_hours: { type: 'number', minimum: 0, maximum: 16 },
        sleep_quality: { type: 'integer', minimum: 1, maximum: 5 },
        mood: { type: 'integer', minimum: 1, maximum: 5 },
        energy: { type: 'integer', minimum: 1, maximum: 5 },
        stress: { type: 'integer', minimum: 1, maximum: 5 },
        soreness: { type: 'integer', minimum: 1, maximum: 5 },
        note: { type: 'string' },
      },
    },
  },
  {
    name: 'log_symptom',
    description:
      'Record a symptom the user mentions — headache, cramp, pain, fatigue, nausea, dizziness, stomach upset, cold/flu or other. One call per symptom. Severity 1 (mild) to 5 (severe); estimate from their words if not given.',
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: Object.keys(SYMPTOM_KINDS) },
        severity: { type: 'integer', minimum: 1, maximum: 5 },
        body_part: { type: 'string', description: 'e.g. "left calf", "lower back" — for cramps and pain' },
        time: HHMM,
        note: { type: 'string', description: 'Short context, e.g. "during the run"' },
      },
      required: ['kind', 'severity'],
    },
  },
];

const r1 = (v: number | undefined) => (v == null ? undefined : Math.round(v * 10) / 10);

function describeFood(f: Food) {
  return {
    id: f.id,
    name: f.name,
    source: f.source,
    per_100g: { kcal: r1(f.nutrients.kcal), protein_g: r1(f.nutrients.protein), carbs_g: r1(f.nutrients.carbs), fat_g: r1(f.nutrients.fat) },
    portions: f.portions.slice(0, 8).map((p) => ({ unit: p.label, grams: p.grams })),
  };
}

export class ToolError extends Error {}

type Input = Record<string, any>; // validated below

export function executeTool(name: string, input: Input, ctx: AgentContext): unknown {
  const store = useStore.getState();
  const food = (id: string) => ctx.created.get(id) ?? ctx.byId.get(id);

  switch (name) {
    case 'search_foods': {
      const hits = search(ctx.index, String(input.query ?? ''), { limit: 8, boost: ctx.boost });
      const extra = [...ctx.created.values()].filter((f) => normalize(f.name).includes(normalize(String(input.query))));
      const foods = [...extra, ...hits.map((h) => h.food)].slice(0, 8);
      return foods.length ? foods.map(describeFood) : { matches: [], hint: 'No matches. Try a shorter or more generic query.' };
    }
    case 'log_food': {
      const f = food(String(input.food_id));
      if (!f) throw new ToolError(`Unknown food_id "${input.food_id}". Use an id returned by search_foods or create_food.`);
      const unit = String(input.unit);
      if (unit !== 'g' && !f.portions.some((p) => p.label === unit))
        throw new ToolError(`Invalid unit "${unit}" for this food. Valid units: ${['g', ...f.portions.map((p) => p.label)].map((u) => `"${u}"`).join(', ')}`);
      const quantity = Number(input.quantity);
      if (!(quantity > 0)) throw new ToolError('quantity must be > 0');
      const meal = MEALS.includes(input.meal) ? (input.meal as Meal) : 'snack';
      const grams = gramsFor(f, quantity, unit);
      const entry: FoodEntry = {
        id: uid(), date: ctx.date, time: input.time, meal, foodId: f.id, foodName: f.name,
        quantity, unit, grams, nutrients: scaleNutrients(f.nutrients, grams), via: 'agent',
      };
      store.addFoodEntries([entry]);
      ctx.logged.push({ kind: 'food', entry });
      return { logged: true, entry_id: entry.id, food: f.name, grams: Math.round(grams), kcal: Math.round(entry.nutrients.kcal ?? 0), meal };
    }
    case 'create_food': {
      const g = Number(input.serving_grams);
      if (!(g > 0)) throw new ToolError('serving_grams must be > 0');
      const k = 100 / g;
      const f: Food = {
        id: `custom:${uid()}`,
        name: String(input.name),
        category: 'Assistant estimates',
        source: 'AI estimate',
        nutrients: {
          kcal: Number(input.kcal) * k, protein: Number(input.protein_g) * k, carbs: Number(input.carbs_g) * k, fat: Number(input.fat_g) * k,
          ...(input.fiber_g != null ? { fiber: Number(input.fiber_g) * k } : {}),
        },
        portions: [{ label: String(input.serving_label || 'serving'), grams: g }],
      };
      store.saveCustomFood(f);
      ctx.created.set(f.id, f);
      return describeFood(f);
    }
    case 'search_exercises': {
      const q = normalize(String(input.query ?? '')).trim();
      const words = q.split(/\s+/).filter(Boolean);
      const list = ctx.exercises.filter((e) => {
        const hay = normalize(`${e.name} ${e.group} ${e.equipment ?? ''} ${e.kind}`);
        return words.every((w) => hay.includes(w.replace(/s$/, '')));
      });
      return list.slice(0, 15).map((e) => ({ id: e.id, name: e.name, kind: e.kind, group: e.group, distance: !!e.distance }));
    }
    case 'log_training': {
      const ex = ctx.exercises.find((e) => e.id === input.exercise_id);
      if (!ex) throw new ToolError(`Unknown exercise_id "${input.exercise_id}". Use search_exercises first.`);
      const sets = Array.isArray(input.sets) ? input.sets.map((s: Input) => ({ reps: Number(s.reps), weightKg: Number(s.weight_kg) || 0 })) : undefined;
      if (ex.kind === 'strength' && !sets?.length && !input.duration_min) throw new ToolError('Weight training needs sets (or at least duration_min).');
      if (ex.kind === 'aerobic' && !input.duration_min) throw new ToolError('Aerobic exercise needs duration_min.');
      const minutes = Number(input.duration_min) || Math.round((sets?.length ?? 0) * MINUTES_PER_SET);
      const intensity: Intensity = input.intensity in INTENSITY ? input.intensity : 'moderate';
      const distanceKm = input.distance_km != null ? Number(input.distance_km) : undefined;
      const est = estimateActivity({ exercise: ex, minutes, weightKg: ctx.weightKg, intensity, distanceKm });
      const entry: TrainingEntry = {
        id: uid(), date: ctx.date, time: input.time, exerciseId: ex.id, exerciseName: ex.name, kind: ex.kind,
        durationMin: minutes, distanceKm, sets: ex.kind === 'strength' ? sets : undefined, kcal: est.kcal, netKcal: est.netKcal,
      };
      store.addTraining(entry);
      ctx.logged.push({ kind: 'training', entry });
      return { logged: true, entry_id: entry.id, exercise: ex.name, minutes, kcal: entry.kcal, kcal_range: `${est.low}-${est.high}`, method: est.method };
    }
    case 'log_checkin': {
      const scale = (v: unknown) => {
        if (v == null) return undefined;
        const n = Math.round(Number(v));
        if (!(n >= 1 && n <= 5)) throw new ToolError('Scales go from 1 to 5.');
        return n;
      };
      const hours = input.sleep_hours != null ? Number(input.sleep_hours) : undefined;
      if (hours != null && !(hours >= 0 && hours <= 16)) throw new ToolError('sleep_hours must be between 0 and 16.');
      const prev = store.checkIns.find((c) => c.date === ctx.date) ?? { date: ctx.date };
      const next = {
        ...prev,
        ...(hours != null && { sleepHours: Math.round(hours * 2) / 2 }),
        ...(input.sleep_quality != null && { sleepQuality: scale(input.sleep_quality) }),
        ...(input.mood != null && { mood: scale(input.mood) }),
        ...(input.energy != null && { energy: scale(input.energy) }),
        ...(input.stress != null && { stress: scale(input.stress) }),
        ...(input.soreness != null && { soreness: scale(input.soreness) }),
        ...(input.note && { note: String(input.note) }),
      };
      // remember the day's check-in as it was before this run, once, so Undo restores it exactly
      if (ctx.checkInBefore === undefined) ctx.checkInBefore = store.checkIns.find((c) => c.date === ctx.date) ?? null;
      store.saveCheckIn(next);
      ctx.logged = ctx.logged.filter((l) => l.kind !== 'checkin');
      ctx.logged.push({ kind: 'checkin', entry: { ...next, id: `checkin-${ctx.date}` }, previous: ctx.checkInBefore ?? undefined });
      return { logged: true, checkin: next };
    }
    case 'log_symptom': {
      const kind = String(input.kind) as SymptomKind;
      if (!(kind in SYMPTOM_KINDS)) throw new ToolError(`kind must be one of: ${Object.keys(SYMPTOM_KINDS).join(', ')}`);
      const severity = Math.round(Number(input.severity));
      if (!(severity >= 1 && severity <= 5)) throw new ToolError('severity goes from 1 to 5.');
      const symptom: Symptom = {
        id: uid(), date: ctx.date, kind, severity, via: 'agent',
        ...(input.time && { time: String(input.time) }),
        ...(input.body_part && { bodyPart: String(input.body_part) }),
        ...(input.note && { note: String(input.note) }),
      };
      store.saveSymptom(symptom);
      ctx.logged.push({ kind: 'symptom', entry: symptom });
      return { logged: true, symptom };
    }
    default:
      throw new ToolError(`Unknown tool ${name}`);
  }
}

export function systemPrompt(ctx: AgentContext, now = new Date()): string {
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return `You are the logging assistant inside Micenae, a training and nutrition diary.
The user describes (in text or a transcribed voice note) what they ate, how they trained and/or how they feel. Record it in their diary for ${ctx.date}. The current local time is ${time}.

How to work:
- Split the description into individual foods and exercises. Log each one exactly once.
- For each food, call search_foods first, then pick the catalog item that best matches the food AND its preparation. If unstated, assume the form normally eaten: cooked meat, fish, rice and pasta; raw fruit; brewed coffee.
- Amounts: when the user names a household measure (a cup, 2 slices, a large egg), log with the matching portion label from the search result. Otherwise log in grams, converting other units yourself (1 oz = 28.35 g, 1 lb = 453.6 g, ml ≈ g for drinks). If no amount is given, assume one typical portion.
- Meals: ${MEALS.join(', ')}. Use the meal the user names. Otherwise infer it from the time mentioned, or from the current time (05–11 breakfast, 11–15 lunch, 18–22 dinner, otherwise snack). Set "time" when the user states one.
- Only call create_food when 2 sensible searches find nothing suitable (e.g. a specific restaurant dish or a branded product). Give a careful per-serving estimate.
- For training, call search_exercises, then log_training with the details given.
- If they mention sleep, mood, energy, stress or soreness, call log_checkin (scales 1–5; "tired" ≈ energy 2, "great" ≈ 5).
- If they mention a symptom (headache, cramp, pain, nausea…), call log_symptom once per symptom. Record it; don't diagnose.
- If a tool returns an error, correct the call and retry.
- Never ask questions. Make reasonable assumptions instead.

When finished, reply with a short summary: one line per logged item (amount, food, kcal), then any assumptions you made. No preamble.`;
}

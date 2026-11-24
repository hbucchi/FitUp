import type { Food } from '../domain/types';
import type { Nutrients } from '../domain/nutrients';
import { uid } from '../data/store';
import { t } from '../i18n';
import { isReasoningModel, type AgentConfig } from './runAgent';

/**
 * Reads a photographed nutrition-facts table — the producer's own declaration — with a vision model.
 *
 * The model must answer through one function call (a fixed JSON form), copying the numbers as
 * printed. The app then converts them to per-100 g and checks them with the energy equation
 * (≈ 4 kcal/g protein and carbohydrate, 9 kcal/g fat), so a misread digit is caught.
 */

const NUM = { type: 'number', minimum: 0 };

/** label field → our nutrient key, and the multiplier from the label's unit to ours */
const FIELDS: [string, keyof Nutrients, number, string][] = [
  ['kcal', 'kcal', 1, 'energy in kcal (if only kJ is printed, divide by 4.184)'],
  ['protein_g', 'protein', 1, 'protein, g'],
  ['carbs_g', 'carbs', 1, 'total carbohydrate, g'],
  ['sugars_g', 'sugar', 1, 'total sugars, g'],
  ['fat_g', 'fat', 1, 'total fat, g'],
  ['sat_fat_g', 'satFat', 1, 'saturated fat, g'],
  ['trans_fat_g', 'transFat', 1, 'trans fat, g'],
  ['fiber_g', 'fiber', 1, 'dietary fiber, g'],
  ['sodium_mg', 'sodium', 1, 'sodium, mg (if only salt is printed: salt g × 400)'],
  ['cholesterol_mg', 'cholesterol', 1, 'cholesterol, mg'],
  ['potassium_mg', 'potassium', 1, 'potassium, mg'],
  ['calcium_mg', 'calcium', 1, 'calcium, mg'],
  ['iron_mg', 'iron', 1, 'iron, mg'],
  ['magnesium_mg', 'magnesium', 1, 'magnesium, mg'],
  ['zinc_mg', 'zinc', 1, 'zinc, mg'],
  ['vit_a_mcg', 'vitA', 1, 'vitamin A, µg RAE'],
  ['vit_c_mg', 'vitC', 1, 'vitamin C, mg'],
  ['vit_d_mcg', 'vitD', 1, 'vitamin D, µg'],
  ['vit_b12_mcg', 'vitB12', 1, 'vitamin B12, µg'],
  ['caffeine_mg', 'caffeine', 1, 'caffeine, mg'],
];

const TOOL = {
  name: 'record_label',
  description: 'Record the nutrition table exactly as printed on the package.',
  input_schema: {
    type: 'object',
    properties: {
      readable: { type: 'boolean', description: 'false if no nutrition table is legible in the photo' },
      name: { type: 'string', description: 'Product name if visible, else a short description' },
      brand: { type: 'string' },
      column: { type: 'string', enum: ['per_100g', 'per_serving'], description: 'Which column you copied. Prefer per 100 g / 100 ml when printed.' },
      serving_label: { type: 'string', description: 'Printed serving description, e.g. "2 fatias", "1 scoop", "1 bar"' },
      serving_grams: { ...NUM, description: 'Serving size in g (or ml) as printed' },
      ...Object.fromEntries(FIELDS.map(([k, , , d]) => [k, { ...NUM, description: d }])),
    },
    required: ['readable', 'name', 'column', 'kcal', 'protein_g', 'carbs_g', 'fat_g'],
  },
};

const SYSTEM = `You read photographs of food nutrition-facts tables (Brazilian "Informação Nutricional", EU, US formats).
Copy the numbers exactly as printed — never estimate or fill in from general knowledge. Leave out any nutrient that isn't printed.
Prefer the per-100 g (or 100 ml) column; if only a per-serving column exists, copy that and give the serving size in grams.
Labels use a decimal comma ("2,5 g" = 2.5). "0" and "não contém"/"zero" are 0. Ignore the %VD/%DV columns.
If the photo has no legible nutrition table, call the tool with readable=false and zeros.`;

const num = (v: unknown) => (v == null || v === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));

export interface LabelReading {
  food: Food;
  /** energy equation off by more than 15 % — ask the user to double-check */
  warning?: string;
}

/** kcal declared vs kcal from 4/4/9; labels round and fibre/polyols/alcohol add a little, so ±15 %. */
export function energyCheck(n: Nutrients): { expected: number; off: number } | null {
  if (n.kcal == null || n.protein == null || n.carbs == null || n.fat == null) return null;
  const expected = 4 * n.protein + 4 * n.carbs + 9 * n.fat;
  if (Math.max(expected, n.kcal) < 20) return null; // near-zero foods (water, diet soda)
  return { expected, off: Math.abs(n.kcal - expected) / Math.max(n.kcal, expected) };
}

/** Turns the model's form into a Food (per 100 g) — exported for tests. */
export function labelToFood(x: Record<string, unknown>, barcode?: string): LabelReading {
  if (x.readable === false) throw new Error(t('No nutrition table could be read in the photo. Try again closer, flat and in good light.'));
  const perServing = x.column === 'per_serving';
  const grams = Number(x.serving_grams) || 0;
  if (perServing && !(grams > 0)) throw new Error(t('The serving size could not be read — enter the values yourself.'));
  const k = perServing ? 100 / grams : 1;
  const nutrients: Nutrients = {};
  for (const [field, key, mult] of FIELDS) {
    const v = x[field];
    if (v != null && v !== '' && Number.isFinite(Number(v))) nutrients[key] = Number(v) * mult * k;
  }
  const portions = grams > 0 ? [{ label: String(x.serving_label || t('serving')), grams }] : [];
  const food: Food = {
    id: `custom:${uid()}`,
    name: String(x.name || t('Scanned product')),
    ...(x.brand ? { brand: String(x.brand) } : {}),
    category: 'My foods',
    source: 'Label photo',
    nutrients,
    portions,
    ...(barcode ? { barcode } : {}),
  };
  // checked on the printed numbers, so the warning matches what the user sees on the package
  const printed = { kcal: num(x.kcal), protein: num(x.protein_g), carbs: num(x.carbs_g), fat: num(x.fat_g) };
  const check = energyCheck(printed);
  const warning = check && check.off > 0.15
    ? t('Check the numbers: {kcal} kcal is printed, but protein, carbs and fat add up to {exp} kcal.', { kcal: Math.round(printed.kcal!), exp: Math.round(check.expected) })
    : undefined;
  return { food, warning };
}

/** Shrinks a photo to ≤1600 px JPEG (enough to read small print, a fraction of the upload). */
export async function photoToDataUrl(file: Blob, max = 1600): Promise<string> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * s);
  canvas.height = Math.round(bmp.height * s);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

async function post(url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal) {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status === 401 ? t('The API key was rejected ({msg}).', { msg: json?.error?.message ?? '' }) : json?.error?.message ?? `HTTP ${res.status}`);
  return json;
}

export async function readLabel(cfg: AgentConfig, dataUrl: string, barcode?: string, signal?: AbortSignal): Promise<LabelReading> {
  let args: Record<string, unknown> | undefined;
  if (cfg.provider === 'openai') {
    // Responses API: image input + a forced function call
    const body: Record<string, unknown> = {
      model: cfg.model,
      instructions: SYSTEM,
      input: [{ role: 'user', content: [{ type: 'input_text', text: 'Read this nutrition table.' }, { type: 'input_image', image_url: dataUrl, detail: 'high' }] }],
      tools: [{ type: 'function', name: TOOL.name, description: TOOL.description, parameters: TOOL.input_schema, strict: false }],
      tool_choice: { type: 'function', name: TOOL.name },
      store: false,
    };
    if (isReasoningModel(cfg.model)) body.reasoning = { effort: 'low' };
    const res = await post('https://api.openai.com/v1/responses', { authorization: `Bearer ${cfg.apiKey}` }, body, signal);
    const call = (res.output ?? []).find((o: { type: string }) => o.type === 'function_call');
    if (call) args = JSON.parse(call.arguments || '{}');
  } else {
    const [, mediaType, data] = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/) ?? [];
    const res = await post(
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      {
        model: cfg.model,
        max_tokens: 1024,
        system: SYSTEM,
        tools: [TOOL],
        tool_choice: { type: 'tool', name: TOOL.name },
        messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mediaType, data } }, { type: 'text', text: 'Read this nutrition table.' }] }],
      },
      signal,
    );
    args = (res.content as { type: string; input?: Record<string, unknown> }[]).find((b) => b.type === 'tool_use')?.input;
  }
  if (!args) throw new Error(t('No nutrition table could be read in the photo. Try again closer, flat and in good light.'));
  return labelToFood(args, barcode);
}

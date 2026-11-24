import { afterEach, describe, expect, test, vi } from 'vitest';
import { energyCheck, labelToFood, readLabel } from '../agent/label';

afterEach(() => vi.unstubAllGlobals());

// A Brazilian whey label, per serving (30 g): 120 kcal, 24 g protein, 2,5 g carbs, 1,6 g fat, 50 mg sodium
const WHEY = { readable: true, name: 'Whey Protein Concentrado', brand: 'Marca X', column: 'per_serving', serving_label: '1 scoop', serving_grams: 30, kcal: 120, protein_g: 24, carbs_g: 2.5, fat_g: 1.6, sodium_mg: 50, calcium_mg: 150 };

describe('nutrition label → food', () => {
  test('per-serving numbers become per 100 g, keeping the printed serving as a portion', () => {
    const { food, warning } = labelToFood(WHEY, '7891234567895');
    expect(food.nutrients.kcal).toBeCloseTo(400);
    expect(food.nutrients.protein).toBeCloseTo(80);
    expect(food.nutrients.sodium).toBeCloseTo(166.7, 1);
    expect(food.nutrients.calcium).toBeCloseTo(500);
    expect(food.portions).toEqual([{ label: '1 scoop', grams: 30 }]);
    expect(food).toMatchObject({ source: 'Label photo', barcode: '7891234567895', brand: 'Marca X' });
    expect(warning).toBeUndefined(); // 4·24 + 4·2.5 + 9·1.6 = 120.4 ≈ 120
  });
  test('a misread number is flagged by the energy equation', () => {
    const { warning } = labelToFood({ ...WHEY, protein_g: 74 }); // "24" read as "74"
    expect(warning).toMatch(/120 kcal/);
    expect(energyCheck({ kcal: 120, protein: 74, carbs: 2.5, fat: 1.6 })!.off).toBeGreaterThan(0.15);
  });
  test('unreadable photos and missing serving sizes are clear errors', () => {
    expect(() => labelToFood({ ...WHEY, readable: false })).toThrow(/could be read|ler a tabela|No nutrition table/);
    expect(() => labelToFood({ ...WHEY, serving_grams: 0 })).toThrow(/serving size|porção/);
  });
  test('per-100 g column is used as is', () => {
    const { food } = labelToFood({ readable: true, name: 'Aveia', column: 'per_100g', kcal: 394, protein_g: 14, carbs_g: 67, fat_g: 7.3, fiber_g: 9.1 });
    expect(food.nutrients).toMatchObject({ kcal: 394, protein: 14, fiber: 9.1 });
    expect(food.portions).toEqual([]);
  });
});

describe('vision requests', () => {
  const image = 'data:image/jpeg;base64,AAAA';
  test('OpenAI: Responses API with image input and a forced function call', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ output: [{ type: 'function_call', call_id: 'x', name: 'record_label', arguments: JSON.stringify(WHEY) }] }) }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await readLabel({ provider: 'openai', apiKey: 'k', model: 'gpt-5.4-mini' }, image, '7891234567895');
    expect((fetchMock.mock.calls[0] as any)[0]).toBe('https://api.openai.com/v1/responses');
    const body = JSON.parse((fetchMock.mock.calls[0] as any)[1].body);
    expect(body.input[0].content[1]).toEqual({ type: 'input_image', image_url: image, detail: 'high' });
    expect(body.tool_choice).toEqual({ type: 'function', name: 'record_label' });
    expect(body.reasoning).toEqual({ effort: 'low' });
    expect(body.instructions).toMatch(/never estimate/);
    expect(r.food.nutrients.protein).toBeCloseTo(80);
  });
  test('Claude: base64 image block + forced tool', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ content: [{ type: 'tool_use', name: 'record_label', input: WHEY }] }) }));
    vi.stubGlobal('fetch', fetchMock);
    await readLabel({ provider: 'anthropic', apiKey: 'k', model: 'claude-sonnet-5-5' }, image);
    const body = JSON.parse((fetchMock.mock.calls[0] as any)[1].body);
    expect(body.messages[0].content[0]).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } });
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'record_label' });
  });
});

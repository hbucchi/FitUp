import { afterEach, describe, expect, test, vi } from 'vitest';
import { lookupBarcode, validGtin, fromOff } from '../data/barcode';

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
afterEach(() => vi.restoreAllMocks());

test('GTIN check digits reject misreads', () => {
  expect(validGtin('7891000315507')).toBe(true); // a Brazilian EAN-13
  expect(validGtin('7891000315508')).toBe(false);
  expect(validGtin('036000291452')).toBe(true); // UPC-A
  expect(validGtin('12345')).toBe(false);
});

describe('lookup order and mapping', () => {
  test('Brazilian code → Open Food Facts first; mass nutrients converted from grams', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('openfoodfacts')
        ? ok({ status: 1, product: { product_name: 'Leite em pó', product_name_pt: 'Leite em pó integral', brands: 'Ninho, Nestlé', serving_quantity: 26, serving_size: '2 colheres (26 g)',
            nutriments: { 'energy-kcal_100g': 496, proteins_100g: 25, carbohydrates_100g: 38, fat_100g: 27, sodium_100g: 0.35, calcium_100g: 0.9, 'vitamin-a_100g': 0.00045 } } })
        : ok({ foods: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const f = await lookupBarcode('7891000315507');
    expect((fetchMock.mock.calls[0] as any)[0]).toContain('openfoodfacts');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(f).toMatchObject({ source: 'Open Food Facts', brand: 'Ninho', barcode: '7891000315507' });
    expect(f!.nutrients).toMatchObject({ kcal: 496, protein: 25, sodium: 350, calcium: 900, vitA: 450 });
    expect(f!.portions[0].grams).toBe(26);
  });

  test('US code → USDA Branded first, matched on GTIN with leading zeros ignored', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes('api.nal.usda.gov')
        ? ok({ foods: [
            { gtinUpc: '00099999999999', description: 'OTHER' },
            { gtinUpc: '036000291452', description: 'GREEK YOGURT, PLAIN', brandOwner: 'Acme', servingSize: 170, servingSizeUnit: 'g', householdServingFullText: '1 CONTAINER',
              foodNutrients: [{ nutrientId: 1008, value: 59 }, { nutrientId: 1003, value: 10.3 }, { nutrientId: 1093, value: 36 }] },
          ] })
        : ok({ status: 0 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const f = await lookupBarcode('036000291452');
    expect(f).toMatchObject({ source: 'USDA Branded', name: 'Greek Yogurt, Plain', brand: 'Acme' });
    expect(f!.nutrients).toMatchObject({ kcal: 59, protein: 10.3, sodium: 36 });
    expect(f!.portions).toEqual([{ label: '1 container', grams: 170 }]);
  });

  test('falls through to the second source, then null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) })));
    expect(await lookupBarcode('5000159484695')).toBeNull();
  });

  test('energy in kJ only is converted; products without energy are rejected', () => {
    expect(fromOff({ product_name: 'x', nutriments: { energy_100g: 418.4 } }, '1')!.nutrients.kcal).toBe(100);
    expect(fromOff({ product_name: 'x', nutriments: {} }, '1')).toBeNull();
  });
});

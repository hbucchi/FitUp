import { t } from '../i18n';
import type { Food } from '../domain/types';
import type { Nutrients } from '../domain/nutrients';
import { buildIndex, type SearchIndex } from './search';

/** Compact on-disk shape produced by scripts/import-usda.mjs */
interface RawFood {
  id: string;
  name: string;
  cat: string;
  src: string;
  n: Nutrients;
  p: { l: string; g: number }[];
  recipe?: string;
}

interface RawCatalog {
  generatedAt: string;
  sources: string[];
  license: string;
  foods: RawFood[];
}

export interface CatalogMeta {
  generatedAt: string;
  license: string;
  count: number;
}

export function fromRaw(r: RawFood): Food {
  return {
    id: r.id,
    name: r.name,
    category: r.cat,
    source: r.src,
    nutrients: r.n,
    portions: r.p.map((p) => ({ label: p.l, grams: p.g })),
    ...(r.recipe && { recipe: r.recipe }),
  };
}

let cache: Promise<{ foods: Food[]; meta: CatalogMeta }> | null = null;

async function loadFile(name: string): Promise<RawCatalog> {
  const r = await fetch(`${import.meta.env.BASE_URL}data/${name}`);
  if (!r.ok) throw new Error(t('Food catalog failed to load (HTTP {s})', { s: r.status }));
  return r.json();
}

/** USDA FoodData Central + TACO (Brazil). */
export function loadUsdaCatalog(): Promise<{ foods: Food[]; meta: CatalogMeta }> {
  cache ??= Promise.all([loadFile('usda-foods.json'), loadFile('taco-foods.json').catch(() => null)]).then(([usda, taco]) => {
    const foods = [...usda.foods, ...(taco?.foods ?? [])].map(fromRaw);
    return { foods, meta: { generatedAt: usda.generatedAt, license: usda.license, count: foods.length } };
  });
  cache.catch(() => (cache = null));
  return cache;
}

export function makeIndex(usda: Food[], custom: Food[]): SearchIndex {
  return buildIndex([...custom, ...usda]);
}

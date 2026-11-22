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
  };
}

let cache: Promise<{ foods: Food[]; meta: CatalogMeta }> | null = null;

export function loadUsdaCatalog(): Promise<{ foods: Food[]; meta: CatalogMeta }> {
  cache ??= fetch(`${import.meta.env.BASE_URL}data/usda-foods.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`Food catalog failed to load (HTTP ${r.status})`);
      return r.json() as Promise<RawCatalog>;
    })
    .then((raw) => ({
      foods: raw.foods.map(fromRaw),
      meta: { generatedAt: raw.generatedAt, license: raw.license, count: raw.foods.length },
    }));
  cache.catch(() => (cache = null));
  return cache;
}

export function makeIndex(usda: Food[], custom: Food[]): SearchIndex {
  return buildIndex([...custom, ...usda]);
}

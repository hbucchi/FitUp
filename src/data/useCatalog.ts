import { useEffect, useMemo, useState } from 'react';
import type { Food } from '../domain/types';
import { loadUsdaCatalog, makeIndex, type CatalogMeta } from './catalog';
import { useStore } from './store';

export function useCatalog() {
  const customFoods = useStore((s) => s.customFoods);
  const recent = useStore((s) => s.recentFoodIds);
  const [usda, setUsda] = useState<Food[] | null>(null);
  const [meta, setMeta] = useState<CatalogMeta | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadUsdaCatalog()
      .then((c) => alive && (setUsda(c.foods), setMeta(c.meta)))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const index = useMemo(() => makeIndex(usda ?? [], customFoods), [usda, customFoods]);
  const byId = useMemo(() => {
    const m = new Map<string, Food>();
    for (const f of usda ?? []) m.set(f.id, f);
    for (const f of customFoods) m.set(f.id, f);
    return m;
  }, [usda, customFoods]);
  const boost = useMemo(() => {
    const b: Record<string, number> = {};
    recent.forEach((id, i) => (b[id] = 0.3 - i * 0.005));
    return b;
  }, [recent]);

  return { ready: usda !== null, error, meta, index, byId, boost, customFoods };
}

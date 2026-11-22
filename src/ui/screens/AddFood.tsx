import { useMemo, useState } from 'react';
import type { Food, FoodEntry, Meal } from '../../domain/types';
import { MEALS, MEAL_LABEL } from '../../domain/types';
import { fmt, scaleNutrients, type Nutrients } from '../../domain/nutrients';
import { countPortion, gramsFor, unitOptions } from '../../domain/portions';
import { nowHHMM } from '../../domain/dates';
import { search } from '../../data/search';
import { uid, useStore } from '../../data/store';
import { useCatalog } from '../../data/useCatalog';
import { Sheet } from '../components/Sheet';
import { IconChevron, IconPlus, IconSearch } from '../components/Icons';
import { MacroLine } from '../components/Macros';
import { NutrientTable } from '../components/NutrientTable';
import { FoodEditor } from './FoodEditor';

/** Rebuild a food from a diary snapshot when the original is no longer in the catalog. */
export function foodFromEntry(e: FoodEntry): Food {
  const f = e.grams > 0 ? 100 / e.grams : 0;
  const n: Nutrients = {};
  for (const k in e.nutrients) n[k as keyof Nutrients] = (e.nutrients[k as keyof Nutrients] ?? 0) * f;
  const portions = e.unit !== 'g' && e.quantity > 0 ? [{ label: e.unit, grams: e.grams / e.quantity }] : [];
  return { id: e.foodId, name: e.foodName, category: 'Diary', source: 'Diary snapshot', nutrients: n, portions };
}

export function FoodSearchList({ onPick, autoFocus = true }: { onPick: (f: Food) => void; autoFocus?: boolean }) {
  const { ready, error, index, byId, boost } = useCatalog();
  const recentIds = useStore((s) => s.recentFoodIds);
  const [q, setQ] = useState('');
  const hits = useMemo(() => (q.trim() ? search(index, q, { limit: 40, boost }).map((h) => h.food) : []), [q, index, boost]);
  const recent = useMemo(() => recentIds.map((id) => byId.get(id)).filter(Boolean).slice(0, 12) as Food[], [recentIds, byId]);
  const list = q.trim() ? hits : recent;

  return (
    <div className="stack">
      <div className="input-wrap">
        <input
          className="input"
          type="search"
          placeholder={ready ? 'Search foods — e.g. "greek yogurt"' : 'Loading catalog…'}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus={autoFocus}
          aria-label="Search foods"
        />
        <span className="suffix"><IconSearch width={16} height={16} /></span>
      </div>
      {error && <div className="error">{error}</div>}
      {!q.trim() && recent.length > 0 && <div className="eyebrow">Recent</div>}
      {!q.trim() && recent.length === 0 && ready && (
        <p className="muted small" style={{ margin: 0 }}>Search the USDA catalog of {index.items.length.toLocaleString()} foods, or create your own.</p>
      )}
      {list.length > 0 && (
        <div className="card flush">
          <ul className="list">
            {list.map((f) => (
              <li key={f.id}>
                <button className="list-item" onClick={() => onPick(f)}>
                  <div className="main">
                    <div className="title">{f.name}</div>
                    <div className="sub">
                      {Math.round(f.nutrients.kcal ?? 0)} kcal · <MacroLine n={f.nutrients} /> <span className="muted">per 100 g</span>
                    </div>
                  </div>
                  {f.source === 'Custom' && <span className="badge">Mine</span>}
                  <IconChevron width={16} height={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {q.trim() && ready && hits.length === 0 && <p className="muted small">No matches for “{q}”.</p>}
    </div>
  );
}

export function AmountForm({ food, initial, onSubmit, submitLabel }: {
  food: Food;
  initial: { quantity: number; unit: string; meal: Meal; time: string };
  submitLabel: string;
  onSubmit: (v: { quantity: number; unit: string; meal: Meal; time: string; grams: number; nutrients: Nutrients }) => void;
}) {
  const [quantity, setQuantity] = useState<number | ''>(initial.quantity);
  const [unit, setUnit] = useState(initial.unit);
  const [meal, setMeal] = useState<Meal>(initial.meal);
  const [time, setTime] = useState(initial.time);
  const [showAll, setShowAll] = useState(false);
  const units = unitOptions(food);
  const grams = gramsFor(food, Number(quantity) || 0, unit);
  const n = scaleNutrients(food.nutrients, grams);

  return (
    <div className="stack">
      <div>
        <div className="h-section" style={{ fontSize: 19 }}>{food.name}</div>
        <div className="tiny muted">{food.source}{food.brand ? ` · ${food.brand}` : ''} · {food.category}</div>
      </div>
      <div className="grid2" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
        <label className="field">
          Quantity
          <input className="input num" type="number" inputMode="decimal" min={0} step="any" value={quantity}
            onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))} aria-label="Quantity" />
        </label>
        <label className="field">
          Unit
          <select className="input" value={unit} onChange={(e) => {
            const next = e.target.value;
            // keep the amount roughly the same when switching units
            const nextPortion = units.find((u) => u.label === next);
            if (nextPortion && grams > 0) setQuantity(Math.round((grams / nextPortion.grams) * 100) / 100);
            setUnit(next);
          }}>
            {units.map((u) => <option key={u.label} value={u.label}>{u.label === 'g' ? 'grams' : `${u.label} (${fmt(u.grams)} g)`}</option>)}
          </select>
        </label>
      </div>
      <div className="field">
        <span>Meal</span>
        <div className="chips">
          {MEALS.map((m) => <button type="button" key={m} className="chip" aria-pressed={m === meal} onClick={() => setMeal(m)}>{MEAL_LABEL[m]}</button>)}
        </div>
      </div>
      <label className="field" style={{ maxWidth: 160 }}>
        Time
        <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </label>

      <div className="card" style={{ marginBottom: 0 }}>
        <div className="row between">
          <div>
            <div className="big-num num">{Math.round(n.kcal ?? 0)}<span className="small muted" style={{ fontFamily: 'var(--font-body)', fontWeight: 500 }}> kcal</span></div>
            <div className="small" style={{ marginTop: 4 }}><MacroLine n={n} /></div>
          </div>
          <div className="muted small num">{fmt(grams)} g</div>
        </div>
        <button className="btn ghost" style={{ marginTop: 6, paddingLeft: 0 }} onClick={() => setShowAll((s) => !s)}>
          {showAll ? 'Hide' : 'Show'} full nutrients
        </button>
        {showAll && <NutrientTable n={n} />}
      </div>

      <button className="btn primary block" disabled={!quantity || grams <= 0}
        onClick={() => onSubmit({ quantity: Number(quantity), unit, meal, time, grams, nutrients: n })}>
        {submitLabel}
      </button>
    </div>
  );
}

export function AddFoodSheet({ date, meal, onClose, entry, food: presetFood }: {
  date: string; meal: Meal; onClose: () => void; entry?: FoodEntry; food?: Food;
}) {
  const { byId } = useCatalog();
  const addFoodEntries = useStore((s) => s.addFoodEntries);
  const updateFoodEntry = useStore((s) => s.updateFoodEntry);
  const removeFoodEntry = useStore((s) => s.removeFoodEntry);
  const [food, setFood] = useState<Food | undefined>(
    presetFood ?? (entry ? byId.get(entry.foodId) ?? foodFromEntry(entry) : undefined),
  );
  const [creating, setCreating] = useState(false);

  if (creating) {
    return (
      <Sheet title="New food" onClose={onClose} leading={<button className="icon-btn" aria-label="Back" onClick={() => setCreating(false)}><IconChevron dir="left" /></button>}>
        <FoodEditor onSaved={(f) => { setCreating(false); setFood(f); }} />
      </Sheet>
    );
  }

  if (!food) {
    return (
      <Sheet title={`Add to ${MEAL_LABEL[meal]}`} onClose={onClose}>
        <FoodSearchList onPick={setFood} />
        <button className="btn block" style={{ marginTop: 14 }} onClick={() => setCreating(true)}><IconPlus /> Create a new food</button>
      </Sheet>
    );
  }

  const def = entry
    ? { quantity: entry.quantity, unit: entry.unit, meal: entry.meal, time: entry.time ?? nowHHMM() }
    : (() => {
        // a natural single item (1 egg, 1 slice) when there is one, otherwise 100 g
        const p = countPortion(food);
        return { quantity: p ? 1 : 100, unit: p ? p.label : 'g', meal, time: nowHHMM() };
      })();

  return (
    <Sheet
      title={entry ? 'Edit entry' : 'Amount'}
      onClose={onClose}
      leading={!entry && !presetFood ? <button className="icon-btn" aria-label="Back" onClick={() => setFood(undefined)}><IconChevron dir="left" /></button> : undefined}
    >
      <AmountForm
        food={food}
        initial={def}
        submitLabel={entry ? 'Save' : 'Add to diary'}
        onSubmit={(v) => {
          const e: FoodEntry = {
            id: entry?.id ?? uid(), date: entry?.date ?? date, time: v.time, meal: v.meal, foodId: food.id, foodName: food.name,
            quantity: v.quantity, unit: v.unit, grams: v.grams, nutrients: v.nutrients, via: entry?.via ?? 'manual',
          };
          if (entry) updateFoodEntry(e);
          else addFoodEntries([e]);
          onClose();
        }}
      />
      {entry && (
        <button className="btn ghost danger block" style={{ marginTop: 8 }} onClick={() => { removeFoodEntry(entry.id); onClose(); }}>
          Remove from diary
        </button>
      )}
    </Sheet>
  );
}

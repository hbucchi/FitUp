import { useState } from 'react';
import type { Food } from '../../domain/types';
import { fmt, scaleNutrients } from '../../domain/nutrients';
import { mealForNow, todayISO } from '../../domain/dates';
import { useCatalog } from '../../data/useCatalog';
import { useStore } from '../../data/store';
import { Sheet } from '../components/Sheet';
import { IconChevron, IconPlus } from '../components/Icons';
import { MacroLine } from '../components/Macros';
import { NutrientTable } from '../components/NutrientTable';
import { AddFoodSheet, FoodSearchList } from './AddFood';
import { FoodEditor } from './FoodEditor';

export function Foods() {
  const { meta, customFoods } = useCatalog();
  const [view, setView] = useState<Food | null>(null);
  const [editing, setEditing] = useState<Food | 'new' | null>(null);
  const [adding, setAdding] = useState<Food | null>(null);

  return (
    <>
      <div className="row between" style={{ marginBottom: 14 }}>
        <h1 className="h-display">Foods</h1>
        <button className="btn" onClick={() => setEditing('new')}><IconPlus /> New food</button>
      </div>

      {customFoods.length > 0 && (
        <section className="card flush">
          <div className="meal-head"><h2 className="h-section">My foods</h2></div>
          <ul className="list">
            {customFoods.map((f) => (
              <li key={f.id}>
                <button className="list-item" onClick={() => setView(f)}>
                  <div className="main">
                    <div className="title">{f.name}</div>
                    <div className="sub">{f.brand ? `${f.brand} · ` : ''}{Math.round(f.nutrients.kcal ?? 0)} kcal / 100 g</div>
                  </div>
                  <IconChevron width={16} height={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <FoodSearchList onPick={setView} autoFocus={false} />

      <p className="tiny muted" style={{ marginTop: 18 }}>
        USDA FoodData Central{meta ? ` · ${meta.count.toLocaleString()} foods` : ''}
      </p>

      {view && !adding && !editing && <FoodDetailSheet food={view} onClose={() => setView(null)} onAdd={() => setAdding(view)} onEdit={() => setEditing(view)} />}
      {adding && <AddFoodSheet date={todayISO()} meal={mealForNow()} food={adding} onClose={() => { setAdding(null); setView(null); }} />}
      {editing && (
        <Sheet title={editing === 'new' ? 'New food' : 'Edit food'} onClose={() => setEditing(null)}>
          <FoodEditor initial={editing === 'new' ? undefined : editing} onSaved={(f) => { setEditing(null); setView(f); }} />
        </Sheet>
      )}
    </>
  );
}

function FoodDetailSheet({ food, onClose, onAdd, onEdit }: { food: Food; onClose: () => void; onAdd: () => void; onEdit: () => void }) {
  const del = useStore((s) => s.deleteCustomFood);
  const [basis, setBasis] = useState<string>('100 g');
  const portion = food.portions.find((p) => p.label === basis);
  const n = portion ? scaleNutrients(food.nutrients, portion.grams) : food.nutrients;
  return (
    <Sheet title="Food" onClose={onClose} footer={<button className="btn primary block" onClick={onAdd}><IconPlus /> Add to today</button>}>
      <div className="stack">
        <div>
          <div className="h-section">{food.name}</div>
          <div className="tiny muted">{food.source}{food.brand ? ` · ${food.brand}` : ''} · {food.category}{food.id.startsWith('usda:') ? ` · FDC ${food.id.slice(5)}` : ''}</div>
        </div>
        <label className="field">
          Show values for
          <select className="input" value={basis} onChange={(e) => setBasis(e.target.value)}>
            <option value="100 g">100 g</option>
            {food.portions.map((p) => <option key={p.label} value={p.label}>1 {p.label} ({fmt(p.grams)} g)</option>)}
          </select>
        </label>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="big-num num">{Math.round(n.kcal ?? 0)}<span className="small muted" style={{ fontFamily: 'var(--font-body)' }}> kcal</span></div>
          <div className="small" style={{ marginTop: 4 }}><MacroLine n={n} /></div>
        </div>
        <NutrientTable n={n} />
        {food.source === 'Custom' && (
          <div className="grid2">
            <button className="btn" onClick={onEdit}>Edit</button>
            <button className="btn danger" onClick={() => { del(food.id); onClose(); }}>Delete</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

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
import type { LabelReading } from '../../agent/label';
import { ScanSheet } from './ScanSheet';
import { t } from '../../i18n';

export function Foods() {
  const { meta, customFoods } = useCatalog();
  const [view, setView] = useState<Food | null>(null);
  const [editing, setEditing] = useState<Food | 'new' | { barcode: string; fromLabel?: LabelReading } | null>(null);
  const [scanning, setScanning] = useState(false);
  const saveCustomFood = useStore((s) => s.saveCustomFood);
  const [adding, setAdding] = useState<Food | null>(null);

  return (
    <>
      <div className="row between" style={{ marginBottom: 14 }}>
        <h1 className="h-display">{t('Foods')}</h1>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn" onClick={() => setScanning(true)}>{t('Scan')}</button>
          <button className="btn" onClick={() => setEditing('new')}><IconPlus /> {t('New')}</button>
        </div>
      </div>

      {customFoods.length > 0 && (
        <section className="card flush">
          <div className="meal-head"><h2 className="h-section">{t('My foods')}</h2></div>
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
        USDA FoodData Central · TACO (NEPA/UNICAMP){meta ? ` · ${t('{n} foods', { n: meta.count.toLocaleString() })}` : ''}
      </p>

      {scanning && (
        <ScanSheet
          onClose={() => setScanning(false)}
          onFood={(f) => { saveCustomFood(f); setScanning(false); setAdding(f); }}
          onCreate={(barcode, fromLabel) => { setScanning(false); setEditing({ barcode, fromLabel }); }}
        />
      )}
      {view && !adding && !editing && <FoodDetailSheet food={view} onClose={() => setView(null)} onAdd={() => setAdding(view)} onEdit={() => setEditing(view)} />}
      {adding && <AddFoodSheet date={todayISO()} meal={mealForNow()} food={adding} onClose={() => { setAdding(null); setView(null); }} />}
      {editing && (
        <Sheet title={editing === 'new' || !('id' in editing) ? t('New food') : t('Edit food')} onClose={() => setEditing(null)}>
          <FoodEditor
            initial={editing !== 'new' && 'id' in editing ? editing : editing !== 'new' ? editing.fromLabel?.food : undefined}
            notice={editing !== 'new' && !('id' in editing) ? editing.fromLabel?.warning : undefined}
            barcode={editing !== 'new' && !('id' in editing) ? editing.barcode : undefined}
            onSaved={(f) => { setEditing(null); setView(f); }}
          />
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
    <Sheet title={t('Food')} onClose={onClose} footer={<button className="btn primary block" onClick={onAdd}><IconPlus /> {t('Add to today')}</button>}>
      <div className="stack">
        <div>
          <div className="h-section">{food.name}</div>
          <div className="tiny muted">{food.source}{food.brand ? ` · ${food.brand}` : ''} · {food.category}{food.id.startsWith('usda:') ? ` · FDC ${food.id.slice(5)}` : ''}</div>
        </div>
        <label className="field">
          {t('Show values for')}
          <select className="input" value={basis} onChange={(e) => setBasis(e.target.value)}>
            <option value="100 g">{t('100 g')}</option>
            {food.portions.map((p) => <option key={p.label} value={p.label}>1 {p.label} ({fmt(p.grams)} g)</option>)}
          </select>
        </label>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="big-num num">{Math.round(n.kcal ?? 0)}<span className="small muted" style={{ fontFamily: 'var(--font-body)' }}> kcal</span></div>
          <div className="small" style={{ marginTop: 4 }}><MacroLine n={n} /></div>
        </div>
        <NutrientTable n={n} />
        {food.source === 'Open Food Facts' && <div className="tiny muted">{t('Community data — check against the label.')}</div>}
        {food.recipe && <div className="tiny muted">{food.recipe}</div>}
        {(food.source === 'Custom' || food.barcode) && (
          <div className="grid2">
            <button className="btn" onClick={onEdit}>{t('Edit')}</button>
            <button className="btn danger" onClick={() => { del(food.id); onClose(); }}>{t('Delete')}</button>
          </div>
        )}
      </div>
    </Sheet>
  );
}

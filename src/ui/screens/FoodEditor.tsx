import { useState } from 'react';
import type { Food } from '../../domain/types';
import { NUTRIENTS, type NutrientKey, type Nutrients } from '../../domain/nutrients';
import { uid, useStore } from '../../data/store';
import { NumberField, Segmented } from '../components/Fields';
import { t } from '../../i18n';

const MACROS: NutrientKey[] = ['kcal', 'protein', 'carbs', 'fat'];

export function FoodEditor({ initial, onSaved, barcode, notice }: { initial?: Food; onSaved: (f: Food) => void; barcode?: string; notice?: string }) {
  const save = useStore((s) => s.saveCustomFood);
  const serving0 = initial?.portions[0];
  const [name, setName] = useState(initial?.name ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [basis, setBasis] = useState<'serving' | '100g'>(serving0 ? 'serving' : '100g');
  const [servingLabel, setServingLabel] = useState(serving0?.label ?? 'serving');
  const [servingGrams, setServingGrams] = useState<number | ''>(serving0?.grams ?? '');
  const [showMicros, setShowMicros] = useState(() => !!initial && Object.keys(initial.nutrients).some((k) => !['kcal', 'protein', 'carbs', 'fat'].includes(k)));
  const toBasis = (per100: Nutrients) => {
    const f = basis === 'serving' && serving0 ? serving0.grams / 100 : 1;
    const out: Record<string, number | ''> = {};
    for (const d of NUTRIENTS) out[d.key] = per100[d.key] != null ? Math.round(per100[d.key]! * f * 100) / 100 : '';
    return out;
  };
  const [values, setValues] = useState<Record<string, number | ''>>(initial ? toBasis(initial.nutrients) : {});
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim()) return setErr(t('Give the food a name.'));
    if (basis === 'serving' && (!servingGrams || servingGrams <= 0)) return setErr(t('Enter the serving size in grams.'));
    if (values.kcal === '' || values.kcal == null) return setErr(t('Energy (kcal) is required.'));
    const factor = basis === 'serving' ? 100 / Number(servingGrams) : 1;
    const nutrients: Nutrients = {};
    for (const d of NUTRIENTS) {
      const v = values[d.key];
      if (v !== '' && v != null) nutrients[d.key] = Number(v) * factor;
    }
    const portions = basis === 'serving' ? [{ label: servingLabel.trim() || 'serving', grams: Number(servingGrams) }] : [];
    const food: Food = {
      id: initial?.id ?? `custom:${uid()}`,
      name: name.trim(),
      brand: brand.trim() || undefined,
      category: 'My foods',
      source: initial?.source === 'Label photo' ? 'Label photo' : 'Custom',
      nutrients,
      portions: [...portions, ...(initial?.portions.slice(1) ?? [])],
      ...((barcode ?? initial?.barcode) && { barcode: barcode ?? initial?.barcode }),
    };
    save(food);
    onSaved(food);
  };

  const field = (k: NutrientKey) => {
    const d = NUTRIENTS.find((x) => x.key === k)!;
    return (
      <NumberField key={k} label={d.label} suffix={d.unit} value={values[k] ?? ''} onChange={(v) => setValues((s) => ({ ...s, [k]: v }))} />
    );
  };

  return (
    <div className="stack">
      {initial?.source === 'Label photo' && <div className="notice small">{t('Read from the label photo — check against the package before saving.')}</div>}
      {notice && <div className="error">{notice}</div>}
      <label className="field">{t('Name')}<input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Grandma\'s lentil soup')} /></label>
      <label className="field">{t('Brand')} <span className="muted">({t('optional')})</span><input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} /></label>
      <div className="field">
        <span>{t('Values are given')}</span>
        <Segmented value={basis} onChange={setBasis} label={t('Nutrient basis')}
          options={[{ value: 'serving', label: t('Per serving') }, { value: '100g', label: t('Per 100 g') }]} />
      </div>
      {basis === 'serving' && (
        <div className="grid2">
          <label className="field">{t('Serving name')}<input className="input" value={servingLabel} onChange={(e) => setServingLabel(e.target.value)} placeholder={t('bar, bowl, scoop…')} /></label>
          <NumberField label={t('Serving size')} suffix="g" value={servingGrams} onChange={setServingGrams} />
        </div>
      )}
      <div className="eyebrow">{t('Macronutrients')}</div>
      <div className="grid2">{MACROS.map(field)}</div>
      <button type="button" className="btn ghost" style={{ alignSelf: 'flex-start', paddingLeft: 0 }} onClick={() => setShowMicros((s) => !s)}>
        {showMicros ? t('Hide fiber, sugars, vitamins & minerals') : t('Add fiber, sugars, vitamins & minerals')}
      </button>
      {showMicros && <div className="grid2">{NUTRIENTS.filter((d) => !MACROS.includes(d.key)).map((d) => field(d.key))}</div>}
      {err && <div className="error">{err}</div>}
      <button className="btn primary block" onClick={submit}>{initial ? t('Save food') : t('Create food')}</button>
    </div>
  );
}

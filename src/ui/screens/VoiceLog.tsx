import { useState } from 'react';
import type { Food, FoodEntry, Meal } from '../../domain/types';
import { MEALS, MEAL_LABEL } from '../../domain/types';
import { fmt, scaleNutrients, sumNutrients } from '../../domain/nutrients';
import { gramsFor, resolveAmount, unitOptions } from '../../domain/portions';
import { mealForNow, nowHHMM } from '../../domain/dates';
import { uid, useStore } from '../../data/store';
import { useCatalog } from '../../data/useCatalog';
import { matchTranscript } from '../../voice/matcher';
import { useSpeech } from '../../voice/useSpeech';
import { Sheet } from '../components/Sheet';
import { IconChevron, IconMic, IconStop } from '../components/Icons';
import { MacroLine } from '../components/Macros';
import { FoodSearchList } from './AddFood';

interface Row {
  key: string;
  said: string;
  include: boolean;
  candidates: Food[];
  food?: Food;
  quantity: number;
  unit: string;
  /** what was actually spoken, kept so switching food can re-resolve it */
  spokenQty: number;
  spokenUnit?: string;
}

export function VoiceLogSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const speech = useSpeech(navigator.language?.startsWith('en') ? navigator.language : 'en-US');
  const { ready, index, boost } = useCatalog();
  const addFoodEntries = useStore((s) => s.addFoodEntries);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [meal, setMeal] = useState<Meal>(mealForNow());
  const [time, setTime] = useState(nowHHMM());
  const [replacing, setReplacing] = useState<string | null>(null);

  const text = speech.transcript;

  const analyse = () => {
    if (speech.listening) speech.stop();
    const r = matchTranscript(text, index, { boost });
    if (r.meal) setMeal(r.meal);
    if (r.time) setTime(r.time);
    setRows(
      r.items.map((it, i) => ({
        key: `${i}-${it.parsed.food}`,
        said: it.parsed.raw,
        include: !!it.food,
        candidates: it.candidates,
        food: it.food,
        quantity: it.amount?.quantity ?? it.parsed.quantity,
        unit: it.amount?.unit ?? 'g',
        spokenQty: it.parsed.quantity,
        spokenUnit: it.parsed.unit,
      })),
    );
  };

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs!.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const chooseFood = (row: Row, food: Food) => {
    // a weight carries over as-is; household measures are re-resolved against the new food's portions
    if (row.unit === 'g') return update(row.key, { food, include: true });
    const a = resolveAmount(food, row.spokenQty, row.spokenUnit);
    update(row.key, { food, include: true, quantity: a.quantity, unit: a.unit });
  };

  const included = (rows ?? []).filter((r) => r.include && r.food);
  const totals = sumNutrients(included.map((r) => scaleNutrients(r.food!.nutrients, gramsFor(r.food!, r.quantity, r.unit))));

  const save = () => {
    const entries: FoodEntry[] = included.map((r) => {
      const grams = gramsFor(r.food!, r.quantity, r.unit);
      return {
        id: uid(), date, time, meal, foodId: r.food!.id, foodName: r.food!.name, quantity: r.quantity, unit: r.unit,
        grams, nutrients: scaleNutrients(r.food!.nutrients, grams), via: 'voice',
      };
    });
    addFoodEntries(entries);
    onClose();
  };

  const replacingRow = rows?.find((r) => r.key === replacing);
  if (replacingRow) {
    return (
      <Sheet title="Choose food" onClose={onClose} leading={<button className="icon-btn" aria-label="Back" onClick={() => setReplacing(null)}><IconChevron dir="left" /></button>}>
        <p className="said" style={{ marginTop: 0 }}>You said: “{replacingRow.said}”</p>
        <FoodSearchList onPick={(f) => { chooseFood(replacingRow, f); setReplacing(null); }} />
      </Sheet>
    );
  }

  if (rows) {
    return (
      <Sheet
        title="Review"
        onClose={onClose}
        leading={<button className="icon-btn" aria-label="Back" onClick={() => setRows(null)}><IconChevron dir="left" /></button>}
        footer={
          <div className="stack" style={{ gap: 8 }}>
            <div className="row between small">
              <span className="muted">{included.length} item{included.length === 1 ? '' : 's'}</span>
              <span><strong className="num">{Math.round(totals.kcal ?? 0)} kcal</strong> · <MacroLine n={totals} /></span>
            </div>
            <button className="btn primary block" disabled={!included.length} onClick={save}>Add to {MEAL_LABEL[meal]}</button>
          </div>
        }
      >
        <div className="stack">
          <div className="chips">
            {MEALS.map((m) => <button key={m} className="chip" aria-pressed={m === meal} onClick={() => setMeal(m)}>{MEAL_LABEL[m]}</button>)}
          </div>
          <label className="field" style={{ maxWidth: 160 }}>Time<input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
          {rows.length === 0 && <p className="muted">We couldn't pick out any foods. Go back and try rephrasing — e.g. “two eggs and a slice of toast”.</p>}
          {rows.map((r) => {
            const grams = r.food ? gramsFor(r.food, r.quantity, r.unit) : 0;
            const n = r.food ? scaleNutrients(r.food.nutrients, grams) : {};
            return (
              <div key={r.key} className={`voice-item ${r.include ? '' : 'off'}`}>
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <div className="said">“{r.said}”</div>
                  <label className="row small" style={{ gap: 6 }}>
                    <input type="checkbox" checked={r.include} disabled={!r.food} onChange={(e) => update(r.key, { include: e.target.checked })} /> Include
                  </label>
                </div>
                {r.food ? (
                  <>
                    <select className="input" style={{ marginTop: 8 }} value={r.food.id} aria-label="Matched food"
                      onChange={(e) => {
                        if (e.target.value === '__search') return setReplacing(r.key);
                        const f = r.candidates.find((c) => c.id === e.target.value);
                        if (f) chooseFood(r, f);
                      }}>
                      {!r.candidates.some((c) => c.id === r.food!.id) && <option value={r.food.id}>{r.food.name}</option>}
                      {r.candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      <option value="__search">Search for something else…</option>
                    </select>
                    <div className="grid2" style={{ gridTemplateColumns: '1fr 1.6fr', marginTop: 8 }}>
                      <input className="input num" type="number" min={0} step="any" value={r.quantity} aria-label="Quantity"
                        onChange={(e) => update(r.key, { quantity: Number(e.target.value) })} />
                      <select className="input" value={r.unit} aria-label="Unit" onChange={(e) => update(r.key, { unit: e.target.value })}>
                        {unitOptions(r.food).map((u) => <option key={u.label} value={u.label}>{u.label === 'g' ? 'grams' : `${u.label} (${fmt(u.grams)} g)`}</option>)}
                      </select>
                    </div>
                    <div className="small row between" style={{ marginTop: 8 }}>
                      <span className="muted num">{fmt(grams)} g</span>
                      <span><strong className="num">{Math.round(n.kcal ?? 0)} kcal</strong> · <MacroLine n={n} /></span>
                    </div>
                  </>
                ) : (
                  <button className="btn block" style={{ marginTop: 8 }} onClick={() => setReplacing(r.key)}>No match — search the catalog</button>
                )}
              </div>
            );
          })}
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title="Describe your meal" onClose={onClose}>
      <div className="stack" style={{ textAlign: 'center' }}>
        {speech.supported ? (
          <>
            <button className={`mic ${speech.listening ? 'live' : ''}`} onClick={speech.listening ? speech.stop : speech.start}
              aria-label={speech.listening ? 'Stop recording' : 'Start recording'}>
              {speech.listening ? <IconStop /> : <IconMic />}
            </button>
            <div className="small muted">{speech.listening ? 'Listening… tap to stop' : 'Tap and say what you ate'}</div>
          </>
        ) : (
          <div className="notice">Voice input isn't available in this browser (try Chrome, Edge or Safari). You can type the description instead.</div>
        )}
        {speech.error && <div className="error">{speech.error}</div>}
        {speech.listening && speech.interim && <div className="transcript"><span className="interim">{speech.interim}</span></div>}
        <label className="field" style={{ textAlign: 'left' }}>
          Transcript <span className="muted">(you can edit it)</span>
          <textarea className="input" value={text} onChange={(e) => speech.setTranscript(e.target.value)}
            placeholder="For lunch I had 200 g of chicken breast, a cup of white rice and a tablespoon of olive oil" />
        </label>
        <button className="btn primary block" disabled={!text.trim() || !ready} onClick={analyse}>
          {ready ? 'Find foods' : 'Loading catalog…'}
        </button>
        <p className="tiny muted" style={{ margin: 0 }}>
          Speech is transcribed by your browser's speech service. Say quantities and units — “two eggs”, “150 grams of salmon”, “a cup of milk”.
        </p>
      </div>
    </Sheet>
  );
}

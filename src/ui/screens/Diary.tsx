import { useMemo, useState } from 'react';
import type { FoodEntry, Meal, TrainingEntry } from '../../domain/types';
import { MEALS, MEAL_LABEL } from '../../domain/types';
import { fmt, sumNutrients } from '../../domain/nutrients';
import { mealForNow, prettyDate, shiftDate, todayISO } from '../../domain/dates';
import { useStore } from '../../data/store';
import { sessionsOn, targetsFor } from '../../data/planSelectors';
import { SessionSheet } from './Session';
import { IconChevron, IconMic, IconPlus } from '../components/Icons';
import { MacroBar, MacroLine, Ring } from '../components/Macros';
import { NutrientTable } from '../components/NutrientTable';
import { AddFoodSheet } from './AddFood';
import { VoiceLogSheet } from './VoiceLog';
import { ExercisePickerSheet, TrainingLogSheet } from './TrainingLog';

type Modal =
  | { kind: 'add'; meal: Meal }
  | { kind: 'edit'; entry: FoodEntry }
  | { kind: 'voice' }
  | { kind: 'exercise' }
  | { kind: 'edit-training'; entry: TrainingEntry }
  | { kind: 'session'; id: string }
  | null;

export function Diary() {
  const profile = useStore((s) => s.profile)!;
  const allFood = useStore((s) => s.foodEntries);
  const allTraining = useStore((s) => s.trainingEntries);
  const [date, setDate] = useState(todayISO());
  const [modal, setModal] = useState<Modal>(null);
  const [showMicros, setShowMicros] = useState(false);

  const food = useMemo(() => allFood.filter((e) => e.date === date), [allFood, date]);
  const training = useMemo(() => allTraining.filter((e) => e.date === date), [allTraining, date]);
  const totals = useMemo(() => sumNutrients(food.map((e) => e.nutrients)), [food]);
  const burned = training.reduce((s, t) => s + t.kcal, 0);
  const nutritionPlan = useStore((s) => s.nutritionPlan);
  const plannedSessions = useStore((s) => s.plannedSessions);
  const targets = useMemo(() => targetsFor({ profile, nutritionPlan, plannedSessions }, date), [profile, nutritionPlan, plannedSessions, date]);
  const planned = useMemo(() => sessionsOn({ plannedSessions }, date), [plannedSessions, date]);
  const byTime = (a: { time?: string }, b: { time?: string }) => (a.time ?? '').localeCompare(b.time ?? '');

  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <button className="icon-btn" aria-label="Previous day" onClick={() => setDate((d) => shiftDate(d, -1))}><IconChevron dir="left" /></button>
        <div style={{ textAlign: 'center' }}>
          <div className="h-display" style={{ fontSize: 26 }}>{prettyDate(date)}</div>
          {date !== todayISO() && <button className="btn ghost tiny" style={{ minHeight: 0, padding: '2px 6px' }} onClick={() => setDate(todayISO())}>Back to today</button>}
        </div>
        <button className="icon-btn" aria-label="Next day" onClick={() => setDate((d) => shiftDate(d, 1))}><IconChevron /></button>
      </div>

      <section className="card" aria-label="Daily summary">
        <div className="row" style={{ gap: 18 }}>
          <Ring value={totals.kcal ?? 0} target={targets.kcal} burned={burned} />
          <div className="stack" style={{ gap: 6, flex: 1 }}>
            <div className="row between small"><span className="muted">Target</span><span className="num">{targets.kcal}</span></div>
            <div className="row between small"><span className="muted">Eaten</span><span className="num">{Math.round(totals.kcal ?? 0)}</span></div>
            <div className="row between small"><span className="muted">Training</span><span className="num">+{burned}</span></div>
            <div className="divider" style={{ margin: '2px 0' }} />
            <div className="row between small"><span className="muted">Fiber</span><span className="num">{fmt(totals.fiber)} / {targets.fiber} g</span></div>
          </div>
        </div>
        {targets.dayType && (
          <div className="tiny muted" style={{ marginTop: 10 }}>
            {targets.dayType === 'training' ? 'Training day — a little more carbohydrate to fuel the session.' : 'Rest day targets.'}
          </div>
        )}
        <div className="macro-bars" style={{ marginTop: 16 }}>
          <MacroBar label="Protein" value={totals.protein ?? 0} target={targets.protein} color="var(--protein)" />
          <MacroBar label="Carbs" value={totals.carbs ?? 0} target={targets.carbs} color="var(--carbs)" />
          <MacroBar label="Fat" value={totals.fat ?? 0} target={targets.fat} color="var(--fat)" />
        </div>
      </section>

      {planned.map((ps) => (
        <button key={ps.id} className="card list-item" style={{ borderRadius: 'var(--radius)', border: '1px solid var(--line)', marginBottom: 14 }}
          onClick={() => setModal({ kind: 'session', id: ps.id })}>
          <div className="main">
            <div className="eyebrow">{ps.status === 'done' ? 'Session completed' : 'Planned session'}</div>
            <div className="title" style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600 }}>{ps.title}</div>
            <div className="sub">{ps.exercises.length} exercises · week {ps.week}</div>
          </div>
          <span className={`badge ${ps.status === 'done' ? 'sea' : ''}`}>{ps.status === 'done' ? 'Done' : 'Open'}</span>
        </button>
      ))}

      <div className="grid2" style={{ marginBottom: 14 }}>
        <button className="btn primary" onClick={() => setModal({ kind: 'voice' })}><IconMic /> Speak a meal</button>
        <button className="btn" onClick={() => setModal({ kind: 'add', meal: mealForNow() })}><IconPlus /> Add food</button>
      </div>

      <section className="card flush" aria-label="Meals">
        {MEALS.map((meal) => {
          const items = food.filter((e) => e.meal === meal).sort(byTime);
          const isOptional = meal === 'pre-workout' || meal === 'post-workout';
          if (isOptional && items.length === 0) return null;
          const kcal = items.reduce((s, e) => s + (e.nutrients.kcal ?? 0), 0);
          return (
            <div key={meal} style={{ borderTop: meal === 'breakfast' ? 0 : '1px solid var(--line)' }}>
              <div className="meal-head">
                <div>
                  <h3 className="h-section">{MEAL_LABEL[meal]}</h3>
                  {items.length > 0 && <div className="tiny muted num">{Math.round(kcal)} kcal</div>}
                </div>
                <button className="btn ghost" onClick={() => setModal({ kind: 'add', meal })} aria-label={`Add to ${MEAL_LABEL[meal]}`}><IconPlus /></button>
              </div>
              {items.length === 0 ? (
                <div className="empty">Nothing logged.</div>
              ) : (
                <ul className="list">
                  {items.map((e) => (
                    <li key={e.id}>
                      <button className="list-item" onClick={() => setModal({ kind: 'edit', entry: e })}>
                        <div className="main">
                          <div className="title">{e.foodName}</div>
                          <div className="sub">
                            {fmt(e.quantity, e.quantity % 1 ? 1 : 0)} {e.unit === 'g' ? 'g' : `× ${e.unit}`}
                            {e.unit !== 'g' && <> ({Math.round(e.grams)} g)</>}
                            {e.time && <> · {e.time}</>} · <MacroLine n={e.nutrients} />
                          </div>
                        </div>
                        <div className="kcal">{Math.round(e.nutrients.kcal ?? 0)}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
        <div className="row" style={{ padding: '4px 16px 12px', gap: 6 }}>
          {(['pre-workout', 'post-workout'] as Meal[]).filter((m) => !food.some((e) => e.meal === m)).map((m) => (
            <button key={m} className="chip" onClick={() => setModal({ kind: 'add', meal: m })}>+ {MEAL_LABEL[m]}</button>
          ))}
        </div>
      </section>

      <section className="card flush" aria-label="Training">
        <div className="meal-head">
          <div>
            <h3 className="h-section">Training</h3>
            {training.length > 0 && <div className="tiny muted num">{burned} kcal burned</div>}
          </div>
          <button className="btn ghost" onClick={() => setModal({ kind: 'exercise' })} aria-label="Log exercise"><IconPlus /></button>
        </div>
        {training.length === 0 ? (
          <div className="empty">No training logged.</div>
        ) : (
          <ul className="list">
            {[...training].sort(byTime).map((t) => (
              <li key={t.id}>
                <button className="list-item" onClick={() => setModal({ kind: 'edit-training', entry: t })}>
                  <div className="main">
                    <div className="title">{t.exerciseName}</div>
                    <div className="sub">{describeTraining(t)}</div>
                  </div>
                  <div className="kcal">{t.kcal}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h3 className="h-section">Nutrient detail</h3>
          <button className="btn ghost" onClick={() => setShowMicros((s) => !s)}>{showMicros ? 'Hide' : 'Show'}</button>
        </div>
        {showMicros ? (
          food.length ? <><NutrientTable n={totals} /><p className="tiny muted">% of FDA Daily Value. Missing values in the source data count as zero.</p></> : <p className="muted small">Log some food to see vitamins and minerals.</p>
        ) : (
          <p className="muted small" style={{ margin: 0 }}>Vitamins, minerals and fat breakdown for the day.</p>
        )}
      </section>

      {modal?.kind === 'add' && <AddFoodSheet date={date} meal={modal.meal} onClose={() => setModal(null)} />}
      {modal?.kind === 'edit' && <AddFoodSheet date={date} meal={modal.entry.meal} entry={modal.entry} onClose={() => setModal(null)} />}
      {modal?.kind === 'voice' && <VoiceLogSheet date={date} onClose={() => setModal(null)} />}
      {modal?.kind === 'exercise' && <ExercisePickerSheet date={date} onClose={() => setModal(null)} />}
      {modal?.kind === 'edit-training' && <TrainingLogSheet date={date} entry={modal.entry} onClose={() => setModal(null)} />}
      {modal?.kind === 'session' && <SessionSheet sessionId={modal.id} onClose={() => setModal(null)} />}
    </>
  );
}

export function describeTraining(t: TrainingEntry): string {
  if (t.kind === 'strength' && t.sets?.length) {
    const vol = t.sets.reduce((s, x) => s + x.reps * x.weightKg, 0);
    const reps = t.sets.map((s) => s.reps);
    const same = reps.every((r) => r === reps[0]);
    const top = Math.max(...t.sets.map((s) => s.weightKg));
    return `${t.sets.length} × ${same ? reps[0] : reps.join('/')}${top > 0 ? ` @ ${fmt(top)} kg` : ''}${vol > 0 ? ` · ${Math.round(vol)} kg volume` : ''}`;
  }
  return `${t.durationMin} min${t.distanceKm ? ` · ${fmt(t.distanceKm, 1)} km` : ''}${t.time ? ` · ${t.time}` : ''}`;
}

import { useState } from 'react';
import type { Exercise, ExerciseKind } from '../../domain/types';
import { prettyDate, todayISO } from '../../domain/dates';
import { useStore } from '../../data/store';
import { Sheet } from '../components/Sheet';
import { IconArrows, IconBolt, IconLock, IconPlus, IconWave } from '../components/Icons';
import { CustomExerciseForm, ExerciseList, TrainingLogSheet } from './TrainingLog';
import { describeTraining } from './Diary';

/** Baseline assessments that will seed automatic programming. */
const TRIALS = [
  { name: 'Trial of Strength', desc: 'Push-ups, pull-ups and a squat test to set your starting loads.', icon: IconBolt },
  { name: 'Trial of Endurance', desc: 'A timed run or row to estimate your aerobic capacity.', icon: IconWave },
  { name: 'Trial of Mobility', desc: 'Hip, shoulder and hamstring range-of-motion checks.', icon: IconArrows },
];

export function Training() {
  const entries = useStore((s) => s.trainingEntries);
  const [kind, setKind] = useState<ExerciseKind>('strength');
  const [picked, setPicked] = useState<Exercise | null>(null);
  const [creating, setCreating] = useState(false);
  const recent = [...entries].sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? ''))).slice(0, 6);

  return (
    <>
      <h1 className="h-display" style={{ marginBottom: 14 }}>Training</h1>

      <section className="card">
        <div className="card-head">
          <h2 className="h-section">The Trials</h2>
          <span className="badge">Coming soon</span>
        </div>
        <p className="small muted" style={{ marginTop: 0 }}>
          Three baseline assessments will measure where you start. Your programme will be built from the results.
        </p>
        <div className="stack" style={{ gap: 8 }}>
          {TRIALS.map((t) => (
            <div className="trial" key={t.name}>
              <div className="glyph"><t.icon /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{t.name}</div>
                <div className="small muted">{t.desc}</div>
              </div>
              <IconLock width={16} height={16} style={{ color: 'var(--muted)' }} />
            </div>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="card flush">
          <div className="meal-head"><h2 className="h-section">Recent sessions</h2></div>
          <ul className="list">
            {recent.map((t) => (
              <li key={t.id} className="list-item">
                <div className="main">
                  <div className="title">{t.exerciseName}</div>
                  <div className="sub">{prettyDate(t.date)} · {describeTraining(t)}</div>
                </div>
                <div className="kcal">{t.kcal}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="row between" style={{ margin: '6px 0 10px' }}>
        <h2 className="h-section">Exercise library</h2>
        <button className="btn ghost" onClick={() => setCreating(true)}><IconPlus /> Custom</button>
      </div>
      <ExerciseList kind={kind} setKind={setKind} onPick={setPicked} />

      {picked && <TrainingLogSheet date={todayISO()} exercise={picked} onClose={() => setPicked(null)} />}
      {creating && (
        <Sheet title="New exercise" onClose={() => setCreating(false)}>
          <CustomExerciseForm kind={kind} onSaved={(e) => { setCreating(false); setKind(e.kind); }} />
        </Sheet>
      )}
    </>
  );
}

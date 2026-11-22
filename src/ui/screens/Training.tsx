import { useState } from 'react';
import type { Exercise, ExerciseKind } from '../../domain/types';
import { prettyDate, todayISO } from '../../domain/dates';
import { useStore } from '../../data/store';
import { Sheet } from '../components/Sheet';
import { IconArrows, IconBolt, IconLock, IconPlus, IconWave } from '../components/Icons';
import { CustomExerciseForm, ExerciseList, TrainingLogSheet } from './TrainingLog';
import { describeTraining } from './Diary';
import { SessionSheet, shortPrescription } from './Session';
import { estimateMinutes } from '../../domain/programs';
import { t, tTitle } from '../../i18n';

/** Baseline assessments that will seed automatic programming. */
const TRIALS = [
  { name: t('Trial of Strength'), desc: t('Push-ups, pull-ups and a squat test to set your starting loads.'), icon: IconBolt },
  { name: t('Trial of Endurance'), desc: t('A timed run or row to estimate your aerobic capacity.'), icon: IconWave },
  { name: t('Trial of Mobility'), desc: t('Hip, shoulder and hamstring range-of-motion checks.'), icon: IconArrows },
];

export function Training() {
  const entries = useStore((s) => s.trainingEntries);
  const [kind, setKind] = useState<ExerciseKind>('strength');
  const [picked, setPicked] = useState<Exercise | null>(null);
  const [creating, setCreating] = useState(false);
  const [openSession, setOpenSession] = useState<string | null>(null);
  const today = todayISO();
  const planned = useStore((s) => s.plannedSessions);
  const plan = useStore((s) => s.activePlan);
  const todays = planned.filter((x) => plan && x.planId === plan.id && x.date === today && x.status !== 'skipped');
  const next = planned
    .filter((x) => plan && x.planId === plan.id && x.date > today && x.status === 'planned')
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const recent = [...entries].sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? ''))).slice(0, 6);

  return (
    <>
      <h1 className="h-display" style={{ marginBottom: 14 }}>{t('Training')}</h1>

      {plan && (
        <section className="card">
          {todays.length ? todays.map((x) => (
            <div key={x.id}>
              <div className="eyebrow">{x.status === 'done' ? t('Done today') : t("Today's session")} · {t('week')} {x.week}</div>
              <div className="h-section" style={{ fontSize: 22 }}>{tTitle(x.title)}</div>
              <ul className="small" style={{ margin: '8px 0 12px', paddingLeft: 0, listStyle: 'none', color: 'var(--ink-2)', lineHeight: 1.7 }}>
                {x.exercises.map((e) => <li key={e.exerciseId}>{t(e.name)} <span className="muted">{shortPrescription(e)}</span></li>)}
              </ul>
              <button className={`btn block ${x.status === 'done' ? '' : 'primary'}`} onClick={() => setOpenSession(x.id)}>
                {x.status === 'done' ? t('View session') : t('Start session · ~{m} min', { m: estimateMinutes(x) })}
              </button>
            </div>
          )) : (
            <div>
              <div className="eyebrow">{t('Rest day')}</div>
              <div className="small muted">{next ? t('Next: {s} — {d}', { s: tTitle(next.title), d: prettyDate(next.date) }) : t('No more sessions planned.')}</div>
              {next && <button className="btn ghost" style={{ paddingLeft: 0 }} onClick={() => setOpenSession(next.id)}>{t('Preview')}</button>}
            </div>
          )}
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2 className="h-section">{t('The Trials')}</h2>
          <span className="badge">{t('Coming soon')}</span>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          {TRIALS.map((trial) => (
            <div className="trial" key={trial.name}>
              <div className="glyph"><trial.icon /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{trial.name}</div>
              </div>
              <IconLock width={16} height={16} style={{ color: 'var(--muted)' }} />
            </div>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="card flush">
          <div className="meal-head"><h2 className="h-section">{t('Recent sessions')}</h2></div>
          <ul className="list">
            {recent.map((tr) => (
              <li key={tr.id} className="list-item">
                <div className="main">
                  <div className="title">{t(tr.exerciseName)}</div>
                  <div className="sub">{prettyDate(tr.date)} · {describeTraining(tr)}</div>
                </div>
                <div className="kcal">{tr.kcal}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="row between" style={{ margin: '6px 0 10px' }}>
        <h2 className="h-section">{t('Exercise library')}</h2>
        <button className="btn ghost" onClick={() => setCreating(true)}><IconPlus /> {t('Custom')}</button>
      </div>
      <ExerciseList kind={kind} setKind={setKind} onPick={setPicked} />

      {openSession && <SessionSheet sessionId={openSession} onClose={() => setOpenSession(null)} />}
      {picked && <TrainingLogSheet date={todayISO()} exercise={picked} onClose={() => setPicked(null)} />}
      {creating && (
        <Sheet title={t('New exercise')} onClose={() => setCreating(false)}>
          <CustomExerciseForm kind={kind} onSaved={(e) => { setCreating(false); setKind(e.kind); }} />
        </Sheet>
      )}
    </>
  );
}

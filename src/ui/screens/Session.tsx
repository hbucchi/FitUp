import { useMemo, useState } from 'react';
import type { PlannedExercise, StrengthSet, TrainingEntry } from '../../domain/types';
import { exerciseKcal } from '../../domain/metrics';
import { MINUTES_PER_SET } from '../../domain/exercises';
import { estimateMinutes } from '../../domain/programs';
import { prettyDate, todayISO, nowHHMM } from '../../domain/dates';
import { fmt } from '../../domain/nutrients';
import { uid, useStore } from '../../data/store';
import { Sheet } from '../components/Sheet';
import { useExercises } from './TrainingLog';

const restLabel = (sec: number) => (sec >= 120 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} min` : `${sec} s`);

export function prescription(e: PlannedExercise) {
  if (e.kind === 'cardio') return `${e.minutes} min${e.note ? ` · ${e.note}` : ''}`;
  return `${e.sets} × ${e.repsMin}–${e.repsMax} · ${e.rir === 0 ? 'to failure on the last set' : `${e.rir} rep${e.rir > 1 ? 's' : ''} in reserve`} · rest ${restLabel(e.restSec)}`;
}

export function SessionSheet({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const session = useStore((s) => s.plannedSessions.find((x) => x.id === sessionId));
  const history = useStore((s) => s.trainingEntries);
  const weightKg = useStore((s) => s.profile?.weightKg ?? 75);
  const addTraining = useStore((s) => s.addTraining);
  const updateSessions = useStore((s) => s.updateSessions);
  const library = useExercises();

  // previous performance per exercise (most recent entry before today)
  const last = useMemo(() => {
    const m = new Map<string, TrainingEntry>();
    for (const t of [...history].sort((a, b) => a.date.localeCompare(b.date))) if (t.planSessionId !== sessionId) m.set(t.exerciseId, t);
    return m;
  }, [history, sessionId]);

  const [sets, setSets] = useState<Record<string, StrengthSet[]>>(() =>
    Object.fromEntries(
      (session?.exercises ?? []).filter((e) => e.kind !== 'cardio').map((e) => {
        const prev = last.get(e.exerciseId)?.sets;
        const w = prev?.length ? Math.max(...prev.map((s) => s.weightKg)) : 0;
        return [e.exerciseId, Array.from({ length: e.sets }, () => ({ reps: 0, weightKg: w }))];
      }),
    ),
  );
  const [cardio, setCardio] = useState<Record<string, number>>(() =>
    Object.fromEntries((session?.exercises ?? []).filter((e) => e.kind === 'cardio').map((e) => [e.exerciseId, e.minutes ?? 30])),
  );
  if (!session) return null;
  const done = session.status === 'done';
  const logged = history.filter((t) => t.planSessionId === session.id);

  const setAt = (id: string, i: number, patch: Partial<StrengthSet>) =>
    setSets((s) => ({ ...s, [id]: s[id].map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

  const finish = () => {
    const date = session.date <= todayISO() ? session.date : todayISO();
    const time = nowHHMM();
    for (const e of session.exercises) {
      const ex = library.find((x) => x.id === e.exerciseId);
      const met = ex?.met ?? (e.kind === 'cardio' ? 7 : 5);
      if (e.kind === 'cardio') {
        const min = cardio[e.exerciseId] ?? 0;
        if (min > 0) addTraining({ id: uid(), date, time, exerciseId: e.exerciseId, exerciseName: e.name, kind: 'aerobic', durationMin: min, kcal: exerciseKcal(met, weightKg, min), planSessionId: session.id });
        continue;
      }
      const performed = (sets[e.exerciseId] ?? []).filter((s) => s.reps > 0);
      if (!performed.length) continue;
      const minutes = Math.round(performed.length * MINUTES_PER_SET);
      addTraining({
        id: uid(), date, time, exerciseId: e.exerciseId, exerciseName: e.name, kind: 'strength', durationMin: minutes,
        sets: performed, kcal: exerciseKcal(met, weightKg, minutes), planSessionId: session.id,
      });
    }
    updateSessions([{ ...session, status: 'done', completedAt: new Date().toISOString(), date }]);
    onClose();
  };

  const anyLogged = Object.values(sets).some((l) => l.some((s) => s.reps > 0)) || Object.values(cardio).some((m) => m > 0);

  return (
    <Sheet
      title={session.title}
      onClose={onClose}
      footer={
        done ? undefined : (
          <div className="grid2" style={{ gridTemplateColumns: '1fr 2fr' }}>
            <button className="btn" onClick={() => { updateSessions([{ ...session, status: 'skipped', note: 'Skipped by you' }]); onClose(); }}>Skip</button>
            <button className="btn primary" disabled={!anyLogged} onClick={finish}>Finish session</button>
          </div>
        )
      }
    >
      <div className="stack">
        <div className="small muted">
          {prettyDate(session.date)} · week {session.week} · {session.phase === 'deload' ? 'lighter week — leave plenty in the tank' : `${session.focus.toLowerCase()} focus`} · ~{estimateMinutes(session)} min
          {session.originalDate && <> · moved from {prettyDate(session.originalDate)}</>}
        </div>
        {session.note && <div className="notice tiny">{session.note}</div>}
        {done ? (
          <>
            <div className="notice">Completed{session.completedAt ? ` ${new Date(session.completedAt).toLocaleDateString()}` : ''}.</div>
            <div className="card flush">
              <ul className="list">
                {logged.map((t) => (
                  <li key={t.id} className="list-item">
                    <div className="main">
                      <div className="title">{t.exerciseName}</div>
                      <div className="sub">{t.sets?.length ? t.sets.map((s) => `${s.reps}${s.weightKg ? ` × ${fmt(s.weightKg)} kg` : ''}`).join(' · ') : `${t.durationMin} min`}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <>
            <p className="tiny muted" style={{ margin: 0 }}>
              Pick a weight you can lift for the rep range while stopping with the prescribed reps in reserve. When you reach the top of the range on every set, add weight next time.
            </p>
            {session.exercises.map((e) => {
              const prev = last.get(e.exerciseId);
              return (
                <div key={e.exerciseId} className="card" style={{ marginBottom: 0 }}>
                  <div style={{ fontWeight: 600 }}>{e.name}</div>
                  <div className="tiny muted" style={{ marginBottom: 8 }}>{prescription(e)}</div>
                  {prev?.sets?.length ? (
                    <div className="tiny" style={{ color: 'var(--sea)', marginBottom: 8 }}>
                      Last time ({prev.date}): {prev.sets.map((s) => `${s.reps}${s.weightKg ? `×${fmt(s.weightKg)}` : ''}`).join(', ')}
                    </div>
                  ) : null}
                  {e.kind === 'cardio' ? (
                    <div className="row">
                      <input className="input num" type="number" min={0} value={cardio[e.exerciseId] ?? 0} aria-label={`${e.name} minutes`}
                        onChange={(ev) => setCardio((c) => ({ ...c, [e.exerciseId]: Number(ev.target.value) }))} />
                      <span className="small muted">min</span>
                    </div>
                  ) : (
                    <div className="stack" style={{ gap: 6 }}>
                      {(sets[e.exerciseId] ?? []).map((s, i) => (
                        <div className="row" key={i}>
                          <span className="num muted small" style={{ width: 22 }}>{i + 1}</span>
                          <input className="input num" type="number" inputMode="numeric" min={0} placeholder={`${e.repsMin}–${e.repsMax}`} value={s.reps || ''}
                            aria-label={`${e.name} set ${i + 1} reps`} onChange={(ev) => setAt(e.exerciseId, i, { reps: Number(ev.target.value) })} />
                          <span className="small muted">reps</span>
                          <input className="input num" type="number" inputMode="decimal" min={0} step="any" value={s.weightKg || ''} placeholder="kg"
                            aria-label={`${e.name} set ${i + 1} weight`} onChange={(ev) => setAt(e.exerciseId, i, { weightKg: Number(ev.target.value) })} />
                          <span className="small muted">kg</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </Sheet>
  );
}

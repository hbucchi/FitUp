import { useMemo, useState } from 'react';
import type { PlannedExercise, StrengthSet, TrainingEntry } from '../../domain/types';
import { estimateActivity } from '../../domain/energy';
import { estimateMinutes } from '../../domain/programs';
import { prettyDate, todayISO, nowHHMM } from '../../domain/dates';
import { fmt } from '../../domain/nutrients';
import { uid, useStore } from '../../data/store';
import { Sheet } from '../components/Sheet';
import { useExercises } from './TrainingLog';

const restLabel = (sec: number) => (sec >= 120 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} min` : `${sec} s`);

const secLabel = (sec: number) => (sec >= 60 && sec % 60 === 0 ? `${sec / 60} min` : sec > 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : `${sec} s`);

export function prescription(e: PlannedExercise) {
  if (e.kind === 'cardio') return `${e.minutes} min`;
  if (e.kind === 'conditioning') return `${e.rounds} rounds × ${secLabel(e.workSec ?? 60)} on / ${secLabel(e.restSec)} off (~${e.minutes} min)`;
  if (e.kind === 'power') return `${e.sets} × ${e.repsMin}–${e.repsMax} · explosive · rest ${restLabel(e.restSec)}`;
  if (e.kind === 'prehab') return `${e.sets} × ${e.repsMin}–${e.repsMax} · rest ${restLabel(e.restSec)}`;
  return `${e.sets} × ${e.repsMin}–${e.repsMax} · ${e.rir === 0 ? 'to failure' : `${e.rir} in reserve`} · rest ${restLabel(e.restSec)}`;
}

/** Compact form for lists: "3 × 6–8", "6 × 3 min", "30 min". */
export function shortPrescription(e: PlannedExercise) {
  if (e.kind === 'cardio') return `${e.minutes} min`;
  if (e.kind === 'conditioning') return `${e.rounds} × ${secLabel(e.workSec ?? 60)}`;
  return `${e.sets} × ${e.repsMin}–${e.repsMax}`;
}

const timed = (e: PlannedExercise) => e.kind === 'cardio' || e.kind === 'conditioning';

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
      (session?.exercises ?? []).filter((e) => !timed(e)).map((e) => {
        const prev = last.get(e.exerciseId)?.sets;
        const w = prev?.length ? Math.max(...prev.map((s) => s.weightKg)) : 0;
        return [e.exerciseId, Array.from({ length: e.sets }, () => ({ reps: 0, weightKg: w }))];
      }),
    ),
  );
  // cardio: minutes done; conditioning: rounds done
  const [cardio, setCardio] = useState<Record<string, number>>(() =>
    Object.fromEntries((session?.exercises ?? []).filter(timed).map((e) => [e.exerciseId, e.kind === 'conditioning' ? e.rounds ?? 0 : e.minutes ?? 30])),
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
      const ex = library.find((x) => x.id === e.exerciseId) ?? { id: e.exerciseId, met: timed(e) ? 7 : 5, kind: timed(e) ? ('aerobic' as const) : ('strength' as const) };
      if (timed(e)) {
        const n = cardio[e.exerciseId] ?? 0;
        const min = e.kind === 'conditioning' ? Math.round((n * ((e.workSec ?? 60) + e.restSec)) / 60) : n;
        if (min <= 0) continue;
        const est = estimateActivity({ exercise: ex, minutes: min, weightKg, intensity: e.kind === 'conditioning' ? 'vigorous' : 'moderate' });
        addTraining({ id: uid(), date, time, exerciseId: e.exerciseId, exerciseName: e.name, kind: 'aerobic', durationMin: min, kcal: est.kcal, netKcal: est.netKcal, planSessionId: session.id, notes: e.kind === 'conditioning' ? `${n} rounds` : undefined });
        continue;
      }
      const performed = (sets[e.exerciseId] ?? []).filter((s) => s.reps > 0);
      if (!performed.length) continue;
      const minutes = Math.max(1, Math.round((performed.length * (e.restSec + 45)) / 60));
      const est = estimateActivity({ exercise: ex, minutes, weightKg });
      addTraining({
        id: uid(), date, time, exerciseId: e.exerciseId, exerciseName: e.name, kind: 'strength', durationMin: minutes,
        sets: performed, kcal: est.kcal, netKcal: est.netKcal, planSessionId: session.id,
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
          {prettyDate(session.date)} · ~{estimateMinutes(session)} min{session.originalDate && <> · moved from {prettyDate(session.originalDate)}</>}
        </div>
        {session.note && <div className="notice tiny">{session.note}</div>}
        {done ? (
          <>
            <div className="notice">Completed</div>
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
            {session.exercises.map((e) => {
              const prev = last.get(e.exerciseId);
              return (
                <div key={e.exerciseId} className="card" style={{ marginBottom: 0 }}>
                  <div style={{ fontWeight: 600 }}>{e.name}</div>
                  <div className="tiny muted" style={{ marginBottom: 8 }}>{prescription(e)}</div>
                  {prev?.sets?.length ? (
                    <div className="tiny" style={{ color: 'var(--sea)', marginBottom: 8 }}>
                      Last: {prev.sets.map((s) => `${s.reps}${s.weightKg ? `×${fmt(s.weightKg)}` : ''}`).join(', ')}
                    </div>
                  ) : null}
                  {e.note && <div className="tiny" style={{ marginBottom: 8 }}>{e.note}</div>}
                  {timed(e) ? (
                    <div className="row">
                      <input className="input num" type="number" min={0} value={cardio[e.exerciseId] ?? 0} aria-label={`${e.name} ${e.kind === 'conditioning' ? 'rounds' : 'minutes'}`}
                        onChange={(ev) => setCardio((c) => ({ ...c, [e.exerciseId]: Number(ev.target.value) }))} />
                      <span className="small muted">{e.kind === 'conditioning' ? 'rounds done' : 'min'}</span>
                    </div>
                  ) : (
                    <div className="stack" style={{ gap: 6 }}>
                      {(sets[e.exerciseId] ?? []).map((s, i) => (
                        <div className="row" key={i}>
                          <span className="num muted small" style={{ width: 22 }}>{i + 1}</span>
                          <input className="input num" type="number" inputMode="numeric" min={0} placeholder={`${e.repsMin}–${e.repsMax}`} value={s.reps || ''}
                            aria-label={`${e.name} set ${i + 1} reps`} onChange={(ev) => setAt(e.exerciseId, i, { reps: Number(ev.target.value) })} />
                          <span className="small muted">reps</span>
                          <input className="input num" type="number" inputMode="decimal" min={0} step="any" value={s.weightKg || ''}
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

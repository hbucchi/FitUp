import { useMemo, useState } from 'react';
import type { Exercise, ExerciseKind, StrengthSet, TrainingEntry } from '../../domain/types';
import { INTENSITY, MINUTES_PER_SET, SEED_EXERCISES, type Intensity } from '../../domain/exercises';
import { estimateActivity, paceLabel } from '../../domain/energy';
import { nowHHMM } from '../../domain/dates';
import { normalize } from '../../data/search';
import { uid, useStore } from '../../data/store';
import { Sheet } from '../components/Sheet';
import { NumberField, Segmented } from '../components/Fields';
import { IconChevron, IconPlus, IconTrash } from '../components/Icons';

export function useExercises(): Exercise[] {
  const custom = useStore((s) => s.customExercises);
  return useMemo(() => [...custom, ...SEED_EXERCISES], [custom]);
}

export function ExerciseList({ onPick, kind, setKind }: { onPick: (e: Exercise) => void; kind: ExerciseKind; setKind: (k: ExerciseKind) => void }) {
  const all = useExercises();
  const [q, setQ] = useState('');
  const list = all.filter((e) => e.kind === kind && (!q || normalize(`${e.name} ${e.group} ${e.equipment ?? ''}`).includes(normalize(q))));
  const groups = [...new Set(list.map((e) => e.group))];
  return (
    <div className="stack">
      <Segmented value={kind} onChange={setKind} label="Exercise type"
        options={[{ value: 'aerobic', label: 'Aerobic' }, { value: 'strength', label: 'Weight training' }]} />
      <input className="input" type="search" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" />
      {groups.map((g) => (
        <div key={g}>
          <div className="eyebrow" style={{ margin: '4px 0 6px' }}>{g}</div>
          <div className="card flush" style={{ marginBottom: 6 }}>
            <ul className="list">
              {list.filter((e) => e.group === g).map((e) => (
                <li key={e.id}>
                  <button className="list-item" onClick={() => onPick(e)}>
                    <div className="main">
                      <div className="title">{e.name}</div>
                      <div className="sub">{[e.equipment, e.custom ? 'Custom' : null].filter(Boolean).join(' · ') || (e.kind === 'aerobic' ? 'Cardio' : '')}</div>
                    </div>
                    <IconChevron width={16} height={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
      {list.length === 0 && <p className="muted small">No exercises match “{q}”.</p>}
    </div>
  );
}

export function ExercisePickerSheet({ date, onClose, initialKind = 'strength' }: { date: string; onClose: () => void; initialKind?: ExerciseKind }) {
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [kind, setKind] = useState<ExerciseKind>(initialKind);
  if (exercise) return <TrainingLogSheet date={date} exercise={exercise} onBack={() => setExercise(null)} onClose={onClose} />;
  return (
    <Sheet title="Log exercise" onClose={onClose}>
      <ExerciseList onPick={setExercise} kind={kind} setKind={setKind} />
    </Sheet>
  );
}

export function TrainingLogSheet({ date, exercise: ex0, entry, onClose, onBack }: {
  date: string; exercise?: Exercise; entry?: TrainingEntry; onClose: () => void; onBack?: () => void;
}) {
  const all = useExercises();
  const profile = useStore((s) => s.profile)!;
  const history = useStore((s) => s.trainingEntries);
  const addTraining = useStore((s) => s.addTraining);
  const updateTraining = useStore((s) => s.updateTraining);
  const removeTraining = useStore((s) => s.removeTraining);
  const exercise: Exercise = ex0 ?? all.find((e) => e.id === entry?.exerciseId) ?? {
    id: entry!.exerciseId, name: entry!.exerciseName, kind: entry!.kind, group: '', met: entry!.kind === 'aerobic' ? 7 : 5,
  };

  // pre-fill strength sets from the last time this exercise was done
  const last = useMemo(
    () => [...history].reverse().find((h) => h.exerciseId === exercise.id && h.id !== entry?.id),
    [history, exercise.id, entry?.id],
  );
  const [sets, setSets] = useState<StrengthSet[]>(entry?.sets ?? last?.sets ?? [{ reps: 10, weightKg: 0 }, { reps: 10, weightKg: 0 }, { reps: 10, weightKg: 0 }]);
  const [duration, setDuration] = useState<number | ''>(entry?.durationMin ?? (exercise.kind === 'aerobic' ? 30 : ''));
  const [distance, setDistance] = useState<number | ''>(entry?.distanceKm ?? '');
  const [intensity, setIntensity] = useState<Intensity>('moderate');
  const [time, setTime] = useState(entry?.time ?? nowHHMM());
  const [notes, setNotes] = useState(entry?.notes ?? '');

  const minutes = exercise.kind === 'strength' ? (duration === '' ? Math.round(sets.length * MINUTES_PER_SET) : Number(duration)) : Number(duration) || 0;
  const est = estimateActivity({
    exercise, minutes, weightKg: profile.weightKg, intensity,
    distanceKm: distance === '' ? undefined : Number(distance),
  });
  const kcal = est.kcal;
  const paceBased = !!est.speedKmh && /equation|cycling at/.test(est.method);
  const setAt = (i: number, patch: Partial<StrengthSet>) => setSets((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const submit = () => {
    const t: TrainingEntry = {
      id: entry?.id ?? uid(), date: entry?.date ?? date, time, exerciseId: exercise.id, exerciseName: exercise.name, kind: exercise.kind,
      durationMin: minutes, distanceKm: distance === '' ? undefined : Number(distance),
      sets: exercise.kind === 'strength' ? sets.filter((s) => s.reps > 0) : undefined, kcal, netKcal: est.netKcal, notes: notes.trim() || undefined,
    };
    if (entry) updateTraining(t);
    else addTraining(t);
    onClose();
  };

  return (
    <Sheet
      title={exercise.name}
      onClose={onClose}
      leading={onBack && <button className="icon-btn" aria-label="Back" onClick={onBack}><IconChevron dir="left" /></button>}
      footer={
        <div className="stack" style={{ gap: 8 }}>
          <div className="row between" style={{ alignItems: 'flex-end' }}>
            <div>
              <div className="eyebrow">Calories burned</div>
              <div className="tiny muted">{minutes > 0 ? `likely ${est.low}–${est.high} · ${est.method}` : 'enter a duration'}</div>
            </div>
            <div className="big-num num" style={{ fontSize: 30 }}>≈ {kcal}<span className="small muted" style={{ fontFamily: 'var(--font-body)' }}> kcal</span></div>
          </div>
          <button className="btn primary block" onClick={submit} disabled={minutes <= 0}>{entry ? 'Save' : 'Add to diary'}</button>
          {entry && <button className="btn ghost danger block" onClick={() => { removeTraining(entry.id); onClose(); }}>Remove</button>}
        </div>
      }
    >
      <div className="stack">
        <div className="tiny muted">{exercise.kind === 'aerobic' ? 'Aerobic' : 'Weight training'} · {exercise.group}{exercise.equipment ? ` · ${exercise.equipment}` : ''}</div>
        {exercise.kind === 'strength' ? (
          <>
            {last?.sets && !entry && <div className="notice">Pre-filled from your last session on {last.date}.</div>}
            <div className="stack" style={{ gap: 8 }}>
              <div className="row tiny muted" style={{ padding: '0 4px' }}>
                <span style={{ width: 28 }}>Set</span><span style={{ flex: 1 }}>Reps</span><span style={{ flex: 1 }}>Weight (kg)</span><span style={{ width: 38 }} />
              </div>
              {sets.map((s, i) => (
                <div className="row" key={i}>
                  <span className="num muted" style={{ width: 28, textAlign: 'center' }}>{i + 1}</span>
                  <input className="input num" type="number" inputMode="numeric" min={0} value={s.reps} aria-label={`Set ${i + 1} reps`}
                    onChange={(e) => setAt(i, { reps: Number(e.target.value) })} />
                  <input className="input num" type="number" inputMode="decimal" min={0} step="any" value={s.weightKg} aria-label={`Set ${i + 1} weight`}
                    onChange={(e) => setAt(i, { weightKg: Number(e.target.value) })} />
                  <button className="icon-btn" aria-label={`Remove set ${i + 1}`} onClick={() => setSets((x) => x.filter((_, j) => j !== i))}><IconTrash /></button>
                </div>
              ))}
              <button className="btn" onClick={() => setSets((x) => [...x, { ...(x[x.length - 1] ?? { reps: 10, weightKg: 0 }) }])}><IconPlus /> Add set</button>
            </div>
            <p className="tiny muted" style={{ margin: 0 }}>Use 0 kg for bodyweight exercises.</p>
            <NumberField label="Duration (optional)" suffix="min" value={duration} onChange={setDuration} placeholder={`≈ ${Math.round(sets.length * MINUTES_PER_SET)}`} />
          </>
        ) : (
          <>
            <div className="grid2">
              <NumberField label="Duration" suffix="min" value={duration} onChange={setDuration} />
              {exercise.distance && <NumberField label="Distance (optional)" suffix="km" value={distance} onChange={setDistance} />}
            </div>
            {!paceBased && (
            <div className="field">
              <span>Intensity</span>
              <Segmented value={intensity} onChange={setIntensity} label="Intensity"
                options={(Object.keys(INTENSITY) as Intensity[]).map((k) => ({ value: k, label: INTENSITY[k].label }))} />
            </div>
            )}
          </>
        )}
        <label className="field" style={{ maxWidth: 160 }}>Time<input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        <label className="field">Notes<textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it feel?" /></label>
        <p className="tiny muted" style={{ margin: 0 }}>
          {paceBased
            ? `From your pace${est.speedKmh ? ` (${est.speedKmh.toFixed(1)} km/h${distance !== '' && exercise.kind === 'aerobic' ? `, ${paceLabel(minutes, Number(distance))}` : ''})` : ''} with the ACSM metabolic equations. `
            : `MET ${est.met.toFixed(1)} × ${profile.weightKg} kg × ${(minutes / 60).toFixed(2)} h (Compendium of Physical Activities). ${exercise.distance ? 'Add the distance for a pace-based estimate. ' : ''}`}
          About {est.netKcal} kcal of that is above what you'd burn resting. No estimate is exact; even wrist trackers miss by 25 % or more.
        </p>
      </div>
    </Sheet>
  );
}

export function CustomExerciseForm({ kind, onSaved }: { kind: ExerciseKind; onSaved: (e: Exercise) => void }) {
  const save = useStore((s) => s.saveCustomExercise);
  const [name, setName] = useState('');
  const [k, setK] = useState<ExerciseKind>(kind);
  const [group, setGroup] = useState('');
  const [equipment, setEquipment] = useState('');
  return (
    <div className="stack">
      <Segmented value={k} onChange={setK} label="Type" options={[{ value: 'aerobic', label: 'Aerobic' }, { value: 'strength', label: 'Weight training' }]} />
      <label className="field">Name<input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Landmine press" /></label>
      <label className="field">{k === 'strength' ? 'Muscle group' : 'Category'}<input className="input" value={group} onChange={(e) => setGroup(e.target.value)} placeholder={k === 'strength' ? 'Shoulders' : 'Conditioning'} /></label>
      <label className="field">Equipment <span className="muted">(optional)</span><input className="input" value={equipment} onChange={(e) => setEquipment(e.target.value)} /></label>
      <button className="btn primary block" disabled={!name.trim()} onClick={() => {
        const e: Exercise = {
          id: `ex:custom:${uid()}`, name: name.trim(), kind: k, group: group.trim() || 'Custom', equipment: equipment.trim() || undefined,
          met: k === 'aerobic' ? 7 : 5, distance: k === 'aerobic', custom: true,
        };
        save(e);
        onSaved(e);
      }}>Create exercise</button>
    </div>
  );
}

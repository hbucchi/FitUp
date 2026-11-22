import { useMemo, useState } from 'react';
import type { Exercise, ExerciseKind, StrengthSet, TrainingEntry } from '../../domain/types';
import { INTENSITY, MINUTES_PER_SET, SEED_EXERCISES, type Intensity } from '../../domain/exercises';
import { estimateActivity } from '../../domain/energy';
import { nowHHMM, prettyDate } from '../../domain/dates';
import { normalize } from '../../data/search';
import { uid, useStore } from '../../data/store';
import { Sheet } from '../components/Sheet';
import { NumberField, Segmented } from '../components/Fields';
import { IconChevron, IconPlus, IconTrash } from '../components/Icons';
import { t } from '../../i18n';

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
      <Segmented value={kind} onChange={setKind} label={t('Exercise type')}
        options={[{ value: 'aerobic', label: t('Aerobic') }, { value: 'strength', label: t('Weight training') }]} />
      <input className="input" type="search" placeholder={t('Search exercises')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('Search exercises')} />
      {groups.map((g) => (
        <div key={g}>
          <div className="eyebrow" style={{ margin: '4px 0 6px' }}>{t(g)}</div>
          <div className="card flush" style={{ marginBottom: 6 }}>
            <ul className="list">
              {list.filter((e) => e.group === g).map((e) => (
                <li key={e.id}>
                  <button className="list-item" onClick={() => onPick(e)}>
                    <div className="main">
                      <div className="title">{t(e.name)}</div>
                      <div className="sub">{[e.equipment && t(e.equipment), e.custom ? t('Custom') : null].filter(Boolean).join(' · ') || (e.kind === 'aerobic' ? t('Cardio') : '')}</div>
                    </div>
                    <IconChevron width={16} height={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
      {list.length === 0 && <p className="muted small">{t('No matches for “{q}”.', { q })}</p>}
    </div>
  );
}

export function ExercisePickerSheet({ date, onClose, initialKind = 'strength' }: { date: string; onClose: () => void; initialKind?: ExerciseKind }) {
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [kind, setKind] = useState<ExerciseKind>(initialKind);
  if (exercise) return <TrainingLogSheet date={date} exercise={exercise} onBack={() => setExercise(null)} onClose={onClose} />;
  return (
    <Sheet title={t('Log exercise')} onClose={onClose}>
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
      title={t(exercise.name)}
      onClose={onClose}
      leading={onBack && <button className="icon-btn" aria-label={t('Go back')} onClick={onBack}><IconChevron dir="left" /></button>}
      footer={
        <div className="stack" style={{ gap: 8 }}>
          <div className="row between" style={{ alignItems: 'flex-end' }}>
            <div>
              <div className="eyebrow">{t('Calories burned')}</div>
              <div className="tiny muted">{minutes > 0 ? `${est.low}–${est.high}${paceBased ? t(' · from pace') : ''}` : t('enter a duration')}</div>
            </div>
            <div className="big-num num" style={{ fontSize: 30 }}>≈ {kcal}<span className="small muted" style={{ fontFamily: 'var(--font-body)' }}> kcal</span></div>
          </div>
          <button className="btn primary block" onClick={submit} disabled={minutes <= 0}>{entry ? t('Save') : t('Add to diary')}</button>
          {entry && <button className="btn ghost danger block" onClick={() => { removeTraining(entry.id); onClose(); }}>{t('Remove')}</button>}
        </div>
      }
    >
      <div className="stack">
        <div className="tiny muted">{exercise.kind === 'aerobic' ? t('Aerobic') : t('Weight training')} · {t(exercise.group)}{exercise.equipment ? ` · ${t(exercise.equipment)}` : ''}</div>
        {exercise.kind === 'strength' ? (
          <>
            {last?.sets && !entry && <div className="notice">{t('Pre-filled from your last session on {d}.', { d: prettyDate(last.date) })}</div>}
            <div className="stack" style={{ gap: 8 }}>
              <div className="row tiny muted" style={{ padding: '0 4px' }}>
                <span style={{ width: 28 }}>{t('Set')}</span><span style={{ flex: 1 }}>{t('Reps')}</span><span style={{ flex: 1 }}>{t('Weight (kg)')}</span><span style={{ width: 38 }} />
              </div>
              {sets.map((s, i) => (
                <div className="row" key={i}>
                  <span className="num muted" style={{ width: 28, textAlign: 'center' }}>{i + 1}</span>
                  <input className="input num" type="number" inputMode="numeric" min={0} value={s.reps} aria-label={t('Set {n} reps', { n: i + 1 })}
                    onChange={(e) => setAt(i, { reps: Number(e.target.value) })} />
                  <input className="input num" type="number" inputMode="decimal" min={0} step="any" value={s.weightKg} aria-label={t('Set {n} weight', { n: i + 1 })}
                    onChange={(e) => setAt(i, { weightKg: Number(e.target.value) })} />
                  <button className="icon-btn" aria-label={t('Remove set {n}', { n: i + 1 })} onClick={() => setSets((x) => x.filter((_, j) => j !== i))}><IconTrash /></button>
                </div>
              ))}
              <button className="btn" onClick={() => setSets((x) => [...x, { ...(x[x.length - 1] ?? { reps: 10, weightKg: 0 }) }])}><IconPlus /> {t('Add set')}</button>
            </div>
            <p className="tiny muted" style={{ margin: 0 }}>{t('Use 0 kg for bodyweight exercises.')}</p>
            <NumberField label={t('Duration (optional)')} suffix="min" value={duration} onChange={setDuration} placeholder={`≈ ${Math.round(sets.length * MINUTES_PER_SET)}`} />
          </>
        ) : (
          <>
            <div className="grid2">
              <NumberField label={t('Duration')} suffix="min" value={duration} onChange={setDuration} />
              {exercise.distance && <NumberField label={t('Distance (optional)')} suffix="km" value={distance} onChange={setDistance} />}
            </div>
            {!paceBased && (
            <div className="field">
              <span>{t('Intensity')}</span>
              <Segmented value={intensity} onChange={setIntensity} label={t('Intensity')}
                options={(Object.keys(INTENSITY) as Intensity[]).map((k) => ({ value: k, label: INTENSITY[k].label }))} />
            </div>
            )}
          </>
        )}
        <label className="field" style={{ maxWidth: 160 }}>{t('Time')}<input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        <label className="field">{t('Notes')}<textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('How did it feel?')} /></label>
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
      <Segmented value={k} onChange={setK} label={t('Type')} options={[{ value: 'aerobic', label: t('Aerobic') }, { value: 'strength', label: t('Weight training') }]} />
      <label className="field">{t('Name')}<input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Landmine press')} /></label>
      <label className="field">{k === 'strength' ? t('Muscle group') : t('Category')}<input className="input" value={group} onChange={(e) => setGroup(e.target.value)} placeholder={k === 'strength' ? t('Shoulders') : t('Conditioning')} /></label>
      <label className="field">{t('Equipment')} <span className="muted">({t('optional')})</span><input className="input" value={equipment} onChange={(e) => setEquipment(e.target.value)} /></label>
      <button className="btn primary block" disabled={!name.trim()} onClick={() => {
        const e: Exercise = {
          id: `ex:custom:${uid()}`, name: name.trim(), kind: k, group: group.trim() || 'Custom', equipment: equipment.trim() || undefined,
          met: k === 'aerobic' ? 7 : 5, distance: k === 'aerobic', custom: true,
        };
        save(e);
        onSaved(e);
      }}>{t('Create exercise')}</button>
    </div>
  );
}

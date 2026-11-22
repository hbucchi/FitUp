import { useState } from 'react';
import type { ActivityLevel, Goal, Profile, Sex } from '../../domain/types';
import { ACTIVITY_LABEL, GOAL_LABEL } from '../../domain/metrics';
import { NumberField, Segmented } from '../components/Fields';

type Draft = Omit<Profile, 'createdAt' | 'heightCm' | 'weightKg' | 'bodyFatPct' | 'birthYear'> & {
  heightCm: number | ''; weightKg: number | ''; bodyFatPct: number | ''; birthYear: number | '';
};

const BF_GUIDE: Record<Sex, string> = {
  male: 'Rough guide: visible abs ≈ 10–12%, athletic ≈ 13–17%, average ≈ 18–25%.',
  female: 'Rough guide: visible abs ≈ 16–19%, athletic ≈ 20–24%, average ≈ 25–32%.',
};

export function ProfileForm({ initial, submitLabel, onSubmit }: {
  initial?: Profile; submitLabel: string; onSubmit: (p: Profile) => void;
}) {
  const [d, setD] = useState<Draft>({
    name: initial?.name ?? '',
    sex: initial?.sex ?? 'male',
    birthYear: initial?.birthYear ?? '',
    heightCm: initial?.heightCm ?? '',
    weightKg: initial?.weightKg ?? '',
    bodyFatPct: initial?.bodyFatPct ?? '',
    activity: initial?.activity ?? 'moderate',
    goal: initial?.goal ?? 'recomp',
  });
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const year = new Date().getFullYear();

  const errors: string[] = [];
  if (d.heightCm === '' || d.heightCm < 120 || d.heightCm > 230) errors.push('Height should be between 120 and 230 cm.');
  if (d.weightKg === '' || d.weightKg < 30 || d.weightKg > 300) errors.push('Weight should be between 30 and 300 kg.');
  if (d.bodyFatPct === '' || d.bodyFatPct < 3 || d.bodyFatPct > 60) errors.push('Body fat should be between 3% and 60%.');
  if (d.birthYear === '' || d.birthYear < year - 100 || d.birthYear > year - 13) errors.push('Enter a valid birth year (13+).');
  const [touched, setTouched] = useState(false);

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        if (errors.length) return;
        onSubmit({
          ...d,
          name: d.name.trim(),
          birthYear: Number(d.birthYear),
          heightCm: Number(d.heightCm),
          weightKg: Number(d.weightKg),
          bodyFatPct: Number(d.bodyFatPct),
          createdAt: initial?.createdAt ?? new Date().toISOString(),
        });
      }}
    >
      <label className="field">
        Name
        <input className="input" value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="How should we call you?" autoComplete="given-name" />
      </label>
      <div className="field">
        <span>Sex <span className="muted">(used for energy and body-composition estimates)</span></span>
        <Segmented<Sex> value={d.sex} onChange={(v) => set('sex', v)} label="Sex"
          options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
      </div>
      <div className="grid2">
        <NumberField label="Birth year" value={d.birthYear} onChange={(v) => set('birthYear', v)} step={1} placeholder="1995" />
        <NumberField label="Height" value={d.heightCm} onChange={(v) => set('heightCm', v)} suffix="cm" placeholder="178" />
        <NumberField label="Weight" value={d.weightKg} onChange={(v) => set('weightKg', v)} suffix="kg" placeholder="78" />
        <NumberField label="Body fat (estimate)" value={d.bodyFatPct} onChange={(v) => set('bodyFatPct', v)} suffix="%" placeholder="18" />
      </div>
      <p className="tiny muted" style={{ margin: '-4px 0 0' }}>{BF_GUIDE[d.sex]} You'll refine it later with the initial assessments.</p>
      <label className="field">
        Activity
        <select className="input" value={d.activity} onChange={(e) => set('activity', e.target.value as ActivityLevel)}>
          {Object.entries(ACTIVITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <label className="field">
        Current focus
        <select className="input" value={d.goal} onChange={(e) => set('goal', e.target.value as Goal)}>
          {Object.entries(GOAL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      {touched && errors.length > 0 && <div className="error">{errors.map((e) => <div key={e}>{e}</div>)}</div>}
      <button className="btn primary block" type="submit">{submitLabel}</button>
    </form>
  );
}

import { useState } from 'react';
import { bodyMetrics, dailyTargets, GOAL_LABEL, IDEAL, idealGap } from '../../domain/metrics';
import { fmt } from '../../domain/nutrients';
import { todayISO } from '../../domain/dates';
import { useStore } from '../../data/store';
import { NumberField } from '../components/Fields';
import { Sheet } from '../components/Sheet';
import { ProfileForm } from './ProfileForm';
import { AssistantSettingsForm } from './AssistantSettings';
import { agentReady, useAssistant } from '../../agent/settings';

export function ProfileScreen() {
  const s = useStore();
  const p = s.profile!;
  const m = bodyMetrics(p);
  const t = dailyTargets(p);
  const gap = idealGap(p);
  const ideal = IDEAL[p.sex];
  const [editing, setEditing] = useState(false);
  const [weighIn, setWeighIn] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const assistant = useAssistant();
  const assistantOn = agentReady(assistant);
  const [w, setW] = useState<number | ''>(p.weightKg);
  const [bf, setBf] = useState<number | ''>(p.bodyFatPct);

  const exportData = () => {
    const { profile, bodyLog, customFoods, customExercises, foodEntries, trainingEntries } = s;
    const blob = new Blob([JSON.stringify({ profile, bodyLog, customFoods, customExercises, foodEntries, trainingEntries }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `micenae-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const pct = Math.round(gap.progress * 100);
  return (
    <>
      <div className="row between" style={{ marginBottom: 14 }}>
        <div>
          <div className="eyebrow">Your measure</div>
          <h1 className="h-display">{p.name || 'Profile'}</h1>
        </div>
        <button className="btn" onClick={() => setEditing(true)}>Edit</button>
      </div>

      <section className="card">
        <div className="card-head">
          <h2 className="h-section">Path to the ideal</h2>
          <span className="badge sea">{pct}%</span>
        </div>
        <div className="bar" style={{ height: 10 }}><span style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--sea), var(--accent))' }} /></div>
        <p className="small muted">
          The classical physique: a normalised FFMI of about {ideal.ffmi} at roughly {ideal.bodyFatPct}% body fat — lean, muscular, and attainable naturally.
        </p>
        <div className="grid2">
          <div className="stat"><div className="k">Lean mass to build</div><div className="v">{fmt(gap.leanToGainKg, 1)} kg</div></div>
          <div className="stat"><div className="k">Fat to lose</div><div className="v">{fmt(gap.fatToLoseKg, 1)} kg</div></div>
          <div className="stat"><div className="k">Target weight</div><div className="v">{fmt(gap.targetWeightKg, 1)} kg</div></div>
          <div className="stat"><div className="k">Target lean mass</div><div className="v">{fmt(gap.targetLeanKg, 1)} kg</div></div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="h-section">Body</h2>
          <button className="btn ghost" onClick={() => setWeighIn(true)}>Log weigh-in</button>
        </div>
        <div className="grid3">
          <div className="stat"><div className="k">Weight</div><div className="v">{fmt(p.weightKg, 1)} kg</div></div>
          <div className="stat"><div className="k">Body fat</div><div className="v">{fmt(p.bodyFatPct, 1)}%</div></div>
          <div className="stat"><div className="k">Height</div><div className="v">{p.heightCm} cm</div></div>
          <div className="stat"><div className="k">Lean mass</div><div className="v">{fmt(m.leanMassKg, 1)} kg</div></div>
          <div className="stat"><div className="k">FFMI (norm.)</div><div className="v">{fmt(m.ffmiNormalized, 1)}</div></div>
          <div className="stat"><div className="k">BMI</div><div className="v">{fmt(m.bmi, 1)}</div></div>
        </div>
        {s.bodyLog.length > 1 && (
          <div className="small muted" style={{ marginTop: 10 }}>
            {s.bodyLog.length} weigh-ins · first {fmt(s.bodyLog[0].weightKg, 1)} kg on {s.bodyLog[0].date}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="h-section" style={{ marginBottom: 10 }}>Daily targets</h2>
        <div className="small muted" style={{ marginBottom: 10 }}>{GOAL_LABEL[p.goal]}</div>
        <div className="grid2">
          <div className="stat"><div className="k">Energy</div><div className="v">{t.kcal} kcal</div></div>
          <div className="stat"><div className="k">Protein</div><div className="v" style={{ color: 'var(--protein)' }}>{t.protein} g</div></div>
          <div className="stat"><div className="k">Carbohydrate</div><div className="v" style={{ color: 'var(--carbs)' }}>{t.carbs} g</div></div>
          <div className="stat"><div className="k">Fat</div><div className="v" style={{ color: 'var(--fat)' }}>{t.fat} g</div></div>
        </div>
        <p className="tiny muted">
          BMR {Math.round(m.bmr)} kcal (Katch–McArdle, from lean mass) × activity = maintenance {Math.round(m.tdee)} kcal.
          Protein is set at 2.2 g per kg of lean mass.
        </p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="h-section">Assistant</h2>
          <span className={`badge ${assistantOn ? 'sea' : ''}`}>{assistantOn ? (assistant.provider === 'anthropic' ? 'Claude' : 'OpenAI') : 'Off'}</span>
        </div>
        <p className="small muted" style={{ marginTop: 0 }}>
          {assistantOn
            ? 'Write or speak what you ate or trained, and it is logged to your diary automatically.'
            : 'Add a Claude or OpenAI API key and the assistant will log your meals and training from text or voice notes.'}
        </p>
        <button className="btn block" onClick={() => setAssistantOpen(true)}>{assistantOn ? 'Assistant settings' : 'Set up assistant'}</button>
      </section>

      <section className="card">
        <h2 className="h-section" style={{ marginBottom: 10 }}>Data</h2>
        <div className="grid2">
          <button className="btn" onClick={exportData}>Export JSON</button>
          <button className="btn danger" onClick={() => confirm('Erase all Micenae data on this device?') && s.resetAll()}>Erase all</button>
        </div>
      </section>

      {editing && (
        <Sheet title="Edit profile" onClose={() => setEditing(false)}>
          <ProfileForm initial={p} submitLabel="Save" onSubmit={(np) => {
            s.setProfile(np);
            if (np.weightKg !== p.weightKg || np.bodyFatPct !== p.bodyFatPct) s.logBody({ date: todayISO(), weightKg: np.weightKg, bodyFatPct: np.bodyFatPct });
            setEditing(false);
          }} />
        </Sheet>
      )}
      {assistantOpen && (
        <Sheet title="Assistant" onClose={() => setAssistantOpen(false)}>
          <AssistantSettingsForm onDone={() => setAssistantOpen(false)} />
        </Sheet>
      )}
      {weighIn && (
        <Sheet title="Weigh-in" onClose={() => setWeighIn(false)}>
          <div className="stack">
            <div className="grid2">
              <NumberField label="Weight" suffix="kg" value={w} onChange={setW} />
              <NumberField label="Body fat (optional)" suffix="%" value={bf} onChange={setBf} />
            </div>
            <button className="btn primary block" disabled={!w} onClick={() => {
              s.logBody({ date: todayISO(), weightKg: Number(w), bodyFatPct: bf === '' ? undefined : Number(bf) });
              setWeighIn(false);
            }}>Save</button>
          </div>
        </Sheet>
      )}
    </>
  );
}

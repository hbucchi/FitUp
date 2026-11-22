import { useState } from 'react';
import { bodyMetrics, dailyTargets, GOAL_LABEL } from '../../domain/metrics';
import { ascent, LEVELS } from '../../domain/objective';
import { Emblem } from '../components/Emblem';
import { fmt } from '../../domain/nutrients';
import { todayISO } from '../../domain/dates';
import { useStore } from '../../data/store';
import { NumberField } from '../components/Fields';
import { Sheet } from '../components/Sheet';
import { ProfileForm } from './ProfileForm';
import { AssistantSettingsForm } from './AssistantSettings';
import { agentReady, useAssistant } from '../../agent/settings';
import { signInWithGoogle, signOut, useAuthUser } from '../../firebase/auth';
import { useSession } from '../../firebase/session';
import { signOutAndClear } from '../../firebase/sync';

export function ProfileScreen() {
  const s = useStore();
  const p = s.profile!;
  const m = bodyMetrics(p);
  const t = dailyTargets(p);
  const [editing, setEditing] = useState(false);
  const [weighIn, setWeighIn] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const assistant = useAssistant();
  const assistantOn = agentReady(assistant);
  const user = useAuthUser();
  const setLocalMode = useSession((x) => x.setLocalMode);
  const [w, setW] = useState<number | ''>(p.weightKg);
  const [bf, setBf] = useState<number | ''>(p.bodyFatPct);

  const exportData = () => {
    const { profile, bodyLog, customFoods, customExercises, foodEntries, trainingEntries, objective, activePlan, plannedSessions, nutritionPlan, reviews } = s;
    const blob = new Blob([JSON.stringify({ profile, bodyLog, customFoods, customExercises, foodEntries, trainingEntries, objective, activePlan, plannedSessions, nutritionPlan, reviews }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `micenae-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div className="row between" style={{ marginBottom: 14 }}>
        <div>
          <div className="eyebrow">Your measure</div>
          <h1 className="h-display">{p.name || 'Profile'}</h1>
        </div>
        <button className="btn" onClick={() => setEditing(true)}>Edit</button>
      </div>

      {(() => {
        const a = s.objective ? ascent(s.objective, p) : undefined;
        return (
          <a href="#plan" className="card row" style={{ textDecoration: 'none', color: 'inherit', gap: 14 }}>
            <Emblem level={a?.level ?? 0} size={48} />
            <div style={{ flex: 1 }}>
              <div className="eyebrow">Your rank</div>
              <div className="h-section">{LEVELS[a?.level ?? 0].name}</div>
              <div className="tiny muted">{a ? `${Math.round(a.progress * 100)}% of the way to your objective` : 'Set your objective in the Plan tab'}</div>
            </div>
          </a>
        );
      })()}

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

      {!s.nutritionPlan && <section className="card">
        <h2 className="h-section" style={{ marginBottom: 10 }}>Daily targets</h2>
        <div className="small muted" style={{ marginBottom: 10 }}>{GOAL_LABEL[p.goal]}</div>
        <div className="grid2">
          <div className="stat"><div className="k">Energy</div><div className="v">{t.kcal} kcal</div></div>
          <div className="stat"><div className="k">Protein</div><div className="v" style={{ color: 'var(--protein)' }}>{t.protein} g</div></div>
          <div className="stat"><div className="k">Carbohydrate</div><div className="v" style={{ color: 'var(--carbs)' }}>{t.carbs} g</div></div>
          <div className="stat"><div className="k">Fat</div><div className="v" style={{ color: 'var(--fat)' }}>{t.fat} g</div></div>
        </div>
      </section>}

      <section className="card">
        <div className="card-head">
          <h2 className="h-section">Assistant</h2>
          <span className={`badge ${assistantOn ? 'sea' : ''}`}>{assistantOn ? (assistant.provider === 'anthropic' ? 'Claude' : 'OpenAI') : 'Off'}</span>
        </div>
        <button className="btn block" onClick={() => setAssistantOpen(true)}>{assistantOn ? 'Assistant settings' : 'Set up assistant'}</button>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="h-section">Account</h2>
          <span className={`badge ${user ? 'sea' : ''}`}>{user ? 'Synced' : 'This device only'}</span>
        </div>
        {user ? (
          <div className="row between">
            <div className="small" style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{user.displayName ?? 'Signed in'}</div>
              <div className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
            </div>
            {/* the account keeps the data; only this device's copy is cleared */}
            <button className="btn" onClick={() => signOutAndClear(signOut)}>Sign out</button>
          </div>
        ) : (
          <>
            <p className="small muted" style={{ marginTop: 0 }}>Back up and sync across devices.</p>
            <button className="btn primary block" onClick={() => signInWithGoogle().then(() => setLocalMode(false)).catch((e) => alert(e.message))}>Continue with Google</button>
          </>
        )}
      </section>

      <section className="card">
        <h2 className="h-section" style={{ marginBottom: 10 }}>Data</h2>
        <div className="grid2">
          <button className="btn" onClick={exportData}>Export JSON</button>
          <button className="btn danger" onClick={() => confirm(user ? 'Erase ALL your Micenae data, in your account and on this device?' : 'Erase all Micenae data on this device?') && s.resetAll()}>Erase all</button>
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

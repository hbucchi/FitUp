import { useState } from 'react';
import { bodyMetrics, dailyTargets, GOAL_LABEL } from '../../domain/metrics';
import { ascent } from '../../domain/objective';
import { useRank } from '../../data/useRank';
import { RankImage } from '../components/RankImage';
import { fmt } from '../../domain/nutrients';
import { prettyDate, todayISO } from '../../domain/dates';
import { useStore } from '../../data/store';
import { NumberField, Segmented } from '../components/Fields';
import { Sheet } from '../components/Sheet';
import { ProfileForm } from './ProfileForm';
import { AssistantSettingsForm } from './AssistantSettings';
import { agentReady, useAssistant } from '../../agent/settings';
import { signInWithGoogle, signOut, useAuthUser } from '../../firebase/auth';
import { useSession } from '../../firebase/session';
import { PREVIEW } from '../../firebase/app';
import { signOutAndClear } from '../../firebase/sync';
import { LOCALE, setLocale, t } from '../../i18n';

export function ProfileScreen() {
  const rank = useRank();
  const s = useStore();
  const p = s.profile!;
  const m = bodyMetrics(p);
  const targets = dailyTargets(p);
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
    const { profile, bodyLog, customFoods, customExercises, foodEntries, trainingEntries, objective, activePlan, plannedSessions, nutritionPlan, reviews, checkIns, symptoms, bowelMovements } = s;
    const blob = new Blob([JSON.stringify({ profile, bodyLog, customFoods, customExercises, foodEntries, trainingEntries, objective, activePlan, plannedSessions, nutritionPlan, reviews, checkIns, symptoms, bowelMovements }, null, 2)], { type: 'application/json' });
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
          <div className="eyebrow">{t('Your measure')}</div>
          <h1 className="h-display">{p.name || t('Profile')}</h1>
        </div>
        <button className="btn" onClick={() => setEditing(true)}>{t('Edit')}</button>
      </div>

      {(() => {
        const a = s.objective ? ascent(s.objective, p) : undefined;
        return (
          <a href="#plan" className="card row" style={{ textDecoration: 'none', color: 'inherit', gap: 14 }}>
            <RankImage index={rank.index} sex={rank.sex} size={52} />
            <div style={{ flex: 1 }}>
              <div className="eyebrow">{t('Your rank')} · {rank.tierName}</div>
              <div className="h-section">{rank.name}</div>
              <div className="tiny muted">
                {t('{n} points', { n: Math.floor(rank.points).toLocaleString() })} · {a ? t('{pct}% of the way to your objective', { pct: Math.round(a.progress * 100) }) : t('Set your objective in the Plan tab')}
              </div>
            </div>
          </a>
        );
      })()}

      <section className="card">
        <div className="card-head">
          <h2 className="h-section">{t('Body')}</h2>
          <button className="btn ghost" onClick={() => setWeighIn(true)}>{t('Log weigh-in')}</button>
        </div>
        <div className="grid3">
          <div className="stat"><div className="k">{t('Weight')}</div><div className="v">{fmt(p.weightKg, 1)} kg</div></div>
          <div className="stat"><div className="k">{t('Body fat')}</div><div className="v">{fmt(p.bodyFatPct, 1)}%</div></div>
          <div className="stat"><div className="k">{t('Height')}</div><div className="v">{p.heightCm} cm</div></div>
          <div className="stat"><div className="k">{t('Lean mass')}</div><div className="v">{fmt(m.leanMassKg, 1)} kg</div></div>
          <div className="stat"><div className="k">FFMI (norm.)</div><div className="v">{fmt(m.ffmiNormalized, 1)}</div></div>
          <div className="stat"><div className="k">{t('BMI')}</div><div className="v">{fmt(m.bmi, 1)}</div></div>
        </div>
        {s.bodyLog.length > 1 && (
          <div className="small muted" style={{ marginTop: 10 }}>
            {t('{n} weigh-ins · first {w} kg on {d}', { n: s.bodyLog.length, w: fmt(s.bodyLog[0].weightKg, 1), d: prettyDate(s.bodyLog[0].date) })}
          </div>
        )}
      </section>

      {!s.nutritionPlan && <section className="card">
        <h2 className="h-section" style={{ marginBottom: 10 }}>{t('Daily targets')}</h2>
        <div className="small muted" style={{ marginBottom: 10 }}>{GOAL_LABEL[p.goal]}</div>
        <div className="grid2">
          <div className="stat"><div className="k">{t('Energy')}</div><div className="v">{targets.kcal} kcal</div></div>
          <div className="stat"><div className="k">{t('Protein')}</div><div className="v" style={{ color: 'var(--protein)' }}>{targets.protein} g</div></div>
          <div className="stat"><div className="k">{t('Carbohydrate')}</div><div className="v" style={{ color: 'var(--carbs)' }}>{targets.carbs} g</div></div>
          <div className="stat"><div className="k">{t('Fat')}</div><div className="v" style={{ color: 'var(--fat)' }}>{targets.fat} g</div></div>
        </div>
      </section>}

      <section className="card">
        <div className="card-head">
          <h2 className="h-section">{t('Assistant')}</h2>
          <span className={`badge ${assistantOn ? 'sea' : ''}`}>{assistantOn ? (assistant.provider === 'anthropic' ? 'Claude' : 'OpenAI') : t('Off')}</span>
        </div>
        <button className="btn block" onClick={() => setAssistantOpen(true)}>{assistantOn ? t('Assistant settings') : t('Set up assistant')}</button>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="h-section">{t('Language')}</h2>
        </div>
        <Segmented value={LOCALE} onChange={(v) => v !== LOCALE && setLocale(v)} label={t('Language')}
          options={[{ value: 'en', label: 'English' }, { value: 'pt', label: 'Português (Brasil)' }]} />
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="h-section">{t('Account')}</h2>
          <span className={`badge ${user ? 'sea' : ''}`}>{user ? t('Synced') : t('This device only')}</span>
        </div>
        {PREVIEW ? (
          <p className="small muted" style={{ margin: 0 }}>{t('Preview — data stays in this browser.')}</p>
        ) : user ? (
          <div className="row between">
            <div className="small" style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{user.displayName ?? t('Signed in')}</div>
              <div className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
            </div>
            {/* the account keeps the data; only this device's copy is cleared */}
            <button className="btn" onClick={() => signOutAndClear(signOut)}>{t('Sign out')}</button>
          </div>
        ) : (
          <>
            <p className="small muted" style={{ marginTop: 0 }}>{t('Back up and sync across devices.')}</p>
            <button className="btn primary block" onClick={() => signInWithGoogle().then(() => setLocalMode(false)).catch((e) => alert(e.message))}>{t('Continue with Google')}</button>
          </>
        )}
      </section>

      <section className="card">
        <h2 className="h-section" style={{ marginBottom: 10 }}>{t('Data')}</h2>
        <div className="grid2">
          <button className="btn" onClick={exportData}>{t('Export JSON')}</button>
          <button className="btn danger" onClick={() => confirm(user ? t('Erase ALL your Micenae data, in your account and on this device?') : t('Erase all Micenae data on this device?')) && s.resetAll()}>{t('Erase all')}</button>
        </div>
      </section>

      {editing && (
        <Sheet title={t('Edit profile')} onClose={() => setEditing(false)}>
          <ProfileForm initial={p} submitLabel={t('Save')} onSubmit={(np) => {
            s.setProfile(np);
            if (np.weightKg !== p.weightKg || np.bodyFatPct !== p.bodyFatPct) s.logBody({ date: todayISO(), weightKg: np.weightKg, bodyFatPct: np.bodyFatPct });
            setEditing(false);
          }} />
        </Sheet>
      )}
      {assistantOpen && (
        <Sheet title={t('Assistant')} onClose={() => setAssistantOpen(false)}>
          <AssistantSettingsForm onDone={() => setAssistantOpen(false)} />
        </Sheet>
      )}
      {weighIn && (
        <Sheet title={t('Weigh-in')} onClose={() => setWeighIn(false)}>
          <div className="stack">
            <div className="grid2">
              <NumberField label={t('Weight')} suffix="kg" value={w} onChange={setW} />
              <NumberField label={t('Body fat (optional)')} suffix="%" value={bf} onChange={setBf} />
            </div>
            <button className="btn primary block" disabled={!w} onClick={() => {
              s.logBody({ date: todayISO(), weightKg: Number(w), bodyFatPct: bf === '' ? undefined : Number(bf) });
              setWeighIn(false);
            }}>{t('Save')}</button>
          </div>
        </Sheet>
      )}
    </>
  );
}

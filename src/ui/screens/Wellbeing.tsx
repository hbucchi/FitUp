import { useMemo, useState } from 'react';
import type { BowelMovement, Symptom, SymptomKind } from '../../domain/types';
import { SYMPTOM_KINDS } from '../../domain/types';
import { addDays, weekday } from '../../domain/programs';
import { prettyDate, todayISO } from '../../domain/dates';
import { recoverySignals } from '../../domain/weekly';
import { useStore } from '../../data/store';
import { agentReady, useAssistant } from '../../agent/settings';
import { IconMic, IconPlus } from '../components/Icons';
import { CheckInSheet, checkInSummary } from './CheckIn';
import { SymptomSheet } from './SymptomSheet';
import { BowelSheet, bristolBand, bristolTone } from './BowelSheet';
import { VoiceLogSheet } from './VoiceLog';
import { t } from '../../i18n';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => t(d).charAt(0));

/** 14 days: sleep as bars (0–10 h), mood as dots (1–5). */
function Trend({ days }: { days: { date: string; sleep?: number; mood?: number }[] }) {
  const W = 300, H = 96, top = 8, base = 72, col = W / days.length;
  const y = (h: number) => base - (Math.min(h, 10) / 10) * (base - top);
  const moodY = (m: number) => base - ((m - 1) / 4) * (base - top);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={t('Sleep and mood, last 14 days')}>
      <line x1="0" x2={W} y1={y(7)} y2={y(7)} stroke="var(--line)" strokeDasharray="3 3" />
      <text x={W} y={y(7) - 3} textAnchor="end" fontSize="9" fill="var(--muted)">{t('7 h')}</text>
      {days.map((d, i) => (
        <g key={d.date}>
          {d.sleep != null && (
            <rect x={i * col + col * 0.22} y={y(d.sleep)} width={col * 0.56} height={base - y(d.sleep)} rx="2"
              fill={d.sleep < 6 ? 'var(--danger)' : 'var(--accent)'} opacity="0.85" />
          )}
          {d.mood != null && <circle cx={i * col + col / 2} cy={moodY(d.mood)} r="3.2" fill="var(--sea)" stroke="var(--surface)" strokeWidth="1.2" />}
          <text x={i * col + col / 2} y={H - 6} textAnchor="middle" fontSize="9" fill={i === days.length - 1 ? 'var(--accent)' : 'var(--muted)'}>{DAY[weekday(d.date)]}</text>
        </g>
      ))}
    </svg>
  );
}

export function Wellbeing() {
  const today = todayISO();
  const checkIns = useStore((s) => s.checkIns);
  const symptoms = useStore((s) => s.symptoms);
  const bowel = useStore((s) => s.bowelMovements ?? []);
  const assistantOn = agentReady(useAssistant());
  const [modal, setModal] = useState<'checkin' | 'symptom' | 'bowel' | 'voice' | { edit: Symptom } | { bowel: BowelMovement } | null>(null);

  const todayCheckIn = checkIns.find((c) => c.date === today);
  const todaySymptoms = symptoms.filter((s) => s.date === today).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  const days = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map((date) => {
      const c = checkIns.find((x) => x.date === date);
      return { date, sleep: c?.sleepHours, mood: c?.mood };
    }),
    [checkIns, today],
  );
  const rec = useMemo(() => recoverySignals(checkIns, today, symptoms), [checkIns, symptoms, today]);
  const month = symptoms.filter((s) => s.date >= addDays(today, -30) && s.date < today).sort((a, b) => b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? ''));
  const counts = (Object.keys(SYMPTOM_KINDS) as SymptomKind[])
    .map((k) => [k, month.filter((s) => s.kind === k).length] as const)
    .filter(([, n]) => n > 0);

  // bowel habits, last 7 days (today included)
  const todayBowel = bowel.filter((b) => b.date === today).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  const week = bowel.filter((b) => b.date > addDays(today, -7) && b.date <= today);
  const lastDate = bowel.map((b) => b.date).filter((d) => d <= today).sort().pop();
  const daysSince = lastDate ? Math.round((Date.parse(today) - Date.parse(lastDate)) / 86400000) : undefined;
  const avgType = week.length ? week.reduce((s, b) => s + b.bristol, 0) / week.length : undefined;
  const bowelRow = (b: BowelMovement) => (
    <li key={b.id}>
      <button className="list-item" onClick={() => setModal({ bowel: b })}>
        <div className="main">
          <div className="title">{t('Bowel movement')}</div>
          <div className="sub">{[b.time, b.note].filter(Boolean).join(' · ')}</div>
        </div>
        <span className="badge" style={{ color: bristolTone(b.bristol) }}>{t('Type {n}', { n: b.bristol })}</span>
      </button>
    </li>
  );

  const row = (s: Symptom, withDate = false) => (
    <li key={s.id}>
      <button className="list-item" onClick={() => setModal({ edit: s })}>
        <div className="main">
          <div className="title">{t(SYMPTOM_KINDS[s.kind])}{s.bodyPart ? ` · ${s.bodyPart}` : ''}</div>
          <div className="sub">{[withDate ? prettyDate(s.date) : '', s.time, s.note].filter(Boolean).join(' · ')}</div>
        </div>
        <span className="badge" style={s.severity >= 4 ? { color: 'var(--danger)' } : undefined}>{s.severity}/5</span>
      </button>
    </li>
  );

  return (
    <>
      <h1 className="h-display" style={{ marginBottom: 14 }}>{t('Wellbeing')}</h1>

      {assistantOn && (
        <button className="btn primary block" style={{ marginBottom: 10 }} onClick={() => setModal('voice')}><IconMic /> {t('Tell the assistant')}</button>
      )}
      <div className="grid2" style={{ marginBottom: 14 }}>
        <button className="btn" onClick={() => setModal('checkin')}>{todayCheckIn ? t('Edit check-in') : t('Check-in')}</button>
        <button className="btn" onClick={() => setModal('symptom')}><IconPlus /> {t('Symptom')}</button>
      </div>
      <button className="btn block" style={{ marginTop: -4, marginBottom: 14 }} onClick={() => setModal('bowel')}><IconPlus /> {t('Bowel movement')}</button>

      <section className="card flush">
        <div className="meal-head"><h2 className="h-section">{t('Today')}</h2></div>
        <div className="empty" style={{ color: todayCheckIn ? 'var(--ink-2)' : undefined }}>
          {todayCheckIn ? checkInSummary(todayCheckIn) || t('Checked in') : t('No check-in yet.')}
        </div>
        {todaySymptoms.length > 0 && <ul className="list">{todaySymptoms.map((s) => row(s))}</ul>}
        {todayBowel.length > 0 && <ul className="list">{todayBowel.map(bowelRow)}</ul>}
      </section>

      {bowel.length > 0 && (
        <section className="card">
          <div className="card-head"><h2 className="h-section">{t('Digestion · 7 days')}</h2></div>
          <div className="grid3">
            <div className="stat"><div className="k">{t('Bowel movements')}</div><div className="v">{week.length}</div></div>
            <div className="stat"><div className="k">{t('Average type')}</div><div className="v" style={{ color: avgType != null ? bristolTone(Math.round(avgType)) : undefined }}>{avgType != null ? avgType.toFixed(1) : '—'}</div></div>
            <div className="stat"><div className="k">{t('Last')}</div><div className="v">{daysSince == null ? '—' : daysSince === 0 ? t('Today') : t('{n} d ago', { n: daysSince })}</div></div>
          </div>
          {avgType != null && <div className="tiny muted" style={{ marginTop: 8 }}>{bristolBand(Math.round(avgType))} · {t('types 3–4 are the healthy range')}</div>}
          {daysSince != null && daysSince >= 3 && <div className="notice small" style={{ marginTop: 8 }}>{t('{n} days without a bowel movement — more water, fibre and a walk help.', { n: daysSince })}</div>}
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2 className="h-section">{t('14 days')}</h2>
          <span className="tiny muted"><span style={{ color: 'var(--accent)' }}>■</span> {t('sleep ·')} <span style={{ color: 'var(--sea)' }}>●</span> {t('mood')}</span>
        </div>
        <Trend days={days} />
        {rec.checkIns > 0 && (
          <div className="grid3" style={{ marginTop: 10 }}>
            <div className="stat"><div className="k">{t('Sleep · 7 d')}</div><div className="v">{rec.sleepAvg != null ? `${rec.sleepAvg.toFixed(1)} h` : '—'}</div></div>
            <div className="stat"><div className="k">{t('Mood')}</div><div className="v">{rec.moodAvg != null ? rec.moodAvg.toFixed(1) : '—'}</div></div>
            <div className="stat"><div className="k">{t('Energy')}</div><div className="v">{rec.energyAvg != null ? rec.energyAvg.toFixed(1) : '—'}</div></div>
          </div>
        )}
      </section>

      {month.length > 0 && (
        <section className="card flush">
          <div className="meal-head"><h2 className="h-section">{t('Last 30 days')}</h2></div>
          <div className="chips" style={{ padding: '0 16px 10px' }}>
            {counts.map(([k, n]) => <span key={k} className="badge">{t(SYMPTOM_KINDS[k])} ×{n}</span>)}
          </div>
          <ul className="list">{month.slice(0, 12).map((s) => row(s, true))}</ul>
        </section>
      )}

      {modal === 'checkin' && <CheckInSheet date={today} onClose={() => setModal(null)} />}
      {modal === 'symptom' && <SymptomSheet date={today} onClose={() => setModal(null)} />}
      {modal === 'voice' && <VoiceLogSheet date={today} onClose={() => setModal(null)} placeholder={t('Slept 6 h, headache this afternoon, cramp in my left calf')} />}
      {modal === 'bowel' && <BowelSheet date={today} onClose={() => setModal(null)} />}
      {modal && typeof modal === 'object' && 'edit' in modal && <SymptomSheet date={modal.edit.date} symptom={modal.edit} onClose={() => setModal(null)} />}
      {modal && typeof modal === 'object' && 'bowel' in modal && <BowelSheet date={modal.bowel.date} entry={modal.bowel} onClose={() => setModal(null)} />}
    </>
  );
}

import { useState } from 'react';
import type { CheckIn } from '../../domain/types';
import { useStore } from '../../data/store';
import { Sheet } from '../components/Sheet';
import { t } from '../../i18n';

type ScaleKey = 'sleepQuality' | 'mood' | 'energy' | 'stress' | 'soreness';

export const SCALES: { key: ScaleKey; label: string; low: string; high: string }[] = [
  { key: 'sleepQuality', label: t('Sleep quality'), low: t('Poor'), high: t('Great') },
  { key: 'mood', label: t('Mood'), low: t('Low'), high: t('Great') },
  { key: 'energy', label: t('Energy'), low: t('Drained'), high: t('Energised') },
  { key: 'stress', label: t('Stress'), low: t('Calm'), high: t('High') },
  { key: 'soreness', label: t('Soreness'), low: t('None'), high: t('Very sore') },
];

export function Scale({ label, low, high, value, onChange }: { label: string; low: string; high: string; value?: number; onChange: (v?: number) => void }) {
  return (
    <div className="field">
      <span>{label}</span>
      <div className="row" style={{ gap: 6 }} role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" className="chip num" aria-pressed={value === n} aria-label={`${label} ${n}`}
            style={{ flex: 1, padding: '8px 0' }} onClick={() => onChange(value === n ? undefined : n)}>
            {n}
          </button>
        ))}
      </div>
      <div className="row between tiny muted"><span>{low}</span><span>{high}</span></div>
    </div>
  );
}

export function CheckInSheet({ date, onClose }: { date: string; onClose: () => void }) {
  const existing = useStore((s) => s.checkIns.find((c) => c.date === date));
  const save = useStore((s) => s.saveCheckIn);
  const [c, setC] = useState<CheckIn>(existing ?? { date, sleepHours: 7.5 });
  const set = (patch: Partial<CheckIn>) => setC((x) => ({ ...x, ...patch }));
  const hours = c.sleepHours ?? 0;

  return (
    <Sheet title={t('Check-in')} onClose={onClose} footer={<button className="btn primary block" onClick={() => { save({ ...c, note: c.note?.trim() || undefined }); onClose(); }}>{t('Save')}</button>}>
      <div className="stack">
        <div className="field">
          <span>{t('Sleep')}</span>
          <div className="row" style={{ gap: 10 }}>
            <button type="button" className="icon-btn" aria-label={t('Less sleep')} onClick={() => set({ sleepHours: Math.max(0, hours - 0.5) })}>−</button>
            <div className="big-num num" style={{ fontSize: 28, minWidth: 90, textAlign: 'center' }}>{hours}<span className="small muted" style={{ fontFamily: 'var(--font-body)' }}> h</span></div>
            <button type="button" className="icon-btn" aria-label={t('More sleep')} onClick={() => set({ sleepHours: Math.min(16, hours + 0.5) })}>+</button>
          </div>
        </div>
        {SCALES.map((s) => (
          <Scale key={s.key} label={s.label} low={s.low} high={s.high} value={c[s.key]} onChange={(v) => set({ [s.key]: v })} />
        ))}
        <label className="field">
          {t('Note')}
          <input className="input" value={c.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder={t('Optional')} />
        </label>
      </div>
    </Sheet>
  );
}

/** One-line summary, e.g. "7.5 h sleep · mood 4 · energy 3". */
export function checkInSummary(c: CheckIn): string {
  const parts: string[] = [];
  if (c.sleepHours != null) parts.push(t('{h} h sleep', { h: c.sleepHours }));
  if (c.mood) parts.push(t('mood {n}', { n: c.mood }));
  if (c.energy) parts.push(t('energy {n}', { n: c.energy }));
  if (c.stress) parts.push(t('stress {n}', { n: c.stress }));
  if (c.soreness) parts.push(t('soreness {n}', { n: c.soreness }));
  return parts.join(' · ');
}

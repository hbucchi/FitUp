import { useState } from 'react';
import type { CheckIn } from '../../domain/types';
import { useStore } from '../../data/store';
import { Sheet } from '../components/Sheet';

type ScaleKey = 'sleepQuality' | 'mood' | 'energy' | 'stress' | 'soreness';

export const SCALES: { key: ScaleKey; label: string; low: string; high: string }[] = [
  { key: 'sleepQuality', label: 'Sleep quality', low: 'Poor', high: 'Great' },
  { key: 'mood', label: 'Mood', low: 'Low', high: 'Great' },
  { key: 'energy', label: 'Energy', low: 'Drained', high: 'Energised' },
  { key: 'stress', label: 'Stress', low: 'Calm', high: 'High' },
  { key: 'soreness', label: 'Soreness', low: 'None', high: 'Very sore' },
];

function Scale({ label, low, high, value, onChange }: { label: string; low: string; high: string; value?: number; onChange: (v?: number) => void }) {
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
    <Sheet title="Check-in" onClose={onClose} footer={<button className="btn primary block" onClick={() => { save({ ...c, note: c.note?.trim() || undefined }); onClose(); }}>Save</button>}>
      <div className="stack">
        <div className="field">
          <span>Sleep</span>
          <div className="row" style={{ gap: 10 }}>
            <button type="button" className="icon-btn" aria-label="Less sleep" onClick={() => set({ sleepHours: Math.max(0, hours - 0.5) })}>−</button>
            <div className="big-num num" style={{ fontSize: 28, minWidth: 90, textAlign: 'center' }}>{hours}<span className="small muted" style={{ fontFamily: 'var(--font-body)' }}> h</span></div>
            <button type="button" className="icon-btn" aria-label="More sleep" onClick={() => set({ sleepHours: Math.min(16, hours + 0.5) })}>+</button>
          </div>
        </div>
        {SCALES.map((s) => (
          <Scale key={s.key} label={s.label} low={s.low} high={s.high} value={c[s.key]} onChange={(v) => set({ [s.key]: v })} />
        ))}
        <label className="field">
          Note
          <input className="input" value={c.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder="Optional" />
        </label>
      </div>
    </Sheet>
  );
}

/** One-line summary, e.g. "7.5 h sleep · mood 4 · energy 3". */
export function checkInSummary(c: CheckIn): string {
  const parts: string[] = [];
  if (c.sleepHours != null) parts.push(`${c.sleepHours} h sleep`);
  if (c.mood) parts.push(`mood ${c.mood}`);
  if (c.energy) parts.push(`energy ${c.energy}`);
  if (c.stress) parts.push(`stress ${c.stress}`);
  if (c.soreness) parts.push(`soreness ${c.soreness}`);
  return parts.join(' · ');
}

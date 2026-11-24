import { useState } from 'react';
import type { BowelMovement, BristolType } from '../../domain/types';
import { BRISTOL } from '../../domain/types';
import { nowHHMM } from '../../domain/dates';
import { uid, useStore } from '../../data/store';
import { Sheet } from '../components/Sheet';
import { t } from '../../i18n';

/** Colour per Bristol band: hard (1–2), normal (3–4), loose (5–7). */
export const bristolTone = (b: number) => (b <= 2 ? 'var(--accent)' : b <= 4 ? 'var(--sea)' : 'var(--danger)');
export const bristolBand = (b: number) => (b <= 2 ? t('Hard') : b <= 4 ? t('Normal') : t('Loose'));

/** Simple drawing of each type: lumps → smooth log → liquid. */
function StoolIcon({ type, size = 34 }: { type: BristolType; size?: number }) {
  const c = '#8a5a2b';
  const shapes: Record<BristolType, JSX.Element> = {
    1: <>{[[8, 18], [16, 14], [24, 19], [17, 23], [28, 13]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.4" fill={c} />)}</>,
    2: <path d="M5 18c2-6 6-6 8-3 2-5 7-5 9-1 2-4 7-3 8 2 1 5-4 7-7 5-2 4-7 4-9 0-3 3-8 2-9-3z" fill={c} />,
    3: <><rect x="4" y="12" width="28" height="10" rx="5" fill={c} /><path d="M11 12l2 4M18 12l1 4M25 13l-1 4" stroke="#f5e9d6" strokeWidth="1.2" /></>,
    4: <path d="M4 20c4-8 12-9 18-6s9 0 10-2c1 6-6 11-14 10S5 25 4 20z" fill={c} />,
    5: <>{[[9, 17], [19, 15], [28, 19]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="5" ry="4" fill={c} />)}</>,
    6: <path d="M4 20c2-4 5-2 7-5s5 1 7-2 6 1 8-1 4 3 6 2c0 4-3 5-6 5s-5 2-8 0-5 2-8 0-6 3-6 1z" fill={c} opacity="0.85" />,
    7: <path d="M3 19c4-3 8 3 12 0s8 3 12 0 5 2 6 1v4c-4 2-8-2-12 1s-8-3-12 0-5 0-6-1z" fill={c} opacity="0.6" />,
  };
  return <svg width={size} height={size * 0.94} viewBox="0 0 36 34" aria-hidden>{shapes[type]}</svg>;
}

export function BowelSheet({ date, entry, onClose }: { date: string; entry?: BowelMovement; onClose: () => void }) {
  const save = useStore((s) => s.saveBowel);
  const remove = useStore((s) => s.removeBowel);
  const [x, setX] = useState<BowelMovement>(entry ?? { id: uid(), date, time: nowHHMM(), bristol: 4, via: 'manual' });
  const set = (p: Partial<BowelMovement>) => setX((v) => ({ ...v, ...p }));
  return (
    <Sheet
      title={entry ? t('Bowel movement') : t('Log bowel movement')}
      onClose={onClose}
      footer={
        <div className="stack" style={{ gap: 8 }}>
          <button className="btn primary block" onClick={() => { save({ ...x, note: x.note?.trim() || undefined }); onClose(); }}>{t('Save')}</button>
          {entry && <button className="btn ghost danger block" onClick={() => { remove(entry.id); onClose(); }}>{t('Delete')}</button>}
        </div>
      }
    >
      <div className="stack">
        <div className="eyebrow">{t('Bristol stool scale')}</div>
        <div className="stack" style={{ gap: 6 }}>
          {(Object.keys(BRISTOL).map(Number) as BristolType[]).map((b) => (
            <button key={b} type="button" className="chip" aria-pressed={x.bristol === b} onClick={() => set({ bristol: b })}
              style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'flex-start', borderRadius: 12, padding: '6px 10px', textAlign: 'left' }}>
              <StoolIcon type={b} />
              <span style={{ flex: 1 }}><strong>{t('Type {n}', { n: b })}</strong> · {t(BRISTOL[b])}</span>
              <span className="tiny" style={{ color: bristolTone(b) }}>{bristolBand(b)}</span>
            </button>
          ))}
        </div>
        {x.bristol === 7 && <div className="tiny" style={{ color: 'var(--danger)' }}>{t('Watery stools: drink fluids with salt. Lasting more than 2 days or with blood or fever? See a doctor.')}</div>}
        <div className="grid2" style={{ gridTemplateColumns: '1fr 2fr' }}>
          <label className="field">{t('Time')}<input className="input" type="time" value={x.time ?? ''} onChange={(e) => set({ time: e.target.value })} /></label>
          <label className="field">{t('Note')}<input className="input" value={x.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder={t('Optional')} /></label>
        </div>
      </div>
    </Sheet>
  );
}

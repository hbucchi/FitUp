import { useState } from 'react';
import type { Symptom, SymptomKind } from '../../domain/types';
import { SYMPTOM_KINDS } from '../../domain/types';
import { nowHHMM } from '../../domain/dates';
import { uid, useStore } from '../../data/store';
import { Sheet } from '../components/Sheet';
import { Scale } from './CheckIn';
import { t } from '../../i18n';

const WITH_BODY_PART: SymptomKind[] = ['cramp', 'pain', 'other'];

export function SymptomSheet({ date, symptom, onClose }: { date: string; symptom?: Symptom; onClose: () => void }) {
  const save = useStore((s) => s.saveSymptom);
  const remove = useStore((s) => s.removeSymptom);
  const [x, setX] = useState<Symptom>(symptom ?? { id: uid(), date, time: nowHHMM(), kind: 'headache', severity: 2, via: 'manual' });
  const set = (p: Partial<Symptom>) => setX((v) => ({ ...v, ...p }));

  return (
    <Sheet
      title={symptom ? t('Symptom') : t('Add symptom')}
      onClose={onClose}
      footer={
        <div className="stack" style={{ gap: 8 }}>
          <button className="btn primary block" onClick={() => { save({ ...x, bodyPart: x.bodyPart?.trim() || undefined, note: x.note?.trim() || undefined }); onClose(); }}>{t('Save')}</button>
          {symptom && <button className="btn ghost danger block" onClick={() => { remove(symptom.id); onClose(); }}>{t('Delete')}</button>}
        </div>
      }
    >
      <div className="stack">
        <div className="chips">
          {(Object.keys(SYMPTOM_KINDS) as SymptomKind[]).map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={x.kind === k} onClick={() => set({ kind: k })}>{t(SYMPTOM_KINDS[k])}</button>
          ))}
        </div>
        <Scale label={t('Severity')} low={t('Mild')} high={t('Severe')} value={x.severity} onChange={(v) => set({ severity: v ?? x.severity })} />
        {x.severity >= 4 && <div className="tiny" style={{ color: 'var(--danger)' }}>{t('Severe or lasting? See a doctor.')}</div>}
        {WITH_BODY_PART.includes(x.kind) && (
          <label className="field">{t('Where')}<input className="input" value={x.bodyPart ?? ''} onChange={(e) => set({ bodyPart: e.target.value })} placeholder={t('e.g. left calf')} /></label>
        )}
        <div className="grid2" style={{ gridTemplateColumns: '1fr 2fr' }}>
          <label className="field">{t('Time')}<input className="input" type="time" value={x.time ?? ''} onChange={(e) => set({ time: e.target.value })} /></label>
          <label className="field">{t('Note')}<input className="input" value={x.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder={t('Optional')} /></label>
        </div>
      </div>
    </Sheet>
  );
}

import { useState } from 'react';
import type { Symptom, SymptomKind } from '../../domain/types';
import { SYMPTOM_KINDS } from '../../domain/types';
import { nowHHMM } from '../../domain/dates';
import { uid, useStore } from '../../data/store';
import { Sheet } from '../components/Sheet';
import { Scale } from './CheckIn';

const WITH_BODY_PART: SymptomKind[] = ['cramp', 'pain', 'other'];

export function SymptomSheet({ date, symptom, onClose }: { date: string; symptom?: Symptom; onClose: () => void }) {
  const save = useStore((s) => s.saveSymptom);
  const remove = useStore((s) => s.removeSymptom);
  const [x, setX] = useState<Symptom>(symptom ?? { id: uid(), date, time: nowHHMM(), kind: 'headache', severity: 2, via: 'manual' });
  const set = (p: Partial<Symptom>) => setX((v) => ({ ...v, ...p }));

  return (
    <Sheet
      title={symptom ? 'Symptom' : 'Add symptom'}
      onClose={onClose}
      footer={
        <div className="stack" style={{ gap: 8 }}>
          <button className="btn primary block" onClick={() => { save({ ...x, bodyPart: x.bodyPart?.trim() || undefined, note: x.note?.trim() || undefined }); onClose(); }}>Save</button>
          {symptom && <button className="btn ghost danger block" onClick={() => { remove(symptom.id); onClose(); }}>Delete</button>}
        </div>
      }
    >
      <div className="stack">
        <div className="chips">
          {(Object.keys(SYMPTOM_KINDS) as SymptomKind[]).map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={x.kind === k} onClick={() => set({ kind: k })}>{SYMPTOM_KINDS[k]}</button>
          ))}
        </div>
        <Scale label="Severity" low="Mild" high="Severe" value={x.severity} onChange={(v) => set({ severity: v ?? x.severity })} />
        {x.severity >= 4 && <div className="tiny" style={{ color: 'var(--danger)' }}>Severe or lasting? See a doctor.</div>}
        {WITH_BODY_PART.includes(x.kind) && (
          <label className="field">Where<input className="input" value={x.bodyPart ?? ''} onChange={(e) => set({ bodyPart: e.target.value })} placeholder="e.g. left calf" /></label>
        )}
        <div className="grid2" style={{ gridTemplateColumns: '1fr 2fr' }}>
          <label className="field">Time<input className="input" type="time" value={x.time ?? ''} onChange={(e) => set({ time: e.target.value })} /></label>
          <label className="field">Note<input className="input" value={x.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder="Optional" /></label>
        </div>
      </div>
    </Sheet>
  );
}

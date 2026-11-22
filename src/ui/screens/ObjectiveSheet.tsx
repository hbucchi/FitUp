import { useState } from 'react';
import type { Experience } from '../../domain/types';
import { IDEAL, bodyMetrics, GOAL_LABEL } from '../../domain/metrics';
import { ascent, estimateTimeline, makeTarget, recommendPhase, snapshot } from '../../domain/objective';
import { buildNutritionPlan } from '../../domain/nutritionPlan';
import { programById } from '../../domain/programs';
import { fmt } from '../../domain/nutrients';
import { todayISO } from '../../domain/dates';
import { useStore } from '../../data/store';
import { Sheet } from '../components/Sheet';
import { NumberField, Segmented } from '../components/Fields';

export function ObjectiveSheet({ onClose, onDone }: { onClose: () => void; onDone?: () => void }) {
  const s = useStore();
  const p = s.profile!;
  const ideal = IDEAL[p.sex];
  const [experience, setExperience] = useState<Experience>(s.objective?.experience ?? 'novice');
  const [bf, setBf] = useState<number | ''>(s.objective?.target.bodyFatPct ?? ideal.bodyFatPct);
  const [ffmi, setFfmi] = useState<number | ''>(s.objective?.target.ffmiNorm ?? ideal.ffmi);
  const m = bodyMetrics(p);

  const valid = bf !== '' && ffmi !== '' && bf >= (p.sex === 'male' ? 6 : 12) && bf <= 35 && ffmi >= 16 && ffmi <= 26;
  const target = valid ? makeTarget(p.heightCm, m.leanMassKg, Number(bf), Number(ffmi)) : undefined;
  const leanToGain = target ? Math.max(0, target.leanKg - m.leanMassKg) : 0;
  const fatToLose = target ? Math.max(0, m.fatMassKg - target.fatKg) : 0;
  const phase = target ? recommendPhase(p.sex, p.bodyFatPct, target, leanToGain) : p.goal;
  const timeline = target ? estimateTimeline(p, { experience, target }) : undefined;
  const months = timeline ? Math.max(1, Math.round(timeline.totalWeeks / 4.35)) : 0;

  const save = () => {
    if (!target) return;
    const today = todayISO();
    const objective = { createdAt: new Date().toISOString(), experience, start: snapshot(p, today), target, levelSeen: 0 };
    s.setObjective({ ...objective, levelSeen: ascent(objective, p).level });
    s.setProfile({ ...p, goal: phase });
    const days = s.activePlan?.trainingDays.length ?? programById('upper-lower')!.daysPerWeek;
    s.setNutritionPlan(buildNutritionPlan({ ...p, goal: phase }, { phase, trainingDaysPerWeek: days, experience }));
    onClose();
    onDone?.();
  };

  return (
    <Sheet title="Your objective" onClose={onClose} footer={<button className="btn primary block" disabled={!valid} onClick={save}>Set objective</button>}>
      <div className="stack">
        <p className="small muted" style={{ margin: 0 }}>Default: the classical physique.</p>
        <div className="field">
          <span>Training experience</span>
          <Segmented<Experience> value={experience} onChange={setExperience} label="Experience"
            options={[{ value: 'novice', label: '< 1 year' }, { value: 'intermediate', label: '1–3 years' }, { value: 'advanced', label: '3+ years' }]} />
        </div>
        <div className="grid2">
          <NumberField label="Target body fat" suffix="%" value={bf} onChange={setBf} />
          <NumberField label="Target FFMI (normalised)" value={ffmi} onChange={setFfmi} />
        </div>
        <p className="tiny muted" style={{ margin: '-4px 0 0' }}>FFMI = muscularity. You're at {fmt(m.ffmiNormalized, 1)}.</p>
        {target && timeline && (
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="grid2">
              <div className="stat"><div className="k">Target weight</div><div className="v">{fmt(target.weightKg, 1)} kg</div></div>
              <div className="stat"><div className="k">Target lean mass</div><div className="v">{fmt(target.leanKg, 1)} kg</div></div>
              <div className="stat"><div className="k">Lean mass to build</div><div className="v">{fmt(leanToGain, 1)} kg</div></div>
              <div className="stat"><div className="k">Fat to lose</div><div className="v">{fmt(fatToLose, 1)} kg</div></div>
            </div>
            <div className="divider" />
            <div className="small"><strong>Start with:</strong> {GOAL_LABEL[phase]}</div>
            <div className="small" style={{ marginTop: 4 }}>
              <strong>Estimate:</strong> ~{months} month{months > 1 ? 's' : ''}
            </div>
          </div>
        )}
        {!valid && <div className="error">Body fat {p.sex === 'female' ? '12' : '6'}–35 %, FFMI 16–26.</div>}
      </div>
    </Sheet>
  );
}

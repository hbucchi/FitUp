import { useMemo, useState } from 'react';
import { DEFAULT_DAYS, PROGRAMS, estimateMinutes, generatePlan, weekStructure, type Program } from '../../domain/programs';
import { buildNutritionPlan } from '../../domain/nutritionPlan';
import { todayISO, prettyDate } from '../../domain/dates';
import { uid, useStore } from '../../data/store';
import { Sheet } from '../components/Sheet';
import { IconChevron } from '../components/Icons';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function recommended(p: Program, phase: string, experience?: string) {
  if (!p.goal.includes(phase as never)) return false;
  if (p.id === 'kickstart') return false;
  if (experience === 'novice') return p.level !== 'intermediate';
  return p.level !== 'novice';
}

export function ProgramPickerSheet({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const phase = s.nutritionPlan?.phase ?? s.profile!.goal;
  const [program, setProgram] = useState<Program | null>(null);
  const [weeks, setWeeks] = useState(8);
  const [days, setDays] = useState<number[]>([]);
  const [start, setStart] = useState(todayISO());

  const pick = (p: Program) => {
    setProgram(p);
    setWeeks(p.defaultWeeks);
    setDays(DEFAULT_DAYS[p.daysPerWeek]);
  };

  const preview = useMemo(
    () => (program && days.length === program.daysPerWeek ? generatePlan(program, { weeks, startDate: start, trainingDays: days, id: 'preview' }) : null),
    [program, weeks, days, start],
  );

  if (!program) {
    const rec = (p: Program) => p.category === 'physique' && recommended(p, phase, s.objective?.experience);
    const card = (p: Program) => (
      <button key={p.id} className="card list-item" style={{ borderRadius: 'var(--radius)', border: '1px solid var(--line)', marginBottom: 0, alignItems: 'flex-start' }} onClick={() => pick(p)}>
        <div className="main">
          <div className="row" style={{ gap: 8 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600 }}>{p.name}</div>
            {rec(p) && <span className="badge sea">Recommended</span>}
          </div>
          <div className="tiny muted">{p.tagline} · {p.minWeeks === p.maxWeeks ? `${p.minWeeks} weeks` : `${p.minWeeks}–${p.maxWeeks} weeks`}</div>
        </div>
        <IconChevron width={16} height={16} />
      </button>
    );
    const physique = PROGRAMS.filter((p) => p.category === 'physique').sort((a, b) => Number(rec(b)) - Number(rec(a)));
    const sport = PROGRAMS.filter((p) => p.category === 'sport');
    return (
      <Sheet title="Choose a program" onClose={onClose}>
        <div className="stack">
          <div className="eyebrow">Physique</div>
          {physique.map(card)}
          <div className="eyebrow" style={{ marginTop: 8 }}>Sport & function</div>
          {sport.map(card)}
        </div>
      </Sheet>
    );
  }

  const structure = weekStructure(weeks);
  const startPlan = () => {
    if (!preview) return;
    const id = `plan-${uid().slice(0, 8)}`;
    const { plan, sessions } = generatePlan(program, { weeks, startDate: start, trainingDays: days, id });
    s.startPlan(plan, sessions, todayISO());
    if (s.profile) {
      // rebuild targets so training days get the extra carbohydrate
      s.setNutritionPlan(buildNutritionPlan(s.profile, { phase, trainingDaysPerWeek: days.length, experience: s.objective?.experience }));
    }
    onClose();
  };

  return (
    <Sheet title={program.name} onClose={onClose} leading={<button className="icon-btn" aria-label="Back" onClick={() => setProgram(null)}><IconChevron dir="left" /></button>}
      footer={<button className="btn primary block" disabled={!preview} onClick={startPlan}>Start program</button>}>
      <div className="stack">
        <p className="small muted" style={{ margin: 0 }}>{program.description}</p>
        {program.notes?.[0] && <div className="notice small">{program.notes[0]}</div>}
        {program.minWeeks !== program.maxWeeks && (
          <label className="field">
            Length
            <select className="input" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
              {Array.from({ length: program.maxWeeks - program.minWeeks + 1 }, (_, i) => program.minWeeks + i).map((w) => (
                <option key={w} value={w}>{w} weeks</option>
              ))}
            </select>
          </label>
        )}
        <div className="field">
          <span>Training days ({days.length}/{program.daysPerWeek})</span>
          <div className="chips">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button key={d} className="chip" aria-pressed={days.includes(d)}
                onClick={() => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : x.length < program.daysPerWeek ? [...x, d] : x))}>
                {DAY[d]}
              </button>
            ))}
          </div>
        </div>
        <label className="field" style={{ maxWidth: 200 }}>
          Start date
          <input className="input" type="date" value={start} min={todayISO()} onChange={(e) => setStart(e.target.value)} />
        </label>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Structure</div>
          <div className="chips" style={{ gap: 4 }}>
            {structure.map((w) => (
              <span key={w.week} className={`badge ${w.phase === 'deload' ? '' : 'sea'}`} title={w.phase}>
                W{w.week} · {w.phase === 'deload' ? 'Lighter' : ['Heavy', 'Moderate', 'Light'][w.accIndex % 3]}
              </span>
            ))}
          </div>
        </div>
        {preview && (
          <div className="card flush" style={{ marginBottom: 0 }}>
            <div className="meal-head"><h3 className="h-section">First week</h3></div>
            <ul className="list">
              {preview.sessions.filter((x) => x.week === 1).map((x) => (
                <li key={x.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                  <div className="main">
                    <div className="title">{prettyDate(x.date)} · {x.title}</div>
                    <div className="sub">{x.exercises.length} exercises</div>
                  </div>
                  <span className="tiny muted">~{estimateMinutes(x)} min</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {s.activePlan && <p className="tiny muted" style={{ margin: 0 }}>Replaces “{s.activePlan.name}”.</p>}
      </div>
    </Sheet>
  );
}

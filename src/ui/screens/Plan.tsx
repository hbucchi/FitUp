import { useMemo, useState } from 'react';
import { LEVELS, ascent } from '../../domain/objective';
import { fmt } from '../../domain/nutrients';
import { addDays, estimateMinutes, weekday } from '../../domain/programs';
import { startOfWeek } from '../../domain/reschedule';
import { prettyDate, todayISO } from '../../domain/dates';
import { useStore } from '../../data/store';
import { Emblem } from '../components/Emblem';
import { ObjectiveSheet } from './ObjectiveSheet';
import { ProgramPickerSheet } from './ProgramPicker';
import { ReviewSheet } from './ReviewSheet';
import { SessionSheet } from './Session';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AscentCard({ onEdit }: { onEdit: () => void }) {
  const profile = useStore((s) => s.profile)!;
  const objective = useStore((s) => s.objective);
  if (!objective) {
    return (
      <section className="card">
        <div className="row" style={{ gap: 14 }}>
          <Emblem level={0} size={56} />
          <div style={{ flex: 1 }}>
            <div className="eyebrow">Villager</div>
            <div className="h-section">Set your objective</div>
            <div className="small muted">Pick the physique you're building toward.</div>
          </div>
        </div>
        <button className="btn primary block" style={{ marginTop: 12 }} onClick={onEdit}>Set objective</button>
      </section>
    );
  }
  const a = ascent(objective, profile);
  const lvl = LEVELS[a.level];
  return (
    <section className="card">
      <div className="row" style={{ gap: 14 }}>
        <Emblem level={a.level} size={64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="eyebrow">Rank {a.level + 1} of {LEVELS.length}</div>
          <div className="h-display" style={{ fontSize: 28 }}>{lvl.name}</div>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <div className="row between tiny muted" style={{ marginBottom: 4 }}>
          <span>{Math.round(a.progress * 100)}%</span>
          {a.next && <span>Next: {a.next.name}</span>}
        </div>
        <div className="bar" style={{ height: 10 }}>
          <span style={{ width: `${a.progress * 100}%`, background: 'linear-gradient(90deg, var(--sea), var(--accent))' }} />
        </div>
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 4 }}>
          {LEVELS.map((l, i) => (
            <span key={l.name} className="tiny" style={{ color: i <= a.level ? 'var(--accent)' : 'var(--muted)', fontWeight: i === a.level ? 700 : 400 }} title={l.name}>
              {['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][i]}
            </span>
          ))}
        </div>
      </div>
      <div className="grid2" style={{ marginTop: 12 }}>
        <div className="stat"><div className="k">Lean mass to build</div><div className="v">{fmt(a.remainingLeanKg, 1)} kg</div></div>
        <div className="stat"><div className="k">Fat to lose</div><div className="v">{fmt(a.remainingFatKg, 1)} kg</div></div>
      </div>
      <div className="row between" style={{ marginTop: 10 }}>
        <span className="tiny muted">Target {fmt(objective.target.weightKg, 1)} kg · {objective.target.bodyFatPct}% fat</span>
        <button className="btn ghost" onClick={onEdit}>Edit</button>
      </div>
    </section>
  );
}

export function PlanScreen() {
  const s = useStore();
  const [modal, setModal] = useState<'objective' | 'program' | 'review' | { session: string } | null>(null);
  const today = todayISO();
  const plan = s.activePlan;
  const sessions = useMemo(() => s.plannedSessions.filter((x) => plan && x.planId === plan.id), [s.plannedSessions, plan]);
  const weekStart = startOfWeek(today);
  // missed sessions from earlier this week, then the next 7 days
  const missed = [...new Set(sessions.filter((x) => x.status === 'planned' && x.date < today && x.date >= weekStart).map((x) => x.date))].sort();
  const week = [...missed, ...Array.from({ length: 7 }, (_, i) => addDays(today, i))];
  const currentWeek = sessions.find((x) => x.date >= today)?.week ?? plan?.weeks;
  const n = s.nutritionPlan;
  const doneCount = sessions.filter((x) => x.status === 'done').length;
  const pastCount = sessions.filter((x) => x.date < today || x.status === 'done').length;

  return (
    <>
      <h1 className="h-display" style={{ marginBottom: 14 }}>Plan</h1>
      <AscentCard onEdit={() => setModal('objective')} />

      <section className="card">
        <div className="card-head">
          <h2 className="h-section">Training</h2>
          {plan && <span className="badge">Week {currentWeek} of {plan.weeks}</span>}
        </div>
        {!plan ? (
          <>
            <button className="btn primary block" onClick={() => setModal('program')}>Choose a program</button>
          </>
        ) : (
          <>
            <div className="small" style={{ fontWeight: 600 }}>{plan.name}</div>
            {(() => {
              const c = plan.choices?.find((x) => x.week === currentWeek);
              if (!c || c.by === 'plan') return null;
              const label = { standard: 'progressing as planned', repeat: 'repeating last week', lighter: 'lighter week', condensed: 'condensed week', 'skip-deload': 'lighter week skipped' }[c.variant];
              return <div className="tiny" style={{ color: 'var(--sea)' }}>This week: {label}</div>;
            })()}
            <div className="tiny muted" style={{ marginBottom: 10 }}>
              {plan.trainingDays.map((d) => DAY[d]).join(' · ')}{pastCount > 0 && ` · ${doneCount}/${pastCount} done`}
            </div>
            <ul className="list">
              {week.map((d, i) => {
                const day = sessions.filter((x) => x.date === d);
                return (
                  <li key={d} className="row" style={{ padding: '7px 0', borderTop: i === 0 ? 0 : '1px solid var(--line)', alignItems: 'flex-start', opacity: d < today && day.length === 0 ? 0.55 : 1 }}>
                    <span className="small" style={{ width: 44, fontWeight: d === today ? 700 : 500, color: d === today ? 'var(--accent)' : undefined }}>{DAY[weekday(d)]}</span>
                    <div style={{ flex: 1 }}>
                      {day.length === 0 ? <span className="small muted">Rest</span> : day.map((x) => (
                        <button key={x.id} className="btn ghost" style={{ padding: 0, minHeight: 0, justifyContent: 'flex-start', textAlign: 'left', color: 'var(--ink)', fontWeight: 500 }}
                          onClick={() => setModal({ session: x.id })}>
                          <span style={{ textDecoration: x.status === 'skipped' ? 'line-through' : undefined, opacity: x.status === 'skipped' ? 0.5 : 1 }}>
                            {x.title} <span className="tiny muted">· ~{estimateMinutes(x)} min</span>
                          </span>
                        </button>
                      ))}
                    </div>
                    {day.filter((x) => x.status !== 'planned' || x.date < today).map((x) => (
                      <span key={x.id} className={`badge ${x.status === 'done' ? 'sea' : ''}`}>
                        {x.status === 'done' ? 'Done' : x.status === 'skipped' ? 'Skipped' : 'Missed'}
                      </span>
                    ))}
                  </li>
                );
              })}
            </ul>
            <div className="grid2" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={() => setModal('review')}>Update plan</button>
              <button className="btn" onClick={() => setModal('program')}>Change program</button>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="h-section">Nutrition</h2>
          {n && <span className="badge">{n.targetRatePct === 0 ? 'Maintenance' : `${n.targetRatePct > 0 ? '+' : ''}${n.targetRatePct}% / week`}</span>}
        </div>
        {!n ? (
          <p className="small muted" style={{ margin: 0 }}>Set your objective first.</p>
        ) : (
          <>
            <table className="ntable">
              <tbody>
                <tr className="group"><td></td><td>Training day</td><td style={{ width: 'auto' }}>Rest day</td></tr>
                <tr><td>Energy</td><td>{n.training.kcal} kcal</td><td>{n.rest.kcal} kcal</td></tr>
                <tr><td style={{ color: 'var(--protein)' }}>Protein</td><td>{n.training.protein} g</td><td>{n.rest.protein} g</td></tr>
                <tr><td style={{ color: 'var(--carbs)' }}>Carbohydrate</td><td>{n.training.carbs} g</td><td>{n.rest.carbs} g</td></tr>
                <tr><td style={{ color: 'var(--fat)' }}>Fat</td><td>{n.training.fat} g</td><td>{n.rest.fat} g</td></tr>
                <tr><td>Fiber</td><td>{n.fiber} g</td><td>{n.fiber} g</td></tr>
              </tbody>
            </table>
            <div className="small muted" style={{ marginTop: 10 }}>{n.mealsPerDay} meals · ~{n.proteinPerMeal} g protein each</div>
          </>
        )}
      </section>

      {s.reviews.length > 0 && (
        <section className="card flush">
          <div className="meal-head"><h2 className="h-section">Recent updates</h2></div>
          <ul className="list">
            {s.reviews.slice(0, 5).map((r) => (
              <li key={r.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                <div className="main">
                  <div className="title small">{prettyDate(r.date)} · {r.by === 'assistant' ? 'Coach' : 'Rules'} · {r.changes.length ? `${r.changes.length} change${r.changes.length > 1 ? 's' : ''}` : 'no changes'}</div>
                  {r.changes.length > 0 && <div className="sub" style={{ whiteSpace: 'pre-wrap' }}>{r.changes.join('\n')}</div>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}


      {modal === 'objective' && <ObjectiveSheet onClose={() => setModal(null)} onDone={() => !plan && setModal('program')} />}
      {modal === 'program' && <ProgramPickerSheet onClose={() => setModal(null)} />}
      {modal === 'review' && <ReviewSheet onClose={() => setModal(null)} />}
      {modal && typeof modal === 'object' && <SessionSheet sessionId={modal.session} onClose={() => setModal(null)} />}
    </>
  );
}

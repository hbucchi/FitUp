import { useEffect, useRef, useState } from 'react';
import type { ActivePlan, NutritionPlan, PlannedSession } from '../../domain/types';
import { coachReview, rulesReview, type ReviewInput, type ReviewResult } from '../../agent/review';
import type { AgentEvent } from '../../agent/runAgent';
import { agentConfig, useAssistant } from '../../agent/settings';
import { programById, rebuildFrom, type WeekOption } from '../../domain/programs';
import { prettyDate, todayISO } from '../../domain/dates';
import { uid, useStore } from '../../data/store';
import { Sheet } from '../components/Sheet';

const STEP: Record<string, (i: any) => string> = {
  choose_week: (i) => `Choosing next week: ${i.option_id}`,
  reschedule_session: (i) => `Moving a session to ${i.new_date}`,
  skip_session: () => 'Skipping a session',
  set_nutrition_targets: () => 'Adjusting nutrition targets',
};

export function ReviewSheet({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const settings = useAssistant();
  const cfg = agentConfig(settings);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [chosen, setChosen] = useState<WeekOption['id'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undone, setUndone] = useState(false);
  const before = useRef<{ sessions: PlannedSession[]; nutrition?: NutritionPlan; plan: ActivePlan; planSessions: PlannedSession[] } | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !s.activePlan || !s.profile) return;
    started.current = true;
    const planSessions = s.plannedSessions.filter((x) => x.planId === s.activePlan!.id);
    const input: ReviewInput = {
      today: todayISO(), profile: s.profile, objective: s.objective, plan: s.activePlan, sessions: planSessions,
      training: s.trainingEntries, food: s.foodEntries, bodyLog: s.bodyLog, nutrition: s.nutritionPlan, checkIns: s.checkIns,
    };
    const apply = (r: ReviewResult) => {
      before.current = { sessions: r.sessions.map((x) => planSessions.find((o) => o.id === x.id)!).filter(Boolean), nutrition: r.nutrition ? s.nutritionPlan : undefined, plan: s.activePlan!, planSessions };
      if (r.sessions.length) s.updateSessions(r.sessions);
      if (r.week) s.replacePlanFrom(r.week.plan, r.week.fromWeek, r.week.sessions);
      if (r.nutrition) s.setNutritionPlan(r.nutrition);
      s.addReview({ id: uid(), date: input.today, by: r.by, summary: r.summary, changes: r.changes });
      setChosen(r.week?.decision.chosen.id ?? null);
      setResult(r);
    };
    if (cfg) {
      coachReview(cfg, input, (e) => setEvents((x) => [...x, e]))
        .then(apply)
        .catch((e: Error) => {
          setError(`The assistant couldn't run (${e.message}). Applied the rule-based update instead.`);
          apply(rulesReview(input));
        });
    } else apply(rulesReview(input));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** your own pick overrides the coach's — still one of the pre-designed weeks */
  const override = (o: WeekOption) => {
    const plan = useStore.getState().activePlan;
    const program = plan && programById(plan.programId);
    if (!plan || !program || !result?.week) return;
    const r = rebuildFrom(program, plan, { ...o.choice, by: 'you', reason: 'Chosen by you' });
    s.replacePlanFrom(r.plan, result.week.fromWeek, r.sessions);
    setChosen(o.id);
  };

  const undo = () => {
    const b = before.current;
    if (!b) return;
    if (b.sessions.length) s.updateSessions(b.sessions);
    if (result?.week) s.replacePlanFrom(b.plan, result.week.fromWeek, b.planSessions.filter((x) => x.week >= result.week!.fromWeek && x.status === 'planned'));
    if (b.nutrition) s.setNutritionPlan(b.nutrition);
    setUndone(true);
  };

  const steps = events.filter((e): e is Extract<AgentEvent, { type: 'tool' }> => e.type === 'tool');
  const decision = result?.week?.decision;
  return (
    <Sheet title="Update plan" onClose={onClose} footer={result ? <button className="btn primary block" onClick={onClose}>Done</button> : undefined}>
      <div className="stack">
        <div className="tiny muted">{cfg ? `${settings.provider === 'anthropic' ? 'Claude' : 'OpenAI'} coach` : 'Rule-based'} · last 15 days</div>
        {!result && (
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Reviewing…</div>
            <ul className="list small">
              {steps.map((st, i) => (
                <li key={i} style={{ padding: '2px 0', color: st.ok ? 'var(--ink-2)' : 'var(--danger)' }}>
                  {st.ok ? '✓' : '↻'} {(STEP[st.name] ?? (() => st.name))(st.input)}{!st.ok && <span className="tiny"> — {st.error}</span>}
                </li>
              ))}
              <li className="muted">…</li>
            </ul>
          </div>
        )}
        {error && <div className="error">{error}</div>}
        {decision && !undone && (
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="eyebrow">Week {decision.week} · from {prettyDate(decision.startDate)} · {decision.by === 'assistant' ? 'coach' : 'rules'}</div>
            <div className="h-section" style={{ marginTop: 2 }}>{decision.options.find((o) => o.id === chosen)?.title}</div>
            <p className="small muted" style={{ margin: '4px 0 10px' }}>{chosen === decision.chosen.id ? decision.reason : 'Your choice.'}</p>
            <div className="stack" style={{ gap: 6 }}>
              {decision.options.map((o) => (
                <button key={o.id} className="chip" aria-pressed={o.id === chosen} style={{ textAlign: 'left', borderRadius: 12, padding: '8px 12px' }} onClick={() => override(o)}>
                  <strong>{o.title}</strong>
                  <div className="tiny muted">{o.sessions} sessions · ~{Math.round(o.minutes / 5) * 5} min</div>
                </button>
              ))}
            </div>
          </div>
        )}
        {result && (
          <>
            {result.changes.length > 0 && (
              <div className="card flush" style={{ marginBottom: 0 }}>
                <div className="meal-head"><h3 className="h-section">{undone ? 'Changes undone' : 'Changes'}</h3></div>
                <ul className="list">
                  {result.changes.map((c, i) => <li key={i} className="list-item small" style={{ opacity: undone ? 0.5 : 1 }}>{c}</li>)}
                </ul>
              </div>
            )}
            {result.summary && <div className="notice small" style={{ whiteSpace: 'pre-wrap' }}>{result.summary}</div>}
            {!undone && (result.changes.length > 0 || result.week) && <button className="btn ghost block" onClick={undo}>Undo this update</button>}
          </>
        )}
      </div>
    </Sheet>
  );
}

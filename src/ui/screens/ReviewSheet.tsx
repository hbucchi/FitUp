import { useEffect, useRef, useState } from 'react';
import type { NutritionPlan, PlannedSession } from '../../domain/types';
import { coachReview, rulesReview, type ReviewInput, type ReviewResult } from '../../agent/review';
import type { AgentEvent } from '../../agent/runAgent';
import { agentConfig, useAssistant } from '../../agent/settings';
import { todayISO } from '../../domain/dates';
import { uid, useStore } from '../../data/store';
import { Sheet } from '../components/Sheet';
import { useExercises } from './TrainingLog';

const STEP: Record<string, (i: any) => string> = {
  reschedule_session: (i) => `Moving a session to ${i.new_date}`,
  skip_session: () => 'Skipping a session',
  modify_session: () => 'Adjusting a session',
  set_nutrition_targets: () => 'Adjusting nutrition targets',
};

export function ReviewSheet({ onClose }: { onClose: () => void }) {
  const s = useStore();
  const settings = useAssistant();
  const exercises = useExercises();
  const cfg = agentConfig(settings);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undone, setUndone] = useState(false);
  const before = useRef<{ sessions: PlannedSession[]; nutrition?: NutritionPlan } | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !s.activePlan || !s.profile) return;
    started.current = true;
    const input: ReviewInput = {
      today: todayISO(), profile: s.profile, objective: s.objective, plan: s.activePlan,
      sessions: s.plannedSessions.filter((x) => x.planId === s.activePlan!.id),
      training: s.trainingEntries, food: s.foodEntries, bodyLog: s.bodyLog, nutrition: s.nutritionPlan, exercises,
    };
    const apply = (r: ReviewResult) => {
      // keep the previous versions for undo
      before.current = {
        sessions: r.sessions.map((x) => input.sessions.find((o) => o.id === x.id)!).filter(Boolean),
        nutrition: r.nutrition ? s.nutritionPlan : undefined,
      };
      if (r.sessions.length) s.updateSessions(r.sessions);
      if (r.nutrition) s.setNutritionPlan(r.nutrition);
      s.addReview({ id: uid(), date: input.today, by: r.by, summary: r.summary, changes: r.changes });
      setResult(r);
    };
    if (cfg) {
      coachReview(cfg, input, (e) => setEvents((x) => [...x, e]))
        .then(apply)
        .catch((e: Error) => {
          // fall back to the rules if the AI call fails
          setError(`The assistant couldn't run (${e.message}). Applied the rule-based update instead.`);
          apply(rulesReview(input));
        });
    } else {
      apply(rulesReview(input));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const undo = () => {
    if (!before.current) return;
    if (before.current.sessions.length) s.updateSessions(before.current.sessions);
    if (before.current.nutrition) s.setNutritionPlan(before.current.nutrition);
    setUndone(true);
  };

  const steps = events.filter((e): e is Extract<AgentEvent, { type: 'tool' }> => e.type === 'tool');
  return (
    <Sheet title="Update plan" onClose={onClose} footer={result ? <button className="btn primary block" onClick={onClose}>Done</button> : undefined}>
      <div className="stack">
        <p className="small muted" style={{ margin: 0 }}>
          Looking at the last 15 days of training and 10 days of food and weigh-ins, then adjusting the rest of this week.
          {cfg ? ` The ${settings.provider === 'anthropic' ? 'Claude' : 'OpenAI'} coach decides, within safe limits.` : ' Rule-based (add an AI key in Profile › Assistant for a coach).'}
        </p>
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
        {result && (
          <>
            {result.changes.length > 0 ? (
              <div className="card flush" style={{ marginBottom: 0 }}>
                <div className="meal-head"><h3 className="h-section">{undone ? 'Changes undone' : 'Changes'}</h3></div>
                <ul className="list">
                  {result.changes.map((c, i) => <li key={i} className="list-item small" style={{ opacity: undone ? 0.5 : 1 }}>{c}</li>)}
                </ul>
              </div>
            ) : (
              <div className="notice">Nothing needed changing — keep going.</div>
            )}
            <div className="notice small" style={{ whiteSpace: 'pre-wrap' }}>{result.summary}</div>
            {result.changes.length > 0 && !undone && <button className="btn ghost block" onClick={undo}>Undo these changes</button>}
          </>
        )}
      </div>
    </Sheet>
  );
}

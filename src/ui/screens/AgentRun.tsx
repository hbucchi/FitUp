import { useEffect, useRef, useState } from 'react';
import { runAgent, type AgentEvent } from '../../agent/runAgent';
import type { AgentContext, LoggedItem } from '../../agent/tools';
import { useAssistant } from '../../agent/settings';
import { useCatalog } from '../../data/useCatalog';
import { useStore } from '../../data/store';
import { MEAL_LABEL } from '../../domain/types';
import { fmt } from '../../domain/nutrients';
import { useExercises } from './TrainingLog';

const TOOL_LABEL: Record<string, (i: any) => string> = {
  search_foods: (i) => `Searching foods for “${i.query}”`,
  log_food: (i) => `Logging ${i.quantity} ${i.unit === 'g' ? 'g' : `× ${i.unit}`}`,
  create_food: (i) => `Creating “${i.name}” (estimate)`,
  search_exercises: (i) => `Searching exercises for “${i.query}”`,
  log_training: () => 'Logging training',
};

export function AgentRun({ text, date, onDone }: { text: string; date: string; onDone: () => void }) {
  const settings = useAssistant();
  const { ready, index, byId, boost } = useCatalog();
  const exercises = useExercises();
  const weightKg = useStore((s) => s.profile?.weightKg ?? 75);
  const removeFoodEntry = useStore((s) => s.removeFoodEntry);
  const removeTraining = useStore((s) => s.removeTraining);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [logged, setLogged] = useState<LoggedItem[]>([]);
  const [status, setStatus] = useState<'running' | 'done' | 'error'>('running');
  const [error, setError] = useState<string | null>(null);
  const [undone, setUndone] = useState<Set<string>>(new Set());
  const started = useRef(false);

  useEffect(() => {
    // wait for the catalog; and StrictMode runs effects twice in dev — never log twice
    if (!ready || started.current) return;
    started.current = true;
    const ctx: AgentContext = { date, index, byId, boost, exercises, weightKg, logged: [], created: new Map() };
    const cfg = settings.provider === 'anthropic'
      ? { provider: 'anthropic' as const, apiKey: settings.anthropicKey.trim(), model: settings.anthropicModel }
      : { provider: 'openai' as const, apiKey: settings.openaiKey.trim(), model: settings.openaiModel };
    runAgent(cfg, text, ctx, (e) => {
      setEvents((x) => [...x, e]);
      setLogged([...ctx.logged]);
    })
      .then(() => setStatus('done'))
      .catch((e: Error) => {
        setError(e.message.includes('Failed to fetch') ? 'Could not reach the AI service. Check your connection.' : e.message);
        setStatus('error');
        setLogged([...ctx.logged]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const undo = (it: LoggedItem) => {
    if (it.kind === 'food') removeFoodEntry(it.entry.id);
    else removeTraining(it.entry.id);
    setUndone((s) => new Set(s).add(it.entry.id));
  };
  const summary = events.find((e): e is Extract<AgentEvent, { type: 'text' }> => e.type === 'text')?.text;
  const steps = events.filter((e): e is Extract<AgentEvent, { type: 'tool' }> => e.type === 'tool');

  return (
    <div className="stack">
      <p className="said" style={{ margin: 0 }}>“{text}”</p>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>{status === 'running' ? 'Working…' : 'Steps'}</div>
        <ul className="list small">
          {steps.map((s, i) => (
            <li key={i} style={{ padding: '3px 0', color: s.ok ? 'var(--ink-2)' : 'var(--danger)' }}>
              {s.ok ? '✓' : '↻'} {(TOOL_LABEL[s.name] ?? (() => s.name))(s.input)}
              {!s.ok && <span className="tiny"> — retrying</span>}
            </li>
          ))}
          {status === 'running' && <li className="muted" style={{ padding: '3px 0' }}>…</li>}
        </ul>
      </div>
      {error && <div className="error">{error}</div>}
      {logged.length > 0 && (
        <div className="card flush" style={{ marginBottom: 0 }}>
          <div className="meal-head"><h3 className="h-section">Added to your diary</h3></div>
          <ul className="list">
            {logged.map((it) => {
              const gone = undone.has(it.entry.id);
              return (
                <li key={it.entry.id} className="list-item" style={{ opacity: gone ? 0.45 : 1 }}>
                  <div className="main">
                    {it.kind === 'food' ? (
                      <>
                        <div className="title">{it.entry.foodName}</div>
                        <div className="sub">{MEAL_LABEL[it.entry.meal]} · {fmt(it.entry.quantity)} {it.entry.unit === 'g' ? 'g' : `× ${it.entry.unit}`} · {Math.round(it.entry.nutrients.kcal ?? 0)} kcal</div>
                      </>
                    ) : (
                      <>
                        <div className="title">{it.entry.exerciseName}</div>
                        <div className="sub">Training · {it.entry.durationMin} min · {it.entry.kcal} kcal</div>
                      </>
                    )}
                  </div>
                  {gone ? <span className="tiny muted">Removed</span> : <button className="btn ghost" onClick={() => undo(it)}>Undo</button>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {summary && <div className="notice" style={{ whiteSpace: 'pre-wrap' }}>{summary}</div>}
      {status !== 'running' && <button className="btn primary block" onClick={onDone}>Done</button>}
    </div>
  );
}

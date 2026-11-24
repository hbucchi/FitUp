import { useEffect, useRef, useState } from 'react';
import { runAgent, type AgentEvent } from '../../agent/runAgent';
import type { AgentContext, LoggedItem } from '../../agent/tools';
import { useAssistant } from '../../agent/settings';
import { useCatalog } from '../../data/useCatalog';
import { useStore } from '../../data/store';
import { MEAL_LABEL, BRISTOL, SYMPTOM_KINDS } from '../../domain/types';
import { checkInSummary } from './CheckIn';
import { fmt } from '../../domain/nutrients';
import { useExercises } from './TrainingLog';
import { t } from '../../i18n';

const TOOL_LABEL: Record<string, (i: any) => string> = {
  search_foods: (i) => t('Searching foods for “{q}”', { q: (Array.isArray(i.queries) ? i.queries[0] : i.query) ?? '' }),
  regex_foods: (i) => t('Comparing database foods matching {p}', { p: String(i.pattern ?? '') }),
  log_food: (i) => t('Logging {amount}', { amount: `${i.quantity} ${i.unit === 'g' ? 'g' : `× ${i.unit}`}` }),
  create_food: (i) => t('Creating “{name}” (estimate)', { name: i.name }),
  search_exercises: (i) => t('Searching exercises for “{q}”', { q: i.query }),
  log_training: () => t('Logging training'),
  log_checkin: () => t('Logging check-in'),
  log_bowel_movement: () => t('Logging bowel movement'),
  log_symptom: (i) => t('Logging {what}', { what: t(SYMPTOM_KINDS[i.kind as keyof typeof SYMPTOM_KINDS] ?? 'symptom').toLowerCase() }),
};

/** Where a logged food's numbers came from. */
function sourceLabel(src: string) {
  if (src.startsWith('USDA')) return 'USDA';
  if (src.startsWith('TACO')) return 'TACO';
  if (src === 'AI estimate') return t('AI estimate');
  return t('My foods');
}

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
    const ctx: AgentContext = { date, index, byId, boost, exercises, weightKg, logged: [], created: new Map(), seen: new Set(), allowEstimates: settings.allowEstimates };
    const cfg = settings.provider === 'anthropic'
      ? { provider: 'anthropic' as const, apiKey: settings.anthropicKey.trim(), model: settings.anthropicModel }
      : { provider: 'openai' as const, apiKey: settings.openaiKey.trim(), model: settings.openaiModel };
    runAgent(cfg, text, ctx, (e) => {
      setEvents((x) => [...x, e]);
      setLogged([...ctx.logged]);
    })
      .then(() => setStatus('done'))
      .catch((e: Error) => {
        setError(e.message.includes('Failed to fetch') ? t('Could not reach the AI service. Check your connection.') : e.message);
        setStatus('error');
        setLogged([...ctx.logged]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const undo = (it: LoggedItem) => {
    const st = useStore.getState();
    if (it.kind === 'food') removeFoodEntry(it.entry.id);
    else if (it.kind === 'training') removeTraining(it.entry.id);
    else if (it.kind === 'symptom') st.removeSymptom(it.entry.id);
    else if (it.kind === 'bowel') st.removeBowel(it.entry.id);
    else if (it.previous) st.saveCheckIn(it.previous);
    else st.removeCheckIn(it.entry.date);
    setUndone((s) => new Set(s).add(it.entry.id));
  };
  const summary = events.find((e): e is Extract<AgentEvent, { type: 'text' }> => e.type === 'text')?.text;
  const steps = events.filter((e): e is Extract<AgentEvent, { type: 'tool' }> => e.type === 'tool');

  return (
    <div className="stack">
      <p className="said" style={{ margin: 0 }}>“{text}”</p>
      <div className="card" style={{ marginBottom: 0 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>{status === 'running' ? t('Working…') : t('Steps')}</div>
        <ul className="list small">
          {steps.map((s, i) => (
            <li key={i} style={{ padding: '3px 0', color: s.ok ? 'var(--ink-2)' : 'var(--danger)' }}>
              {s.ok ? '✓' : '↻'} {(TOOL_LABEL[s.name] ?? (() => s.name))(s.input)}
              {!s.ok && <span className="tiny"> {t('— retrying')}</span>}
            </li>
          ))}
          {status === 'running' && <li className="muted" style={{ padding: '3px 0' }}>…</li>}
        </ul>
      </div>
      {error && <div className="error">{error}</div>}
      {logged.length > 0 && (
        <div className="card flush" style={{ marginBottom: 0 }}>
          <div className="meal-head"><h3 className="h-section">{t('Logged')}</h3></div>
          <ul className="list">
            {logged.map((it) => {
              const gone = undone.has(it.entry.id);
              return (
                <li key={it.entry.id} className="list-item" style={{ opacity: gone ? 0.45 : 1 }}>
                  <div className="main">
                    {it.kind === 'food' ? (
                      <>
                        <div className="title">{it.entry.foodName}</div>
                        {it.entry.said && <div className="tiny muted">“{it.entry.said}”</div>}
                        <div className="sub">{MEAL_LABEL[it.entry.meal]} · {fmt(it.entry.quantity)} {it.entry.unit === 'g' ? 'g' : `× ${it.entry.unit}`} · {Math.round(it.entry.nutrients.kcal ?? 0)} kcal · {sourceLabel(byId.get(it.entry.foodId)?.source ?? 'AI estimate')}</div>
                      </>
                    ) : it.kind === 'training' ? (
                      <>
                        <div className="title">{t(it.entry.exerciseName)}</div>
                        <div className="sub">{t('Training')} · {it.entry.durationMin} min · {it.entry.kcal} kcal</div>
                      </>
                    ) : it.kind === 'bowel' ? (
                      <>
                        <div className="title">{t('Bowel movement')}</div>
                        <div className="sub">{t('Type {n}', { n: it.entry.bristol })} · {t(BRISTOL[it.entry.bristol])}{it.entry.time ? ` · ${it.entry.time}` : ''}</div>
                      </>
                    ) : it.kind === 'symptom' ? (
                      <>
                        <div className="title">{t(SYMPTOM_KINDS[it.entry.kind])}{it.entry.bodyPart ? ` · ${it.entry.bodyPart}` : ''}</div>
                        <div className="sub">{t('Severity')} {it.entry.severity}/5{it.entry.time ? ` · ${it.entry.time}` : ''}</div>
                      </>
                    ) : (
                      <>
                        <div className="title">{t('Check-in')}</div>
                        <div className="sub">{checkInSummary(it.entry)}</div>
                      </>
                    )}
                  </div>
                  {gone ? <span className="tiny muted">{t('Removed')}</span> : <button className="btn ghost" onClick={() => undo(it)}>{t('Undo')}</button>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {summary && <div className="notice" style={{ whiteSpace: 'pre-wrap' }}>{summary}</div>}
      {status !== 'running' && <button className="btn primary block" onClick={onDone}>{t('Done')}</button>}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { Food, FoodEntry, Meal } from '../../domain/types';
import { MEALS, MEAL_LABEL } from '../../domain/types';
import { fmt, scaleNutrients, sumNutrients } from '../../domain/nutrients';
import { gramsFor, resolveAmount, unitOptions } from '../../domain/portions';
import { mealForNow, nowHHMM } from '../../domain/dates';
import { uid, useStore } from '../../data/store';
import { useCatalog } from '../../data/useCatalog';
import { matchTranscript } from '../../voice/matcher';
import { useSpeech } from '../../voice/useSpeech';
import { Sheet } from '../components/Sheet';
import { IconChevron, IconMic, IconStop } from '../components/Icons';
import { MacroLine } from '../components/Macros';
import { FoodSearchList } from './AddFood';
import { AgentRun } from './AgentRun';
import { agentReady, transcribeConfig, useAssistant } from '../../agent/settings';
import { transcribeAudio } from '../../agent/transcribe';
import { useRecorder } from '../../voice/useRecorder';
import { LOCALE, t } from '../../i18n';

interface Row {
  key: string;
  said: string;
  include: boolean;
  candidates: Food[];
  food?: Food;
  quantity: number;
  unit: string;
  /** what was actually spoken, kept so switching food can re-resolve it */
  spokenQty: number;
  spokenUnit?: string;
}

export function VoiceLogSheet({ date, onClose, placeholder }: { date: string; onClose: () => void; placeholder?: string }) {
  const speech = useSpeech(LOCALE === 'pt' ? 'pt-BR' : navigator.language?.startsWith('en') ? navigator.language : 'en-US');
  const { ready, index, boost } = useCatalog();
  const addFoodEntries = useStore((s) => s.addFoodEntries);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [meal, setMeal] = useState<Meal>(mealForNow());
  const [time, setTime] = useState(nowHHMM());
  const [replacing, setReplacing] = useState<string | null>(null);

  const text = speech.transcript;
  const assistant = useAssistant();
  const assistantOn = agentReady(assistant);
  const cloudStt = transcribeConfig(assistant);
  const recorder = useRecorder();
  const [transcribing, setTranscribing] = useState(false);
  const [sttError, setSttError] = useState<string | null>(null);
  const [agentText, setAgentText] = useState<string | null>(null);

  // Recording callbacks are created when recording *starts*; read current values through a ref
  // so the result isn't judged against a stale transcript / catalog state.
  const latest = useRef({ text, assistantOn, autoLog: assistant.autoLog, cloudStt });
  latest.current = { text, assistantOn, autoLog: assistant.autoLog, cloudStt };
  const [queuedForAgent, setQueuedForAgent] = useState<string | null>(null);
  useEffect(() => {
    // start the agent once the catalog is loaded
    if (queuedForAgent && ready) {
      setAgentText(queuedForAgent);
      setQueuedForAgent(null);
    }
  }, [queuedForAgent, ready]);

  const handleAudio = async (blob: Blob) => {
    const { cloudStt: stt } = latest.current;
    if (!stt) return;
    setSttError(null);
    setTranscribing(true);
    try {
      const heard = await transcribeAudio(blob, stt);
      const now = latest.current;
      const full = now.text.trim() ? `${now.text.trim()} ${heard}` : heard;
      speech.setTranscript(full);
      // voice note → agent, no extra tap (the transcript stays visible on the result screen)
      if (now.assistantOn && now.autoLog && full.trim()) setQueuedForAgent(full.trim());
    } catch (e) {
      setSttError((e as Error).message);
    } finally {
      setTranscribing(false);
    }
  };

  const analyse = () => {
    if (speech.listening) speech.stop();
    const r = matchTranscript(text, index, { boost });
    if (r.meal) setMeal(r.meal);
    if (r.time) setTime(r.time);
    setRows(
      r.items.map((it, i) => ({
        key: `${i}-${it.parsed.food}`,
        said: it.parsed.raw,
        include: !!it.food,
        candidates: it.candidates,
        food: it.food,
        quantity: it.amount?.quantity ?? it.parsed.quantity,
        unit: it.amount?.unit ?? 'g',
        spokenQty: it.parsed.quantity,
        spokenUnit: it.parsed.unit,
      })),
    );
  };

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs!.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const chooseFood = (row: Row, food: Food) => {
    // a weight carries over as-is; household measures are re-resolved against the new food's portions
    if (row.unit === 'g') return update(row.key, { food, include: true });
    const a = resolveAmount(food, row.spokenQty, row.spokenUnit);
    update(row.key, { food, include: true, quantity: a.quantity, unit: a.unit });
  };

  const included = (rows ?? []).filter((r) => r.include && r.food);
  const totals = sumNutrients(included.map((r) => scaleNutrients(r.food!.nutrients, gramsFor(r.food!, r.quantity, r.unit))));

  const save = () => {
    const entries: FoodEntry[] = included.map((r) => {
      const grams = gramsFor(r.food!, r.quantity, r.unit);
      return {
        id: uid(), date, time, meal, foodId: r.food!.id, foodName: r.food!.name, quantity: r.quantity, unit: r.unit,
        grams, nutrients: scaleNutrients(r.food!.nutrients, grams), via: 'voice',
      };
    });
    addFoodEntries(entries);
    onClose();
  };

  const replacingRow = rows?.find((r) => r.key === replacing);
  if (replacingRow) {
    return (
      <Sheet title={t('Choose food')} onClose={onClose} leading={<button className="icon-btn" aria-label={t('Go back')} onClick={() => setReplacing(null)}><IconChevron dir="left" /></button>}>
        <p className="said" style={{ marginTop: 0 }}>{t('You said: “{s}”', { s: replacingRow.said })}</p>
        <FoodSearchList onPick={(f) => { chooseFood(replacingRow, f); setReplacing(null); }} />
      </Sheet>
    );
  }

  if (rows) {
    return (
      <Sheet
        title={t('Review')}
        onClose={onClose}
        leading={<button className="icon-btn" aria-label={t('Go back')} onClick={() => setRows(null)}><IconChevron dir="left" /></button>}
        footer={
          <div className="stack" style={{ gap: 8 }}>
            <div className="row between small">
              <span className="muted">{included.length === 1 ? t('1 item') : t('{n} items', { n: included.length })}</span>
              <span><strong className="num">{Math.round(totals.kcal ?? 0)} kcal</strong> · <MacroLine n={totals} /></span>
            </div>
            <button className="btn primary block" disabled={!included.length} onClick={save}>{t('Add to {meal}', { meal: MEAL_LABEL[meal] })}</button>
          </div>
        }
      >
        <div className="stack">
          <div className="chips">
            {MEALS.map((m) => <button key={m} className="chip" aria-pressed={m === meal} onClick={() => setMeal(m)}>{MEAL_LABEL[m]}</button>)}
          </div>
          <label className="field" style={{ maxWidth: 160 }}>{t('Time')}<input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
          {rows.length === 0 && <p className="muted">{t('No foods found — try “2 eggs and a slice of toast”.')}</p>}
          {rows.map((r) => {
            const grams = r.food ? gramsFor(r.food, r.quantity, r.unit) : 0;
            const n = r.food ? scaleNutrients(r.food.nutrients, grams) : {};
            return (
              <div key={r.key} className={`voice-item ${r.include ? '' : 'off'}`}>
                <div className="row between" style={{ alignItems: 'flex-start' }}>
                  <div className="said">“{r.said}”</div>
                  <label className="row small" style={{ gap: 6 }}>
                    <input type="checkbox" checked={r.include} disabled={!r.food} onChange={(e) => update(r.key, { include: e.target.checked })} /> {t('Include')}
                  </label>
                </div>
                {r.food ? (
                  <>
                    <select className="input" style={{ marginTop: 8 }} value={r.food.id} aria-label={t('Matched food')}
                      onChange={(e) => {
                        if (e.target.value === '__search') return setReplacing(r.key);
                        const f = r.candidates.find((c) => c.id === e.target.value);
                        if (f) chooseFood(r, f);
                      }}>
                      {!r.candidates.some((c) => c.id === r.food!.id) && <option value={r.food.id}>{r.food.name}</option>}
                      {r.candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      <option value="__search">{t('Search for something else…')}</option>
                    </select>
                    <div className="grid2" style={{ gridTemplateColumns: '1fr 1.6fr', marginTop: 8 }}>
                      <input className="input num" type="number" min={0} step="any" value={r.quantity} aria-label={t('Quantity')}
                        onChange={(e) => update(r.key, { quantity: Number(e.target.value) })} />
                      <select className="input" value={r.unit} aria-label={t('Unit')} onChange={(e) => update(r.key, { unit: e.target.value })}>
                        {unitOptions(r.food).map((u) => <option key={u.label} value={u.label}>{u.label === 'g' ? t('grams') : `${u.label} (${fmt(u.grams)} g)`}</option>)}
                      </select>
                    </div>
                    <div className="small row between" style={{ marginTop: 8 }}>
                      <span className="muted num">{fmt(grams)} g</span>
                      <span><strong className="num">{Math.round(n.kcal ?? 0)} kcal</strong> · <MacroLine n={n} /></span>
                    </div>
                  </>
                ) : (
                  <button className="btn block" style={{ marginTop: 8 }} onClick={() => setReplacing(r.key)}>{t('No match — search the catalog')}</button>
                )}
              </div>
            );
          })}
        </div>
      </Sheet>
    );
  }

  if (agentText) {
    return (
      <Sheet title={t('Assistant')} onClose={onClose}>
        <AgentRun text={agentText} date={date} onDone={onClose} />
      </Sheet>
    );
  }

  const busy = transcribing || recorder.recording || !!queuedForAgent;
  return (
    <Sheet title={assistantOn ? t('Tell the assistant') : t('Describe your meal')} onClose={onClose}>
      <div className="stack" style={{ textAlign: 'center' }}>
        {cloudStt ? (
          <>
            <button className={`mic ${recorder.recording ? 'live' : ''}`} disabled={transcribing}
              onClick={recorder.recording ? recorder.stop : () => recorder.start(handleAudio)}
              aria-label={recorder.recording ? t('Stop recording') : t('Record a voice note')}>
              {recorder.recording ? <IconStop /> : <IconMic />}
            </button>
            <div className="small muted">
              {recorder.recording ? t('Recording… {s}s', { s: recorder.seconds }) : transcribing ? t('Transcribing…') : t('Tap to record')}
            </div>
            <label className="btn ghost small" style={{ alignSelf: 'center' }}>
              {t('Or upload an audio file')}
              <input type="file" accept="audio/*" className="sr-only" onChange={(e) => e.target.files?.[0] && handleAudio(e.target.files[0])} />
            </label>
          </>
        ) : speech.supported ? (
          <>
            <button className={`mic ${speech.listening ? 'live' : ''}`} onClick={speech.listening ? speech.stop : speech.start}
              aria-label={speech.listening ? t('Stop recording') : t('Start recording')}>
              {speech.listening ? <IconStop /> : <IconMic />}
            </button>
            <div className="small muted">{speech.listening ? t('Listening…') : t('Tap and speak')}</div>
          </>
        ) : (
          <div className="notice">{t('No voice input in this browser — type instead.')}</div>
        )}
        {(speech.error || recorder.error || sttError) && <div className="error">{speech.error ?? recorder.error ?? sttError}</div>}
        {speech.listening && speech.interim && <div className="transcript"><span className="interim">{speech.interim}</span></div>}
        <label className="field" style={{ textAlign: 'left' }}>
          {assistantOn ? t('What did you eat or train?') : t('Transcript')}
          <textarea className="input" value={text} onChange={(e) => speech.setTranscript(e.target.value)}
            placeholder={placeholder ?? (assistantOn
              ? t('Burrito bowl and a Coke Zero for lunch, then a 5 km run')
              : t('200 g chicken breast and a cup of rice'))} />
        </label>
        {assistantOn ? (
          <>
            <button className="btn primary block" disabled={!text.trim() || !ready || busy} onClick={() => { if (speech.listening) speech.stop(); setAgentText(text.trim()); }}>
              {ready ? t('Log it for me') : t('Loading catalog…')}
            </button>
            <button className="btn ghost block" disabled={!text.trim() || !ready || busy} onClick={analyse}>{t('Review matches myself instead')}</button>
          </>
        ) : (
          <>
            <button className="btn primary block" disabled={!text.trim() || !ready || busy} onClick={analyse}>
              {ready ? t('Find foods') : t('Loading catalog…')}
            </button>
            <p className="tiny muted" style={{ margin: 0 }}>
              {t('Include amounts: “2 eggs”, “150 g salmon”.')}
            </p>
          </>
        )}
      </div>
    </Sheet>
  );
}

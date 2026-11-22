import { ANTHROPIC_MODELS, useAssistant, type AgentProvider } from '../../agent/settings';
import type { Transcriber } from '../../agent/transcribe';
import { Segmented } from '../components/Fields';

export function AssistantSettingsForm({ onDone }: { onDone: () => void }) {
  const s = useAssistant();
  return (
    <div className="stack">
      <div className="field">
        <span>Assistant model</span>
        <Segmented<AgentProvider> value={s.provider} label="Provider"
          onChange={(v) => s.set({ provider: v, ...(v === 'openai' && s.transcriber === 'browser' ? { transcriber: 'openai' } : {}) })}
          options={[{ value: 'anthropic', label: 'Claude' }, { value: 'openai', label: 'OpenAI' }]} />
      </div>
      {s.provider === 'anthropic' ? (
        <>
          <label className="field">Claude API key
            <input className="input" type="password" autoComplete="off" placeholder="sk-ant-…" value={s.anthropicKey} onChange={(e) => s.set({ anthropicKey: e.target.value })} />
          </label>
          <label className="field">Model
            <select className="input" value={s.anthropicModel} onChange={(e) => s.set({ anthropicModel: e.target.value })}>
              {ANTHROPIC_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
        </>
      ) : (
        <>
          <label className="field">OpenAI API key
            <input className="input" type="password" autoComplete="off" placeholder="sk-…" value={s.openaiKey} onChange={(e) => s.set({ openaiKey: e.target.value })} />
          </label>
          <label className="field">Model
            <input className="input" value={s.openaiModel} onChange={(e) => s.set({ openaiModel: e.target.value })} />
          </label>
        </>
      )}

      <div className="divider" />
      <div className="field">
        <span>Voice-note transcription</span>
        <Segmented<Transcriber> value={s.transcriber} onChange={(v) => s.set({ transcriber: v })} label="Transcription"
          options={[{ value: 'browser', label: 'Browser' }, { value: 'openai', label: 'OpenAI' }, { value: 'elevenlabs', label: 'ElevenLabs' }]} />
      </div>
      {s.transcriber === 'browser' && (
        <p className="tiny muted" style={{ margin: 0 }}>Free live dictation. No audio files.</p>
      )}
      {s.transcriber === 'openai' && (
        <>
          {s.provider !== 'openai' && (
            <label className="field">OpenAI API key
              <input className="input" type="password" autoComplete="off" placeholder="sk-…" value={s.openaiKey} onChange={(e) => s.set({ openaiKey: e.target.value })} />
            </label>
          )}
          <label className="field">Transcription model<input className="input" value={s.transcribeModel} onChange={(e) => s.set({ transcribeModel: e.target.value })} /></label>
        </>
      )}
      {s.transcriber === 'elevenlabs' && (
        <>
          <label className="field">ElevenLabs API key
            <input className="input" type="password" autoComplete="off" value={s.elevenlabsKey} onChange={(e) => s.set({ elevenlabsKey: e.target.value })} />
          </label>
          <label className="field">Scribe model<input className="input" value={s.elevenlabsModel} onChange={(e) => s.set({ elevenlabsModel: e.target.value })} /></label>
        </>
      )}

      {s.transcriber !== 'browser' && (
        <label className="row small" style={{ gap: 8 }}>
          <input type="checkbox" checked={s.autoLog} onChange={(e) => s.set({ autoLog: e.target.checked })} />
          Log voice notes automatically
        </label>
      )}

      <p className="tiny muted" style={{ margin: 0 }}>Keys stay in this browser and are never exported.</p>
      <button className="btn primary block" onClick={onDone}>Done</button>
    </div>
  );
}

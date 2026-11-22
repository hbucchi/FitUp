import { ANTHROPIC_MODELS, useAssistant, type AgentProvider } from '../../agent/settings';
import type { Transcriber } from '../../agent/transcribe';
import { Segmented } from '../components/Fields';

export function AssistantSettingsForm({ onDone }: { onDone: () => void }) {
  const s = useAssistant();
  return (
    <div className="stack">
      <p className="small muted" style={{ margin: 0 }}>
        With a key, the assistant reads what you write or say, finds each food in your catalog, and logs it to your diary for you.
      </p>
      <div className="field">
        <span>Assistant model</span>
        <Segmented<AgentProvider> value={s.provider} onChange={(v) => s.set({ provider: v })} label="Provider"
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
        <p className="tiny muted" style={{ margin: 0 }}>Free, live dictation in Chrome, Edge and Safari. Can't transcribe recorded or uploaded audio files.</p>
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

      <div className="notice tiny">
        Keys are stored only in this browser and sent only to the provider you chose. They are not included in data exports.
        This is fine for personal use. Before public launch, these calls move to a server (Firebase Functions) so keys never reach the app.
      </div>
      <button className="btn primary block" onClick={onDone}>Done</button>
    </div>
  );
}

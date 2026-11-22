import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Transcriber, TranscribeConfig } from './transcribe';
import { t } from '../i18n';

export type AgentProvider = 'anthropic' | 'openai';

export interface AssistantSettings {
  provider: AgentProvider;
  anthropicKey: string;
  anthropicModel: string;
  openaiKey: string;
  openaiModel: string;
  transcribeModel: string;
  transcriber: Transcriber;
  elevenlabsKey: string;
  elevenlabsModel: string;
  /** Send a transcribed voice note straight to the assistant (no extra tap). */
  autoLog: boolean;
  set: (patch: Partial<Omit<AssistantSettings, 'set'>>) => void;
}

export const ANTHROPIC_MODELS = [
  { id: 'claude-sonnet-5-5', label: `Claude Sonnet 5.5 — ${t('balanced (recommended)')}` },
  { id: 'claude-opus-5-5', label: `Claude Opus 5.5 — ${t('most capable')}` },
  { id: 'claude-haiku-5-5', label: `Claude Haiku 5.5 — ${t('fastest, cheapest')}` },
];

/**
 * API keys live in their own localStorage entry. They are never included in the data export.
 * Calling the APIs straight from the browser is fine for personal use; for public users the
 * calls move behind a Firebase Function so keys never reach the client.
 */
export const useAssistant = create<AssistantSettings>()(
  persist(
    (set) => ({
      provider: 'anthropic',
      anthropicKey: '',
      anthropicModel: 'claude-sonnet-5-5',
      openaiKey: '',
      openaiModel: 'gpt-4.1-mini',
      transcribeModel: 'gpt-4o-mini-transcribe',
      transcriber: 'browser',
      elevenlabsKey: '',
      elevenlabsModel: 'scribe_v1',
      autoLog: true,
      set: (patch) => set(patch),
    }),
    { name: 'micenae:assistant', version: 1 },
  ),
);

export function agentReady(s: Pick<AssistantSettings, 'provider' | 'anthropicKey' | 'openaiKey'>): boolean {
  return s.provider === 'anthropic' ? !!s.anthropicKey.trim() : !!s.openaiKey.trim();
}

/** The cloud transcription service to use for recorded/uploaded audio, if one is configured. */
export function transcribeConfig(s: AssistantSettings): TranscribeConfig | null {
  if (s.transcriber === 'openai' && s.openaiKey.trim()) return { provider: 'openai', apiKey: s.openaiKey.trim(), model: s.transcribeModel };
  if (s.transcriber === 'elevenlabs' && s.elevenlabsKey.trim()) return { provider: 'elevenlabs', apiKey: s.elevenlabsKey.trim(), model: s.elevenlabsModel };
  return null;
}

/** The configured agent model, or null when no key is set. */
export function agentConfig(s: AssistantSettings) {
  if (!agentReady(s)) return null;
  return s.provider === 'anthropic'
    ? { provider: 'anthropic' as const, apiKey: s.anthropicKey.trim(), model: s.anthropicModel }
    : { provider: 'openai' as const, apiKey: s.openaiKey.trim(), model: s.openaiModel };
}

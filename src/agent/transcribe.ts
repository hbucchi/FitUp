import { t } from '../i18n';
/**
 * Audio → text. Claude's API takes text and images but not audio, so recorded or uploaded
 * voice notes are transcribed first by one of these services.
 */
export type Transcriber = 'browser' | 'openai' | 'elevenlabs';

export interface TranscribeConfig {
  provider: Exclude<Transcriber, 'browser'>;
  apiKey: string;
  model: string;
}

function fileName(blob: Blob): string {
  if ((blob as File).name) return (blob as File).name;
  const t = blob.type;
  const ext = t.includes('mp4') ? 'mp4' : t.includes('mpeg') ? 'mp3' : t.includes('wav') ? 'wav' : t.includes('ogg') ? 'ogg' : 'webm';
  return `voice-note.${ext}`;
}

export async function transcribeAudio(blob: Blob, cfg: TranscribeConfig, signal?: AbortSignal): Promise<string> {
  const form = new FormData();
  form.append('file', blob, fileName(blob));
  let url: string;
  let headers: Record<string, string>;
  if (cfg.provider === 'elevenlabs') {
    // ElevenLabs Scribe speech-to-text
    url = 'https://api.elevenlabs.io/v1/speech-to-text';
    headers = { 'xi-api-key': cfg.apiKey };
    form.append('model_id', cfg.model);
    form.append('tag_audio_events', 'false');
  } else {
    url = 'https://api.openai.com/v1/audio/transcriptions';
    headers = { authorization: `Bearer ${cfg.apiKey}` };
    form.append('model', cfg.model);
  }
  const res = await fetch(url, { method: 'POST', headers, body: form, signal });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = json?.error?.message ?? json?.detail?.message ?? (typeof json?.detail === 'string' ? json.detail : null);
    throw new Error(detail ?? t('Transcription failed (HTTP {s})', { s: res.status }));
  }
  return String(json.text ?? '').trim();
}

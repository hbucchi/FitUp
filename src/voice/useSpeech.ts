import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../i18n';

/**
 * Speech-to-text via the browser's Web Speech API (Chrome, Edge, Safari).
 * It sits behind this small hook so a server-side transcriber (e.g. Whisper on a
 * Firebase Function, fed by MediaRecorder audio) can replace it without touching the UI.
 */

// Minimal typings — the Web Speech API is not in lib.dom for all TS versions.
interface SRResult { isFinal: boolean; 0: { transcript: string } }
interface SREvent { resultIndex: number; results: ArrayLike<SRResult> }
interface SR {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getRecognizer(): (new () => SR) | undefined {
  const w = globalThis as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const ERRORS: Record<string, string> = {
  'not-allowed': t('Microphone access was blocked. Allow it in your browser settings, or type instead.'),
  'no-speech': t('No speech was detected. Try again a little closer to the microphone.'),
  network: t('Speech recognition needs a network connection in this browser.'),
  'audio-capture': t('No microphone was found.'),
};

export function useSpeech(lang = 'en-US') {
  const Recognizer = getRecognizer();
  const [listening, setListening] = useState(false);
  const [finalText, setFinalText] = useState('');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<SR | null>(null);

  const start = useCallback(() => {
    if (!Recognizer) return;
    setError(null);
    setInterim('');
    const r = new Recognizer();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let fin = '';
      let tmp = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) fin += res[0].transcript;
        else tmp += res[0].transcript;
      }
      if (fin) setFinalText((t) => (t ? `${t} ${fin.trim()}` : fin.trim()));
      setInterim(tmp);
    };
    r.onerror = (e) => {
      if (e.error !== 'aborted') setError(ERRORS[e.error] ?? t('Speech recognition error: {e}', { e: e.error }));
    };
    r.onend = () => {
      setListening(false);
      setInterim('');
    };
    rec.current = r;
    r.start();
    setListening(true);
  }, [Recognizer, lang]);

  const stop = useCallback(() => rec.current?.stop(), []);

  useEffect(() => () => rec.current?.abort(), []);

  return { supported: !!Recognizer, listening, transcript: finalText, interim, error, start, stop, setTranscript: setFinalText };
}

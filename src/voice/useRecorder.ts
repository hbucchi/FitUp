import { useCallback, useEffect, useRef, useState } from 'react';

/** Records a voice note with MediaRecorder (works in all modern browsers, incl. Firefox). */
export function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<number>();
  const supported = typeof window !== 'undefined' && 'MediaRecorder' in window && !!navigator.mediaDevices?.getUserMedia;

  const start = useCallback(async (onDone: (b: Blob) => void) => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        window.clearInterval(timer.current);
        setRecording(false);
        onDone(new Blob(chunks, { type: r.mimeType || 'audio/webm' }));
      };
      rec.current = r;
      r.start();
      setSeconds(0);
      timer.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
      setRecording(true);
    } catch {
      setError('Microphone access was blocked. Allow it in your browser settings.');
    }
  }, []);

  const stop = useCallback(() => rec.current?.state === 'recording' && rec.current.stop(), []);
  useEffect(() => () => {
    window.clearInterval(timer.current);
    if (rec.current?.state === 'recording') {
      rec.current.onstop = null;
      rec.current.stop();
      rec.current.stream.getTracks().forEach((t) => t.stop());
    }
  }, []);

  return { supported, recording, seconds, error, start, stop };
}

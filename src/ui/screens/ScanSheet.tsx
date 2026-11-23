import { useEffect, useRef, useState } from 'react';
import type { Food } from '../../domain/types';
import { lookupBarcode, validGtin } from '../../data/barcode';
import { useStore } from '../../data/store';
import { t } from '../../i18n';
import { Sheet } from '../components/Sheet';
import { MacroLine } from '../components/Macros';
import { agentConfig, useAssistant } from '../../agent/settings';
import { photoToDataUrl, readLabel, type LabelReading } from '../../agent/label';

type Phase = 'scanning' | 'looking' | 'found' | 'notfound' | 'reading';

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

/** Camera barcode scanner: native BarcodeDetector where available (Android), ZXing elsewhere (iPhone). */
export function ScanSheet({ onClose, onFood, onCreate }: { onClose: () => void; onFood: (f: Food) => void; onCreate: (barcode: string, fromLabel?: LabelReading) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<() => void>(() => {});
  const [phase, setPhase] = useState<Phase>('scanning');
  const [code, setCode] = useState('');
  const [manual, setManual] = useState('');
  const [food, setFood] = useState<Food | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const saved = useStore((s) => s.customFoods);
  const ai = agentConfig(useAssistant());
  const photo = useRef<HTMLInputElement>(null);
  const [labelError, setLabelError] = useState<string | null>(null);
  const back = useRef<Phase>('notfound');

  /** The producer's own numbers: photograph the nutrition table and let the model copy it. */
  const onPhoto = async (file: File | undefined) => {
    if (!file || !ai) return;
    setLabelError(null);
    setPhase('reading');
    try {
      const reading = await readLabel(ai, await photoToDataUrl(file), code || undefined);
      onCreate(code, reading);
    } catch (e) {
      setLabelError((e as Error).message);
      setPhase(back.current);
    }
  };
  const labelButton = (primary: boolean) => (
    <>
      <input ref={photo} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { back.current = phase; void onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
      {ai ? (
        <button className={`btn ${primary ? 'primary' : ''} block`} onClick={() => photo.current?.click()}>{t('Photograph the nutrition label')}</button>
      ) : null}
      {labelError && <div className="error">{labelError}</div>}
    </>
  );

  const handle = async (raw: string) => {
    const c = raw.replace(/\D/g, '');
    if (!validGtin(c)) return false;
    stopRef.current();
    setCode(c);
    const known = saved.find((f) => f.barcode === c);
    if (known) {
      setFood(known);
      setPhase('found');
      return true;
    }
    setPhase('looking');
    const f = await lookupBarcode(c).catch(() => null);
    setFood(f);
    setPhase(f ? 'found' : 'notfound');
    return true;
  };

  useEffect(() => {
    if (phase !== 'scanning') return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let zxingStop: (() => void) | undefined;
    stopRef.current = () => {
      cancelled = true;
      window.clearInterval(timer);
      zxingStop?.();
      stream?.getTracks().forEach((tr) => tr.stop());
    };
    (async () => {
      try {
        const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
        if (BD) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
          if (cancelled || !video.current) return stopRef.current();
          video.current.srcObject = stream;
          await video.current.play();
          const detector = new BD({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
          let busy = false;
          timer = window.setInterval(async () => {
            if (busy || cancelled || !video.current) return;
            busy = true;
            try {
              const found = await detector.detect(video.current);
              for (const b of found) if (await handle(b.rawValue)) break;
            } catch {
              /* frame not ready */
            }
            busy = false;
          }, 250);
        } else {
          const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
          const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]]]);
          const reader = new BrowserMultiFormatReader(hints);
          if (cancelled || !video.current) return;
          const controls = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, video.current, (result) => {
            if (result && !cancelled) void handle(result.getText());
          });
          zxingStop = () => controls.stop();
          if (cancelled) controls.stop();
        }
      } catch (e) {
        const name = (e as Error).name;
        setCameraError(name === 'NotAllowedError' ? t('Camera access was blocked. Allow it in your browser settings, or type the number.') : t('Camera unavailable — type the number.'));
      }
    })();
    return () => stopRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <Sheet title={t('Scan barcode')} onClose={onClose}>
      <div className="stack">
        {phase === 'scanning' && (
          <>
            {!cameraError ? (
              <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#000', aspectRatio: '4 / 3' }}>
                <video ref={video} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div aria-hidden style={{ position: 'absolute', left: '12%', right: '12%', top: '38%', bottom: '38%', border: '2px solid var(--accent)', borderRadius: 8 }} />
              </div>
            ) : (
              <div className="notice small">{cameraError}</div>
            )}
            <form className="row" onSubmit={(e) => { e.preventDefault(); void handle(manual).then((ok) => !ok && setCameraError(t('That number is not a valid barcode.'))); }}>
              <input className="input num" inputMode="numeric" placeholder={t('Or type the number')} value={manual} onChange={(e) => setManual(e.target.value)} aria-label={t('Barcode number')} />
              <button className="btn" type="submit" disabled={manual.replace(/\D/g, '').length < 8}>{t('Search')}</button>
            </form>
          </>
        )}
        {phase === 'looking' && <p className="muted">{t('Looking up {code}…', { code })}</p>}
        {phase === 'reading' && <p className="muted">{t('Reading the label…')}</p>}
        {phase === 'found' && food && (
          <>
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="h-section" style={{ fontSize: 19 }}>{food.name}</div>
              <div className="tiny muted">{[food.brand, food.source].filter(Boolean).join(' · ')}</div>
              <div className="row between" style={{ marginTop: 10 }}>
                <div className="big-num num" style={{ fontSize: 28 }}>{Math.round(food.nutrients.kcal ?? 0)}<span className="small muted" style={{ fontFamily: 'var(--font-body)' }}> kcal / 100 g</span></div>
              </div>
              <div className="small" style={{ marginTop: 4 }}><MacroLine n={food.nutrients} /></div>
              {food.source === 'Open Food Facts' && <div className="tiny muted" style={{ marginTop: 8 }}>{t('Community data — check against the label.')}</div>}
            </div>
            <button className="btn primary block" onClick={() => onFood(food)}>{t('Add to diary')}</button>
            {food.source === 'Open Food Facts' && labelButton(false)}
            <button className="btn ghost block" onClick={() => { setFood(null); setManual(''); setPhase('scanning'); }}>{t('Scan another')}</button>
          </>
        )}
        {phase === 'notfound' && (
          <>
            <p className="muted" style={{ margin: 0 }}>{t('{code} isn’t in USDA or Open Food Facts.', { code })}</p>
            {labelButton(true)}
            <button className={`btn ${ai ? '' : 'primary'} block`} onClick={() => onCreate(code)}>{ai ? t('Type it in instead') : t('Create it from the label')}</button>
            <button className="btn ghost block" onClick={() => { setManual(''); setPhase('scanning'); }}>{t('Scan another')}</button>
          </>
        )}
      </div>
    </Sheet>
  );
}

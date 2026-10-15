import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, PenLine, Plus, RotateCcw, ScanBarcode } from 'lucide-react';
import { getBarcodeDetector, isProductBarcode } from '../utils/barcode';
import { lookupBarcode, nutritionFor, PackagedFood } from '../services/foodDatabase';
import { useDevMode } from '../contexts/DevModeContext';

interface BarcodeScannerProps {
  /** Adds the scanned food to the list waiting to be logged */
  onAdd: (food: { name: string; calories: number; protein?: number }) => void;
  /** Switch to manual entry (for a product the database doesn't know) */
  onManual: () => void;
}

type State =
  | { kind: 'scanning' }
  | { kind: 'looking'; code: string }
  | { kind: 'found'; food: PackagedFood }
  | { kind: 'missing'; code: string }
  | { kind: 'offline'; code: string };

/** "Arla Mellanmjölk", but just "Nutella" when the name already says the brand */
const withBrand = (food: PackagedFood) => {
  const brandWord = food.brand?.split(/\s+/)[0]?.toLowerCase();
  return brandWord && !food.name.toLowerCase().includes(brandWord) ? `${food.brand} ${food.name}` : food.name;
};

/** How often a camera frame is checked for a barcode */
const SCAN_INTERVAL_MS = 250;

/**
 * Scan a packaged food's barcode, or type its number, then pick the amount eaten. Nutrition
 * comes from Open Food Facts; the camera stops as soon as a code is read.
 */
export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ onAdd, onManual }) => {
  const [state, setState] = useState<State>({ kind: 'scanning' });
  const market = useDevMode().isFeatureEnabled('marketTheme');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [typedCode, setTypedCode] = useState('');
  const [amount, setAmount] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  // Lookups that finish after the scanner closed are dropped
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const lookup = useCallback(async (code: string) => {
    setState({ kind: 'looking', code });
    try {
      const food = await lookupBarcode(code);
      if (!mounted.current) return;
      if (!food) { setState({ kind: 'missing', code }); return; }
      setAmount(String(food.servingAmount ?? 100));
      setState({ kind: 'found', food });
    } catch (e) {
      console.warn('Barcode lookup failed', e);
      if (mounted.current) setState({ kind: 'offline', code });
    }
  }, []);

  // Camera runs only while scanning
  useEffect(() => {
    if (state.kind !== 'scanning') return;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    let stopped = false;
    let busy = false;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        const [media, detector] = await Promise.all([
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }),
          getBarcodeDetector(),
        ]);
        stream = media;
        const video = videoRef.current;
        if (stopped || !video) { media.getTracks().forEach(t => t.stop()); return; }
        video.srcObject = media;
        await video.play();
        setCameraError(null);
        timer = window.setInterval(async () => {
          if (busy || stopped || video.readyState < 2) return;
          busy = true;
          try {
            const code = (await detector.detect(video)).map(b => b.rawValue).find(isProductBarcode);
            if (code && !stopped) {
              navigator.vibrate?.(30);
              lookup(code);
            }
          } catch { /* a frame that can't be read; try the next */ }
          busy = false;
        }, SCAN_INTERVAL_MS);
      } catch (e) {
        if (stopped) return;
        const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
        setCameraError(denied
          ? 'Camera access is off for Vesta. Allow it in your browser settings, or type the number below.'
          : "The camera isn't available here. Type the number under the barcode instead.");
      }
    })();

    return () => {
      stopped = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, [state.kind, lookup]);

  const submitTyped = (e: React.FormEvent) => {
    e.preventDefault();
    const code = typedCode.trim();
    if (isProductBarcode(code)) lookup(code);
  };

  const scanAgain = () => {
    setTypedCode('');
    setState({ kind: 'scanning' });
  };

  if (state.kind === 'found') {
    const { food } = state;
    const grams = parseInt(amount, 10);
    const valid = Number.isFinite(grams) && grams > 0;
    const { calories, protein } = nutritionFor(food, valid ? grams : 0);
    const presets = [
      ...(food.servingAmount ? [{ label: `1 serving · ${food.servingAmount} ${food.unit}`, value: food.servingAmount }] : []),
      { label: `100 ${food.unit}`, value: 100 },
    ];
    const add = () => {
      if (!valid) return;
      onAdd({ name: `${withBrand(food)} (${grams} ${food.unit})`, calories, protein });
      scanAgain();
    };
    return (
      <div className="space-y-3">
        <div>
          <p className="font-semibold leading-snug">{food.name}</p>
          <p className="text-sm text-muted">
            {food.brand ? `${food.brand} · ` : ''}{food.kcalPer100} kcal{food.proteinPer100 !== undefined ? `, ${food.proteinPer100} g protein` : ''} per 100 {food.unit}
          </p>
        </div>
        <div role="group" aria-label="Amount" className="flex flex-wrap gap-1.5">
          {presets.map(p => (
            <button key={p.label} type="button" aria-pressed={grams === p.value} onClick={() => setAmount(String(p.value))} className="chip border-border">
              {p.label}
            </button>
          ))}
        </div>
        <form className="flex gap-2 items-end" onSubmit={e => { e.preventDefault(); add(); }}>
          <label className="flex-1 min-w-0">
            <span className="block text-sm font-semibold mb-1.5">Amount eaten</span>
            <span className="relative block">
              <input
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                className="input w-full !pr-11"
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">{food.unit}</span>
            </span>
          </label>
          <button type="submit" disabled={!valid} className="btn-secondary min-h-11 shrink-0">
            <Plus size={16} aria-hidden="true" /> Add · {calories} kcal
          </button>
        </form>
        <button type="button" onClick={scanAgain} className="btn-ghost btn-sm">
          <RotateCcw size={15} aria-hidden="true" /> Scan something else
        </button>
      </div>
    );
  }

  if (state.kind === 'missing' || state.kind === 'offline') {
    return (
      <div className="space-y-3">
        <p role="alert" className="flex items-start gap-2 text-sm">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-muted" aria-hidden="true" />
          {state.kind === 'missing'
            ? `Barcode ${state.code} isn't in Open Food Facts yet, or has no calories listed. Enter it from the label instead.`
            : "Couldn't reach Open Food Facts. Check your connection and try again."}
        </p>
        <div className="flex flex-wrap gap-2">
          {state.kind === 'offline' && (
            <button type="button" onClick={() => lookup(state.code)} className="btn-secondary btn-sm">
              <RotateCcw size={15} aria-hidden="true" /> Try again
            </button>
          )}
          <button type="button" onClick={onManual} className="btn-secondary btn-sm">
            <PenLine size={15} aria-hidden="true" /> Enter manually
          </button>
          <button type="button" onClick={scanAgain} className="btn-ghost btn-sm">
            <ScanBarcode size={15} aria-hidden="true" /> Scan again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cameraError ? (
        <p role="alert" className="flex items-start gap-2 text-sm">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-muted" aria-hidden="true" /> {cameraError}
        </p>
      ) : (
        <div className={`relative overflow-hidden aspect-[4/3] bg-ink ${market ? 'rounded-[24px]' : 'rounded-[14px]'}`}>
          <video ref={videoRef} muted playsInline className="size-full object-cover" aria-label="Camera view for scanning a barcode" />
          {/* Aiming guide */}
          <div className="pointer-events-none absolute inset-x-[12%] top-1/2 -translate-y-1/2 h-[34%] rounded-[12px] border-2 border-on-ink" aria-hidden="true" />
          <div className="absolute inset-x-3 bottom-3 badge-ink !rounded-full inline-flex w-fit items-center gap-2 px-3 py-1.5 text-sm font-semibold">
            {state.kind === 'looking'
              ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Looking it up…</>
              : <><ScanBarcode size={16} aria-hidden="true" /> Point at the barcode</>}
          </div>
        </div>
      )}
      <form className="flex gap-2 items-end" onSubmit={submitTyped}>
        <label className="flex-1 min-w-0">
          <span className="block text-sm font-semibold mb-1.5">Or type the number</span>
          <input
            value={typedCode}
            onChange={e => setTypedCode(e.target.value.replace(/\D/g, '').slice(0, 14))}
            inputMode="numeric"
            placeholder="Digits under the barcode"
            className="input w-full"
            disabled={state.kind === 'looking'}
          />
        </label>
        <button type="submit" disabled={!isProductBarcode(typedCode) || state.kind === 'looking'} className="btn-secondary min-h-11 shrink-0">
          {state.kind === 'looking' ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : 'Look up'}
        </button>
      </form>
      <p className="text-xs text-muted">Nutrition from Open Food Facts, an open database. Only the barcode is sent.</p>
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { CircleAlert, Camera, Loader2, MessageSquareText, Pencil, Plus, ScanBarcode, Sparkles, CookingPot, X } from 'lucide-react';
import { FoodLogItem, KnownFood } from '../types';
import { analyzeFoodLog, analyzeFoodImage } from '../services/geminiService';
import { frequentFoodsData, knownFoodsData } from '../services/pageData';
import { exactKnownFood, knownFoodsMentioned, searchKnownFoods } from '../utils/foodMatch';
import { usePrewarmed } from '../utils/prewarm';
import { foodIconFor } from '../utils/mealVisual';
import { Sheet } from './Sheet';
import { BarcodeScanner } from './BarcodeScanner';
import { SelectionPill } from './SelectionPill';

interface FoodEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItems: (items: FoodLogItem[]) => void;
}

type Mode = 'describe' | 'photo' | 'scan' | 'manual';

const MODES: { value: Mode; label: string; Icon: typeof Camera }[] = [
  { value: 'describe', label: 'Describe', Icon: MessageSquareText },
  { value: 'photo', label: 'Photo', Icon: Camera },
  { value: 'scan', label: 'Scan', Icon: ScanBarcode },
  { value: 'manual', label: 'Manual', Icon: Pencil },
];

/** A food waiting to be logged; calories stay a string while being edited. */
interface Draft { id: string; name: string; calories: string; protein: string; type?: string }

const toDraft = (name: string, calories: number, protein?: number, type?: string): Draft => ({
  id: crypto.randomUUID(),
  name: name.trim(),
  calories: String(Math.round(calories)),
  protein: typeof protein === 'number' ? String(Math.round(protein)) : '',
  type,
});

/** Protein in grams, or undefined when left empty */
const proteinOf = (d: Draft) => {
  const n = parseInt(d.protein, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

const kcalOf = (d: Draft) => {
  const n = parseInt(d.calories, 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Downscale a photo to a JPEG for the AI; falls back to the original file if the browser can't decode it (e.g. HEIC in Chrome). */
const photoForAnalysis = async (file: File): Promise<{ base64: string; mimeType: string; previewUrl: string }> => {
  const previewUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = previewUrl;
    await img.decode();
    const scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', previewUrl };
  } catch {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    return { base64: dataUrl.split(',')[1], mimeType: file.type || 'image/jpeg', previewUrl };
  }
};

const FoodEntrySheet: React.FC<Omit<FoodEntryModalProps, 'isOpen'>> = ({ onClose, onAddItems }) => {
  const [mode, setMode] = useState<Mode>('describe');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [text, setText] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [manualName, setManualName] = useState('');
  const [manualKcal, setManualKcal] = useState('');
  const [manualProtein, setManualProtein] = useState('');

  const textRef = useRef<HTMLTextAreaElement>(null);
  const manualNameRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Results that arrive after the sheet closed are dropped
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    return () => { open.current = false; };
  }, []);
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  const recent = (usePrewarmed(frequentFoodsData) ?? []).slice(0, 6);
  const known = usePrewarmed(knownFoodsData) ?? [];
  // While typing, the user's own foods that match replace the Recent row
  const matches = text.trim().length >= 2 ? searchKnownFoods(text, known) : [];
  const addKnown = (food: KnownFood) => {
    addDrafts([toDraft(food.name, food.calories, food.protein)]);
    setText('');
    setError(null);
    textRef.current?.focus();
  };

  const addDrafts = (items: Draft[]) => setDrafts(prev => [...prev, ...items]);
  const updateDraft = (id: string, patch: Partial<Draft>) => setDrafts(prev => prev.map(d => (d.id === id ? { ...d, ...patch } : d)));
  const removeDraft = (id: string) => setDrafts(prev => prev.filter(d => d.id !== id));

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    if (next === 'describe') requestAnimationFrame(() => textRef.current?.focus());
    if (next === 'manual') requestAnimationFrame(() => manualNameRef.current?.focus());
  };

  const estimate = async () => {
    if (!text.trim() || busy) return;
    // A food the user already has numbers for needs no estimate
    const exact = exactKnownFood(text, known);
    if (exact) { addKnown(exact); return; }
    setBusy(true);
    setError(null);
    try {
      const items = await analyzeFoodLog(text, knownFoodsMentioned(text, known));
      if (!open.current) return;
      if (items.length === 0) {
        setError('No food recognised. Add a little more detail, for example "protein shake with milk".');
        return;
      }
      addDrafts(items.map(i => toDraft(i.name, i.calories, i.protein, i.type)));
      setText('');
    } catch (e) {
      console.error(e);
      if (open.current) setError("Couldn't estimate that right now. Try again, or enter it manually.");
    } finally {
      if (open.current) setBusy(false);
    }
  };

  const analysePhoto = async (file: File) => {
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) {
      setError('Choose a photo: JPEG, PNG, WebP or HEIC.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { base64, mimeType, previewUrl } = await photoForAnalysis(file);
      setPhotoPreview(previewUrl);
      const items = await analyzeFoodImage(base64, mimeType);
      if (!open.current) return;
      if (items.length === 0) {
        setError('No food found in that photo. Try another angle, or describe it instead.');
        return;
      }
      addDrafts(items.map(i => toDraft(i.name, i.calories, i.protein, i.type)));
      setPhotoPreview(null);
    } catch (e) {
      console.error(e);
      if (open.current) setError("Couldn't read that photo. Try again, or describe it instead.");
    } finally {
      if (open.current) setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const addManual = () => {
    const kcal = parseInt(manualKcal, 10);
    if (!manualName.trim() || !Number.isFinite(kcal) || kcal < 0) return;
    const protein = parseInt(manualProtein, 10);
    addDrafts([toDraft(manualName, kcal, Number.isFinite(protein) ? protein : undefined)]);
    setManualName('');
    setManualKcal('');
    setManualProtein('');
    manualNameRef.current?.focus();
  };

  const valid = drafts.filter(d => d.name.trim());
  const total = valid.reduce((sum, d) => sum + kcalOf(d), 0);
  const totalProtein = valid.reduce((sum, d) => sum + (proteinOf(d) ?? 0), 0);

  const logAll = () => {
    if (!valid.length) return;
    const now = Date.now();
    onAddItems(valid.map(d => ({
      id: crypto.randomUUID(),
      name: d.name.trim(),
      calories: kcalOf(d),
      ...(proteinOf(d) !== undefined ? { protein: proteinOf(d) } : {}),
      timestamp: now,
      ...(d.type ? { type: d.type } : {}),
    })));
    onClose();
  };

  const footer = (
    <button onClick={logAll} disabled={!valid.length || busy} className="btn-primary btn-block">
      {valid.length
        ? `Log ${valid.length === 1 ? '1 item' : `${valid.length} items`} · ${total.toLocaleString()} kcal`
        : 'Log food'}
    </button>
  );

  return (
    <Sheet title="Log food" onClose={onClose} footer={footer} initialFocus={textRef}>
      <div className="space-y-4">
        {/* Mode */}
        <div role="radiogroup" aria-label="How to add food" className="segmented pill-group grid grid-cols-4 w-full">
          {MODES.map(({ value, label, Icon }) => (
            <button
              key={value}
              role="radio"
              aria-checked={mode === value}
              onClick={() => switchMode(value)}
              className="segment justify-center gap-1.5 px-1"
            >
              {mode === value && <SelectionPill group="food-entry-mode-pill" />}
              {/* Phones: labels only, so four fit across */}
              <Icon size={15} className="hidden sm:block" aria-hidden="true" /> {label}
            </button>
          ))}
        </div>

        {mode === 'describe' && (
          // A composer, the question as a title and Estimate inside the box
          <div className="space-y-1.5">
            <label htmlFor="food-describe" className="block font-display font-extrabold text-[22px] leading-7 tracking-tight">What did you eat?</label>
            <div className="relative">
              <textarea
                id="food-describe"
                ref={textRef}
                rows={3}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); estimate(); } }}
                disabled={busy}
                placeholder="2 eggs, a slice of rye bread and a coffee with milk"
                className="input w-full resize-none text-lg leading-snug !rounded-[22px] pt-3.5 pb-16"
              />
              <button onClick={estimate} disabled={!text.trim() || busy} className="btn-primary btn-sm absolute right-2.5 bottom-3.5">
                {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
                {busy ? 'Estimating…' : 'Estimate'}
              </button>
            </div>
            <p className="text-sm text-muted px-1">Amounts make the estimate better.</p>
          </div>
        )}

        {mode === 'describe' && (
          <div className="space-y-3">

            {matches.length > 0 && (
              <div>
                <p className="heading-3 mb-1">Your foods</p>
                <ul className="divide-y divide-border">
                  {matches.map(food => {
                    const Icon = foodIconFor({ name: food.name }) ?? Plus;
                    return (
                      <li key={food.name}>
                        <button
                          onClick={() => addKnown(food)}
                          aria-label={`Add ${food.name}, ${food.calories} kcal`}
                          className="w-full flex items-center text-left hover:bg-surface-sunken transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--focus-ring)] gap-3 min-h-14 px-1 py-2 rounded-[16px]"
                        >
                          <span className="size-10 shrink-0 rounded-full tile-calories flex items-center justify-center">
                            <Icon size={18} strokeWidth={2.25} aria-hidden="true" />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block truncate font-semibold text-sm">{capitalise(food.name)}</span>
                            {food.source === 'recipe' && <span className="block text-xs text-muted">Your recipe, 1 portion</span>}
                          </span>
                          <span className="shrink-0 text-sm text-muted">{food.calories} kcal</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {matches.length === 0 && recent.length > 0 && (
              <div>
                <p className="heading-3 mb-2">Your usual</p>
                <div className="flex flex-wrap gap-1.5">
                  {recent.map(food => {
                    const Icon = foodIconFor({ name: food.name }) ?? Plus;
                    return (
                      <button
                        key={food.name}
                        onClick={() => addDrafts([toDraft(capitalise(food.name), food.calories, food.protein)])}
                        aria-label={`Add ${food.name}, ${food.calories} kcal`}
                        className="chip pl-2.5 pr-3"
                      >
                        <Icon size={15} className="text-calories-text" aria-hidden="true" />
                        <span className="max-w-[10rem] truncate">{capitalise(food.name)}</span>
                        <span className="text-muted font-normal">{food.calories}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {mode === 'photo' && (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.heic,.heif"
              className="sr-only"
              tabIndex={-1}
              onChange={e => { const f = e.target.files?.[0]; if (f) analysePhoto(f); }}
            />
            {busy && photoPreview ? (
              <div className="relative overflow-hidden rounded-[14px] aspect-[4/3] bg-surface-sunken">
                <img src={photoPreview} alt="Your meal" className="size-full object-cover" />
                <div className="absolute inset-x-3 bottom-3 badge-ink !rounded-full inline-flex w-fit items-center gap-2 px-3 py-1.5 text-sm font-semibold">
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Estimating calories…
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border-control text-center hover:bg-surface-sunken transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] py-10 rounded-[24px]"
              >
                <span className="rounded-full bg-calories-bg text-calories-text flex items-center justify-center size-20 mb-1">
                  <Camera size={32} aria-hidden="true" />
                </span>
                <span className="font-display font-extrabold text-[22px] leading-7 tracking-tight">Take or choose a photo</span>
                <span className="text-xs text-muted px-6">Every food in the picture gets its own estimate you can adjust.</span>
              </button>
            )}
          </div>
        )}

        {mode === 'scan' && (
          <BarcodeScanner
            onAdd={food => addDrafts([toDraft(food.name, food.calories, food.protein)])}
            onManual={() => switchMode('manual')}
          />
        )}

        {mode === 'manual' && (
          <form className="space-y-2" onSubmit={e => { e.preventDefault(); addManual(); }}>
            <label className="block">
              <span className="block text-sm font-semibold mb-1.5">Food</span>
              <input ref={manualNameRef} value={manualName} onChange={e => setManualName(e.target.value)} placeholder="Chicken salad" className="input w-full" />
            </label>
            <div className="flex gap-2 items-end">
              <label className="flex-1 min-w-0">
                <span className="block text-sm font-semibold mb-1.5">Calories</span>
                <span className="relative block">
                  <input
                    value={manualKcal}
                    onChange={e => setManualKcal(e.target.value.replace(/\D/g, ''))}
                    inputMode="numeric"
                    placeholder="350"
                    className="input w-full !pr-11"
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">kcal</span>
                </span>
              </label>
              <label className="flex-1 min-w-0">
                <span className="block text-sm font-semibold mb-1.5">Protein <span className="font-normal text-muted">(optional)</span></span>
                <span className="relative block">
                  <input
                    value={manualProtein}
                    onChange={e => setManualProtein(e.target.value.replace(/\D/g, ''))}
                    inputMode="numeric"
                    placeholder="30"
                    className="input w-full !pr-8"
                  />
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">g</span>
                </span>
              </label>
              <button type="submit" disabled={!manualName.trim() || !manualKcal} className="btn-secondary min-h-11 shrink-0">
                <Plus size={16} aria-hidden="true" /> Add
              </button>
            </div>
          </form>
        )}

        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-error">
            <CircleAlert size={16} className="shrink-0 mt-0.5" aria-hidden="true" /> {error}
          </p>
        )}

        {/* What will be logged */}
        {drafts.length > 0 && (
          <section aria-label="To log" className="pt-1">
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="heading-3">To log</h3>
              <p className="text-xs text-muted">{totalProtein > 0 ? `${totalProtein} g protein · ` : ''}tap to change</p>
            </div>
            <ul className="divide-y divide-border">
              {drafts.map(d => {
                const Icon = foodIconFor({ name: d.name }) ?? CookingPot;
                return (
                  <li key={d.id} className="flex items-start gap-2 py-2">
                    <span className="mt-0.5 shrink-0 bg-calories-bg text-calories-text items-center justify-center flex size-10 rounded-full">
                      <Icon size={17} strokeWidth={2.25} aria-hidden="true" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <input
                        value={d.name}
                        onChange={e => updateDraft(d.id, { name: e.target.value })}
                        aria-label="Food name"
                        className="w-full min-h-10 px-2 -mx-0.5 rounded-[10px] bg-transparent font-semibold hover:bg-surface-sunken focus:bg-surface focus:outline-2 focus:outline-[var(--focus-ring)]"
                      />
                      <div className="flex items-center gap-1 -ml-0.5">
                        {([
                          ['calories', 'kcal', `Calories for ${d.name}`, 'w-[5rem]'],
                          ['protein', 'g protein', `Protein for ${d.name}`, 'w-[7rem]'],
                        ] as const).map(([key, unit, label, width]) => (
                          <span key={key} className="relative shrink-0">
                            <input
                              value={d[key]}
                              onChange={e => updateDraft(d.id, { [key]: e.target.value.replace(/\D/g, '') })}
                              inputMode="numeric"
                              placeholder="–"
                              aria-label={label}
                              className={`${width} min-h-9 pl-2 rounded-[10px] bg-transparent text-sm text-right hover:bg-surface-sunken focus:bg-surface focus:outline-2 focus:outline-[var(--focus-ring)] ${key === 'calories' ? 'pr-10' : 'pr-[4.5rem]'}`}
                            />
                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted">{unit}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => removeDraft(d.id)} className="size-9 mt-0.5 shrink-0 inline-flex items-center justify-center rounded-full text-muted hover:text-main hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)]" aria-label={`Remove ${d.name}`}>
                      <X size={16} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </Sheet>
  );
};

/** Log food by describing it, from a photo, by scanning a barcode or by hand. Every estimate lands in an editable list before it's logged. */
export const FoodEntryModal: React.FC<FoodEntryModalProps> = ({ isOpen, ...props }) =>
  isOpen ? <FoodEntrySheet {...props} /> : null;

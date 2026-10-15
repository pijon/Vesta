import React, { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { EatingOutDish } from '../types';
import { eatingOutDishesData } from '../services/pageData';
import { saveEatingOutDishes } from '../services/storageService';
import { ensureWarm, usePrewarmed } from '../utils/prewarm';
import { dishLabel, editDish, removeDish } from '../utils/eatingOutHistory';

/** Fix a mistyped place or calories, or remove a dish from the eating-out history. */
export const EatingOutHistorySettings: React.FC = () => {
  const dishes = usePrewarmed(eatingOutDishesData);
  const [editing, setEditing] = useState<string | null>(null);
  const [place, setPlace] = useState('');
  const [dish, setDish] = useState('');
  const [kcal, setKcal] = useState('');
  const [error, setError] = useState('');
  const [removed, setRemoved] = useState<{ dish: EatingOutDish; before: EatingOutDish[] } | null>(null);

  const save = async (next: EatingOutDish[]) => {
    try {
      await saveEatingOutDishes(next);
      await ensureWarm(eatingOutDishesData, true);
    } catch (e) {
      console.error(e);
      setError("Couldn't save that. Try again.");
    }
  };

  const startEdit = (d: EatingOutDish) => {
    setEditing(d.id); setPlace(d.place); setDish(d.dish); setKcal(String(d.calories)); setError('');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(kcal);
    if (!place.trim() && !dish.trim()) { setError('Enter a place or a dish'); return; }
    if (!Number.isFinite(value) || value < 0 || value > 5000) { setError('Enter calories from 0 to 5000'); return; }
    save(editDish(dishes ?? [], editing!, { place, dish, calories: value }));
    setEditing(null);
  };

  const remove = (d: EatingOutDish) => {
    const before = dishes ?? [];
    setRemoved({ dish: d, before });
    save(removeDish(before, d.id));
  };

  if (!dishes) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div>
      {dishes.length === 0 ? (
        <p className="text-sm text-muted">Nothing yet. Dishes you log when eating out are remembered here.</p>
      ) : (
        <ul>
          {dishes.map(d => (
            <li key={d.id} className="py-2 border-b border-border last:border-b-0">
              {editing === d.id ? (
                <form onSubmit={submit} noValidate className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="block text-sm font-semibold text-muted mb-1">Place</span>
                      <input value={place} onChange={e => { setPlace(e.target.value); setError(''); }} className="input w-full" />
                    </label>
                    <label className="block">
                      <span className="block text-sm font-semibold text-muted mb-1">Dish</span>
                      <input value={dish} onChange={e => { setDish(e.target.value); setError(''); }} className="input w-full" />
                    </label>
                  </div>
                  <label className="block w-28">
                    <span className="block text-sm font-semibold text-muted mb-1">kcal</span>
                    <input value={kcal} onChange={e => { setKcal(e.target.value); setError(''); }} inputMode="numeric" className="input w-full text-center" />
                  </label>
                  {error && <p className="text-sm text-error" role="alert">{error}</p>}
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setEditing(null)} className="btn-secondary btn-sm">Cancel</button>
                    <button type="submit" className="btn-primary btn-sm">Save</button>
                  </div>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold leading-snug truncate">{dishLabel(d)}</span>
                    <span className="block text-xs text-muted">{d.calories} kcal · {d.times > 1 ? `${d.times} times` : 'once'}</span>
                  </span>
                  <button onClick={() => startEdit(d)} className="icon-btn" aria-label={`Edit ${dishLabel(d)}`}><Pencil size={16} /></button>
                  <button onClick={() => remove(d)} className="icon-btn" aria-label={`Delete ${dishLabel(d)}`}><Trash2 size={16} /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {removed && (
        <p role="status" className="mt-3 flex items-center gap-3 text-sm text-muted">
          <span className="min-w-0 truncate">Deleted {dishLabel(removed.dish)}</span>
          <button onClick={() => { save(removed.before); setRemoved(null); }} className="btn-secondary btn-sm">Undo</button>
        </p>
      )}
      {!editing && error && <p className="mt-3 text-sm text-error" role="alert">{error}</p>}
    </div>
  );
};

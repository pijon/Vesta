import React, { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { WorkoutItem } from '../types';
import { workoutIconFor } from '../utils/workoutVisual';
import { Sheet } from './Sheet';

interface WorkoutEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (workout: WorkoutItem) => void;
  editingWorkout?: WorkoutItem | null;
  recentWorkouts?: WorkoutItem[];
  /** Deletes the workout being edited; shown only when editing */
  onDelete?: () => void;
}

const WorkoutIcon: React.FC<{ type: string; size: number }> = ({ type, size }) =>
  React.createElement(workoutIconFor(type), { size, stroke: 1.75, 'aria-hidden': true });

const WorkoutEntrySheet: React.FC<Omit<WorkoutEntryModalProps, 'isOpen'>> = ({
  onClose,
  onSave,
  editingWorkout = null,
  recentWorkouts = [],
  onDelete,
}) => {
  const [type, setType] = useState(editingWorkout?.type ?? '');
  const [kcal, setKcal] = useState(editingWorkout ? String(editingWorkout.caloriesBurned) : '');
  const typeRef = useRef<HTMLInputElement>(null);
  const kcalRef = useRef<HTMLInputElement>(null);
  // Fields introduced by titles, as in Log food
  const fieldLabel = 'block font-display font-extrabold text-[19px] leading-6 tracking-tight mb-2';

  // One chip per workout type, most recent first
  const seen = new Set<string>();
  const recent = recentWorkouts.filter(w => {
    const key = w.type.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);

  const canSave = !!type.trim() && kcal !== '';

  const save = () => {
    if (!canSave) return;
    const caloriesBurned = parseInt(kcal, 10) || 0;
    onSave(editingWorkout
      ? { ...editingWorkout, type: type.trim(), caloriesBurned }
      : { id: crypto.randomUUID(), type: type.trim(), caloriesBurned, timestamp: Date.now() });
    onClose();
  };

  const saveButton = (
    <button onClick={save} disabled={!canSave} className="btn-primary btn-block">
      {editingWorkout ? 'Save changes' : kcal ? `Log workout · ${parseInt(kcal, 10).toLocaleString()} kcal` : 'Log workout'}
    </button>
  );
  const footer = editingWorkout && onDelete ? (
    <div className="flex gap-2">
      <button onClick={() => { onClose(); onDelete(); }} className="btn-ghost !text-error hover:!bg-error-bg">
        <Trash2 size={16} aria-hidden="true" /> Delete
      </button>
      <div className="flex-1">{saveButton}</div>
    </div>
  ) : saveButton;

  return (
    <Sheet title={editingWorkout ? 'Edit workout' : 'Log workout'} onClose={onClose} footer={footer} initialFocus={typeRef}>
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); save(); }}>
        {recent.length > 0 && !editingWorkout && (
          <div>
            <p className="heading-3 mb-2">Your usual</p>
            <div className="flex flex-wrap gap-1.5">
              {recent.map(w => {
                const active = type.trim().toLowerCase() === w.type.trim().toLowerCase() && kcal === String(w.caloriesBurned);
                return (
                  <button
                    key={w.type}
                    type="button"
                    aria-pressed={active}
                    onClick={() => { setType(w.type); setKcal(String(w.caloriesBurned)); kcalRef.current?.focus(); }}
                    className="chip pl-2.5 pr-3"
                  >
                    <span className={active ? '' : 'text-workout-text'}><WorkoutIcon type={w.type} size={16} /></span>
                    <span className="max-w-[10rem] truncate">{w.type}</span>
                    <span className={`font-normal ${active ? '' : 'text-muted'}`}>{w.caloriesBurned}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <label className="block">
          <span className={fieldLabel}>What did you do?</span>
          <span className="relative block">
            <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 size-8 bg-workout-bg text-workout-text flex items-center justify-center rounded-full">
              <WorkoutIcon type={type} size={18} />
            </span>
            <input
              ref={typeRef}
              value={type}
              onChange={e => setType(e.target.value)}
              placeholder="Running, cycling, yoga…"
              autoCapitalize="sentences"
              className="input w-full !pl-12"
            />
          </span>
        </label>

        <label className="block">
          <span className={fieldLabel}>Calories burned</span>
          <span className="relative block">
            <input
              ref={kcalRef}
              value={kcal}
              onChange={e => setKcal(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              placeholder="250"
              className="input w-full !pr-14"
            />
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted">kcal</span>
          </span>
          <span className="block text-xs text-muted mt-1.5">Your watch or the machine usually shows this.</span>
        </label>
        {/* Lets Enter submit from either field */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Sheet>
  );
};

/** Log or edit a workout: type and calories burned, with recent workouts one tap away. */
export const WorkoutEntryModal: React.FC<WorkoutEntryModalProps> = ({ isOpen, ...props }) =>
  isOpen ? <WorkoutEntrySheet key={props.editingWorkout?.id ?? 'new'} {...props} /> : null;

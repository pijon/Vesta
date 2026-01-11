import React, { useState, useEffect } from 'react';
import { WorkoutItem } from '../types';
import { Portal } from './Portal';

interface WorkoutEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (workout: WorkoutItem) => void;
  editingWorkout?: WorkoutItem | null;
  recentWorkouts?: WorkoutItem[];
}

export const WorkoutEntryModal: React.FC<WorkoutEntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingWorkout = null,
  recentWorkouts = []
}) => {
  const [workoutType, setWorkoutType] = useState('');
  const [caloriesBurned, setCaloriesBurned] = useState('');

  useEffect(() => {
    if (editingWorkout) {
      setWorkoutType(editingWorkout.type);
      setCaloriesBurned(editingWorkout.caloriesBurned.toString());
    } else {
      setWorkoutType('');
      setCaloriesBurned('');
    }
  }, [editingWorkout, isOpen]);

  const handleSave = () => {
    if (!workoutType.trim() || !caloriesBurned) return;

    const workout: WorkoutItem = editingWorkout
      ? {
        ...editingWorkout,
        type: workoutType,
        caloriesBurned: parseInt(caloriesBurned) || 0
      }
      : {
        id: crypto.randomUUID(),
        type: workoutType,
        caloriesBurned: parseInt(caloriesBurned) || 0,
        timestamp: Date.now()
      };

    onSave(workout);
    handleClose();
  };

  const handleClose = () => {
    setWorkoutType('');
    setCaloriesBurned('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4 py-4 animate-fade-in"
        onClick={handleClose}
      >
        <div
          className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-neutral-200 flex justify-between items-center bg-workout-bg">
            <h3 className="font-normal text-2xl text-slate-900 font-serif flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--workout)' }}>
                <path d="M12.1 3A1.9 1.9 0 1 1 14 4.9 1.898 1.898 0 0 1 12.1 3zm2.568 4.893c.26-1.262-1.399-1.861-2.894-2.385L7.09 6.71l.577 4.154c0 .708 1.611.489 1.587-.049l-.39-2.71 2.628-.48-.998 4.92 3.602 4.179-1.469 4.463a.95.95 0 0 0 .39 1.294c.523.196 1.124-.207 1.486-.923.052-.104 1.904-5.127 1.904-5.127l-2.818-3.236 1.08-5.303zm-5.974 8.848l-3.234.528a1.033 1.033 0 0 0-.752 1.158c.035.539.737.88 1.315.802l3.36-.662 2.54-2.831-1.174-1.361zm8.605-7.74l-1.954.578-.374 1.837 2.865-.781a.881 0 0 0-.537-1.633z" />
                <path fill="none" d="M0 0h24v24H0z" />
              </svg>
              {editingWorkout ? 'Edit Workout' : 'Log Workout'}
            </h3>
            <button
              onClick={handleClose}
              className="p-2 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Content */}
          {/* Content */}
          <div className="p-6">
            {recentWorkouts && recentWorkouts.length > 0 && !editingWorkout && (
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Add</label>
                <div className="flex flex-wrap gap-2">
                  {recentWorkouts.map((workout, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setWorkoutType(workout.type);
                        setCaloriesBurned(workout.caloriesBurned.toString());
                      }}
                      className="px-3 py-2 bg-workout-bg text-sm font-medium rounded-lg border border-workout-border transition-colors flex items-center gap-2"
                      style={{ color: 'var(--workout)' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--workout-bg)';
                        e.currentTarget.style.borderColor = 'var(--workout)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--workout-bg)';
                        e.currentTarget.style.borderColor = 'var(--workout-border)';
                      }}
                    >
                      <span>{workout.type}</span>
                      <span className="opacity-60 text-xs">({workout.caloriesBurned} kcal)</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Workout Type</label>
                <input
                  type="text"
                  value={workoutType}
                  onChange={(e) => setWorkoutType(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  className="w-full p-3 bg-neutral-100 border border-neutral-200 rounded-xl focus:ring-2 outline-none font-medium"
                  onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px var(--workout)'}
                  onBlur={(e) => e.target.style.boxShadow = 'none'}
                  placeholder="e.g. Running, Cycling, Swimming..."
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Calories Burned</label>
                <input
                  type="number"
                  value={caloriesBurned}
                  onChange={(e) => setCaloriesBurned(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  className="w-full p-3 bg-neutral-100 border border-neutral-200 rounded-xl focus:ring-2 outline-none font-medium"
                  onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px var(--workout)'}
                  onBlur={(e) => e.target.style.boxShadow = 'none'}
                  placeholder="e.g. 200"
                />
                <p className="text-xs text-slate-500 mt-2 ml-1">Estimate based on duration and intensity</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 pt-0 flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!workoutType.trim() || !caloriesBurned}
              className={`flex-1 py-3 font-bold rounded-xl transition-colors shadow-lg ${!workoutType.trim() || !caloriesBurned
                ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed'
                : 'text-white'
                }`}
              style={!workoutType.trim() || !caloriesBurned ? {} : { backgroundColor: 'var(--workout)' }}
              onMouseEnter={(e) => {
                if (workoutType.trim() && caloriesBurned) {
                  e.currentTarget.style.backgroundColor = 'var(--workout-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (workoutType.trim() && caloriesBurned) {
                  e.currentTarget.style.backgroundColor = 'var(--workout)';
                }
              }}
            >
              {editingWorkout ? 'Save Changes' : 'Add Workout'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

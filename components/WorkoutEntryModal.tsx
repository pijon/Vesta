import React, { useState, useEffect } from 'react';
import { WorkoutItem } from '../types';
import { Portal } from './Portal';

interface WorkoutEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (workout: WorkoutItem) => void;
  editingWorkout?: WorkoutItem | null;
}

export const WorkoutEntryModal: React.FC<WorkoutEntryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingWorkout = null
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
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-purple-50">
            <h3 className="font-normal text-2xl text-slate-900 font-serif flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600">
                <path d="m13.73 4 2.54 2.54 2.54-2.54 2.54 2.54L18.81 9l2.54 2.54-2.54 2.54L16.27 11.54 13.73 14.08 11.19 11.54 8.65 14.08 6.11 11.54 3.57 14.08 1.03 11.54 3.57 9 1.03 6.46 3.57 3.92 6.11 6.46 8.65 3.92 11.19 6.46z" />
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
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Workout Type</label>
              <input
                type="text"
                value={workoutType}
                onChange={(e) => setWorkoutType(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-medium"
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
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-medium"
                placeholder="e.g. 200"
              />
              <p className="text-xs text-slate-500 mt-2 ml-1">Estimate based on duration and intensity</p>
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
              className={`flex-1 py-3 font-bold rounded-xl transition-colors shadow-lg ${
                !workoutType.trim() || !caloriesBurned
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              {editingWorkout ? 'Save Changes' : 'Add Workout'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

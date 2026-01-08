import React, { useState } from 'react';
import { FoodLogItem, WorkoutItem, DailyLog, UserStats } from '../types';
import { analyzeFoodLog } from '../services/geminiService';
import { Portal } from './Portal';

interface FoodLoggerProps {
  currentLog: DailyLog;
  onAddItems: (items: FoodLogItem[]) => void;
  onAddWorkout: (workout: WorkoutItem) => void;
  onUpdateWorkout: (workout: WorkoutItem) => void;
  onDeleteWorkout: (workoutId: string) => void;
  onUpdateWeight: (weight: number) => void;
  userStats: UserStats;
}

export const FoodLogger: React.FC<FoodLoggerProps> = ({ currentLog, onAddItems, onAddWorkout, onUpdateWorkout, onDeleteWorkout, onUpdateWeight, userStats }) => {
  const [input, setInput] = useState('');
  const [weightInput, setWeightInput] = useState(userStats.currentWeight.toString());
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Workout state
  const [workoutType, setWorkoutType] = useState('');
  const [caloriesBurned, setCaloriesBurned] = useState('');

  // Edit workout state
  const [editingWorkout, setEditingWorkout] = useState<WorkoutItem | null>(null);
  const [editWorkoutType, setEditWorkoutType] = useState('');
  const [editCaloriesBurned, setEditCaloriesBurned] = useState('');
  
  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setIsAnalyzing(true);
    try {
      const items = await analyzeFoodLog(input);
      onAddItems(items);
      setInput('');
    } catch (error) {
      console.error(error);
      alert("Could not analyze food. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleWeightUpdate = () => {
      const w = parseFloat(weightInput);
      if(!isNaN(w) && w > 0) {
          onUpdateWeight(w);
      }
  };

  const handleAddWorkout = () => {
      if (!workoutType.trim() || !caloriesBurned) return;

      const workout: WorkoutItem = {
          id: crypto.randomUUID(),
          type: workoutType,
          caloriesBurned: parseInt(caloriesBurned) || 0,
          timestamp: Date.now()
      };

      onAddWorkout(workout);
      setWorkoutType('');
      setCaloriesBurned('');
  };

  const handleStartEditWorkout = (workout: WorkoutItem) => {
      setEditingWorkout(workout);
      setEditWorkoutType(workout.type);
      setEditCaloriesBurned(workout.caloriesBurned.toString());
  };

  const handleSaveEditWorkout = () => {
      if (!editingWorkout || !editWorkoutType.trim() || !editCaloriesBurned) return;

      const updatedWorkout: WorkoutItem = {
          ...editingWorkout,
          type: editWorkoutType,
          caloriesBurned: parseInt(editCaloriesBurned) || 0
      };

      onUpdateWorkout(updatedWorkout);
      setEditingWorkout(null);
      setEditWorkoutType('');
      setEditCaloriesBurned('');
  };

  const handleCancelEditWorkout = () => {
      setEditingWorkout(null);
      setEditWorkoutType('');
      setEditCaloriesBurned('');
  };

  const handleDeleteWorkout = (workoutId: string) => {
      if (confirm('Delete this workout?')) {
          onDeleteWorkout(workoutId);
      }
  };

  const sortedItems = [...currentLog.items].sort((a, b) => b.timestamp - a.timestamp);
  const sortedWorkouts = [...(currentLog.workouts || [])].sort((a, b) => b.timestamp - a.timestamp);

  const totalCaloriesConsumed = currentLog.items.reduce((acc, i) => acc + i.calories, 0);
  const totalCaloriesBurned = (currentLog.workouts || []).reduce((acc, w) => acc + w.caloriesBurned, 0);
  const netCalories = totalCaloriesConsumed - totalCaloriesBurned;

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      <header>
        <h2 className="text-3xl font-normal text-slate-900 tracking-tight font-serif mb-1">Daily Journal</h2>
        <p className="text-slate-500 font-medium">Track what you eat to stay on target.</p>
      </header>

      {/* Quick Add Form */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <label className="block text-sm font-bold text-slate-700 mb-3">What did you eat?</label>
        <div className="flex gap-3">
            <input 
                type="text"
                className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                placeholder="e.g. 1 apple and a handful of almonds"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            />
            <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !input.trim()}
                className={`px-6 rounded-xl font-bold text-white transition-all shadow-sm ${
                    isAnalyzing || !input.trim() ? 'bg-slate-300' : 'bg-slate-900 hover:bg-emerald-600'
                }`}
            >
                {isAnalyzing ? '...' : 'Add'}
            </button>
        </div>
        <p className="text-xs text-slate-400 mt-3 ml-1">AI will estimate calories automatically.</p>
      </div>

       {/* Workout Tracker */}
       <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600"><path d="m13.73 4 2.54 2.54 2.54-2.54 2.54 2.54L18.81 9l2.54 2.54-2.54 2.54L16.27 11.54 13.73 14.08 11.19 11.54 8.65 14.08 6.11 11.54 3.57 14.08 1.03 11.54 3.57 9 1.03 6.46 3.57 3.92 6.11 6.46 8.65 3.92 11.19 6.46z"/></svg>
          Log Workout
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
                type="text"
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                placeholder="e.g. Running, Cycling..."
                value={workoutType}
                onChange={(e) => setWorkoutType(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddWorkout()}
            />
            <input
                type="number"
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                placeholder="Calories burned"
                value={caloriesBurned}
                onChange={(e) => setCaloriesBurned(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddWorkout()}
            />
            <button
                onClick={handleAddWorkout}
                disabled={!workoutType.trim() || !caloriesBurned}
                className={`px-6 rounded-xl font-bold text-white transition-all shadow-sm ${
                    !workoutType.trim() || !caloriesBurned ? 'bg-slate-300' : 'bg-purple-600 hover:bg-purple-700'
                }`}
            >
                Add
            </button>
        </div>
       </div>

       {/* Weight Update */}
       <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
                 <h3 className="font-semibold text-slate-900">Current Weight (kg)</h3>
                 <p className="text-xs text-slate-500">Update daily for best results</p>
            </div>
            <div className="flex gap-2">
                <input
                    type="number"
                    step="0.1"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                 <button
                    onClick={handleWeightUpdate}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors text-sm"
                >
                    Save
                </button>
            </div>
       </div>

      {/* Summary Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="font-semibold text-slate-900 mb-4">Today's Summary</h3>
        <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-emerald-50 rounded-xl">
                <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Consumed</p>
                <p className="text-2xl font-bold text-emerald-700">{totalCaloriesConsumed}</p>
                <p className="text-xs text-emerald-600">kcal</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-xl">
                <p className="text-xs font-bold text-purple-600 uppercase mb-1">Burned</p>
                <p className="text-2xl font-bold text-purple-700">{totalCaloriesBurned}</p>
                <p className="text-xs text-purple-600">kcal</p>
            </div>
            <div className="text-center p-4 bg-slate-100 rounded-xl">
                <p className="text-xs font-bold text-slate-600 uppercase mb-1">Net</p>
                <p className="text-2xl font-bold text-slate-900">{netCalories}</p>
                <p className="text-xs text-slate-600">kcal</p>
            </div>
        </div>
      </div>

      {/* Food Log List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-semibold text-slate-700">Food Entries</h3>
            <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                {totalCaloriesConsumed} kcal
            </span>
        </div>
        {sortedItems.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
                No food logged today yet.
            </div>
        ) : (
            <ul className="divide-y divide-slate-100">
                {sortedItems.map((item) => (
                    <li key={item.id} className="p-5 flex justify-between items-center hover:bg-slate-50 transition-colors">
                        <div>
                            <p className="font-medium text-slate-900 text-lg font-serif">{item.name}</p>
                            <p className="text-xs text-slate-400 font-medium">{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                        </div>
                        <span className="font-bold text-slate-900 text-lg">{item.calories} <span className="text-xs font-normal text-slate-400">kcal</span></span>
                    </li>
                ))}
            </ul>
        )}
      </div>

      {/* Workout Log List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-purple-50 flex justify-between items-center">
            <h3 className="font-semibold text-purple-900">Workouts</h3>
            <span className="text-sm font-bold text-purple-700 bg-purple-100 px-2 py-1 rounded-md">
                {totalCaloriesBurned} kcal burned
            </span>
        </div>
        {sortedWorkouts.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
                No workouts logged today yet.
            </div>
        ) : (
            <ul className="divide-y divide-slate-100">
                {sortedWorkouts.map((workout) => (
                    <li key={workout.id} className="p-5 flex justify-between items-center hover:bg-purple-50 transition-colors group">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600"><path d="m13.73 4 2.54 2.54 2.54-2.54 2.54 2.54L18.81 9l2.54 2.54-2.54 2.54L16.27 11.54 13.73 14.08 11.19 11.54 8.65 14.08 6.11 11.54 3.57 14.08 1.03 11.54 3.57 9 1.03 6.46 3.57 3.92 6.11 6.46 8.65 3.92 11.19 6.46z"/></svg>
                            </div>
                            <div>
                                <p className="font-medium text-slate-900 text-lg font-serif">{workout.type}</p>
                                <p className="text-xs text-slate-400 font-medium">{new Date(workout.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-purple-700 text-lg">-{workout.caloriesBurned} <span className="text-xs font-normal text-purple-500">kcal</span></span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleStartEditWorkout(workout)}
                                    className="p-2 hover:bg-purple-100 rounded-lg text-purple-600 transition-colors"
                                    title="Edit workout"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                </button>
                                <button
                                    onClick={() => handleDeleteWorkout(workout.id)}
                                    className="p-2 hover:bg-red-100 rounded-lg text-red-600 transition-colors"
                                    title="Delete workout"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                            </div>
                        </div>
                    </li>
                ))}
            </ul>
        )}
      </div>

      {/* Edit Workout Modal */}
      {editingWorkout && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4 py-4 animate-fade-in" onClick={handleCancelEditWorkout}>
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-purple-50">
                    <h3 className="font-normal text-2xl text-slate-900 font-serif">Edit Workout</h3>
                    <button onClick={handleCancelEditWorkout} className="p-2 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Workout Type</label>
                        <input
                            type="text"
                            value={editWorkoutType}
                            onChange={(e) => setEditWorkoutType(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-medium"
                            placeholder="e.g. Running, Cycling..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Calories Burned</label>
                        <input
                            type="number"
                            value={editCaloriesBurned}
                            onChange={(e) => setEditCaloriesBurned(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-medium"
                        />
                    </div>
                </div>
                <div className="p-6 pt-0 flex gap-3">
                    <button
                        onClick={handleCancelEditWorkout}
                        className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSaveEditWorkout}
                        disabled={!editWorkoutType.trim() || !editCaloriesBurned}
                        className={`flex-1 py-3 font-bold rounded-xl transition-colors shadow-lg ${
                            !editWorkoutType.trim() || !editCaloriesBurned
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                : 'bg-purple-600 text-white hover:bg-purple-700'
                        }`}
                    >
                        Save Changes
                    </button>
                </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
};
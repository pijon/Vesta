import React, { useState } from 'react';
import { DayPlan, DailyLog, FoodLogItem, WorkoutItem, AppView } from '../types';
import { Portal } from './Portal';

interface DualTrackSectionProps {
  todayPlan: DayPlan;
  dailyLog: DailyLog;
  onToggleMeal: (index: number) => void;
  onViewRecipe: (recipe: any) => void;
  onEditWorkout: (workout: WorkoutItem) => void;
  onDeleteWorkout: (workoutId: string) => void;
  onUpdateFoodItem: (item: FoodLogItem) => void;
  onDeleteFoodItem: (itemId: string) => void;
  onNavigate: (view: AppView) => void;
}

export const DualTrackSection: React.FC<DualTrackSectionProps> = ({
  todayPlan,
  dailyLog,
  onToggleMeal,
  onViewRecipe,
  onEditWorkout,
  onDeleteWorkout,
  onUpdateFoodItem,
  onDeleteFoodItem,
  onNavigate
}) => {
  const [editingFoodItem, setEditingFoodItem] = useState<FoodLogItem | null>(null);
  const [editFoodName, setEditFoodName] = useState('');
  const [editFoodCalories, setEditFoodCalories] = useState('');
  const [showAllLoggedItems, setShowAllLoggedItems] = useState(false);

  const sortedFoodItems = [...(dailyLog.items || [])].sort((a, b) => b.timestamp - a.timestamp);
  const sortedWorkouts = [...(dailyLog.workouts || [])].sort((a, b) => b.timestamp - a.timestamp);

  // Show only 3 items by default on mobile
  const displayedItems = showAllLoggedItems ? sortedFoodItems : sortedFoodItems.slice(0, 3);
  const displayedWorkouts = showAllLoggedItems ? sortedWorkouts : sortedWorkouts.slice(0, 3);

  const handleStartEditFood = (item: FoodLogItem) => {
    setEditingFoodItem(item);
    setEditFoodName(item.name);
    setEditFoodCalories(item.calories.toString());
  };

  const handleSaveEditFood = () => {
    if (!editingFoodItem || !editFoodName.trim() || !editFoodCalories) return;

    const updatedItem: FoodLogItem = {
      ...editingFoodItem,
      name: editFoodName,
      calories: parseInt(editFoodCalories) || 0
    };

    onUpdateFoodItem(updatedItem);
    setEditingFoodItem(null);
    setEditFoodName('');
    setEditFoodCalories('');
  };

  const handleCancelEditFood = () => {
    setEditingFoodItem(null);
    setEditFoodName('');
    setEditFoodCalories('');
  };

  const handleDeleteFood = (itemId: string) => {
    if (confirm('Delete this food entry?')) {
      onDeleteFoodItem(itemId);
    }
  };

  const handleDeleteWorkout = (workoutId: string) => {
    if (confirm('Delete this workout?')) {
      onDeleteWorkout(workoutId);
    }
  };

  const totalLoggedItems = sortedFoodItems.length + sortedWorkouts.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: From Your Plan */}
      <div className="bg-surface rounded-2xl shadow-lg border border-emerald-200 overflow-hidden">
        <div className="p-5 border-b border-emerald-100 bg-emerald-50/50 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <h3 className="font-medium text-emerald-900 text-lg font-serif">From Your Plan</h3>
        </div>
        <div className="p-4 space-y-2 min-h-[200px]">
          {todayPlan.meals.length === 0 ? (
            <div className="p-8 text-center text-muted flex flex-col items-center justify-center h-full">
              <p className="font-medium mb-3">No meals planned for today</p>
              <button
                onClick={() => onNavigate(AppView.PLANNER)}
                className="px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Plan My Day
              </button>
            </div>
          ) : (
            todayPlan.meals.map((meal, index) => {
              const isCompleted = todayPlan.completedMealIds.includes(meal.id);
              return (
                <div
                  key={index}
                  onClick={() => onViewRecipe(meal)}
                  className={`p-4 flex items-center gap-4 rounded-xl border transition-all cursor-pointer ${isCompleted
                    ? 'bg-emerald-50/50 border-emerald-100 opacity-70'
                    : 'bg-white border-emerald-200 hover:border-emerald-400 hover:shadow-sm'
                    }`}
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleMeal(index);
                    }}
                    className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all flex-shrink-0 cursor-pointer ${isCompleted
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50'
                      }`}
                  >
                    {isCompleted && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium truncate ${isCompleted ? 'text-emerald-700 line-through' : 'text-main'}`}>
                      {meal.name}
                    </p>
                    <div className="flex gap-2 items-center mt-1">
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded uppercase tracking-wide">
                        {meal.type}
                      </span>
                      <span className="text-xs text-muted">{meal.calories} kcal</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: Your Log */}
      <div className="bg-surface rounded-2xl shadow-lg border border-blue-200 overflow-hidden">
        <div className="p-5 border-b border-blue-100 bg-blue-50/50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            <h3 className="font-medium text-blue-900 text-lg font-serif">Your Log</h3>
          </div>
          <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
            {totalLoggedItems} {totalLoggedItems === 1 ? 'entry' : 'entries'}
          </span>
        </div>
        <div className="p-4 space-y-2 min-h-[200px]">
          {sortedFoodItems.length === 0 && sortedWorkouts.length === 0 ? (
            <div className="p-8 text-center text-muted">
              <p>No items logged yet</p>
              <p className="text-xs mt-1">Use Quick Actions to log food or workouts</p>
            </div>
          ) : (
            <>
              {/* Food Items */}
              {displayedItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 flex justify-between items-center rounded-xl border border-blue-100 bg-white hover:border-blue-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex-1">
                    <p className="font-medium text-main">{item.name}</p>
                    <div className="flex gap-2 items-center mt-1">
                      <span className="text-xs text-muted">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-xs text-blue-600 font-bold">{item.calories} kcal</span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleStartEditFood(item)}
                      className="p-2 hover:bg-blue-50 rounded-lg text-muted hover:text-blue-600 transition-colors"
                      title="Edit entry"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteFood(item.id)}
                      className="p-2 hover:bg-red-50 rounded-lg text-muted hover:text-red-600 transition-colors"
                      title="Delete entry"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}

              {/* Workouts */}
              {displayedWorkouts.map((workout) => (
                <div
                  key={workout.id}
                  className="p-4 flex justify-between items-center rounded-xl border border-purple-100 bg-purple-50/30 hover:border-purple-300 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600">
                        <path d="m13.73 4 2.54 2.54 2.54-2.54 2.54 2.54L18.81 9l2.54 2.54-2.54 2.54L16.27 11.54 13.73 14.08 11.19 11.54 8.65 14.08 6.11 11.54 3.57 14.08 1.03 11.54 3.57 9 1.03 6.46 3.57 3.92 6.11 6.46 8.65 3.92 11.19 6.46z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-main">{workout.type}</p>
                      <div className="flex gap-2 items-center mt-1">
                        <span className="text-xs text-muted">
                          {new Date(workout.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-xs text-purple-600 font-bold">-{workout.caloriesBurned} kcal</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEditWorkout(workout)}
                      className="p-2 hover:bg-purple-100 rounded-lg text-muted hover:text-purple-600 transition-colors"
                      title="Edit workout"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteWorkout(workout.id)}
                      className="p-2 hover:bg-red-50 rounded-lg text-muted hover:text-red-600 transition-colors"
                      title="Delete workout"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}

              {/* View All Button */}
              {!showAllLoggedItems && totalLoggedItems > 3 && (
                <button
                  onClick={() => setShowAllLoggedItems(true)}
                  className="w-full py-2 text-sm text-blue-600 hover:text-blue-700 font-medium hover:bg-blue-50 rounded-lg transition-colors"
                >
                  View All ({totalLoggedItems} total)
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit Food Modal */}
      {editingFoodItem && (
        <Portal>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4 py-4 animate-fade-in"
            onClick={handleCancelEditFood}
          >
            <div
              className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-emerald-50">
                <h3 className="font-normal text-2xl text-slate-900 font-serif">Edit Food Entry</h3>
                <button
                  onClick={handleCancelEditFood}
                  className="p-2 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Food Name</label>
                  <input
                    type="text"
                    value={editFoodName}
                    onChange={(e) => setEditFoodName(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                    placeholder="e.g. Apple"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Calories</label>
                  <input
                    type="number"
                    value={editFoodCalories}
                    onChange={(e) => setEditFoodCalories(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                  />
                </div>
              </div>
              <div className="p-6 pt-0 flex gap-3">
                <button
                  onClick={handleCancelEditFood}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditFood}
                  disabled={!editFoodName.trim() || !editFoodCalories}
                  className={`flex-1 py-3 font-bold rounded-xl transition-colors shadow-lg ${!editFoodName.trim() || !editFoodCalories
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
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

import React, { useState, useEffect } from 'react';
import { motion, PanInfo } from 'framer-motion';
import { DayPlan, DailyLog, FoodLogItem, WorkoutItem, AppView } from '../types';
import { Portal } from './Portal';

interface DualTrackSectionProps {
  todayPlan: DayPlan;
  dailyLog: DailyLog;
  lastAteTime?: number | null;
  onToggleMeal: (index: number) => void;
  onViewRecipe: (recipe: any) => void;
  onEditWorkout: (workout: WorkoutItem) => void;
  onDeleteWorkout: (workoutId: string) => void;
  onUpdateFoodItem: (item: FoodLogItem) => void;
  onDeleteFoodItem: (itemId: string) => void;
  onNavigate: (view: AppView) => void;
  onSwapMeal: (index: number) => void;
}

export const DualTrackSection: React.FC<DualTrackSectionProps> = ({
  todayPlan,
  dailyLog,
  lastAteTime,
  onToggleMeal,
  onViewRecipe,
  onEditWorkout,
  onDeleteWorkout,
  onUpdateFoodItem,
  onDeleteFoodItem,
  onNavigate,
  onSwapMeal
}) => {
  const [editingFoodItem, setEditingFoodItem] = useState<FoodLogItem | null>(null);
  const [editFoodName, setEditFoodName] = useState('');
  const [editFoodCalories, setEditFoodCalories] = useState('');
  const [showAllLoggedItems, setShowAllLoggedItems] = useState(false);
  const [timeSinceMeal, setTimeSinceMeal] = useState<string>('');

  useEffect(() => {
    if (!lastAteTime) {
      setTimeSinceMeal('');
      return;
    }

    const updateTime = () => {
      const now = Date.now();
      const diff = now - lastAteTime;

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff / (1000 * 60)) % 60);

      if (hours > 0) {
        setTimeSinceMeal(`${hours}h ${minutes}m`);
      } else {
        setTimeSinceMeal(`${minutes}m`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [lastAteTime]);

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
      {/* Left: From Your Plan */}
      <div className="bg-surface rounded-2xl shadow-sm border border-calories-border overflow-hidden">
        <div className="p-6 border-b border-calories-border bg-calories-bg/50 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--calories)' }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <h3 className="font-medium text-lg font-serif" style={{ color: 'var(--calories)' }}>From Your Plan</h3>
        </div>
        <div className="p-6 space-y-3 min-h-[200px]">
          {todayPlan.meals.length === 0 ? (
            <div className="p-8 text-center text-muted flex flex-col items-center justify-center h-full">
              <p className="font-medium mb-4">No meals planned for today</p>
              <button
                onClick={() => onNavigate(AppView.PLANNER)}
                className="px-6 py-3 text-white font-bold rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2"
                style={{ backgroundColor: 'var(--calories)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--calories-hover)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--calories)'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Plan My Day
              </button>
            </div>
          ) : (
            todayPlan.meals.map((meal, index) => {
              const isCompleted = todayPlan.completedMealIds.includes(meal.id);

              // Only apply swipe gestures to uncompleted meals
              if (isCompleted) {
                return (
                  <div
                    key={index}
                    onClick={() => onViewRecipe(meal)}
                    className="p-4 flex items-center gap-4 rounded-xl border transition-all cursor-pointer bg-calories-bg/50 border-calories-border opacity-70"
                  >
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleMeal(index);
                      }}
                      className="w-6 h-6 rounded-full border flex items-center justify-center transition-all flex-shrink-0 cursor-pointer text-white"
                      style={{ backgroundColor: 'var(--calories)', borderColor: 'var(--calories)' }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate line-through" style={{ color: 'var(--calories)' }}>
                        {meal.name}
                      </p>
                      <div className="flex gap-2 items-center mt-1">
                        <span className="text-[10px] font-bold bg-calories-bg px-1.5 py-0.5 rounded uppercase tracking-wide" style={{ color: 'var(--calories)' }}>
                          {meal.type}
                        </span>
                        <span className="text-xs text-muted">{meal.calories} kcal</span>
                      </div>
                    </div>
                  </div>
                );
              }

              // Swipeable card for uncompleted meals
              return (
                <motion.div
                  key={index}
                  drag="x"
                  dragConstraints={{ left: -80, right: 0 }}
                  dragElastic={0.2}
                  dragDirectionLock
                  className="relative touch-pan-y"
                  whileDrag={{ scale: 0.98 }}
                  onDragEnd={(event, info: PanInfo) => {
                    if (info.offset.x < -50) {
                      onToggleMeal(index);
                    }
                  }}
                >
                  {/* Background indicator (visible during drag) */}
                  <div className="absolute inset-y-0 right-0 w-20 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--calories)' }}>
                    <svg className="w-6 h-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>

                  {/* Meal card content */}
                  <div
                    onClick={() => onViewRecipe(meal)}
                    className="relative z-10 p-4 flex items-center gap-4 rounded-xl border transition-all cursor-pointer bg-surface border-calories-border hover:shadow-sm group"
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--calories)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--calories-border)'}
                  >
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleMeal(index);
                      }}
                      className="w-6 h-6 rounded-full border flex items-center justify-center transition-all flex-shrink-0 cursor-pointer border-border"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--calories)';
                        e.currentTarget.style.backgroundColor = 'var(--calories-bg)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-main">
                        {meal.name}
                      </p>
                      <div className="flex gap-2 items-center mt-1">
                        <span className="text-[10px] font-bold bg-calories-bg px-1.5 py-0.5 rounded uppercase tracking-wide" style={{ color: 'var(--calories)' }}>
                          {meal.type}
                        </span>
                        <span className="text-xs text-muted">{meal.calories} kcal</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSwapMeal(index);
                        }}
                        className="p-2 rounded-lg text-muted transition-colors active:scale-95 hover:bg-surface hover:text-primary border border-transparent hover:border-border"
                        title="Swap meal"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                          <line x1="12" y1="22.08" x2="12" y2="12"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Right: Your Log */}
      <div className="bg-surface rounded-2xl shadow-sm border border-calories-border overflow-hidden">
        <div className="p-6 border-b border-calories-border bg-calories-bg/50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
              <path d="M290,32H144A64.07,64.07,0,0,0,80,96V416a64.07,64.07,0,0,0,64,64H290Z" />
              <path d="M368,32H350V480h18a64.07,64.07,0,0,0,64-64V96A64.07,64.07,0,0,0,368,32Z" />
            </svg>
            <h3 className="font-medium text-lg font-serif" style={{ color: 'var(--calories)' }}>Today's Log</h3>
          </div>
          <div className="flex items-center gap-3">
            {timeSinceMeal && (
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface border border-calories-border/50 text-xs font-medium text-muted">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>{timeSinceMeal} ago</span>
              </div>
            )}
            <span className="text-xs font-bold bg-surface px-2 py-1 rounded-full" style={{ color: 'var(--calories)' }}>
              {totalLoggedItems} {totalLoggedItems === 1 ? 'entry' : 'entries'}
            </span>
          </div>
        </div>
        <div className="p-6 space-y-3 min-h-[200px]">
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
                  className="p-4 flex justify-between items-center rounded-xl border border-border bg-surface hover:shadow-sm transition-all group"
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--calories-border)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div className="flex-1">
                    <p className="font-medium text-main">{item.name}</p>
                    <div className="flex gap-2 items-center mt-1">
                      <span className="text-xs text-muted">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-xs font-bold" style={{ color: 'var(--calories)' }}>{item.calories} kcal</span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleStartEditFood(item)}
                      className="p-2 rounded-lg text-muted transition-colors active:scale-95"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--calories-bg)';
                        e.currentTarget.style.color = 'var(--calories)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-muted)';
                      }}
                      title="Edit entry"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteFood(item.id)}
                      className="p-2 rounded-lg text-muted transition-colors active:scale-95"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--error-bg)';
                        e.currentTarget.style.color = 'var(--error)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-muted)';
                      }}
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
                  className="p-4 flex justify-between items-center rounded-xl border border-workout-border bg-workout-bg/30 hover:shadow-sm transition-all group"
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--workout)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--workout-border)'}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 bg-workout-bg rounded-full flex items-center justify-center flex-shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--workout)' }}>
                        <path d="m13.73 4 2.54 2.54 2.54-2.54 2.54 2.54L18.81 9l2.54 2.54-2.54 2.54L16.27 11.54 13.73 14.08 11.19 11.54 8.65 14.08 6.11 11.54 3.57 14.08 1.03 11.54 3.57 9 1.03 6.46 3.57 3.92 6.11 6.46 8.65 3.92 11.19 6.46z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-main">{workout.type}</p>
                      <div className="flex gap-2 items-center mt-1">
                        <span className="text-xs text-muted">
                          {new Date(workout.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-xs font-bold" style={{ color: 'var(--workout)' }}>-{workout.caloriesBurned} kcal</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEditWorkout(workout)}
                      className="p-2 rounded-lg text-muted transition-colors active:scale-95"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--workout-bg)';
                        e.currentTarget.style.color = 'var(--workout)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-muted)';
                      }}
                      title="Edit workout"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteWorkout(workout.id)}
                      className="p-2 rounded-lg text-muted transition-colors active:scale-95"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'var(--error-bg)';
                        e.currentTarget.style.color = 'var(--error)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-muted)';
                      }}
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
                  className="w-full py-2 text-sm font-medium rounded-lg transition-colors"
                  style={{ color: 'var(--primary)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--primary-light)';
                    e.currentTarget.style.color = 'var(--primary-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--primary)';
                  }}
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
              className="bg-surface w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-border flex justify-between items-center bg-calories-bg">
                <h3 className="font-normal text-2xl text-main font-serif">Edit Food Entry</h3>
                <button
                  onClick={handleCancelEditFood}
                  className="p-2 bg-surface border border-border rounded-full text-muted hover:text-main transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-main mb-2">Food Name</label>
                  <input
                    type="text"
                    value={editFoodName}
                    onChange={(e) => setEditFoodName(e.target.value)}
                    className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-main"
                    placeholder="e.g. Apple"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-main mb-2">Calories</label>
                  <input
                    type="number"
                    value={editFoodCalories}
                    onChange={(e) => setEditFoodCalories(e.target.value)}
                    className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-main"
                  />
                </div>
              </div>
              <div className="p-6 pt-0 flex gap-3">
                <button
                  onClick={handleCancelEditFood}
                  className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 text-main font-bold rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditFood}
                  disabled={!editFoodName.trim() || !editFoodCalories}
                  className={`flex-1 py-3 font-bold rounded-xl transition-colors shadow-lg ${!editFoodName.trim() || !editFoodCalories
                    ? 'bg-neutral-300 dark:bg-neutral-800 text-muted cursor-not-allowed'
                    : 'text-white'
                    }`}
                  style={!editFoodName.trim() || !editFoodCalories ? {} : { backgroundColor: 'var(--calories)' }}
                  onMouseEnter={(e) => {
                    if (editFoodName.trim() && editFoodCalories) {
                      e.currentTarget.style.backgroundColor = 'var(--calories-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (editFoodName.trim() && editFoodCalories) {
                      e.currentTarget.style.backgroundColor = 'var(--calories)';
                    }
                  }}
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

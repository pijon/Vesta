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
  const [editFoodTime, setEditFoodTime] = useState('');
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

    // Format timestamp to HH:mm for input
    const date = new Date(item.timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    setEditFoodTime(`${hours}:${minutes}`);
  };

  const handleSaveEditFood = () => {
    if (!editingFoodItem || !editFoodName.trim() || !editFoodCalories || !editFoodTime) return;

    // Parse new time while keeping original date
    const originalDate = new Date(editingFoodItem.timestamp);
    const [hours, minutes] = editFoodTime.split(':').map(Number);
    originalDate.setHours(hours);
    originalDate.setMinutes(minutes);

    const updatedItem: FoodLogItem = {
      ...editingFoodItem,
      name: editFoodName,
      calories: parseInt(editFoodCalories) || 0,
      timestamp: originalDate.getTime()
    };

    onUpdateFoodItem(updatedItem);
    setEditingFoodItem(null);
    setEditFoodName('');
    setEditFoodCalories('');
    setEditFoodTime('');
  };

  const handleCancelEditFood = () => {
    setEditingFoodItem(null);
    setEditFoodName('');
    setEditFoodCalories('');
    setEditFoodTime('');
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
      <div className="glass-card rounded-organic-md flex flex-col h-full bg-charcoal/5 dark:bg-white/5 border border-white/50 dark:border-white/5 shadow-glass">
        <div className="px-6 py-5 border-b border-charcoal/5 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-calories-bg flex items-center justify-center text-hearth">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>
            <h3 className="font-serif text-lg text-charcoal dark:text-stone-200">From Your Plan</h3>
          </div>
          <button
            onClick={() => onNavigate(AppView.PLANNER)}
            className="text-xs font-bold uppercase tracking-wider text-charcoal/60 dark:text-stone-400 hover:text-hearth transition-colors px-2 py-1 hover:bg-charcoal/5 dark:hover:bg-white/10 rounded-lg"
          >
            View All
          </button>
        </div>
        <div className="p-6 space-y-3 min-h-[200px]">
          {todayPlan.meals.length === 0 ? (
            <div className="p-8 text-center text-charcoal/60 dark:text-stone-400 flex flex-col items-center justify-center h-full">
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
                    className="p-4 flex items-center gap-4 rounded-xl border border-transparent bg-charcoal/5 dark:bg-white/5 opacity-60 hover:opacity-100 transition-all cursor-pointer"
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
                      <p className="font-medium truncate line-through text-charcoal/60 dark:text-stone-400" style={{ color: 'var(--calories)' }}>
                        {meal.name}
                      </p>
                      <div className="flex gap-2 flex-wrap items-center mt-1">
                        <span className="text-xs font-bold text-charcoal/60 dark:text-stone-400 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                          {(meal.tags?.[0] || 'meal').toLowerCase()}
                        </span>
                        <span className="text-xs font-bold text-charcoal/60 dark:text-stone-400 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg>
                          {meal.calories} kcal
                        </span>
                        {meal.isLeftover && (
                          <span className="text-xs font-bold text-charcoal/60 dark:text-stone-400 flex items-center gap-1" title="Leftover from previous day">
                            <span className="text-[10px]">♻️</span> leftover
                          </span>
                        )}
                        {meal.isPacked && (
                          <span className="text-xs font-bold text-charcoal/60 dark:text-stone-400 flex items-center gap-1" title="Packed Lunch">
                            <svg width="12" height="12" viewBox="0 -0.5 17 17" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><g transform="translate(1.000000, 2.000000)"><rect x="0" y="0" width="16" height="2" /><path d="M1,10 C1,11.105 1.896,12 3,12 L13,12 C14.105,12 15,11.105 15,10 L15,3 L1,3 L1,10 L1,10 Z M5.98,4.959 L10.062,4.959 L10.062,6.063 L5.98,6.063 L5.98,4.959 L5.98,4.959 Z" /></g></svg>
                            packed
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              // Simple checklist card for uncompleted meals
              return (
                <div
                  key={index}
                  onClick={() => onViewRecipe(meal)}
                  className="relative z-10 p-4 flex items-center gap-4 rounded-xl border border-charcoal/5 dark:border-white/5 bg-charcoal/5 dark:bg-white/5 hover:bg-white/80 dark:hover:bg-white/10 hover:shadow-md hover:scale-[1.01] transition-all cursor-pointer group"
                >
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleMeal(index);
                    }}
                    className="w-6 h-6 rounded-full border flex items-center justify-center transition-all flex-shrink-0 cursor-pointer border-charcoal/20 dark:border-white/20 hover:scale-110 active:scale-95"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--calories)';
                      e.currentTarget.style.backgroundColor = 'var(--calories-bg)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-charcoal dark:text-stone-200">
                      {meal.name}
                    </p>
                    <div className="flex gap-2 flex-wrap items-center mt-1">
                      <span className="text-xs font-bold text-charcoal/60 dark:text-stone-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                        {(meal.tags?.[0] || 'meal').toLowerCase()}
                      </span>
                      <span className="text-xs font-bold text-charcoal/60 dark:text-stone-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg>
                        {meal.calories} kcal
                      </span>
                      {meal.isLeftover && (
                        <span className="text-xs font-bold text-charcoal/60 dark:text-stone-400 flex items-center gap-1" title="Leftover from previous day">
                          <span className="text-[10px]">♻️</span> leftover
                        </span>
                      )}
                      {meal.isPacked && (
                        <span className="text-xs font-bold text-charcoal/60 dark:text-stone-400 flex items-center gap-1" title="Packed Lunch">
                          <svg width="12" height="12" viewBox="0 -0.5 17 17" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><g transform="translate(1.000000, 2.000000)"><rect x="0" y="0" width="16" height="2" /><path d="M1,10 C1,11.105 1.896,12 3,12 L13,12 C14.105,12 15,11.105 15,10 L15,3 L1,3 L1,10 L1,10 Z M5.98,4.959 L10.062,4.959 L10.062,6.063 L5.98,6.063 L5.98,4.959 L5.98,4.959 Z" /></g></svg>
                          packed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSwapMeal(index);
                      }}
                      className="p-2 rounded-lg text-charcoal/60 dark:text-stone-400 transition-colors active:scale-95 hover:bg-charcoal/5 dark:hover:bg-white/10 hover:text-hearth border border-transparent hover:border-charcoal/10 dark:hover:border-white/10"
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
              );
            })
          )}
        </div>
      </div>

      {/* Right: Your Log */}
      <div className="glass-card rounded-organic-md flex flex-col h-full bg-charcoal/5 dark:bg-white/5 border border-white/50 dark:border-white/5 shadow-glass">
        <div className="px-6 py-5 border-b border-charcoal/5 dark:border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-calories-bg flex items-center justify-center text-hearth">
              <svg width="16" height="16" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                <path d="M290,32H144A64.07,64.07,0,0,0,80,96V416a64.07,64.07,0,0,0,64,64H290Z" />
                <path d="M368,32H350V480h18a64.07,64.07,0,0,0,64-64V96A64.07,64.07,0,0,0,368,32Z" />
              </svg>
            </div>
            <h3 className="font-serif text-lg text-charcoal dark:text-stone-200">Today's Log</h3>
          </div>
          <div className="flex items-center gap-3">
            {timeSinceMeal && (
              <span className="text-xs font-bold text-hearth bg-calories-bg px-2 py-1 rounded-md">
                {timeSinceMeal} ago
              </span>
            )}
            <span className="text-xs font-bold text-charcoal/60 dark:text-stone-400 bg-charcoal/5 dark:bg-white/10 px-2 py-1 rounded-md border border-charcoal/5 dark:border-white/10">
              {totalLoggedItems} {totalLoggedItems === 1 ? 'entry' : 'entries'}
            </span>
          </div>
        </div>
        <div className="p-6 space-y-3 min-h-[200px]">
          {sortedFoodItems.length === 0 && sortedWorkouts.length === 0 ? (
            <div className="p-8 text-center text-charcoal/60 dark:text-stone-400">
              <p>No items logged yet</p>
              <p className="text-xs mt-1">Use Quick Actions to log food or workouts</p>
            </div>
          ) : (
            <>
              {/* Food Items */}
              {displayedItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 flex gap-3 items-stretch rounded-xl border border-charcoal/5 dark:border-white/5 bg-charcoal/5 dark:bg-white/5 shadow-sm md:shadow-none hover:shadow-md transition-all group"
                >
                  <div className="w-8 h-8 rounded-full bg-calories-bg flex items-center justify-center flex-shrink-0 text-hearth mt-1">
                    <svg width="18" height="18" viewBox="0 -4.83 52 52" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><g transform="translate(-788.946 -1785.428)"><path d="M814.946,1793.095a24,24,0,0,0-24,24h48A24,24,0,0,0,814.946,1793.095Z" /><line x2="48" transform="translate(790.946 1825.761)" /><line y2="5.667" transform="translate(814.946 1787.428)" /></g></svg>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-charcoal dark:text-stone-200 truncate leading-tight">{item.name}</p>
                    </div>

                    <div className="flex justify-between items-end mt-1 gap-2">
                      <div className="flex gap-2 flex-wrap items-center">
                        <span className="text-xs text-charcoal/60 dark:text-stone-400">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-xs font-bold text-hearth">{item.calories} kcal</span>

                        {(item.type || item.tags?.[0]) && (
                          <span className="text-xs font-bold text-charcoal/60 dark:text-stone-400 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                            {(item.type || item.tags?.[0] || '').toLowerCase()}
                          </span>
                        )}

                        {item.isLeftover && (
                          <span className="text-xs font-bold text-charcoal/60 dark:text-stone-400 flex items-center gap-1" title="Leftover from previous day">
                            <span className="text-[10px]">♻️</span>
                          </span>
                        )}

                        {item.isPacked && (
                          <span className="text-xs font-bold text-charcoal/60 dark:text-stone-400 flex items-center gap-1" title="Packed Lunch">
                            <svg width="12" height="12" viewBox="0 -0.5 17 17" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><g transform="translate(1.000000, 2.000000)"><rect x="0" y="0" width="16" height="2" /><path d="M1,10 C1,11.105 1.896,12 3,12 L13,12 C14.105,12 15,11.105 15,10 L15,3 L1,3 L1,10 L1,10 Z M5.98,4.959 L10.062,4.959 L10.062,6.063 L5.98,6.063 L5.98,4.959 L5.98,4.959 Z" /></g></svg>
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleStartEditFood(item)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-charcoal/60 dark:text-stone-400 transition-colors active:scale-95 hover:bg-charcoal/5 dark:hover:bg-white/10"
                          title="Edit entry"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteFood(item.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-charcoal/60 dark:text-stone-400 transition-colors active:scale-95 hover:bg-error-bg hover:text-error"
                          title="Delete entry"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Workouts */}
              {displayedWorkouts.map((workout) => (
                <div
                  key={workout.id}
                  className="p-4 flex gap-3 items-stretch rounded-xl border border-charcoal/5 dark:border-white/5 bg-charcoal/5 dark:bg-white/5 shadow-sm md:shadow-none hover:shadow-md transition-all group"
                >
                  <div className="w-8 h-8 bg-workout-bg rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 32 32" fill="currentColor" stroke="none" style={{ color: 'var(--workout)' }}>
                      <path d="M24,13.5V10c0-4.4-3.6-8-8-8s-8,3.6-8,8v3.5c-1.9,2-3,4.6-3,7.5c0,3.5,1.6,6.7,4.4,8.8C9.6,29.9,9.8,30,10,30h12
    c0.2,0,0.4-0.1,0.6-0.2c2.8-2.1,4.4-5.3,4.4-8.8C27,18.1,25.9,15.4,24,13.5z M10,11.8V10c0-3.3,2.7-6,6-6s6,2.7,6,6v1.8
    c-1.7-1.1-3.8-1.8-6-1.8S11.7,10.7,10,11.8z M22,20.1c-0.1,0-0.2,0-0.3,0c-0.4,0-0.8-0.3-1-0.7c-0.3-1.1-1.1-2-2-2.6
    c-0.5-0.3-0.6-0.9-0.3-1.4c0.3-0.5,0.9-0.6,1.4-0.3c1.3,0.9,2.3,2.2,2.8,3.7C22.8,19.4,22.5,19.9,22,20.1z"/>
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-charcoal dark:text-stone-200">{workout.type}</p>
                    </div>

                    <div className="flex justify-between items-end mt-1 gap-2">
                      <div className="flex gap-2 items-center">
                        <span className="text-xs text-charcoal/60 dark:text-stone-400">
                          {new Date(workout.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-xs font-bold" style={{ color: 'var(--workout)' }}>-{workout.caloriesBurned} kcal</span>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onEditWorkout(workout)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-charcoal/60 dark:text-stone-400 transition-colors active:scale-95 hover:bg-charcoal/5 dark:hover:bg-white/10"
                          title="Edit workout"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9"></path>
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteWorkout(workout.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-charcoal/60 dark:text-stone-400 transition-colors active:scale-95 hover:bg-error-bg hover:text-error"
                          title="Delete workout"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
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
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 py-4 animate-fade-in"
            onClick={handleCancelEditFood}
          >
            <div
              className="bg-stone-50 dark:bg-[#1A1714] w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden border border-white/50 dark:border-white/5"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6 border-b border-charcoal/5 dark:border-white/5 flex justify-between items-center bg-charcoal/5 dark:bg-white/5">
                <h3 className="heading-3 text-charcoal dark:text-stone-200">Edit Food Entry</h3>
                <button
                  onClick={handleCancelEditFood}
                  className="p-2 bg-white/50 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-full text-charcoal/60 dark:text-stone-400 hover:text-charcoal dark:hover:text-stone-200 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-charcoal dark:text-stone-200 mb-2">Food Name</label>
                  <input
                    type="text"
                    value={editFoodName}
                    onChange={(e) => setEditFoodName(e.target.value)}
                    className="w-full input bg-charcoal/5 dark:bg-white/5 border-transparent text-charcoal dark:text-stone-200 placeholder-charcoal/40 dark:placeholder-stone-600"
                    placeholder="e.g. Apple"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-charcoal dark:text-stone-200 mb-2">Calories</label>
                  <input
                    type="number"
                    value={editFoodCalories}
                    onChange={(e) => setEditFoodCalories(e.target.value)}
                    className="w-full input bg-charcoal/5 dark:bg-white/5 border-transparent text-charcoal dark:text-stone-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-charcoal dark:text-stone-200 mb-2">Time Eaten</label>
                  <input
                    type="time"
                    value={editFoodTime}
                    onChange={(e) => setEditFoodTime(e.target.value)}
                    className="w-full input bg-charcoal/5 dark:bg-white/5 border-transparent text-charcoal dark:text-stone-200"
                  />
                </div>
              </div>
              <div className="p-6 pt-0 flex gap-3">
                <button
                  onClick={handleCancelEditFood}
                  className="flex-1 py-3 bg-white/50 dark:bg-white/5 text-charcoal dark:text-stone-200 font-bold rounded-2xl border border-white/20 dark:border-white/10 hover:bg-white dark:hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditFood}
                  disabled={!editFoodName.trim() || !editFoodCalories}
                  className={`flex-1 py-3 font-bold rounded-2xl transition-colors shadow-lg shadow-hearth/20 ${!editFoodName.trim() || !editFoodCalories
                    ? 'bg-charcoal/10 text-charcoal/40 cursor-not-allowed shadow-none'
                    : 'bg-hearth text-white hover:bg-hearth/90'
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

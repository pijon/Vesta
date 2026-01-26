import React, { useState } from 'react';
import { DayPlan, UserStats, DailyLog, Recipe, FoodLogItem, WorkoutItem, FastingState, FastingConfig, AppView } from '../types';
import { TrackToday } from './TrackToday';
import { TrackTrends } from './TrackTrends';
import { TrackWeek } from './TrackWeek';

interface TrackProps {
  todayPlan: DayPlan;
  tomorrowPlan: DayPlan;
  stats: UserStats;
  dailyLog: DailyLog;
  fastingState: FastingState;
  onUpdateStats: (stats: UserStats) => void;
  onLogMeal: (meal: Recipe, isAdding: boolean) => void;
  onAddFoodLogItems: (items: FoodLogItem[]) => void;
  onUpdateFoodItem: (item: FoodLogItem) => void;
  onDeleteFoodItem: (itemId: string) => void;
  onAddWorkout: (workout: WorkoutItem) => void;
  onUpdateWorkout: (workout: WorkoutItem) => void;
  onDeleteWorkout: (workoutId: string) => void;
  onStartFast: () => void;
  onEndFast: () => void;
  onUpdateFastingConfig: (config: FastingConfig) => void;
  refreshData: () => void;
  onNavigate: (view: AppView) => void;
}

type TabType = 'today' | 'trends' | 'week';

export const Track: React.FC<TrackProps> = (props) => {
  const [activeTab, setActiveTab] = useState<TabType>('today');

  return (
    <div className="min-h-screen">
      {/* Tab Navigation */}
      <div className="bg-white dark:bg-white/5/95 backdrop-blur-sm border-b border-border sticky top-16 z-30 transition-all">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('today')}
              className={`px-6 py-3 font-medium transition-colors ${activeTab === 'today'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Today
            </button>
            <button
              onClick={() => setActiveTab('trends')}
              className={`px-6 py-3 font-medium transition-colors ${activeTab === 'trends'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Trends
            </button>
            <button
              onClick={() => setActiveTab('week')}
              className={`px-6 py-3 font-medium transition-colors ${activeTab === 'week'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {activeTab === 'today' && <TrackToday {...props} />}
        {activeTab === 'trends' && <TrackTrends {...props} />}
        {activeTab === 'week' && <TrackWeek {...props} />}
      </div>
    </div>
  );
};

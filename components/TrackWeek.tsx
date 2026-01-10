import React, { useEffect, useState } from 'react';
import { DayPlan, UserStats, DailyLog } from '../types';
import { getAllDailySummaries } from '../services/storageService';
import { WeeklySummary } from './WeeklySummary';
import { AnalyticsSummary } from './AnalyticsSummary';
import { analyzeWeightTrends, analyzeStreaks, getWeeklySummary } from '../utils/analytics';

interface TrackWeekProps {
  todayPlan: DayPlan;
  stats: UserStats;
  dailyLog: DailyLog;
}

export const TrackWeek: React.FC<TrackWeekProps> = ({ stats, dailyLog }) => {
  const [dailySummaries, setDailySummaries] = useState<any[]>([]);

  useEffect(() => {
    getAllDailySummaries().then(setDailySummaries);
  }, [dailyLog]);

  const weightAnalysis = analyzeWeightTrends(stats);
  const streakAnalysis = analyzeStreaks(dailySummaries, stats.dailyCalorieGoal);
  const weeklySummary = getWeeklySummary(dailySummaries, stats.dailyCalorieGoal);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-3xl font-serif font-bold text-slate-800 mb-1">Weekly Summary</h2>
        <p className="text-slate-600">Your progress over the last 7 days</p>
      </header>

      {/* Analytics Summary */}
      <AnalyticsSummary
        weightAnalysis={weightAnalysis}
        streakAnalysis={streakAnalysis}
        weeklySummary={weeklySummary}
      />

      {/* Weekly Summary Dashboard */}
      <WeeklySummary summaries={dailySummaries} />
    </div>
  );
};

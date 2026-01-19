import React from 'react';
import { motion } from 'framer-motion';
import { UserStats, DailyLog, DayPlan } from '../types';

interface MobileActionCardsProps {
  stats: UserStats;
  dailyLog: DailyLog;
  todayPlan: DayPlan;
  onOpenFoodModal: () => void;
  onAddWater: (amount: number) => void;
}

export const MobileActionCards: React.FC<MobileActionCardsProps> = ({
  stats,
  dailyLog,
  todayPlan,
  onOpenFoodModal,
  onAddWater
}) => {
  // Calculate key metrics
  const consumed = (dailyLog.items || []).reduce((sum, item) => sum + item.calories, 0);
  const isNonFastDay = todayPlan.type === 'non-fast';
  const dailyTarget = isNonFastDay ? (stats.nonFastDayCalories || 2000) : stats.dailyCalorieGoal;
  const caloriesLeft = dailyTarget - consumed;
  const caloriePercentage = Math.min(100, (consumed / dailyTarget) * 100);

  const hydration = dailyLog.waterIntake || 0;
  const hydrationGoal = stats.dailyWaterGoal || 2000;
  const hydrationPercentage = Math.min(100, (hydration / hydrationGoal) * 100);

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Food Card - Primary Action */}
      <button
        onClick={onOpenFoodModal}
        className="bg-surface rounded-2xl shadow-sm border border-calories-border p-4 text-left active:scale-[0.98] transition-transform"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 1125.628 1125.628" fill="white">
              <g>
                <path d="M562.812,0.002C252.476,0.002,0,252.479,0,562.814s252.476,562.812,562.812,562.812 c310.34,0,562.817-252.476,562.817-562.812S873.152,0.002,562.812,0.002z M309.189,739.263l-68.974-101h-17.735v101h-70v-357h70 v203h15.889l57.901-93h77.963l-79.808,111.736l92.036,135.264H309.189z M468.184,672.88c7.299,13.589,20.325,20.382,38.317,20.382 c11.995,0,21.792-3.329,29.023-10.286c7.226-6.952,11.026-14.712,11.026-27.712h61.131l0.69,1.237 c0.612,25.224-8.88,46.258-28.489,63.246c-19.605,16.997-43.942,25.452-73.007,25.452c-37.218,0-65.962-11.781-86.11-35.309 c-20.144-23.529-30.283-53.763-30.283-90.671v-6.925c0-36.753,10.102-66.968,30.169-90.652 c20.071-23.68,48.745-35.524,85.958-35.524c30.76,0,55.57,8.766,74.412,26.297c18.833,17.531,27.954,41.73,27.342,70.334 l-0.453,2.516H546.55c0-14-3.54-24.775-10.611-33.312c-7.075-8.533-16.837-13.365-29.298-13.365 c-17.837,0-31.158,6.628-38.457,20.446c-7.308,13.818-11.703,31.349-11.703,53.151v6.911 C456.481,641.362,460.876,659.29,468.184,672.88z M793.142,739.263c-2.462-4-4.582-11.157-6.345-17.465 c-1.772-6.304-3.038-12.499-3.805-19.113c-6.925,12.15-16.033,22.354-27.338,30.348c-11.301,7.998-24.798,12.061-40.484,12.061 c-26.141,0-46.285-6.691-60.432-20.148c-14.151-13.457-21.222-31.78-21.222-54.998c0-24.456,9.414-43.221,28.256-56.683 c18.833-13.452,46.327-20.003,82.467-20.003h39.242v-20.18c0-11.995-3.974-21.3-10.282-27.914 c-6.303-6.609-16.019-9.917-28.32-9.917c-10.922,0-19.545,2.65-25.465,7.957c-5.92,5.303-8.982,12.648-8.982,22.026l-65.101-0.228 l-0.259-1.384c-1.073-21.066,8.063-39.251,27.44-54.553c19.377-15.302,44.822-22.953,76.349-22.953 c29.832,0,54.075,7.578,72.684,22.72c18.605,15.151,27.938,36.716,27.938,64.703v103.113c0,11.689,0.854,22.156,2.622,32.461 c1.768,10.3,4.55,21.149,8.396,30.149H793.142z M902.481,739.263v-357h70v357H902.481z" />
                <path d="M711.712,640.846c-7.382,7.153-11.072,16.229-11.072,26.379c0,8.304,2.768,15.211,8.304,20.285 c5.536,5.075,13.069,7.717,22.606,7.717c11.84,0,23.195-2.865,32.422-8.707c9.227-5.847,14.509-12.558,19.509-20.246v-37.012 h-39.242C729.933,629.263,719.093,633.698,711.712,640.846z" />
              </g>
            </svg>
          </div>
          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${isNonFastDay ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
            {isNonFastDay ? 'Non-Fast' : 'Fast'}
          </span>
        </div>

        {/* Main Value */}
        <div className="mb-2">
          <span className={`text-2xl font-bold font-serif ${caloriesLeft < 0 ? 'text-red-600 dark:text-red-400' : 'text-main'}`}>
            {Math.abs(caloriesLeft)}
          </span>
          <span className="text-xs text-muted ml-1">{caloriesLeft < 0 ? 'over' : 'left'}</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-neutral-100 dark:bg-white/10 h-1.5 rounded-full overflow-hidden mb-2">
          <motion.div
            className={`h-full rounded-full ${consumed > dailyTarget ? 'bg-red-500' : 'bg-gradient-to-r from-emerald-400 to-emerald-600'}`}
            initial={{ width: 0 }}
            animate={{ width: `${caloriePercentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted">{consumed} / {dailyTarget}</span>
          <span className="text-[10px] font-bold text-calories">Log Food</span>
        </div>
      </button>

      {/* Water Card - Primary Action */}
      <button
        onClick={() => onAddWater(250)}
        className="bg-surface rounded-2xl shadow-sm border border-water-border p-4 text-left active:scale-[0.98] transition-transform"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
            </svg>
          </div>
          <span className="text-[10px] font-bold text-white bg-water px-2 py-0.5 rounded-md">
            +250ml
          </span>
        </div>

        {/* Main Value */}
        <div className="mb-2">
          <span className="text-2xl font-bold font-serif text-main">
            {hydration >= 1000 ? `${(hydration / 1000).toFixed(1)}` : hydration}
          </span>
          <span className="text-xs text-muted ml-1">{hydration >= 1000 ? 'L' : 'ml'}</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-neutral-100 dark:bg-white/10 h-1.5 rounded-full overflow-hidden mb-2">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600"
            initial={{ width: 0 }}
            animate={{ width: `${hydrationPercentage}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted">{Math.round(hydrationPercentage)}% of goal</span>
          <span className="text-[10px] font-bold text-water">Tap to Add</span>
        </div>
      </button>
    </div>
  );
};

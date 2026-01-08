import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, BarChart, Bar } from 'recharts';
import { DayPlan, UserStats, Recipe, DailyLog } from '../types';
import { DAILY_CALORIE_LIMIT } from '../constants';
import { saveDayPlan, getAllDailySummaries } from '../services/storageService';
import { getCategoryColor } from '../utils';
import { Portal } from './Portal';

interface DashboardProps {
  todayPlan: DayPlan;
  tomorrowPlan: DayPlan;
  stats: UserStats;
  dailyLog: DailyLog;
  onUpdateStats: (stats: UserStats) => void;
  onLogMeal: (meal: Recipe, isAdding: boolean) => void;
  refreshData: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ todayPlan, tomorrowPlan, stats, dailyLog, onUpdateStats, onLogMeal, refreshData }) => {
  const [weightInput, setWeightInput] = useState(stats.currentWeight.toString());
  const [goalInput, setGoalInput] = useState(stats.goalWeight.toString());
  const [startInput, setStartInput] = useState(stats.startWeight.toString());
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [isEditingStart, setIsEditingStart] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  useEffect(() => {
    setWeightInput(stats.currentWeight.toString());
    setGoalInput(stats.goalWeight.toString());
    setStartInput(stats.startWeight.toString());
  }, [stats]);

  const toggleMeal = (mealIndex: number) => {
    const meal = todayPlan.meals[mealIndex];
    if (!meal) return;

    let newCompleted = [...todayPlan.completedMealIds];
    const uniqueId = meal.id; 
    let isAdding = false;
    
    if (newCompleted.includes(uniqueId)) {
        newCompleted = newCompleted.filter(id => id !== uniqueId);
        isAdding = false;
    } else {
        newCompleted.push(uniqueId);
        isAdding = true;
    }
    
    const updatedPlan = { ...todayPlan, completedMealIds: newCompleted };
    saveDayPlan(updatedPlan);
    
    // Sync with Journal
    onLogMeal(meal, isAdding);
    
    refreshData();
  };

  const consumed = todayPlan.meals
    .filter(m => todayPlan.completedMealIds.includes(m.id))
    .reduce((sum, m) => sum + m.calories, 0);

  const caloriesBurned = (dailyLog.workouts || []).reduce((sum, w) => sum + w.caloriesBurned, 0);
  const netCalories = consumed - caloriesBurned;
  const adjustedTarget = DAILY_CALORIE_LIMIT + caloriesBurned;

  const percentage = Math.min(100, (netCalories / DAILY_CALORIE_LIMIT) * 100);

  const handleSaveWeight = () => {
      const w = parseFloat(weightInput);
      if (w > 0) {
          onUpdateStats({ ...stats, currentWeight: w });
      }
  };

  const handleSaveGoal = () => {
      const g = parseFloat(goalInput);
      if (g > 0) {
          onUpdateStats({ ...stats, goalWeight: g });
          setIsEditingGoal(false);
      }
  };

  const handleSaveStart = () => {
      const s = parseFloat(startInput);
      if (s > 0) {
          onUpdateStats({ ...stats, startWeight: s });
          setIsEditingStart(false);
      }
  };

  const startWeight = stats.startWeight;
  const currentWeight = stats.currentWeight;
  const goalWeight = stats.goalWeight;
  
  const totalToLose = startWeight - goalWeight;
  const lostSoFar = startWeight - currentWeight;
  let progressPercent = 0;
  
  if (totalToLose > 0) {
     progressPercent = Math.max(0, Math.min(100, (lostSoFar / totalToLose) * 100));
  }

  let chartData = stats.weightHistory ? [...stats.weightHistory] : [];
  if (chartData.length === 0) {
      chartData.push({ date: new Date().toISOString().split('T')[0], weight: startWeight });
  }

  const formattedChartData = chartData.map(entry => ({
      ...entry,
      displayDate: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  // Get daily summaries for calorie and workout charts
  const dailySummaries = getAllDailySummaries();
  const formattedCalorieData = dailySummaries.map(entry => ({
      ...entry,
      displayDate: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  const formattedWorkoutData = dailySummaries
    .filter(entry => entry.workoutCount > 0)
    .map(entry => ({
      ...entry,
      displayDate: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }));

  return (
    <div className="space-y-8 animate-fade-in">
      <header>
          <h2 className="text-3xl font-normal text-slate-900 font-serif">Hello,</h2>
          <p className="text-slate-500 font-medium mt-1">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Calorie Card */}
          <div className="md:col-span-5 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between h-full">
             <div className="flex justify-between items-start mb-4">
                 <div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Net Calories</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-medium text-slate-900 font-serif">{netCalories}</span>
                        <span className="text-slate-400 font-medium">/ {DAILY_CALORIE_LIMIT}</span>
                    </div>
                    {caloriesBurned > 0 && (
                        <p className="text-xs text-purple-600 font-medium mt-1 flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m13.73 4 2.54 2.54 2.54-2.54 2.54 2.54L18.81 9l2.54 2.54-2.54 2.54L16.27 11.54 13.73 14.08 11.19 11.54 8.65 14.08 6.11 11.54 3.57 14.08 1.03 11.54 3.57 9 1.03 6.46 3.57 3.92 6.11 6.46 8.65 3.92 11.19 6.46z"/></svg>
                            {caloriesBurned} kcal burned • Can eat {adjustedTarget} kcal today
                        </p>
                    )}
                 </div>
                 <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 12h2a2 2 0 1 0 0-4h-2v4Z"/><path d="m16.7 13.4-.9-1.8c.8-1.1 1.2-2.5 1.2-4a7 7 0 0 0-7-7 7 7 0 0 0-7 7c0 1.5.4 2.9 1.2 4l-.9 1.8a2 2 0 0 0 2.6 2.6l1.8-.9c1.1.8 2.5 1.2 4 1.2s2.9-.4 4-1.2l1.8.9a2 2 0 0 0 2.6-2.6Z"/></svg>
                 </div>
             </div>
             <div>
                 <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ease-out ${netCalories > DAILY_CALORIE_LIMIT ? 'bg-red-400' : 'bg-emerald-500'}`} style={{width: `${percentage}%`}}></div>
                 </div>
                 <p className="text-xs text-slate-500 mt-3 font-medium flex gap-2 items-center">
                    {DAILY_CALORIE_LIMIT - netCalories > 0 ? `${DAILY_CALORIE_LIMIT - netCalories} net kcal remaining` : 'Limit reached'}
                 </p>
             </div>
          </div>
          
          {/* Weight Card */}
          <div className="md:col-span-7 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between h-full">
              <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Current Weight</p>
                      
                      {isEditingGoal ? (
                          <div className="mt-1 flex items-center gap-3 animate-fade-in">
                              <span className="text-sm text-slate-500">Goal:</span>
                              <input 
                                type="number" 
                                value={goalInput}
                                onChange={(e) => setGoalInput(e.target.value)}
                                className="w-24 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold focus:ring-1 focus:ring-emerald-500 outline-none"
                              />
                              <button onClick={handleSaveGoal} className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-emerald-700">Save</button>
                          </div>
                      ) : (
                          <div className="flex items-baseline gap-3">
                              <div className="relative group cursor-pointer">
                                  <input 
                                      type="number" 
                                      className="w-28 text-4xl font-medium text-slate-900 bg-transparent outline-none border-b border-transparent hover:border-slate-200 focus:border-emerald-500 p-0 transition-colors font-serif"
                                      value={weightInput}
                                      onChange={(e) => setWeightInput(e.target.value)}
                                      onBlur={handleSaveWeight}
                                      onKeyDown={(e) => e.key === 'Enter' && handleSaveWeight()}
                                  />
                                  <span className="absolute -top-4 left-0 text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none font-bold">Edit</span>
                              </div>
                              <span className="text-slate-400 font-medium text-lg">/ {goalWeight} kg goal</span>
                          </div>
                      )}
                  </div>
                  <button onClick={() => setIsEditingGoal(!isEditingGoal)} className="text-slate-300 hover:text-emerald-600 p-2 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                  </button>
              </div>

              <div>
                  <div className="flex justify-between items-end text-xs font-medium text-slate-400 mb-2">
                       <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-300">Start</span>
                            {isEditingStart ? (
                                <input 
                                    type="number"
                                    value={startInput}
                                    onChange={(e) => setStartInput(e.target.value)}
                                    onBlur={handleSaveStart}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveStart()}
                                    className="w-16 p-0.5 bg-slate-50 border border-emerald-500 rounded text-xs font-bold text-slate-900 outline-none"
                                    autoFocus
                                />
                            ) : (
                                <span 
                                    onClick={() => setIsEditingStart(true)} 
                                    className="cursor-pointer hover:text-emerald-600 border-b border-dashed border-slate-200 hover:border-emerald-300 transition-colors"
                                    title="Click to edit start weight"
                                >
                                    {startWeight} kg
                                </span>
                            )}
                       </div>
                       
                       <span className="text-emerald-600 mb-0.5 font-bold">
                            {Math.abs(startWeight - currentWeight).toFixed(1)} kg {startWeight >= currentWeight ? 'lost' : 'gained'}
                       </span>
                       
                       <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-300">Goal</span>
                            <span>{goalWeight} kg</span>
                       </div>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden relative">
                        <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000 ease-out" style={{width: `${progressPercent}%`}}></div>
                  </div>
              </div>
          </div>

          {/* Weight Trend Chart */}
          <div className="md:col-span-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-80">
              <h3 className="font-medium text-slate-900 mb-6 flex items-center gap-3 font-serif text-lg">
                 Weight Trend
              </h3>
              <div className="h-56 w-full">
               <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={formattedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                       <defs>
                           <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                               <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                               <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                           </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                       <XAxis
                           dataKey="displayDate"
                           axisLine={false}
                           tickLine={false}
                           tick={{fill: '#94A3B8', fontSize: 12, fontWeight: 500}}
                           dy={10}
                           minTickGap={30}
                       />
                       <YAxis
                           domain={['auto', 'auto']}
                           axisLine={false}
                           tickLine={false}
                           tick={{fill: '#94A3B8', fontSize: 12, fontWeight: 500}}
                           padding={{ top: 20, bottom: 20 }}
                       />
                       <Tooltip
                            contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#fff', color: '#0F172A', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', padding: '8px' }}
                            itemStyle={{ color: '#059669' }}
                            labelStyle={{ color: '#64748B', fontSize: '12px', marginBottom: '4px' }}
                       />
                       <Area
                           type="monotone"
                           dataKey="weight"
                           stroke="#10B981"
                           strokeWidth={2}
                           fillOpacity={1}
                           fill="url(#colorWeight)"
                           activeDot={{ r: 4, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
                       />
                   </AreaChart>
               </ResponsiveContainer>
              </div>
          </div>

          {/* Calorie Consumption Trend Chart */}
          <div className="md:col-span-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-80">
              <h3 className="font-medium text-slate-900 mb-6 flex items-center gap-3 font-serif text-lg">
                 Daily Calories
              </h3>
              {formattedCalorieData.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-slate-400 text-sm">
                  No calorie data yet. Start logging food!
                </div>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={formattedCalorieData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis
                              dataKey="displayDate"
                              axisLine={false}
                              tickLine={false}
                              tick={{fill: '#94A3B8', fontSize: 12, fontWeight: 500}}
                              dy={10}
                              minTickGap={30}
                          />
                          <YAxis
                              domain={[0, 'auto']}
                              axisLine={false}
                              tickLine={false}
                              tick={{fill: '#94A3B8', fontSize: 12, fontWeight: 500}}
                              padding={{ top: 20, bottom: 20 }}
                          />
                          <Tooltip
                              contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#fff', color: '#0F172A', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', padding: '8px' }}
                              labelStyle={{ color: '#64748B', fontSize: '12px', marginBottom: '4px' }}
                          />
                          <Line
                              type="monotone"
                              dataKey="caloriesConsumed"
                              stroke="#10B981"
                              strokeWidth={2}
                              dot={{ r: 3, fill: '#10B981', strokeWidth: 2 }}
                              activeDot={{ r: 5, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
                              name="Consumed"
                          />
                          <Line
                              type="monotone"
                              dataKey="netCalories"
                              stroke="#64748B"
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              dot={{ r: 3, fill: '#64748B', strokeWidth: 2 }}
                              activeDot={{ r: 5, fill: '#64748B', stroke: '#fff', strokeWidth: 2 }}
                              name="Net"
                          />
                      </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
          </div>

          {/* Workout Trend Chart */}
          <div className="md:col-span-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-80">
              <h3 className="font-medium text-slate-900 mb-6 flex items-center gap-3 font-serif text-lg">
                 Workout Activity
              </h3>
              {formattedWorkoutData.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-slate-400 text-sm">
                  No workout data yet. Start exercising!
                </div>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={formattedWorkoutData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis
                              dataKey="displayDate"
                              axisLine={false}
                              tickLine={false}
                              tick={{fill: '#94A3B8', fontSize: 12, fontWeight: 500}}
                              dy={10}
                              minTickGap={30}
                          />
                          <YAxis
                              domain={[0, 'auto']}
                              axisLine={false}
                              tickLine={false}
                              tick={{fill: '#94A3B8', fontSize: 12, fontWeight: 500}}
                              padding={{ top: 20, bottom: 20 }}
                          />
                          <Tooltip
                              contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: '#fff', color: '#0F172A', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', padding: '8px' }}
                              labelStyle={{ color: '#64748B', fontSize: '12px', marginBottom: '4px' }}
                          />
                          <Bar
                              dataKey="caloriesBurned"
                              fill="#9333EA"
                              radius={[8, 8, 0, 0]}
                              name="Calories Burned"
                          />
                      </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
          </div>

          {/* Tomorrow's Preview */}
          <div className="md:col-span-6 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-80">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="font-medium text-slate-900 font-serif text-lg">Tomorrow</h3>
                 <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                    {tomorrowPlan.meals.reduce((acc, m) => acc + m.calories, 0)} kcal
                 </span>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                 {tomorrowPlan.meals.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl bg-slate-50">
                        <p>No meals planned.</p>
                    </div>
                 ) : (
                    tomorrowPlan.meals.map((meal, index) => (
                        <div 
                            key={index} 
                            onClick={() => setSelectedRecipe(meal)}
                            className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:bg-slate-100 hover:border-emerald-300 transition-colors"
                        >
                             <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] uppercase shadow-sm ${getCategoryColor(meal.type).bg} ${getCategoryColor(meal.type).text}`}>
                                {meal.type.charAt(0)}
                             </div>
                             <div className="min-w-0">
                                 <p className="font-medium text-slate-900 text-sm truncate">{meal.name}</p>
                                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{meal.calories} kcal</p>
                             </div>
                        </div>
                    ))
                 )}
              </div>
          </div>

          {/* Today's Plan Checklist */}
          <div className="md:col-span-12 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-medium text-slate-900 text-lg font-serif">Today's Meals</h3>
                <span className="text-sm font-medium text-slate-500">{new Date().toLocaleDateString('en-US', {weekday: 'long'})}</span>
            </div>
            <div className="p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {todayPlan.meals.length === 0 ? (
                    <div className="col-span-full p-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                        <p className="mb-2">Nothing planned for today.</p>
                    </div>
                ) : (
                    todayPlan.meals.map((meal, index) => {
                        const isCompleted = todayPlan.completedMealIds.includes(meal.id);
                        return (
                            <div 
                                key={index} 
                                onClick={() => setSelectedRecipe(meal)}
                                className={`p-4 flex items-center justify-between rounded-xl border transition-all cursor-pointer group ${
                                    isCompleted 
                                    ? 'bg-slate-50 border-slate-200 opacity-60' 
                                    : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-sm'
                                }`}
                            >
                                 <div className="flex items-center gap-4 min-w-0">
                                    <div 
                                        onClick={(e) => { e.stopPropagation(); toggleMeal(index); }}
                                        className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all flex-shrink-0 cursor-pointer ${
                                        isCompleted 
                                        ? 'bg-emerald-500 border-emerald-500 text-white' 
                                        : 'border-slate-300 hover:border-emerald-500'
                                    }`}>
                                        {isCompleted && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`font-medium truncate ${isCompleted ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{meal.name}</p>
                                        <div className="flex gap-2 items-center mt-1">
                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wide">{meal.type}</span>
                                            <span className="text-xs text-slate-400">{meal.calories} kcal</span>
                                        </div>
                                    </div>
                                 </div>
                            </div>
                        );
                    })
                )}
            </div>
          </div>
      </div>

      {/* View Recipe Modal */}
      {selectedRecipe && (
        <Portal>
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-4 animate-fade-in bg-slate-900/50 backdrop-blur-sm" onClick={() => setSelectedRecipe(null)}>
            <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Category Header */}
                <div className={`relative h-48 md:h-64 flex-shrink-0 overflow-hidden ${getCategoryColor(selectedRecipe.type).bg}`}>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className={`text-9xl font-bold uppercase opacity-20 ${getCategoryColor(selectedRecipe.type).text}`}>
                            {selectedRecipe.type.charAt(0)}
                        </div>
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                    <button 
                        onClick={() => setSelectedRecipe(null)}
                        className="absolute top-6 right-6 bg-white/20 backdrop-blur-md p-2 rounded-full text-white hover:bg-white/40 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end">
                        <div>
                            <h2 className="text-3xl font-normal text-white mb-2 font-serif">{selectedRecipe.name}</h2>
                            <div className="flex gap-2">
                                <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-xs font-bold uppercase tracking-wider text-white border border-white/20">{selectedRecipe.type}</span>
                                <span className="px-3 py-1 bg-emerald-500 rounded-lg text-xs font-bold text-white">{selectedRecipe.calories} kcal</span>
                                <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-lg text-xs font-bold uppercase tracking-wider text-white border border-white/20">Serves {selectedRecipe.servings || 1}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Content */}
                <div className="p-6 space-y-6">
                    <div className="flex justify-start items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <div className="flex gap-6 text-sm w-full justify-around md:justify-start md:gap-12">
                                <div className="text-center"><p className="text-slate-400 text-xs uppercase font-bold">Protein</p><p className="font-bold text-slate-900 text-lg">{selectedRecipe.protein || 0}<span className="text-xs font-normal text-slate-400">g</span></p></div>
                                <div className="w-px h-auto bg-slate-200"></div>
                                <div className="text-center"><p className="text-slate-400 text-xs uppercase font-bold">Fat</p><p className="font-bold text-slate-900 text-lg">{selectedRecipe.fat || 0}<span className="text-xs font-normal text-slate-400">g</span></p></div>
                                <div className="w-px h-auto bg-slate-200"></div>
                                <div className="text-center"><p className="text-slate-400 text-xs uppercase font-bold">Carbs</p><p className="font-bold text-slate-900 text-lg">{selectedRecipe.carbs || 0}<span className="text-xs font-normal text-slate-400">g</span></p></div>
                            </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-10">
                        <div>
                            <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2 text-xl font-serif">
                                Ingredients
                            </h3>
                            <ul className="space-y-3">
                                {selectedRecipe.ingredients.map((ing, i) => (
                                    <li key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-sm text-slate-700 font-medium">
                                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
                                        <span className="leading-relaxed">{ing}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                            <div>
                            <h3 className="font-medium text-slate-900 mb-4 flex items-center gap-2 text-xl font-serif">
                                Instructions
                            </h3>
                            {selectedRecipe.instructions && selectedRecipe.instructions.length > 0 ? (
                                <div className="space-y-4">
                                    {selectedRecipe.instructions.map((step, i) => (
                                        <div key={i} className="flex gap-4">
                                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-xs font-bold flex items-center justify-center mt-0.5">{i+1}</span>
                                            <p className="text-slate-600 text-sm leading-relaxed">{step}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-slate-400 text-sm italic">No instructions provided.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
};
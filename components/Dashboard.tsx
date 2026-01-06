import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { DayPlan, UserStats } from '../types';
import { DAILY_CALORIE_LIMIT } from '../constants';
import { saveDayPlan } from '../services/storageService';

interface DashboardProps {
  todayPlan: DayPlan;
  tomorrowPlan: DayPlan;
  stats: UserStats;
  onUpdateStats: (stats: UserStats) => void;
  refreshData: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ todayPlan, tomorrowPlan, stats, onUpdateStats, refreshData }) => {
  const [weightInput, setWeightInput] = useState(stats.currentWeight.toString());
  const [goalInput, setGoalInput] = useState(stats.goalWeight.toString());
  const [isEditingGoal, setIsEditingGoal] = useState(false);

  useEffect(() => {
    setWeightInput(stats.currentWeight.toString());
    setGoalInput(stats.goalWeight.toString());
  }, [stats]);

  const toggleMeal = (mealIndex: number) => {
    const meal = todayPlan.meals[mealIndex];
    if (!meal) return;

    let newCompleted = [...todayPlan.completedMealIds];
    const uniqueId = meal.id; 
    
    if (newCompleted.includes(uniqueId)) {
        newCompleted = newCompleted.filter(id => id !== uniqueId);
    } else {
        newCompleted.push(uniqueId);
    }
    
    const updatedPlan = { ...todayPlan, completedMealIds: newCompleted };
    saveDayPlan(updatedPlan);
    refreshData();
  };

  const consumed = todayPlan.meals
    .filter(m => todayPlan.completedMealIds.includes(m.id))
    .reduce((sum, m) => sum + m.calories, 0);
  
  const percentage = Math.min(100, (consumed / DAILY_CALORIE_LIMIT) * 100);

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
             <div className="flex justify-between items-start mb-6">
                 <div>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Calories Consumed</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-medium text-slate-900 font-serif">{consumed}</span>
                        <span className="text-slate-400 font-medium">/ {DAILY_CALORIE_LIMIT}</span>
                    </div>
                 </div>
                 <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 12h2a2 2 0 1 0 0-4h-2v4Z"/><path d="m16.7 13.4-.9-1.8c.8-1.1 1.2-2.5 1.2-4a7 7 0 0 0-7-7 7 7 0 0 0-7 7c0 1.5.4 2.9 1.2 4l-.9 1.8a2 2 0 0 0 2.6 2.6l1.8-.9c1.1.8 2.5 1.2 4 1.2s2.9-.4 4-1.2l1.8.9a2 2 0 0 0 2.6-2.6Z"/></svg>
                 </div>
             </div>
             <div>
                 <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ease-out ${consumed > DAILY_CALORIE_LIMIT ? 'bg-red-400' : 'bg-emerald-500'}`} style={{width: `${percentage}%`}}></div>
                 </div>
                 <p className="text-xs text-slate-500 mt-3 font-medium flex gap-2 items-center">
                    {DAILY_CALORIE_LIMIT - consumed > 0 ? `${DAILY_CALORIE_LIMIT - consumed} kcal remaining` : 'Limit reached'}
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
                  <div className="flex justify-between items-center text-xs font-medium text-slate-400 mb-2">
                       <span>{startWeight} kg</span>
                       <span className="text-emerald-600">{Math.abs(startWeight - currentWeight).toFixed(1)} kg lost</span>
                       <span>{goalWeight} kg</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden relative">
                        <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000 ease-out" style={{width: `${progressPercent}%`}}></div>
                  </div>
              </div>
          </div>

          {/* Chart Section */}
          <div className="md:col-span-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-80">
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

          {/* Tomorrow's Preview */}
          <div className="md:col-span-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col h-80">
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
                        <div key={index} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                             <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-[10px] uppercase shadow-sm">
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
                                onClick={() => toggleMeal(index)}
                                className={`p-4 flex items-center justify-between rounded-xl border transition-all cursor-pointer group ${
                                    isCompleted 
                                    ? 'bg-slate-50 border-slate-200 opacity-60' 
                                    : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-sm'
                                }`}
                            >
                                 <div className="flex items-center gap-4 min-w-0">
                                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center transition-all flex-shrink-0 ${
                                        isCompleted 
                                        ? 'bg-emerald-500 border-emerald-500 text-white' 
                                        : 'border-slate-300 group-hover:border-emerald-500'
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
    </div>
  );
};
import React, { useState, useEffect } from 'react';
import { AppView, DayPlan, UserStats, DailyLog, FoodLogItem } from './types';
import { getDayPlan, getUserStats, saveUserStats, getDailyLog, saveDailyLog } from './services/storageService';
import { Dashboard } from './components/Dashboard';
import { Planner } from './components/Planner';
import { RecipeLibrary } from './components/RecipeLibrary';
import { ShoppingList } from './components/ShoppingList';
import { FoodLogger } from './components/FoodLogger';
import { APP_NAME, DEFAULT_USER_STATS } from './constants';

export const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [todayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [tomorrowDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });

  const [todayPlan, setTodayPlan] = useState<DayPlan>({ date: '', meals: [], completedMealIds: [] });
  const [tomorrowPlan, setTomorrowPlan] = useState<DayPlan>({ date: '', meals: [], completedMealIds: [] });
  
  const [userStats, setUserStatsState] = useState<UserStats>(() => {
    const stats = getUserStats();
    return { ...DEFAULT_USER_STATS, ...stats, weightHistory: stats.weightHistory || [] };
  });
  
  const [dailyLog, setDailyLog] = useState<DailyLog>({ date: '', items: [] });

  const refreshData = () => {
    setTodayPlan(getDayPlan(todayDate));
    setTomorrowPlan(getDayPlan(tomorrowDate));
    const stats = getUserStats();
    setUserStatsState({ ...DEFAULT_USER_STATS, ...stats, weightHistory: stats.weightHistory || [] });
    setDailyLog(getDailyLog(todayDate));
  };

  useEffect(() => {
    refreshData();
  }, [todayDate, tomorrowDate, view]);

  const handleUpdateStats = (newStats: UserStats) => {
    const today = new Date().toISOString().split('T')[0];
    let history = [...(newStats.weightHistory || [])];
    const existingIndex = history.findIndex(h => h.date === today);
    
    if (existingIndex >= 0) {
        history[existingIndex] = { date: today, weight: newStats.currentWeight };
    } else {
        history.push({ date: today, weight: newStats.currentWeight });
    }
    history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const finalStats = { ...newStats, weightHistory: history };
    setUserStatsState(finalStats);
    saveUserStats(finalStats);
  };

  const handleAddFoodLogItems = (items: FoodLogItem[]) => {
    const updatedLog: DailyLog = {
        ...dailyLog,
        items: [...dailyLog.items, ...items]
    };
    setDailyLog(updatedLog);
    saveDailyLog(updatedLog);
  };

  const handleUpdateWeight = (weight: number) => {
      handleUpdateStats({ ...userStats, currentWeight: weight });
  };

  const NavLink = ({ targetView, label }: { targetView: AppView, label: string }) => (
      <button 
        onClick={() => setView(targetView)} 
        className={`px-4 py-2 text-sm font-medium transition-all duration-200 rounded-lg ${
            view === targetView 
            ? 'bg-emerald-50 text-emerald-700' 
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
        }`}
      >
        {label}
      </button>
  );

  return (
    <div className="min-h-screen pb-24 md:pb-10 font-sans">
      
      {/* Top Navigation / Header */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => setView(AppView.DASHBOARD)}>
                 <div className="bg-emerald-600 text-white p-1.5 rounded-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L1 21h22L12 2zm0 3.5L18.5 19h-13L12 5.5z"/></svg>
                 </div>
                 <h1 className="text-xl font-medium tracking-tight text-slate-900 font-serif">{APP_NAME}</h1>
            </div>
            
            <div className="hidden md:flex items-center gap-2">
                <NavLink targetView={AppView.DASHBOARD} label="Dashboard" />
                <NavLink targetView={AppView.PLANNER} label="Planner" />
                <NavLink targetView={AppView.RECIPES} label="Recipes" />
                <NavLink targetView={AppView.SHOPPING} label="Shopping" />
                <NavLink targetView={AppView.JOURNAL} label="Journal" />
            </div>

            <div className="hidden md:block">
                <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold">
                    ME
                </div>
            </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto p-4 md:p-8">
        {view === AppView.DASHBOARD && (
            <Dashboard 
                todayPlan={todayPlan} 
                tomorrowPlan={tomorrowPlan}
                stats={userStats}
                onUpdateStats={handleUpdateStats}
                refreshData={refreshData}
            />
        )}
        {view === AppView.PLANNER && <Planner />}
        {view === AppView.RECIPES && <RecipeLibrary />}
        {view === AppView.SHOPPING && <ShoppingList />}
        {view === AppView.JOURNAL && (
            <FoodLogger 
                currentLog={dailyLog}
                onAddItems={handleAddFoodLogItems}
                onUpdateWeight={handleUpdateWeight}
                userStats={userStats}
            />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex justify-between z-50">
        <button onClick={() => setView(AppView.DASHBOARD)} className={`flex flex-col items-center gap-1 ${view === AppView.DASHBOARD ? 'text-emerald-600' : 'text-slate-400'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
            <span className="text-[10px] font-medium">Home</span>
        </button>
        <button onClick={() => setView(AppView.PLANNER)} className={`flex flex-col items-center gap-1 ${view === AppView.PLANNER ? 'text-emerald-600' : 'text-slate-400'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <span className="text-[10px] font-medium">Plan</span>
        </button>
        <button onClick={() => setView(AppView.RECIPES)} className={`flex flex-col items-center gap-1 ${view === AppView.RECIPES ? 'text-emerald-600' : 'text-slate-400'}`}>
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
           <span className="text-[10px] font-medium">Recipes</span>
        </button>
        <button onClick={() => setView(AppView.SHOPPING)} className={`flex flex-col items-center gap-1 ${view === AppView.SHOPPING ? 'text-emerald-600' : 'text-slate-400'}`}>
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
           <span className="text-[10px] font-medium">Shop</span>
        </button>
      </div>

    </div>
  );
};
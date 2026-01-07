import React, { useState, useEffect } from 'react';
import { AppView, DayPlan, UserStats, DailyLog, FoodLogItem, Recipe } from './types';
import { getDayPlan, getUserStats, saveUserStats, getDailyLog, saveDailyLog } from './services/storageService';
import { Dashboard } from './components/Dashboard';
import { Planner } from './components/Planner';
import { RecipeLibrary } from './components/RecipeLibrary';
import { ShoppingList } from './components/ShoppingList';
import { FoodLogger } from './components/FoodLogger';
import { APP_NAME, DEFAULT_USER_STATS } from './constants';

export const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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

  const handleUpdateFoodLogItem = (updatedItem: FoodLogItem) => {
    const currentLog = getDailyLog(todayDate);
    const updatedItems = currentLog.items.map(item => item.id === updatedItem.id ? updatedItem : item);
    const updatedLog = { ...currentLog, items: updatedItems };
    setDailyLog(updatedLog);
    saveDailyLog(updatedLog);
  };

  const handleDeleteFoodLogItem = (id: string) => {
    const currentLog = getDailyLog(todayDate);
    const updatedItems = currentLog.items.filter(item => item.id !== id);
    const updatedLog = { ...currentLog, items: updatedItems };
    setDailyLog(updatedLog);
    saveDailyLog(updatedLog);
  };

  const handleLogMeal = (meal: Recipe, isAdding: boolean) => {
    const currentLog = getDailyLog(todayDate);
    let newItems = [...currentLog.items];
    
    if (isAdding) {
        newItems.push({
            id: crypto.randomUUID(),
            name: meal.name,
            calories: meal.calories,
            timestamp: Date.now()
        });
    } else {
        // Find the last item that matches (assuming most recent action)
        for (let i = newItems.length - 1; i >= 0; i--) {
            if (newItems[i].name === meal.name && newItems[i].calories === meal.calories) {
                newItems.splice(i, 1);
                break;
            }
        }
    }
    
    const updatedLog = { ...currentLog, items: newItems };
    saveDailyLog(updatedLog);
    // State will be updated by refreshData called in Dashboard
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

  const SettingsModal = () => {
    const [formStats, setFormStats] = useState(userStats);

    const handleSave = () => {
        handleUpdateStats(formStats);
        setIsSettingsOpen(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setIsSettingsOpen(false)}>
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-normal text-2xl text-slate-900 font-serif">Settings</h3>
                     <button onClick={() => setIsSettingsOpen(false)} className="p-2 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div className="p-6 space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Starting Weight (kg)</label>
                        <input 
                            type="number" 
                            step="0.1"
                            value={formStats.startWeight}
                            onChange={(e) => setFormStats({...formStats, startWeight: parseFloat(e.target.value) || 0})}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                        />
                         <p className="text-xs text-slate-400 mt-1">Your weight when you began the diet.</p>
                    </div>
                     <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Current Weight (kg)</label>
                        <input 
                            type="number" 
                            step="0.1"
                            value={formStats.currentWeight}
                            onChange={(e) => setFormStats({...formStats, currentWeight: parseFloat(e.target.value) || 0})}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                        />
                    </div>
                     <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Goal Weight (kg)</label>
                        <input 
                            type="number" 
                            step="0.1"
                            value={formStats.goalWeight}
                            onChange={(e) => setFormStats({...formStats, goalWeight: parseFloat(e.target.value) || 0})}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Daily Calorie Target</label>
                        <input 
                            type="number" 
                            value={formStats.dailyCalorieGoal}
                            onChange={(e) => setFormStats({...formStats, dailyCalorieGoal: parseInt(e.target.value) || 0})}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                        />
                    </div>
                </div>
                <div className="p-6 pt-0">
                    <button onClick={handleSave} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-900/10">
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );
  };

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

            <div>
                <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="h-9 w-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold hover:bg-slate-200 transition-colors hover:text-emerald-700 hover:border-emerald-200"
                    title="Settings"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                </button>
            </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto p-4 md:p-8">
        {view === AppView.DASHBOARD && (
            <Dashboard 
                todayPlan={todayPlan} 
                tomorrowPlan={tomorrowPlan}
                dailyLog={dailyLog}
                stats={userStats}
                onUpdateStats={handleUpdateStats}
                refreshData={refreshData}
                onLogMeal={handleLogMeal}
            />
        )}
        {view === AppView.PLANNER && <Planner />}
        {view === AppView.RECIPES && <RecipeLibrary />}
        {view === AppView.SHOPPING && <ShoppingList />}
        {view === AppView.JOURNAL && (
            <FoodLogger 
                currentLog={dailyLog}
                onAddItems={handleAddFoodLogItems}
                onUpdateItem={handleUpdateFoodLogItem}
                onDeleteItem={handleDeleteFoodLogItem}
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

      {isSettingsOpen && <SettingsModal />}
    </div>
  );
};
import React, { useState, useEffect } from 'react';
import { AppView, DayPlan, UserStats } from './types';
import { getDayPlan, getUserStats, saveUserStats } from './services/storageService';
import { Dashboard } from './components/Dashboard';
import { Planner } from './components/Planner';
import { RecipeLibrary } from './components/RecipeLibrary';
import { ShoppingList } from './components/ShoppingList';
import { APP_NAME } from './constants';

export const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [todayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [todayPlan, setTodayPlan] = useState<DayPlan>({ date: '', meals: [], completedMealIds: [] });
  const [userStats, setUserStatsState] = useState<UserStats>(getUserStats());

  // Initialize data
  const refreshData = () => {
    setTodayPlan(getDayPlan(todayDate));
    setUserStatsState(getUserStats());
  };

  useEffect(() => {
    refreshData();
  }, [todayDate, view]); // Refresh when view changes to capture updates from Planner

  const handleUpdateWeight = (weight: number) => {
    const newStats = { ...userStats, currentWeight: weight };
    setUserStatsState(newStats);
    saveUserStats(newStats);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 md:pb-0 font-sans">
      
      {/* Top Navigation / Header */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
                 <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">8</div>
                 <h1 className="text-xl font-bold tracking-tight text-slate-800">{APP_NAME}</h1>
            </div>
            <div className="hidden md:flex gap-1 bg-slate-100 p-1 rounded-lg">
                <button onClick={() => setView(AppView.DASHBOARD)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === AppView.DASHBOARD ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Dashboard</button>
                <button onClick={() => setView(AppView.PLANNER)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === AppView.PLANNER ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Planner</button>
                <button onClick={() => setView(AppView.RECIPES)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === AppView.RECIPES ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Recipes</button>
                <button onClick={() => setView(AppView.SHOPPING)} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${view === AppView.SHOPPING ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Shopping</button>
            </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto p-4 md:p-6">
        {view === AppView.DASHBOARD && (
            <Dashboard 
                todayPlan={todayPlan} 
                stats={userStats}
                onWeightUpdate={handleUpdateWeight}
                refreshData={refreshData}
            />
        )}
        {view === AppView.PLANNER && <Planner />}
        {view === AppView.RECIPES && <RecipeLibrary />}
        {view === AppView.SHOPPING && <ShoppingList />}
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 flex justify-between z-50 safe-area-bottom">
        <button onClick={() => setView(AppView.DASHBOARD)} className={`flex flex-col items-center gap-1 w-16 ${view === AppView.DASHBOARD ? 'text-emerald-600' : 'text-slate-400'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
            <span className="text-[10px] font-medium">Dash</span>
        </button>
        <button onClick={() => setView(AppView.PLANNER)} className={`flex flex-col items-center gap-1 w-16 ${view === AppView.PLANNER ? 'text-emerald-600' : 'text-slate-400'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            <span className="text-[10px] font-medium">Plan</span>
        </button>
        <button onClick={() => setView(AppView.RECIPES)} className={`flex flex-col items-center gap-1 w-16 ${view === AppView.RECIPES ? 'text-emerald-600' : 'text-slate-400'}`}>
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
           <span className="text-[10px] font-medium">Recipes</span>
        </button>
        <button onClick={() => setView(AppView.SHOPPING)} className={`flex flex-col items-center gap-1 w-16 ${view === AppView.SHOPPING ? 'text-emerald-600' : 'text-slate-400'}`}>
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
           <span className="text-[10px] font-medium">Shop</span>
        </button>
      </div>

    </div>
  );
};
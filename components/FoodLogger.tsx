import React, { useState } from 'react';
import { FoodLogItem, DailyLog, UserStats } from '../types';
import { analyzeFoodLog } from '../services/geminiService';

interface FoodLoggerProps {
  currentLog: DailyLog;
  onAddItems: (items: FoodLogItem[]) => void;
  onUpdateItem: (item: FoodLogItem) => void;
  onDeleteItem: (id: string) => void;
  onUpdateWeight: (weight: number) => void;
  userStats: UserStats;
}

export const FoodLogger: React.FC<FoodLoggerProps> = ({ 
    currentLog, 
    onAddItems, 
    onUpdateItem, 
    onDeleteItem, 
    onUpdateWeight, 
    userStats 
}) => {
  const [input, setInput] = useState('');
  const [weightInput, setWeightInput] = useState(userStats.currentWeight.toString());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCalories, setEditCalories] = useState('');

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setIsAnalyzing(true);
    try {
      const items = await analyzeFoodLog(input);
      onAddItems(items);
      setInput('');
    } catch (error) {
      console.error(error);
      alert("Could not analyze food. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleWeightUpdate = () => {
      const w = parseFloat(weightInput);
      if(!isNaN(w) && w > 0) {
          onUpdateWeight(w);
      }
  };

  const startEditing = (item: FoodLogItem) => {
      setEditingId(item.id);
      setEditName(item.name);
      setEditCalories(item.calories.toString());
  };

  const cancelEditing = () => {
      setEditingId(null);
  };

  const saveEdit = (item: FoodLogItem) => {
      const updatedItem: FoodLogItem = {
          ...item,
          name: editName,
          calories: parseInt(editCalories) || 0
      };
      onUpdateItem(updatedItem);
      setEditingId(null);
  };

  const sortedItems = [...currentLog.items].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      <header>
        <h2 className="text-3xl font-normal text-slate-900 tracking-tight font-serif mb-1">Daily Journal</h2>
        <p className="text-slate-500 font-medium">Track what you eat to stay on target.</p>
      </header>

      {/* Quick Add Form */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <label className="block text-sm font-bold text-slate-700 mb-3">What did you eat?</label>
        <div className="flex gap-3">
            <input 
                type="text"
                className="flex-1 p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                placeholder="e.g. 1 apple and a handful of almonds"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            />
            <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !input.trim()}
                className={`px-6 rounded-xl font-bold text-white transition-all shadow-sm ${
                    isAnalyzing || !input.trim() ? 'bg-slate-300' : 'bg-slate-900 hover:bg-emerald-600'
                }`}
            >
                {isAnalyzing ? '...' : 'Add'}
            </button>
        </div>
        <p className="text-xs text-slate-400 mt-3 ml-1">AI will estimate calories automatically.</p>
      </div>

       {/* Weight Update */}
       <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
            <div>
                 <h3 className="font-semibold text-slate-900">Current Weight (kg)</h3>
                 <p className="text-xs text-slate-500">Update daily for best results</p>
            </div>
            <div className="flex gap-2">
                <input 
                    type="number" 
                    step="0.1"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-lg text-center font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
                 <button
                    onClick={handleWeightUpdate}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors text-sm"
                >
                    Save
                </button>
            </div>
       </div>

      {/* Log List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
            <h3 className="font-semibold text-slate-700">Today's Entries</h3>
            <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md">
                {currentLog.items.reduce((acc, i) => acc + i.calories, 0)} kcal
            </span>
        </div>
        {sortedItems.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
                No food logged today yet.
            </div>
        ) : (
            <ul className="divide-y divide-slate-100">
                {sortedItems.map((item) => (
                    <li key={item.id} className="p-5 hover:bg-slate-50 transition-colors group">
                        {editingId === item.id ? (
                            <div className="space-y-4 animate-fade-in">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <input 
                                        type="text"
                                        className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        autoFocus
                                    />
                                    <input 
                                        type="number"
                                        className="w-24 p-2 bg-white border border-slate-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none"
                                        value={editCalories}
                                        onChange={(e) => setEditCalories(e.target.value)}
                                    />
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button 
                                        onClick={() => onDeleteItem(item.id)}
                                        className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        Delete
                                    </button>
                                    <button 
                                        onClick={cancelEditing}
                                        className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={() => saveEdit(item)}
                                        className="px-4 py-1.5 text-xs font-bold bg-slate-900 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-4 flex-1">
                                    <div>
                                        <p className="font-medium text-slate-900 text-lg font-serif">{item.name}</p>
                                        <p className="text-xs text-slate-400 font-medium">{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                    </div>
                                    <button 
                                        onClick={() => startEditing(item)}
                                        className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-emerald-600 transition-all"
                                        title="Edit entry"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                    </button>
                                </div>
                                <span className="font-bold text-slate-900 text-lg">{item.calories} <span className="text-xs font-normal text-slate-400">kcal</span></span>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        )}
      </div>
    </div>
  );
};
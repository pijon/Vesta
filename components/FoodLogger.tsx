import React, { useState } from 'react';
import { FoodLogItem, DailyLog, UserStats } from '../types';
import { analyzeFoodLog } from '../services/geminiService';

interface FoodLoggerProps {
  currentLog: DailyLog;
  onAddItems: (items: FoodLogItem[]) => void;
  onUpdateWeight: (weight: number) => void;
  userStats: UserStats;
}

export const FoodLogger: React.FC<FoodLoggerProps> = ({ currentLog, onAddItems, onUpdateWeight, userStats }) => {
  const [input, setInput] = useState('');
  const [weightInput, setWeightInput] = useState(userStats.currentWeight.toString());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
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

  const sortedItems = [...currentLog.items].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      <header>
        <h2 className="text-4xl font-normal text-[#1F2823] tracking-tight font-serif mb-2">Daily Journal</h2>
        <p className="text-[#1F2823]/70 font-medium">Track what you eat to stay on target.</p>
      </header>

      {/* Quick Add Form - Dark Card */}
      <div className="bg-[#1F2823] p-8 rounded-3xl shadow-xl shadow-[#1F2823]/10 border border-[#2A362F]">
        <label className="block text-sm font-bold text-white mb-3">What did you eat?</label>
        <div className="flex gap-3">
            <input 
                type="text"
                className="flex-1 p-4 bg-[#2A362F] border border-[#3E4C43] rounded-xl text-white placeholder-[#52525B] focus:outline-none focus:ring-1 focus:ring-[#A3E635] transition-all"
                placeholder="e.g. 1 apple and a handful of almonds"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
            />
            <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !input.trim()}
                className={`px-8 rounded-xl font-bold text-[#1F2823] transition-all ${
                    isAnalyzing || !input.trim() ? 'bg-[#52525B]' : 'bg-[#A3E635] hover:bg-[#bef264]'
                }`}
            >
                {isAnalyzing ? '...' : 'Add'}
            </button>
        </div>
        <p className="text-xs text-[#9CA3AF] mt-3 ml-1">AI will estimate calories automatically.</p>
      </div>

       {/* Weight Update */}
       <div className="bg-white p-6 rounded-2xl shadow-sm border border-[#1F2823]/10 flex items-center justify-between">
            <div>
                 <h3 className="font-semibold text-[#1F2823]">Current Weight (kg)</h3>
                 <p className="text-xs text-[#1F2823]/60">Update daily for best results</p>
            </div>
            <div className="flex gap-2">
                <input 
                    type="number" 
                    step="0.1"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    className="w-24 p-2 bg-[#F6F8FA] border border-[#1F2823]/10 rounded-lg text-center font-bold text-[#1F2823]"
                />
                 <button
                    onClick={handleWeightUpdate}
                    className="px-4 py-2 bg-[#1F2823] hover:bg-[#1F2823]/90 text-white font-medium rounded-lg transition-colors text-sm"
                >
                    Save
                </button>
            </div>
       </div>

      {/* Log List */}
      <div className="bg-white rounded-3xl shadow-sm border border-[#1F2823]/10 overflow-hidden">
        <div className="p-5 border-b border-[#1F2823]/5 bg-[#F6F8FA] flex justify-between items-center">
            <h3 className="font-semibold text-[#1F2823]">Today's Entries</h3>
            <span className="text-sm font-bold text-[#1F2823] bg-[#A3E635] px-2 py-1 rounded-md">
                {currentLog.items.reduce((acc, i) => acc + i.calories, 0)} kcal
            </span>
        </div>
        {sortedItems.length === 0 ? (
            <div className="p-10 text-center text-[#1F2823]/40">
                No food logged today yet.
            </div>
        ) : (
            <ul className="divide-y divide-[#1F2823]/5">
                {sortedItems.map((item) => (
                    <li key={item.id} className="p-5 flex justify-between items-center hover:bg-[#F6F8FA] transition-colors">
                        <div>
                            <p className="font-medium text-[#1F2823] text-lg font-serif">{item.name}</p>
                            <p className="text-xs text-[#1F2823]/60 font-medium">{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                        </div>
                        <span className="font-bold text-[#1F2823] text-lg">{item.calories} <span className="text-xs font-normal text-[#1F2823]/50">kcal</span></span>
                    </li>
                ))}
            </ul>
        )}
      </div>
    </div>
  );
};
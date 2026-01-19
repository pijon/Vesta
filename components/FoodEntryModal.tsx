import React, { useState } from 'react';
import { FoodLogItem } from '../types';
import { analyzeFoodLog, analyzeFoodImage } from '../services/geminiService';
import { Portal } from './Portal';
import { ImageInput } from './ImageInput';
import { LoadingSpinner } from './LoadingSpinner';

interface FoodEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddItems: (items: FoodLogItem[]) => void;
}

export const FoodEntryModal: React.FC<FoodEntryModalProps> = ({ isOpen, onClose, onAddItems }) => {
  const [input, setInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // Manual Entry State
  const [tab, setTab] = useState<'ai' | 'manual'>('ai');
  const [manualName, setManualName] = useState('');
  const [manualCalories, setManualCalories] = useState('');

  const handleManualSubmit = () => {
    if (!manualName.trim() || !manualCalories) return;

    const kcal = parseInt(manualCalories);
    if (isNaN(kcal)) return;

    const newItem: FoodLogItem = {
      id: crypto.randomUUID(),
      name: manualName.trim(),
      calories: kcal,
      timestamp: Date.now()
    };

    onAddItems([newItem]);

    // Reset and close
    setManualName('');
    setManualCalories('');
    onClose();
  };

  const handleAnalyze = async () => {
    if (!input.trim()) return;
    setIsAnalyzing(true);
    try {
      const items = await analyzeFoodLog(input);
      onAddItems(items);
      setInput('');
      onClose();
    } catch (error) {
      console.error(error);
      alert("Could not analyze food. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImageAnalysis = async (base64: string, mimeType: string) => {
    setIsAnalyzingImage(true);
    setImageError(null);
    try {
      const items = await analyzeFoodImage(base64, mimeType);
      onAddItems(items);
      onClose();
    } catch (error) {
      console.error(error);
      setImageError("Could not analyze image. Please try again or use text entry.");
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const handleClose = () => {
    if (!isAnalyzing && !isAnalyzingImage) {
      setInput('');
      setImageError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-4 animate-fade-in"
        onClick={handleClose}
      >
        <div
          className="bg-surface w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 md:p-6 border-b border-border flex justify-between items-center bg-calories-bg">
            <h3 className="font-normal text-xl md:text-2xl text-main font-serif">Log Food</h3>
            <button
              onClick={handleClose}
              disabled={isAnalyzing || isAnalyzingImage}
              className="p-2 bg-surface/50 border border-border rounded-full text-muted hover:text-main transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Content */}
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setTab('ai')}
              className={`flex-1 py-3 text-sm font-bold transition-colors relative ${tab === 'ai' ? 'text-main' : 'text-muted hover:text-main'
                }`}
            >
              AI Assistant
              {tab === 'ai' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-calories" />
              )}
            </button>
            <button
              onClick={() => setTab('manual')}
              className={`flex-1 py-3 text-sm font-bold transition-colors relative ${tab === 'manual' ? 'text-main' : 'text-muted hover:text-main'
                }`}
            >
              Manual Entry
              {tab === 'manual' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-calories" />
              )}
            </button>
          </div>

          {/* Content */}
          <div className="p-4 md:p-6 space-y-4">
            {tab === 'ai' ? (
              <>
                {/* AI Text Input */}
                <div>
                  <label className="block text-sm font-bold text-main mb-3">What did you eat?</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      className="flex-1 p-3 bg-background border border-border rounded-xl focus:ring-2 outline-none font-medium text-main placeholder:text-muted"
                      style={{ focusRingColor: 'var(--calories)' }}
                      onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px var(--calories)'}
                      onBlur={(e) => e.target.style.boxShadow = 'none'}
                      placeholder="e.g. 1 apple and a handful of almonds"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                      disabled={isAnalyzing || isAnalyzingImage}
                    />
                    <button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || isAnalyzingImage || !input.trim()}
                      className={`px-6 py-3 font-bold rounded-xl transition-colors shadow-lg ${isAnalyzing || isAnalyzingImage || !input.trim()
                        ? 'bg-neutral-300 dark:bg-neutral-800 text-muted cursor-not-allowed'
                        : 'text-white'
                        }`}
                      style={isAnalyzing || isAnalyzingImage || !input.trim() ? {} : { backgroundColor: 'var(--calories)' }}
                      onMouseEnter={(e) => {
                        if (!isAnalyzing && !isAnalyzingImage && input.trim()) {
                          e.currentTarget.style.backgroundColor = 'var(--calories-hover)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isAnalyzing && !isAnalyzingImage && input.trim()) {
                          e.currentTarget.style.backgroundColor = 'var(--calories)';
                        }
                      }}
                    >
                      {isAnalyzing ? '...' : 'Add'}
                    </button>
                  </div>
                  <p className="text-xs text-muted mt-2 ml-1">AI will estimate calories from your description</p>
                </div>

                {/* OR Divider */}
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border"></div>
                  <span className="text-xs text-muted font-medium">OR</span>
                  <div className="h-px flex-1 bg-border"></div>
                </div>

                {/* Photo Input */}
                <div>
                  <ImageInput
                    onImageSelect={handleImageAnalysis}
                    onError={(err) => setImageError(err)}
                    disabled={isAnalyzing || isAnalyzingImage}
                  />
                  <p className="text-xs text-muted mt-2 ml-1">Upload a photo and AI will analyze it</p>
                </div>

                {/* Loading State */}
                {isAnalyzingImage && (
                  <div className="p-3 bg-calories-bg/50 border border-calories-border rounded-lg">
                    <p className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--calories)' }}>
                      <LoadingSpinner size="sm" style={{ color: 'var(--calories)' }} />
                      Analyzing photo...
                    </p>
                  </div>
                )}

                {/* Error State */}
                {imageError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-300">{imageError}</p>
                  </div>
                )}
              </>
            ) : (
              /* Manual Entry Form */
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-main mb-2">Item Name</label>
                  <input
                    type="text"
                    className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 outline-none font-medium text-main placeholder:text-muted"
                    onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px var(--calories)'}
                    onBlur={(e) => e.target.style.boxShadow = 'none'}
                    placeholder="e.g. Grilled Chicken Salad"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-main mb-2">Calories (kcal)</label>
                  <input
                    type="number"
                    className="w-full p-3 bg-background border border-border rounded-xl focus:ring-2 outline-none font-medium text-main placeholder:text-muted"
                    onFocus={(e) => e.target.style.boxShadow = '0 0 0 2px var(--calories)'}
                    onBlur={(e) => e.target.style.boxShadow = 'none'}
                    placeholder="e.g. 350"
                    value={manualCalories}
                    onChange={(e) => setManualCalories(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                  />
                </div>
                <button
                  onClick={handleManualSubmit}
                  disabled={!manualName.trim() || !manualCalories}
                  className={`w-full py-3 font-bold rounded-xl transition-colors shadow-lg ${!manualName.trim() || !manualCalories
                    ? 'bg-neutral-300 dark:bg-neutral-800 text-muted cursor-not-allowed'
                    : 'text-white'
                    }`}
                  style={!manualName.trim() || !manualCalories ? {} : { backgroundColor: 'var(--calories)' }}
                >
                  Add Entry
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 md:p-6 pt-0 border-t border-transparent">
            <button
              onClick={handleClose}
              disabled={isAnalyzing || isAnalyzingImage}
              className="w-full py-3 bg-background text-main font-bold rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-border"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

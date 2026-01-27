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
        className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/40 backdrop-blur-sm px-4 py-4 animate-fade-in"
        onClick={handleClose}
      >
        <div
          className="bg-[var(--background)] w-full max-w-lg rounded-3xl border border-border shadow-2xl overflow-hidden backdrop-blur-md"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 md:p-8 border-b border-border flex justify-between items-center bg-transparent">
            <h3 className="font-normal text-2xl md:text-3xl text-hearth font-serif">Log Food</h3>
            <button
              onClick={handleClose}
              disabled={isAnalyzing || isAnalyzingImage}
              className="p-2 bg-[var(--input-bg)] border border-transparent rounded-full text-muted hover:text-[var(--text-main)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Content */}
          {/* Tabs */}
          <div className="flex border-b border-border p-1 mx-6 mt-4 bg-[var(--input-bg)] rounded-xl">
            <button
              onClick={() => setTab('ai')}
              className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${tab === 'ai'
                ? 'bg-[var(--surface)] text-hearth shadow-sm'
                : 'text-muted hover:text-[var(--text-main)]'
                }`}
            >
              AI Assistant
            </button>
            <button
              onClick={() => setTab('manual')}
              className={`flex-1 py-1.5 text-sm font-bold rounded-lg transition-all ${tab === 'manual'
                ? 'bg-[var(--surface)] text-hearth shadow-sm'
                : 'text-muted hover:text-[var(--text-main)]'
                }`}
            >
              Manual Entry
            </button>
          </div>

          {/* Content */}
          <div className="p-4 md:p-6 space-y-4">
            {tab === 'ai' ? (
              <>
                {/* AI Text Input */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-2">What did you eat?</label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      className="flex-1 p-3 bg-[var(--input-bg)] border border-transparent focus:border-hearth/50 rounded-xl focus:ring-2 focus:ring-hearth/20 outline-none font-medium text-[var(--text-main)] placeholder:text-muted transition-all shadow-sm"
                      placeholder="e.g. 1 apple and a handful of almonds"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                      disabled={isAnalyzing || isAnalyzingImage}
                    />
                    <button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing || isAnalyzingImage || !input.trim()}
                      className={`px-6 py-3 font-bold rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95 ${isAnalyzing || isAnalyzingImage || !input.trim()
                        ? 'bg-[var(--input-bg)] text-muted cursor-not-allowed shadow-none'
                        : 'bg-hearth text-white'
                        }`}
                    >
                      {isAnalyzing ? '...' : 'Add'}
                    </button>
                  </div>
                  <p className="text-xs text-muted mt-2 ml-1">AI will estimate calories from your description</p>
                </div>

                {/* OR Divider */}
                <div className="flex items-center gap-3 py-2">
                  <div className="h-px flex-1 bg-border"></div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted">OR</span>
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
                  <div className="p-3 bg-error-bg border border-error-border rounded-lg">
                    <p className="text-sm text-error">{imageError}</p>
                  </div>
                )}
              </>
            ) : (
              /* Manual Entry Form */
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-2">Item Name</label>
                  <input
                    type="text"
                    className="w-full p-3 bg-[var(--input-bg)] border border-transparent focus:border-hearth/50 rounded-xl focus:ring-2 focus:ring-hearth/20 outline-none font-medium text-[var(--text-main)] placeholder:text-muted transition-all shadow-sm"
                    placeholder="e.g. Grilled Chicken Salad"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-2">Calories (kcal)</label>
                  <input
                    type="number"
                    className="w-full p-3 bg-[var(--input-bg)] border border-transparent focus:border-hearth/50 rounded-xl focus:ring-2 focus:ring-hearth/20 outline-none font-medium text-[var(--text-main)] placeholder:text-muted transition-all shadow-sm"
                    placeholder="e.g. 350"
                    value={manualCalories}
                    onChange={(e) => setManualCalories(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                  />
                </div>
                <button
                  onClick={handleManualSubmit}
                  disabled={!manualName.trim() || !manualCalories}
                  className={`w-full py-3 font-bold rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95 ${!manualName.trim() || !manualCalories
                    ? 'bg-[var(--input-bg)] text-muted cursor-not-allowed shadow-none'
                    : 'bg-hearth text-white'
                    }`}
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
              className="w-full py-3 bg-transparent text-muted font-bold rounded-xl hover:text-[var(--text-main)] hover:bg-[var(--input-bg)] transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-border"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

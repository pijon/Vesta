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
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4 py-4 animate-fade-in"
        onClick={handleClose}
      >
        <div
          className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-emerald-50">
            <h3 className="font-normal text-2xl text-slate-900 font-serif">Log Food</h3>
            <button
              onClick={handleClose}
              disabled={isAnalyzing || isAnalyzingImage}
              className="p-2 bg-white border border-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {/* Text Input */}
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-3">What did you eat?</label>
              <div className="flex gap-3">
                <input
                  type="text"
                  className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                  placeholder="e.g. 1 apple and a handful of almonds"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  disabled={isAnalyzing || isAnalyzingImage}
                />
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || isAnalyzingImage || !input.trim()}
                  className={`px-6 py-3 font-bold rounded-xl transition-colors shadow-lg ${
                    isAnalyzing || isAnalyzingImage || !input.trim()
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {isAnalyzing ? '...' : 'Add'}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2 ml-1">AI will estimate calories from your description</p>
            </div>

            {/* OR Divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-slate-200"></div>
              <span className="text-xs text-slate-400 font-medium">OR</span>
              <div className="h-px flex-1 bg-slate-200"></div>
            </div>

            {/* Photo Input */}
            <div>
              <ImageInput
                onImageSelect={handleImageAnalysis}
                onError={(err) => setImageError(err)}
                disabled={isAnalyzing || isAnalyzingImage}
              />
              <p className="text-xs text-slate-500 mt-2 ml-1">Upload a photo and AI will analyze it</p>
            </div>

            {/* Loading State */}
            {isAnalyzingImage && (
              <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg">
                <p className="text-sm text-emerald-700 font-medium flex items-center gap-2">
                  <LoadingSpinner size="sm" className="text-emerald-600" />
                  Analyzing photo...
                </p>
              </div>
            )}

            {/* Error State */}
            {imageError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
                <p className="text-sm text-red-700">{imageError}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 pt-0 border-t border-slate-100 bg-slate-50/50">
            <button
              onClick={handleClose}
              disabled={isAnalyzing || isAnalyzingImage}
              className="w-full py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

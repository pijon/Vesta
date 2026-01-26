import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Recipe } from '../types';

interface CookingModeProps {
    recipe: Recipe;
    onClose: () => void;
}

export const CookingMode: React.FC<CookingModeProps> = ({ recipe, onClose }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const instructions = recipe.instructions || [];

    return (
        <div className="fixed inset-0 z-[200] bg-stone flex flex-col h-full w-full overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center p-6 bg-white/50 backdrop-blur-md border-b border-white/20">
                <button onClick={onClose} className="p-2 rounded-full hover:bg-charcoal/5 text-charcoal/60 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
                <div className="bg-hearth/10 px-4 py-1.5 rounded-full">
                    <span className="text-xs font-black uppercase text-hearth tracking-widest">Cooking Mode</span>
                </div>
                <div className="w-10" /> {/* Spacer */}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center">
                <div className="max-w-2xl w-full space-y-8 pb-20">
                    <div className="text-center space-y-2">
                        <h2 className="text-3xl md:text-4xl font-serif text-charcoal">{recipe.name}</h2>
                        <div className="flex justify-center gap-4 text-sm font-bold text-charcoal/40 uppercase tracking-wide">
                            <span>Step {currentStep + 1} of {instructions.length}</span>
                            <span>•</span>
                            <span>{recipe.prepTime} min prep</span>
                        </div>
                    </div>

                    {/* Step Card */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-soft border border-white min-h-[300px] flex flex-col justify-center relative overflow-hidden"
                        >
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-hearth/5 blur-3xl rounded-full pointer-events-none"></div>
                            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-ocean/5 blur-3xl rounded-full pointer-events-none"></div>

                            <h3 className="text-6xl font-serif text-hearth/10 absolute top-6 left-8 select-none">
                                {currentStep + 1}
                            </h3>

                            <p className="text-xl md:text-2xl text-charcoal leading-relaxed relative z-10 font-medium font-serif">
                                {instructions[currentStep]}
                            </p>
                        </motion.div>
                    </AnimatePresence>

                    {/* Progress Bar */}
                    <div className="h-1 bg-charcoal/5 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-hearth"
                            initial={{ width: 0 }}
                            animate={{ width: `${((currentStep + 1) / instructions.length) * 100}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="p-6 bg-white/80 backdrop-blur-lg border-t border-white/20 md:pb-8">
                <div className="max-w-2xl mx-auto flex justify-between gap-4">
                    <button
                        onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                        disabled={currentStep === 0}
                        className={`flex-1 py-4 rounded-2xl font-bold text-lg transition-all ${currentStep === 0
                                ? 'bg-charcoal/5 text-charcoal/20 cursor-not-allowed'
                                : 'bg-white text-charcoal hover:bg-charcoal/5'
                            }`}
                    >
                        Previous
                    </button>
                    <button
                        onClick={() => {
                            if (currentStep < instructions.length - 1) {
                                setCurrentStep(currentStep + 1);
                            } else {
                                onClose();
                            }
                        }}
                        className="flex-[2] py-4 rounded-2xl bg-hearth text-white font-bold text-lg shadow-lg shadow-hearth/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        {currentStep === instructions.length - 1 ? 'Finish Cooking' : 'Next Step'}
                    </button>
                </div>
            </div>
        </div>
    );
};

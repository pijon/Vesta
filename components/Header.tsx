import React from 'react';
import { AppView } from '../types';

interface HeaderProps {
    title: string;
    subtitle?: string;
    isDarkMode: boolean;
    onToggleDarkMode: () => void;
    onNavigate: (view: AppView) => void;
}

export const Header: React.FC<HeaderProps> = ({
    title,
    subtitle,
    isDarkMode,
    onToggleDarkMode,
    onNavigate,
}) => {
    return (
        <div className="flex justify-between items-center mb-4">
            <div>
                <h1 className="text-4xl font-serif text-charcoal dark:text-stone-100 transition-colors">{title}</h1>
                {subtitle && (
                    <p className="text-charcoal/60 dark:text-stone-400 dark:text-stone-400 mt-1">{subtitle}</p>
                )}
            </div>
            <div className="flex gap-4 items-center">
                {/* Dark Mode Toggle */}
                <button
                    onClick={onToggleDarkMode}
                    className="w-10 h-10 rounded-full bg-white/50 dark:bg-white/10 border border-white/20 dark:border-white/5 flex items-center justify-center text-charcoal/60 dark:text-stone-400 hover:bg-white dark:hover:bg-white/20 hover:text-hearth transition-all shadow-sm"
                    title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                >
                    {isDarkMode ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                    )}
                </button>

                {/* Settings Button */}
                <button
                    onClick={() => onNavigate(AppView.SETTINGS)}
                    className="w-10 h-10 rounded-full bg-white/50 dark:bg-white/10 border border-white/20 dark:border-white/5 flex items-center justify-center text-charcoal/60 dark:text-stone-400 hover:bg-white dark:hover:bg-white/20 hover:text-hearth transition-all shadow-sm"
                    title="Settings"
                >
                    <svg width="20" height="20" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                        <path fillRule="evenodd" clipRule="evenodd" d="M3.5 2h-1v5h1V2zm6.1 5H6.4L6 6.45v-1L6.4 5h3.2l.4.5v1l-.4.5zm-5 3H1.4L1 9.5v-1l.4-.5h3.2l.4.5v1l-.4.5zm3.9-8h-1v2h1V2zm-1 6h1v6h-1V8zm-4 3h-1v3h1v-3zm7.9 0h3.19l.4-.5v-.95l-.4-.5H11.4l-.4.5v.95l.4.5zm2.1-9h-1v6h1V2zm-1 10h1v2h-1v-2z" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

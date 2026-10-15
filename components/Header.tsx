import React from 'react';
import { AppView } from '../types';
import { Sparkles, Moon, Sun, SlidersHorizontal } from 'lucide-react';

interface HeaderProps {
    title: string;
    subtitle?: string;
    /** A bigger title, for a greeting that stands in for it */
    large?: boolean;
    isDarkMode: boolean;
    onToggleDarkMode: () => void;
    onNavigate: (view: AppView) => void;
    showSundayReset?: boolean;
    onOpenSundayReset?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    title,
    subtitle,
    large,
    isDarkMode,
    onToggleDarkMode,
    onNavigate,
    showSundayReset,
    onOpenSundayReset,
}) => {
    return (
        <div className={`flex justify-between gap-4 mb-6 ${large ? 'items-start' : 'items-center'}`}>
            <div className="min-w-0">
                <h1 className={`font-display font-extrabold text-main ${large ? 'text-[40px] leading-[1] tracking-[-0.04em] md:text-5xl text-balance' : 'text-[32px] leading-9 tracking-tight'}`}>{title}</h1>
                {subtitle && (
                    <p className="text-sm text-muted mt-1">{subtitle}</p>
                )}
            </div>
            <div className="flex gap-2 items-center shrink-0">
                {showSundayReset && onOpenSundayReset && (
                    <button onClick={onOpenSundayReset} className="btn-accent btn-sm hidden md:inline-flex">
                        <Sparkles size={16} />
                        Sunday reset
                    </button>
                )}

                <button
                    onClick={onToggleDarkMode}
                    className="icon-btn"
                    aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                {/* Phones only: from md up, Settings is in the sidebar */}
                <button
                    onClick={() => onNavigate(AppView.SETTINGS)}
                    className="icon-btn md:hidden"
                    aria-label="Settings"
                >
                    <SlidersHorizontal size={20} />
                </button>
            </div>
        </div>
    );
};

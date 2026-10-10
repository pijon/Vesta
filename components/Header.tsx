import React from 'react';
import { AppView } from '../types';
import { Sparkles, Moon, Sun, SlidersHorizontal } from 'lucide-react';

interface HeaderProps {
    title: string;
    subtitle?: string;
    isDarkMode: boolean;
    onToggleDarkMode: () => void;
    onNavigate: (view: AppView) => void;
    showSundayReset?: boolean;
    onOpenSundayReset?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    title,
    subtitle,
    isDarkMode,
    onToggleDarkMode,
    onNavigate,
    showSundayReset,
    onOpenSundayReset,
}) => {
    return (
        <div className="flex justify-between items-center gap-4 mb-6">
            <div className="min-w-0">
                <h1 className="text-[32px] leading-9 font-display font-extrabold tracking-tight text-main">{title}</h1>
                {subtitle && (
                    <p className="text-sm text-muted mt-1">{subtitle}</p>
                )}
            </div>
            <div className="flex gap-2 items-center shrink-0">
                {showSundayReset && onOpenSundayReset && (
                    <span className="hidden md:block">
                        <button onClick={onOpenSundayReset} className="btn-accent btn-sm">
                            <Sparkles size={16} />
                            Sunday reset
                        </button>
                    </span>
                )}

                <button
                    onClick={onToggleDarkMode}
                    className="icon-btn"
                    aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                <button
                    onClick={() => onNavigate(AppView.SETTINGS)}
                    className="icon-btn"
                    aria-label="Settings"
                >
                    <SlidersHorizontal size={20} />
                </button>
            </div>
        </div>
    );
};

import React from 'react';
import { AppView, Avatar } from '../types';
import { MemberAvatar } from './MemberAvatar';
import { Sparkles, SlidersHorizontal } from 'lucide-react';

interface HeaderProps {
    title: string;
    subtitle?: string;
    onNavigate: (view: AppView) => void;
    /** The signed-in user, for their avatar (phones; from md up it's in the sidebar) */
    me?: { uid: string; name?: string; avatar?: Avatar };
    showSundayReset?: boolean;
    onOpenSundayReset?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    title,
    subtitle,
    onNavigate,
    me,
    showSundayReset,
    onOpenSundayReset,
}) => {
    return (
        <div className="flex justify-between items-center gap-4 mb-6">
            <div className="min-w-0">
                <h1 className="font-display font-extrabold text-main text-[32px] leading-9 tracking-tight">{title}</h1>
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

                {/* Phones only: from md up, you and Settings are in the sidebar */}
                {me?.uid && (
                    <button
                        onClick={() => onNavigate(AppView.FAMILY)}
                        className="md:hidden shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                        aria-label={me.name ? `${me.name}: your family` : 'Your family'}
                    >
                        <MemberAvatar avatar={me.avatar} uid={me.uid} />
                    </button>
                )}

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

import React from 'react';
import { AppView, Avatar } from '../types';
import { MemberAvatar } from './MemberAvatar';
import { SlidersHorizontal } from 'lucide-react';

interface HeaderProps {
    title: string;
    subtitle?: string;
    onNavigate: (view: AppView) => void;
    /** The signed-in user, for their avatar (with the tab bar; with the sidebar it's there) */
    me?: { uid: string; name?: string; avatar?: Avatar };
    /** On Settings, the avatar that leads there is left out */
    isSettings?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
    title,
    subtitle,
    onNavigate,
    me,
    isSettings,
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
                {/* With the tab bar only (the sidebar has its own): your avatar opens Settings, where
                    your account and goals are. Not on Settings itself. */}
                {me?.uid ? (
                    !isSettings && (
                        <button
                            onClick={() => onNavigate(AppView.SETTINGS)}
                            className="nav:hidden shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                            aria-label={`${me.name || 'You'}: settings`}
                        >
                            <MemberAvatar avatar={me.avatar} uid={me.uid} />
                        </button>
                    )
                ) : (
                    <button onClick={() => onNavigate(AppView.SETTINGS)} className="icon-btn nav:hidden" aria-label="Settings">
                        <SlidersHorizontal size={20} />
                    </button>
                )}
            </div>
        </div>
    );
};

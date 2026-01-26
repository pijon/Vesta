import React, { useState } from 'react';

interface AnalyticsSectionProps {
    title: string;
    children: React.ReactNode;
    mobileCollapsible?: boolean;
    defaultCollapsed?: boolean;
}

export const AnalyticsSection: React.FC<AnalyticsSectionProps> = ({
    title,
    children,
    mobileCollapsible = false,
    defaultCollapsed = false
}) => {
    const [isExpanded, setIsExpanded] = useState(!defaultCollapsed);

    // Check if we're on mobile (simplified version without hook)
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    if (mobileCollapsible && isMobile) {
        return (
            <div className="bg-[var(--card-bg)] backdrop-blur-md rounded-3xl border border-charcoal/10 dark:border-white/10 shadow-sm overflow-hidden">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full px-6 py-4 flex justify-between items-center hover:bg-black/5 transition-colors border-b border-transparent data-[expanded=true]:border-charcoal/10 dark:data-[expanded=true]:border-white/10"
                    aria-expanded={isExpanded}
                    data-expanded={isExpanded}
                >
                    <h3 className="font-normal text-charcoal dark:text-stone-200 text-lg font-serif">{title}</h3>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    >
                        <path d="m6 9 6 6 6-6" />
                    </svg>
                </button>
                {isExpanded && <div className="p-6 pt-6 border-t border-charcoal/10 dark:border-white/10">{children}</div>}
            </div >
        );
    }

    return (
        <div className="bg-[var(--card-bg)] backdrop-blur-md rounded-3xl border border-charcoal/10 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-charcoal/10 dark:border-white/10">
                <h3 className="font-normal text-charcoal dark:text-stone-200 font-serif text-lg">{title}</h3>
            </div>
            <div className="p-6 md:p-8">
                {children}
            </div>
        </div>
    );
};

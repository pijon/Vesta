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
            <div className="bg-surface rounded-3xl border border-border overflow-hidden shadow-sm">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full p-6 flex justify-between items-center hover:bg-background/50 transition-colors"
                    aria-expanded={isExpanded}
                >
                    <h3 className="font-medium text-main text-lg font-serif">{title}</h3>
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
                {isExpanded && <div className="p-6 pt-0">{children}</div>}
            </div>
        );
    }

    return (
        <div className="bg-surface p-8 rounded-3xl border border-border shadow-sm">
            <h3 className="font-medium text-main mb-6 font-serif text-lg">{title}</h3>
            {children}
        </div>
    );
};

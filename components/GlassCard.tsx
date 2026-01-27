import React from 'react';

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    interactive?: boolean;
    onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({
    children,
    className = '',
    interactive = false,
    onClick
}) => {
    return (
        <div
            onClick={onClick}
            className={`
                bg-white/40 dark:bg-white/5 backdrop-blur-md border border-white/60 dark:border-white/10 rounded-[2rem] p-6 shadow-sm
                ${interactive ? 'cursor-pointer hover:bg-white/60 dark:hover:bg-white/10 transition-all duration-300 hover:scale-[1.01] hover:shadow-md' : ''}
                ${className}
            `}
        >
            {children}
        </div>
    );
};

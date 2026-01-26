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
                glass-card rounded-[2rem] p-6 
                ${interactive ? 'cursor-pointer hover:bg-white/60 transition-all duration-300 hover:scale-[1.01]' : ''}
                ${className}
            `}
        >
            {children}
        </div>
    );
};

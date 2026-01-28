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
                glass-card rounded-3xl p-6
                ${interactive ? 'cursor-pointer hover:scale-[1.01] hover:shadow-md transition-all duration-300' : ''}
                ${className}
            `}
        >
            {children}
        </div>
    );
};

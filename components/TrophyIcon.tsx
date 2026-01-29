import React from 'react';

export const TrophyIcon: React.FC<{ className?: string }> = ({ className = "w-24 h-24" }) => (
    <svg
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeMiterlimit="10"
    >
        <path d="M22.786,6c0,0,0.715-1,2.214-1c1.377,0,3,1.05,3,3c0,3.21-5,4.242-5,8c0,0.982,1,1.993,1,1.993" />
        <path d="M8,17.993c0,0,1-1.011,1-1.993c0-3.758-5-4.79-5-8c0-1.95,1.623-3,3-3c1.498,0,2.214,1,2.214,1" />
        <path d="M9,6c0,6.528,3.689,17,6.983,17S23,12.568,23,6H9z" />
        <path d="M18,24h-4c-1.657,0-3,1.343-3,3v0h10v0C21,25.343,19.657,24,18,24z" />
        <line x1="16" y1="15" x2="16" y2="10" />
    </svg>
);

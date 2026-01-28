import React from 'react';
import { Sparkles } from 'lucide-react';
// SundayResetModal is now global in App.tsx

interface SundayResetWidgetProps {
    onOpen: () => void;
}

const SundayResetWidget: React.FC<SundayResetWidgetProps> = ({ onOpen }) => {
    // Only show if it's Sunday (Day 0)
    // For demo/debug purposes, we might want to relax this, but strictly per spec:
    const isSunday = new Date().getDay() === 0;

    // Optional: Also check if plan is empty for next week? 
    // For now, simple day check is safest "Nudge"

    if (!isSunday) return null;

    return (
        <div
            onClick={onOpen}
            className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 cursor-pointer border border-orange-200 hover:shadow-md transition-all group"
        >
            <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-orange-500 shadow-sm group-hover:scale-110 transition-transform">
                    <Sparkles size={24} />
                </div>
                <div>
                    <h3 className="text-lg font-serif font-bold text-orange-900">Sunday Reset</h3>
                    <p className="text-orange-700/80 text-sm">Plan your week & light the hearth.</p>
                </div>
            </div>
        </div>
    );
};

export default SundayResetWidget;

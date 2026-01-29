import React from 'react';
import { motion } from 'framer-motion';

/**
 * Lightweight skeleton for Suspense fallback during view transitions.
 * Unlike LoadingScreen, this is minimal and doesn't re-animate the full logo.
 */
export const ViewSkeleton: React.FC = () => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="max-w-6xl mx-auto px-4 pb-4 pt-0 md:px-8 md:pb-8 md:pt-0"
        >
            {/* Content skeleton */}
            <div className="space-y-6 animate-pulse">
                {/* Card skeleton 1 */}
                <div className="bg-charcoal/5 dark:bg-white/5 rounded-3xl h-48 md:h-56" />

                {/* Card skeleton 2 */}
                <div className="bg-charcoal/5 dark:bg-white/5 rounded-3xl h-32 md:h-40" />

                {/* Card skeleton 3 */}
                <div className="bg-charcoal/5 dark:bg-white/5 rounded-3xl h-24 md:h-32" />
            </div>
        </motion.div>
    );
};

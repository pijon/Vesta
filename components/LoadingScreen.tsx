import React from 'react';
import { motion } from 'framer-motion';

export const LoadingScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="flex flex-col items-center gap-6"
            >
                <div className="relative">
                    {/* Glow Effect */}
                    <motion.div
                        className="absolute inset-0 bg-primary/20 blur-3xl rounded-full"
                        animate={{
                            opacity: [0.5, 0.8, 0.5],
                            scale: [1, 1.2, 1],
                        }}
                        transition={{
                            duration: 3,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />


                    <motion.img
                        src="/resources/logo_light.png"
                        alt="Vesta Logo"
                        className="h-24 w-auto relative z-10 dark:hidden block"
                        animate={{
                            y: [0, -4, 0]
                        }}
                        transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />
                    <motion.img
                        src="/resources/logo_dark.png"
                        alt="Vesta Logo"
                        className="h-24 w-auto relative z-10 hidden dark:block"
                        animate={{
                            y: [0, -4, 0]
                        }}
                        transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-col items-center gap-2"
                >
                    <h2 className="text-xl font-serif text-main tracking-tight">Vesta</h2>
                    <p className="text-sm text-muted font-medium animate-pulse">Warming the Hearth...</p>
                </motion.div>
            </motion.div>
        </div>
    );
};

import React from 'react';
import { motion, useReducedMotion } from 'motion/react';

export const AudioVisualizer = ({ isListening }: { isListening: boolean }) => {
    const shouldReduceMotion = useReducedMotion();

    if (!isListening) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="flex items-center gap-2 px-1"
        >
            <div className="flex gap-1 items-end h-4">
                {[0, 1, 2].map(i => (
                    <motion.div
                        key={i}
                        animate={shouldReduceMotion ? { height: `${8 + i * 3}px` } : { height: ['4px', '16px', '4px'] }}
                        transition={shouldReduceMotion ? { duration: 0 } : {
                            repeat: Infinity,
                            duration: 0.8,
                            delay: i * 0.15,
                            ease: "easeInOut"
                        }}
                        className="w-1.5 bg-red-400 rounded-full"
                    />
                ))}
            </div>
            <span className="text-xs font-semibold text-red-500 animate-pulse tracking-wide">
                Mikrofon aktiv
            </span>
        </motion.div>
    );
};

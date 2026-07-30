import React, { useState, useEffect, useRef, useCallback } from 'react';

const MAX_PAUSE_SECONDS = 5 * 60; // 5 Minuten
type PauseReason = 'manual' | 'typing';

export interface UseExamTimerReturn {
    timeLeft: number;
    timerActive: boolean;
    timeWarning: boolean;
    timerActiveRef: React.MutableRefObject<boolean>;
    timeIsUpRef: React.MutableRefObject<boolean>;
    timeLeftRef: React.MutableRefObject<number>;
    startTimer: () => void;
    isPaused: boolean;
    pauseReason: PauseReason | null;
    pauseTimeLeft: number;
    pauseTimer: (reason?: PauseReason) => void;
    resumeTimer: (reason?: PauseReason) => void;
}

export const useExamTimer = (duration: number): UseExamTimerReturn => {
    const [timeLeft, setTimeLeft] = useState(duration * 60);
    const [timerActive, setTimerActive] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [pauseReason, setPauseReason] = useState<PauseReason | null>(null);
    const [pauseTimeLeft, setPauseTimeLeft] = useState(MAX_PAUSE_SECONDS);
    const timerActiveRef = useRef(false);
    const timeIsUpRef = useRef(false);
    // H2: mirror the pause-aware countdown so callers report the real remaining time
    // to the backend (wall-clock math would ignore pauses).
    const timeLeftRef = useRef(duration * 60);
    const isPausedRef = useRef(false);
    const pauseReasonRef = useRef<PauseReason | null>(null);

    useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

    // Main exam countdown
    useEffect(() => {
        const timer = setInterval(() => {
            if (!timerActiveRef.current || isPausedRef.current) return;
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    timeIsUpRef.current = true;
                    return 0;
                }
                if (prev <= 60) {
                    timeIsUpRef.current = true;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Pause countdown — auto-resume after MAX_PAUSE_SECONDS
    useEffect(() => {
        if (!isPaused) {
            setPauseTimeLeft(MAX_PAUSE_SECONDS);
            return;
        }
        const t = setInterval(() => {
            setPauseTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(t);
                    isPausedRef.current = false;
                    pauseReasonRef.current = null;
                    setIsPaused(false);
                    setPauseReason(null);
                    return MAX_PAUSE_SECONDS;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(t);
    }, [isPaused]);

    const startTimer = () => {
        timerActiveRef.current = true;
        setTimerActive(true);
    };

    const pauseTimer = useCallback((reason: PauseReason = 'manual') => {
        if (pauseReasonRef.current === 'manual' && reason === 'typing') return;
        isPausedRef.current = true;
        pauseReasonRef.current = reason;
        setIsPaused(true);
        setPauseReason(reason);
    }, []);

    const resumeTimer = useCallback((reason?: PauseReason) => {
        if (reason && pauseReasonRef.current !== reason) return;
        isPausedRef.current = false;
        pauseReasonRef.current = null;
        setIsPaused(false);
        setPauseReason(null);
    }, []);

    const timeWarning = timeLeft <= 120;

    return {
        timeLeft,
        timerActive,
        timeWarning,
        timerActiveRef,
        timeIsUpRef,
        timeLeftRef,
        startTimer,
        isPaused,
        pauseReason,
        pauseTimeLeft,
        pauseTimer,
        resumeTimer,
    };
};

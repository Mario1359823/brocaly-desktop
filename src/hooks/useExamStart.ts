import React, { useState, useRef, useEffect } from 'react';
import { examApi } from '../services/api';
import { User as UserType, Message, ExaminerConfig, ExamMode } from '../types';

export interface UseExamStartParams {
    subject: string;
    user: UserType;
    focusTopics?: string;
    excludedTopics?: string;
    duration: number;
    activeExaminer: ExaminerConfig;
    examMode: ExamMode;
    voiceMode: boolean;
    speak: (text: string) => void;
    onError: (msg: string) => void;
    startTimer: () => void;
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
    stopSpeaking: () => void;
    stopListening: () => void;
    doneIds?: string[];
    endIds?: string[];
    onCaseId?: (caseId: string, totalCases: number) => void;
}

export interface UseExamStartReturn {
    isPrologPlaying: boolean;
    setIsPrologPlaying: React.Dispatch<React.SetStateAction<boolean>>;
    prologAudioRef: React.MutableRefObject<HTMLAudioElement | null>;
    resolvePrologRef: React.MutableRefObject<(() => void) | null>;
}

export const useExamStart = ({
    subject,
    user,
    focusTopics,
    excludedTopics,
    duration,
    activeExaminer,
    examMode,
    voiceMode,
    speak,
    onError,
    startTimer,
    setMessages,
    setIsLoading,
    stopSpeaking,
    stopListening,
    doneIds,
    endIds,
    onCaseId,
}: UseExamStartParams): UseExamStartReturn => {
    const [isPrologPlaying, setIsPrologPlaying] = useState(true);
    const prologAudioRef = useRef<HTMLAudioElement | null>(null);
    const resolvePrologRef = useRef<(() => void) | null>(null);
    const startedRef = useRef(false);

    // Start exam
    useEffect(() => {
        if (startedRef.current) return;
        startedRef.current = true;
        let aborted = false;

        const start = async () => {
            setIsLoading(true);
            try {
                // Start exam response fetch immediately (parallel with prolog audio).
                // This closes the gap between prolog ending and TTS starting on iOS,
                // which prevents the audio session from expiring before TTS plays.
                const responsePromise = examApi.generateExamResponse(
                    [], subject, user, focusTopics, excludedTopics, undefined,
                    undefined, duration, activeExaminer, examMode, doneIds, endIds,
                );

                // 1. Play the branded intro (parallel with the API call above).
                // Es läuft vor jeder Simulation; wer nicht warten will, drückt im
                // Prolog-Screen auf „Überspringen" — das löst resolvePrologRef aus.
                if (voiceMode && !aborted) {
                    await new Promise<void>((resolve) => {
                        const localResolve = () => {
                            if (resolvePrologRef.current === localResolve) {
                                resolvePrologRef.current = null;
                            }
                            resolve();
                        };
                        resolvePrologRef.current = localResolve;

                        const audio = new Audio('./prolog.mp3');
                        prologAudioRef.current = audio;

                        const finishEvent = () => {
                            if (prologAudioRef.current === audio) {
                                prologAudioRef.current = null;
                            }
                            localResolve();
                        };

                        audio.onended = finishEvent;
                        audio.onerror = finishEvent;
                        audio.play().catch(finishEvent);
                    });
                }

                if (aborted) return;

                // 2. Hide prolog screen immediately *after* audio finishes (or is skipped)
                setIsPrologPlaying(false);

                // 3. Wait for exam response (often already done due to parallel fetch)
                const result = await responsePromise;

                if (aborted) return;

                if (result.caseId) onCaseId?.(result.caseId, result.totalCases ?? 0);

                // 4. Render AI response
                const msg: Message = { role: 'model', text: result.text, timestamp: Date.now() };
                setMessages([msg]);
                setIsLoading(false);

                // 5. Speak AI response
                if (voiceMode) speak(result.text);

                startTimer();
            } catch (err) {
                console.error("Start Error:", err);
                if (aborted) return;
                // Surface the server's message — a missing key, an exhausted
                // quota or a retired model each need a different reaction.
                onError(err instanceof Error && err.message
                    ? err.message
                    : "Die Simulation konnte nicht gestartet werden. Bitte erneut versuchen.");
                setIsLoading(false);
                setIsPrologPlaying(false); // Ensure overlay goes away on error
            }
        };
        start();
        return () => {
            aborted = true;
            startedRef.current = false;
            stopSpeaking();
            stopListening();
            if (prologAudioRef.current) {
                prologAudioRef.current.pause();
                prologAudioRef.current.src = '';
                prologAudioRef.current = null;
            }
        };
    }, []);

    return {
        isPrologPlaying,
        setIsPrologPlaying,
        prologAudioRef,
        resolvePrologRef,
    };
};

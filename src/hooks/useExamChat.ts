import { useState, useRef, useCallback, useEffect } from 'react';
import { examApi } from '../services/api';
import { clearExamDraft, saveExamDraft } from '../lib/localDb';
import { User as UserType, ExamSession, Message, ExaminerConfig, ExamMode } from '../types';

interface UseExamChatParams {
    subject: string;
    user: UserType;
    focusTopics?: string;
    excludedTopics?: string;
    duration?: number;
    activeExaminer: ExaminerConfig;
    examMode: ExamMode;
    voiceMode: boolean;
    speak: (text: string) => void;
    speakProgressive: (firstSentence: string, getContinuation: () => Promise<string | null>) => void;
    stopSpeaking: () => void;
    stopListening: () => void;
    setTranscript: (t: string) => void;
    setInputValue: (v: string) => void;
    onFinish: (session: Partial<ExamSession>) => void;
    onError: (msg: string) => void;
    onEnd?: (startTime: number, status?: 'completed' | 'aborted' | 'stale' | 'feedback_failed') => void;
    onCaseComplete?: (caseId: string, status: 'passed' | 'failed' | 'repeat', durationSeconds: number) => void;
    initialPerformanceProfile?: { strengths: string[]; weaknesses: string[]; totalCasesCount: number };
    currentCaseIdRef: React.MutableRefObject<string | undefined>;
    timeLeftRef?: React.MutableRefObject<number>;
}

export function useExamChat({
    subject, user, focusTopics, excludedTopics, duration = 15,
    activeExaminer, examMode,
    voiceMode, speak, speakProgressive, stopSpeaking, stopListening, setTranscript, setInputValue,
    onFinish, onError, onEnd, onCaseComplete,
    initialPerformanceProfile,
    currentCaseIdRef,
    timeLeftRef,
}: UseExamChatParams) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [examEnded, setExamEnded] = useState(false);
    const [isGeneratingFeedback, setIsGeneratingFeedback] = useState(false);
    const [casesCompleted, setCasesCompleted] = useState<any[]>([]);
    const [performanceProfile, setPerformanceProfile] = useState<any>(initialPerformanceProfile ?? undefined);
    const [isSwitchingCase, setIsSwitchingCase] = useState(false);
    const [caseToast, setCaseToast] = useState<{ outcome: string; topic: string; keyErrors: string[] } | null>(null);

    const [feedbackFailed, setFeedbackFailed] = useState(false);

    const messagesRef = useRef<Message[]>([]);
    const isLoadingRef = useRef(false);
    const finishedRef = useRef(false);
    const finishingRef = useRef(false);
    const feedbackInFlightRef = useRef(false);
    const inputValueRef = useRef('');
    const startTimeRef = useRef(Date.now());

    useEffect(() => { messagesRef.current = messages; }, [messages]);
    useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);

    const forceEndExam = async () => {
        if (finishedRef.current || finishingRef.current) return;
        finishingRef.current = true;
        finishedRef.current = true;
        setExamEnded(true);
        setIsLoading(true);
        stopSpeaking();
        stopListening();
        const durationSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
        if (currentCaseIdRef.current && durationSeconds < 60) {
            onCaseComplete?.(currentCaseIdRef.current, 'repeat', durationSeconds);
        }

        try {
            const result = await examApi.generateExamResponse(messagesRef.current, subject, user, focusTopics, excludedTopics, 0, undefined, undefined, activeExaminer, examMode);
            const msg: Message = { role: 'model', text: result.text, timestamp: Date.now() };
            setMessages((prev) => [...prev, msg]);
            if (voiceMode) speak(result.text);
        } catch {
            finishedRef.current = false;
            finishingRef.current = false;
            setExamEnded(false);
            onError(navigator.onLine ? "Fehler beim Abrufen des Epilogs. Bitte erneut versuchen." : "Keine Internetverbindung — der Abschluss konnte nicht geladen werden.");
        } finally {
            setIsLoading(false);
        }
    };

    const finalizeExamWithFeedback = async () => {
        // H4: prevent double submits (rapid double-click) from triggering two feedback calls.
        if (feedbackInFlightRef.current) return;
        feedbackInFlightRef.current = true;
        setFeedbackFailed(false);
        setIsLoading(true);
        setIsGeneratingFeedback(true);
        const msgs = messagesRef.current;
        try {
            const feedbackData = await examApi.generateFinalFeedback(msgs, user, casesCompleted);
            const endTime = Date.now();
            const durationSeconds = Math.round((endTime - startTimeRef.current) / 1000);
            if (currentCaseIdRef.current && durationSeconds >= 60) {
                onCaseComplete?.(currentCaseIdRef.current, feedbackData?.passed ? 'passed' : 'failed', durationSeconds);
            }
            onFinish({
                id: crypto.randomUUID(),
                startTime: startTimeRef.current,
                endTime,
                messages: msgs,
                subject,
                topicsCovered: feedbackData?.topics_covered || [],
                focusTopics: focusTopics || '',
                excludedTopics: excludedTopics || '',
                status: 'completed',
                feedback: feedbackData,
            });
            void clearExamDraft().catch(() => undefined);
            onEnd?.(startTimeRef.current, 'completed');
        } catch {
            // H3: be honest about failure instead of saving fake feedback as "completed".
            // Keep the transcript, log the real status, and let the user retry.
            setFeedbackFailed(true);
            onEnd?.(startTimeRef.current, 'feedback_failed');
        } finally {
            feedbackInFlightRef.current = false;
            setIsGeneratingFeedback(false);
            setIsLoading(false);
        }
    };

    const handleNextCase = async () => {
        stopSpeaking();
        stopListening();
        setIsSwitchingCase(true);

        try {
            const msgs = messagesRef.current;
            const summary = await examApi.generateCaseSummary(msgs);

            const caseDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
            const newSummary = {
                caseId: crypto.randomUUID(),
                topic: summary.topic || 'Unbekanntes Thema',
                outcome: summary.outcome || 'nicht bestanden',
                keyErrors: summary.keyErrors || [],
                duration: caseDuration,
            };

            if (currentCaseIdRef.current) {
                const caseStatus = newSummary.outcome === 'bestanden' ? 'passed' : 'failed';
                onCaseComplete?.(currentCaseIdRef.current, caseStatus, caseDuration);
            }

            setCaseToast({ outcome: newSummary.outcome, topic: newSummary.topic, keyErrors: newSummary.keyErrors });
            await new Promise(r => setTimeout(r, 2500));
            setCaseToast(null);

            const updatedCases = [...casesCompleted, newSummary];
            setCasesCompleted(updatedCases);

            const isPassed = newSummary.outcome === 'bestanden';
            const strengths = isPassed ? [newSummary.topic + ' solide gelöst'] : [];
            const weaknesses = newSummary.keyErrors || [];

            const newProfile = {
                strengths: [...(performanceProfile?.strengths || []), ...strengths].slice(-5),
                weaknesses: [...(performanceProfile?.weaknesses || []), ...weaknesses].slice(-5),
                totalCasesCount: updatedCases.length,
            };
            setPerformanceProfile(newProfile);

            setMessages([]);
            startTimeRef.current = Date.now();

            const nextResult = await examApi.generateExamResponse(
                [], subject, user, focusTopics, excludedTopics, undefined,
                { casesCompleted: updatedCases, performanceProfile: newProfile },
                duration, activeExaminer, examMode,
            );

            if (nextResult.caseId) {
                currentCaseIdRef.current = nextResult.caseId;
            }
            setMessages([{ role: 'model', text: nextResult.text, timestamp: Date.now() }]);
            if (voiceMode) speak(nextResult.text);

        } catch (err) {
            console.error('Error switching case:', err);
            onError(navigator.onLine ? "Fehler beim Fallwechsel. Bitte versuche es noch einmal." : "Keine Internetverbindung — der nächste Fall konnte nicht geladen werden.");
        } finally {
            setIsSwitchingCase(false);
        }
    };

    const handleSend = useCallback(async () => {
        const text = inputValueRef.current.trim().slice(0, 4000);
        if (!text || isLoadingRef.current || finishedRef.current || finishingRef.current) return;
        // H4: set the guard synchronously — the useEffect mirror lags a render behind,
        // so PTT-auto-send + Enter in the same frame could otherwise double-fire.
        isLoadingRef.current = true;

        const userMsg: Message = { role: 'user', text, timestamp: Date.now() };
        const newMessages = [...messagesRef.current, userMsg];
        messagesRef.current = newMessages;
        setMessages(newMessages);
        setInputValue('');
        setTranscript('');
        setIsLoading(true);
        stopSpeaking();
        stopListening();

        const aiTimestamp = Date.now();
        const pendingMessages = [...newMessages, { role: 'model' as const, text: '', timestamp: aiTimestamp }];
        messagesRef.current = pendingMessages;
        setMessages(pendingMessages);

        try {
            // H2: use the pause-aware countdown when available so pauses don't make the
            // backend think the exam is closer to its end than the visible timer shows.
            const elapsedSeconds = Math.round((Date.now() - startTimeRef.current) / 1000);
            const remainingSeconds = timeLeftRef
                ? Math.max(0, timeLeftRef.current)
                : Math.max(0, duration * 60 - elapsedSeconds);
            let examEndedByBackend = false;

            const responsePromise = new Promise<string>((resolve, reject) => {
                examApi.generateExamResponseStream(
                    newMessages, subject, user, focusTopics, excludedTopics,
                    remainingSeconds, undefined, duration, activeExaminer, examMode,
                    (accumulated) => {
                        setMessages(prev => {
                            const updated = [...prev];
                            const last = updated[updated.length - 1];
                            if (last?.role === 'model') updated[updated.length - 1] = { ...last, text: accumulated };
                            messagesRef.current = updated;
                            return updated;
                        });
                    },
                    undefined, // onFirstSentence not used — TTS waits for full text to avoid voice drift
                    (fullText) => { resolve(fullText); },
                    (err) => { reject(err); },
                    (meta) => { if (meta.examEnded) examEndedByBackend = true; },
                );
            });

            const response = await responsePromise;
            const finalMessages = [...newMessages, { role: 'model' as const, text: response, timestamp: aiTimestamp }];
            messagesRef.current = finalMessages;
            setMessages(finalMessages);

            // Rettungsnetz: Nach jedem Wortwechsel sichern, damit ein Absturz
            // höchstens die letzte Antwort kostet — nicht das ganze Gespräch.
            void saveExamDraft({
                subject,
                startTime: startTimeRef.current,
                savedAt: Date.now(),
                messages: finalMessages,
                casesCompleted,
                examinerId: activeExaminer.id,
                examMode,
                durationMinutes: duration,
            }).catch(() => undefined);

            // Speak the complete response in a single TTS call so voice stays
            // consistent throughout. Progressive TTS (first sentence + continuation)
            // used two separate Gemini API calls whose audio characteristics differ.
            if (voiceMode) speak(response);

            if (examEndedByBackend && !finishedRef.current) {
                finishedRef.current = true;
                setExamEnded(true);
            }
        } catch (err: any) {
            messagesRef.current = newMessages;
            setMessages(newMessages);
            if (!navigator.onLine) {
                // Kein Netz ist kein Programmfehler — das gehört klar benannt.
                onError("Keine Internetverbindung. Deine Antwort ist noch da — sobald du wieder online bist, einfach erneut absenden.");
            } else if (err?.status === 429 || err?.message?.includes('429')) {
                onError("Rate-Limit erreicht. Kurze Pause (ca. 30s).");
            } else {
                onError("Ein Fehler ist aufgetreten. Bitte erneut versuchen.");
            }
        } finally {
            setIsLoading(false);
        }
    }, [voiceMode, subject, user, focusTopics, excludedTopics, duration, activeExaminer, examMode, speak, stopSpeaking, stopListening, setTranscript, setInputValue, onError, timeLeftRef]);

    return {
        messages, setMessages,
        isLoading, setIsLoading,
        examEnded, setExamEnded,
        casesCompleted,
        isSwitchingCase,
        caseToast,
        messagesRef,
        finishedRef,
        finishingRef,
        inputValueRef,
        startTimeRef,
        handleSend,
        handleNextCase,
        forceEndExam,
        finalizeExamWithFeedback,
        isGeneratingFeedback,
        feedbackFailed,
    };
}

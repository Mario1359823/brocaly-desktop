import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { BookOpen, Clock, Eye, EyeOff, Timer, XCircle, Mic, MicOff, Volume2, Brain, User, AlertCircle, CheckCircle2, Send, ChevronRight, ZoomIn, ZoomOut, Pause, Play, Keyboard } from 'lucide-react';
import Markdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { cn } from '../lib/utils';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { useTextToSpeech } from '../hooks/useTextToSpeech';
import { useExamTimer } from '../hooks/useExamTimer';
import { useExamStart } from '../hooks/useExamStart';
import { useExamChat } from '../hooks/useExamChat';
import { User as UserType, ExamSession, Message, ExaminerConfig, ExamMode, EXAMINERS } from '../types';
import { AudioVisualizer } from './AudioVisualizer';
import { BREAKPOINT_QUERIES } from '../config/breakpoints';

// M4: memoize markdown rendering per message so a streaming/last-message update
// doesn't re-parse the markdown of every earlier message on each chunk.
const MessageMarkdown = React.memo(({ text }: { text: string }) => (
    <Markdown rehypePlugins={[rehypeSanitize]} disallowedElements={['script', 'iframe', 'object', 'embed']} unwrapDisallowed>{text}</Markdown>
));
MessageMarkdown.displayName = 'MessageMarkdown';

export const ExamView = ({ subject, sessionId, onFinish, onNewExam, onError, onEnd, onCaseComplete, onTotalCases, user, focusTopics, excludedTopics, duration = 15, examiner, examMode = 'relaxed', doneIds, endIds, initialPerformanceProfile, initialVoiceMode }: {
    subject: string;
    sessionId?: string;
    onFinish: (session: Partial<ExamSession>) => void;
    onNewExam?: () => void;
    onError: (msg: string) => void;
    onEnd?: (startTime: number, status?: 'completed' | 'aborted' | 'stale' | 'feedback_failed') => void;
    onCaseComplete?: (caseId: string, status: 'passed' | 'failed' | 'repeat', durationSeconds: number) => void;
    onTotalCases?: (total: number) => void;
    user: UserType;
    focusTopics?: string;
    excludedTopics?: string;
    duration?: number;
    examiner?: ExaminerConfig;
    examMode?: ExamMode;
    doneIds?: string[];
    endIds?: string[];
    initialPerformanceProfile?: { strengths: string[]; weaknesses: string[]; totalCasesCount: number };
    initialVoiceMode?: boolean;
}) => {
    const shouldReduceMotion = useReducedMotion();
    const activeExaminer = examiner ?? EXAMINERS[0];

    const [inputValue, setInputValue] = useState('');
    const [voiceMode, setVoiceMode] = useState(initialVoiceMode ?? true);
    const [leftPct, setLeftPct] = useState(50);
    const isDraggingRef = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // PTT State
    const [isPttActive, setIsPttActive] = useState(false);
    // Ref-Spiegel von isPttActive: touchend feuert bevor React re-rendert,
    // daher brauchen wir einen synchron aktualisierten Wert für handleOrbMouseUp.
    const isPttActiveRef = useRef(false);
    // Flag: PTT was released, auto-send when transcript arrives.
    const pttPendingSendRef = useRef(false);
    const [chatFontSize, setChatFontSize] = useState<'sm' | 'base' | 'lg'>('sm');
    const fontSizes = { sm: 'text-sm', base: 'text-base', lg: 'text-lg' } as const;


    const chatContainerRef = useRef<HTMLDivElement>(null);
    const mobileTextareaRef = useRef<HTMLTextAreaElement>(null);
    const currentCaseIdRef = useRef<string | undefined>(undefined);
    const totalCasesRef = useRef<number>(0);
    const sessionLoggedRef = useRef(false);
    const logSessionEnd = useCallback((startTime: number, status: 'completed' | 'aborted' | 'stale' | 'feedback_failed' = 'completed') => {
        if (sessionLoggedRef.current && status !== 'completed') return;
        sessionLoggedRef.current = true;
        onEnd?.(startTime, status);
    }, [onEnd]);

    const { speak, speakProgressive, stop: stopSpeaking, isSpeaking, isLoadingAudio } = useTextToSpeech(activeExaminer.voice);
    const { isListening, isTranscribing, isAcquiringMic, isSpeechAPIAvailable, transcript, error: speechError, tooShort, notUnderstood, audioLevel, startListening, stopListening, setTranscript } = useSpeechToText(subject);

    const { timeLeft, timerActive, timeWarning, timerActiveRef, timeIsUpRef, timeLeftRef, startTimer, isPaused, pauseReason, pauseTimeLeft, pauseTimer, resumeTimer } = useExamTimer(duration);

    const {
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
        handleNextCase: handleNextCaseBase,
        forceEndExam,
        finalizeExamWithFeedback,
        isGeneratingFeedback,
        feedbackFailed,
    } = useExamChat({
        subject, user, focusTopics, excludedTopics, duration,
        activeExaminer, examMode,
        voiceMode, speak, speakProgressive, stopSpeaking, stopListening, setTranscript, setInputValue,
        onFinish, onError, onEnd: logSessionEnd, onCaseComplete,
        initialPerformanceProfile,
        currentCaseIdRef,
        timeLeftRef,
    });

    // Warn on tab close / refresh during active exam AND while feedback is generating
    useEffect(() => {
        if (examEnded && !isGeneratingFeedback) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [examEnded, isGeneratingFeedback]);

    useEffect(() => {
        return () => {
            if (!sessionLoggedRef.current) {
                logSessionEnd(startTimeRef.current, 'aborted');
            }
        };
    }, [logSessionEnd, startTimeRef]);

    const { isPrologPlaying, setIsPrologPlaying, prologAudioRef, resolvePrologRef } = useExamStart({
        subject,
        doneIds,
        endIds,
        onCaseId: (caseId, total) => {
            currentCaseIdRef.current = caseId;
            totalCasesRef.current = total;
            if (total > 0) onTotalCases?.(total);
        },
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
    });

    // Mobile end-confirmation dialog
    const [showEndConfirm, setShowEndConfirm] = useState(false);

    // Mobile detection
    const [isMobile, setIsMobile] = useState(() => !window.matchMedia(BREAKPOINT_QUERIES.desktop).matches);
    useEffect(() => {
        const desktopQuery = window.matchMedia(BREAKPOINT_QUERIES.desktop);
        const syncViewportMode = () => setIsMobile(!desktopQuery.matches);
        syncViewportMode();
        desktopQuery.addEventListener('change', syncViewportMode);
        return () => desktopQuery.removeEventListener('change', syncViewportMode);
    }, []);

    // Mobile keyboard resize: track visualViewport height AND offsetTop
    // On iOS, when the keyboard opens, the visual viewport scrolls down (offsetTop > 0).
    // Without tracking offsetTop, position:fixed;top:0 stays anchored to the layout viewport
    // top, leaving a white gap between the container and the visible area.
    const [viewportHeight, setViewportHeight] = useState<number | null>(null);
    const [viewportOffsetTop, setViewportOffsetTop] = useState<number>(0);
    const [prologTipIndex, setPrologTipIndex] = useState(0);
    useEffect(() => {
        if (!isMobile || !window.visualViewport) return;
        const vv = window.visualViewport;
        const update = () => {
            setViewportHeight(vv.height);
            setViewportOffsetTop(vv.offsetTop);
        };
        vv.addEventListener('resize', update);
        vv.addEventListener('scroll', update);
        return () => {
            vv.removeEventListener('resize', update);
            vv.removeEventListener('scroll', update);
        };
    }, [isMobile]);

    const prologTips = [
        {
            icon: Mic,
            title: isMobile ? 'Mikrofon-Button halten' : 'Leertaste oder Mikrofon halten',
            body: 'Sprich erst los, wenn der Button aktiv ist. Loslassen sendet deine Antwort automatisch.',
        },
        {
            icon: Volume2,
            title: 'Natürlich und deutlich sprechen',
            body: 'Antworte wie in einem medizinischen Fachgespräch: normale Lautstärke, klare Sätze, medizinische Fachbegriffe sind okay.',
        },
        {
            icon: CheckCircle2,
            title: 'Kurze Pausen helfen',
            body: 'Eine kleine Pause zwischen Gedanken macht die Spracherkennung stabiler und deine Antwort klarer.',
        },
        {
            icon: Keyboard,
            title: 'Tippen ist ausdrücklich erlaubt',
            body: 'Wenn du lieber schreibst, wechsle auf Text. Während du tippst, wird die Simulationszeit gestoppt.',
        },
        {
            icon: Timer,
            title: 'Zeitfairness beim Schreiben',
            body: 'Der Timer läuft erst weiter, wenn du das Textfeld verlässt oder deine Antwort abschickst.',
        },
    ];

    useEffect(() => {
        if (!isPrologPlaying) return;
        const timer = setInterval(() => {
            setPrologTipIndex(i => (i + 1) % prologTips.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [isPrologPlaying, prologTips.length]);

    // Sync transcript → input (live preview while SpeechRecognition is active)
    useEffect(() => {
        if (transcript) setInputValue(transcript);
    }, [transcript]);

    // Sync inputValue → inputValueRef (used by handleSend via ref)
    useEffect(() => { inputValueRef.current = inputValue; }, [inputValue]);

    // Auto-send after PTT: when transcription completes and we have text, fire handleSend.
    // This is more robust than the callback chain (stopListening → onstop → setTimeout → cb)
    // which was unreliable on iOS Safari due to timing/state issues.
    useEffect(() => {
        if (pttPendingSendRef.current && transcript && !isTranscribing) {
            pttPendingSendRef.current = false;
            inputValueRef.current = transcript;
            handleSend();
        }
    }, [transcript, isTranscribing, handleSend]);

    const pauseTimerForTyping = useCallback(() => {
        if (timerActiveRef.current && !examEnded && !isSpeaking && !isLoadingAudio) pauseTimer('typing');
    }, [examEnded, isLoadingAudio, isSpeaking, pauseTimer, timerActiveRef]);

    const resumeTimerAfterTyping = useCallback(() => {
        resumeTimer('typing');
    }, [resumeTimer]);

    const handleSendWithTimerResume = useCallback(() => {
        resumeTimer('typing');
        handleSend();
    }, [handleSend, resumeTimer]);

    const canStartVoiceInput = !isLoading && !isSpeaking && !isLoadingAudio && !isTranscribing && !examEnded;

    // H3: surface a real error (and allow retry) when feedback generation fails.
    useEffect(() => {
        if (feedbackFailed) onError('Feedback konnte nicht erstellt werden. Bitte erneut versuchen.');
    }, [feedbackFailed, onError]);
    const feedbackButtonLabel = feedbackFailed ? 'Erneut versuchen' : 'Feedback anzeigen';

    // Scroll to bottom
    useEffect(() => {
        const el = chatContainerRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [messages]);

    const handleFeedbackClick = () => {
        const audio = new Audio('/outro.mp3');
        audio.play().catch(() => {});
        finalizeExamWithFeedback();
    };

    // Spacebar Push-to-Talk
    useEffect(() => {
        if (!voiceMode || !canStartVoiceInput) return;

        let isSpaceDown = false;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Space' && !e.repeat) {
                if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') return;
                e.preventDefault();
                isSpaceDown = true;
                isPttActiveRef.current = true;
                setIsPttActive(true);
                startListening();
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.code === 'Space' && isSpaceDown) {
                isSpaceDown = false;
                isPttActiveRef.current = false;
                setIsPttActive(false);
                pttPendingSendRef.current = true;
                stopListening();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [voiceMode, canStartVoiceInput, startListening, stopListening]);

    const handleNextCase = async () => {
        if (onNewExam) { onNewExam(); return; }
        await handleNextCaseBase();
        setInputValue('');
    };


    const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    const toggleVoiceMode = () => {
        const next = !voiceMode;
        isPttActiveRef.current = false;
        setIsPttActive(false);
        pttPendingSendRef.current = false;
        stopListening();
        setVoiceMode(next);
        if (!next) stopSpeaking();
    };

    // Orb Mouse Handling
    const handleOrbMouseDown = () => {
        if (!canStartVoiceInput) return;
        isPttActiveRef.current = true;
        setIsPttActive(true);
        startListening();
    };

    const handleOrbMouseUp = () => {
        if (!isPttActiveRef.current) return;
        isPttActiveRef.current = false;
        setIsPttActive(false);
        pttPendingSendRef.current = true;
        stopListening();
    };

    const examinerFirstName = activeExaminer.name.split(' ').pop() ?? activeExaminer.name;

    const pttHint = isMobile ? 'Mikrofon-Button halten zum Sprechen' : '⎵ Leertaste halten oder Kugel drücken';
    const orbStatus = speechError
        ? { label: 'Mikrofon nicht verfügbar', hint: speechError }
        : isAcquiringMic
        ? { label: 'Mikrofon wird aktiviert…', hint: 'Bitte warten…' }
        : isTranscribing
        ? { label: 'Sprache wird erkannt…', hint: 'Bitte warten…' }
        : isLoading && messages.length === 0
            ? { label: 'Simulation startet…', hint: 'Erste Frage wird vorbereitet…' }
            : isLoading
                ? { label: `${examinerFirstName} überlegt…`, hint: 'Antwort wird generiert…' }
                : isLoadingAudio
                    ? { label: `${examinerFirstName} formuliert…`, hint: 'Audio wird geladen…' }
                    : isPttActive
                        ? { label: 'Aufnahme läuft…', hint: 'Loslassen zum Senden' }
                        : isSpeaking
                            ? { label: `${examinerFirstName} spricht…`, hint: 'Bitte warten…' }
                            : { label: `${examinerFirstName} hört zu`, hint: pttHint };
    const liveExamStatus = `${orbStatus.label} ${orbStatus.hint}`;
    const voiceInputLabel = isPttActive
        ? 'Aufnahme läuft, loslassen zum Senden'
        : canStartVoiceInput
            ? 'Mikrofon halten zum Sprechen'
            : liveExamStatus;
    const sendAnswerLabel = inputValue.trim() ? 'Antwort senden' : 'Antwort senden nicht verfügbar';
    const pauseButtonLabel = isPaused
        ? `Simulation fortsetzen, Pausenzeit ${Math.floor(pauseTimeLeft / 60)} Minuten ${pauseTimeLeft % 60} Sekunden`
        : 'Simulation pausieren';

    if (isGeneratingFeedback) {
        return (
            <div className="flex flex-col h-full relative overflow-hidden items-center justify-center" style={{ background: 'linear-gradient(160deg, #edfaf3 0%, #f6fefb 45%, #fff9f5 100%)' }}>
                <div className="absolute top-1/3 left-1/4 w-[24rem] h-[24rem] bg-brand-green/8 rounded-full blur-[64px] pointer-events-none" />
                <div className="absolute bottom-1/3 right-1/4 w-[24rem] h-[24rem] bg-[#FC7016]/8 rounded-full blur-[64px] pointer-events-none" />

                {/* Wordmark — identisch mit Sidebar */}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: 'easeOut' }} className="relative z-10 mb-8">
                    <span className="text-4xl font-sans font-extrabold tracking-widest text-slate-900 select-none">BROCA<span className="text-brand-orange">LY</span></span>
                </motion.div>

                {/* Card */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                    className="max-w-sm w-full mx-auto px-5 relative z-10"
                >
                    <div className="bg-white/80 backdrop-blur-md border border-white/90 rounded-2xl px-6 py-5 shadow-lg shadow-slate-200/50 text-center">
                        <div className="w-10 h-10 rounded-full bg-brand-green/8 flex items-center justify-center mx-auto mb-3">
                            <CheckCircle2 className="w-5 h-5 text-brand-green" />
                        </div>
                        <p className="text-base font-bold text-slate-800 mb-2">Simulation abgeschlossen</p>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Was lief gut — wo hast du gezögert? Dein persönliches Feedback wird gerade ausgewertet.
                        </p>
                    </div>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.7 }}
                        className="flex items-center justify-center gap-2 mt-5"
                    >
                        <span className="text-[#1A5C35]/45 text-xs font-semibold tracking-[0.22em] uppercase">Feedback wird generiert</span>
                        <span className="flex gap-1 ml-1">
                            {[0, 1, 2].map(i => (
                                <motion.span key={i} animate={shouldReduceMotion ? { opacity: 0.6 } : { opacity: [0.2, 1, 0.2] }} transition={shouldReduceMotion ? { duration: 0 } : { duration: 1.2, repeat: Infinity, delay: i * 0.22 }} className="w-1 h-1 rounded-full bg-[#1A5C35]/35 inline-block" />
                            ))}
                        </span>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 1.3, duration: 0.5 }}
                        className="flex items-center gap-2.5 mt-4 px-4 py-3 bg-amber-50 border border-amber-200/80 rounded-xl"
                    >
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                        <p className="text-xs text-amber-700 font-medium">Seite nicht verlassen — Feedback geht sonst verloren.</p>
                    </motion.div>
                </motion.div>
            </div>
        );
    }

    if (isPrologPlaying) {
        return (
            <div className="flex flex-col h-full relative overflow-hidden items-center justify-center" style={{ background: 'linear-gradient(160deg, #edfaf3 0%, #f6fefb 45%, #fff9f5 100%)' }}>
                <div className="absolute top-1/3 left-1/4 w-[24rem] h-[24rem] bg-brand-green/8 rounded-full blur-[64px] pointer-events-none" />
                <div className="absolute bottom-1/3 right-1/4 w-[24rem] h-[24rem] bg-[#FC7016]/8 rounded-full blur-[64px] pointer-events-none" />

                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1, ease: 'easeInOut' }}
                        className="absolute inset-0 z-50 flex flex-col items-center justify-center"
                    >
                        {/* Wordmark — identisch mit Sidebar */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, ease: 'easeOut' }}
                            className="relative z-10"
                        >
                            <span className="text-5xl font-sans font-extrabold tracking-widest text-slate-900 select-none">BROCA<span className="text-brand-orange">LY</span></span>
                        </motion.div>

                        {/* Loading dots */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.5, duration: 0.5 }}
                            className="flex items-center gap-2 mt-7 relative z-10"
                        >
                            <span className="text-[#1A5C35]/45 text-xs font-semibold tracking-[0.22em] uppercase">Simulation wird vorbereitet</span>
                            <span className="flex gap-1 ml-1">
                                {[0, 1, 2].map(i => (
                                    <motion.span key={i} animate={shouldReduceMotion ? { opacity: 0.6 } : { opacity: [0.2, 1, 0.2] }} transition={shouldReduceMotion ? { duration: 0 } : { duration: 1.2, repeat: Infinity, delay: i * 0.22 }} className="w-1 h-1 rounded-full bg-[#1A5C35]/35 inline-block" />
                                ))}
                            </span>
                        </motion.div>

                        {/* Rotating usage tips — visible during intro/loading */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 1.2, duration: 0.5 }}
                            className="mt-10 max-w-md w-full mx-auto relative z-10 px-6"
                        >
                            <div className="bg-white/90 backdrop-blur-sm border border-brand-green/15 rounded-2xl px-5 py-4 shadow-md shadow-brand-green/5">
                                <AnimatePresence mode="wait">
                                    {(() => {
                                        const tip = prologTips[prologTipIndex];
                                        const TipIcon = tip.icon;
                                        return (
                                            <motion.div
                                                key={tip.title}
                                                initial={{ opacity: 0, y: 6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -6 }}
                                                transition={{ duration: 0.28, ease: 'easeOut' }}
                                                className="flex gap-3 items-center min-h-[56px]"
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-brand-green/10 flex items-center justify-center flex-shrink-0">
                                                    <TipIcon className="w-5 h-5 text-brand-green" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">{tip.title}</p>
                                                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{tip.body}</p>
                                                </div>
                                            </motion.div>
                                        );
                                    })()}
                                </AnimatePresence>
                            </div>
                        </motion.div>

                        {/* Skip */}
                        <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.8, duration: 0.4 }}
                            onClick={() => {
                                if (prologAudioRef.current) {
                                    prologAudioRef.current.pause();
                                    prologAudioRef.current.src = '';
                                    prologAudioRef.current = null;
                                }
                                if (resolvePrologRef.current) {
                                    resolvePrologRef.current();
                                    resolvePrologRef.current = null;
                                }
                            }}
                            className="mt-10 px-6 py-2.5 rounded-xl bg-white/60 backdrop-blur-sm border border-slate-200/80 text-slate-500 text-sm font-medium hover:text-[#1A5C35] hover:bg-white hover:border-[#1A5C35]/20 transition-all relative z-10"
                        >
                            Überspringen
                        </motion.button>
                    </motion.div>
                </AnimatePresence>
            </div>
        );
    }

    return (
        <div
            className="flex flex-col bg-slate-50 overflow-hidden h-full"
            style={isMobile ? { position: 'fixed', top: viewportOffsetTop || 0, left: 0, right: 0, height: viewportHeight ? `${viewportHeight}px` : '100dvh', zIndex: 60, paddingTop: viewportOffsetTop > 0 ? 0 : 'max(env(safe-area-inset-top), 0px)' } : undefined}
        >
            <div className="sr-only" aria-live="polite" aria-atomic="true">
                {liveExamStatus}
            </div>

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200/80 z-20 shrink-0 shadow-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl overflow-hidden border-2 border-brand-green/20 shrink-0 shadow-sm">
                        {activeExaminer.image
                            ? <img src={activeExaminer.image} alt={activeExaminer.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full bg-brand-green/10 flex items-center justify-center"><BookOpen className="w-4 h-4 text-brand-green" /></div>
                        }
                    </div>
                    <div className="min-w-0">
                        <h2 className="font-bold text-brand-navy text-sm leading-tight truncate max-w-[120px] sm:max-w-none">{subject}</h2>
                        <p className="text-slate-500 text-xs truncate">{activeExaminer.name}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-sm font-bold transition-all",
                        !timerActive ? "bg-slate-50 border-slate-200 text-slate-500"
                        : timeLeft < 120 ? "bg-red-50 border-red-200 text-red-600 animate-pulse shadow-sm shadow-red-100"
                        : timeLeft < 300 ? "bg-amber-50 border-amber-200 text-amber-600"
                        : "bg-brand-green/6 border-brand-green/20 text-brand-green"
                    )}>
                        <Timer className="w-4 h-4" />
                        <span className="text-base font-extrabold tabular-nums">{formatTime(timeLeft)}</span>
                    </div>
                    {/* Pause button */}
                    {timerActive && !examEnded && (
                        <button
                            onClick={isPaused ? () => resumeTimer() : () => pauseTimer('manual')}
                            aria-label={pauseButtonLabel}
                            className={cn(
                                "flex min-h-11 items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all shrink-0 border",
                                isPaused
                                    ? "bg-brand-green text-white border-brand-green animate-pulse"
                                    : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-600"
                            )}
                            title={isPaused ? `Fortsetzen (${Math.floor(pauseTimeLeft / 60)}:${String(pauseTimeLeft % 60).padStart(2, '0')})` : 'Pause'}
                        >
                            {isPaused
                                ? <><Play className="w-3.5 h-3.5" /><span className="hidden sm:inline tabular-nums">{Math.floor(pauseTimeLeft / 60)}:{String(pauseTimeLeft % 60).padStart(2, '0')}</span></>
                                : <><Pause className="w-3.5 h-3.5" /><span className="hidden sm:inline">Pause</span></>
                            }
                        </button>
                    )}

                    {/* Font size controls — desktop only */}
                    <div className="hidden sm:flex items-center gap-1 bg-slate-100 rounded-xl p-1 border border-slate-200">
                        <button onClick={() => setChatFontSize(s => s === 'lg' ? 'base' : s === 'base' ? 'sm' : 'sm')} className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-white transition-colors" title="Schrift kleiner" aria-label="Schrift kleiner">
                            <ZoomOut className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                        <button onClick={() => setChatFontSize(s => s === 'sm' ? 'base' : s === 'base' ? 'lg' : 'lg')} className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-white transition-colors" title="Schrift größer" aria-label="Schrift größer">
                            <ZoomIn className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                    </div>

                    {!examEnded && (
                        <button
                            onClick={isMobile ? () => setShowEndConfirm(true) : forceEndExam}
                            aria-label="Simulation beenden"
                            className="hidden sm:flex min-h-11 items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-500 hover:text-red-500 rounded-xl font-bold text-xs transition-all shrink-0"
                        >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Beenden</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Timer-Warning Banner */}
            {timerActive && timeLeft > 0 && timeLeft < 120 && !examEnded && !isPaused && (
                <div className="shrink-0 bg-red-50 border-b border-red-200 px-4 py-2 flex items-center justify-center gap-2 text-red-600 text-sm font-bold animate-pulse">
                    <Clock className="w-4 h-4" />
                    <span className="tabular-nums">{formatTime(timeLeft)}</span> verbleibend
                </div>
            )}

            {/* ── Pause Overlay ── */}
            {isPaused && pauseReason === 'manual' && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/90 backdrop-blur-sm">
                    <div className="text-center px-8">
                        <div className="w-16 h-16 rounded-2xl bg-brand-green/10 flex items-center justify-center mx-auto mb-4">
                            <Pause className="w-8 h-8 text-brand-green" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-1">Simulation pausiert</h3>
                        <p className="text-sm text-slate-500 mb-1">Die Zeit läuft nicht weiter.</p>
                        <p className="text-xs text-amber-600 font-semibold mb-6">
                            Automatische Fortsetzung in {Math.floor(pauseTimeLeft / 60)}:{String(pauseTimeLeft % 60).padStart(2, '0')}
                        </p>
                        <button
                            onClick={() => resumeTimer()}
                            className="flex items-center gap-2 mx-auto px-6 py-3 bg-brand-green text-white font-bold rounded-xl hover:bg-brand-green/80 transition-colors text-sm"
                        >
                            <Play className="w-4 h-4" />
                            Fortsetzen
                        </button>
                    </div>
                </div>
            )}

            {/* ── Mobile Status Strip ── */}
            {isMobile && !examEnded && (
                <div className="shrink-0 px-4 py-2 bg-white border-b border-slate-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className={cn(
                            'w-2 h-2 rounded-full shrink-0',
                            isPttActive ? 'bg-red-500 animate-pulse'
                                : isTranscribing ? 'bg-brand-green animate-pulse'
                                    : isSpeaking ? 'bg-brand-green animate-pulse'
                                        : isLoading ? 'bg-brand-orange animate-pulse'
                                            : isLoadingAudio ? 'bg-emerald-500 animate-pulse'
                                                : 'bg-emerald-500'
                        )} />
                        <span className="text-xs font-medium text-slate-700 truncate">{orbStatus.label}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <div className={cn(
                            "flex items-center gap-1 px-2.5 py-1 rounded-xl border text-xs font-bold transition-all",
                            !timerActive ? "bg-slate-50 border-slate-200 text-slate-500"
                            : timeLeft < 120 ? "bg-red-50 border-red-200 text-red-600 animate-pulse"
                            : timeLeft < 300 ? "bg-amber-50 border-amber-200 text-amber-600"
                            : "bg-brand-green/6 border-brand-green/20 text-brand-green"
                        )}>
                            <Timer className="w-3 h-3" />
                            <span className="font-extrabold tabular-nums">{formatTime(timeLeft)}</span>
                        </div>
                        <button
                            onClick={() => setShowEndConfirm(true)}
                            aria-label="Simulation beenden"
                            className="flex min-h-11 items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-500 hover:text-red-500 rounded-xl text-xs font-bold transition-all"
                        >
                            <XCircle className="w-3.5 h-3.5" />
                            Beenden
                        </button>
                    </div>
                </div>
            )}

            {/* ── Case Outcome Toast ── */}
            <AnimatePresence>
                {caseToast && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-modal shadow-2xl p-6 mx-6 max-w-sm w-full"
                        >
                            <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3",
                                caseToast.outcome === 'bestanden' ? "bg-emerald-100" : "bg-amber-100"
                            )}>
                                {caseToast.outcome === 'bestanden'
                                    ? <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                                    : <XCircle className="w-6 h-6 text-amber-500" />
                                }
                            </div>
                            <p className="text-center font-extrabold text-slate-900 text-lg mb-0.5">
                                {caseToast.outcome === 'bestanden' ? 'Fall sicher bearbeitet' : 'Fall zur Wiederholung markiert'}
                            </p>
                            <p className="text-center text-slate-500 text-sm mb-3">{caseToast.topic}</p>
                            {caseToast.keyErrors.length > 0 && (
                                <ul className="space-y-1.5">
                                    {caseToast.keyErrors.slice(0, 3).map((e, i) => (
                                        <li key={i} className="flex gap-2 text-sm text-slate-600">
                                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0 mt-1.5" />
                                            {e}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <p className="text-center text-xs text-slate-500 mt-4">Nächster Fall wird geladen…</p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Body: ORB left + Chat right (Desktop) / Chat only (Mobile) ── */}
            <div
                ref={containerRef}
                className="flex-1 flex min-h-0 select-none"
                onPointerMove={e => {
                    if (!isDraggingRef.current || !containerRef.current || isMobile) return;
                    const rect = containerRef.current.getBoundingClientRect();
                    const pct = Math.min(80, Math.max(20, ((e.clientX - rect.left) / rect.width) * 100));
                    setLeftPct(pct);
                }}
                onPointerUp={() => { isDraggingRef.current = false; }}
                onPointerLeave={() => { isDraggingRef.current = false; }}
            >

                {/* LEFT: ORB panel — Desktop only */}
                {!isMobile && <div style={{ width: `${leftPct}%` }} className="exam-orb-container shrink-0 flex flex-col items-center justify-center gap-6 p-6 bg-white relative overflow-hidden">
                    {/* Background glow — brand colors */}
                    <div className="absolute top-1/4 left-1/4 w-56 h-56 bg-brand-green/8 rounded-full blur-[56px] pointer-events-none" />
                    <div className="absolute bottom-1/4 right-1/4 w-56 h-56 bg-brand-orange/6 rounded-full blur-[56px] pointer-events-none" />

                    {/* ORB */}
                    <div className="relative">
                        <motion.div
                            animate={shouldReduceMotion ? { scale: 1, opacity: isSpeaking ? 0.45 : 0 } : { scale: isSpeaking ? [1, 1.3, 1] : 1, opacity: isSpeaking ? [0.4, 0.7, 0.4] : 0 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { repeat: isSpeaking ? Infinity : 0, duration: 2, ease: 'easeInOut' }}
                            className="absolute inset-0 rounded-full bg-brand-green/20 blur-2xl"
                        />
                        <motion.div
                            animate={{
                                scale: isPttActive ? 1.06 : 1,
                                boxShadow: isPttActive
                                    ? '0 0 40px rgba(230,126,34,0.4)'
                                    : isSpeaking
                                        ? '0 0 50px rgba(31,107,63,0.3)'
                                        : '0 0 16px rgba(31,107,63,0.08)',
                            }}
                            className="relative z-10 flex items-center justify-center p-3 rounded-full cursor-pointer select-none touch-none bg-white/60 border border-white/80 shadow-xl backdrop-blur-md"
                            role="button"
                            tabIndex={0}
                            aria-label={voiceInputLabel}
                            onMouseDown={handleOrbMouseDown}
                            onMouseUp={handleOrbMouseUp}
                            onMouseLeave={handleOrbMouseUp}
                            onTouchStart={e => { e.preventDefault(); handleOrbMouseDown(); }}
                            onTouchEnd={e => { e.preventDefault(); handleOrbMouseUp(); }}
                            onTouchCancel={e => { e.preventDefault(); handleOrbMouseUp(); }}
                            onKeyDown={e => {
                                if (e.key !== 'Enter' || e.repeat) return;
                                e.preventDefault();
                                handleOrbMouseDown();
                            }}
                            onKeyUp={e => {
                                if (e.key !== 'Enter') return;
                                e.preventDefault();
                                handleOrbMouseUp();
                            }}
                        >
                            <motion.div
                                animate={{ scale: shouldReduceMotion ? 1 : isSpeaking ? [1, 1.05, 1] : isPttActive ? 0.94 : 1 }}
                                transition={shouldReduceMotion ? { duration: 0 } : { repeat: isSpeaking ? Infinity : 0, duration: 0.15 }}
                                className={cn(
                                    'w-28 h-28 rounded-full flex items-center justify-center transition-colors duration-500 shadow-inner overflow-hidden relative',
                                    isPttActive
                                        ? 'bg-gradient-to-br from-brand-orange to-brand-orange/80'
                                        : isLoading && messages.length === 0
                                            ? 'bg-gradient-to-br from-slate-300 to-slate-400'
                                            : 'bg-gradient-to-br from-brand-green to-emerald-500'
                                )}
                            >
                                {(isLoading || isLoadingAudio) && !isPttActive ? (
                                    <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : isPttActive ? (
                                    <Mic className="w-12 h-12 text-white drop-shadow-md" />
                                ) : activeExaminer.image ? (
                                    <>
                                        <img src={activeExaminer.image} alt={activeExaminer.name} className="absolute inset-0 w-full h-full object-cover object-top" />
                                        {isSpeaking && (
                                            <div className="absolute inset-0 bg-brand-green/25 flex items-center justify-center">
                                                <Volume2 className="w-10 h-10 text-white drop-shadow-md" />
                                            </div>
                                        )}
                                    </>
                                ) : isSpeaking ? (
                                    <Volume2 className="w-12 h-12 text-white drop-shadow-md" />
                                ) : (
                                    <MicOff className="w-10 h-10 text-white/50" />
                                )}
                            </motion.div>
                        </motion.div>
                    </div>

                    {/* Status */}
                    <div className="orb-status text-center relative z-10" aria-live="polite" aria-atomic="true">
                        <p className="font-bold text-slate-800 text-base">{orbStatus.label}</p>
                        <p className="text-slate-500 text-xs mt-1">{orbStatus.hint}</p>
                    </div>


                    {/* Live transcript while speaking */}
                    {isPttActive && inputValue && (
                        <div className="w-full bg-brand-green/8 border border-brand-green/20 rounded-2xl px-4 py-3 text-sm text-brand-green leading-snug relative z-10">
                            {inputValue}
                        </div>
                    )}

                    {examEnded && (
                        <button
                            onClick={handleFeedbackClick}
                            disabled={isLoading || isSpeaking || isLoadingAudio}
                            className="w-full px-4 py-3 bg-gradient-to-r from-brand-green to-emerald-500 text-white font-bold rounded-2xl hover:from-brand-green/80 hover:to-brand-green shadow-lg shadow-brand-green/25 transition-all text-sm flex items-center justify-center gap-2 relative z-10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading
                                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : (isSpeaking || isLoadingAudio) ? 'KI spricht …' : feedbackButtonLabel}
                        </button>
                    )}
                </div>}

                {/* DIVIDER — Desktop only */}
                {!isMobile && <div
                    className="w-1.5 shrink-0 bg-slate-100 hover:bg-brand-green/40 active:bg-brand-green/60 cursor-col-resize transition-colors relative group"
                    onPointerDown={e => { isDraggingRef.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }}
                >
                    <div className="absolute inset-y-0 -left-1 -right-1" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-8 rounded-full bg-slate-200 group-hover:bg-brand-green/50 transition-colors flex flex-col items-center justify-center gap-0.5">
                        <div className="w-0.5 h-3 rounded-full bg-white/70" />
                    </div>
                </div>}

                {/* RIGHT: Chat panel */}
                <div className="flex-1 flex flex-col min-h-0 bg-slate-50">

                    {/* Messages */}
                    <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                        <AnimatePresence initial={false}>
                            {messages.map((m, i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={cn('flex gap-3', m.role === 'user' ? 'flex-row-reverse' : '')}
                                >
                                    <div className={cn(
                                        'w-8 h-8 rounded-2xl shrink-0 shadow-sm mt-0.5 overflow-hidden',
                                        m.role === 'model'
                                            ? 'border border-slate-200'
                                            : 'bg-gradient-to-br from-brand-green to-emerald-500 flex items-center justify-center'
                                    )}>
                                        {m.role === 'model'
                                            ? (activeExaminer.image
                                                ? <img src={activeExaminer.image} alt={activeExaminer.name} className="w-full h-full object-cover" />
                                                : <div className="w-full h-full bg-white flex items-center justify-center"><Brain className="w-4 h-4 text-brand-green" /></div>)
                                            : <User className="w-4 h-4 text-white" />
                                        }
                                    </div>
                                    <div className="space-y-1.5 max-w-[85%] min-w-0">
                                        <div className={cn(
                                            'px-4 py-3 rounded-2xl leading-relaxed shadow-sm transition-all break-words [overflow-wrap:anywhere]',
                                            fontSizes[chatFontSize],
                                            m.role === 'model'
                                                ? 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'
                                                : 'bg-brand-green text-white rounded-tr-sm'
                                        )}>
                                            <MessageMarkdown text={m.text} />
                                            {m.role === 'model' && i === messages.length - 1 && isSpeaking && (
                                                <div className="flex items-center gap-1 mt-2">
                                                    {[0, 1, 2].map(j => (
                                                        <div key={j} className="w-1 bg-emerald-500 rounded-full animate-bounce" style={{ height: `${6 + j * 3}px`, animationDelay: `${j * 0.15}s` }} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {isLoading && messages.length > 0 && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                                <div className="w-8 h-8 rounded-2xl overflow-hidden border border-slate-200 shrink-0">
                                    {activeExaminer.image
                                        ? <img src={activeExaminer.image} alt={activeExaminer.name} className="w-full h-full object-cover opacity-60 animate-pulse" />
                                        : <div className="w-full h-full bg-white flex items-center justify-center"><Brain className="w-4 h-4 text-slate-500 animate-pulse" /></div>
                                    }
                                </div>
                                <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white border border-slate-200 flex gap-1.5 items-center">
                                    {[0, 1, 2].map(i => (
                                        <span key={i} className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
                                    ))}
                                </div>
                            </motion.div>
                        )}
                        <div />
                    </div>

                    {/* Input area */}
                    <div
                        className="shrink-0 px-3 py-3 bg-white border-t border-slate-200"
                        style={isMobile ? { paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' } : undefined}
                    >
                        {examEnded ? (
                            isMobile ? (
                                <div className="flex flex-col items-center gap-3 py-1">
                                    <p className="text-slate-500 font-medium text-sm">Die Simulation ist beendet.</p>
                                    <button
                                        onClick={handleFeedbackClick}
                                        disabled={isLoading || isSpeaking || isLoadingAudio}
                                        className="w-full px-6 py-3.5 bg-gradient-to-r from-brand-green to-emerald-500 text-white font-bold rounded-2xl hover:from-brand-green/80 hover:to-brand-green shadow-lg shadow-brand-green/25 transition-all flex items-center justify-center gap-2 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (isSpeaking || isLoadingAudio) ? 'KI spricht …' : feedbackButtonLabel}
                                    </button>
                                </div>
                            ) : (
                            <div className="flex items-center justify-center gap-4 py-2">
                                <p className="text-slate-500 font-medium text-sm">Die Simulation ist beendet.</p>
                                <button
                                    onClick={handleFeedbackClick}
                                    disabled={isLoading || isSpeaking || isLoadingAudio}
                                    className="px-6 py-2.5 bg-gradient-to-r from-brand-green to-emerald-500 text-white font-bold rounded-2xl hover:from-brand-green/80 hover:to-brand-green shadow-lg shadow-brand-green/25 transition-all flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (isSpeaking || isLoadingAudio) ? 'KI spricht …' : feedbackButtonLabel}
                                </button>
                            </div>
                            )
                        ) : isMobile ? (
                            voiceMode ? (
                            /* ── Mobile Voice: großer Mic-Button zentriert + Keyboard-Toggle ── */
                            <div className="flex flex-col items-center gap-2 py-1">
                                {/* Feedback pills */}
                                {tooShort && (
                                    <div className="bg-red-500 text-white text-xs font-medium px-3 py-1 rounded-full animate-pulse shadow-sm">
                                        Länger halten
                                    </div>
                                )}
                                {notUnderstood && (
                                    <div className="bg-amber-500 text-white text-xs font-medium px-3 py-1 rounded-full shadow-sm">
                                        Nicht verstanden — erneut sprechen
                                    </div>
                                )}
                                {isListening && audioLevel !== 'ok' && (
                                    <div className="bg-amber-500 text-white text-xs font-medium px-3 py-1 rounded-full shadow-sm animate-pulse">
                                        {audioLevel === 'silent' ? 'Kein Mikrofon-Signal' : 'Mikrofon zu leise — näher sprechen'}
                                    </div>
                                )}
                                {speechError && (
                                    <div className="bg-red-500 text-white text-xs font-medium px-3 py-1 rounded-full shadow-sm max-w-[250px] truncate">
                                        {speechError}
                                    </div>
                                )}
                                {isTranscribing && (
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <div className="w-3 h-3 border-2 border-slate-200 border-t-brand-green rounded-full animate-spin" />
                                        Sprache wird erkannt…
                                    </div>
                                )}

                                <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-brand-green/20 shadow-sm bg-slate-100">
                                    {activeExaminer.image
                                        ? <img src={activeExaminer.image} alt={activeExaminer.name} className="w-full h-full object-cover object-top" />
                                        : <div className="w-full h-full flex items-center justify-center"><BookOpen className="w-5 h-5 text-brand-green" /></div>
                                    }
                                </div>

                                <div className="flex items-center gap-4">
                                    {/* Big PTT button */}
                                    <button
                                        className={cn(
                                            "w-20 h-20 rounded-full flex items-center justify-center transition-all touch-none select-none shadow-lg",
                                            isPttActive
                                                ? "bg-red-500 scale-110 shadow-red-500/40"
                                                : isAcquiringMic
                                                    ? "bg-amber-100 animate-pulse shadow-amber-200/40"
                                                    : isTranscribing
                                                        ? "bg-brand-green/20 animate-pulse shadow-brand-green/20"
                                                        : isLoading
                                                            ? "bg-brand-orange/20 opacity-60 shadow-none animate-pulse"
                                                            : isSpeaking || isLoadingAudio
                                                                ? "bg-slate-200 opacity-50 shadow-none"
                                                                : "bg-brand-green shadow-brand-green/30 active:scale-95"
                                        )}
                                        disabled={isLoading || isSpeaking || isLoadingAudio || examEnded}
                                        aria-label={voiceInputLabel}
                                        onTouchStart={e => { e.preventDefault(); handleOrbMouseDown(); }}
                                        onTouchEnd={e => { e.preventDefault(); handleOrbMouseUp(); }}
                                        onTouchCancel={e => { e.preventDefault(); handleOrbMouseUp(); }}
                                        onMouseDown={handleOrbMouseDown}
                                        onMouseUp={handleOrbMouseUp}
                                        onMouseLeave={handleOrbMouseUp}
                                    >
                                        {isAcquiringMic
                                            ? <div className="w-7 h-7 border-3 border-amber-400/30 border-t-amber-500 rounded-full animate-spin" />
                                            : isTranscribing
                                                ? <div className="w-7 h-7 border-3 border-brand-green/30 border-t-brand-green rounded-full animate-spin" />
                                                : <Mic className={cn("w-8 h-8", isPttActive ? "text-white" : "text-white")} />
                                        }
                                    </button>

                                    {/* Small keyboard toggle */}
                                    <button
                                        onClick={toggleVoiceMode}
                                        className="w-11 h-11 rounded-full flex items-center justify-center bg-slate-100 text-slate-500 active:bg-slate-200 transition-colors"
                                        title="Zu Text wechseln"
                                        aria-label="Zu Texteingabe wechseln"
                                    >
                                        <Keyboard className="w-5 h-5" />
                                    </button>
                                </div>

                                <p className="text-xs text-slate-500 mt-0.5">
                                    {isLoading ? `${examinerFirstName} überlegt…` : isPttActive ? 'Loslassen zum Senden' : isSpeaking ? `${examinerFirstName} spricht…` : isLoadingAudio ? 'Audio wird geladen…' : 'Halten zum Sprechen'}
                                </p>
                            </div>
                            ) : (
                            /* ── Mobile Text: kleiner Mic + Textarea + Send ── */
                            <div className="flex items-end gap-2">
                                {/* Small mic toggle */}
                                <button
                                    onClick={toggleVoiceMode}
                                    className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-brand-green/10 text-brand-green active:bg-brand-green/20 transition-colors self-end mb-1"
                                    title="Zu Sprache wechseln"
                                    aria-label="Zu Spracheingabe wechseln"
                                >
                                    <Mic className="w-4 h-4" />
                                </button>

                                {/* Textarea */}
                                <div className="flex-1 min-w-0">
                                    <textarea
                                        ref={mobileTextareaRef}
                                        id="exam-answer"
                                        name="exam-answer"
                                        value={inputValue}
                                        onChange={e => setInputValue(e.target.value)}
                                        onFocus={pauseTimerForTyping}
                                        onBlur={resumeTimerAfterTyping}
                                        placeholder={isLoading ? `${examinerFirstName} überlegt…` : 'Hier tippen…'}
                                        disabled={isLoading}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all resize-none min-h-[48px] max-h-[140px] placeholder:text-slate-500 text-base leading-snug disabled:opacity-50"
                                        rows={2}
                                    />
                                </div>

                                {/* Send Button */}
                                <button
                                    onClick={handleSendWithTimerResume}
                                    disabled={!inputValue.trim() || isLoading || isTranscribing}
                                    aria-label={sendAnswerLabel}
                                    className="w-12 h-12 bg-brand-green text-white rounded-2xl flex items-center justify-center shrink-0 disabled:opacity-40 transition-all active:bg-brand-green/80 shadow-sm"
                                >
                                    {isLoading
                                        ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        : <Send className="w-5 h-5" />
                                    }
                                </button>
                            </div>
                            )
                        ) : (
                            /* ── Desktop: bisheriges Layout ── */
                            <>
                                <AudioVisualizer isListening={isListening} />
                                {isTranscribing && (
                                    <div className="flex items-center gap-2 px-1 pb-1 text-xs text-slate-500">
                                        <div className="w-3 h-3 border-2 border-slate-200 border-t-brand-green rounded-full animate-spin" />
                                        Sprache wird erkannt…
                                    </div>
                                )}
                                <div className="relative">
                                    {isLoading && (
                                        <div className="absolute inset-0 z-10 flex items-center gap-2 px-4 rounded-2xl bg-slate-50/90 border border-slate-200 pointer-events-none">
                                            <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-brand-orange rounded-full animate-spin shrink-0" />
                                            <span className="text-sm text-slate-500">{examinerFirstName} überlegt…</span>
                                        </div>
                                    )}
                                    <textarea
                                        id="exam-answer"
                                        name="exam-answer"
                                        value={inputValue}
                                        onChange={e => setInputValue(e.target.value)}
                                        onFocus={pauseTimerForTyping}
                                        onBlur={resumeTimerAfterTyping}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendWithTimerResume(); }
                                        }}
                                        disabled={isLoading}
                                        placeholder="Sprechen Sie (⎵) oder tippen Sie hier…"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 pr-28 text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-green/30 focus:border-brand-green transition-all resize-none min-h-[52px] max-h-[120px] shadow-sm placeholder:text-slate-500 text-sm disabled:opacity-50"
                                        rows={2}
                                    />
                                    <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5">
                                        <button
                                            onClick={isListening ? () => stopListening() : startListening}
                                            disabled={isSpeaking || isTranscribing}
                                            aria-label={isListening ? 'Mikrofonaufnahme stoppen' : 'Mikrofonaufnahme starten'}
                                            className={cn(
                                                'w-11 h-11 flex items-center justify-center rounded-xl transition-all',
                                                isListening ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-30'
                                            )}
                                        >
                                            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={handleSendWithTimerResume}
                                            disabled={!inputValue.trim() || isLoading || isTranscribing}
                                            aria-label={sendAnswerLabel}
                                            className="w-11 h-11 flex items-center justify-center bg-brand-green text-white rounded-xl hover:bg-brand-green/80 disabled:opacity-40 transition-all shadow-sm shadow-brand-green/20"
                                        >
                                            <Send className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Mobile End Confirmation Bottom Sheet ── */}
            <AnimatePresence>
                {showEndConfirm && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-70 flex flex-col justify-end"
                        style={{ zIndex: 70 }}
                        onClick={() => setShowEndConfirm(false)}
                    >
                        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="relative bg-white rounded-t-3xl px-5 pt-5 pb-8 shadow-2xl"
                            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 32px)' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                                    <XCircle className="w-5 h-5 text-red-500" />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 text-base">Simulation beenden?</p>
                                    <p className="text-slate-500 text-sm">Die aktuelle Session wird beendet.</p>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2.5 mt-5">
                                <button
                                    onClick={() => { setShowEndConfirm(false); forceEndExam(); }}
                                    aria-label="Simulation endgültig beenden"
                                    className="w-full py-3.5 bg-red-500 text-white font-bold rounded-2xl hover:bg-red-600 transition-colors text-base"
                                >
                                    Beenden
                                </button>
                                <button
                                    onClick={() => setShowEndConfirm(false)}
                                    aria-label="Simulation fortsetzen"
                                    className="w-full py-3.5 bg-slate-100 text-slate-700 font-bold rounded-2xl hover:bg-slate-200 transition-colors text-base"
                                >
                                    Weitermachen
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

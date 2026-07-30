import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
    BarChart3, TrendingUp, Award, BookOpen, AlertCircle, RefreshCw,
    ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, RepeatIcon,
    Target, Trash2
} from 'lucide-react';
import { listSessions, deleteSession, deleteAllSessions } from '../lib/localDb';
import { ExamSession } from '../types';

function formatDuration(start: string | number, end?: string | number): string {
    if (!end) return '—';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const min = Math.round(ms / 60000);
    return `${min} Min.`;
}

function formatDate(start: string | number): string {
    return new Date(start).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function StatsView({ onRepeatExam, onStartExam }: { onRepeatExam?: (subject: string) => void; onStartExam?: () => void }) {
    const [sessions, setSessions] = useState<ExamSession[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [sparklineHoverIdx, setSparklineHoverIdx] = useState<number | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [resetStep, setResetStep] = useState<0 | 1 | 2>(0); // 0=hidden, 1=first confirm, 2=final confirm
    const [resetLoading, setResetLoading] = useState(false);

    useEffect(() => {
        async function loadStats() {
            try {
                setIsLoading(true);
                const data = await listSessions();
                setSessions(data);
            } catch (err: any) {
                setError(err.message || 'Fehler beim Laden der Statistiken');
            } finally {
                setIsLoading(false);
            }
        }
        loadStats();
    }, []);

    const handleDeleteConfirm = async () => {
        if (!deleteConfirmId) return;
        setDeleteLoading(true);
        setDeleteError(null);
        const success = await deleteSession(deleteConfirmId);
        setDeleteLoading(false);
        if (success) {
            setSessions(prev => prev.filter(s => s.id !== deleteConfirmId));
            if (expandedId === deleteConfirmId) setExpandedId(null);
            setDeleteConfirmId(null);
        } else {
            setDeleteError('Fehler beim Löschen. Bitte später erneut versuchen.');
        }
    };

    const handleResetAll = async () => {
        setResetLoading(true);
        const success = await deleteAllSessions();
        setResetLoading(false);
        if (success) {
            setSessions([]);
            setExpandedId(null);
            setResetStep(0);
        }
    };

    if (isLoading) {
        return (
            <div className="flex-1 p-8 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-slate-500">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                    <p>Lade Statistiken...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 p-8 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 text-center bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-sm">
                    <AlertCircle className="w-8 h-8 text-amber-500" />
                    <p className="text-slate-700 font-medium">Statistiken konnten nicht geladen werden.</p>
                    <p className="text-sm text-slate-500">Bitte versuche es später erneut.</p>
                    <button onClick={() => window.location.reload()} className="mt-2 px-5 py-2 bg-brand-green text-white text-sm font-bold rounded-xl hover:brightness-90 transition-colors">
                        Erneut versuchen
                    </button>
                </div>
            </div>
        );
    }

    if (sessions.length === 0) {
        return (
            <div className="flex-1 p-8 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center max-w-md">
                    <div className="w-16 h-16 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center">
                        <BarChart3 className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Noch keine Statistiken</h3>
                    <p className="text-sm text-slate-500">Absolviere deine erste Simulation, um hier deinen Lernverlauf zu sehen.</p>
                    {onStartExam && (
                        <button
                            onClick={onStartExam}
                            className="mt-2 px-6 py-3 bg-brand-green text-white text-sm font-bold rounded-xl hover:brightness-90 transition-colors flex items-center gap-2"
                        >
                            <Target className="w-4 h-4" />
                            Erste Simulation starten
                        </button>
                    )}
                </div>
            </div>
        );
    }

    const totalExams = sessions.length;
    const averageScore = Math.round(
        sessions.reduce((acc, curr) => acc + (curr.feedback?.score || 0), 0) / totalExams
    );

    // Recent sessions: newest first, max 20
    const recentSessions = [...sessions].slice(0, 20);


    const ScoreBar = ({ label, value, color }: { label: string; value?: number; color: string }) => {
        if (value === undefined || value === null) return null;
        return (
            <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-36 flex-shrink-0">{label}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${value}%` }}
                        transition={{ duration: 0.5 }}
                        className={`h-full rounded-full ${color}`}
                    />
                </div>
                <span className="text-xs font-bold text-slate-700 w-10 text-right">{value}%</span>
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Deine Statistiken</h1>
                <p className="text-slate-500 mt-2">{totalExams} Simulationen abgeschlossen.
                    {totalExams >= 30 && <span className="text-brand-green font-medium"> Beeindruckend — du gehörst zu den aktivsten Nutzern.</span>}
                    {totalExams >= 15 && totalExams < 30 && <span className="text-brand-green font-medium"> Starke Routine — bleib dran, es zahlt sich aus.</span>}
                    {totalExams >= 5 && totalExams < 15 && <span className="text-brand-green font-medium"> Guter Einstieg — Regelmäßigkeit ist der Schlüssel.</span>}
                    {totalExams < 5 && totalExams > 0 && <span className="text-slate-500"> Noch wenige Sessions — mit der Zeit siehst du hier deinen Trend.</span>}
                </p>
            </div>

            {/* Sparkline: Score-Trend der letzten Sessions */}
            {sessions.length >= 3 && (() => {
                const last8 = [...sessions].slice(0, 8).reverse();
                const scores = last8.map(s => s.feedback?.score ?? 0);
                const dates = last8.map(s => new Date(s.startTime).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }));
                const minS = Math.min(...scores) - 5;
                const maxS = Math.max(...scores) + 5;
                const range = maxS - minS || 1;
                const w = 320, h = 100, padX = 20, padY = 12;
                const cx = (i: number) => padX + (i / (scores.length - 1)) * (w - 2 * padX);
                const cy = (s: number) => padY + (1 - (s - minS) / range) * (h - 2 * padY);
                const linePoints = scores.map((s, i) => `${cx(i)},${cy(s)}`).join(' ');
                const areaPoints = `${cx(0)},${h - padY} ${linePoints} ${cx(scores.length - 1)},${h - padY}`;
                const trend = scores[scores.length - 1] - scores[0];
                return (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Score-Verlauf</p>
                            <span className={`text-xs font-bold ${trend > 0 ? 'text-brand-green' : trend < 0 ? 'text-red-500' : 'text-slate-500'}`}>
                                {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend)} Punkte
                            </span>
                        </div>
                        <div className="relative">
                            <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-28" style={{ overflow: 'visible' }}>
                                {/* Grid lines */}
                                {[0.25, 0.5, 0.75].map(p => (
                                    <line key={p} x1={padX} x2={w - padX} y1={padY + p * (h - 2 * padY)} y2={padY + p * (h - 2 * padY)} stroke="#e2e8f0" strokeWidth="0.5" />
                                ))}
                                {/* Area fill */}
                                <polygon points={areaPoints} fill="var(--color-brand-green)" opacity="0.08" />
                                {/* Line */}
                                <polyline fill="none" stroke="var(--color-brand-green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={linePoints} />
                                {/* Dots with hover targets */}
                                {scores.map((s, i) => (
                                    <g key={i}>
                                        <circle cx={cx(i)} cy={cy(s)} r="16" fill="transparent" className="cursor-pointer"
                                            onMouseEnter={() => setSparklineHoverIdx(i)} onMouseLeave={() => setSparklineHoverIdx(null)}
                                            onTouchStart={() => setSparklineHoverIdx(i)} onTouchEnd={() => setTimeout(() => setSparklineHoverIdx(null), 1500)}
                                        />
                                        <circle cx={cx(i)} cy={cy(s)} r={sparklineHoverIdx === i ? 5 : 4} fill="white" stroke="var(--color-brand-green)" strokeWidth="2.5" className="pointer-events-none transition-all" />
                                        {sparklineHoverIdx === i && (
                                            <g className="pointer-events-none">
                                                <rect x={cx(i) - 32} y={cy(s) - 34} width="64" height="24" rx="8" fill="var(--color-brand-green)" />
                                                <text x={cx(i)} y={cy(s) - 18.5} textAnchor="middle" fill="white" fontSize="10" fontWeight="700">{s}% · {dates[i]}</text>
                                            </g>
                                        )}
                                    </g>
                                ))}
                            </svg>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 mt-1 px-1">
                            {dates.map((d, i) => <span key={i}>{d}</span>)}
                        </div>
                    </motion.div>
                );
            })()}

            {/* Section 1: Summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between"
                >
                    <div>
                        <p className="text-sm text-slate-500 font-medium mb-1">Ø Score</p>
                        <p className="text-3xl font-bold text-blue-600">{averageScore}%</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                        <TrendingUp className="w-6 h-6" />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between"
                >
                    <div>
                        <p className="text-sm text-slate-500 font-medium mb-1">Simulationen</p>
                        <p className="text-3xl font-bold text-brand-green">{totalExams}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-brand-green/5 flex items-center justify-center text-brand-green">
                        <BookOpen className="w-6 h-6" />
                    </div>
                </motion.div>
            </div>

            {/* Section 2: Letzte Simulationen */}
            <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="mb-10"
            >
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-500" />
                    Letzte Simulationen
                </h2>
                <div className="space-y-3">
                    {recentSessions.map((session, i) => {
                        const passed = session.feedback?.passed;
                        const score = session.feedback?.score ?? 0;
                        const durationMin = session.endTime ? Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000) : 0;
                        const isAborted = score === 0 && durationMin < 5;
                        const isExpanded = expandedId === session.id;
                        const duration = formatDuration(session.startTime, session.endTime);
                        const dateStr = formatDate(session.startTime);
                        const hasMedScores = session.feedback?.medicalScore !== undefined
                            || session.feedback?.communicationScore !== undefined
                            || session.feedback?.structureScore !== undefined;
                        const strengths: string[] = session.feedback?.strengths || [];
                        const weaknesses: string[] = session.feedback?.weaknesses || [];

                        return (
                            <motion.div
                                key={session.id || i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.05 * i }}
                                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                            >
                                {/* Card header row */}
                                <div
                                    className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                                    onClick={() => setExpandedId(isExpanded ? null : (session.id || String(i)))}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-slate-800 text-sm truncate">{session.subject}</span>
                                            <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${isAborted ? 'bg-slate-100 text-slate-500' : passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {isAborted ? 'Abgebrochen' : `${score}%`}
                                            </span>
                                            {passed
                                                ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                                                : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                            }
                                        </div>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-sm text-slate-500">{dateStr}</span>
                                            {duration && (
                                                <span className="text-sm text-slate-500 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {duration}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {onRepeatExam && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onRepeatExam(session.subject);
                                                }}
                                                className="flex items-center gap-1 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 min-h-11 rounded-xl border border-blue-100 transition-colors"
                                            >
                                                <RepeatIcon className="w-3.5 h-3.5" />
                                                {passed ? 'Nochmal üben' : 'Wiederholen'}
                                            </button>
                                        )}
                                        {session.id && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(session.id!); setDeleteError(null); }}
                                                className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 p-1.5 min-w-[44px] min-h-[44px] justify-center rounded-xl border border-red-100 transition-colors"
	                                                title="Simulation löschen"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                        {isExpanded
                                            ? <ChevronUp className="w-4 h-4 text-slate-500 ml-1" />
                                            : <ChevronDown className="w-4 h-4 text-slate-500 ml-1" />
                                        }
                                    </div>
                                </div>

                                {/* Expanded detail panel */}
                                {isExpanded && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="border-t border-slate-100 px-5 py-4 bg-slate-50/60 space-y-4"
                                    >
                                        {/* Summary */}
                                        {session.feedback?.summary && (
                                            <p className="text-sm text-slate-600 leading-relaxed">{session.feedback.summary}</p>
                                        )}

                                        {/* Sub-scores */}
                                        {hasMedScores && (
                                            <div className="space-y-2">
                                                <ScoreBar label="Medizinisches Wissen" value={session.feedback?.medicalScore} color="bg-brand-green" />
                                                <ScoreBar label="Kommunikation" value={session.feedback?.communicationScore} color="bg-brand-orange" />
                                                <ScoreBar label="Struktur" value={session.feedback?.structureScore} color="bg-brand-navy" />
                                            </div>
                                        )}

                                        {/* Strengths & weaknesses */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {strengths.length > 0 && (
                                                <div>
                                                    <p className="text-sm font-bold text-green-700 mb-2 flex items-center gap-1">
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Stärken
                                                    </p>
                                                    <ul className="space-y-1">
                                                        {strengths.map((s, j) => (
                                                            <li key={j} className="text-sm text-slate-600 flex gap-2 leading-relaxed">
                                                                <span className="text-green-500 flex-shrink-0">•</span>
                                                                {s}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            {weaknesses.length > 0 && (
                                                <div>
                                                    <p className="text-sm font-bold text-red-600 mb-2 flex items-center gap-1">
                                                        <XCircle className="w-3.5 h-3.5" /> Wissenslücken
                                                    </p>
                                                    <ul className="space-y-1">
                                                        {weaknesses.map((w, j) => (
                                                            <li key={j} className="text-sm text-slate-600 flex gap-2 leading-relaxed">
                                                                <span className="text-red-400 flex-shrink-0">•</span>
                                                                {w}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        {/* Questions & Answers */}
                                        {(session.feedback?.questions ?? []).length > 0 && (
                                            <div>
                                                <p className="text-sm font-bold text-blue-600 mb-2 flex items-center gap-1">
                                                    <BookOpen className="w-3.5 h-3.5" /> Fragen &amp; Antworten
                                                </p>
                                                <div className="space-y-2">
                                                    {(session.feedback!.questions!).map((q, j) => (
                                                        <div key={j} className="rounded-xl border border-slate-100 overflow-hidden text-sm">
                                                            <div className="flex gap-2 px-3 py-2 bg-slate-100 border-b border-slate-100">
                                                                <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{j + 1}</span>
                                                                <p className="font-semibold text-slate-800 leading-snug">{q.question}</p>
                                                            </div>
                                                            <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
                                                                <div className="px-3 py-2">
                                                                    <span className="text-sm font-bold uppercase tracking-wider text-slate-500 block mb-1">Ihre Antwort</span>
                                                                    <p className="text-slate-600 leading-relaxed">{q.userAnswer}</p>
                                                                </div>
                                                                <div className="px-3 py-2 bg-emerald-50/50">
                                                                    <span className="text-sm font-bold uppercase tracking-wider text-emerald-600 block mb-1">Erwartete Antwort</span>
                                                                    <p className="text-emerald-800 leading-relaxed">{q.expectedAnswer}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </motion.div>
                        );
                    })}
                </div>
            </motion.div>

            {/* Reset all stats */}
            <div className="mt-12 pt-8 border-t border-slate-200">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-bold text-slate-700">Statistiken zurücksetzen</p>
                        <p className="text-sm text-slate-500 mt-0.5">Löscht alle Simulationen und setzt deinen Fortschritt auf Null.</p>
                    </div>
                    <button
                        onClick={() => setResetStep(1)}
                        className="px-4 py-2 text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors"
                    >
                        Zurücksetzen
                    </button>
                </div>
            </div>

            {/* Reset confirmation modal — 2 steps */}
            {resetStep > 0 && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0 bg-black/40 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 w-full max-w-sm max-h-[85dvh] overflow-y-auto"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                                <AlertCircle className="w-4 h-4 text-red-600" />
                            </div>
                            <h3 className="font-bold text-slate-900">
                                {resetStep === 1 ? 'Alle Statistiken löschen?' : 'Wirklich alles löschen?'}
                            </h3>
                        </div>
                        {resetStep === 1 ? (
                            <div className="text-sm text-slate-500 mb-5 leading-relaxed space-y-2">
                                <p>Das wird <strong className="text-red-600">unwiderruflich</strong> gelöscht:</p>
                                <ul className="list-disc pl-4 space-y-1 text-sm">
                                    <li>Alle {sessions.length} Simulationen</li>
                                    <li>Score-Verlauf und Trend-Daten</li>
                                    <li>Bestanden/Nicht-bestanden-Status aller Fälle</li>
                                    <li>Stärken- und Schwächen-Analyse</li>
                                </ul>
                                <p className="text-sm text-red-600 font-medium">Diese Aktion kann nicht rückgängig gemacht werden.</p>
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500 mb-5 leading-relaxed">
                                <p className="text-red-600 font-bold">Letzte Warnung — kein Zurück möglich.</p>
                                <p className="mt-2 text-sm">Alle {sessions.length} Simulationen werden permanent gelöscht. Dein Dashboard startet bei Null.</p>
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setResetStep(0)}
                                disabled={resetLoading}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all disabled:opacity-50"
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={() => resetStep === 1 ? setResetStep(2) : handleResetAll()}
                                disabled={resetLoading}
                                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all disabled:opacity-50"
                            >
                                {resetLoading ? 'Wird gelöscht…' : resetStep === 1 ? 'Weiter' : 'Endgültig löschen'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Delete confirmation modal */}
            {deleteConfirmId && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0 bg-black/40 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 w-full max-w-sm max-h-[85dvh] overflow-y-auto"
                    >
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                                <Trash2 className="w-4 h-4 text-red-600" />
                            </div>
                            <h3 className="font-bold text-slate-900">Simulation löschen?</h3>
                        </div>
                        <p className="text-sm text-slate-500 mb-5 leading-relaxed">
	                            Diese Simulation wird unwiderruflich gelöscht. Der Eintrag kann nicht wiederhergestellt werden.
                        </p>
                        {deleteError && (
                            <p className="text-sm text-red-600 mb-3 font-medium">{deleteError}</p>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setDeleteConfirmId(null); setDeleteError(null); }}
                                disabled={deleteLoading}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50 transition-all disabled:opacity-50"
                            >
                                Abbrechen
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                disabled={deleteLoading}
                                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-all disabled:opacity-50"
                            >
                                {deleteLoading ? 'Löschen…' : 'Ja, löschen'}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

// Helper used inside the component
function ScoreBar({ label, value, color }: { label: string; value?: number; color: string }) {
    if (value === undefined || value === null) return null;
    return (
        <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 w-36 flex-shrink-0">{label}</span>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${value}%` }}
                    transition={{ duration: 0.5 }}
                    className={`h-full rounded-full ${color}`}
                />
            </div>
            <span className="text-xs font-bold text-slate-700 w-10 text-right">{value}%</span>
        </div>
    );
}

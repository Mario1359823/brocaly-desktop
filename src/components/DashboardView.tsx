import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Stethoscope, Activity, CheckCircle2, AlertCircle, Clock, XCircle, Play, BookOpen, ChevronDown, ChevronUp, Circle, RefreshCw, Trash2, Zap, Plus, LayoutDashboard, BarChart3 } from 'lucide-react';
import { cn } from '../lib/utils';
import { User as UserType, ExamSession } from '../types';
import { listSessions, deleteSession } from '../lib/localDb';
import type { CaseProgress } from '../types';
import { examApi } from '../services/api';
import { examDataset } from '../data/examDataset';

export interface CaseProgressProps {
    doneCount: number;
    totalCount: number;
    subject: string;
    failedCount?: number;
    repeatCount?: number;
    passedIds?: string[];
    failedIds?: string[];
    repeatIds?: string[];
}

export const DashboardView = ({ user, onStartExam, onReviewSession, onUpdateUser, caseProgress, studentSubjects }: {
    user: UserType;
    onStartExam: (subject: string, focus?: string, excluded?: string, duration?: number) => void;
    onReviewSession?: (session: ExamSession) => void;
    onUpdateUser?: (updated: UserType) => void;
    caseProgress?: CaseProgressProps;
    studentSubjects?: Array<{ subject: string; caseProgress: CaseProgress; totalCount: number }>;
}) => {
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const [focusTopics, setFocusTopics] = useState('');
    const [excludedTopics, setExcludedTopics] = useState('');
    const [duration, setDuration] = useState(15);
    const [firstSessionIntroCollapsed, setFirstSessionIntroCollapsed] = useState(() =>
        localStorage.getItem('brocaly_first_session_intro_ack') === '1'
    );

    const acknowledgeFirstSessionIntro = () => {
        localStorage.setItem('brocaly_first_session_intro_ack', '1');
        setFirstSessionIntroCollapsed(true);
    };

    const [showCaseList, setShowCaseList] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [caseFilter, setCaseFilter] = useState<'all' | 'passed' | 'failed' | 'repeat' | 'open'>('all');
    const [caseList, setCaseList] = useState<{ id: string; titel: string; tags: string[]; kategorie: string; kategorieLabel: string }[]>([]);
    const [caseListLoading, setCaseListLoading] = useState(false);

    // Student subject expand/collapse state (default: all collapsed)
    const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
    const toggleSubject = (subject: string) => setExpandedSubjects(prev => {
        const next = new Set(prev);
        if (next.has(subject)) next.delete(subject); else next.add(subject);
        return next;
    });

    // Student subject case list state
    const [studentDetailSubject, setStudentDetailSubject] = useState<string | null>(null);
    const [studentCaseFilter, setStudentCaseFilter] = useState<'all' | 'passed' | 'failed' | 'open'>('all');
    const [studentCaseLists, setStudentCaseLists] = useState<Record<string, { id: string; titel: string; tags: string[]; kategorie: string; kategorieLabel: string }[]>>({});
    const [studentCaseListLoading, setStudentCaseListLoading] = useState(false);

    useEffect(() => {
        if (!caseProgress?.subject || !showCaseList || caseList.length > 0) return;
        setCaseListLoading(true);
        examApi.getCaseList(caseProgress.subject)
            .then(setCaseList)
            .catch(() => { })
            .finally(() => setCaseListLoading(false));
    }, [showCaseList, caseProgress?.subject]);

    useEffect(() => {
        if (!studentDetailSubject || studentCaseLists[studentDetailSubject]) return;
        setStudentCaseListLoading(true);
        examApi.getCaseList(studentDetailSubject)
            .then(list => setStudentCaseLists(prev => ({ ...prev, [studentDetailSubject]: list })))
            .catch(() => { })
            .finally(() => setStudentCaseListLoading(false));
    }, [studentDetailSubject]);

    const isStudentPlan = user.role === 'student';
    const isDoctorPlan = user.role === 'doctor';

    // Aktuell sind Simulationen auf 15 Minuten festgelegt.
    React.useEffect(() => {
        if (isStudentPlan) setDuration(15);
    }, [isStudentPlan]);

    const durationPresets = [
        { label: '15 Min', value: 15, desc: 'Standard' },
    ];

    const [statsLoaded, setStatsLoaded] = useState(false);
    const [stats, setStats] = useState({
        totalExams: 0,
        passedExams: 0,
        passRate: 0,
        topStrengths: ['Lade Daten...'],
        topWeaknesses: ['Lade Daten...']
    });

    React.useEffect(() => {
        async function load() {
            if (!user.id) {
                setStats(s => ({ ...s, topStrengths: ['Noch keine Simulation'], topWeaknesses: ['Bitte starten'] }));
                return;
            }
            try {
                const sessions = await listSessions();
                if (sessions.length > 0) {
                    const passed = sessions.filter(s => s.feedback?.passed).length;
                    const passRate = Math.round((passed / sessions.length) * 100);

                    // Filter out fallback errors and MWBO references
                    const FILTER_STRINGS = [
                        'die prüfung wurde vollständig abgeschlossen',
                        'fehlendes ki-datenformat',
                        'fehlendes ai-datenformat',
                        'mwbo',
                        'kernkompetenz der allgemeinmedizin',
                        'kernkompetenz der',
                    ];
                    const isRealFeedback = (s: string) =>
                        s.length > 5 && !FILTER_STRINGS.some(f => s.toLowerCase().includes(f));

                    // Aggregate strengths/weaknesses by frequency across all sessions
                    const strengthCount = new Map<string, number>();
                    const weaknessCount = new Map<string, number>();
                    for (const s of sessions) {
                        for (const str of (s.feedback?.strengths ?? []).filter(isRealFeedback)) {
                            strengthCount.set(str, (strengthCount.get(str) ?? 0) + 1);
                        }
                        for (const w of (s.feedback?.weaknesses ?? []).filter(isRealFeedback)) {
                            weaknessCount.set(w, (weaknessCount.get(w) ?? 0) + 1);
                        }
                    }
                    const topStrengths = [...strengthCount.entries()]
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([s]) => s);
                    const topWeaknesses = [...weaknessCount.entries()]
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([w]) => w);

                    setStats({
                        totalExams: sessions.length,
                        passedExams: passed,
                        passRate,
                        topStrengths: topStrengths.length > 0 ? topStrengths : ['Noch keine Daten'],
                        topWeaknesses: topWeaknesses.length > 0 ? topWeaknesses : ['Noch keine Daten']
                    });
                } else {
                    setStats(s => ({ ...s, topStrengths: ['Noch keine Simulation absolviert'], topWeaknesses: ['Starte deine erste Simulation'] }));
                }
            } catch (err: any) {
                console.error("Dashboard Load Error:", err);
            } finally {
                setStatsLoaded(true);
            }
        }
        load();
    }, [user.id]);

    const handleDeleteRecentSession = (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteConfirmId(sessionId);
    };

    const confirmDelete = async () => {
        if (!deleteConfirmId) return;
        const id = deleteConfirmId;
        setDeleteConfirmId(null);
        const success = await deleteSession(id);
    };


    const effectiveSubject = user.selectedSubject || (user.target === 'Facharztprüfung' ? user.specialtyTarget : undefined) || '';
    const firstStartSubject = effectiveSubject || studentSubjects?.[0]?.subject || '';

    const startNextCase = () => {
        if (firstStartSubject) {
            acknowledgeFirstSessionIntro();
            onStartExam(firstStartSubject, '', '', duration);
        }
    };

    return (
        <div className="px-4 pt-4 pb-28 sm:p-8 max-w-6xl mx-auto overflow-x-hidden">
            {/* Delete session confirm modal */}
            <AnimatePresence>
                {deleteConfirmId && (
                    <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4 pb-4 sm:pb-0">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 260 }}
                            className="bg-white rounded-2xl shadow-xl shadow-slate-900/15 max-w-sm w-full p-6 max-h-[85dvh] overflow-y-auto"
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                </div>
                                <h3 className="font-bold text-slate-900">Simulation löschen?</h3>
                            </div>
                            <p className="text-sm text-slate-500 mb-5">Diese Simulation wird dauerhaft aus deinem Dashboard entfernt.</p>
                            <div className="flex gap-2">
                                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Abbrechen</button>
                                <button onClick={confirmDelete} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors">Ja, löschen</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
            <div className="mb-10">
                <div className="flex items-center gap-2 mb-3">
                    <span className="inline-block w-1 h-6 rounded-full bg-brand-orange" />
                    <span className="text-xs font-bold uppercase tracking-widest text-brand-green">Dashboard</span>
                </div>
                <div className="flex items-center justify-between">
                    <h1 className="text-4xl font-extrabold text-brand-navy mb-2 tracking-tight">{(() => { const h = new Date().getHours(); return h < 5 ? 'Noch wach' : h < 11 ? 'Guten Morgen' : h < 17 ? 'Hallo' : h < 22 ? 'Guten Abend' : 'Noch wach'; })()}, {user.name}</h1>
                </div>
                <p className="text-slate-500 font-medium">Bereit für dein nächstes medizinisches Fachgespräch?</p>
            </div>

            {/* Welcome-Banner bei 0 Sessions */}
            {statsLoaded && stats.totalExams === 0 && (
                firstSessionIntroCollapsed ? (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5 rounded-2xl bg-brand-green/8 border border-brand-green/15 px-4 py-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white border border-brand-green/15 flex items-center justify-center text-brand-green shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                        Super, dann bist du jetzt bereit für deine erste Session mit Brocaly.
                    </p>
                </motion.div>
                ) : (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-10 overflow-hidden rounded-3xl bg-white border border-brand-green/15 shadow-xl shadow-slate-900/5">
                    <div className="grid lg:grid-cols-[1.15fr_0.85fr]">
                        <div className="p-6 sm:p-8">
                            <div className="inline-flex items-center gap-2 rounded-full bg-brand-green/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-green mb-4">
                                <Stethoscope className="w-3.5 h-3.5" />
                                Vor deiner ersten Simulation
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-black text-brand-navy tracking-tight mb-3">
                                Schön, dass du da bist!
                            </h2>
                            <p className="text-slate-600 leading-relaxed max-w-2xl">
                                Starte jetzt deine erste 15-Minuten-Simulation. Du antwortest in einem medizinischen Fachgespräch
                                und bekommst danach eine klare Auswertung mit Stärken, Lernfeldern und nächsten Schritten.
                            </p>

                            <div className="grid sm:grid-cols-3 gap-3 mt-6">
                                {[
                                    { icon: Play, title: 'Erste Simulation', text: 'Starte direkt mit deinem gewählten Fach. Danach weißt du, wo du sicher bist und was du gezielt wiederholen solltest.' },
                                    { icon: BarChart3, title: 'Feedback', text: 'Du bekommst Stärken, Lernfelder und konkrete Hinweise für deine nächste Antwortstruktur.' },
                                    { icon: LayoutDashboard, title: 'Verlauf', text: 'Im Dashboard sammelst du Fortschritt, wiederholst offene Fälle und siehst deinen nächsten Übungsschritt.' },
                                ].map(({ icon: Icon, title, text }) => (
                                    <div key={title} className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                                        <div className="w-9 h-9 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-brand-green mb-3">
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <p className="text-sm font-bold text-slate-900 mb-1">{title}</p>
                                        <p className="text-sm text-slate-500 leading-relaxed">{text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-brand-green/8 to-brand-orange/8 border-t lg:border-t-0 lg:border-l border-brand-green/10 p-6 sm:p-8 flex flex-col justify-center">
                            <p className="text-lg font-bold text-brand-navy mb-2">So gehst du vor</p>
                            <div className="space-y-3 mb-6">
                                {[
                                    'Dein Trainingsfach ist eingerichtet. Du kannst es später in den Einstellungen ändern.',
                                    'Optional kannst du später Schwerpunkte eintragen, wenn du ein Thema gezielt üben willst.',
                                    'Starte jetzt deine erste Simulation und sieh danach dein Feedback mit Stärken und Lernfeldern.',
                                ].map((text, index) => (
                                    <div key={text} className="flex gap-3">
                                        <span className="w-7 h-7 rounded-full bg-white text-brand-green border border-brand-green/15 flex items-center justify-center text-sm font-black shrink-0">
                                            {index + 1}
                                        </span>
                                        <p className="text-sm text-slate-600 leading-relaxed pt-0.5">{text}</p>
                                    </div>
                                ))}
                            </div>
                            <button
                                onClick={startNextCase}
                                disabled={!firstStartSubject}
                                className="w-full sm:w-fit px-6 py-3 bg-brand-green text-white font-bold rounded-xl hover:brightness-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-brand-green/20 text-sm inline-flex items-center justify-center gap-2"
                            >
                                <Play className="w-4 h-4" />
                                Erste Simulation starten
                            </button>
                            <p className="text-xs text-slate-500 leading-relaxed mt-4">
                                Du kannst das Intro auch einfach überspringen, indem du unten ein Fach oder einen Fall startest.
                            </p>
                        </div>
                    </div>
                </motion.div>
                )
            )}

            {/* Student: 4-Fächer-Grid */}
            {user.role === 'student' && studentSubjects && studentSubjects.length > 0 && (
                <div className="mb-12">
                    <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Deine Trainingsfächer</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        {studentSubjects.map(({ subject, caseProgress: cp, totalCount }, idx) => {
                            const passedCount = cp.passedIds.length;
                            const failedCount = cp.failedIds.length;
                            const openCount = Math.max(0, totalCount - passedCount - failedCount - cp.repeatIds.length);
                            const progress = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;
                            const isPflicht = subject === 'Innere Medizin' || subject === 'Chirurgie';
                            const wahlfachNr = idx - 1; // idx 2 → 1, idx 3 → 2
                            const isExpanded = expandedSubjects.has(subject);
                            return (
                                <div key={subject} className="rounded-2xl bg-white/60 backdrop-blur-md border border-white shadow-sm overflow-hidden">
                                    {/* Card header — always visible, click to expand */}
                                    <div className="w-full flex items-center justify-between gap-3 px-4 sm:px-6 py-4 text-left hover:bg-white/40 transition-colors">
                                        <button
                                            onClick={() => toggleSubject(subject)}
                                            className="flex flex-1 min-w-0 items-center gap-3 text-left"
                                        >
                                            <div>
                                                <h3 className="font-bold text-slate-900 text-base break-words">{subject}</h3>
                                                <span className={cn(
                                                    'text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wide',
                                                    isPflicht ? 'bg-brand-green/10 text-brand-green' : 'bg-brand-orange/10 text-brand-orange'
                                                )}>
                                                    {isPflicht ? 'Pflichtfach' : `Wahlfach ${wahlfachNr}`}
                                                </span>
                                            </div>
                                            {totalCount > 0 && !isExpanded && (
                                                <span className="text-xs text-slate-500 font-medium ml-2">{progress}% abgeschlossen</span>
                                            )}
                                        </button>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button
                                                onClick={e => { e.stopPropagation(); onStartExam(subject, focusTopics, excludedTopics, duration); }}
                                                className="flex min-h-11 items-center gap-1.5 px-4 py-2 bg-brand-green text-white rounded-xl text-sm font-bold hover:brightness-90 transition-all shadow-sm shadow-brand-green/25"
                                            >
                                                <Play className="w-3.5 h-3.5" />
                                                Starten
                                            </button>
                                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                                        </div>
                                    </div>

                                    {/* Expanded stats */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-6 pb-5 pt-1 border-t border-slate-100">
                                                    {totalCount > 0 ? (
                                                        <>
                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                                                                {[
                                                                    { key: 'all' as const, count: totalCount, label: 'Gesamt', activeBg: 'bg-slate-200 border-slate-300', inactiveBg: 'bg-slate-50 border-slate-100', text: 'text-slate-700', sub: 'text-slate-500' },
                                                                    { key: 'passed' as const, count: passedCount, label: 'Bestanden', activeBg: 'bg-brand-green/15 border-brand-green/40', inactiveBg: 'bg-brand-green/5 border-brand-green/15', text: 'text-brand-green', sub: 'text-brand-green/60' },
                                                                    { key: 'failed' as const, count: failedCount, label: 'Wiederhol.', activeBg: 'bg-amber-100 border-amber-300', inactiveBg: 'bg-amber-50 border-amber-100', text: 'text-amber-600', sub: 'text-amber-400' },
                                                                    { key: 'open' as const, count: openCount, label: 'Offen', activeBg: 'bg-brand-orange/15 border-brand-orange/40', inactiveBg: 'bg-brand-orange/5 border-brand-orange/15', text: 'text-brand-orange', sub: 'text-brand-orange/60' },
                                                                ].map(t => (
                                                                    <button
                                                                        key={t.key}
                                                                        onClick={() => {
                                                                            if (studentDetailSubject === subject && studentCaseFilter === t.key) {
                                                                                setStudentDetailSubject(null);
                                                                            } else {
                                                                                setStudentDetailSubject(subject);
                                                                                setStudentCaseFilter(t.key);
                                                                            }
                                                                        }}
                                                                        className={cn(
                                                                            'rounded-xl p-2 text-center border transition-all hover:scale-[1.03] cursor-pointer',
                                                                            studentDetailSubject === subject && studentCaseFilter === t.key ? t.activeBg : t.inactiveBg
                                                                        )}
                                                                    >
                                                                        <div className={cn('text-lg font-extrabold', t.text)}>{t.count}</div>
                                                                        <div className={cn('text-xs font-semibold uppercase tracking-wide', t.sub)}>{t.label}</div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <div className="w-full bg-slate-100 rounded-full h-1.5 mb-1">
                                                                <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                                                            </div>
                                                            <div className="text-right text-xs text-slate-500 font-medium">{progress}% abgeschlossen</div>
                                                        </>
                                                    ) : (
                                                        <p className="text-sm text-slate-500 font-medium">Noch keine Fälle bearbeitet</p>
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>

                    {/* Student case list panel */}
                    <AnimatePresence>
                        {studentDetailSubject && (
                            <motion.div
                                key={studentDetailSubject + studentCaseFilter}
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <div className="mt-3 border border-slate-200 rounded-2xl overflow-hidden max-h-80 overflow-y-auto bg-white">
                                    <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between gap-3">
                                        <span className="text-sm font-bold text-slate-600 uppercase tracking-widest leading-snug">
                                            {studentDetailSubject} — {{ all: 'Alle Fälle', passed: 'Bestanden', failed: 'Wiederholen', open: 'Offen' }[studentCaseFilter]}
                                        </span>
                                        <button onClick={() => setStudentDetailSubject(null)} className="min-w-11 min-h-11 flex items-center justify-center text-sm text-slate-500 hover:text-slate-600 font-semibold rounded-xl hover:bg-slate-100 transition-colors" aria-label="Fallliste schließen">✕</button>
                                    </div>
                                    {studentCaseListLoading ? (
                                        <div className="flex items-center justify-center py-8 gap-2 text-slate-500">
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            <span className="text-sm">Lade Fälle...</span>
                                        </div>
                                    ) : (() => {
                                        const list = studentCaseLists[studentDetailSubject] || [];
                                        const cp = studentSubjects?.find(s => s.subject === studentDetailSubject)?.caseProgress;
                                        const filtered = list.filter(c => {
                                            if (!cp) return true;
                                            if (studentCaseFilter === 'passed') return cp.passedIds.includes(c.id);
                                            if (studentCaseFilter === 'failed') return cp.failedIds.includes(c.id);
                                            if (studentCaseFilter === 'open') return !cp.passedIds.includes(c.id) && !cp.failedIds.includes(c.id) && !cp.repeatIds.includes(c.id);
                                            return true;
                                        });
                                        if (filtered.length === 0) return <div className="py-6 text-center text-sm text-slate-500">Keine Fälle in dieser Kategorie.</div>;
                                        return (
                                            <div className="divide-y divide-slate-100">
                                                {filtered.map(c => {
                                                    const isPassed = cp?.passedIds.includes(c.id);
                                                    const isFailed = cp?.failedIds.includes(c.id);
                                                    const isRepeat = cp?.repeatIds.includes(c.id);
                                                    return (
                                                        <div
                                                            key={c.id}
                                                            className={cn('flex flex-col sm:flex-row sm:items-center gap-3 px-3 sm:px-4 py-3 text-sm min-w-0', isPassed ? 'bg-emerald-50/40' : isFailed ? 'bg-amber-50/40' : 'bg-white')}
                                                        >
                                                            <div className="flex min-w-0 flex-1 items-start gap-3">
                                                                {isPassed ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                                                                    : isFailed ? <XCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                                                        : isRepeat ? <RefreshCw className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                                                                            : <Circle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />}
                                                                <div className="min-w-0 flex-1">
                                                                    <p className={cn('font-medium leading-snug break-words', isPassed ? 'text-emerald-800' : isFailed ? 'text-amber-800' : 'text-slate-600')}>
                                                                        {c.titel}
                                                                    </p>
                                                                    {c.tags[0] && (
                                                                        <span className="mt-2 inline-flex max-w-full rounded-lg bg-slate-100 px-2 py-1 text-sm font-medium text-slate-500">
                                                                            <span className="truncate">{c.tags[0]}</span>
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => onStartExam(studentDetailSubject, c.titel, '', duration)}
                                                                className="w-full sm:w-auto min-h-11 text-sm font-bold text-brand-green bg-brand-green/8 border border-brand-green/20 px-4 py-2 rounded-xl hover:bg-brand-green/15 transition-colors shrink-0"
                                                            >
                                                                <Play className="w-3 h-3 inline mr-0.5" />
                                                                Prüfen
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Konfiguration */}
                    <div className="mt-4 p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-white shadow-sm space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
	                                Simulationsdauer
                            </label>
                            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-green/8 border border-brand-green/20 w-fit">
                                <span className="font-bold text-sm text-brand-green">15 Min</span>
                                <span className="text-xs text-brand-green/60">· aktuell festgelegt</span>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Schwerpunkte (optional)
                            </label>
                            <textarea
                                value={focusTopics}
                                onChange={e => setFocusTopics(e.target.value)}
                                placeholder="z.B. Kardiologie, EKG-Auswertung..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green transition-all resize-none h-16 placeholder:text-slate-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <XCircle className="w-3.5 h-3.5 text-red-400" />
                                Themen ausschließen (optional)
                            </label>
                            <textarea
                                value={excludedTopics}
                                onChange={e => setExcludedTopics(e.target.value)}
                                placeholder="z.B. Pädiatrie, seltene Syndrome..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all resize-none h-16 placeholder:text-slate-500"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Hero-Karte "Simulation starten" */}
            {user.role !== 'student' && <div className="relative overflow-hidden p-8 rounded-2xl bg-white border border-brand-green/12 shadow-xl shadow-brand-green/6 mb-10">
                <div className="absolute top-0 right-0 w-[420px] h-[420px] bg-gradient-to-br from-brand-green/12 to-brand-orange/8 blur-[56px] rounded-full -z-10 translate-x-1/3 -translate-y-1/3" />
                {/* EKG decoration */}
                <svg viewBox="0 0 600 50" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute bottom-0 left-0 right-0 w-full opacity-[0.06] pointer-events-none" preserveAspectRatio="none">
                    <path d="M0,25 L80,25 L90,21 L100,25 L110,25 L122,5 L130,45 L138,2 L146,25 L160,25 L220,25 L232,21 L242,25 L252,25 L264,5 L272,45 L280,2 L288,25 L300,25 L360,25 L372,21 L382,25 L392,25 L404,5 L412,45 L420,2 L428,25 L440,25 L600,25" stroke="var(--color-brand-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex-1">
                        <h2 className="text-3xl font-bold text-brand-navy mb-2 tracking-tight">Simulation starten</h2>
                        <div className="flex flex-col items-start gap-1.5 mb-6">
                            <p className="text-slate-500 font-medium">Starte deine nächste Übungssimulation.</p>
                            {effectiveSubject && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-brand-green/10 border border-brand-green/20 text-brand-green text-sm font-semibold">
                                    <BookOpen className="w-3.5 h-3.5" />
                                    {effectiveSubject}
                                </span>
                            )}
                        </div>

                        {/* Fallfortschritt */}
                        {caseProgress && caseProgress.totalCount > 0 && (
                            <div className="mb-6">
                                {/* Stat-Kacheln — klickbar zum Filtern */}
                                {(() => {
                                    const openCount = caseProgress.totalCount - caseProgress.doneCount - (caseProgress.failedCount ?? 0) - (caseProgress.repeatCount ?? 0);
                                    const tiles = [
                                        { key: 'all' as const, count: caseProgress.totalCount, label: 'Gesamt', active: 'bg-slate-200 border-slate-300', inactive: 'bg-slate-50 border-slate-100', text: 'text-slate-800', sub: 'text-slate-500' },
                                        { key: 'passed' as const, count: caseProgress.doneCount, label: 'Bestanden', active: 'bg-brand-green/15 border-brand-green/40', inactive: 'bg-brand-green/5 border-brand-green/15', text: 'text-brand-green', sub: 'text-brand-green/60' },
                                        { key: 'failed' as const, count: caseProgress.failedCount ?? 0, label: 'Wiederholen', active: 'bg-amber-100 border-amber-300', inactive: 'bg-amber-50 border-amber-100', text: 'text-amber-600', sub: 'text-amber-400' },
                                        { key: 'open' as const, count: openCount, label: 'Offen', active: 'bg-brand-orange/15 border-brand-orange/40', inactive: 'bg-brand-orange/5 border-brand-orange/15', text: 'text-brand-orange', sub: 'text-brand-orange/60' },
                                    ];
                                    return (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                                            {tiles.map(t => (
                                                <button
                                                    key={t.key}
                                                    onClick={() => {
                                                        if (caseFilter === t.key && showCaseList) {
                                                            setShowCaseList(false);
                                                        } else {
                                                            setCaseFilter(t.key);
                                                            setShowCaseList(true);
                                                        }
                                                    }}
                                                    className={cn(
                                                        'border rounded-2xl p-3 text-center transition-all cursor-pointer hover:scale-[1.03]',
                                                        caseFilter === t.key && showCaseList ? t.active : t.inactive
                                                    )}
                                                >
                                                    <div className={cn('text-2xl font-extrabold', t.text)}>{t.count}</div>
                                                    <div className={cn('text-xs font-semibold uppercase tracking-wide mt-0.5', t.sub)}>{t.label}</div>
                                                </button>
                                            ))}
                                        </div>
                                    );
                                })()}

                                {/* Fortschrittsbalken */}
                                <div className="w-full bg-slate-100 rounded-full h-2 mb-3">
                                    <div
                                        className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2 rounded-full transition-all duration-700"
                                        style={{ width: `${Math.round((caseProgress.doneCount / caseProgress.totalCount) * 100)}%` }}
                                    />
                                </div>

                                {/* Fallliste ausklappen */}
                                <button
                                    onClick={() => { setCaseFilter('all'); setShowCaseList(v => !v); }}
                                    className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 transition-colors"
                                >
                                    <span className="flex items-center gap-2">
                                        <BookOpen className="w-4 h-4 text-slate-500" />
                                        {showCaseList
                                            ? { all: 'Alle Fälle', passed: 'Sicher bearbeitete Fälle', failed: 'Zu wiederholende Fälle', repeat: 'Zu wiederholende Fälle', open: 'Offene Fälle' }[caseFilter]
                                            : 'Alle Fälle anzeigen'
                                        }
                                    </span>
                                    {showCaseList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>

                                <AnimatePresence>
                                    {showCaseList && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden"
                                        >
                                            <div className="mt-2 border border-slate-200 rounded-2xl overflow-hidden max-h-80 overflow-y-auto">
                                                {caseListLoading ? (
                                                    <div className="flex items-center justify-center py-8 gap-2 text-slate-500">
                                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                                        <span className="text-sm">Lade Fälle...</span>
                                                    </div>
                                                ) : caseList.length === 0 ? (
                                                    <div className="py-6 text-center text-sm text-slate-500">Keine Fälle gefunden.</div>
                                                ) : (
                                                    <div className="divide-y divide-slate-100">
                                                        {caseList.filter(c => {
                                                            if (caseFilter === 'passed') return caseProgress.passedIds?.includes(c.id);
                                                            if (caseFilter === 'failed') return caseProgress.failedIds?.includes(c.id);
                                                            if (caseFilter === 'repeat') return caseProgress.repeatIds?.includes(c.id);
                                                            if (caseFilter === 'open') return !caseProgress.passedIds?.includes(c.id) && !caseProgress.failedIds?.includes(c.id) && !caseProgress.repeatIds?.includes(c.id);
                                                            return true;
                                                        }).map(c => {
                                                            const isPassed = caseProgress.passedIds?.includes(c.id);
                                                            const isFailed = caseProgress.failedIds?.includes(c.id);
                                                            const isRepeat = caseProgress.repeatIds?.includes(c.id);
                                                            return (
                                                                <div
                                                                    key={c.id}
                                                                    className={cn(
                                                                        'flex flex-col sm:flex-row sm:items-center gap-3 px-3 sm:px-4 py-3 text-sm min-w-0',
                                                                        isPassed ? 'bg-emerald-50/40' : isFailed ? 'bg-amber-50/40' : 'bg-white'
                                                                    )}
                                                                >
                                                                    <div className="flex min-w-0 flex-1 items-start gap-3">
                                                                        {isPassed ? (
                                                                            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                                                                        ) : isFailed ? (
                                                                            <XCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                                                        ) : isRepeat ? (
                                                                            <RefreshCw className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                                                                        ) : (
                                                                            <Circle className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                                                                        )}
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className={cn('font-medium leading-snug break-words', isPassed ? 'text-emerald-800' : isFailed ? 'text-amber-800' : 'text-slate-600')}>
                                                                                {c.titel}
                                                                            </p>
                                                                            {c.tags[0] && (
                                                                                <span className="mt-2 inline-flex max-w-full rounded-lg bg-slate-100 px-2 py-1 text-sm font-medium text-slate-500">
                                                                                    <span className="truncate">{c.tags[0]}</span>
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center justify-end gap-2 sm:justify-start">
                                                                        {c.tags[0] && (
                                                                            <span className="hidden max-w-[120px] truncate text-right text-sm font-medium text-slate-500 sm:block shrink-0">
                                                                                {c.tags[0]}
                                                                            </span>
                                                                        )}
                                                                        <button
                                                                            onClick={e => {
                                                                                e.stopPropagation();
                                                                                const title = c.titel;
                                                                                const current = focusTopics.split(',').map(s => s.trim()).filter(Boolean);
                                                                                if (current.includes(title)) {
                                                                                    setFocusTopics(current.filter(s => s !== title).join(', '));
                                                                                } else {
                                                                                    setFocusTopics([...current, title].join(', '));
                                                                                }
                                                                            }}
                                                                            title={focusTopics.split(',').map(s => s.trim()).includes(c.titel) ? 'Schwerpunkt entfernen' : 'Als Schwerpunkt hinzufügen'}
                                                                            className={cn(
                                                                                'shrink-0 min-w-11 min-h-11 rounded-full flex items-center justify-center transition-all',
                                                                                focusTopics.split(',').map(s => s.trim()).includes(c.titel)
                                                                                    ? 'bg-brand-green text-white'
                                                                                    : 'bg-slate-100 text-slate-500 hover:bg-brand-green/10 hover:text-brand-green'
                                                                            )}
                                                                        >
                                                                            {focusTopics.split(',').map(s => s.trim()).includes(c.titel)
                                                                                ? <CheckCircle2 className="w-4 h-4" />
                                                                                : <Plus className="w-4 h-4" />
                                                                            }
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        )}

                        {/* Inline-Konfiguration — immer sichtbar */}
                        <div className="mt-5 pt-5 border-t border-slate-100 space-y-5">
                            {/* Zu wiederholende Themen als Schwerpunkt */}
                            {caseProgress && (caseProgress.failedIds?.length ?? 0) > 0 && caseList.length > 0 && (() => {
                                const failedCases = caseList.filter(c => caseProgress.failedIds?.includes(c.id));
                                const uniqueTags = [...new Set(failedCases.flatMap(c => c.tags))];
                                return (
                                    <div>
                                        <label className="block text-xs font-bold text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                            <XCircle className="w-3.5 h-3.5" />
                                            Zu wiederholende Themen als Schwerpunkt
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {uniqueTags.map(tag => {
                                                const active = focusTopics.includes(tag);
                                                return (
                                                    <button
                                                        key={tag}
                                                        onClick={() => {
                                                            if (active) {
                                                                setFocusTopics(prev => prev.split(', ').filter(t => t !== tag).join(', '));
                                                            } else {
                                                                setFocusTopics(prev => prev ? `${prev}, ${tag}` : tag);
                                                            }
                                                        }}
                                                        className={cn(
                                                            'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                                                            active
                                                                ? 'bg-amber-500 text-white border-amber-500'
                                                                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                                        )}
                                                    >
                                                        {tag}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Dauer */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" />
	                                Simulationsdauer
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-slate-800">15 Min</span>
                                    <span className="text-xs text-slate-500">Standard</span>
                                </div>
                            </div>

                            {/* Schwerpunkt */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Schwerpunkte (optional)
                                </label>
                                <textarea
                                    value={focusTopics}
                                    onChange={e => setFocusTopics(e.target.value)}
                                    placeholder="z.B. Kardiologie, EKG-Auswertung..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-green/50 focus:border-brand-green transition-all resize-none h-16 placeholder:text-slate-500"
                                />
                            </div>

                            {/* Ausschließen */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                                    Themen ausschließen (optional)
                                </label>
                                <textarea
                                    value={excludedTopics}
                                    onChange={e => setExcludedTopics(e.target.value)}
                                    placeholder="z.B. Pädiatrie, seltene Syndrome..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-400/50 focus:border-red-400 transition-all resize-none h-16 placeholder:text-slate-500"
                                />
                            </div>

                            {!effectiveSubject && !selectedSubject.trim() && (
                                <p className="text-xs text-amber-600 font-medium flex items-center gap-1.5 -mb-1">
                                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                    Bitte zuerst ein Fachgebiet in den Einstellungen auswählen.
                                </p>
                            )}
                            <button
                                onClick={() => {
                                    const subject = effectiveSubject || selectedSubject.trim();
                                    if (!subject) return;
                                    onStartExam(subject, focusTopics, excludedTopics, duration);
                                }}
                                disabled={!effectiveSubject && !selectedSubject.trim()}
                                className="w-full py-3.5 bg-gradient-to-r from-brand-green to-emerald-500 text-white font-bold rounded-2xl hover:brightness-90 disabled:opacity-50 transition-all shadow-lg shadow-brand-green/25 flex items-center justify-center gap-2"
                            >
                                <Play className="w-4 h-4" />
                                Simulation starten
                            </button>
                        </div>
                    </div>
                </div>
            </div>}




            {/* Disclaimer */}
            <div className="mt-12 p-4 rounded-2xl bg-amber-50 border border-amber-200/70 flex gap-3">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 leading-relaxed">
                    <strong>Wichtig:</strong> BROCA<span className="text-brand-orange">LY</span> dient ausschließlich der Simulation medizinischer Fachgespräche. KI-generierte Inhalte können fehlerhaft, unvollständig oder veraltet sein und werden nicht menschlich kontrolliert. Prüfe medizinische Inhalte immer eigenverantwortlich anhand verlässlicher Quellen. BROCA<span className="text-brand-orange">LY</span> ist kein medizinisches Lehrwerk und ersetzt keine medizinische Beratung, Diagnose oder Behandlungsempfehlung.
                </p>
            </div>
        </div >
    );
};

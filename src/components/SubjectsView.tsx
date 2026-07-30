import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, AlertTriangle, Clock, Target, PlayCircle, ChevronRight, Stethoscope, CheckCircle2, ArrowLeft } from 'lucide-react';
import { examDataset } from '../data/examDataset';
import { listSessions, loadCaseProgress } from '../lib/localDb';
import type { CaseProgress } from '../types';
import { examApi } from '../services/api';
import { ExamSession } from '../types';

interface SubjectsViewProps {
    onStartExam: (subject: string, focus?: string) => void;
}

export function SubjectsView({ onStartExam }: SubjectsViewProps) {
    const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
    const [pastSessions, setPastSessions] = useState<ExamSession[]>([]);
    const [subjectCaseProgress, setSubjectCaseProgress] = useState<CaseProgress | null>(null);
    const [subjectTotalCases, setSubjectTotalCases] = useState(0);
    // Mobile detail view toggle — on desktop this is always handled by the sidebar selection
    const [mobileShowDetail, setMobileShowDetail] = useState(false);

    useEffect(() => {
        listSessions()
            .then(setPastSessions)
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!selectedSubjectId) {
            setSubjectCaseProgress(null);
            setSubjectTotalCases(0);
            return;
        }
        const subjectLabel = (examDataset.specialties as any)[selectedSubjectId]?.label;
        if (!subjectLabel) return;
        setSubjectCaseProgress(null);
        setSubjectTotalCases(0);
        Promise.all([
            loadCaseProgress(subjectLabel),
            examApi.getCaseCount(subjectLabel),
        ]).then(([progress, total]) => {
            setSubjectCaseProgress(progress);
            setSubjectTotalCases(total);
        }).catch(() => {});
    }, [selectedSubjectId]);

    const specialties = Object.entries(examDataset.specialties).filter(([, data]) => !(data as any).hidden);

    const handleSelectSubject = (id: string) => {
        setSelectedSubjectId(id);
        setMobileShowDetail(true);
    };

    const handleMobileBack = () => {
        setMobileShowDetail(false);
    };

    // Shared detail panel content
    const renderDetailContent = () => {
        if (!selectedSubjectId) return null;
        const data = (examDataset.specialties as any)[selectedSubjectId];
        if (!data) return null;

        const mustKnows = data.must_know_topics || data.key_topics_by_frequency || data.must_know || [];
        const classicCases = data.classic_cases || [];

        const subjectSessions = pastSessions.filter(s => s.subject === data.label);
        const coveredTopics: string[] = subjectSessions.flatMap(s =>
            Array.isArray(s.topicsCovered) ? s.topicsCovered : []
        );

        const getTopicCount = (topic: string): number => {
            const keyword = topic.toLowerCase().slice(0, 10);
            return coveredTopics.filter(ct =>
                ct.toLowerCase().includes(keyword) || keyword.includes(ct.toLowerCase())
            ).length;
        };

        const isTopicCovered = (topic: string): boolean => {
            const keyword = topic.toLowerCase().slice(0, 10);
            return coveredTopics.some(ct =>
                ct.toLowerCase().includes(keyword) || keyword.includes(ct.toLowerCase())
            );
        };

        return (
            <div className="space-y-5 md:space-y-8 pb-12">
                {/* Header card */}
                <div className="bg-white rounded-2xl md:rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-5 md:p-8">
                        <div className="flex flex-col gap-4 mb-5 md:mb-6">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-xl border border-slate-200 uppercase tracking-wide">
                                        Syllabus
                                    </span>
                                </div>
                                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 leading-tight">{data.label}</h2>
                            </div>

                            {/* Zufalls-Prüfung button — full width on mobile */}
                            <button
                                onClick={() => onStartExam(data.label)}
                                className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3.5 md:py-3 bg-gradient-to-br from-brand-green to-emerald-500 text-white font-bold rounded-xl hover:from-brand-green/80 hover:to-brand-green shadow-md shadow-brand-green/20 transition-all group text-sm md:text-base"
                            >
                                <PlayCircle className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                Zufalls-Prüfung starten
                            </button>
                        </div>

                        {/* Case progress bar */}
                        {subjectTotalCases > 0 && subjectCaseProgress && (
                            <div className="mt-4 p-4 rounded-2xl bg-brand-green/5 border border-brand-green/15">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-brand-green uppercase tracking-widest flex items-center gap-1.5">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Fallfortschritt
                                    </span>
                                    <span className="text-xs font-bold text-emerald-600">
                                        {subjectCaseProgress.passedIds.length} / {subjectTotalCases} bestanden
                                    </span>
                                </div>
                                <div className="w-full bg-blue-100 rounded-full h-2.5 mb-2">
                                    <div
                                        className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2.5 rounded-full transition-all duration-700"
                                        style={{ width: `${Math.round((subjectCaseProgress.passedIds.length / subjectTotalCases) * 100)}%` }}
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-slate-500 font-medium">
                                        {Math.round((subjectCaseProgress.passedIds.length / subjectTotalCases) * 100)}% abgeschlossen
                                    </p>
                                    <div className="flex gap-2 flex-wrap justify-end">
                                        {subjectCaseProgress.failedIds.length > 0 && (
                                            <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-xl">
                                                {subjectCaseProgress.failedIds.length} nicht bestanden
                                            </span>
                                        )}
                                        {subjectCaseProgress.repeatIds.length > 0 && (
                                            <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-xl">
                                                {subjectCaseProgress.repeatIds.length} wiederholen
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Must-know topics */}
                {mustKnows.length > 0 && (
                    <div className="bg-white rounded-2xl md:rounded-2xl shadow-sm border border-slate-200 p-5 md:p-8">
                        <h3 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-3 mb-5 md:mb-6">
                            <Target className="w-5 md:w-6 h-5 md:h-6 text-brand-green flex-shrink-0" />
                            Top-Themen der Prüfungskommissionen
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                            {mustKnows.slice(0, 14).map((topic: string, i: number) => {
                                const covered = isTopicCovered(topic);
                                const count = getTopicCount(topic);
                                return (
                                    <div
                                        key={i}
                                        className="flex gap-3 p-3 bg-slate-50/50 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-colors group cursor-pointer items-start min-h-[48px]"
                                        onClick={() => onStartExam(data.label, topic)}
                                    >
                                        <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-500 text-xs font-bold flex items-center justify-center flex-shrink-0 group-hover:bg-brand-green/10 group-hover:text-brand-green transition-colors mt-0.5">
                                            {i + 1}
                                        </div>
                                        <span className="text-sm text-slate-700 font-medium leading-relaxed flex-1">
                                            {topic}
                                        </span>
                                        <div className="flex items-center gap-1 flex-shrink-0 ml-1 mt-0.5">
                                            {covered && (
                                                <span className="flex items-center gap-0.5 text-xs font-bold text-green-700 bg-green-50 border border-green-100 px-1.5 py-0.5 rounded-xl">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    {count > 0 ? `${count}x` : '✓'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Classic cases */}
                {classicCases.length > 0 && (
                    <div>
                        <h3 className="text-lg md:text-xl font-bold text-slate-800 flex items-center gap-3 mb-5 md:mb-6">
                            <Stethoscope className="w-5 md:w-6 h-5 md:h-6 text-emerald-500 flex-shrink-0" />
                            Klassische Erst-Fälle
                        </h3>
                        <div className="space-y-3 md:space-y-4">
                            {classicCases.map((c: any, i: number) => (
                                <div key={i} className="bg-white p-5 md:p-6 rounded-2xl shadow-sm border border-slate-200 relative overflow-hidden group">
                                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                                    <div className="flex justify-between items-start gap-3 mb-3 md:mb-4">
                                        <h4 className="font-bold text-slate-900 text-base md:text-lg leading-snug flex-1">{c.title}</h4>
                                        {/* Always visible on mobile, hover-reveal on desktop */}
                                        <button
                                            onClick={() => onStartExam(data.label, c.title)}
                                            className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl hover:bg-emerald-100 transition-colors border border-emerald-100 flex items-center gap-1 flex-shrink-0 md:opacity-0 md:group-hover:opacity-100"
                                        >
                                            <PlayCircle className="w-3 h-3" />
                                            <span className="hidden sm:inline">Diesen Fall prüfen</span>
                                            <span className="sm:hidden">Prüfen</span>
                                        </button>
                                    </div>
                                    <p className="text-slate-600 text-sm border-l-2 border-slate-200 pl-4 py-1 mb-3 md:mb-4">"{c.vignette}"</p>
                                    <div className="bg-slate-50 rounded-xl p-3 md:p-4 border border-slate-100">
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Im Protokoll erwartete Checkpoints:</span>
                                        <div className="flex flex-wrap gap-1.5 md:gap-2">
                                            {c.expected_answers_keywords.map((kw: string, j: number) => (
                                                <span key={j} className="text-xs font-medium text-slate-700 bg-white border border-slate-200 px-2 py-1 rounded-xl shadow-sm">
                                                    {kw}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto w-full bg-slate-50 relative">

            {/* ── MOBILE LAYOUT (< md) ─────────────────────────────────────── */}
            <div className="md:hidden flex flex-col min-h-full">
                <AnimatePresence mode="wait" initial={false}>
                    {mobileShowDetail && selectedSubjectId ? (
                        /* Mobile: detail view */
                        <motion.div
                            key="mobile-detail"
                            initial={{ opacity: 0, x: 40 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 40 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            className="flex flex-col flex-1"
                        >
                            {/* Back bar */}
                            <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm">
                                <button
                                    onClick={handleMobileBack}
                                    className="flex items-center gap-1.5 text-sm font-semibold text-brand-green hover:text-brand-green/80 active:text-brand-green/80 transition-colors min-h-[44px] pr-2"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Zurück
                                </button>
                                <span className="text-sm font-bold text-slate-800 truncate">
                                    {(examDataset.specialties as any)[selectedSubjectId]?.label}
                                </span>
                            </div>

                            {/* Detail content */}
                            <div className="flex-1 px-4 pt-5 pb-10">
                                {renderDetailContent()}
                            </div>
                        </motion.div>
                    ) : (
                        /* Mobile: subject list */
                        <motion.div
                            key="mobile-list"
                            initial={{ opacity: 0, x: -40 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -40 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            className="flex flex-col flex-1 px-4 pt-6 pb-10"
                        >
                            <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-1">Fachgebiete</h1>
                            <p className="text-sm text-slate-500 mb-3 leading-relaxed">
                                Starte eine Simulation in jedem Fachgebiet — unabhängig von deinem Hauptfach. Dein Dashboard und Fortschritt bleiben davon unberührt.
                            </p>
                            <p className="text-sm text-slate-500 mb-5">Dein Hauptfach mit vorgefertigtem Lernplan (~100 Fälle) legst du in den Einstellungen fest.</p>

                            <div className="space-y-2">
                                {specialties.map(([id, data]) => {
                                    const isSelected = selectedSubjectId === id;
                                    return (
                                        <button
                                            key={id}
                                            onClick={() => handleSelectSubject(id)}
                                            className={`w-full text-left px-4 py-3.5 rounded-2xl transition-all flex items-center justify-between gap-3 min-h-[60px] border ${
                                                isSelected
                                                    ? 'bg-blue-50 border-blue-200/70 shadow-sm'
                                                    : 'bg-white border-slate-200/80 shadow-sm active:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <div className={`w-9 h-9 rounded-xl flex flex-shrink-0 items-center justify-center ${
                                                    isSelected
                                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                                        : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    <BookOpen className="w-4 h-4" />
                                                </div>
                                                <span className={`text-sm font-semibold truncate ${
                                                    isSelected ? 'text-blue-900' : 'text-slate-800'
                                                }`}>
                                                    {(data as any).label}
                                                </span>
                                            </div>
                                            <ChevronRight className={`w-4 h-4 flex-shrink-0 transition-transform ${
                                                isSelected ? 'text-blue-400 rotate-90' : 'text-slate-500'
                                            }`} />
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ── DESKTOP LAYOUT (≥ md) ─────────────────────────────────────── */}
            <div className="hidden md:flex flex-row w-full h-full pb-10">
                {/* Sidebar — full width when nothing selected, narrow when detail open */}
                <div className={`${selectedSubjectId ? 'w-[320px]' : 'w-full max-w-2xl mx-auto'} flex-shrink-0 ${selectedSubjectId ? 'border-r border-slate-200 bg-white/50 backdrop-blur-md shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)]' : ''} h-full flex flex-col pt-8 px-6 z-10 sticky top-0 overflow-y-auto transition-all duration-300`}>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">Fachgebiete</h1>
                    <p className="text-sm text-slate-500 mb-2">Starte eine Simulation in jedem Fachgebiet — unabhängig von deinem Hauptfach.</p>
                    <p className="text-sm text-slate-500 mb-6">Dein Hauptfach mit Lernplan (~100 Fälle) legst du in den Einstellungen fest.</p>

                    <div className="space-y-2">
                        {specialties.map(([id, data]) => {
                            const isSelected = selectedSubjectId === id;
                            return (
                                <button
                                    key={id}
                                    onClick={() => setSelectedSubjectId(isSelected ? null : id)}
                                    className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group ${
                                        isSelected
                                            ? 'bg-blue-50 border border-blue-200/50 shadow-sm'
                                            : 'hover:bg-slate-100/80 border border-transparent'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-xl flex flex-shrink-0 items-center justify-center ${
                                            isSelected
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                                : 'bg-slate-200/70 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700'
                                        }`}>
                                            <BookOpen className="w-4 h-4" />
                                        </div>
                                        <span className={`text-sm font-semibold ${
                                            isSelected ? 'text-blue-900' : 'text-slate-700 group-hover:text-slate-900'
                                        }`}>
                                            {(data as any).label}
                                        </span>
                                    </div>
                                    <ChevronRight className={`w-4 h-4 transition-transform ${
                                        isSelected ? 'text-blue-500 rotate-90' : 'text-slate-500 group-hover:text-slate-600'
                                    }`} />
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Detail panel — only show when subject selected */}
                {selectedSubjectId && <div className="flex-1 px-8 pt-8 overflow-y-auto">
                    <AnimatePresence mode="wait">
                        {selectedSubjectId ? (
                            <motion.div
                                key={selectedSubjectId}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="max-w-4xl"
                            >
                                {renderDetailContent()}
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="h-full flex flex-col items-center justify-center max-w-sm mx-auto text-center"
                            >
                                <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200 shadow-inner mb-6">
                                    <BookOpen className="w-10 h-10 text-slate-500" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-700 mb-2">Wähle ein Fachgebiet</h3>
                                <p className="text-sm text-slate-500 mb-6">Wähle links ein Fachgebiet aus, um dir den Syllabus, die Prüfungsstatistiken und Fallbeispiele anzusehen.</p>
                                <button
                                    onClick={() => setSelectedSubjectId(Object.keys(examDataset.specialties)[0])}
                                    className="px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2"
                                >
                                    <BookOpen className="w-4 h-4" />
                                    Erstes Fachgebiet ansehen
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>}
            </div>
        </div>
    );
}

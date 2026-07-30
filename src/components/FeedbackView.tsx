import React from 'react';
import { ChevronLeft, CheckCircle2, AlertCircle, BookOpen, Clock, MessageSquare, Stethoscope, ThumbsUp, ThumbsDown, TrendingUp } from 'lucide-react';
import { cn } from '../lib/utils';
import type { ExamSession } from '../types';
import { rateSession } from '../lib/localDb';

export const FeedbackView = ({
    session,
    onRestart,
    onRepeat,
    onRepeatWithFocus,
    userId,
}: {
    session: ExamSession;
    onRestart: () => void;
    onRepeat: () => void;
    onRepeatWithFocus?: () => void;
    userId?: string;
}) => {
    const feedback = session.feedback;
    const [selectedCategory, setSelectedCategory] = React.useState<'all' | 'medical' | 'structure' | 'communication'>('all');
    const [userRating, setUserRating] = React.useState<1 | -1 | null>(null);
    const [comment, setComment] = React.useState('');
    const [ratingSubmitted, setRatingSubmitted] = React.useState(false);

    const submitRating = async (rating: 1 | -1) => {
        setUserRating(rating);
        await rateSession({ sessionId: session.sessionId, startTime: session.startTime }, rating, comment || undefined);
        setRatingSubmitted(true);
    };
    if (!feedback) return null;

    const score = feedback.score ?? 0;
    const summary = feedback.summary ?? 'Feedback konnte nicht geladen werden.';

    const FILTER_TERMS = ['mwbo', 'kernkompetenz der', 'die prüfung wurde vollständig', 'fehlendes ki-datenformat'];
    const filterFeedback = (arr: string[]) =>
        arr.filter(s => s.length > 5 && !FILTER_TERMS.some(t => s.toLowerCase().includes(t)));

    // Determine which strengths/weaknesses to show based on selection
    let displayStrengths = feedback.strengths ?? [];
    let displayWeaknesses = feedback.weaknesses ?? [];

    if (selectedCategory !== 'all' && feedback.categoryFeedback && feedback.categoryFeedback[selectedCategory]) {
        displayStrengths = feedback.categoryFeedback[selectedCategory].strengths || [];
        displayWeaknesses = feedback.categoryFeedback[selectedCategory].weaknesses || [];
    }

    const strengths = filterFeedback(displayStrengths);
    const weaknesses = filterFeedback(displayWeaknesses);
    const questions = feedback.questions ?? [];
    const durationMin = Math.round(((session.endTime ?? Date.now()) - session.startTime) / 60000);
    const primaryWeakness = weaknesses[0] || 'deine Lernlücken';

    return (
        <div className="min-h-full bg-slate-50 p-4 md:p-6">
            <div className="max-w-3xl mx-auto space-y-4">

                {/* Header */}
                <div className="flex items-center gap-3">
                    <button onClick={onRestart} className="min-w-11 min-h-11 flex items-center justify-center rounded-xl bg-white border border-slate-200 shadow-sm text-slate-500 hover:text-slate-800 transition-all" aria-label="Zurück zum Dashboard">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-2xl font-extrabold text-brand-navy tracking-tight">Hier ist dein Feedback</h1>
                    <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border bg-emerald-50 border-emerald-200 text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Simulation abgeschlossen
                    </span>
                </div>

                {/* Score + Summary */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex gap-5 items-start">
                    {/* Circle score */}
                    <div className="flex-shrink-0 flex flex-col items-center gap-1">
                        <div className="w-20 h-20 rounded-full border-[6px] border-slate-100 flex items-center justify-center relative bg-white shadow-sm cursor-pointer hover:scale-105 transition-transform" onClick={() => setSelectedCategory('all')}>
                            <svg viewBox="0 0 80 80" className="absolute inset-0 w-full h-full -rotate-90">
                                <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6"
                                    className="text-emerald-500"
                                    strokeDasharray="213.6"
                                    strokeDashoffset={213.6 * (1 - score / 100)}
                                    style={{ transition: 'stroke-dashoffset 1.5s ease-out' }}
                                />
                            </svg>
                            <span className="text-lg font-bold text-slate-800">{score}%</span>
                        </div>
                        <span className="text-xs text-slate-500 font-medium text-center leading-tight">Feedback-<br/>Score</span>
                    </div>

                    {/* Summary + sub-scores */}
                    <div className="flex-1 min-w-0">
                        <p className="text-slate-700 text-sm leading-relaxed mb-3">{summary}</p>
                        {(feedback.medicalScore !== undefined || feedback.communicationScore !== undefined) && (
                            <div className="grid grid-cols-3 gap-2">
                                {feedback.medicalScore !== undefined && (
                                    <div
                                        className={cn("p-2 rounded-xl cursor-pointer transition-all border border-transparent", selectedCategory === 'medical' ? "bg-brand-green/10 border-brand-green/20" : "hover:bg-slate-50")}
                                        onClick={() => setSelectedCategory(selectedCategory === 'medical' ? 'all' : 'medical')}
                                    >
                                        <div className={cn("text-xs font-bold uppercase tracking-wide truncate mb-0.5", selectedCategory === 'medical' ? 'text-brand-green' : 'text-slate-500')}>Fachwissen</div>
                                        <div className="text-sm font-bold text-slate-700 mb-1">{feedback.medicalScore}%</div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-brand-green rounded-full" style={{ width: `${feedback.medicalScore}%`, transition: 'width 1s ease-out 0.3s' }} />
                                        </div>
                                    </div>
                                )}
                                {feedback.structureScore !== undefined && (
                                    <div
                                        className={cn("p-2 rounded-xl cursor-pointer transition-all border border-transparent", selectedCategory === 'structure' ? "bg-brand-navy/10 border-brand-navy/20" : "hover:bg-slate-50")}
                                        onClick={() => setSelectedCategory(selectedCategory === 'structure' ? 'all' : 'structure')}
                                    >
                                        <div className={cn("text-xs font-bold uppercase tracking-wide truncate mb-0.5", selectedCategory === 'structure' ? 'text-brand-navy' : 'text-slate-500')}>Struktur</div>
                                        <div className="text-sm font-bold text-slate-700 mb-1">{feedback.structureScore}%</div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-brand-navy rounded-full" style={{ width: `${feedback.structureScore}%`, transition: 'width 1s ease-out 0.5s' }} />
                                        </div>
                                    </div>
                                )}
                                {feedback.communicationScore !== undefined && (
                                    <div
                                        className={cn("p-2 rounded-xl cursor-pointer transition-all border border-transparent", selectedCategory === 'communication' ? "bg-brand-orange/10 border-brand-orange/20" : "hover:bg-slate-50")}
                                        onClick={() => setSelectedCategory(selectedCategory === 'communication' ? 'all' : 'communication')}
                                    >
                                        <div className={cn("text-xs font-bold uppercase tracking-wide truncate mb-0.5", selectedCategory === 'communication' ? 'text-brand-orange' : 'text-slate-500')}>Kommunik.</div>
                                        <div className="text-sm font-bold text-slate-700 mb-1">{feedback.communicationScore}%</div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-brand-orange rounded-full" style={{ width: `${feedback.communicationScore}%`, transition: 'width 1s ease-out 0.7s' }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { icon: Clock, label: 'Dauer', value: `${durationMin} Min.`, color: 'text-blue-500' },
                        { icon: MessageSquare, label: 'Fragen', value: questions.length || session.messages.filter((m: any) => m.role === 'model').length - 1, color: 'text-brand-navy' },
                        { icon: Stethoscope, label: 'Fachbereich', value: session.subject, color: 'text-brand-green' },
                    ].map(({ icon: Icon, label, value, color }) => (
                        <div key={label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col gap-1">
                            <Icon className={cn("w-4 h-4", color)} />
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</span>
                            <span className="text-sm font-bold text-slate-800 truncate">{value}</span>
                        </div>
                    ))}
                </div>

                {/* Strengths + Weaknesses */}
                <div className="grid md:grid-cols-2 gap-3">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 transition-all">
                        <h3 className={cn("text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5",
                            selectedCategory === 'all' ? "text-emerald-600" :
                                selectedCategory === 'medical' ? "text-brand-green" :
                                    selectedCategory === 'structure' ? "text-brand-navy" : "text-brand-orange"
                        )}>
                            <CheckCircle2 className="w-4 h-4" />
                            {selectedCategory === 'all' ? "Stärken" : "Stärken in dieser Kategorie"}
                        </h3>
                        <ul className="space-y-2">
                            {strengths.length > 0 ? strengths.map((s: string, i: number) => (
                                <li key={i} className="flex gap-2.5 text-slate-700 text-sm leading-relaxed">
                                    <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5",
                                        selectedCategory === 'all' ? "bg-emerald-400" :
                                            selectedCategory === 'medical' ? "bg-brand-green" :
                                                selectedCategory === 'structure' ? "bg-brand-navy" : "bg-brand-orange"
                                    )} />
                                    {s}
                                </li>
                            )) : (
                                <li className="text-sm text-slate-500">Keine besonderen Stärken in dieser Kategorie vermerkt.</li>
                            )}
                        </ul>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 transition-all">
                        <h3 className={cn("text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5",
                            selectedCategory === 'all' ? "text-red-500" :
                                selectedCategory === 'medical' ? "text-brand-green" :
                                    selectedCategory === 'structure' ? "text-brand-navy" : "text-brand-orange"
                        )}>
                            <AlertCircle className="w-4 h-4" />
                            {selectedCategory === 'all' ? "Verbesserungsbedarf" : "Schwächen in dieser Kategorie"}
                        </h3>
                        <ul className="space-y-2">
                            {weaknesses.length > 0 ? weaknesses.map((w: string, i: number) => (
                                <li key={i} className="flex gap-2.5 text-slate-700 text-sm leading-relaxed">
                                    <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5",
                                        selectedCategory === 'all' ? "bg-red-400" :
                                            selectedCategory === 'medical' ? "bg-brand-green" :
                                                selectedCategory === 'structure' ? "bg-brand-navy" : "bg-brand-orange"
                                    )} />
                                    {w}
                                </li>
                            )) : (
                                <li className="text-sm text-slate-500">Hier gibt es scheinbar nichts Großes zu meckern!</li>
                            )}
                        </ul>
                    </div>
                </div>

                {/* Questions */}
                {questions.length > 0 && (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <h3 className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                            <BookOpen className="w-4 h-4" /> Fragen & Antwortreflexion
                        </h3>
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 leading-relaxed">
                            KI-generierte Antwortvorschläge haben keinen Anspruch auf Vollständigkeit oder medizinische Korrektheit. Sie wurden nicht menschlich kontrolliert und dienen nur deiner Reflexion.
                        </div>
                        <div className="space-y-3">
                            {questions.map((q: any, i: number) => (
                                <div key={i} className={cn("rounded-xl border overflow-hidden", q.isCritical ? "border-amber-200" : "border-slate-100")}>
                                    <div className={cn("flex gap-2.5 px-4 py-3 border-b", q.isCritical ? "bg-amber-50 border-amber-100" : "bg-slate-50 border-slate-100")}>
                                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                {q.isCritical && (
                                                    <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">kritisch</span>
                                                )}
                                            </div>
                                            <p className="font-semibold text-slate-800 text-sm leading-snug">{q.question}</p>
                                        </div>
                                    </div>
                                    <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                                        <div className="px-4 py-3">
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1">Deine Antwort</span>
                                            <p className="text-sm text-slate-600 leading-relaxed">{q.userAnswer}</p>
                                        </div>
                                        <div className="px-4 py-3 bg-emerald-50/50">
                                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 block mb-1">Mögliche Orientierung</span>
                                            <p className="text-sm text-emerald-800 leading-relaxed">{q.idealAnswer || q.expectedAnswer}</p>
                                            {q.expectedAnswer && q.idealAnswer && (
                                                <p className="text-xs text-emerald-700/80 leading-relaxed mt-2 border-t border-emerald-100 pt-2">{q.expectedAnswer}</p>
                                            )}
                                        </div>
                                    </div>
                                    {q.missedKeyPoints?.length > 0 && (
                                        <div className="px-4 py-3 bg-white border-t border-slate-100">
                                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-2">Gefehlt hat</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {q.missedKeyPoints.map((point: string) => (
                                                    <span key={point} className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-lg">{point}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* User feedback rating */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    {ratingSubmitted ? (
                        <div className="flex items-center justify-center gap-2 py-1 text-sm text-slate-500">
                            <CheckCircle2 className="w-4 h-4 text-brand-green" />
                            Danke für dein Feedback!
                        </div>
                    ) : (
                        <>
                            <p className="text-xs font-semibold text-slate-500 text-center mb-3">War die Simulation hilfreich?</p>
                            <div className="flex gap-2 justify-center mb-3">
                                <button
                                    onClick={() => submitRating(1)}
                                    className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-semibold transition-all", userRating === 1 ? "bg-brand-green text-white border-brand-green" : "border-slate-200 text-slate-600 hover:border-brand-green hover:text-brand-green")}
                                >
                                    <ThumbsUp className="w-4 h-4" /> Ja
                                </button>
                                <button
                                    onClick={() => setUserRating(-1)}
                                    className={cn("flex items-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-semibold transition-all", userRating === -1 ? "bg-red-500 text-white border-red-500" : "border-slate-200 text-slate-600 hover:border-red-400 hover:text-red-500")}
                                >
                                    <ThumbsDown className="w-4 h-4" /> Nein
                                </button>
                            </div>
                            {userRating === -1 && (
                                <div className="space-y-2">
                                    <textarea
                                        value={comment}
                                        onChange={e => setComment(e.target.value)}
                                        placeholder="Was hat nicht funktioniert? (optional)"
                                        rows={2}
                                        className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 text-slate-700 placeholder-slate-500 resize-none focus:outline-none focus:border-brand-green"
                                    />
                                    <button
                                        onClick={() => submitRating(-1)}
                                        className="w-full py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition-colors"
                                    >
                                        Feedback senden
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 pb-4">
                    {onRepeatWithFocus && weaknesses.length > 0 && (
                        <button onClick={onRepeatWithFocus} className="w-full py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white font-bold rounded-2xl hover:from-red-600 hover:to-orange-600 transition-all shadow-lg shadow-red-500/20 text-sm flex items-center justify-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            Schwächen trainieren
                        </button>
                    )}
                    <div className="flex gap-3">
                        <button onClick={onRestart} className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition-all shadow-sm text-sm">
                            Neues Thema
                        </button>
                        <button onClick={onRepeat} className="flex-1 py-3 bg-gradient-to-r from-brand-green to-emerald-500 text-white font-bold rounded-2xl hover:from-brand-green/80 hover:to-brand-green transition-all shadow-lg shadow-brand-green/20 text-sm">
                            Nochmal üben
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

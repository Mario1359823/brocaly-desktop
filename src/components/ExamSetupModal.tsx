import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Check, PlayCircle, MicOff, Volume2, CheckCircle2 } from 'lucide-react';
import { EXAMINER } from '../types';
import { cn } from '../lib/utils';
import { bridge } from '../lib/bridge';
import { prewarmMicPermission } from '../hooks/useSpeechToText';
import { getMicrophonePermissionHelp } from '../lib/microphoneHelp';

interface ExamSetupModalProps {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    onShowAiInfo?: () => void;
}

export function ExamSetupModal({
    open,
    onConfirm,
    onCancel,
    onShowAiInfo,
}: ExamSetupModalProps) {
    const [micDenied, setMicDenied] = useState(false);
    const [requesting, setRequesting] = useState(false);
    const [testState, setTestState] = useState<'idle' | 'testing' | 'recording' | 'success' | 'mic-denied'>('idle');
    const testStreamRef = useRef<MediaStream | null>(null);

    const handleTest = async () => {
        setTestState('testing');
        setMicDenied(false);

        try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.frequency.value = 520;
            gain.gain.value = 0.15;
            osc.connect(gain).connect(ctx.destination);
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
            osc.stop(ctx.currentTime + 0.4);
            await new Promise(r => setTimeout(r, 500));
            ctx.close();
        } catch {}

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            testStreamRef.current = stream;
            setTestState('recording');
            await new Promise(r => setTimeout(r, 800));
            stream.getTracks().forEach(t => t.stop());
            testStreamRef.current = null;
            setTestState('success');
        } catch {
            if (testStreamRef.current) {
                testStreamRef.current.getTracks().forEach(t => t.stop());
                testStreamRef.current = null;
            }
            setTestState('mic-denied');
            setMicDenied(true);
        }
    };

    const handleConfirm = async () => {
        setRequesting(true);
        // Check mic availability — warn but don't block (text mode still works)
        try {
            await prewarmMicPermission();
            if (navigator.permissions) {
                try {
                    const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
                    if (status.state === 'denied') setMicDenied(true);
                } catch {}
            }
        } catch {}
        setRequesting(false);
        onConfirm();
    };

    const microphoneHelp = getMicrophonePermissionHelp();

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-3 pb-4 sm:p-4"
                    style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
                    onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 40, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 40, scale: 0.97 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl sm:max-w-5xl flex flex-col max-h-[calc(100dvh-2rem)] sm:max-h-[88vh] overflow-hidden"
                    >
                        {/* Header */}
                        <div className="px-5 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-slate-100 shrink-0">
                            <h2 className="text-lg font-bold text-slate-900">Simulation starten</h2>
                            <p className="text-sm text-slate-500 mt-0.5">Mikrofon prüfen, dann geht es los</p>
                        </div>

                        {/* Scrollable content */}
                        <div className="overflow-y-auto sm:overflow-visible flex-1 min-h-0 sm:grid sm:grid-cols-[1.05fr_0.95fr] sm:gap-4 sm:px-5 sm:py-4">

                            <div>
                                {/* Examiner Cards — 3 columns on mobile too */}
                            <div className="px-4 pt-4 pb-3 sm:px-0 sm:pt-0 sm:pb-3">
                                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    {EXAMINER.image ? (
                                        <img
                                            src={EXAMINER.image}
                                            alt={EXAMINER.name}
                                            className="w-16 h-16 rounded-xl object-cover object-top shrink-0"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 rounded-xl bg-slate-200 flex items-center justify-center text-2xl font-bold text-slate-500 shrink-0">
                                            {EXAMINER.name.charAt(0)}
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="font-bold text-slate-900 leading-tight">{EXAMINER.name}</p>
                                        <p className="text-xs text-slate-500">{EXAMINER.title}</p>
                                        <p className="text-sm text-slate-500 mt-1">{EXAMINER.tagline}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Selected examiner description — compact */}
                            <div className="px-4 pb-3 sm:px-0 sm:pb-0">
                                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                                    <p className="text-xs font-bold text-slate-700 mb-1.5">{EXAMINER.name} · {EXAMINER.title}</p>
                                    <ul className="space-y-1">
                                        {EXAMINER.stylePoints.slice(0, 2).map((point, i) => (
                                            <li key={i} className="flex items-start gap-1.5 text-sm text-slate-500">
                                                <span className="mt-1 w-1 h-1 rounded-full bg-brand-green flex-shrink-0" />
                                                {point}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                            </div>

                            {/* Audio info notice */}
                            <div className="px-4 pb-4 sm:px-0 sm:pb-0 sm:flex sm:flex-col sm:gap-2">
                                <div className="flex items-start gap-2 px-3 py-2.5 sm:py-3 bg-amber-50 border border-amber-100 rounded-xl mb-2 sm:mb-0">
                                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                    <div className="text-sm text-amber-900 leading-relaxed">
                                        <p className="font-bold mb-1">Bevor du startest</p>
                                        <p>
                                            Diese Simulation wird von KI geführt. Sie hilft dir beim Üben, kann aber Fehler machen oder Antworten unvollständig bewerten. Verwende keine echten Patientendaten und überprüfe medizinische Inhalte bei Unsicherheit anhand verlässlicher Quellen.
                                        </p>
                                        {onShowAiInfo && (
                                            <button
                                                type="button"
                                                onClick={onShowAiInfo}
                                                className="mt-2 text-sm font-bold text-brand-green hover:underline"
                                            >
                                                Mehr darüber, wie Brocaly mit KI arbeitet
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-start gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                                    <span className="text-slate-500 text-xs mt-0.5">🔒</span>
                                    <p className="text-sm text-slate-500 leading-relaxed">
                                        Sprachaufnahmen gehen verschlüsselt direkt von deinem Rechner an den KI-Anbieter, dessen Schlüssel du hinterlegt hast, und werden von Brocaly nicht gespeichert. Ob sie dort zum Training genutzt werden, richtet sich nach den Bedingungen des Anbieters.{' '}
                                        <button type="button" onClick={e => { e.stopPropagation(); bridge.openExternal('https://brocaly.de/datensicherheit'); }} className="underline text-slate-500 hover:text-slate-600">Datenschutz</button>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Footer — fixed at bottom */}
                        <div className="px-4 sm:px-5 pb-4 pt-3 border-t border-slate-100 shrink-0 space-y-2">
                            {/* Mic test — small secondary */}
                            <button
                                onClick={handleTest}
                                disabled={testState === 'testing' || testState === 'recording'}
                                className={cn(
                                    "w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-1.5 transition-all border",
                                    testState === 'success'
                                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                        : testState === 'mic-denied'
                                            ? "bg-red-50 border-red-200 text-red-600"
                                            : "bg-slate-50 border-slate-200 text-slate-500 active:bg-slate-100"
                                )}
                            >
                                {testState === 'idle' && <><Volume2 className="w-3.5 h-3.5" />Audio & Mikrofon testen</>}
                                {testState === 'testing' && <><div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />Teste Audio…</>}
                                {testState === 'recording' && <><div className="w-3.5 h-3.5 border-2 border-brand-green/30 border-t-brand-green rounded-full animate-spin" />Teste Mikrofon…</>}
                                {testState === 'success' && <><CheckCircle2 className="w-3.5 h-3.5" />Alles in Ordnung</>}
                                {testState === 'mic-denied' && <><MicOff className="w-3.5 h-3.5" />Mikrofon blockiert — tippe zum Wiederholen</>}
                            </button>

                            {micDenied && (
                                <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 leading-relaxed">
                                    <strong>Mikrofon verweigert:</strong> {microphoneHelp}
                                </div>
                            )}

                            {/* Main actions */}
                            <div className="flex gap-2">
                                <button
                                    onClick={onCancel}
                                    className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all text-sm"
                                >
                                    Abbrechen
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={requesting}
                                    className="flex-[2] py-3 bg-gradient-to-r from-brand-green to-emerald-500 text-white font-bold rounded-2xl hover:from-brand-green/80 hover:to-brand-green transition-all shadow-lg shadow-brand-green/20 text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {requesting
                                        ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        : <><PlayCircle className="w-4 h-4" />Verstanden, Simulation starten</>
                                    }
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

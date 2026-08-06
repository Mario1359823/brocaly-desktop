import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, BarChart3, KeyRound, Mic, ShieldCheck, Stethoscope } from 'lucide-react';
import { BrocalyTextLogo } from './BrocalyLogo';

const SLIDES = [
  {
    icon: Stethoscope,
    eyebrow: 'Willkommen',
    title: 'Dein mündliches Fachgespräch — so oft du willst',
    body: 'Brocaly simuliert das medizinische Prüfungsgespräch mit echten Fällen aus 28 Fachgebieten. Du sprichst, die KI hakt nach, genau wie im echten Gespräch.',
    accent: 'from-brand-green/15 to-emerald-100/40',
  },
  {
    icon: Mic,
    eyebrow: 'So läuft es ab',
    title: 'Sprechen statt tippen',
    body: 'Du hältst die Sprechtaste gedrückt und antwortest frei. Dein Gegenüber reagiert in Echtzeit, korrigiert Fehler und bohrt nach — Pathophysiologie, Pharmakologie, aktuelle Standards.',
    accent: 'from-sky-100/60 to-blue-100/40',
  },
  {
    icon: BarChart3,
    eyebrow: 'Danach',
    title: 'Auswertung, die konkret wird',
    body: 'Nach jeder Simulation bekommst du Stärken, Lernfelder und Frage-für-Frage, was in deiner Antwort gefehlt hat. Dein Fortschritt wird über alle Fächer mitgeschrieben.',
    accent: 'from-amber-100/60 to-orange-100/40',
  },
  {
    icon: ShieldCheck,
    eyebrow: 'Dein Schlüssel',
    title: 'Kein Konto, kein Abo',
    body: 'Du nutzt deinen eigenen OpenAI-API-Schlüssel — Brocaly hat keinen Zugriff darauf. Profil und Auswertungen werden lokal gespeichert, Gespräche laufen direkt über OpenAI.',
    accent: 'from-violet-100/60 to-fuchsia-100/40',
  },
];

/**
 * First-launch preview: four slides that explain what the app does, ending in
 * the "Gleich geht's los" hand-off into the setup wizard.
 */
export function WelcomeTour({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;
  const Icon = slide.icon;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      <div className="h-10 app-drag shrink-0" />

      <div className="flex-1 flex items-center justify-center px-6 pb-6 overflow-y-auto">
        <div className="w-full max-w-2xl">
          <div className="flex justify-center mb-10">
            <BrocalyTextLogo size="lg" />
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-3xl bg-white border border-slate-200/80 shadow-xl shadow-slate-900/5 overflow-hidden"
            >
              <div className={`bg-gradient-to-br ${slide.accent} px-8 pt-10 pb-8`}>
                <div className="w-14 h-14 rounded-2xl bg-white/90 shadow-sm flex items-center justify-center text-brand-green mb-6">
                  <Icon className="w-7 h-7" />
                </div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-green mb-3">
                  {slide.eyebrow}
                </p>
                <h1 className="text-3xl font-black tracking-tight text-brand-navy leading-tight">
                  {slide.title}
                </h1>
              </div>
              <div className="px-8 py-7">
                <p className="text-[15px] leading-relaxed text-slate-600">{slide.body}</p>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-between">
            <div className="flex gap-2">
              {SLIDES.map((item, i) => (
                <button
                  key={item.title}
                  onClick={() => setIndex(i)}
                  aria-label={`Schritt ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === index ? 'w-7 bg-brand-green' : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-3">
              {!isLast && (
                <button
                  onClick={onDone}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Überspringen
                </button>
              )}
              <button
                onClick={() => (isLast ? onDone() : setIndex((i) => i + 1))}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-green px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand-green/25 transition-all hover:brightness-95"
              >
                {isLast ? (
                  <>
                    <KeyRound className="w-4 h-4" />
                    Gleich geht&apos;s los
                  </>
                ) : (
                  <>
                    Weiter
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

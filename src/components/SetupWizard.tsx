import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Check, ChevronLeft, Loader2, Play, Sparkles } from 'lucide-react';
import { BrocalyTextLogo } from './BrocalyLogo';
import { KeyGuide } from './ApiKeySetup';
import {
  ProfileForm,
  type ProfileFormState,
  emptyProfileForm,
  isProfileComplete,
  toProfilePatch,
} from './ProfileForm';
import { keysApi } from '../services/api';
import { saveProfile, saveSettings } from '../lib/localDb';
import { cn } from '../lib/utils';
import { EXAMINER, type KeystoreState, type Profile } from '../types';

const STEPS = [
  { title: 'Account erstellen', hint: 'Bleibt auf diesem Rechner' },
  { title: 'API-Schlüssel', hint: 'Einmalig, kostenlos' },
  { title: 'Erste Simulation', hint: 'Los geht’s' },
];

/**
 * Three-step first run: local account → BYOK key → first simulation.
 * Nothing here talks to a server other than the user's own AI provider.
 */
export function SetupWizard({
  initialProfile,
  onFinished,
}: {
  initialProfile: Profile | null;
  onFinished: (profile: Profile, startExam: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ProfileFormState>(() => emptyProfileForm(initialProfile));
  const [showErrors, setShowErrors] = useState(false);
  const [keys, setKeys] = useState<KeystoreState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    keysApi.state().then(setKeys).catch(() => setKeys(null));
  }, []);

  const keyReady = Boolean(keys?.key.configured);
  const canAdvance = step === 0 ? isProfileComplete(form) : step === 1 ? keyReady : true;

  const goNext = async () => {
    if (!canAdvance) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);

    if (step === 0) {
      await saveProfile(toProfilePatch(form));
      setStep(1);
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }

    setBusy(true);
    const profile = await saveProfile(toProfilePatch(form));
    await saveSettings({ setupCompletedAt: new Date().toISOString() });
    onFinished(profile, true);
  };

  const skipFirstExam = async () => {
    setBusy(true);
    const profile = await saveProfile(toProfilePatch(form));
    await saveSettings({ setupCompletedAt: new Date().toISOString() });
    onFinished(profile, false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50">
      <div className="h-10 app-drag shrink-0" />

      <div className="flex-1 overflow-y-auto px-6 pb-10">
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-8 flex justify-center">
            <BrocalyTextLogo size="md" />
          </div>

          {/* Stepper */}
          <div className="mb-8 flex items-center">
            {STEPS.map((item, index) => (
              <div key={item.title} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full text-sm font-black transition-all',
                      index < step
                        ? 'bg-brand-green text-white'
                        : index === step
                          ? 'bg-slate-900 text-white ring-4 ring-slate-900/10'
                          : 'bg-slate-200 text-slate-400',
                    )}
                  >
                    {index < step ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  <p
                    className={cn(
                      'mt-2 whitespace-nowrap text-[11px] font-bold',
                      index <= step ? 'text-slate-800' : 'text-slate-400',
                    )}
                  >
                    {item.title}
                  </p>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'mx-3 mb-5 h-0.5 flex-1 rounded-full transition-colors',
                      index < step ? 'bg-brand-green' : 'bg-slate-200',
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-xl shadow-slate-900/5 sm:p-9"
            >
              {step === 0 && (
                <>
                  <h1 className="text-2xl font-black tracking-tight text-brand-navy">
                    Erstelle deinen Account
                  </h1>
                  <p className="mb-7 mt-1.5 text-sm leading-relaxed text-slate-500">
                    Kein Passwort, keine E-Mail, keine Anmeldung. Dein Profil wird ausschließlich auf
                    diesem Rechner gespeichert und steuert Niveau und Fachgebiet deiner Simulationen.
                  </p>
                  <ProfileForm state={form} onChange={setForm} showErrors={showErrors} />
                </>
              )}

              {step === 1 && (
                <>
                  <h1 className="text-2xl font-black tracking-tight text-brand-navy">
                    Hinterlege deinen API-Schlüssel
                  </h1>
                  <p className="mb-4 mt-1.5 text-sm leading-relaxed text-slate-500">
                    Ein Schlüssel von OpenAI genügt für alles: Gespräch, Auswertung, Sprachausgabe und
                    Spracherkennung. Das dauert etwa zwei Minuten.
                  </p>
                  <div className="mb-6 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-xs text-slate-500 leading-relaxed">
                    <span className="font-semibold text-slate-700">Kosten:</span>{' '}
                    Abgerechnet wird direkt über dein OpenAI-Konto, kein Aufschlag durch Brocaly.{' '}
                    <span className="font-semibold text-slate-600">Free Tier:</span>{' '}
                    Bis zu 500 Anfragen/Tag kostenlos (~25 Sessions täglich ohne Billing).
                  </div>
                  <KeyGuide state={keys} onChanged={setKeys} />
                </>
              )}

              {step === 2 && (
                <>
                  <h1 className="text-2xl font-black tracking-tight text-brand-navy">
                    Alles bereit, {form.name.trim() || 'los geht’s'}
                  </h1>
                  <p className="mb-7 mt-1.5 text-sm leading-relaxed text-slate-500">
                    Sie führt jede Simulation — sachlich, mit präzisen Nachfragen, wie in der echten Prüfung.
                  </p>

                  <div className="flex items-start gap-4 rounded-2xl border border-brand-green/30 bg-brand-green/5 p-4">
                    <img
                      src={EXAMINER.image}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-xl object-cover object-top"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900">{EXAMINER.name}</p>
                      <p className="text-xs text-slate-500">{EXAMINER.title}</p>
                      <ul className="mt-2 space-y-1">
                        {EXAMINER.stylePoints.map((point) => (
                          <li key={point} className="flex items-start gap-1.5 text-xs text-slate-500">
                            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-green" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-amber-50 px-4 py-3">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <p className="text-xs leading-relaxed text-amber-800">
                      Brocaly ist ein Trainingswerkzeug, keine Prüfung und keine medizinische Beratung.
                      Inhalte werden von einer KI erzeugt und können Fehler enthalten.
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || busy}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-800 disabled:invisible"
            >
              <ChevronLeft className="h-4 w-4" />
              Zurück
            </button>

            <div className="flex items-center gap-3">
              {step === 2 && (
                <button
                  onClick={skipFirstExam}
                  disabled={busy}
                  className="px-4 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-800"
                >
                  Später starten
                </button>
              )}
              <button
                onClick={goNext}
                disabled={busy || (step === 1 && !keyReady)}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-green px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand-green/25 transition-all hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : step === 2 ? (
                  <Play className="h-4 w-4" />
                ) : null}
                {step === 2 ? 'Erste Simulation starten' : 'Weiter'}
                {step < 2 && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {step === 1 && !keyReady && (
            <p className="mt-3 text-center text-xs font-medium text-slate-400">
              Ohne OpenAI-Schlüssel kann Brocaly keine Simulation starten.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

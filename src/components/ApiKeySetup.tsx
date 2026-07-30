import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Trash2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { bridge } from '../lib/bridge';
import { keysApi } from '../services/api';
import type { ApiProvider, KeystoreState } from '../types';

export const PROVIDER_META: Record<
  ApiProvider,
  { label: string; purpose: string; console: string; consoleLabel: string; prefix?: string }
> = {
  google: {
    label: 'Google Gemini',
    purpose: 'Prüfungsgespräch, Auswertung, Sprachausgabe und Spracherkennung',
    console: 'https://aistudio.google.com/apikey',
    consoleLabel: 'Google AI Studio',
    prefix: 'AIza',
  },
  anthropic: {
    label: 'Anthropic Claude',
    purpose: 'Stärkerer Prüfer für Facharzt-Gespräche und feinere Auswertung',
    console: 'https://console.anthropic.com/settings/keys',
    consoleLabel: 'Anthropic Console',
    prefix: 'sk-ant-',
  },
  elevenlabs: {
    label: 'ElevenLabs',
    purpose: 'Natürlichere Prüferstimmen',
    console: 'https://elevenlabs.io/app/settings/api-keys',
    consoleLabel: 'ElevenLabs',
  },
  openai: {
    label: 'OpenAI',
    purpose: 'Whisper-Spracherkennung — robuster bei Dialekt und lauter Umgebung',
    console: 'https://platform.openai.com/api-keys',
    consoleLabel: 'OpenAI Platform',
    prefix: 'sk-',
  },
};

const GOOGLE_STEPS = [
  { title: 'Google AI Studio öffnen', body: 'Melde dich mit deinem normalen Google-Konto an — es braucht keine Kreditkarte.' },
  { title: '„Create API key" klicken', body: 'Wähle bei der Nachfrage ein beliebiges Projekt aus oder lege ein neues an.' },
  { title: 'Schlüssel kopieren', body: 'Er beginnt mit AIza… Kopiere ihn vollständig und füge ihn unten ein.' },
];

/** Single provider row: enter, verify and store one API key. */
export function ApiKeyField({
  provider,
  state,
  onChanged,
  autoFocus = false,
}: {
  provider: ApiProvider;
  state: KeystoreState | null;
  onChanged: (next: KeystoreState) => void;
  autoFocus?: boolean;
}) {
  const meta = PROVIDER_META[provider];
  const entry = state?.keys.find((item) => item.provider === provider);

  const [value, setValue] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      // The key is verified against the provider before it is stored, so a
      // typo shows up here instead of mid-simulation.
      onChanged(await keysApi.save(provider, trimmed));
      setValue('');
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Schlüssel konnte nicht gespeichert werden.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      onChanged(await keysApi.remove(provider));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">{meta.label}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{meta.purpose}</p>
        </div>
        {entry?.configured && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            Hinterlegt
          </span>
        )}
      </div>

      {entry?.configured ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
          <code className="truncate font-mono text-xs text-slate-600">{entry.maskedKey}</code>
          <button
            onClick={remove}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-slate-500 transition-colors hover:text-red-600 disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Entfernen
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={visible ? 'text' : 'password'}
                value={value}
                autoFocus={autoFocus}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save();
                }}
                placeholder={meta.prefix ? `${meta.prefix}…` : 'API-Schlüssel einfügen'}
                spellCheck={false}
                autoComplete="off"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-10 font-mono text-sm text-slate-800 outline-none transition-colors focus:border-brand-green focus:ring-2 focus:ring-brand-green/15"
              />
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? 'Schlüssel verbergen' : 'Schlüssel anzeigen'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
              >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <button
              onClick={save}
              disabled={busy || !value.trim()}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-green px-5 text-sm font-bold text-white transition-all hover:brightness-95 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {busy ? 'Prüfe…' : 'Prüfen & speichern'}
            </button>
          </div>

          <button
            onClick={() => bridge.openExternal(meta.console)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-brand-green transition-colors hover:underline"
          >
            {meta.consoleLabel} öffnen
            <ExternalLink className="h-3 w-3" />
          </button>
        </>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-2.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
          <p className="text-xs font-medium leading-relaxed text-red-700">{error}</p>
        </div>
      )}

      {justSaved && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 text-xs font-bold text-emerald-600"
        >
          Schlüssel geprüft und sicher gespeichert.
        </motion.p>
      )}
    </div>
  );
}

/** The guided Google-key step shown during first-run setup. */
export function GoogleKeyGuide({
  state,
  onChanged,
}: {
  state: KeystoreState | null;
  onChanged: (next: KeystoreState) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-5">
        <p className="text-sm font-bold text-slate-900 mb-1">Warum ein eigener Schlüssel?</p>
        <p className="text-sm leading-relaxed text-slate-600">
          Brocaly ist kostenlos und hat keinen eigenen Server. Deine Simulationen laufen direkt von
          deinem Rechner zu Google — mit deinem Schlüssel, in deinem Kontingent. Google bietet dafür
          ein kostenloses Kontingent, das für regelmäßiges Üben in der Regel ausreicht.
        </p>
      </div>

      <ol className="space-y-3">
        {GOOGLE_STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-3.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800">{step.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <ApiKeyField provider="google" state={state} onChanged={onChanged} autoFocus />

      <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 px-4 py-3">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        <p className="text-xs leading-relaxed text-slate-500">
          {state?.encryptionAvailable === false
            ? 'Achtung: Der Schlüsselbund deines Systems ist nicht verfügbar. Der Schlüssel wird nur mit Dateirechten geschützt gespeichert.'
            : 'Der Schlüssel wird über den Schlüsselbund deines Betriebssystems verschlüsselt und verlässt deinen Rechner nur Richtung Google.'}
        </p>
      </div>
    </div>
  );
}

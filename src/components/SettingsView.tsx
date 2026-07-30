import { useEffect, useState } from 'react';
import {
  Download,
  FolderOpen,
  Info,
  KeyRound,
  Loader2,
  ShieldAlert,
  Trash2,
  Volume2,
} from 'lucide-react';
import { ApiKeyField, PROVIDER_META } from './ApiKeySetup';
import { bridge } from '../lib/bridge';
import { loadSettings, saveSettings } from '../lib/localDb';
import { keysApi } from '../services/api';
import { cn } from '../lib/utils';
import type { AppInfo, AppSettings, KeystoreState, VoiceProvider } from '../types';

const VOICE_OPTIONS: { id: VoiceProvider; label: string; body: string }[] = [
  { id: 'auto', label: 'Automatisch', body: 'Nutzt die beste verfügbare Stimme deiner hinterlegten Schlüssel.' },
  { id: 'gemini', label: 'Google Gemini', body: 'Im Google-Kontingent enthalten — kein zusätzlicher Anbieter nötig.' },
  { id: 'elevenlabs', label: 'ElevenLabs', body: 'Natürlichste Stimmen. Braucht einen ElevenLabs-Schlüssel.' },
  { id: 'openai', label: 'OpenAI', body: 'Solide Alternative. Braucht einen OpenAI-Schlüssel.' },
  { id: 'off', label: 'Aus', body: 'Nur Text — Simulationen laufen ohne Sprachausgabe.' },
];

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof KeyRound;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-black tracking-tight text-brand-navy">{title}</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function SettingsView({ info }: { info: AppInfo | null }) {
  const [keys, setKeys] = useState<KeystoreState | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  useEffect(() => {
    keysApi.state().then(setKeys).catch(() => setKeys(null));
    loadSettings().then(setSettings);
  }, []);

  const patchSettings = async (patch: Partial<AppSettings>) => {
    setSettings(await saveSettings(patch));
  };

  const exportData = async () => {
    setExporting(true);
    try {
      const result = await bridge.exportData();
      setExportMessage(result.saved ? `Gespeichert: ${result.filePath}` : null);
    } finally {
      setExporting(false);
    }
  };

  const resetAll = async () => {
    const result = await bridge.resetAll();
    // The main process asks for confirmation; a reset restarts the whole flow.
    if (result.cleared) window.location.reload();
  };

  return (
    <div className="mx-auto max-w-3xl px-1 py-2">
      <h1 className="mb-1 text-3xl font-black tracking-tight text-brand-navy">Einstellungen</h1>
      <p className="mb-9 text-sm text-slate-500">
        Alles hier gilt nur für diesen Rechner. Es gibt kein Konto und keine Synchronisation.
      </p>

      <Section
        icon={KeyRound}
        title="API-Schlüssel"
        description="Der Google-Schlüssel ist erforderlich. Die übrigen sind optional und verbessern Qualität oder Stimme."
      >
        <div className="space-y-3">
          {(['google', 'anthropic', 'elevenlabs', 'openai'] as const).map((provider) => (
            <ApiKeyField key={provider} provider={provider} state={keys} onChanged={setKeys} />
          ))}
        </div>
        {/* Cost estimate */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <div className="text-xs leading-relaxed text-slate-500 space-y-0.5">
            <p>
              <span className="font-semibold text-slate-700">Kosten pro Session (ca. 20 Min.):</span>{' '}
              ~5–10 Cent — Abrechnung direkt über dein Google-Konto, kein Aufschlag.
            </p>
            <p>
              <span className="font-semibold text-slate-600">Free Tier:</span>{' '}
              Bis zu 500 Anfragen/Tag kostenlos — reicht für ~25 Sessions täglich ohne Billing.
            </p>
          </div>
        </div>

        {keys?.encryptionAvailable === false && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-amber-50 px-4 py-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-xs leading-relaxed text-amber-800">
              Der System-Schlüsselbund ist auf diesem Rechner nicht verfügbar. Schlüssel werden
              unverschlüsselt in einer nur für dich lesbaren Datei abgelegt.
            </p>
          </div>
        )}
      </Section>

      <Section
        icon={Volume2}
        title="Sprachausgabe"
        description="Welche Stimme dein Gegenüber im Gespräch nutzt."
      >
        <div className="grid gap-2.5 sm:grid-cols-2">
          {VOICE_OPTIONS.map((option) => {
            const requiresKey =
              option.id === 'elevenlabs' || option.id === 'openai' ? option.id : null;
            const missingKey =
              requiresKey && !keys?.keys.find((item) => item.provider === requiresKey)?.configured;
            return (
              <button
                key={option.id}
                onClick={() => patchSettings({ voiceProvider: option.id })}
                className={cn(
                  'rounded-2xl border p-4 text-left transition-all',
                  settings?.voiceProvider === option.id
                    ? 'border-brand-green bg-brand-green/5 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300',
                )}
              >
                <p className="text-sm font-bold text-slate-900">{option.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{option.body}</p>
                {missingKey && (
                  <p className="mt-1.5 text-[11px] font-bold text-amber-600">
                    {PROVIDER_META[requiresKey].label}-Schlüssel fehlt — es wird Gemini genutzt.
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </Section>

      <Section
        icon={FolderOpen}
        title="Deine Daten"
        description={info?.dataDirectory ?? 'Profil, Simulationen und Auswertungen liegen lokal.'}
      >
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => bridge.revealDataFolder()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <FolderOpen className="h-4 w-4" />
            Ordner öffnen
          </button>
          <button
            onClick={exportData}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Alles exportieren
          </button>
          <button
            onClick={resetAll}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            Alle Daten löschen
          </button>
        </div>
        {exportMessage && (
          <p className="mt-3 break-all text-xs font-medium text-emerald-600">{exportMessage}</p>
        )}
      </Section>

      <p className="border-t border-slate-200 pt-6 text-xs leading-relaxed text-slate-400">
        Brocaly {info?.version ? `v${info.version}` : ''} — freie Software unter AGPL-3.0. Die
        Simulation ersetzt keine Prüfung und keine medizinische Beratung; KI-generierte Inhalte
        können fehlerhaft sein.
      </p>
    </div>
  );
}

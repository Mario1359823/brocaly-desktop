import { useEffect, useState } from 'react';
import { ArrowUpCircle, X } from 'lucide-react';
import { bridge } from '../lib/bridge';
import type { UpdateStatus } from '../types';

const DISMISS_KEY = 'brocaly_update_dismissed_version';
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * Zeigt an, wenn auf GitHub eine neuere Version liegt. Die App aktualisiert
 * sich nicht selbst — ohne Developer-ID-Signatur ginge das auf macOS nicht
 * zuverlässig (siehe electron/updates.ts). Ein Klick öffnet die Release-Seite.
 */
export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;

    const check = async () => {
      try {
        const next = await bridge.checkUpdate();
        if (!active || !next.available) return;
        // Eine einmal weggeklickte Version nicht erneut bewerben.
        if (localStorage.getItem(DISMISS_KEY) === next.latestVersion) return;
        setStatus(next);
      } catch {
        // Update-Prüfung ist Beiwerk — Fehler bleiben unsichtbar.
      }
    };

    check();
    const timer = window.setInterval(check, RECHECK_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  if (!status?.available || dismissed) return null;

  return (
    <div className="mb-3 rounded-xl border border-brand-green/25 bg-brand-green/5 p-3">
      <div className="flex items-start gap-2">
        <ArrowUpCircle className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-slate-800">Version {status.latestVersion} ist da</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
            Du nutzt {status.currentVersion}. Es wird nichts automatisch geladen oder
            installiert — nur wenn du es anstößt.
          </p>
          <button
            onClick={() => status.releaseUrl && bridge.openExternal(status.releaseUrl)}
            className="mt-2 text-[11px] font-bold text-brand-green hover:underline"
          >
            Release ansehen
          </button>
        </div>
        <button
          onClick={() => {
            if (status.latestVersion) localStorage.setItem(DISMISS_KEY, status.latestVersion);
            setDismissed(true);
          }}
          className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          aria-label="Update-Hinweis ausblenden"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

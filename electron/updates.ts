import { app } from 'electron';

/**
 * Update-Prüfung gegen die GitHub-Releases.
 *
 * Bewusst nur eine *Benachrichtigung*, kein stiller Selbst-Update: Squirrel.Mac
 * verlangt für ein automatisches Update eine gültige Developer-ID-Signatur, und
 * die hat Brocaly bewusst nicht (siehe electron-builder.yml). Ein ad-hoc
 * signiertes Bundle hat bei jedem Build einen anderen CDHash, das Update würde
 * also abgelehnt. Statt etwas zu bauen, das auf macOS still scheitert, zeigen
 * wir den Hinweis und öffnen die Download-Seite.
 */

const RELEASES_API = 'https://api.github.com/repos/Mario1359823/brocaly-desktop/releases/latest';
const CHECK_TIMEOUT_MS = 8000;

export interface UpdateStatus {
  /** Neuere Version vorhanden? Bei Fehlern oder offline immer false. */
  available: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseUrl?: string;
  /** Grund, warum nicht geprüft werden konnte — nur für Logs, nicht für die UI. */
  error?: string;
}

/** Vergleicht zwei Versionen wie 1.2.10 — höher als, gleich, niedriger. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v.replace(/^v/, '').split('-')[0].split('.').map((n) => Number.parseInt(n, 10) || 0);
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

export async function checkForUpdate(): Promise<UpdateStatus> {
  const currentVersion = app.getVersion();

  try {
    const response = await fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'brocaly-desktop' },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`GitHub antwortete ${response.status}`);

    const release = (await response.json()) as { tag_name?: string; html_url?: string; draft?: boolean };
    if (!release?.tag_name || release.draft) return { available: false, currentVersion };

    const latestVersion = release.tag_name.replace(/^v/, '');
    return {
      available: compareVersions(latestVersion, currentVersion) > 0,
      currentVersion,
      latestVersion,
      releaseUrl: release.html_url,
    };
  } catch (error) {
    // Offline oder GitHub nicht erreichbar ist kein Fehlerfall für die Nutzer:in.
    return { available: false, currentVersion, error: String(error) };
  }
}

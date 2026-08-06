import OpenAI from 'openai';
import { getKey } from '../../electron/keystore';
import { recordTokens } from '../usage';

/**
 * Brocaly spricht mit genau einem Anbieter.
 *
 * Früher hatte jedes Feature zwei oder drei Pfade mit stillen Rückfällen —
 * Gespräch wahlweise Claude oder Gemini, Sprachausgabe drei Engines, dazu eine
 * Modell-Discovery gegen Googles wandernde IDs. Ein Ausfall kam dadurch nie als
 * Fehler an, sondern als Symptom: Stille, Dauerladen, halbe Antworten. Ein
 * Anbieter, ein Schlüssel, kein Fallback — Fehler schlagen sichtbar durch.
 */

/** Gespräch: hält den langen klinischen Faden, streamt zügig genug. */
export const EXAM_MODEL = 'gpt-5.6-terra';
/** Auswertung, Bewertung, Kurztexte — deutlich günstiger, reicht für JSON. */
export const UTILITY_MODEL = 'gpt-5.6-luna';
/** Sprachausgabe und Transkription. */
export const TTS_MODEL = 'gpt-4o-mini-tts';
export const TRANSCRIBE_MODEL = 'gpt-transcribe';

export const EXAM_TIMEOUT_MS = 45_000;
export const TTS_TIMEOUT_MS = 30_000;
export const STT_TIMEOUT_MS = 120_000;

const LABEL = 'OpenAI';

export class MissingKeyError extends Error {
  status = 402;
  expose = true;
  constructor() {
    super(`${LABEL}-Schlüssel fehlt. Hinterlege ihn unter „Einstellungen → API-Schlüssel".`);
    this.name = 'MissingKeyError';
  }
}

/** Wirft einen benutzerlesbaren 402, solange kein Schlüssel hinterlegt ist. */
export function requireKey(): string {
  const key = getKey();
  if (!key) throw new MissingKeyError();
  return key;
}

export function hasKey(): boolean {
  return getKey() !== null;
}

/** Frischer Client pro Aufruf: der Schlüssel kann sich im Betrieb ändern. */
export function openai(timeoutMs = EXAM_TIMEOUT_MS): OpenAI {
  return new OpenAI({ apiKey: requireKey(), timeout: timeoutMs, maxRetries: 0 });
}

export async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1500): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const retryable = error?.status === 429 || error?.status === 503;
    if (retryable && retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

/**
 * Macht aus einem Anbieterfehler etwas, womit man etwas anfangen kann:
 * abgelehnter Schlüssel und erschöpftes Guthaben sind bei BYOK die mit Abstand
 * häufigsten Fälle.
 */
export function upstreamError(status: number, body: string): Error {
  const err = new Error() as Error & { status: number; expose: boolean };
  err.status = status;
  err.expose = true;

  if (status === 401 || status === 403) {
    err.message = `Dein ${LABEL}-Schlüssel wurde abgelehnt. Prüfe ihn unter „Einstellungen → API-Schlüssel".`;
  } else if (status === 429) {
    err.message = `${LABEL} hat die Anfrage gedrosselt — entweder zu viele Anfragen kurz hintereinander oder das Guthaben deines Kontos ist aufgebraucht. Prüfe die Abrechnung in deinem ${LABEL}-Konto.`;
  } else if (status >= 500) {
    err.message = `${LABEL} ist gerade nicht erreichbar. Versuche es in einem Moment noch einmal.`;
  } else {
    err.message = `${LABEL}-Fehler (${status}): ${body.slice(0, 200)}`;
  }
  return err;
}

/** Übersetzt einen SDK-Fehler in dieselbe benutzerlesbare Form. */
export function fromSdkError(err: unknown): Error {
  const error = err as { status?: number; message?: string };
  if (error instanceof MissingKeyError) return error;
  if (typeof error?.status === 'number') return upstreamError(error.status, error.message ?? '');
  return err instanceof Error ? err : new Error(String(err));
}

/** Prüft einen Schlüssel gegen OpenAI, bevor er gespeichert wird. */
export async function testKey(apiKey: string): Promise<void> {
  try {
    await new OpenAI({ apiKey, timeout: 15_000, maxRetries: 0 }).models.list();
  } catch (err) {
    throw fromSdkError(err);
  }
}

/** Zentral zählen: jeder Aufruf — Gespräch, Auswertung, Sprache — geht hier durch. */
export function recordUsage(usage: { input_tokens?: number; output_tokens?: number } | undefined | null): void {
  recordTokens(usage?.input_tokens ?? 0, usage?.output_tokens ?? 0);
}

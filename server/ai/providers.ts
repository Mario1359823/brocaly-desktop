import { Anthropic } from '@anthropic-ai/sdk';
import { getKey } from '../../electron/keystore';
import type { ApiProvider } from '../../shared/types';

export const ANTHROPIC_EXAM_MODEL = 'claude-sonnet-4-6';
export const ANTHROPIC_UTILITY_MODEL = 'claude-haiku-4-5-20251001';

export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const EXAM_FETCH_TIMEOUT_MS = 45_000;
export const TTS_FETCH_TIMEOUT_MS = 30_000;
export const STT_FETCH_TIMEOUT_MS = 120_000;

const PROVIDER_LABELS: Record<ApiProvider, string> = {
  google: 'Google Gemini',
  anthropic: 'Anthropic Claude',
  elevenlabs: 'ElevenLabs',
  openai: 'OpenAI',
};

export class MissingKeyError extends Error {
  status = 402;
  expose = true;
  constructor(public provider: ApiProvider) {
    super(
      `${PROVIDER_LABELS[provider]}-Schlüssel fehlt. Hinterlege ihn unter „Einstellungen → API-Schlüssel".`,
    );
    this.name = 'MissingKeyError';
  }
}

/** Throws a user-facing 402 when the provider has no key configured. */
export function requireKey(provider: ApiProvider): string {
  const key = getKey(provider);
  if (!key) throw new MissingKeyError(provider);
  return key;
}

export function hasKey(provider: ApiProvider): boolean {
  return getKey(provider) !== null;
}

export function anthropicClient(): Anthropic {
  return new Anthropic({ apiKey: requireKey('anthropic') });
}

/** A hung upstream must never pin the request forever. */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Respect a caller-supplied signal in addition to the timeout.
  const callerSignal = init.signal;
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function withRetry<T>(fn: () => Promise<T>, retries = 2, delay = 1500): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    // Free Gemini tiers rate-limit aggressively — back off instead of failing.
    const retryable = error?.status === 429 || error?.status === 503;
    if (retryable && retries > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

/**
 * Turns an upstream error body into something a user can act on: quota
 * exhaustion and invalid keys are by far the most common BYOK failures.
 */
export function upstreamError(provider: ApiProvider, status: number, body: string): Error {
  const label = PROVIDER_LABELS[provider];
  const err = new Error() as Error & { status: number; expose: boolean };
  err.status = status;
  err.expose = true;

  if (status === 401 || status === 403) {
    err.message = `Dein ${label}-Schlüssel wurde abgelehnt. Prüfe ihn unter „Einstellungen → API-Schlüssel".`;
  } else if (status === 429) {
    err.message = `${label} hat dein Kontingent vorerst gedrosselt. Warte kurz und versuche es erneut — im kostenlosen Google-Tarif ist die Zahl der Anfragen pro Minute begrenzt.`;
  } else if (status >= 500) {
    err.message = `${label} ist gerade nicht erreichbar. Versuche es in einem Moment noch einmal.`;
  } else {
    err.message = `${label}-Fehler (${status}): ${body.slice(0, 200)}`;
  }
  return err;
}

export async function geminiJson<T = any>(
  path: string,
  body: unknown,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  const key = requireKey('google');
  const response = await fetchWithTimeout(
    `${GEMINI_BASE}/${path}?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    },
    timeoutMs,
  );
  if (!response.ok) {
    throw upstreamError('google', response.status, await response.text().catch(() => ''));
  }
  return (await response.json()) as T;
}

export function geminiText(payload: any): string {
  const parts = payload?.candidates?.[0]?.content?.parts ?? [];
  const raw = parts
    // Gemini 2.5 Flash is a thinking model; skip thinking tokens — only
    // include the actual response parts (those without thought: true).
    .filter((part: any) => !part?.thought)
    .map((part: any) => part?.text ?? '')
    .join('')
    .trim();
  return stripGeminiStructuredPrefix(raw);
}

/**
 * Gemini 2.5 Flash (and sometimes gemini-flash-latest) leaks structured
 * planning headers into its visible output, e.g.:
 *   "*Greeting & Intro:* Guten Tag"
 *   "Response**:\n    *   *Greeting & Introduction*: Guten Tag"
 *
 * These headers are always in English even when the prompt is German, so
 * detecting and stripping them is safe. Exported for use in the streaming path.
 */
export function stripGeminiStructuredPrefix(text: string): string {
  // One or two English-labelled lines before the actual dialogue.
  const prefixRe = /^(?:\*{0,2}[A-Za-z][A-Za-z\s&]+\*{0,2}\s*:\s*(?:\n\s*(?:\*\s+)?\*{0,2}[A-Za-z][A-Za-z\s&]+\*{0,2}\s*:\s*)?)/;
  const cleaned = text.replace(prefixRe, '').trim();
  return cleaned || text; // never return empty if original had content
}

export function geminiUsage(payload: any): { input: number; output: number } {
  const usage = payload?.usageMetadata ?? {};
  return { input: usage.promptTokenCount ?? 0, output: usage.candidatesTokenCount ?? 0 };
}

/** Verifies a key against the provider before it is stored. */
export async function testProviderKey(provider: ApiProvider, apiKey: string): Promise<void> {
  if (provider === 'anthropic') {
    await new Anthropic({ apiKey }).messages.create({
      model: ANTHROPIC_UTILITY_MODEL,
      max_tokens: 8,
      messages: [{ role: 'user', content: 'Antworte nur mit OK.' }],
    });
    return;
  }

  if (provider === 'google') {
    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      { method: 'GET' },
      15_000,
    );
    if (!response.ok) {
      throw upstreamError('google', response.status, await response.text().catch(() => ''));
    }
    return;
  }

  if (provider === 'elevenlabs') {
    const response = await fetchWithTimeout(
      'https://api.elevenlabs.io/v1/user',
      { method: 'GET', headers: { 'xi-api-key': apiKey } },
      15_000,
    );
    if (!response.ok) {
      throw upstreamError('elevenlabs', response.status, await response.text().catch(() => ''));
    }
    return;
  }

  const response = await fetchWithTimeout(
    'https://api.openai.com/v1/models',
    { method: 'GET', headers: { Authorization: `Bearer ${apiKey}` } },
    15_000,
  );
  if (!response.ok) {
    throw upstreamError('openai', response.status, await response.text().catch(() => ''));
  }
}

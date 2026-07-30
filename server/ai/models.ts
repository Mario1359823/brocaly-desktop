import { fetchWithTimeout, requireKey, upstreamError } from './providers';

/**
 * Google retires Gemini model ids regularly, and retired ids stop working for
 * *new* API keys first — which is exactly the case for a freshly installed
 * BYOK app. Hard-coding an id would break installs months after release, so the
 * available models are discovered once per launch and matched against a
 * preference list.
 */

interface GeminiModel {
  name: string;
  supportedGenerationMethods?: string[];
}

/**
 * Highest preference first; the first pattern with a match wins.
 * gemini-flash-latest is the only reliably available alias for most API keys;
 * explicit names like gemini-2.5-flash / gemini-2.0-flash are often deprecated
 * sooner for new users.
 */
const CHAT_PREFERENCES: RegExp[] = [
  /^gemini-flash-latest$/,
  /^gemini-3(\.\d+)?-flash$/,
  /^gemini-2\.5-flash-\d{3}$/,   // versioned e.g. -002, -003
  /^gemini-2\.5-flash$/,
  /^gemini-\d(\.\d+)?-flash$/,
  /flash/,
];

const TTS_PREFERENCES: RegExp[] = [
  /^gemini-2\.5-flash-preview-tts$/,
  /flash.*-tts$/,
  /-tts$/,
];

export interface GeminiModelChoice {
  chat: string;
  tts: string | null;
}

let cached: GeminiModelChoice | null = null;
let inFlight: Promise<GeminiModelChoice> | null = null;

function shortName(model: GeminiModel): string {
  return model.name.replace(/^models\//, '');
}

function pick(models: GeminiModel[], preferences: RegExp[]): string | null {
  const names = models.map(shortName);
  for (const pattern of preferences) {
    // Prefer the shortest match so plain ids beat dated or size-suffixed ones.
    const matches = names.filter((name) => pattern.test(name)).sort((a, b) => a.length - b.length);
    if (matches.length > 0) return matches[0];
  }
  return null;
}

async function discover(): Promise<GeminiModelChoice> {
  const key = requireKey('google');
  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`,
    { method: 'GET' },
    15_000,
  );
  if (!response.ok) {
    throw upstreamError('google', response.status, await response.text().catch(() => ''));
  }

  const payload = (await response.json()) as { models?: GeminiModel[] };
  const all = payload.models ?? [];

  const chatCandidates = all.filter((model) =>
    model.supportedGenerationMethods?.includes('generateContent'),
  );
  // TTS models are excluded from the chat pool — they only return audio.
  const chat =
    pick(
      chatCandidates.filter((model) => !shortName(model).endsWith('-tts')),
      CHAT_PREFERENCES,
    ) ?? 'gemini-flash-latest';

  const tts = pick(chatCandidates, TTS_PREFERENCES);

  console.log(`[gemini] Modelle erkannt — Chat: ${chat}, Sprachausgabe: ${tts ?? 'keine'}`);
  return { chat, tts };
}

/** Resolved once per launch; concurrent callers share the same lookup. */
export async function geminiModels(): Promise<GeminiModelChoice> {
  if (cached) return cached;
  if (!inFlight) {
    inFlight = discover()
      .then((result) => {
        cached = result;
        return result;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

/** Called after a key change so the next request re-discovers. */
export function resetGeminiModels(): void {
  cached = null;
}

export async function geminiChatModel(): Promise<string> {
  return (await geminiModels()).chat;
}

export async function geminiTtsModel(): Promise<string | null> {
  return (await geminiModels()).tts;
}

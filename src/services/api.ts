import type {
  CaseSummary,
  ExamMode,
  ExaminerConfig,
  KeystoreState,
  Message,
  PerformanceProfile,
  Profile,
  SessionFeedback,
  UsageTotals,
} from '../types';
import { appInfo } from '../lib/bridge';

/**
 * Client for the embedded local API. Every call carries the per-launch token
 * from the preload bridge so no other process on the machine can drive the
 * user's API keys.
 */

let apiBase = '';
let apiToken = '';

export async function initApi(): Promise<void> {
  const info = await appInfo();
  // In development the renderer is served by Vite, which proxies /api to the
  // local server; in production both come from the same origin.
  apiBase = info.isDev ? '' : '';
  apiToken = info.apiToken;
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { 'Content-Type': 'application/json', 'X-Brocaly-Token': apiToken, ...extra };
}

async function readError(res: Response): Promise<Error> {
  const payload = await res.json().catch(() => ({ error: res.statusText }));
  const error = new Error(payload.error || 'Es ist ein Fehler aufgetreten.') as Error & {
    status: number;
  };
  error.status = res.status;
  return error;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await readError(res);
  return res.json();
}

function cleanHistory(history: Message[]): Message[] {
  return history
    .filter((message) => message.text.trim().length > 0)
    .map((message) => ({ ...message, text: message.text.trim() }));
}

// --- Verbrauch ------------------------------------------------------------

export const usageApi = {
  /** Zähler auf null setzen — beim Start einer Simulation. */
  async reset(): Promise<UsageTotals> {
    const res = await fetch('/api/usage/reset', { method: 'POST', headers: headers() });
    if (!res.ok) throw await readError(res);
    return res.json();
  },

  async snapshot(): Promise<UsageTotals> {
    const res = await fetch('/api/usage', { headers: headers() });
    if (!res.ok) throw await readError(res);
    return res.json();
  },
};

// --- API keys -------------------------------------------------------------

export const keysApi = {
  async state(): Promise<KeystoreState> {
    const res = await fetch('/api/keys', { headers: headers() });
    if (!res.ok) throw await readError(res);
    return res.json();
  },

  async save(apiKey: string): Promise<KeystoreState> {
    const res = await fetch('/api/keys', {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ apiKey }),
    });
    if (!res.ok) throw await readError(res);
    return res.json();
  },

  async test(apiKey: string): Promise<void> {
    const res = await fetch('/api/keys/test', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ apiKey }),
    });
    if (!res.ok) throw await readError(res);
  },

  async remove(): Promise<KeystoreState> {
    const res = await fetch('/api/keys', { method: 'DELETE', headers: headers() });
    if (!res.ok) throw await readError(res);
    return res.json();
  },
};

// --- Simulation -----------------------------------------------------------

const ttsAudioCache = new Map<string, Array<{ buffer: ArrayBuffer; contentType: string }>>();
const TTS_CACHE_MAX = 60;

function ttsCacheKey(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 200);
  return `v2:${normalized}`;
}

export const examApi = {
  async generateExamResponse(
    history: Message[],
    subject: string,
    user?: Partial<Profile>,
    focusTopics?: string,
    excludedTopics?: string,
    remainingTime?: number,
    contextProfile?: { casesCompleted: CaseSummary[]; performanceProfile: PerformanceProfile },
    durationMinutes?: number,
    examiner?: ExaminerConfig,
    examMode?: ExamMode,
    doneIds?: string[],
    endIds?: string[],
  ): Promise<{ text: string; caseId?: string; totalCases?: number }> {
    return post('/api/exam-response', {
      history: cleanHistory(history),
      subject,
      user,
      focusTopics,
      excludedTopics,
      remainingTime,
      casesCompleted: contextProfile?.casesCompleted,
      performanceProfile: contextProfile?.performanceProfile,
      durationMinutes,
      examiner,
      examMode,
      doneIds,
      endIds,
    });
  },

  async getCaseCount(subject: string): Promise<number> {
    const res = await fetch(`/api/case-count?subject=${encodeURIComponent(subject)}`, {
      headers: headers(),
    });
    const data = await res.json().catch(() => ({ count: 0 }));
    return data.count || 0;
  },

  async getCaseList(
    subject: string,
  ): Promise<{ id: string; titel: string; tags: string[]; kategorie: string; kategorieLabel: string }[]> {
    const res = await fetch(`/api/cases?subject=${encodeURIComponent(subject)}`, {
      headers: headers(),
    });
    const data = await res.json().catch(() => ({ cases: [] }));
    return data.cases || [];
  },

  async getSubjects(): Promise<string[]> {
    const res = await fetch('/api/subjects', { headers: headers() });
    const data = await res.json().catch(() => ({ subjects: [] }));
    return data.subjects || [];
  },

  async getFeedbackBadge(userAnswer: string, examinerQuestion: string): Promise<string> {
    const data = await post<{ result: string }>('/api/feedback-badge', {
      userAnswer,
      examinerQuestion,
    });
    return data.result;
  },

  async generateCaseSummary(history: Message[]): Promise<CaseSummary> {
    return post<CaseSummary>('/api/generate-case-summary', { history: cleanHistory(history) });
  },

  async generateFinalFeedback(
    history: Message[],
    user?: { target?: string; specialtyTarget?: string },
    casesCompleted?: CaseSummary[],
  ): Promise<SessionFeedback> {
    return post<SessionFeedback>('/api/final-feedback', {
      history: cleanHistory(history),
      user,
      casesCompleted,
    });
  },

  /**
   * Streams the examiner's answer token by token so speech synthesis can start
   * on the first finished sentence instead of after the full response.
   */
  generateExamResponseStream(
    history: Message[],
    subject: string,
    user?: Partial<Profile>,
    focusTopics?: string,
    excludedTopics?: string,
    remainingTime?: number,
    contextProfile?: { casesCompleted: CaseSummary[]; performanceProfile: PerformanceProfile },
    durationMinutes?: number,
    examiner?: ExaminerConfig,
    examMode?: ExamMode,
    onChunk?: (accumulatedText: string) => void,
    onFirstSentence?: (firstSentence: string) => void,
    onDone?: (fullText: string) => void,
    onError?: (err: Error) => void,
    onMeta?: (meta: { caseId?: string; totalCases?: number; examEnded?: boolean }) => void,
    doneIds?: string[],
    endIds?: string[],
  ): AbortController {
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch('/api/exam-response-stream', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            history: cleanHistory(history),
            subject,
            user,
            focusTopics,
            excludedTopics,
            remainingTime,
            casesCompleted: contextProfile?.casesCompleted,
            performanceProfile: contextProfile?.performanceProfile,
            durationMinutes,
            examiner,
            examMode,
            doneIds,
            endIds,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          onError?.(await readError(res));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let firstSentenceFired = false;
        let lastChunkUpdateLen = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value, { stream: true });

          // Throttle UI updates so React does not re-render per token.
          if (fullText.length - lastChunkUpdateLen >= 15) {
            lastChunkUpdateLen = fullText.length;
            onChunk?.(fullText);
          }

          if (!firstSentenceFired && fullText.length >= 30) {
            const match = fullText.slice(25).search(/[.!?](?:\s|$)/);
            if (match >= 0) {
              firstSentenceFired = true;
              onFirstSentence?.(fullText.slice(0, 25 + match + 1));
            }
          }
        }
        // Flush any multi-byte UTF-8 tail bytes that the streaming decoder held back.
        fullText += decoder.decode();

        const metaMarkerIdx = fullText.lastIndexOf('\n__META__');
        if (metaMarkerIdx >= 0) {
          try {
            onMeta?.(JSON.parse(fullText.slice(metaMarkerIdx + '\n__META__'.length)));
          } catch {
            /* non-critical */
          }
          fullText = fullText.slice(0, metaMarkerIdx);
          // Always push the clean text after stripping meta — the length check
          // would otherwise skip this update because the stripped text is
          // shorter than the last tracked chunk length (which included meta).
          onChunk?.(fullText);
        } else if (fullText.length > lastChunkUpdateLen) {
          onChunk?.(fullText);
        }

        if (!firstSentenceFired && fullText) onFirstSentence?.(fullText);
        onDone?.(fullText);
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        onError?.(err);
      }
    })();

    return controller;
  },

  async textToSpeech(text: string): Promise<string> {
    const cleanText = text.trim();
    if (!cleanText) return '';
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ text: cleanText }),
      });
      if (!res.ok) return '';
      return URL.createObjectURL(await res.blob());
    } catch {
      return '';
    }
  },

  /**
   * Sentence-level streaming TTS. Each finished chunk arrives as NDJSON and is
   * handed to the caller immediately, so playback starts while the rest is
   * still being synthesized.
   */
  textToSpeechStream(
    text: string,
    onChunk: (url: string, index: number) => void,
    onDone: () => void,
    onError: (message?: string) => void,
  ): AbortController {
    const controller = new AbortController();
    const cleanText = text.trim();
    if (!cleanText) {
      setTimeout(onDone, 0);
      return controller;
    }

    const cacheKey = ttsCacheKey(cleanText);
    const cached = ttsAudioCache.get(cacheKey);
    if (cached) {
      setTimeout(() => {
        if (controller.signal.aborted) return;
        cached.forEach(({ buffer, contentType }, index) => {
          onChunk(URL.createObjectURL(new Blob([buffer], { type: contentType })), index);
        });
        onDone();
      }, 0);
      return controller;
    }

    const chunksToCache = new Map<number, { buffer: ArrayBuffer; contentType: string }>();

    (async () => {
      try {
        const res = await fetch('/api/tts-stream', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ text: cleanText }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const message = await res
            .json()
            .then((body) => body?.error as string | undefined)
            .catch(() => undefined);
          onError(message);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const chunk = JSON.parse(line);
              if (chunk.done) {
                // Every sentence failed: the stream itself was fine, so this is
                // the only place the user can be told why nothing was spoken.
                if (chunksToCache.size === 0 && chunk.message) {
                  onError(chunk.message as string);
                  return;
                }
                if (chunksToCache.size > 0) {
                  const sorted = Array.from(chunksToCache.entries())
                    .sort(([a], [b]) => a - b)
                    .map(([, value]) => value);
                  if (ttsAudioCache.size >= TTS_CACHE_MAX) {
                    const firstKey = ttsAudioCache.keys().next().value;
                    if (firstKey !== undefined) ttsAudioCache.delete(firstKey);
                  }
                  ttsAudioCache.set(cacheKey, sorted);
                }
                onDone();
                return;
              }
              if (chunk.error) continue;
              const binary = atob(chunk.audio);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
              chunksToCache.set(chunk.index, {
                buffer: bytes.buffer.slice(0),
                contentType: chunk.contentType,
              });
              onChunk(URL.createObjectURL(new Blob([bytes], { type: chunk.contentType })), chunk.index);
            } catch {
              /* skip malformed lines */
            }
          }
        }
        onDone();
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        onError();
      }
    })();

    return controller;
  },

  async transcribe(audioBase64: string, mimeType: string, subject?: string): Promise<string> {
    const data = await post<{ text: string }>('/api/transcribe', {
      audio: audioBase64,
      mimeType,
      subject,
    });
    return data.text ?? '';
  },
};

export { headers as apiHeaders };

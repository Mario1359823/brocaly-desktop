import { getWhisperPrompt } from '../sttPrompts';
import { stripSttHallucinations } from '../text';
import {
  STT_FETCH_TIMEOUT_MS,
  fetchWithTimeout,
  geminiJson,
  geminiText,
  hasKey,
  requireKey,
  upstreamError,
} from './providers';
import { geminiChatModel } from './models';

export const MAX_STT_AUDIO_BYTES = 25 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  'audio/webm;codecs=opus': 'webm',
  'audio/webm': 'webm',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

async function transcribeWithGemini(
  audioBase64: string,
  mimeType: string,
  subject?: string,
): Promise<string> {
  const payload = await geminiJson(
    `${await geminiChatModel()}:generateContent`,
    {
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mimeType, data: audioBase64 } },
            {
              text: `Transkribiere dieses deutschsprachige Audio eines medizinischen Fachgesprächs exakt. Der Sprecher verwendet medizinische Fachbegriffe. Kontext: ${getWhisperPrompt(subject)} Gib NUR den gesprochenen Text zurück. Keine Erklärungen, keine Kommentare, keine Anführungszeichen. Falls kein Sprechen erkennbar ist, antworte mit genau einem Wort: LEER`,
            },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 2048 },
    },
    STT_FETCH_TIMEOUT_MS,
  );

  let text = geminiText(payload);
  // The model sometimes narrates instead of transcribing — treat that as silence.
  if (/^LEER$/i.test(text) || /transkribiere/i.test(text) || /kein(e)?\s*(sprache|audio|sprechen|text)/i.test(text)) {
    text = '';
  }
  return stripSttHallucinations(text);
}

async function transcribeWithWhisper(
  audioBuffer: Buffer,
  mimeType: string,
  subject?: string,
): Promise<string> {
  const apiKey = requireKey('openai');
  const ext = MIME_TO_EXT[mimeType] ?? 'webm';

  const formData = new FormData();
  formData.append('file', new Blob([new Uint8Array(audioBuffer)], { type: mimeType }), `audio.${ext}`);
  formData.append('model', 'whisper-1');
  formData.append('language', 'de');
  formData.append('response_format', 'verbose_json');
  // Medical vocabulary hints noticeably improve domain term recognition.
  formData.append('prompt', getWhisperPrompt(subject));

  const response = await fetchWithTimeout(
    'https://api.openai.com/v1/audio/transcriptions',
    { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: formData },
    STT_FETCH_TIMEOUT_MS,
  );
  if (!response.ok) {
    throw upstreamError('openai', response.status, await response.text().catch(() => ''));
  }

  const payload = (await response.json()) as {
    text?: string;
    segments?: { text?: string; no_speech_prob?: number; avg_logprob?: number }[];
  };
  const segments = payload.segments ?? [];
  const text =
    segments.length > 0
      ? segments
          .filter((segment) => !((segment.no_speech_prob ?? 0) > 0.6 && (segment.avg_logprob ?? 0) < -1.0))
          .map((segment) => segment.text ?? '')
          .join('')
          .trim()
      : (payload.text ?? '').trim();

  return stripSttHallucinations(text);
}

/**
 * Whisper is used when an OpenAI key exists because it handles heavy accents and
 * noisy microphones better; otherwise Gemini transcribes with the required
 * Google key, so speech input works on a Google-only setup.
 */
export async function transcribe(
  audioBuffer: Buffer,
  mimeType: string,
  subject?: string,
): Promise<{ text: string; engine: 'whisper' | 'gemini' }> {
  if (hasKey('openai')) {
    try {
      return { text: await transcribeWithWhisper(audioBuffer, mimeType, subject), engine: 'whisper' };
    } catch (err) {
      console.warn('[stt] Whisper fehlgeschlagen, weiche auf Gemini aus:', err);
    }
  }
  const text = await transcribeWithGemini(audioBuffer.toString('base64'), mimeType, subject);
  return { text, engine: 'gemini' };
}

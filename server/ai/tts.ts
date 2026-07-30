import type { VoiceProvider } from '../../shared/types';
import {
  TTS_FETCH_TIMEOUT_MS,
  fetchWithTimeout,
  geminiJson,
  hasKey,
  requireKey,
  upstreamError,
} from './providers';
import { geminiTtsModel } from './models';

export type TtsEngine = 'gemini' | 'elevenlabs' | 'openai';

export interface SynthesisResult {
  buffer: Buffer;
  contentType: string;
  engine: TtsEngine;
}

// --- Gemini -------------------------------------------------------------
// Google's TTS model needs no extra subscription, so a single Gemini key is
// enough to run Brocaly end to end. Voices are picked to match each examiner's
// character; the style hint steers delivery, which the model honours natively.
const GEMINI_VOICES: Record<string, { voice: string; style: string }> = {
  hoffmann: {
    voice: 'Kore',
    style:
      'Sprich als erfahrene Chefärztin: sachlich, bestimmt, klar artikuliert, zügiges Tempo, wenig Wärme, keine Theatralik.',
  },
  mueller: {
    voice: 'Charon',
    style:
      'Sprich als erfahrener Facharzt: ruhig, präzise, professionell freundlich, gleichmäßiges Tempo, klare Betonung.',
  },
  jamie: {
    voice: 'Puck',
    style:
      'Sprich als entspannter, kollegialer Arzt: warm, locker, ermutigend, natürlicher Gesprächsrhythmus.',
  },
};

function geminiVoice(voice: unknown) {
  const key = typeof voice === 'string' ? voice.toLowerCase() : '';
  return GEMINI_VOICES[key] ?? GEMINI_VOICES.mueller;
}

/**
 * Gemini returns raw signed 16-bit little-endian PCM. Browsers will not decode
 * that, so wrap it in a minimal RIFF/WAVE container.
 */
function pcmToWav(pcm: Buffer, sampleRate: number, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // audio format: PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

function sampleRateFromMime(mimeType: string): number {
  const match = /rate=(\d+)/.exec(mimeType ?? '');
  return match ? Number(match[1]) : 24_000;
}

async function synthesizeWithGemini(text: string, voice: unknown): Promise<SynthesisResult> {
  const model = await geminiTtsModel();
  if (!model) throw new Error('Dein Google-Konto bietet derzeit kein Sprachausgabe-Modell an.');
  const selected = geminiVoice(voice);
  const payload = await geminiJson(
    `${model}:generateContent`,
    {
      contents: [{ parts: [{ text: `${selected.style}\n\n${text}` }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: selected.voice } },
        },
      },
    },
    TTS_FETCH_TIMEOUT_MS,
  );

  const inline = payload?.candidates?.[0]?.content?.parts?.find((part: any) => part?.inlineData)
    ?.inlineData;
  if (!inline?.data) throw new Error('Gemini TTS lieferte kein Audio.');

  const pcm = Buffer.from(inline.data, 'base64');
  return {
    buffer: pcmToWav(pcm, sampleRateFromMime(inline.mimeType)),
    contentType: 'audio/wav',
    engine: 'gemini',
  };
}

// --- ElevenLabs ----------------------------------------------------------
// Optional upgrade: the cloned voices Brocaly uses in production.
const ELEVENLABS_MODEL = 'eleven_flash_v2_5';
const ELEVENLABS_VOICES: Record<
  string,
  { voiceId: string; stability: number; similarityBoost: number; style: number; seed: number; speed?: number }
> = {
  hoffmann: { voiceId: '8wPhfH9uUzEMHTmRkoAR', stability: 0.45, similarityBoost: 0.82, style: 0.35, seed: 1101 },
  mueller: { voiceId: 'TUKJhQmz3RPYBNAgC5A1', stability: 0.55, similarityBoost: 0.8, style: 0.2, seed: 2202, speed: 1.08 },
  jamie: { voiceId: 'HzBCRGsOskP44taMg2CT', stability: 0.5, similarityBoost: 0.82, style: 0.3, seed: 3303 },
};

async function synthesizeWithElevenLabs(text: string, voice: unknown): Promise<SynthesisResult> {
  const apiKey = requireKey('elevenlabs');
  const key = typeof voice === 'string' ? voice.toLowerCase() : '';
  const selected = ELEVENLABS_VOICES[key] ?? ELEVENLABS_VOICES.mueller;

  const response = await fetchWithTimeout(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(selected.voiceId)}?output_format=mp3_44100_128&optimize_streaming_latency=2`,
    {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL,
        language_code: 'de',
        seed: selected.seed,
        voice_settings: {
          stability: selected.stability,
          similarity_boost: selected.similarityBoost,
          style: selected.style,
          use_speaker_boost: true,
          ...(selected.speed ? { speed: selected.speed } : {}),
        },
      }),
    },
    TTS_FETCH_TIMEOUT_MS,
  );
  if (!response.ok) {
    throw upstreamError('elevenlabs', response.status, await response.text().catch(() => ''));
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') ?? 'audio/mpeg',
    engine: 'elevenlabs',
  };
}

// --- OpenAI --------------------------------------------------------------
const OPENAI_VOICE_FOR_EXAMINER: Record<string, string> = {
  hoffmann: 'sage',
  mueller: 'cedar',
  jamie: 'marin',
};

const OPENAI_INSTRUCTIONS: Record<string, string> = {
  sage: 'Sprich auf Deutsch mit einer erwachsenen weiblichen Stimme. Natürliches bis leicht zügiges medizinisches Fachgespräch, klare Artikulation, kurze Pausen, lebendige Betonung. Nicht langsam, nicht monoton.',
  cedar: 'Sprich auf Deutsch mit einer erwachsenen männlichen Stimme. Natürliches bis leicht zügiges medizinisches Fachgespräch, klare Artikulation, kurze Pausen, lebendige Betonung. Nicht langsam, nicht monoton.',
  marin: 'Sprich auf Deutsch mit einer warmen kollegialen Stimme. Natürliches, flüssiges Sprechtempo, kurze Pausen, lebendige Betonung. Freundlich und unterstützend.',
};

async function synthesizeWithOpenAi(text: string, voice: unknown): Promise<SynthesisResult> {
  const apiKey = requireKey('openai');
  const key = typeof voice === 'string' ? voice.toLowerCase() : '';
  const ttsVoice = OPENAI_VOICE_FOR_EXAMINER[key] ?? 'cedar';

  const response = await fetchWithTimeout(
    'https://api.openai.com/v1/audio/speech',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        input: text,
        voice: ttsVoice,
        instructions: OPENAI_INSTRUCTIONS[ttsVoice],
        response_format: 'mp3',
      }),
    },
    TTS_FETCH_TIMEOUT_MS,
  );
  if (!response.ok) {
    throw upstreamError('openai', response.status, await response.text().catch(() => ''));
  }
  return { buffer: Buffer.from(await response.arrayBuffer()), contentType: 'audio/mpeg', engine: 'openai' };
}

/**
 * Resolves the engine for a synthesis request. `auto` prefers the best voice the
 * user has paid for and falls back to Gemini, which every install has.
 */
export function resolveEngine(preference: VoiceProvider): TtsEngine | null {
  if (preference === 'off') return null;
  if (preference === 'elevenlabs') return hasKey('elevenlabs') ? 'elevenlabs' : 'gemini';
  if (preference === 'openai') return hasKey('openai') ? 'openai' : 'gemini';
  if (preference === 'gemini') return 'gemini';
  if (hasKey('elevenlabs')) return 'elevenlabs';
  if (hasKey('openai')) return 'openai';
  return 'gemini';
}

export async function synthesize(
  text: string,
  voice: unknown,
  preference: VoiceProvider,
): Promise<SynthesisResult> {
  const engine = resolveEngine(preference);
  if (!engine) throw new Error('Sprachausgabe ist deaktiviert.');

  try {
    if (engine === 'elevenlabs') return await synthesizeWithElevenLabs(text, voice);
    if (engine === 'openai') return await synthesizeWithOpenAi(text, voice);
    return await synthesizeWithGemini(text, voice);
  } catch (err) {
    // A premium provider failing (quota, outage) must not kill the simulation —
    // Gemini is always available once the required Google key is set.
    if (engine !== 'gemini') {
      console.warn(`[tts] ${engine} fehlgeschlagen, weiche auf Gemini aus:`, err);
      return synthesizeWithGemini(text, voice);
    }
    throw err;
  }
}

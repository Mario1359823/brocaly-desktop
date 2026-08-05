import express, { Router } from 'express';
import { MAX_STT_AUDIO_BYTES, transcribe } from '../ai/stt';
import { resolveEngine, synthesize } from '../ai/tts';
import { readSettings } from '../settings';
import { fixMedicalPronunciation, limitTtsSpokenText, logServerError, stripMarkdown } from '../text';
import { TranscribeRequestSchema, TtsRequestSchema } from '../validation';
import { exposableMessage, safeEndResponse, safeWriteChunk, sendError } from './http';

export const speechRouter = Router();

function speakableText(raw: string): string {
  return limitTtsSpokenText(fixMedicalPronunciation(stripMarkdown(raw)));
}

speechRouter.post('/tts', async (req, res) => {
  try {
    const parsed = TtsRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Text fehlt (max. 5000 Zeichen).' });

    const cleanText = speakableText(parsed.data.text);
    if (!cleanText) return res.status(400).json({ error: 'Kein sprechbarer Text.' });

    const result = await synthesize(cleanText, parsed.data.voice, readSettings().voiceProvider);
    res.setHeader('X-TTS-Chars', String(cleanText.length));
    res.setHeader('X-TTS-Provider', result.engine);
    res.setHeader('Content-Type', result.contentType);
    res.send(result.buffer);
  } catch (err) {
    logServerError('api.tts', err);
    sendError(res, err);
  }
});

/**
 * Splits an answer into sentence-sized chunks and streams the audio as NDJSON so
 * playback can start on the first sentence instead of waiting for the whole
 * response to be synthesized.
 */
speechRouter.post('/tts-stream', async (req, res) => {
  try {
    const parsed = TtsRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Text fehlt (max. 5000 Zeichen).' });

    const preference = readSettings().voiceProvider;
    const engine = resolveEngine(preference);
    if (!engine) return res.status(503).json({ error: 'Sprachausgabe ist deaktiviert.' });

    const cleanText = speakableText(parsed.data.text);
    if (!cleanText) return res.status(400).json({ error: 'Kein sprechbarer Text.' });

    const MIN_CHUNK_LEN = 40;
    const TAIL_THRESHOLD = 25;
    const MAX_CHUNKS = 24;

    const rawParts = cleanText.split(/(?<=[.!?:;])\s+/);
    let sentences: string[] = [];
    let buf = '';
    for (const part of rawParts) {
      buf += (buf ? ' ' : '') + part;
      if (buf.length >= MIN_CHUNK_LEN) {
        sentences.push(buf);
        buf = '';
      }
    }
    if (buf) {
      if (sentences.length > 0 && buf.length < TAIL_THRESHOLD) sentences[sentences.length - 1] += ` ${buf}`;
      else sentences.push(buf);
    }
    if (sentences.length === 0) return res.status(400).json({ error: 'Kein sprechbarer Text.' });
    if (sentences.length > MAX_CHUNKS) {
      sentences = [...sentences.slice(0, MAX_CHUNKS - 1), sentences.slice(MAX_CHUNKS - 1).join(' ')];
    }

    res.setHeader('X-TTS-Chars', String(cleanText.length));
    res.setHeader('X-TTS-Provider', engine);
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');

    // Synthesize a few chunks ahead of playback without flooding the provider.
    const MAX_CONCURRENCY = 3;
    const inFlight = new Map<number, Promise<{ buffer: Buffer; contentType: string } | null>>();
    let nextToStart = 0;
    // The response is already a 200 by the time chunks fail, so the reason has
    // to travel inside the stream — otherwise the app just falls silent.
    let firstFailure: string | null = null;

    const startNextChunk = () => {
      if (nextToStart >= sentences.length) return;
      const index = nextToStart++;
      inFlight.set(
        index,
        synthesize(sentences[index], parsed.data.voice, preference).catch((err) => {
          logServerError(`api.tts-stream.chunk${index}`, err);
          firstFailure ??= exposableMessage(err);
          return null;
        }),
      );
    };

    for (let i = 0; i < Math.min(MAX_CONCURRENCY, sentences.length); i++) startNextChunk();

    for (let i = 0; i < sentences.length; i++) {
      const result = await inFlight.get(i);
      inFlight.delete(i);
      startNextChunk();
      if (!result) {
        safeWriteChunk(
          res,
          `${JSON.stringify({ index: i, error: true, message: firstFailure })}\n`,
          'api.tts-stream',
        );
        continue;
      }
      safeWriteChunk(
        res,
        `${JSON.stringify({ index: i, audio: result.buffer.toString('base64'), contentType: result.contentType })}\n`,
        'api.tts-stream',
      );
    }

    safeWriteChunk(
      res,
      `${JSON.stringify({ done: true, total: sentences.length, message: firstFailure })}\n`,
      'api.tts-stream',
    );
    safeEndResponse(res, 'api.tts-stream');
  } catch (err) {
    logServerError('api.tts-stream', err);
    if (!res.headersSent) sendError(res, err);
    else safeEndResponse(res, 'api.tts-stream');
  }
});

speechRouter.post('/transcribe', express.json({ limit: '34mb' }), async (req, res) => {
  try {
    const parsed = TranscribeRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Keine Audio-Daten.' });

    const audioBuffer = Buffer.from(parsed.data.audio, 'base64');
    if (audioBuffer.length > MAX_STT_AUDIO_BYTES) {
      return res.status(400).json({ error: 'Aufnahme zu groß (max. 25 MB).' });
    }

    const { text } = await transcribe(audioBuffer, parsed.data.mimeType ?? 'audio/webm', parsed.data.subject);
    res.json({ text });
  } catch (err) {
    logServerError('api.transcribe', err);
    sendError(res, err);
  }
});

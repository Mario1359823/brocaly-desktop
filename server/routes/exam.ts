import { Router } from 'express';
import {
  EXAM_MODEL,
  EXAM_TIMEOUT_MS,
  fromSdkError,
  openai,
  recordUsage,
  withRetry,
} from '../ai/providers';
import { buildExamPrompt } from '../prompt';
import { logServerError } from '../text';
import { ExamRequestSchema } from '../validation';
import { safeEndResponse, safeWriteChunk, sendError } from './http';

const EXAM_RESPONSE_MAX_TOKENS = 1024;

/** Der Verlauf geht als Rollen-Turns rein; das System-Prompt über `instructions`. */
function toInput(messages: { role: string; content: string }[]) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
    content: m.content,
  }));
}

export const examRouter = Router();

examRouter.post('/exam-response', async (req, res) => {
  try {
    const parsed = ExamRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Ungültige Anfrage.' });
    const body = parsed.data;

    const { systemContent, validMessages, chosenCaseId, totalCases } = buildExamPrompt(body as any);

    const response = await withRetry(async () => {
      try {
        return await openai(EXAM_TIMEOUT_MS).responses.create({
          model: EXAM_MODEL,
          instructions: systemContent,
          input: toInput(validMessages),
          max_output_tokens: EXAM_RESPONSE_MAX_TOKENS,
          temperature: 0.7,
        });
      } catch (err) {
        throw fromSdkError(err);
      }
    });
    recordUsage(response.usage);

    const text = response.output_text?.trim() ?? '';
    if (!text) throw new Error('Die KI hat eine leere Antwort geliefert.');
    res.json({ text, ...(chosenCaseId ? { caseId: chosenCaseId, totalCases } : {}) });
  } catch (err) {
    logServerError('api.exam-response', err);
    sendError(res, err);
  }
});

examRouter.post('/exam-response-stream', async (req, res) => {
  try {
    const parsed = ExamRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Ungültige Anfrage.' });
    const body = parsed.data;

    const { systemContent, validMessages, chosenCaseId, totalCases } = buildExamPrompt(body as any);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    // Stop paying for tokens nobody will read when the window closes mid-answer.
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abort.abort();
    });

    let outBuf = '';
    const ENDE = '[ENDE]';
    const normalizeEnde = (s: string) => s.replace(/[[{]ENDE[\]}]/gi, '[ENDE]');

    // Hold back the last few characters so a split end marker is never emitted.
    const flushChunk = (chunkText: string) => {
      if (!chunkText) return;
      outBuf += normalizeEnde(chunkText);
      const flushLen = Math.max(0, outBuf.length - ENDE.length);
      if (flushLen > 0) {
        safeWriteChunk(res, outBuf.slice(0, flushLen), 'api.exam-response-stream');
        outBuf = outBuf.slice(flushLen);
      }
    };

    let stream;
    try {
      stream = await openai(EXAM_TIMEOUT_MS).responses.create(
        {
          model: EXAM_MODEL,
          instructions: systemContent,
          input: toInput(validMessages),
          max_output_tokens: EXAM_RESPONSE_MAX_TOKENS,
          temperature: 0.7,
          stream: true,
        },
        { signal: abort.signal },
      );
    } catch (err) {
      throw fromSdkError(err);
    }

    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') flushChunk(event.delta);
      else if (event.type === 'response.completed') recordUsage(event.response.usage);
    }

    // Flush the tail and swallow the end marker itself.
    let examEnded = false;
    const markerIdx = outBuf.lastIndexOf(ENDE);
    if (markerIdx >= 0) {
      examEnded = true;
      const beforeMarker = outBuf.slice(0, markerIdx).trimEnd();
      if (beforeMarker) safeWriteChunk(res, beforeMarker, 'api.exam-response-stream');
    } else if (outBuf) {
      safeWriteChunk(res, outBuf, 'api.exam-response-stream');
    }

    if (chosenCaseId || examEnded) {
      const meta: Record<string, unknown> = {};
      if (chosenCaseId) {
        meta.caseId = chosenCaseId;
        meta.totalCases = totalCases;
      }
      if (examEnded) meta.examEnded = true;
      safeWriteChunk(res, `\n__META__${JSON.stringify(meta)}`, 'api.exam-response-stream');
    }
    safeEndResponse(res, 'api.exam-response-stream');
  } catch (err) {
    logServerError('api.exam-response-stream', err);
    if (!res.headersSent) sendError(res, err);
    else safeEndResponse(res, 'api.exam-response-stream');
  }
});

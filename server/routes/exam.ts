import { Router } from 'express';
import {
  ANTHROPIC_EXAM_MODEL,
  EXAM_FETCH_TIMEOUT_MS,
  GEMINI_BASE,
  anthropicClient,
  geminiJson,
  geminiText,
  geminiUsage,
  hasKey,
  requireKey,
  stripGeminiStructuredPrefix,
  upstreamError,
  withRetry,
} from '../ai/providers';
import { geminiChatModel } from '../ai/models';
import { buildExamPrompt } from '../prompt';
import { logServerError } from '../text';
import { ExamRequestSchema } from '../validation';
import { safeEndResponse, safeWriteChunk, sendError } from './http';

// 360 was too low for Gemini 2.5 Flash: thinking tokens consume ~300 of the
// budget internally, leaving only ~60 for the visible response. 1024 gives
// enough room for both thinking and a full exam turn.
const EXAM_RESPONSE_MAX_TOKENS = 1024;

/**
 * Doctors get Claude Sonnet when an Anthropic key exists — it holds a long
 * clinical thread better. Without that key everything runs on Gemini so a
 * Google-only install is fully functional.
 */
function usePremiumModel(role: string | undefined): boolean {
  return role === 'doctor' && hasKey('anthropic');
}

function toGeminiContents(messages: { role: string; content: string }[]) {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));
}

export const examRouter = Router();

examRouter.post('/exam-response', async (req, res) => {
  try {
    const parsed = ExamRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Ungültige Anfrage.' });
    const body = parsed.data;

    const { systemStatic, systemDynamic, systemContent, validMessages, chosenCaseId, totalCases } =
      buildExamPrompt(body as any);

    let text: string;

    if (usePremiumModel(body.user?.role)) {
      const systemBlocks: any[] = [
        { type: 'text', text: systemStatic, cache_control: { type: 'ephemeral' } },
      ];
      if (systemDynamic) systemBlocks.push({ type: 'text', text: systemDynamic });

      const message = await withRetry(() =>
        anthropicClient().messages.create({
          model: ANTHROPIC_EXAM_MODEL,
          system: systemBlocks,
          messages: validMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          max_tokens: EXAM_RESPONSE_MAX_TOKENS,
          temperature: 0.7,
        }),
      );
      const block = message.content[0];
      text = block?.type === 'text' ? block.text : '';
    } else {
      const model = await geminiChatModel();
      // Disable thinking for models that support it (explicit gemini-2.5-flash
      // name). The alias gemini-flash-latest does NOT accept thinkingConfig and
      // returns 400 — only add it when we have the real model name.
      const geminiConfig: Record<string, unknown> = {
        maxOutputTokens: EXAM_RESPONSE_MAX_TOKENS,
        temperature: 0.7,
      };
      if (model.startsWith('gemini-2.5-flash') && model !== 'gemini-flash-latest') {
        geminiConfig.thinkingConfig = { thinkingBudget: 0 };
      }
      const payload = await withRetry(() =>
        geminiJson(
          `${model}:generateContent`,
          {
            systemInstruction: { parts: [{ text: systemContent }] },
            contents: toGeminiContents(validMessages),
            generationConfig: geminiConfig,
          },
          EXAM_FETCH_TIMEOUT_MS,
        ),
      );
      text = geminiText(payload);
      geminiUsage(payload);
    }

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

    const { systemStatic, systemDynamic, systemContent, validMessages, chosenCaseId, totalCases } =
      buildExamPrompt(body as any);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');

    // Stop paying for tokens nobody will read when the window closes mid-answer.
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abort.abort();
    });

    let outBuf = '';
    const ENDE = '[ENDE]';
    // Sonnet writes {ENDE}, Flash writes [ENDE] — normalise both.
    const normalizeEnde = (s: string) => s.replace(/[[{]ENDE[\]}]/gi, '[ENDE]');

    // Buffer the first 80 chars so we can detect and strip any Gemini structured
    // planning prefix (e.g. "*Greeting & Intro:* …") before the client sees it.
    const PREFIX_HOLD = 80;
    let prefixBuf = '';
    let prefixDone = false;

    const routeToOutBuf = (text: string) => {
      outBuf += text;
      const flushLen = Math.max(0, outBuf.length - ENDE.length);
      if (flushLen > 0) {
        safeWriteChunk(res, outBuf.slice(0, flushLen), 'api.exam-response-stream');
        outBuf = outBuf.slice(flushLen);
      }
    };

    // Hold back the last few characters so a split end marker is never emitted.
    const flushChunk = (chunkText: string) => {
      if (!chunkText) return;
      const normalized = normalizeEnde(chunkText);
      if (!prefixDone) {
        prefixBuf += normalized;
        if (prefixBuf.length >= PREFIX_HOLD) {
          prefixDone = true;
          routeToOutBuf(stripGeminiStructuredPrefix(prefixBuf));
        }
      } else {
        routeToOutBuf(normalized);
      }
    };

    if (usePremiumModel(body.user?.role)) {
      // Claude never emits structured planning prefixes — skip prefix detection.
      prefixDone = true;

      const systemBlocks: any[] = [
        { type: 'text', text: systemStatic, cache_control: { type: 'ephemeral' } },
      ];
      if (systemDynamic) systemBlocks.push({ type: 'text', text: systemDynamic });

      const stream = anthropicClient().messages.stream(
        {
          model: ANTHROPIC_EXAM_MODEL,
          system: systemBlocks,
          messages: validMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          max_tokens: EXAM_RESPONSE_MAX_TOKENS,
          temperature: 0.7,
        },
        { signal: abort.signal },
      );
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          flushChunk(event.delta.text);
        }
      }
      await stream.finalMessage();
    } else {
      const key = requireKey('google');
      const chatModel = await geminiChatModel();
      const streamConfig: Record<string, unknown> = {
        maxOutputTokens: EXAM_RESPONSE_MAX_TOKENS,
        temperature: 0.7,
      };
      if (chatModel.startsWith('gemini-2.5-flash') && chatModel !== 'gemini-flash-latest') {
        streamConfig.thinkingConfig = { thinkingBudget: 0 };
      }
      const response = await fetch(
        `${GEMINI_BASE}/${chatModel}:streamGenerateContent?key=${encodeURIComponent(key)}&alt=sse`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemContent }] },
            contents: toGeminiContents(validMessages),
            generationConfig: streamConfig,
          }),
          signal: abort.signal,
        },
      );
      if (!response.ok || !response.body) {
        throw upstreamError('google', response.status, await response.text().catch(() => ''));
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const chunk = JSON.parse(line.slice(6));
            // Gemini 2.5 Flash emits thinking tokens (thought: true) before the
            // actual response. Skip them so only real content reaches the client.
            const parts: any[] = chunk.candidates?.[0]?.content?.parts ?? [];
            const text = parts
              .filter((p: any) => !p?.thought)
              .map((p: any) => p?.text ?? '')
              .join('');
            if (text) flushChunk(text);
          } catch {
            /* malformed chunk */
          }
        }
      }
      // Flush any remaining bytes held by the streaming decoder.
      buffer += decoder.decode();
      if (buffer.startsWith('data: ')) {
        try {
          const chunk = JSON.parse(buffer.slice(6));
          const parts: any[] = chunk.candidates?.[0]?.content?.parts ?? [];
          const text = parts.filter((p: any) => !p?.thought).map((p: any) => p?.text ?? '').join('');
          if (text) flushChunk(text);
        } catch { /* malformed final chunk */ }
      }
    }

    // If the response was shorter than PREFIX_HOLD, flush the prefix buffer now.
    if (!prefixDone) {
      prefixDone = true;
      routeToOutBuf(stripGeminiStructuredPrefix(prefixBuf));
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

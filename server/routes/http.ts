import type { Response } from 'express';
import { logServerError } from '../text';

/**
 * Errors marked `expose` (missing key, upstream quota) carry a message the user
 * can act on. Everything else stays generic in the response but is logged.
 */
export function sendError(res: Response, err: unknown): void {
  const error = err as { status?: number; expose?: boolean; message?: string };
  const status = Number(error?.status) || 500;
  const exposable = error?.expose || [400, 401, 402, 403, 404, 429].includes(status);
  res.status(status).json({
    error: exposable && error?.message ? error.message : 'Ein Fehler ist aufgetreten.',
  });
}

export function safeWriteChunk(res: Response, chunk: string | Buffer, scope: string): boolean {
  if (res.destroyed || res.writableEnded) return false;
  try {
    return res.write(chunk);
  } catch (err) {
    logServerError(`${scope}.write`, err);
    safeEndResponse(res, scope);
    return false;
  }
}

export function safeEndResponse(res: Response, scope: string): void {
  if (res.destroyed || res.writableEnded) return;
  try {
    res.end();
  } catch (err) {
    logServerError(`${scope}.end`, err);
  }
}

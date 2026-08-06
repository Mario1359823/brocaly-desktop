import { Router } from 'express';
import { deleteKey, setKey, state } from '../../electron/keystore';
import { testKey } from '../ai/providers';
import { logServerError } from '../text';
import { KeyRequestSchema } from '../validation';
import { sendError } from './http';

export const keysRouter = Router();

keysRouter.get('/keys', (_req, res) => {
  res.json(state());
});

/**
 * A key is verified against OpenAI before it is written, so a typo surfaces
 * during setup rather than in the middle of a simulation.
 */
keysRouter.put('/keys', async (req, res) => {
  try {
    const parsed = KeyRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Ungültiger API-Schlüssel.' });

    await testKey(parsed.data.apiKey);
    setKey(parsed.data.apiKey);
    res.json(state());
  } catch (err) {
    logServerError('api.keys.put', err);
    sendError(res, err);
  }
});

keysRouter.post('/keys/test', async (req, res) => {
  try {
    const parsed = KeyRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Ungültiger API-Schlüssel.' });

    await testKey(parsed.data.apiKey);
    res.json({ ok: true });
  } catch (err) {
    logServerError('api.keys.test', err);
    sendError(res, err);
  }
});

keysRouter.delete('/keys', (_req, res) => {
  deleteKey();
  res.json(state());
});

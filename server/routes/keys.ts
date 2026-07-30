import { Router } from 'express';
import { deleteKey, isProvider, setKey, state } from '../../electron/keystore';
import { testProviderKey } from '../ai/providers';
import { resetGeminiModels } from '../ai/models';
import { logServerError } from '../text';
import { KeyRequestSchema } from '../validation';
import { sendError } from './http';

export const keysRouter = Router();

keysRouter.get('/keys', (_req, res) => {
  res.json(state());
});

/**
 * A key is verified against the provider before it is written, so a typo
 * surfaces during setup rather than in the middle of a simulation.
 */
keysRouter.put('/keys/:provider', async (req, res) => {
  try {
    const provider = req.params.provider;
    if (!isProvider(provider)) return res.status(400).json({ error: 'Unbekannter Anbieter.' });

    const parsed = KeyRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Ungültiger API-Schlüssel.' });

    await testProviderKey(provider, parsed.data.apiKey);
    setKey(provider, parsed.data.apiKey);
    resetGeminiModels();
    res.json(state());
  } catch (err) {
    logServerError('api.keys.put', err);
    sendError(res, err);
  }
});

keysRouter.post('/keys/:provider/test', async (req, res) => {
  try {
    const provider = req.params.provider;
    if (!isProvider(provider)) return res.status(400).json({ error: 'Unbekannter Anbieter.' });

    const parsed = KeyRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Ungültiger API-Schlüssel.' });

    await testProviderKey(provider, parsed.data.apiKey);
    res.json({ ok: true });
  } catch (err) {
    logServerError('api.keys.test', err);
    sendError(res, err);
  }
});

keysRouter.delete('/keys/:provider', (req, res) => {
  const provider = req.params.provider;
  if (!isProvider(provider)) return res.status(400).json({ error: 'Unbekannter Anbieter.' });
  deleteKey(provider);
  resetGeminiModels();
  res.json(state());
});

import type { Server } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import path from 'node:path';
import express from 'express';
import { isDev, rendererDirectory } from '../electron/paths';
import { casesRouter } from './routes/cases';
import { examRouter } from './routes/exam';
import { feedbackRouter } from './routes/feedback';
import { keysRouter } from './routes/keys';
import { speechRouter } from './routes/speech';
import { usageRouter } from './routes/usage';
import { logServerError } from './text';

export interface LocalApi {
  server: Server;
  port: number;
  token: string;
  origin: string;
  close: () => Promise<void>;
}

/**
 * Per-launch bearer token for the local API.
 *
 * The server only listens on the loopback interface, so nothing off the machine
 * can reach it. The token additionally stops *other local processes* — a browser
 * tab on the same machine, another app — from spending the user's API quota.
 * The renderer receives it through the preload bridge.
 */
function createToken(): string {
  return randomBytes(32).toString('base64url');
}

function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function startLocalApi(): Promise<LocalApi> {
  const token = createToken();
  const app = express();

  app.disable('x-powered-by');

  // Any cross-origin request is by definition not our renderer.
  app.use((req, res, next) => {
    if (req.headers.origin && !req.headers.origin.startsWith('http://127.0.0.1')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  });

  app.use('/api', (req, res, next) => {
    const provided = req.get('X-Brocaly-Token') ?? '';
    if (!provided || !tokensMatch(provided, token)) {
      return res.status(401).json({ error: 'Nicht autorisiert.' });
    }
    next();
  });

  // Audio uploads carry their own larger limit inside the speech router.
  app.use('/api', express.json({ limit: '1mb' }));
  app.use('/api', (err: any, _req: any, res: any, next: any) => {
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Anfrage zu groß.' });
    }
    if (err) return res.status(400).json({ error: 'Ungültige Anfrage.' });
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, dev: isDev });
  });

  app.use('/api', examRouter);
  app.use('/api', feedbackRouter);
  app.use('/api', speechRouter);
  app.use('/api', casesRouter);
  app.use('/api', keysRouter);
  app.use('/api', usageRouter);

  // In development the renderer is served by Vite; in production the built
  // bundle is served from here so `fetch('/api/...')` stays same-origin.
  if (!isDev) {
    const dir = rendererDirectory();
    app.use(express.static(dir, { index: false }));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(dir, 'index.html'));
    });
  }

  const server = await new Promise<Server>((resolve, reject) => {
    // Port 0 in production → the OS hands out a free ephemeral port.
    const listener = app.listen(isDev ? 5274 : 0, '127.0.0.1', () => resolve(listener));
    listener.on('error', reject);
  });

  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  server.on('error', (err) => logServerError('local-api', err));

  return {
    server,
    port,
    token,
    origin: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
      }),
  };
}

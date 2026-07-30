import path from 'node:path';
import { app } from 'electron';

/**
 * Dev mode is opt-in via `npm run dev`, not inferred from `app.isPackaged` —
 * `npm run start` runs an unpackaged production build and must serve the
 * bundled renderer rather than look for a Vite dev server.
 */
export const isDev = process.env.BROCALY_DEV === '1';

/** Everything the user owns lives here: profile, sessions, API keys. */
export function dataDirectory(): string {
  return app.getPath('userData');
}

export function dataFile(): string {
  return path.join(dataDirectory(), 'brocaly-data.json');
}

export function keysFile(): string {
  return path.join(dataDirectory(), 'brocaly-keys.json');
}

export function caseQueueFile(): string {
  return path.join(dataDirectory(), 'case-queue.json');
}

/**
 * The case library ships as extraResources in packaged builds and lives in
 * `resources/cases` while developing.
 */
export function caseDirectory(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'cases')
    : path.join(app.getAppPath(), 'resources', 'cases');
}

export function rendererDirectory(): string {
  return path.join(app.getAppPath(), 'dist', 'renderer');
}

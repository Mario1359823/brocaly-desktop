import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Die lokale Ablage ist die einzige Kopie der Nutzerdaten — es gibt keinen
 * Server, der etwas retten könnte. Getestet wird gegen ein echtes temporäres
 * Verzeichnis, weil genau das Dateiverhalten die Fehlerquelle ist.
 */
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brocaly-store-test-'));

vi.mock('electron', () => ({
  app: {
    getPath: () => tempDir,
    getAppPath: () => tempDir,
    isPackaged: false,
  },
}));

const store = await import('./store');

describe('lokale Ablage', () => {
  beforeEach(() => {
    store.resetAll();
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('legt ein Profil an und liest es zurück', () => {
    store.saveProfile({ name: 'Mario', role: 'doctor' });
    expect(store.read().profile?.name).toBe('Mario');
    expect(store.read().profile?.role).toBe('doctor');
  });

  it('sortiert Sitzungen mit der neuesten zuerst', () => {
    const base = { messages: [], subject: 'Kardiologie', status: 'completed' as const };
    store.saveSession({ ...base, id: 'alt', startTime: 1000 });
    store.saveSession({ ...base, id: 'neu', startTime: 5000 });
    expect(store.listSessions().map((s) => s.id)).toEqual(['neu', 'alt']);
  });

  it('überschreibt eine Sitzung mit gleicher Id, statt sie zu verdoppeln', () => {
    const session = {
      id: 'gleich',
      startTime: 1000,
      messages: [],
      subject: 'Neurologie',
      status: 'completed' as const,
    };
    store.saveSession(session);
    store.saveSession({ ...session, subject: 'Kardiologie' });
    const all = store.listSessions();
    expect(all).toHaveLength(1);
    expect(all[0].subject).toBe('Kardiologie');
  });

  describe('Entwurf einer laufenden Simulation', () => {
    const draft = {
      subject: 'Kardiologie',
      startTime: 1000,
      savedAt: 2000,
      messages: [{ role: 'model' as const, text: 'Frage?', timestamp: 1500 }],
    };

    it('speichert und liest zurück', () => {
      store.saveDraft(draft);
      expect(store.readDraft()?.subject).toBe('Kardiologie');
    });

    it('meldet nichts, wenn keiner da ist', () => {
      store.clearDraft();
      expect(store.readDraft()).toBeNull();
    });

    it('verwirft einen Entwurf ohne Wortwechsel — der ist wertlos', () => {
      store.saveDraft({ ...draft, messages: [] });
      expect(store.readDraft()).toBeNull();
    });

    it('wird beim Löschen aller Daten mit entfernt', () => {
      store.saveDraft(draft);
      store.resetAll();
      expect(store.readDraft()).toBeNull();
    });
  });
});

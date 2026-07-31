import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type ExamSession } from '../shared/types';

// `electron/paths` fragt Electron nach dem Nutzerdaten-Ordner. Im Test zeigt der
// auf ein frisches Temp-Verzeichnis, damit echte Nutzerdaten nie berührt werden.
const mocked = vi.hoisted(() => ({ userData: '' }));
vi.mock('electron', () => ({
  app: {
    getPath: () => mocked.userData,
    getAppPath: () => mocked.userData,
    isPackaged: false,
  },
}));

type Store = typeof import('../electron/store');
let store: Store;

// Der Store hält einen Modul-Cache. Jeder Test bekommt deshalb ein frisches
// Modul plus ein frisches Verzeichnis — sonst leckt Zustand zwischen Tests.
async function freshStore(): Promise<Store> {
  vi.resetModules();
  return import('../electron/store');
}

function session(patch: Partial<ExamSession> = {}): ExamSession {
  return {
    id: 'session-1',
    startTime: 1_700_000_000_000,
    messages: [],
    subject: 'Innere Medizin',
    status: 'completed',
    ...patch,
  };
}

beforeEach(async () => {
  mocked.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'brocaly-test-'));
  store = await freshStore();
});

afterEach(() => {
  fs.rmSync(mocked.userData, { recursive: true, force: true });
});

const dataFile = () => path.join(mocked.userData, 'brocaly-data.json');

describe('read / migrate', () => {
  it('startet ohne Datei mit leeren Standarddaten', () => {
    const data = store.read();
    expect(data.profile).toBeNull();
    expect(data.sessions).toEqual([]);
    expect(data.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('ergänzt Einstellungen, die es in der gespeicherten Version noch nicht gab', async () => {
    fs.writeFileSync(
      dataFile(),
      JSON.stringify({ version: 1, profile: null, sessions: [], settings: { autoSpeak: false } }),
    );
    store = await freshStore();

    const settings = store.read().settings;
    expect(settings.autoSpeak).toBe(false);
    expect(settings.defaultExaminerId).toBe(DEFAULT_SETTINGS.defaultExaminerId);
    expect(settings.voiceProvider).toBe(DEFAULT_SETTINGS.voiceProvider);
  });

  it('repariert Felder mit falschem Typ statt beim Lesen zu werfen', async () => {
    fs.writeFileSync(
      dataFile(),
      JSON.stringify({ version: 1, sessions: 'kaputt', caseProgress: 42 }),
    );
    store = await freshStore();

    expect(store.read().sessions).toEqual([]);
    expect(store.read().caseProgress).toEqual({});
  });

  it('sichert eine beschädigte Datei weg und blockiert den Start nicht', async () => {
    fs.writeFileSync(dataFile(), '{ das ist kein JSON');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    store = await freshStore();

    expect(store.read().profile).toBeNull();
    const backups = fs.readdirSync(mocked.userData).filter((f) => f.includes('.corrupt-'));
    expect(backups).toHaveLength(1);
    expect(fs.readFileSync(path.join(mocked.userData, backups[0]), 'utf-8')).toBe(
      '{ das ist kein JSON',
    );
  });
});

describe('saveProfile', () => {
  it('vergibt id und createdAt einmalig und behält sie bei Updates', () => {
    const first = store.saveProfile({ name: 'Mario' });
    expect(first.id).toBeTruthy();

    const second = store.saveProfile({ selectedSubject: 'Kardiologie' });
    expect(second.id).toBe(first.id);
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.name).toBe('Mario');
    expect(second.selectedSubject).toBe('Kardiologie');
  });

  it('schreibt die Datei mit Rechten nur für die eigene Nutzerin', () => {
    store.saveProfile({ name: 'Mario' });
    expect(fs.statSync(dataFile()).mode & 0o777).toBe(0o600);
  });

  it('überlebt einen Neustart', async () => {
    store.saveProfile({ name: 'Mario', role: 'doctor' });
    store = await freshStore();
    expect(store.read().profile?.name).toBe('Mario');
  });
});

describe('Sitzungen', () => {
  it('sortiert die neueste nach oben', () => {
    store.saveSession(session({ id: 'alt', startTime: 1000 }));
    store.saveSession(session({ id: 'neu', startTime: 3000 }));
    store.saveSession(session({ id: 'mittel', startTime: 2000 }));

    expect(store.listSessions().map((s) => s.id)).toEqual(['neu', 'mittel', 'alt']);
  });

  it('ersetzt eine Sitzung mit gleicher sessionId statt sie zu duplizieren', () => {
    store.saveSession(session({ id: 'a', sessionId: 'sid-1', status: 'active' }));
    store.saveSession(session({ id: 'b', sessionId: 'sid-1', status: 'completed' }));

    const all = store.listSessions();
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe('completed');
  });

  it('deckelt die Zahl gespeicherter Sitzungen, damit die Datei nicht unbegrenzt wächst', () => {
    for (let i = 0; i < 520; i++) {
      store.saveSession(session({ id: `s-${i}`, startTime: i }));
    }
    const all = store.listSessions();
    expect(all).toHaveLength(500);
    // Getrimmt werden die ältesten.
    expect(all.at(-1)?.id).toBe('s-20');
  });

  it('löscht einzeln und komplett', () => {
    store.saveSession(session({ id: 'a', startTime: 1 }));
    store.saveSession(session({ id: 'b', startTime: 2 }));

    store.deleteSession('a');
    expect(store.listSessions().map((s) => s.id)).toEqual(['b']);

    store.saveCaseOutcome('Innere Medizin', 'case-1', 'passed');
    store.deleteAllSessions();
    expect(store.listSessions()).toEqual([]);
    // Fallfortschritt gehört zu den Sitzungen und geht mit.
    expect(store.getCaseProgress('Innere Medizin').passedIds).toEqual([]);
  });
});

describe('saveCaseOutcome', () => {
  it('hält einen Fall in genau einem Eimer', () => {
    store.saveCaseOutcome('Kardiologie', 'case-1', 'failed');
    expect(store.getCaseProgress('Kardiologie')).toEqual({
      passedIds: [],
      failedIds: ['case-1'],
      repeatIds: [],
    });

    // Beim zweiten Anlauf bestanden → darf nicht in beiden Listen stehen.
    store.saveCaseOutcome('Kardiologie', 'case-1', 'passed');
    expect(store.getCaseProgress('Kardiologie')).toEqual({
      passedIds: ['case-1'],
      failedIds: [],
      repeatIds: [],
    });
  });

  it('nimmt denselben Fall nicht doppelt auf', () => {
    store.saveCaseOutcome('Kardiologie', 'case-1', 'passed');
    store.saveCaseOutcome('Kardiologie', 'case-1', 'passed');
    expect(store.getCaseProgress('Kardiologie').passedIds).toEqual(['case-1']);
  });

  it('hält Fachgebiete auseinander', () => {
    store.saveCaseOutcome('Kardiologie', 'case-1', 'passed');
    store.saveCaseOutcome('Neurologie', 'case-2', 'failed');

    expect(store.getCaseProgress('Kardiologie').passedIds).toEqual(['case-1']);
    expect(store.getCaseProgress('Neurologie').failedIds).toEqual(['case-2']);
    expect(store.getCaseProgress('Unbekanntes Fach')).toEqual({
      passedIds: [],
      failedIds: [],
      repeatIds: [],
    });
  });
});

describe('Entwurf der laufenden Simulation', () => {
  const draft = { subject: 'Innere Medizin', startTime: 1, savedAt: 2, messages: [] as never[] };

  it('gibt ohne Datei null zurück', () => {
    expect(store.readDraft()).toBeNull();
  });

  it('verwirft einen Entwurf ohne Wortwechsel — der ist wertlos', () => {
    store.saveDraft(draft);
    expect(store.readDraft()).toBeNull();
  });

  it('liest einen Entwurf mit Wortwechsel zurück und lässt sich löschen', () => {
    const withMessages = {
      ...draft,
      messages: [{ role: 'model' as const, text: 'Guten Tag.', timestamp: 1 }],
    };
    store.saveDraft(withMessages);
    expect(store.readDraft()).toEqual(withMessages);

    store.clearDraft();
    expect(store.readDraft()).toBeNull();
  });

  it('gibt bei beschädigtem Entwurf null zurück, statt den Start zu blockieren', () => {
    fs.writeFileSync(path.join(mocked.userData, 'exam-draft.json'), '{ kaputt');
    expect(store.readDraft()).toBeNull();
  });

  it('schreibt den Entwurf atomar — ein Absturz mittendrin darf den alten nicht zerstören', () => {
    const first = {
      ...draft,
      messages: [{ role: 'model' as const, text: 'Erste Antwort.', timestamp: 1 }],
    };
    store.saveDraft(first);

    // Absturz genau zwischen Schreiben und Umbenennen.
    const rename = vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw new Error('Prozess abgestürzt');
    });
    expect(() =>
      store.saveDraft({
        ...draft,
        messages: [{ role: 'model' as const, text: 'Zweite Antwort.', timestamp: 2 }],
      }),
    ).toThrow();
    rename.mockRestore();

    // Der zuletzt vollständig geschriebene Entwurf ist unversehrt.
    expect(store.readDraft()).toEqual(first);
  });
});

describe('resetAll', () => {
  it('entfernt Profil, Sitzungen, Fortschritt und den Entwurf', () => {
    store.saveProfile({ name: 'Mario' });
    store.saveSession(session());
    store.saveCaseOutcome('Kardiologie', 'case-1', 'passed');
    store.saveDraft({
      subject: 'Innere Medizin',
      startTime: 1,
      savedAt: 2,
      messages: [{ role: 'model', text: 'Guten Tag.', timestamp: 1 }],
    });

    const data = store.resetAll();
    expect(data.profile).toBeNull();
    expect(data.sessions).toEqual([]);
    expect(data.caseProgress).toEqual({});
    expect(data.settings).toEqual(DEFAULT_SETTINGS);
    expect(store.readDraft()).toBeNull();
  });
});

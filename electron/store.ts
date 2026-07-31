import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  type AppSettings,
  type BrocalyData,
  type CaseOutcomeStatus,
  type CaseProgress,
  type ExamSession,
  type Profile,
  DEFAULT_SETTINGS,
  type ExamDraft,
} from '../shared/types';
import { dataDirectory, dataFile } from './paths';

const CURRENT_VERSION = 1;
const MAX_SESSIONS = 500;

function emptyData(): BrocalyData {
  return {
    version: CURRENT_VERSION,
    profile: null,
    sessions: [],
    caseProgress: {},
    settings: { ...DEFAULT_SETTINGS },
  };
}

let cache: BrocalyData | null = null;

function migrate(raw: unknown): BrocalyData {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  const data = raw as Partial<BrocalyData>;
  return {
    version: CURRENT_VERSION,
    profile: data.profile ?? null,
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    caseProgress:
      data.caseProgress && typeof data.caseProgress === 'object' ? data.caseProgress : {},
    // Merge so settings added in later versions get their defaults.
    settings: { ...base.settings, ...(data.settings ?? {}) },
  };
}

export function read(): BrocalyData {
  if (cache) return cache;
  const file = dataFile();
  try {
    if (fs.existsSync(file)) {
      cache = migrate(JSON.parse(fs.readFileSync(file, 'utf-8')));
      return cache;
    }
  } catch (err) {
    // A corrupt store must never block startup — keep a copy and start fresh.
    try {
      fs.renameSync(file, `${file}.corrupt-${Date.now()}`);
    } catch {
      /* best effort */
    }
    console.error('[store] Datei beschädigt, starte mit leerem Speicher:', err);
  }
  cache = emptyData();
  return cache;
}

/** Atomic write: a crash mid-write can never truncate the user's data. */
function writeFileAtomic(file: string, contents: unknown): void {
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(contents, null, 2), { encoding: 'utf-8', mode: 0o600 });
  fs.renameSync(tmp, file);
}

function persist(data: BrocalyData): BrocalyData {
  cache = data;
  writeFileAtomic(dataFile(), data);
  return data;
}

function mutate(update: (data: BrocalyData) => BrocalyData): BrocalyData {
  return persist(update(read()));
}

export function saveProfile(input: Partial<Profile>): Profile {
  const data = read();
  const profile: Profile = {
    id: data.profile?.id ?? randomUUID(),
    createdAt: data.profile?.createdAt ?? new Date().toISOString(),
    name: '',
    role: 'student',
    ...data.profile,
    ...input,
  };
  mutate((current) => ({ ...current, profile }));
  return profile;
}

export function saveSettings(patch: Partial<AppSettings>): AppSettings {
  const settings = { ...read().settings, ...patch };
  mutate((current) => ({ ...current, settings }));
  return settings;
}

export function listSessions(): ExamSession[] {
  return [...read().sessions].sort((a, b) => b.startTime - a.startTime);
}

export function saveSession(session: ExamSession): ExamSession {
  mutate((current) => {
    const key = session.sessionId ?? session.id;
    const rest = current.sessions.filter((item) => (item.sessionId ?? item.id) !== key);
    // Newest first, then trim so the file cannot grow without bound.
    const sessions = [session, ...rest]
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, MAX_SESSIONS);
    return { ...current, sessions };
  });
  return session;
}

export function deleteSession(sessionId: string): void {
  mutate((current) => ({
    ...current,
    sessions: current.sessions.filter((item) => (item.sessionId ?? item.id) !== sessionId),
  }));
}

export function deleteAllSessions(): void {
  mutate((current) => ({ ...current, sessions: [], caseProgress: {} }));
}

export function getCaseProgress(subject: string): CaseProgress {
  return read().caseProgress[subject] ?? { passedIds: [], failedIds: [], repeatIds: [] };
}

/**
 * A case lives in exactly one bucket. `passed` retires it for the cycle;
 * `failed` and `repeat` queue it up again once the fresh pool runs out.
 */
export function saveCaseOutcome(
  subject: string,
  caseId: string,
  status: CaseOutcomeStatus,
): CaseProgress {
  const current = getCaseProgress(subject);
  const without = (ids: string[]) => ids.filter((id) => id !== caseId);

  const next: CaseProgress = {
    passedIds: status === 'passed' ? [...new Set([...current.passedIds, caseId])] : without(current.passedIds),
    failedIds: status === 'failed' ? [...new Set([...current.failedIds, caseId])] : without(current.failedIds),
    repeatIds: status === 'repeat' ? [...new Set([...current.repeatIds, caseId])] : without(current.repeatIds),
  };

  mutate((data) => ({ ...data, caseProgress: { ...data.caseProgress, [subject]: next } }));
  return next;
}

/**
 * Entwurf der gerade laufenden Simulation.
 *
 * Bewusst eine eigene Datei neben den Nutzerdaten: Ein Entwurf ist ein
 * Rettungsnetz, kein Ergebnis — er gehört weder in den Export noch in die
 * Sitzungsliste. Nach jedem Wortwechsel überschrieben, damit ein Absturz
 * höchstens die letzte Antwort kostet.
 */
function draftFile(): string {
  return path.join(dataDirectory(), 'exam-draft.json');
}

export function saveDraft(draft: ExamDraft): ExamDraft {
  // Ebenfalls atomar: ein Absturz mitten im Schreiben würde sonst genau die
  // Datei zerstören, die den Absturz abfedern soll.
  writeFileAtomic(draftFile(), draft);
  return draft;
}

export function readDraft(): ExamDraft | null {
  try {
    const raw = JSON.parse(fs.readFileSync(draftFile(), 'utf-8')) as ExamDraft;
    // Ein Entwurf ohne Wortwechsel ist wertlos.
    return raw?.messages?.length ? raw : null;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    fs.unlinkSync(draftFile());
  } catch {
    // Nicht vorhanden ist der Normalfall.
  }
}

export function resetAll(): BrocalyData {
  clearDraft();
  return persist(emptyData());
}

export function exportSnapshot(): BrocalyData {
  return read();
}

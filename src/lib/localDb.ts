import type {
  AppSettings,
  CaseOutcomeStatus,
  CaseProgress,
  ExamDraft,
  ExamSession,
  PerformanceProfile,
  Profile,
} from '../types';
import { bridge } from './bridge';

/**
 * The local replacement for the hosted database. Everything lives in a JSON file
 * inside the OS application-data folder and is reached through the preload
 * bridge — no network, no account, no server round-trip.
 */

export async function loadProfile(): Promise<Profile | null> {
  return (await bridge.store.read()).profile;
}

export async function saveProfile(patch: Partial<Profile>): Promise<Profile> {
  return bridge.store.saveProfile(patch);
}

export async function loadSettings(): Promise<AppSettings> {
  return (await bridge.store.read()).settings;
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  return bridge.store.saveSettings(patch);
}

export async function listSessions(): Promise<ExamSession[]> {
  return bridge.store.listSessions();
}

export async function persistSession(session: ExamSession): Promise<ExamSession> {
  return bridge.store.saveSession(session);
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  await bridge.store.deleteSession(sessionId);
  return true;
}

export async function deleteAllSessions(): Promise<boolean> {
  await bridge.store.deleteAllSessions();
  return true;
}

export async function loadCaseProgress(subject: string): Promise<CaseProgress> {
  return bridge.store.getCaseProgress(subject);
}

export async function recordCaseOutcome(
  subject: string,
  caseId: string,
  status: CaseOutcomeStatus,
): Promise<CaseProgress> {
  return bridge.store.saveCaseOutcome(subject, caseId, status);
}

/** Records a thumbs up/down on a finished simulation. */
export async function rateSession(
  ref: { sessionId?: string; startTime: number },
  rating: 1 | -1,
  comment?: string,
): Promise<void> {
  const sessions = await bridge.store.listSessions();
  const match = sessions.find((item) =>
    ref.sessionId ? (item.sessionId ?? item.id) === ref.sessionId : item.startTime === ref.startTime,
  );
  if (!match) return;
  await bridge.store.saveSession({
    ...match,
    ...({ userRating: rating, ...(comment !== undefined ? { userComment: comment } : {}) } as object),
  });
}

/**
 * Aggregates strengths and weaknesses across the ten most recent simulations so
 * the examiner can revisit weak spots in later sessions.
 */
export async function getPerformanceProfile(subject?: string): Promise<PerformanceProfile> {
  const sessions = (await bridge.store.listSessions())
    .filter((item) => (subject ? item.subject === subject : true))
    .slice(0, 10);

  const seen = new Set<string>();
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  for (const session of sessions) {
    for (const value of session.feedback?.strengths ?? []) {
      const key = `s:${value.toLowerCase().slice(0, 40)}`;
      if (!seen.has(key) && strengths.length < 8) {
        seen.add(key);
        strengths.push(value);
      }
    }
    for (const value of session.feedback?.weaknesses ?? []) {
      const key = `w:${value.toLowerCase().slice(0, 40)}`;
      if (!seen.has(key) && weaknesses.length < 8) {
        seen.add(key);
        weaknesses.push(value);
      }
    }
  }

  return { strengths, weaknesses, totalCasesCount: sessions.length };
}

// --- Entwurf der laufenden Simulation ---------------------------------------

export async function saveExamDraft(draft: ExamDraft): Promise<void> {
  await bridge.store.saveDraft(draft);
}

export async function readExamDraft(): Promise<ExamDraft | null> {
  return bridge.store.readDraft();
}

export async function clearExamDraft(): Promise<void> {
  await bridge.store.clearDraft();
}

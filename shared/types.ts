// Types shared between the Electron main process, the local API server and the
// renderer. Keep this file free of any runtime imports so it can be pulled into
// every bundle without dragging dependencies along.

export type UserRole = 'student' | 'doctor';
export type ExamWindow = '<1m' | '1-3m' | '>3m' | '';
export type ExamMode = 'relaxed' | 'strict';

export interface Profile {
  id: string;
  name: string;
  role: UserRole;
  specialty?: string;
  target?: string;
  specialtyTarget?: string;
  electiveSubject1?: string;
  electiveSubject2?: string;
  examWindow?: ExamWindow;
  difficulties?: string[];
  selectedSubject?: string;
  createdAt: string;
}

export interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  feedback?: 'correct' | 'incomplete' | 'incorrect';
}

export interface CaseSummary {
  caseId: string;
  topic: string;
  outcome: 'bestanden' | 'nicht bestanden' | 'abgebrochen';
  keyErrors: string[];
  duration: number;
}

export interface PerformanceProfile {
  strengths: string[];
  weaknesses: string[];
  totalCasesCount: number;
}

export interface SessionFeedback {
  score: number;
  medicalScore?: number;
  communicationScore?: number;
  structureScore?: number;
  summary: string;
  categoryFeedback?: {
    medical: { strengths: string[]; weaknesses: string[] };
    structure: { strengths: string[]; weaknesses: string[] };
    communication: { strengths: string[]; weaknesses: string[] };
  };
  strengths: string[];
  weaknesses: string[];
  passed: boolean;
  questions?: {
    question: string;
    expectedAnswer: string;
    userAnswer: string;
    isCritical?: boolean;
    idealAnswer?: string;
    missedKeyPoints?: string[];
  }[];
  topics_covered?: string[];
}

export interface ExamSession {
  id: string;
  sessionId?: string;
  startTime: number;
  endTime?: number;
  messages: Message[];
  casesCompleted?: CaseSummary[];
  performanceProfile?: PerformanceProfile;
  subject: string;
  focusTopics?: string;
  excludedTopics?: string;
  topicsCovered?: string[];
  status: 'active' | 'completed';
  examinerId?: string;
  examMode?: ExamMode;
  feedback?: SessionFeedback;
  /** Was diese Simulation beim KI-Anbieter ungefähr verbraucht hat. */
  usage?: UsageTotals;
}

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  requests: number;
  /** Schätzung in Euro auf Basis der Token-Zahlen — keine Abrechnung. */
  estimatedCostEur: number;
}

/**
 * Per-subject case tracking. `passedIds` are retired for the cycle; failed and
 * repeat cases come back once the fresh pool is exhausted.
 */
export interface CaseProgress {
  passedIds: string[];
  failedIds: string[];
  repeatIds: string[];
}

export type CaseOutcomeStatus = 'passed' | 'failed' | 'repeat';

/** Es gibt nur einen Anbieter — bleibt die Frage, ob überhaupt gesprochen wird. */
export type VoiceProvider = 'on' | 'off';

export interface AppSettings {
  voiceProvider: VoiceProvider;
  autoSpeak: boolean;
  defaultDurationMinutes: number;
  defaultExamMode: ExamMode;
  tourCompletedAt: string | null;
  setupCompletedAt: string | null;
}

export interface BrocalyData {
  version: number;
  profile: Profile | null;
  sessions: ExamSession[];
  caseProgress: Record<string, CaseProgress>;
  settings: AppSettings;
}

export interface ApiKeyStatus {
  configured: boolean;
  maskedKey: string | null;
  updatedAt: string | null;
}

export interface KeystoreState {
  /** false when the OS keychain is unavailable and keys fall back to plain storage. */
  encryptionAvailable: boolean;
  key: ApiKeyStatus;
}

export interface AppInfo {
  version: string;
  platform: NodeJS.Platform;
  apiOrigin: string;
  apiToken: string;
  dataDirectory: string;
  isDev: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  voiceProvider: 'on',
  autoSpeak: true,
  defaultDurationMinutes: 20,
  defaultExamMode: 'relaxed',
  tourCompletedAt: null,
  setupCompletedAt: null,
};

export interface UpdateStatus {
  available: boolean;
  currentVersion: string;
  latestVersion?: string;
  releaseUrl?: string;
  error?: string;
}

/**
 * Zwischenstand einer laufenden Simulation. Wird nach jedem Wortwechsel
 * überschrieben und nach Abschluss oder bewusstem Abbruch gelöscht.
 */
export interface ExamDraft {
  subject: string;
  startTime: number;
  savedAt: number;
  messages: Message[];
  casesCompleted?: CaseSummary[];
  examinerId?: string;
  examMode?: ExamMode;
  durationMinutes?: number;
}

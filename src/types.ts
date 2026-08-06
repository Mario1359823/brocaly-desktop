export type {
  AppInfo,
  AppSettings,
  ApiKeyStatus,
  BrocalyData,
  CaseOutcomeStatus,
  CaseProgress,
  CaseSummary,
  ExamDraft,
  ExamMode,
  ExamSession,
  ExamWindow,
  KeystoreState,
  Message,
  PerformanceProfile,
  Profile,
  SessionFeedback,
  UpdateStatus,
  UsageTotals,
  UserRole,
  VoiceProvider,
} from '../shared/types';

export { DEFAULT_SETTINGS } from '../shared/types';

import type { ExamMode, Profile } from '../shared/types';

/** The renderer's working copy of the local profile. */
export type User = Profile;

export type View =
  | 'dashboard'
  | 'exam'
  | 'feedback'
  | 'subjects'
  | 'stats'
  | 'settings'
  | 'profile';

export interface ExaminerConfig {
  id: string;
  name: string;
  title: string;
  tag?: string;
  tagline: string;
  image?: string;
  voice: string;
  personality: string;
  difficulty: ExamMode;
  stylePoints: string[];
}

/**
 * Eine Prüferin, kein Auswahlmenü. Der Schwierigkeitsgrad kommt weiterhin aus
 * dem Prüfungsmodus (`ExamMode`), nicht aus der Person.
 */
export const EXAMINER: ExaminerConfig = {
  id: 'brocaly',
  name: 'Dr. Brocaly',
  title: 'Chefärztin',
  tagline: 'Klare Erwartungen, präzise Nachfragen — wie in der echten Prüfung.',
  image: './dr-hoffmann.webp',
  voice: 'brocaly',
  difficulty: 'strict',
  personality: 'Streng und fachlich kompromisslos. Erwartet vollständige, präzise, strukturierte Antworten und hakt bei unvollständigen Gedanken konsequent nach. Benennt Fehler sofort und direkt: „Das ist falsch." oder „Das ist unvollständig — was fehlt?" Korrekte Antworten werden knapp bestätigt: „Gut." oder „Weiter." Erwartet strikte klinische Struktur: Anamnese → Befund → Differenzialdiagnosen → Diagnose → Therapie → Monitoring. Verlangt exakte Zahlen, Dosierungen, Grenzwerte und Stadien-Einteilungen. „Welche Dosis genau?", „Wie hoch ist der Grenzwert?", „Welches Stadium nach welcher Klassifikation?" Erwartet konkrete mg-Angaben, Laborwerte mit Einheiten, Klassifikationen (NYHA, GOLD, TNM, Child-Pugh, CHA₂DS₂-VASc etc.) und an aktuellen Standards orientierte Therapieschemata. Fragt gelegentlich nach aktueller Evidenz und Studien, wenn es fachlich passt. Bleibt dabei immer im Rahmen einer medizinischen Fachgesprächssimulation.',
  stylePoints: [
    'Verlangt exakte Dosierungen, Grenzwerte und Klassifikationen',
    'Fragt nach aktuellen Studien als Bonus-Wissen',
    'Maximale fachliche Präzision — harte Fakten zählen',
  ],
};


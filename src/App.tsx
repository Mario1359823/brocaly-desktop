import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { examDataset } from './data/examDataset';
import { appInfo } from './lib/bridge';
import {
  listSessions,
  loadCaseProgress,
  loadSettings,
  persistSession,
  recordCaseOutcome,
  getPerformanceProfile,
  readExamDraft,
} from './lib/localDb';
import { examApi, initApi, usageApi } from './services/api';
import {
  EXAMINERS,
  type AppInfo,
  type AppSettings,
  type CaseProgress,
  type ExamDraft,
  type ExamSession,
  type ExaminerConfig,
  type PerformanceProfile,
  type Profile,
  type View,
} from './types';

import { BrocalyTextLogo } from './components/BrocalyLogo';
import { DashboardView } from './components/DashboardView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ExamSetupModal } from './components/ExamSetupModal';
import { FeedbackView } from './components/FeedbackView';
import { ProfileView } from './components/ProfileView';
import { SettingsView } from './components/SettingsView';
import { OfflineBar } from './components/OfflineBar';
import { DraftRecoveryCard } from './components/DraftRecoveryCard';
import { SetupWizard } from './components/SetupWizard';
import { Sidebar } from './components/Sidebar';
import { WelcomeTour } from './components/WelcomeTour';

const ExamView = React.lazy(() =>
  import('./components/ExamView').then((m) => ({ default: m.ExamView })),
);
const StatsView = React.lazy(() =>
  import('./components/StatsView').then((m) => ({ default: m.StatsView })),
);
const SubjectsView = React.lazy(() =>
  import('./components/SubjectsView').then((m) => ({ default: m.SubjectsView })),
);

const EMPTY_PROGRESS: CaseProgress = { passedIds: [], failedIds: [], repeatIds: [] };

type Stage = 'loading' | 'tour' | 'setup' | 'app';

function ViewLoading() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center text-sm font-semibold text-slate-500">
      Lädt…
    </div>
  );
}

function Splash() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
      <div className="animate-pulse">
        <BrocalyTextLogo size="lg" />
      </div>
    </div>
  );
}

/**
 * Picks focus topics for a new simulation: must-know topics that have not come
 * up yet, then topics from sessions that were not passed.
 */
function suggestFocusTopics(subject: string, sessions: ExamSession[]): string {
  const subjectSessions = sessions.filter((item) => item.subject === subject);
  const covered = new Set(
    subjectSessions.flatMap((item) => item.topicsCovered ?? []).map((t) => t.toLowerCase()),
  );

  const normalized = subject.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const specialtyKey = Object.keys(examDataset.specialties).find(
    (key) => key.includes(normalized) || normalized.includes(key),
  );
  const specialty = specialtyKey
    ? (examDataset.specialties as Record<string, any>)[specialtyKey]
    : null;
  const mustKnow: string[] = specialty?.must_know_topics ?? specialty?.must_know ?? [];

  const uncovered = mustKnow
    .filter(
      (topic) =>
        !Array.from(covered).some(
          (c) => c.includes(topic.toLowerCase().slice(0, 12)) || topic.toLowerCase().includes(c.slice(0, 12)),
        ),
    )
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);

  const weak = [
    ...new Set(
      subjectSessions
        .filter((item) => (item.feedback?.score ?? 0) < 60)
        .flatMap((item) => item.topicsCovered ?? []),
    ),
  ].slice(0, 3);

  return [...uncovered, ...weak.filter((t) => !uncovered.includes(t))].slice(0, 5).join(', ');
}

export default function App() {
  const [stage, setStage] = useState<Stage>('loading');
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [draft, setDraft] = useState<ExamDraft | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [view, setView] = useState<View>('dashboard');
  const [error, setError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [caseProgress, setCaseProgress] = useState<CaseProgress>(EMPTY_PROGRESS);
  const [totalCases, setTotalCases] = useState(0);
  const [studentSubjects, setStudentSubjects] = useState<
    { subject: string; caseProgress: CaseProgress; totalCount: number }[]
  >([]);

  // Active simulation
  const [pendingExam, setPendingExam] = useState<{
    subject: string;
    focus?: string;
    excluded?: string;
    duration?: number;
  } | null>(null);
  const [currentSubject, setCurrentSubject] = useState('');
  const [focusTopics, setFocusTopics] = useState('');
  const [excludedTopics, setExcludedTopics] = useState('');
  const [examDuration, setExamDuration] = useState(20);
  const [examProgress, setExamProgress] = useState<CaseProgress>(EMPTY_PROGRESS);
  const [initialPerformanceProfile, setInitialPerformanceProfile] = useState<
    PerformanceProfile | undefined
  >(undefined);
  const [examiner, setExaminer] = useState<ExaminerConfig>(EXAMINERS[1]);
  const [examKey, setExamKey] = useState(0);
  const [lastSession, setLastSession] = useState<ExamSession | null>(null);
  const sessionIdRef = useRef<string>('');

  // --- Boot ---------------------------------------------------------------
  useEffect(() => {
    (async () => {
      const details = await appInfo();
      setInfo(details);
      await initApi();

      const [storedSettings, storedSessions] = await Promise.all([loadSettings(), listSessions()]);
      const data = await window.brocaly.store.read();

      setSettings(storedSettings);
      setSessions(storedSessions);
      setProfile(data.profile);
      // Lag beim letzten Mal eine Simulation offen? Dann anbieten, sie zu retten.
      readExamDraft().then(setDraft).catch(() => undefined);
      setExaminer(
        EXAMINERS.find((item) => item.id === storedSettings.defaultExaminerId) ?? EXAMINERS[1],
      );

      if (!storedSettings.tourCompletedAt) setStage('tour');
      else if (!storedSettings.setupCompletedAt || !data.profile) setStage('setup');
      else setStage('app');
    })();
  }, []);

  const refreshSessions = useCallback(async () => {
    setSessions(await listSessions());
  }, []);

  // Keep the dashboard's progress ring in sync with the user's main subject.
  const mainSubject =
    profile?.selectedSubject || profile?.specialtyTarget || profile?.electiveSubject1 || '';

  useEffect(() => {
    if (stage !== 'app' || !mainSubject) return;
    loadCaseProgress(mainSubject).then(setCaseProgress);
    examApi.getCaseCount(mainSubject).then(setTotalCases).catch(() => setTotalCases(0));
  }, [stage, mainSubject, sessions.length]);

  // Students train four fixed subjects; the dashboard shows progress for each.
  const electives = `${profile?.electiveSubject1 ?? ''}|${profile?.electiveSubject2 ?? ''}`;
  useEffect(() => {
    if (stage !== 'app' || profile?.role !== 'student') {
      setStudentSubjects([]);
      return;
    }
    const subjects = [
      'Innere Medizin',
      'Allgemein- und Viszeralchirurgie',
      profile.electiveSubject1,
      profile.electiveSubject2,
    ].filter((item): item is string => Boolean(item));

    Promise.all(
      subjects.map(async (subject) => ({
        subject,
        caseProgress: await loadCaseProgress(subject).catch(() => EMPTY_PROGRESS),
        totalCount: await examApi.getCaseCount(subject).catch(() => 0),
      })),
    ).then(setStudentSubjects);
  }, [stage, profile?.role, electives, sessions.length]);

  // --- Exam lifecycle -----------------------------------------------------
  const handleStartExam = useCallback(
    (subject: string, focus?: string, excluded?: string, duration?: number) => {
      setPendingExam({ subject, focus, excluded, duration });
    },
    [],
  );

  const confirmStartExam = useCallback(async () => {
    if (!pendingExam) return;
    const { subject, focus, excluded, duration } = pendingExam;

    sessionIdRef.current = crypto.randomUUID();
    setCurrentSubject(subject);
    setFocusTopics(focus || suggestFocusTopics(subject, sessions));
    setExcludedTopics(excluded || '');
    setExamDuration(duration || settings?.defaultDurationMinutes || 20);

    const [progress, performance] = await Promise.all([
      loadCaseProgress(subject).catch(() => EMPTY_PROGRESS),
      getPerformanceProfile(subject).catch(() => undefined),
    ]);
    setExamProgress(progress);
    setInitialPerformanceProfile(performance);

    // Verbrauchszähler gilt immer für genau eine Simulation.
    await usageApi.reset().catch(() => undefined);

    setPendingExam(null);
    setExamKey((k) => k + 1);
    setView('exam');
  }, [pendingExam, sessions, settings]);

  const handleCaseComplete = useCallback(
    async (caseId: string, status: 'passed' | 'failed' | 'repeat') => {
      const next = await recordCaseOutcome(currentSubject, caseId, status);
      setExamProgress(next);
      if (currentSubject === mainSubject) setCaseProgress(next);
    },
    [currentSubject, mainSubject],
  );

  const handleExamFinish = useCallback(
    async (session: Partial<ExamSession>) => {
      // Der Verbrauch der gerade gelaufenen Simulation gehört zur Session —
      // scheitert die Abfrage, wird die Session trotzdem gespeichert.
      const usage = await usageApi.snapshot().catch(() => undefined);
      const complete: ExamSession = {
        ...(session as ExamSession),
        sessionId: sessionIdRef.current,
        examinerId: examiner.id,
        ...(usage ? { usage } : {}),
      };
      setLastSession(complete);
      setView('feedback');
      await persistSession(complete);
      await refreshSessions();
    },
    [examiner.id, refreshSessions],
  );

  // --- Stages -------------------------------------------------------------
  if (stage === 'loading') return <Splash />;

  if (stage === 'tour') {
    return (
      <WelcomeTour
        onDone={async () => {
          setSettings(
            await window.brocaly.store.saveSettings({ tourCompletedAt: new Date().toISOString() }),
          );
          setStage('setup');
        }}
      />
    );
  }

  if (stage === 'setup') {
    return (
      <SetupWizard
        initialProfile={profile}
        onFinished={async (nextProfile, startExam, examinerId) => {
          setProfile(nextProfile);
          setSettings(await loadSettings());
          setExaminer(EXAMINERS.find((item) => item.id === examinerId) ?? EXAMINERS[1]);
          setStage('app');

          const subject =
            nextProfile.selectedSubject ||
            nextProfile.specialtyTarget ||
            nextProfile.electiveSubject1 ||
            '';
          if (startExam && subject) handleStartExam(subject);
          else setView('dashboard');
        }}
      />
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
        <Sidebar
          activeView={view}
          onViewChange={(next) => setView(next)}
          user={profile}
          version={info?.version}
        />

        <main className="flex-1 flex flex-col overflow-hidden">
          <OfflineBar />
          {/* Drag strip for the frameless window — hidden during exam to avoid
              dead space above the exam header. The sidebar has its own drag
              strip that keeps the window draggable from the left edge. */}
          {view !== 'exam' && <div className="h-9 app-drag shrink-0" />}

          {view === 'exam' && profile ? (
            // Exam view: no padding, fills the full remaining height so the
            // internal flex layout works correctly and the window never grows.
            <div className="flex-1 min-h-0 overflow-hidden">
              <ErrorBoundary>
                <Suspense fallback={<ViewLoading />}>
                  <ExamView
                    key={examKey}
                    subject={currentSubject}
                    sessionId={sessionIdRef.current}
                    doneIds={examProgress.passedIds}
                    endIds={[...examProgress.failedIds, ...examProgress.repeatIds]}
                    onCaseComplete={handleCaseComplete}
                    onFinish={handleExamFinish}
                    onNewExam={() => {
                      sessionIdRef.current = crypto.randomUUID();
                      setExamKey((k) => k + 1);
                    }}
                    onError={setError}
                    user={profile}
                    focusTopics={focusTopics}
                    excludedTopics={excludedTopics}
                    duration={examDuration}
                    examiner={examiner}
                    examMode={examiner.difficulty}
                    initialVoiceMode={settings?.autoSpeak ?? true}
                    initialPerformanceProfile={initialPerformanceProfile}
                  />
                </Suspense>
              </ErrorBoundary>
            </div>
          ) : (
            // All other views: scrollable, padded content area.
            <div className="flex-1 overflow-y-auto">
              <div className="px-8 pb-12 pt-2 max-w-6xl mx-auto">
                <ErrorBoundary>
                  <Suspense fallback={<ViewLoading />}>
                    {view === 'dashboard' && draft && (
                      <DraftRecoveryCard
                        draft={draft}
                        profile={profile}
                        onRecovered={(session) => {
                          setDraft(null);
                          setLastSession(session);
                          void refreshSessions();
                          setView('feedback');
                        }}
                        onDismissed={() => setDraft(null)}
                      />
                    )}

                    {view === 'dashboard' && profile && (
                      <DashboardView
                        user={profile}
                        onStartExam={handleStartExam}
                        onReviewSession={(session) => {
                          setLastSession(session);
                          setView('feedback');
                        }}
                        onUpdateUser={setProfile}
                        caseProgress={
                          mainSubject
                            ? {
                                subject: mainSubject,
                                doneCount: caseProgress.passedIds.length,
                                totalCount: totalCases,
                                failedCount: caseProgress.failedIds.length,
                                repeatCount: caseProgress.repeatIds.length,
                                passedIds: caseProgress.passedIds,
                                failedIds: caseProgress.failedIds,
                                repeatIds: caseProgress.repeatIds,
                              }
                            : undefined
                        }
                        studentSubjects={studentSubjects.length > 0 ? studentSubjects : undefined}
                      />
                    )}

                    {view === 'feedback' && lastSession && (
                      <FeedbackView
                        session={lastSession}
                        onRestart={() => setView('dashboard')}
                        onRepeat={() =>
                          handleStartExam(
                            lastSession.subject,
                            lastSession.focusTopics,
                            lastSession.excludedTopics,
                            examDuration,
                          )
                        }
                        onRepeatWithFocus={() =>
                          handleStartExam(
                            lastSession.subject,
                            (lastSession.feedback?.weaknesses ?? []).join(', '),
                            lastSession.excludedTopics,
                            examDuration,
                          )
                        }
                      />
                    )}

                    {view === 'subjects' && <SubjectsView onStartExam={handleStartExam} />}

                    {view === 'stats' && (
                      <StatsView
                        onRepeatExam={(subject) => handleStartExam(subject)}
                        onStartExam={() => setView('dashboard')}
                      />
                    )}

                    {view === 'settings' && <SettingsView info={info} />}

                    {view === 'profile' && profile && (
                      <ProfileView profile={profile} onSaved={setProfile} />
                    )}
                  </Suspense>
                </ErrorBoundary>
              </div>
            </div>
          )}
        </main>

        <ExamSetupModal
          open={Boolean(pendingExam)}
          selectedExaminer={examiner}
          onSelectExaminer={setExaminer}
          onConfirm={confirmStartExam}
          onCancel={() => setPendingExam(null)}
        />

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="fixed bottom-6 left-1/2 z-[500] flex w-[min(560px,calc(100vw-3rem))] -translate-x-1/2 items-start gap-3 rounded-2xl border border-red-200 bg-white px-5 py-4 shadow-xl shadow-slate-900/10"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="flex-1 text-sm font-medium leading-relaxed text-slate-700">{error}</p>
              <button
                onClick={() => setError(null)}
                aria-label="Meldung schließen"
                className="text-slate-400 transition-colors hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

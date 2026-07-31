import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppInfo,
  CaseOutcomeStatus,
  AppSettings,
  BrocalyData,
  CaseProgress,
  ExamDraft,
  ExamSession,
  KeystoreState,
  Profile,
  UpdateStatus,
} from '../shared/types';

/**
 * The only bridge between the renderer and the machine. Every call is an
 * explicit, named operation — the renderer never touches `fs`, `ipcRenderer` or
 * the API token store directly.
 */
const brocaly = {
  info: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),

  store: {
    read: (): Promise<BrocalyData> => ipcRenderer.invoke('store:read'),
    saveProfile: (patch: Partial<Profile>): Promise<Profile> =>
      ipcRenderer.invoke('store:saveProfile', patch),
    saveSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke('store:saveSettings', patch),
    listSessions: (): Promise<ExamSession[]> => ipcRenderer.invoke('store:listSessions'),
    saveSession: (session: ExamSession): Promise<ExamSession> =>
      ipcRenderer.invoke('store:saveSession', session),
    deleteSession: (sessionId: string): Promise<void> =>
      ipcRenderer.invoke('store:deleteSession', sessionId),
    deleteAllSessions: (): Promise<void> => ipcRenderer.invoke('store:deleteAllSessions'),
    getCaseProgress: (subject: string): Promise<CaseProgress> =>
      ipcRenderer.invoke('store:getCaseProgress', subject),
    saveCaseOutcome: (
      subject: string,
      caseId: string,
      status: CaseOutcomeStatus,
    ): Promise<CaseProgress> =>
      ipcRenderer.invoke('store:saveCaseOutcome', subject, caseId, status),

    /** Zwischenstand der laufenden Simulation — Rettungsnetz bei Absturz. */
    saveDraft: (draft: ExamDraft): Promise<ExamDraft> =>
      ipcRenderer.invoke('store:saveDraft', draft),
    readDraft: (): Promise<ExamDraft | null> => ipcRenderer.invoke('store:readDraft'),
    clearDraft: (): Promise<void> => ipcRenderer.invoke('store:clearDraft'),
  },

  keys: {
    state: (): Promise<KeystoreState> => ipcRenderer.invoke('keys:state'),
  },

  /** Fragt GitHub, ob es eine neuere Version gibt. Offline: available=false. */
  checkUpdate: (): Promise<UpdateStatus> => ipcRenderer.invoke('app:checkUpdate'),

  openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('app:openExternal', url),
  revealDataFolder: (): Promise<void> => ipcRenderer.invoke('app:revealData'),
  exportData: (): Promise<{ saved: boolean; filePath?: string }> =>
    ipcRenderer.invoke('app:exportData'),
  resetAll: (): Promise<{ cleared: boolean }> => ipcRenderer.invoke('app:resetAll'),
};

contextBridge.exposeInMainWorld('brocaly', brocaly);

export type BrocalyBridge = typeof brocaly;

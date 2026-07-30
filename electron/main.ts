import fs from 'node:fs';
import path from 'node:path';
import {
  BrowserWindow,
  Menu,
  app,
  dialog,
  ipcMain,
  nativeTheme,
  session,
  shell,
} from 'electron';
import { startLocalApi, type LocalApi } from '../server';
import type { AppInfo } from '../shared/types';
import * as keystore from './keystore';
import { dataDirectory, isDev } from './paths';
import * as store from './store';

const DEV_RENDERER_URL = 'http://127.0.0.1:5273';

let mainWindow: BrowserWindow | null = null;
let api: LocalApi | null = null;

// A second launch should focus the running window rather than start a rival
// server that would fight over the same data file.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
}

function appInfo(): AppInfo {
  return {
    version: app.getVersion(),
    platform: process.platform,
    apiOrigin: api?.origin ?? '',
    apiToken: api?.token ?? '',
    dataDirectory: dataDirectory(),
    isDev,
  };
}

function registerIpc(): void {
  ipcMain.handle('app:info', () => appInfo());

  ipcMain.handle('store:read', () => store.read());
  ipcMain.handle('store:saveProfile', (_event, patch) => store.saveProfile(patch));
  ipcMain.handle('store:saveSettings', (_event, patch) => store.saveSettings(patch));
  ipcMain.handle('store:listSessions', () => store.listSessions());
  ipcMain.handle('store:saveSession', (_event, session_) => store.saveSession(session_));
  ipcMain.handle('store:deleteSession', (_event, id) => store.deleteSession(id));
  ipcMain.handle('store:deleteAllSessions', () => store.deleteAllSessions());
  ipcMain.handle('store:getCaseProgress', (_event, subject) => store.getCaseProgress(subject));
  ipcMain.handle('store:saveCaseOutcome', (_event, subject, caseId, status) =>
    store.saveCaseOutcome(subject, caseId, status),
  );

  ipcMain.handle('keys:state', () => keystore.state());

  ipcMain.handle('app:openExternal', async (_event, url: string) => {
    // Only ever hand real web URLs to the OS — never file:// or custom schemes.
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return false;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    await shell.openExternal(parsed.toString());
    return true;
  });

  ipcMain.handle('app:revealData', async () => {
    await shell.openPath(dataDirectory());
  });

  ipcMain.handle('app:exportData', async () => {
    const target = await dialog.showSaveDialog(mainWindow!, {
      title: 'Brocaly-Daten exportieren',
      defaultPath: path.join(app.getPath('downloads'), `brocaly-export-${Date.now()}.json`),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (target.canceled || !target.filePath) return { saved: false };
    fs.writeFileSync(target.filePath, JSON.stringify(store.exportSnapshot(), null, 2), 'utf-8');
    return { saved: true, filePath: target.filePath };
  });

  ipcMain.handle('app:resetAll', async () => {
    const choice = await dialog.showMessageBox(mainWindow!, {
      type: 'warning',
      buttons: ['Abbrechen', 'Alles löschen'],
      defaultId: 0,
      cancelId: 0,
      title: 'Alle Daten löschen',
      message: 'Wirklich alle lokalen Daten löschen?',
      detail:
        'Profil, Simulationen, Auswertungen und gespeicherte API-Schlüssel werden unwiderruflich von diesem Rechner entfernt.',
    });
    if (choice.response !== 1) return { cleared: false };
    store.resetAll();
    keystore.clearAll();
    return { cleared: true };
  });
}

function buildMenu(): void {
  const isMac = process.platform === 'darwin';
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: 'Brocaly',
            submenu: [
              { role: 'about', label: 'Über Brocaly' },
              { type: 'separator' },
              { role: 'services', label: 'Dienste' },
              { type: 'separator' },
              { role: 'hide', label: 'Brocaly ausblenden' },
              { role: 'hideOthers', label: 'Andere ausblenden' },
              { role: 'unhide', label: 'Alle einblenden' },
              { type: 'separator' },
              { role: 'quit', label: 'Brocaly beenden' },
            ],
          },
        ] as Electron.MenuItemConstructorOptions[])
      : []),
    {
      label: 'Datei',
      submenu: [
        {
          label: 'Daten-Ordner öffnen',
          click: () => shell.openPath(dataDirectory()),
        },
        { type: 'separator' },
        isMac ? { role: 'close', label: 'Fenster schließen' } : { role: 'quit', label: 'Beenden' },
      ],
    },
    {
      label: 'Bearbeiten',
      submenu: [
        { role: 'undo', label: 'Widerrufen' },
        { role: 'redo', label: 'Wiederholen' },
        { type: 'separator' },
        { role: 'cut', label: 'Ausschneiden' },
        { role: 'copy', label: 'Kopieren' },
        { role: 'paste', label: 'Einsetzen' },
        { role: 'selectAll', label: 'Alles auswählen' },
      ],
    },
    {
      label: 'Ansicht',
      submenu: [
        { role: 'reload', label: 'Neu laden' },
        { role: 'resetZoom', label: 'Originalgröße' },
        { role: 'zoomIn', label: 'Vergrößern' },
        { role: 'zoomOut', label: 'Verkleinern' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Vollbild' },
        ...(isDev ? ([{ role: 'toggleDevTools' }] as Electron.MenuItemConstructorOptions[]) : []),
      ],
    },
    {
      label: 'Hilfe',
      submenu: [
        {
          label: 'Google-API-Schlüssel holen',
          click: () => shell.openExternal('https://aistudio.google.com/apikey'),
        },
        {
          label: 'Projekt auf GitHub',
          click: () => shell.openExternal('https://github.com/brocaly/brocaly-desktop'),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function hardenSession(): void {
  const partition = session.defaultSession;

  // The microphone is the only capability the simulation needs; deny the rest.
  partition.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === 'media');
  });
  partition.setPermissionCheckHandler((_webContents, permission) => permission === 'media');
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0b1220' : '#f8fafc',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 22 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow?.show());

  // Links to documentation open in the user's browser, never inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev ? DEV_RENDERER_URL : api?.origin;
    if (allowed && url.startsWith(allowed)) return;
    event.preventDefault();
    if (url.startsWith('https://')) shell.openExternal(url);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(isDev ? DEV_RENDERER_URL : api!.origin);
}

app.whenReady().then(async () => {
  try {
    api = await startLocalApi();
  } catch (err) {
    dialog.showErrorBox(
      'Brocaly kann nicht starten',
      `Der lokale Dienst konnte nicht gestartet werden.\n\n${String(err)}`,
    );
    app.quit();
    return;
  }

  hardenSession();
  registerIpc();
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  await api?.close();
});

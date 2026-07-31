import fs from 'node:fs';
import path from 'node:path';
import { screen, type BrowserWindow, type Rectangle } from 'electron';
import { dataDirectory } from './paths';

/**
 * Merkt sich Größe und Position des Fensters über Neustarts hinweg.
 *
 * Bewusst eine eigene kleine Datei statt im Datenspeicher: Fensterzustand ist
 * Gerätekram und hat im Nutzerdaten-Export nichts verloren.
 */

const DEFAULT_BOUNDS = { width: 1280, height: 860 };
const MIN_WIDTH = 1024;
const MIN_HEIGHT = 700;

interface StoredState extends Partial<Rectangle> {
  maximized?: boolean;
}

function stateFile(): string {
  return path.join(dataDirectory(), 'window-state.json');
}

function readState(): StoredState {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), 'utf-8')) as StoredState;
  } catch {
    return {};
  }
}

/** Liegt das Fenster noch auf einem angeschlossenen Bildschirm? */
function isOnSomeDisplay(bounds: Rectangle): boolean {
  return screen.getAllDisplays().some((display) => {
    const area = display.workArea;
    // Ein sichtbarer Rest genügt — sonst landet das Fenster im Nirgendwo,
    // etwa wenn ein externer Monitor abgezogen wurde.
    return (
      bounds.x < area.x + area.width &&
      bounds.x + bounds.width > area.x &&
      bounds.y < area.y + area.height &&
      bounds.y + bounds.height > area.y
    );
  });
}

export function restoredBounds(): { width: number; height: number; x?: number; y?: number; maximized: boolean } {
  const saved = readState();
  const width = Math.max(saved.width ?? DEFAULT_BOUNDS.width, MIN_WIDTH);
  const height = Math.max(saved.height ?? DEFAULT_BOUNDS.height, MIN_HEIGHT);

  if (saved.x === undefined || saved.y === undefined) {
    return { width, height, maximized: Boolean(saved.maximized) };
  }

  const candidate = { x: saved.x, y: saved.y, width, height };
  if (!isOnSomeDisplay(candidate)) {
    // Bildschirm weg: zentriert auf dem Hauptbildschirm neu starten.
    return { width, height, maximized: Boolean(saved.maximized) };
  }
  return { ...candidate, maximized: Boolean(saved.maximized) };
}

/** Schreibt den Zustand bei jeder Änderung — entdrosselt, damit ein Absturz nichts verschluckt. */
export function trackWindow(window: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null;

  const persist = () => {
    if (window.isDestroyed()) return;
    const maximized = window.isMaximized();
    // Im maximierten Zustand liefert getBounds die Bildschirmgröße — dann die
    // zuletzt bekannte normale Größe behalten.
    const bounds = maximized ? readState() : window.getNormalBounds();
    try {
      fs.writeFileSync(
        stateFile(),
        JSON.stringify({ ...bounds, maximized }, null, 2),
        'utf-8',
      );
    } catch {
      // Fenstergröße zu merken ist Komfort — ein Schreibfehler darf nichts kaputt machen.
    }
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(persist, 400);
  };

  window.on('resize', schedule);
  window.on('move', schedule);
  window.on('maximize', persist);
  window.on('unmaximize', persist);
  window.on('close', () => {
    if (timer) clearTimeout(timer);
    persist();
  });
}

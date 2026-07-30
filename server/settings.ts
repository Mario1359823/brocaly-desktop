import { read } from '../electron/store';
import type { AppSettings } from '../shared/types';

/** Server-side view of the user's preferences (voice provider, defaults). */
export function readSettings(): AppSettings {
  return read().settings;
}

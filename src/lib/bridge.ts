import type { BrocalyBridge } from '../../electron/preload';
import type { AppInfo } from '../types';

declare global {
  interface Window {
    brocaly: BrocalyBridge;
  }
}

export const bridge = window.brocaly;

let cachedInfo: AppInfo | null = null;

/**
 * App metadata including the per-launch API token. Resolved once and reused —
 * it cannot change while the window is open.
 */
export async function appInfo(): Promise<AppInfo> {
  if (!cachedInfo) cachedInfo = await bridge.info();
  return cachedInfo;
}

export function cachedAppInfo(): AppInfo | null {
  return cachedInfo;
}

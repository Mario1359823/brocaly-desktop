export type MicrophoneHelpPlatform = 'ios' | 'android' | 'desktop';

export function getMicrophoneHelpPlatform(): MicrophoneHelpPlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function getMicrophonePermissionHelp(): string {
  const platform = getMicrophoneHelpPlatform();

  if (platform === 'ios') {
    return 'Tippe in Safari auf „Aa" → Website-Einstellungen → Mikrofon → Erlauben → Seite neu laden.';
  }

  if (platform === 'android') {
    return 'Tippe in Chrome auf das Schloss-Symbol neben der Adresse → Berechtigungen oder Seiten-Einstellungen → Mikrofon → Zulassen → Seite neu laden.';
  }

  return 'Öffne die Website-Berechtigungen im Browser, setze Mikrofon auf „Erlauben" und lade die Seite neu.';
}

export function getMicrophoneDeniedMessage(): string {
  return `Mikrofon-Zugriff verweigert. ${getMicrophonePermissionHelp()}`;
}

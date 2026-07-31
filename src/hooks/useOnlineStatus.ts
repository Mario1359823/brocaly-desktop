import { useEffect, useState } from 'react';

/**
 * Meldet, ob der Rechner gerade online ist.
 *
 * Brocaly rechnet lokal, braucht für das Gespräch aber den KI-Anbieter. Ohne
 * Netz soll klar dastehen, woran es liegt — statt eines technischen Fehlers
 * mitten in der Antwort.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

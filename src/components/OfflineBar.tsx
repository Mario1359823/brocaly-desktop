import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

/**
 * Schmaler Streifen, solange kein Netz da ist. Die App selbst läuft lokal
 * weiter — nur das Gespräch braucht den KI-Anbieter, und das soll man sehen,
 * bevor man eine Antwort einspricht.
 */
export function OfflineBar() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      className="flex shrink-0 items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-xs font-semibold text-amber-900"
    >
      <WifiOff className="h-3.5 w-3.5" />
      Keine Internetverbindung — Simulationen brauchen den KI-Anbieter. Deine gespeicherten
      Auswertungen bleiben verfügbar.
    </div>
  );
}

import { useState } from 'react';
import { AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { examApi } from '../services/api';
import { clearExamDraft, persistSession } from '../lib/localDb';
import type { ExamDraft, ExamSession, Profile } from '../types';

/**
 * Taucht auf, wenn beim letzten Mal eine Simulation nicht zu Ende lief —
 * Absturz, Stromausfall, versehentliches Beenden.
 *
 * Fortsetzen wäre schön, ist aber nicht ehrlich machbar: Prüfer, Timer und
 * Fallstand lassen sich nicht verlustfrei rekonstruieren. Was zählt, ist das
 * Gespräch selbst — dafür lässt sich die Auswertung nachträglich erstellen,
 * damit der bereits bezahlte Verbrauch nicht umsonst war.
 */
export function DraftRecoveryCard({
  draft,
  profile,
  onRecovered,
  onDismissed,
}: {
  draft: ExamDraft;
  profile: Profile | null;
  onRecovered: (session: ExamSession) => void;
  onDismissed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const answers = draft.messages.filter((message) => message.role === 'user').length;
  const savedAt = new Date(draft.savedAt).toLocaleString('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const recover = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const feedback = await examApi.generateFinalFeedback(
        draft.messages,
        profile ?? undefined,
        draft.casesCompleted,
      );
      const session: ExamSession = {
        id: crypto.randomUUID(),
        startTime: draft.startTime,
        endTime: draft.savedAt,
        messages: draft.messages,
        subject: draft.subject,
        status: 'completed',
        examinerId: draft.examinerId,
        examMode: draft.examMode,
        casesCompleted: draft.casesCompleted,
        feedback,
      };
      await persistSession(session);
      await clearExamDraft();
      onRecovered(session);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    await clearExamDraft();
    onDismissed();
  };

  return (
    <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-amber-900">Unterbrochene Simulation gefunden</p>
          <p className="mt-1 text-sm leading-relaxed text-amber-900/80">
            {draft.subject} · {answers} {answers === 1 ? 'Antwort' : 'Antworten'} · zuletzt {savedAt}.
            Das Gespräch ist noch da. Du kannst die Auswertung dafür jetzt erstellen — die
            Simulation selbst lässt sich nicht fortsetzen.
          </p>

          {failed && (
            <p className="mt-2 text-sm font-semibold text-red-600">
              Die Auswertung hat nicht geklappt. Bist du online und ist dein API-Schlüssel gültig?
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              onClick={recover}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-green px-4 py-2.5 text-sm font-bold text-white transition-all hover:brightness-95 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Auswertung erstellen
            </button>
            <button
              onClick={discard}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-bold text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Verwerfen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

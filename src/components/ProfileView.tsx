import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import {
  ProfileForm,
  type ProfileFormState,
  emptyProfileForm,
  isProfileComplete,
  toProfilePatch,
} from './ProfileForm';
import { saveProfile } from '../lib/localDb';
import type { Profile } from '../types';

/** Same form as the setup wizard, reused for editing the profile later. */
export function ProfileView({
  profile,
  onSaved,
}: {
  profile: Profile;
  onSaved: (next: Profile) => void;
}) {
  const [form, setForm] = useState<ProfileFormState>(() => emptyProfileForm(profile));
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async () => {
    if (!isProfileComplete(form)) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setBusy(true);
    try {
      onSaved(await saveProfile(toProfilePatch(form)));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-1 py-2">
      <h1 className="mb-1 text-3xl font-black tracking-tight text-brand-navy">Dein Profil</h1>
      <p className="mb-9 text-sm text-slate-500">
        Steuert Niveau, Fachgebiet und Schwerpunkte deiner Simulationen.
      </p>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm">
        <ProfileForm state={form} onChange={setForm} showErrors={showErrors} />
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={submit}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-green px-6 py-3 text-sm font-bold text-white shadow-lg shadow-brand-green/25 transition-all hover:brightness-95 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Änderungen speichern
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600">
            <Check className="h-4 w-4" />
            Gespeichert
          </span>
        )}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { ClipboardList, GraduationCap, Stethoscope, X } from 'lucide-react';
import { examDataset } from '../data/examDataset';
import { cn } from '../lib/utils';
import type { Profile, UserRole } from '../types';

export type TrainingGoal = 'm3' | 'facharzt' | 'free';

const DIFFICULTY_OPTIONS = [
  'EKG',
  'Pharmakologie',
  'Notfälle',
  'Aktuelle Standards',
  'Psychosomatik',
  'Seltene Syndrome',
  'Frei sprechen',
  'Struktur der Antwort',
  'Medizinisch erklären',
  'Differentialdiagnostik',
];

const GOAL_OPTIONS: { id: TrainingGoal; icon: typeof GraduationCap; title: string; body: string }[] = [
  {
    id: 'm3',
    icon: GraduationCap,
    title: 'M3-Gesprächstraining',
    body: 'Staatsexamen: Innere, Chirurgie und zwei Wahlfächer auf M3-Niveau.',
  },
  {
    id: 'facharzt',
    icon: Stethoscope,
    title: 'Fachärztliches Fachgespräch',
    body: 'Facharztprüfung in deinem Fachgebiet — volle klinische Tiefe.',
  },
  {
    id: 'free',
    icon: ClipboardList,
    title: 'Freies Training',
    body: 'Visitenmodus: schnelle Fragen quer durch den Klinikalltag.',
  },
];

export function goalFromProfile(profile?: Profile | null): TrainingGoal {
  if (profile?.target === 'Klinikalltag') return 'free';
  if (profile?.role === 'student' || profile?.target === 'Staatsexamen') return 'm3';
  return profile ? 'facharzt' : 'm3';
}

export interface ProfileFormState {
  name: string;
  goal: TrainingGoal;
  specialtyTarget: string;
  electiveSubject1: string;
  electiveSubject2: string;
  selectedSubject: string;
  difficulties: string[];
}

export function emptyProfileForm(profile?: Profile | null): ProfileFormState {
  return {
    name: profile?.name ?? '',
    goal: goalFromProfile(profile),
    specialtyTarget: profile?.specialtyTarget ?? '',
    electiveSubject1: profile?.electiveSubject1 ?? '',
    electiveSubject2: profile?.electiveSubject2 ?? '',
    selectedSubject: profile?.selectedSubject ?? '',
    difficulties: profile?.difficulties ?? [],
  };
}

/** True once the form holds everything a simulation needs. */
export function isProfileComplete(state: ProfileFormState): boolean {
  if (!state.name.trim()) return false;
  if (state.goal === 'facharzt') return state.specialtyTarget.trim().length > 0;
  if (state.goal === 'm3') {
    return state.electiveSubject1.trim().length > 0 && state.electiveSubject2.trim().length > 0;
  }
  return state.selectedSubject.trim().length > 0;
}

export function toProfilePatch(state: ProfileFormState): Partial<Profile> {
  const role: UserRole = state.goal === 'm3' ? 'student' : 'doctor';
  const target =
    state.goal === 'm3' ? 'Staatsexamen' : state.goal === 'facharzt' ? 'Facharztprüfung' : 'Klinikalltag';

  return {
    name: state.name.trim(),
    role,
    specialty: 'Allgemeinmedizin',
    target,
    specialtyTarget:
      state.goal === 'facharzt'
        ? state.specialtyTarget.trim()
        : state.goal === 'free'
          ? state.selectedSubject.trim()
          : '',
    electiveSubject1: state.goal === 'm3' ? state.electiveSubject1.trim() : '',
    electiveSubject2: state.goal === 'm3' ? state.electiveSubject2.trim() : '',
    difficulties: state.difficulties,
    selectedSubject:
      state.goal === 'facharzt'
        ? state.specialtyTarget.trim()
        : state.goal === 'free'
          ? state.selectedSubject.trim()
          : state.electiveSubject1.trim(),
  };
}

const inputClass =
  'w-full rounded-xl border bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition-colors focus:border-brand-green focus:ring-2 focus:ring-brand-green/15';

export function ProfileForm({
  state,
  onChange,
  showErrors = false,
}: {
  state: ProfileFormState;
  onChange: (next: ProfileFormState) => void;
  showErrors?: boolean;
}) {
  const [customDifficulty, setCustomDifficulty] = useState('');

  const specialties = useMemo(
    () =>
      (Object.values(examDataset.specialties) as { label: string; hidden?: boolean }[])
        .filter((item) => !item.hidden)
        .sort((a, b) => a.label.localeCompare(b.label, 'de')),
    [],
  );

  const patch = (next: Partial<ProfileFormState>) => onChange({ ...state, ...next });

  const toggleDifficulty = (value: string) => {
    patch({
      difficulties: state.difficulties.includes(value)
        ? state.difficulties.filter((item) => item !== value)
        : [...state.difficulties, value],
    });
  };

  const addCustomDifficulty = () => {
    const trimmed = customDifficulty.trim();
    if (!trimmed || state.difficulties.includes(trimmed)) return;
    patch({ difficulties: [...state.difficulties, trimmed] });
    setCustomDifficulty('');
  };

  return (
    <div className="space-y-7">
      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">Wie sollen wir dich ansprechen?</label>
        <input
          value={state.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="Vorname"
          autoFocus
          className={cn(inputClass, showErrors && !state.name.trim() ? 'border-red-300' : 'border-slate-200')}
        />
        {showErrors && !state.name.trim() && (
          <p className="mt-1.5 text-xs font-semibold text-red-500">Bitte gib einen Namen ein.</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-2">Worauf trainierst du?</label>
        <div className="grid gap-2.5">
          {GOAL_OPTIONS.map(({ id, icon: Icon, title, body }) => (
            <button
              key={id}
              type="button"
              onClick={() => patch({ goal: id })}
              className={cn(
                'flex items-start gap-3 rounded-2xl border p-4 text-left transition-all',
                state.goal === id
                  ? 'border-brand-green bg-brand-green/5 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300',
              )}
            >
              <div
                className={cn(
                  'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                  state.goal === id ? 'bg-brand-green text-white' : 'bg-slate-100 text-slate-500',
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">{title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{body}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {state.goal === 'facharzt' && (
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Dein Fachgebiet</label>
          <select
            value={state.specialtyTarget}
            onChange={(e) => patch({ specialtyTarget: e.target.value })}
            className={cn(
              inputClass,
              showErrors && !state.specialtyTarget.trim() ? 'border-red-300' : 'border-slate-200',
            )}
          >
            <option value="">Bitte wählen…</option>
            {specialties.map((item) => (
              <option key={item.label} value={item.label}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {state.goal === 'm3' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Wahlfach 1</label>
            <select
              value={state.electiveSubject1}
              onChange={(e) => patch({ electiveSubject1: e.target.value })}
              className={cn(
                inputClass,
                showErrors && !state.electiveSubject1.trim() ? 'border-red-300' : 'border-slate-200',
              )}
            >
              <option value="">Bitte wählen…</option>
              {specialties.map((item) => (
                <option key={item.label} value={item.label} disabled={item.label === state.electiveSubject2}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Wahlfach 2</label>
            <select
              value={state.electiveSubject2}
              onChange={(e) => patch({ electiveSubject2: e.target.value })}
              className={cn(
                inputClass,
                showErrors && !state.electiveSubject2.trim() ? 'border-red-300' : 'border-slate-200',
              )}
            >
              <option value="">Bitte wählen…</option>
              {specialties.map((item) => (
                <option key={item.label} value={item.label} disabled={item.label === state.electiveSubject1}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {state.goal === 'free' && (
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Schwerpunkt-Fach</label>
          <select
            value={state.selectedSubject}
            onChange={(e) => patch({ selectedSubject: e.target.value })}
            className={cn(
              inputClass,
              showErrors && !state.selectedSubject.trim() ? 'border-red-300' : 'border-slate-200',
            )}
          >
            <option value="">Bitte wählen…</option>
            {specialties.map((item) => (
              <option key={item.label} value={item.label}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-bold text-slate-700 mb-1">
          Wobei bist du unsicher? <span className="font-medium text-slate-400">(optional)</span>
        </label>
        <p className="mb-3 text-xs text-slate-500">
          Diese Themen werden im Gespräch unauffällig häufiger geprüft.
        </p>
        <div className="flex flex-wrap gap-2">
          {DIFFICULTY_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => toggleDifficulty(option)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all',
                state.difficulties.includes(option)
                  ? 'border-brand-green bg-brand-green text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
              )}
            >
              {option}
            </button>
          ))}
          {state.difficulties
            .filter((item) => !DIFFICULTY_OPTIONS.includes(item))
            .map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-green bg-brand-green px-3.5 py-1.5 text-xs font-semibold text-white"
              >
                {item}
                <button type="button" onClick={() => toggleDifficulty(item)} aria-label={`${item} entfernen`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={customDifficulty}
            onChange={(e) => setCustomDifficulty(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomDifficulty();
              }
            }}
            placeholder="Eigenes Thema hinzufügen"
            className={cn(inputClass, 'border-slate-200 py-2.5 text-xs')}
          />
          <button
            type="button"
            onClick={addCustomDifficulty}
            disabled={!customDifficulty.trim()}
            className="shrink-0 rounded-xl border border-slate-200 px-4 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}

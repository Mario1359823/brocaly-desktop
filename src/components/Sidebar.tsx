import { useState } from 'react';
import { AlertTriangle, BarChart3, KeyRound, LayoutDashboard, Stethoscope, User } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { BrocalyTextLogo } from './BrocalyLogo';
import { UpdateBanner } from './UpdateBanner';
import { cn } from '../lib/utils';
import type { User as UserType, View } from '../types';

function AbortExamModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 20, stiffness: 260 }}
        className="bg-white rounded-2xl shadow-xl shadow-slate-900/15 max-w-sm w-full p-6"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <h3 className="font-bold text-slate-900">Simulation abbrechen?</h3>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          Die aktuelle Simulation wird nicht gespeichert und alle Antworten gehen verloren.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Weitermachen
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
          >
            Ja, abbrechen
          </button>
        </div>
      </motion.div>
    </div>
  );
}

const NAV_ITEMS: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Start', icon: LayoutDashboard },
  { id: 'subjects', label: 'Fachgebiete', icon: Stethoscope },
  { id: 'stats', label: 'Statistik', icon: BarChart3 },
  { id: 'settings', label: 'API-Einstellungen', icon: KeyRound },
  { id: 'profile', label: 'Profileinstellungen', icon: User },
];

export const Sidebar = ({
  activeView,
  onViewChange,
  user,
  version,
}: {
  activeView: View;
  onViewChange: (v: View) => void;
  user: UserType | null;
  version?: string;
}) => {
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Leaving a running simulation discards it, so make the user confirm.
  const guardExam = (action: () => void) => {
    if (activeView === 'exam') setPendingAction(() => action);
    else action();
  };

  return (
    <>
      <AnimatePresence>
        {pendingAction && (
          <AbortExamModal
            onConfirm={() => {
              pendingAction();
              setPendingAction(null);
            }}
            onCancel={() => setPendingAction(null)}
          />
        )}
      </AnimatePresence>

      <div className="flex flex-col w-60 bg-white/40 backdrop-blur-md border-r border-slate-200/50 h-full shadow-[4px_0_24px_-12px_rgba(0,0,0,0.05)] relative z-10">
        {/* Drag region so the frameless macOS window can still be moved. */}
        <div className="h-9 app-drag shrink-0" />

        <div className="px-5 pb-6">
          <div className="mb-7 ml-2">
            <BrocalyTextLogo size="md" />
          </div>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => guardExam(() => onViewChange(item.id))}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300',
                  activeView === item.id
                    ? 'bg-brand-green text-white shadow-md shadow-brand-green/25'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100',
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-5 border-t border-slate-200/50 bg-white/30 backdrop-blur-md">
          <UpdateBanner />
          <button
            onClick={() => guardExam(() => onViewChange('profile'))}
            className="w-full flex items-center gap-3 rounded-xl p-2 -m-2 hover:bg-slate-100 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-brand-green/10 flex items-center justify-center text-brand-green shadow-sm border border-brand-green/20 shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-slate-800 truncate">{user?.name || 'Profil'}</span>
              <span className="text-xs text-slate-500 font-medium">
                {user?.role === 'doctor' ? 'Ärztin / Arzt' : 'Studium'}
              </span>
            </div>
          </button>
          <p className="mt-4 text-[11px] font-medium text-slate-400 text-center">
            Brocaly {version ? `v${version}` : ''} · Alles bleibt lokal
          </p>
        </div>
      </div>
    </>
  );
};

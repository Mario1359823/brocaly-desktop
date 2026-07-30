import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { caseDirectory, caseQueueFile } from '../electron/paths';
import { logServerError } from './text';

export interface ExamCase {
  id: string;
  titel?: string;
  tags?: string[];
  patient?: string;
  praesentation?: string;
  befunde?: string[];
  diagnose?: string;
  therapie?: string[];
  lernpunkte?: string[];
  kategorie?: string;
  kategorieLabel?: string;
}

// Maps the subject labels shown in the UI onto files of the case library.
// The legacy aliases keep profiles created by earlier versions working.
export const SUBJECT_TO_CASE_FILE: Record<string, string> = {
  // Current labels
  'Allgemeinmedizin': 'brocaly_cases_allgemeinmedizin.json',
  'Innere Medizin': 'brocaly_cases_innere_medizin.json',
  'Neurologie': 'brocaly_cases_neurologie.json',
  'Neurochirurgie': 'brocaly_cases_Neurochirurgie.json',
  'Allgemein- und Viszeralchirurgie': 'brocaly_cases_chirurgie.json',
  'Pädiatrie': 'brocaly_cases_paediatrie.json',
  'Gynäkologie und Geburtshilfe': 'brocaly_cases_gynaekologie.json',
  'Psychiatrie und Psychotherapie': 'brocaly_cases_psychiatrie.json',
  'Psychosomatische Medizin und Psychotherapie': 'brocaly_cases_psychosomatik.json',
  'Orthopädie und Unfallchirurgie': 'brocaly_cases_orthopadie_unfallchirurgie.json',
  'Anästhesie, Intensivmedizin, Notfallmedizin & Schmerztherapie':
    'brocaly_cases_Anästhesie, Intensivmedizin, Notfallmedizin und Schmerztherapie.json',
  'Dermatologie und Venerologie': 'brocaly_cases_dermatologie.json',
  'Angiologie': 'brocaly_cases_Angiologie.json',
  'Diabetologie': 'brocaly_cases_Diabetologie.json',
  'Endokrinologie und Stoffwechsel': 'brocaly_cases_Endokrinologie.json',
  'Gastroenterologie': 'brocaly_cases_Gastroenterologie.json',
  'Geriatrie': 'brocaly_cases_Geriatrie.json',
  'Gefäßchirurgie': 'brocaly_cases_Gefaesschirurgie.json',
  'Hämatologie und Onkologie': 'brocaly_cases_Hämato-Onkologie.json',
  'Infektiologie': 'brocaly_cases_Infektiologie.json',
  'Kardiologie': 'brocaly_cases_Kardiologie.json',
  'Nuklearmedizin': 'brocaly_cases_Nuklearmedizin.json',
  'Pneumologie': 'brocaly_cases_Pneumologie.json',
  'Radiologie': 'brocaly_cases_Radiologie.json',
  'Rechtsmedizin': 'brocaly_cases_Rechtsmedizin.json',
  'Rheumatologie': 'brocaly_cases_Rheumatologie.json',
  'Urologie': 'brocaly_cases_Urologie.json',
  // Legacy aliases
  'Innere Medizin (allgemein)': 'brocaly_cases_innere_medizin.json',
  'Allgemeinmedizin (Hausarzt)': 'brocaly_cases_allgemeinmedizin.json',
  'Kinder- und Jugendmedizin (Pädiatrie)': 'brocaly_cases_paediatrie.json',
  'Psychiatrie, Psychosomatik und Psychotherapie': 'brocaly_cases_psychiatrie.json',
  'Psychosomatik': 'brocaly_cases_psychosomatik.json',
  'Anästhesiologie':
    'brocaly_cases_Anästhesie, Intensivmedizin, Notfallmedizin und Schmerztherapie.json',
  'Notfallmedizin':
    'brocaly_cases_Anästhesie, Intensivmedizin, Notfallmedizin und Schmerztherapie.json',
  'Chirurgie': 'brocaly_cases_chirurgie.json',
  'Dermatologie': 'brocaly_cases_dermatologie.json',
  'Gynäkologie': 'brocaly_cases_gynaekologie.json',
};

export function getCaseFileNameForSubject(subjectQuery: unknown): string | null {
  const subject = typeof subjectQuery === 'string' ? subjectQuery.trim() : '';
  if (!subject || subject.length > 200) return null;
  return SUBJECT_TO_CASE_FILE[subject] ?? null;
}

/** Flattens the `kategorien → faelle` structure of a case file into one array. */
export function loadCases(fileName: string): ExamCase[] {
  const filePath = path.join(caseDirectory(), fileName);
  if (!fs.existsSync(filePath)) return [];
  try {
    const db = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const cases: ExamCase[] = [];
    for (const key of Object.keys(db.kategorien ?? {})) {
      const category = db.kategorien[key] ?? {};
      for (const item of category.faelle ?? []) {
        cases.push({ ...item, kategorie: key, kategorieLabel: category.label ?? key });
      }
    }
    return cases;
  } catch (err) {
    logServerError('cases.load', err);
    return [];
  }
}

// --- Shuffle queue --------------------------------------------------------
// Behaves like a shuffled playlist: every case of a subject plays once, then
// the pool reshuffles. Persisted so it survives app restarts.

function loadQueue(): Map<string, string[]> {
  try {
    const file = caseQueueFile();
    if (fs.existsSync(file)) {
      return new Map(Object.entries(JSON.parse(fs.readFileSync(file, 'utf-8'))));
    }
  } catch {
    /* corrupt file → start fresh */
  }
  return new Map();
}

function saveQueue(queue: Map<string, string[]>): void {
  try {
    fs.writeFileSync(caseQueueFile(), JSON.stringify(Object.fromEntries(queue)), 'utf-8');
  } catch {
    /* non-fatal */
  }
}

let caseQueue: Map<string, string[]> | null = null;

function queue(): Map<string, string[]> {
  // Lazily loaded: `app.getPath` is only usable once Electron is ready.
  if (!caseQueue) caseQueue = loadQueue();
  return caseQueue;
}

function cryptoRandInt(max: number): number {
  const needed = Math.ceil(Math.log2(max) / 8) + 1;
  let value: number;
  do {
    value = parseInt(randomBytes(needed).toString('hex'), 16);
  } while (value >= Math.floor(2 ** (needed * 8) / max) * max);
  return value % max;
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = cryptoRandInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Picks the next case for a subject. `passedIds` are retired for the cycle,
 * `endIds` (failed or aborted) return only once every fresh case has been seen.
 */
export function pickCase(
  allCases: ExamCase[],
  subjectKey: string,
  passedIds: string[],
  endIds: string[],
  focusTopics?: string,
): { chosen: ExamCase; totalCases: number } {
  const passedSet = new Set(passedIds);
  const endSet = new Set(endIds);
  const store = queue();

  const fresh = allCases.filter((c) => !passedSet.has(c.id) && !endSet.has(c.id));
  const endCases = allCases.filter((c) => endSet.has(c.id));

  let pool = fresh.length > 0 ? fresh : endCases.length > 0 ? endCases : allCases;

  // Everything done → drop the queue so the next cycle reshuffles from scratch.
  if (fresh.length === 0 && endCases.length === 0) {
    store.delete(subjectKey);
    pool = allCases;
  }

  const poolIds = new Set(pool.map((c) => c.id));

  // With focus topics, a thematically matching case wins about two times in three.
  if (focusTopics) {
    const terms = focusTopics.toLowerCase().split(/[,;\s]+/).filter((t) => t.length > 2);
    const matching = pool.filter((c) => {
      const haystack = `${c.titel ?? ''} ${(c.tags ?? []).join(' ')}`.toLowerCase();
      return terms.some((t) => haystack.includes(t));
    });
    if (matching.length > 0 && cryptoRandInt(100) < 65) {
      return { chosen: matching[cryptoRandInt(matching.length)], totalCases: allCases.length };
    }
  }

  let pending = (store.get(subjectKey) ?? []).filter((id) => poolIds.has(id));
  if (pending.length === 0) pending = shuffleArray(pool.map((c) => c.id));

  const chosenId = pending.shift()!;
  const chosen = allCases.find((c) => c.id === chosenId) ?? pool[0] ?? allCases[0];

  store.set(subjectKey, pending);
  saveQueue(store);

  return { chosen, totalCases: allCases.length };
}

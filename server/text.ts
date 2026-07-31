// Text helpers ported unchanged from the Brocaly web backend: prompt-injection
// sanitising, log redaction and the German medical pronunciation rules that make
// synthesized speech sound like a clinician rather than a screen reader.

export const MAX_TEXT_LENGTH = 4000;
export const MAX_FOCUS_LENGTH = 500;
export const TTS_MAX_SPOKEN_CHARS = 650;

export function sanitizeString(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val
    // Replace newlines/tabs with spaces — prevents injecting new instruction blocks
    .replace(/[\r\n\t]/g, ' ')
    // Strip common prompt-injection patterns (case-insensitive)
    .replace(/ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|context)/gi, '')
    .replace(/new\s+instruction/gi, '')
    .replace(/system\s*:/gi, '')
    .replace(/assistant\s*:/gi, '')
    .replace(/user\s*:/gi, '')
    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function redactForLog(value: unknown, maxLen = 300): string {
  const raw = value instanceof Error ? value.message : typeof value === 'string' ? value : JSON.stringify(value ?? '');
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [REDACTED]')
    .replace(/sk-[A-Za-z0-9_-]+/g, 'sk-[REDACTED]')
    .replace(/sk_live_[A-Za-z0-9_-]+/g, 'sk_live_[REDACTED]')
    .replace(/sk_test_[A-Za-z0-9_-]+/g, 'sk_test_[REDACTED]')
    .replace(/AIza[0-9A-Za-z_-]+/g, 'AIza[REDACTED]')
    .replace(/whsec_[A-Za-z0-9_-]+/g, 'whsec_[REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]')
    .slice(0, maxLen);
}

export function logServerError(scope: string, err: unknown): void {
  console.error(`[${scope}] ${redactForLog(err)}`);
}

// --- Markdown → plain text for TTS ---
export function stripMarkdown(text: string): string {
  return text
    .replace(/^[-_*]{2,}\s*$/gm, '')          // horizontal rules: ---, ___, ***, ------
    .replace(/^#{1,6}\s+/gm, '')               // headings: ## Title → Title
    .replace(/\*\*(.*?)\*\*/g, '$1')           // **bold** → bold
    .replace(/__(.*?)__/g, '$1')               // __bold__ → bold
    .replace(/\*(.*?)\*/g, '$1')               // *italic* → italic
    .replace(/_(.*?)_/g, '$1')                 // _italic_ → italic
    .replace(/`{1,3}[^`]*`{1,3}/g, '')        // `code` and ```code``` → remove
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // [link text](url) → link text
    .replace(/\[.*?\]/g, '')                   // remaining [...]
    .replace(/^[\s]*[-*+]\s+/gm, '')           // bullet points: - item → item
    .replace(/^\s*\d+\.\s+/gm, '')             // numbered lists: 1. item → item
    .replace(/\n{3,}/g, '\n\n')               // 3+ newlines → 2
    .trim();
}

// --- Medizinische Aussprache-Korrekturen für TTS ---
const ROMAN_TO_DE: Record<string, string> = {
  'X': 'zehn', 'IX': 'neun', 'VIII': 'acht', 'VII': 'sieben', 'VI': 'sechs',
  'V': 'fünf', 'IV': 'vier', 'III': 'drei', 'II': 'zwei', 'I': 'eins',
};
// Longest-first alternation so "VIII" and "III" match before "V" or "I".
// Non-capturing group is load-bearing: the call sites append `[ab]?` for stages
// like "IIb", and without the group that suffix would bind to the last
// alternative only — "Fontaine IIb" would then not match at all.
const ROMAN_RE = /(?:VIII|VII|III|IX|VI|IV|II|X|V|I)/;
function romanToDE(r: string): string { return ROMAN_TO_DE[r.toUpperCase()] ?? r; }
function romanStageToDE(r: string): string {
  return romanToDE(r.replace(/[ab]$/i, '')) + (r.match(/[ab]$/i)?.[0]?.toLowerCase() ?? '');
}
function decimalCommaToSpeech(n: string): string {
  return n.replace(',', ' Komma ');
}
const SMALL_NUMBER_TO_DE: Record<string, string> = {
  '1': 'einmal', '2': 'zweimal', '3': 'dreimal', '4': 'viermal', '5': 'fünfmal',
  '6': 'sechsmal', '7': 'siebenmal', '8': 'achtmal', '9': 'neunmal', '10': 'zehnmal',
};
function timesToDE(n: string): string { return SMALL_NUMBER_TO_DE[n] ?? `${n} mal`; }

export function fixMedicalPronunciation(text: string): string {
  return text
    // ── Klassifikation mit römischen Zahlen (zuerst, sonst zerschneidet später I→eins) ──
    .replace(new RegExp(`\\bNYHA\\s+(${ROMAN_RE.source}[ab]?)\\s*[-–/]\\s*(${ROMAN_RE.source}[ab]?)\\b`, 'gi'),
      (_, from, to) => `N-Y-H-A Stadium ${romanStageToDE(from)} bis ${romanStageToDE(to)}`)
    .replace(new RegExp(`\\bNYHA\\s+(${ROMAN_RE.source}[ab]?)\\b`, 'gi'),
      (_, r) => `N-Y-H-A Stadium ${romanStageToDE(r)}`)
    .replace(new RegExp(`\\bGOLD\\s+(${ROMAN_RE.source})\\b`, 'g'),
      (_, r) => `G-O-L-D Stadium ${romanToDE(r)}`)
    .replace(new RegExp(`\\bFontaine\\s+(${ROMAN_RE.source}[ab]?)\\b`, 'gi'),
      (_, r) => `Stadium ${romanStageToDE(r)} nach Fontaine`)
    .replace(new RegExp(`\\b(?:Stadium|Grad)\\s+(${ROMAN_RE.source}[ab]?)\\b`, 'g'),
      (m, r) => m.replace(r, romanStageToDE(r)))
    // ── Häufige medizinische Begriffe, die ElevenLabs sonst gern falsch betont ──
    .replace(/\b([A-Za-zÄÖÜäöüß-]*?)dyspnoe\b/gi,
      (_, prefix) => `${prefix}${prefix ? 'düspnoe' : 'Düspnoe'}`)
    .replace(/\bACE[-\s]?Hemmer(n|s)?\b/gi,
      (_, suffix = '') => `A-C-E-Hemmer${suffix}`)
    .replace(/\b(\d{1,2})\s*x\s*\/\s*Tag\b/gi,
      (_, n) => `${timesToDE(n)} täglich`)
    .replace(/\b(\d{1,2})\s*x\s*\/\s*d\b/gi,
      (_, n) => `${timesToDE(n)} täglich`)
    .replace(/\b(\d{1,2})\s*x\b/gi,
      (_, n) => timesToDE(n))
    // ── Altersangaben ───────────────────────────────────────────────────
    .replace(/\b(\d{1,3})\s*[-–]\s*j(?:ä|ae)hrige\s+(Frau|Patientin)\b/gi,
      '$1 Jahre alte $2')
    .replace(/\b(\d{1,3})\s*[-–]\s*j\.\s*(Frau|Patientin)\b/gi,
      '$1 Jahre alte $2')
    .replace(/\b(\d{1,3})\s*[-–]\s*j(?:ä|ae)hriger\s+(Mann|Patient)\b/gi,
      '$1 Jahre alter $2')
    .replace(/\b(\d{1,3})\s*[-–]\s*j\.\s*(Mann|Patient)\b/gi,
      '$1 Jahre alter $2')
    .replace(/\b(\d{1,3})\s*[-–]\s*j(?:ä|ae)hriges\s+(Kind|Mädchen|Maedchen)\b/gi,
      '$1 Jahre altes $2')
    .replace(/\b(\d{1,3})\s*[-–]\s*j\.\s*(Kind|Mädchen|Maedchen)\b/gi,
      '$1 Jahre altes $2')
    .replace(/\b(\d{1,3})\s*[-–]\s*j(?:ä|ae)hrigen\s+(Patienten|Mann)\b/gi,
      '$1 Jahre alten $2')
    .replace(/\b(\d{1,3})\s*[-–]\s*j(?:ä|ae)hrigen\s+(Patientin|Frau)\b/gi,
      '$1 Jahre alte $2')
    .replace(/\b(\d{1,3})\s*[-–]\s*j(?:ä|ae)hrige[nrsm]?\b/gi,
      '$1 Jahre alt')
    // ── Befund-Abkürzungen mit Punkten ──────────────────────────────────
    .replace(/\bZ\.n\./g, 'Zustand nach')
    .replace(/\bSt\.p\./gi, 'Status post')
    .replace(/\bV\.a\./g, 'Verdacht auf')
    // Anatomische Kurzschreibweisen: A. hepatica propria, V. portae, N. vagus usw.
    .replace(/\bAa\.\s*/g, 'Arteriae ')
    .replace(/\bA\.\s*/g, 'Arteria ')
    .replace(/\bVv\.\s*/g, 'Venae ')
    .replace(/\bV\.\s*/g, 'Vena ')
    .replace(/\bNn\.\s*/g, 'Nervi ')
    .replace(/\bN\.\s*/g, 'Nervus ')
    .replace(/\bLig\.\s*/g, 'Ligamentum ')
    .replace(/\bArt\.\s*/g, 'Articulatio ')
    .replace(/\bDuct\.\s*/g, 'Ductus ')
    .replace(/\bo\.p\.B\./gi, 'ohne pathologischen Befund')
    .replace(/\bo\.B\./gi, 'ohne Befund')
    .replace(/\bTbl\./g, 'Tablette')
    .replace(/\bTrpf\./g, 'Tropfen')
    .replace(/\bs\.l\./g, 'sublingual')
    .replace(/\bb\.B\./g, 'bei Bedarf')
    .replace(/\bp\.p\./g, 'per primam')
    .replace(/\bp\.s\./g, 'per secundam')
    .replace(/\bp\.os\b/gi, 'per os')
    .replace(/\bi\.v\./g, 'intravenös')
    .replace(/\bp\.o\./g, 'per os')
    .replace(/\bs\.c\./g, 'subkutan')
    .replace(/\bi\.m\./g, 'intramuskulär')
    // ── Dosierschema 1-0-1-0 ────────────────────────────────────────────
    .replace(/\b(\d)-(\d)-(\d)-(\d)\b/g, (_, m, mi, a, n) => {
      const parts: string[] = [];
      if (m  !== '0') parts.push(`${m} morgens`);
      if (mi !== '0') parts.push(`${mi} mittags`);
      if (a  !== '0') parts.push(`${a} abends`);
      if (n  !== '0') parts.push(`${n} nachts`);
      return parts.length ? parts.join(', ') : 'keine Einnahme';
    })
    // ── Einheiten mit Kontext (vor standalone Abkürzungen) ───────────────
    .replace(/(\d+(?:[,.]\d+)?)\s*°C/g, '$1 Grad Celsius')
    .replace(/(\d+)\s*\/\s*min\b/gi, '$1 pro Minute')
    .replace(/(\d+(?:[,.]\d+)?)\s*%/g, '$1 Prozent')
    .replace(/mmHg/g, 'Millimeter H G')
    .replace(/(\d+(?:[,.]\d+)?)\s*mm\b/gi, '$1 Millimeter')
    .replace(/\b1\s+Liter\b/gi, 'ein Liter')
    .replace(/\b1\s*l\b/g, 'ein Liter')
    .replace(/\b1\s*L\b/g, 'ein Liter')
    .replace(/\b(\d+(?:[,.]\d+)?)\s*[-–]\s*(\d+(?:[,.]\d+)?)\s*(mg|ml|µg|g|l)\b/gi,
      '$1 bis $2 $3')
    .replace(/\b(\d+(?:[,.]\d+)?)\s*[-–]\s*(\d+(?:[,.]\d+)?)\s*(Sekunden?|Minuten?|Stunden?|Tage?|Wochen?|Monate?|Jahre?|Std\.?|h|d)\b/gi,
      '$1 bis $2 $3')
    .replace(/\bIE\s*\/\s*kg\s*\/\s*h\b/gi, 'Internationale Einheiten pro Kilogramm pro Stunde')
    .replace(/\bIE\s*\/\s*kg\s*\/\s*min\b/gi, 'Internationale Einheiten pro Kilogramm pro Minute')
    .replace(/\bIE\s*\/\s*h\b/gi, 'Internationale Einheiten pro Stunde')
    .replace(/\bIE\b/g, 'Internationale Einheiten')
    .replace(/mg\/kg\/h/gi, 'Milligramm pro Kilogramm pro Stunde')
    .replace(/mg\/kg\/min/gi, 'Milligramm pro Kilogramm pro Minute')
    .replace(/µg\/kg\/h/gi, 'Mikrogramm pro Kilogramm pro Stunde')
    .replace(/µg\/kg\/min/gi, 'Mikrogramm pro Kilogramm pro Minute')
    .replace(/ml\/kg\/h/gi, 'Milliliter pro Kilogramm pro Stunde')
    .replace(/ml\/kg\/min/gi, 'Milliliter pro Kilogramm pro Minute')
    .replace(/m\s*Osm\s*\/\s*kg/gi, 'Milliosmol pro Kilogramm')
    .replace(/m\s*Osm\s*\/\s*l/gi, 'Milliosmol pro Liter')
    .replace(/m\s*Osmol\s*\/\s*kg/gi, 'Milliosmol pro Kilogramm')
    .replace(/m\s*Osmol\s*\/\s*l/gi, 'Milliosmol pro Liter')
    .replace(/\bmosm\s*\/\s*kg\b/gi, 'Milliosmol pro Kilogramm')
    .replace(/\bmosm\s*\/\s*l\b/gi, 'Milliosmol pro Liter')
    .replace(/\bmosmol\s*\/\s*kg\b/gi, 'Milliosmol pro Kilogramm')
    .replace(/\bmosmol\s*\/\s*l\b/gi, 'Milliosmol pro Liter')
    .replace(/m\s*Osm\b/gi, 'Milliosmol')
    .replace(/m\s*Osmol\b/gi, 'Milliosmol')
    .replace(/\bmosm\b/gi, 'Milliosmol')
    .replace(/\bmosmol\b/gi, 'Milliosmol')
    .replace(/mg\/dl/gi, 'Milligramm pro Deziliter')
    .replace(/µg\/dl/gi, 'Mikrogramm pro Deziliter')
    .replace(/µg\/kg/gi, 'Mikrogramm pro Kilogramm')
    .replace(/mg\/kg/gi, 'Milligramm pro Kilogramm')
    .replace(/ml\/kg/gi, 'Milliliter pro Kilogramm')
    .replace(/µmol\/l/gi, 'Mikromol pro Liter')
    .replace(/mmol\/l/gi, 'Millimol pro Liter')
    .replace(/ng\/ml/gi, 'Nanogramm pro Milliliter')
    .replace(/(\d+(?:[,.]\d+)?)\s*mg\b/gi, (_, n) => `${decimalCommaToSpeech(n)} Milligramm`)
    .replace(/(\d+(?:[,.]\d+)?)\s*ml\b/gi, (_, n) => `${decimalCommaToSpeech(n)} Milliliter`)
    .replace(/(\d+(?:[,.]\d+)?)\s*µg\b/gi, (_, n) => `${decimalCommaToSpeech(n)} Mikrogramm`)
    .replace(/(\d+(?:[,.]\d+)?)\s*g\b/gi, (_, n) => `${decimalCommaToSpeech(n)} Gramm`)
    .replace(/(\d+(?:[,.]\d+)?)\s*l\b/g, (_, n) => `${decimalCommaToSpeech(n)} Liter`)
    .replace(/(\d+(?:[,.]\d+)?)\s*L\b/g, (_, n) => `${decimalCommaToSpeech(n)} Liter`)
    .replace(/\b(\d+),(\d+)\b/g, '$1 Komma $2')
    // ── Vitalparameter & Labor ───────────────────────────────────────────
    .replace(/\bRR\b/g, 'Blutdruck')
    .replace(/\bHF\b/g, 'Herzfrequenz')
    .replace(/\bAF\b/g, 'Atemfrequenz')
    .replace(/\bSpO2\b/gi, 'Sauerstoffsättigung')
    .replace(/\bTemp\b/gi, 'Temperatur')
    .replace(/\bBZ\b/g, 'Blutzucker')
    .replace(/\bHb\b/g, 'Hämoglobin')
    .replace(/\bLeukos\b/gi, 'Leukozyten')
    .replace(/\bINR\b/g, 'I-N-R')
    .replace(/\bCRP\b/g, 'C-R-P')
    .replace(/\bGOT\b/g, 'G-O-T')
    .replace(/\bGPT\b/g, 'G-P-T')
    .replace(/\bHbA1c\b/gi, 'H-b-A-1-c')
    .replace(/\bEKG\b/g, 'E-K-G')
    .replace(/\bCT\b/g, 'C-T')
    .replace(/\bMRT\b/g, 'M-R-T')
    // ── Befund ───────────────────────────────────────────────────────────
    .replace(/\bAZ\b/g, 'Allgemeinzustand')
    .replace(/\bEZ\b/g, 'Ernährungszustand')
    .replace(/\bSHT\b/g, 'Schädel-Hirn-Trauma')
    // ── Medikation & OP ──────────────────────────────────────────────────
    .replace(/\bED\b/g, 'Einzeldosis')
    .replace(/\bTD\b/g, 'Tagesdosis')
    .replace(/\bOP\b/g, 'O-P')
    .replace(/\bBP\b/g, 'Blutdruck')
    // ── Vergleichszeichen ────────────────────────────────────────────────
    .replace(/>/g, ' größer als ')
    .replace(/</g, ' kleiner als ')
    // ── Restliche Brüche: digit/digit → "zu" (nach /min bereits ersetzt) ─
    .replace(/(\d+)\/(\d+)/g, '$1 zu $2');
}

export function limitTtsSpokenText(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= TTS_MAX_SPOKEN_CHARS) return clean;
  const slice = clean.slice(0, TTS_MAX_SPOKEN_CHARS);
  const lastSentenceEnd = Math.max(slice.lastIndexOf('.'), slice.lastIndexOf('!'), slice.lastIndexOf('?'));
  if (lastSentenceEnd >= 180) return slice.slice(0, lastSentenceEnd + 1).trim();
  // Die Auslassungspunkte zählen mit, sonst liefert genau dieser Zweig mehr
  // Zeichen aus, als TTS_MAX_SPOKEN_CHARS zusichert.
  const budget = TTS_MAX_SPOKEN_CHARS - 3;
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 180 && lastSpace <= budget ? lastSpace : budget).trim()}...`;
}

// Speech-to-text models hallucinate subtitle credits during silence or noise,
// especially on short push-to-talk recordings. The filter stays narrow so real
// answers containing medical content are never discarded.
const STT_HALLUCINATION_RES: RegExp[] = [
  /amara\.org/i,
  /^untertitel(ung)?\b.{0,80}$/i,
  /^(subtitles?|untertitel) (by|von|im auftrag)\b.{0,80}$/i,
  /^copyright\b.{0,80}$/i,
  /^das copyright liegt\b.{0,80}$/i,
  /^(vielen )?dank f(ü|u)r('s|s| das)? (zuschauen|zusehen|zuh(ö|o)ren)[.! ]*$/i,
  /^thanks? for watching[.! ]*$/i,
  /^(swr|zdf|wdr|ndr|br|arte) \d{4}[.! ]*$/i,
];

export function stripSttHallucinations(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const compact = trimmed.replace(/\s+/g, ' ');
  return STT_HALLUCINATION_RES.some(re => re.test(compact)) ? '' : trimmed;
}

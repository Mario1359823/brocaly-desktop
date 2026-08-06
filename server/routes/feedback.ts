import { Router } from 'express';
import { generateStructured, parseJsonLoose } from '../ai/structured';
import { CaseSummarySchema, FinalFeedbackSchema } from '../schemas';
import {
  normalizeFinalFeedbackScores,
  sanitizeCompletedCases,
  sanitizePromptHistory,
} from '../scoring';
import { MAX_TEXT_LENGTH, logServerError, redactForLog, sanitizeString } from '../text';
import { FinalFeedbackRequestSchema, HistoryOnlyRequestSchema } from '../validation';
import { sendError } from './http';

export const feedbackRouter = Router();

const BADGE_SYSTEM =
  'Analysiere die Antwort des Medizinstudenten auf die Frage des KI-Gesprächspartners. Antworte ausschließlich mit einem JSON-Objekt der Form {"result":"correct"} — erlaubte Werte: "correct", "incomplete", "incorrect". "correct": Medizinisch korrekt und priorisiert richtig. "incomplete": Grundsätzlich richtig, aber wichtige Details fehlen. "incorrect": Medizinisch falsch oder gefährliche Fehlpriorisierung.';

feedbackRouter.post('/feedback-badge', async (req, res) => {
  try {
    const userAnswer = sanitizeString(req.body?.userAnswer, MAX_TEXT_LENGTH);
    const examinerQuestion = sanitizeString(req.body?.examinerQuestion, MAX_TEXT_LENGTH);
    if (!userAnswer || !examinerQuestion) return res.json({ result: 'incomplete' });

    const { text } = await generateStructured({
      system: BADGE_SYSTEM,
      user: `Frage: "${examinerQuestion}"\nAntwort: "${userAnswer}"`,
      maxTokens: 40,
    });

    const parsed = parseJsonLoose(text) as { result?: string } | null;
    const value = (parsed?.result ?? text).toLowerCase();
    if (value.includes('incomplete')) return res.json({ result: 'incomplete' });
    if (value.includes('incorrect')) return res.json({ result: 'incorrect' });
    if (value.includes('correct')) return res.json({ result: 'correct' });
    res.json({ result: 'incomplete' });
  } catch (err) {
    logServerError('api.feedback-badge', err);
    sendError(res, err);
  }
});

const CASE_SUMMARY_SYSTEM = `Fasse einen soeben abgeschlossenen medizinischen Patientenfall in einer Gesprächssimulation kurz zusammen. Bewerte streng, wie sicher die Person den Fall fachlich und strukturell bearbeitet hat. Erstelle ein JSON mit exakt folgender Struktur:
{
  "outcome": "bestanden" | "nicht bestanden" | "abgebrochen",
  "topic": "Hauptthema des Falls (z.B. Myokardinfarkt, Pneumonie)",
  "keyErrors": ["Max 3 sehr knappe Stichpunkte, was falsch war oder gefehlt hat, falls relevant"],
  "duration": 0
}
WICHTIG: Antworte NUR mit dem rohen JSON-Objekt, keine Markdown-Block-Tags!`;

feedbackRouter.post('/generate-case-summary', async (req, res) => {
  try {
    const parsed = HistoryOnlyRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Keine Historie übergeben.' });

    const { text } = await generateStructured({
      system: CASE_SUMMARY_SYSTEM,
      user: `Gesprächsverlauf: ${JSON.stringify(parsed.data.history)}`,
      maxTokens: 400,
    });

    const validated = CaseSummarySchema.safeParse(parseJsonLoose(text));
    if (!validated.success) {
      logServerError('api.generate-case-summary.schema', redactForLog(validated.error.issues));
      return res.json({ outcome: 'abgebrochen', topic: 'Unbekannt', keyErrors: [], duration: 0 });
    }
    res.json(validated.data);
  } catch (err) {
    logServerError('api.generate-case-summary', err);
    sendError(res, err);
  }
});

const FINAL_FEEDBACK_SYSTEM = `Analysiere ein medizinisches Fachgespräch und erstelle eine detaillierte Auswertung im JSON Format.

SPRACHE & TON — STRIKT EINHALTEN:
- Schreibe IMMER in der zweiten Person Singular: "du", "dein", "dir" — NIEMALS in der dritten Person ("er/sie zeigte", "der Kandidat", Name des Nutzers).
- Korrekt: "Du zeigst solide Kenntnisse bei der Hypertonie-Therapie."
- Falsch: "Herr Müller zeigte grundlegende Kenntnisse..." oder "Der Kandidat hat..."
- Die "summary" ist direkt an die Person gerichtet — sachlich, präzise, nie beschönigend, aber konstruktiv.
- NIEMALS "MWBO", "gemäß MWBO", "laut MWBO" oder ähnliche Abkürzungen im Feedback erwähnen. Beschreibe stattdessen den Inhalt direkt (z.B. "Pharmakologische Grundlagen" statt "MWBO-Kernkompetenz Pharmakologie").

Bewerte:
1. Fachwissen (medicalScore): Medizinische Korrektheit, Detailtiefe, Wissen zu aktuellen Standards.
2. Struktur & Logik (structureScore): Systematisches Vorgehen (Diagnostik -> Therapie), roter Faden.
3. Sprache & Kommunikation (communicationScore): Professionell, verständlich, sicher im Auftreten.

WICHTIGSTE REGEL ZUM SCORE:
Bewerte streng anhand des konkreten Gesprächs. Nutze die gesamte Skala:
- 90-100: sehr vollständig, kaum relevante Lücken
- 75-89: solide bis gut, einzelne Lücken
- 60-74: knapp ausreichend bis befriedigend, erkennbare Lücken
- 40-59: deutlich lückenhaft, mehrere fachlich relevante Fehler/Lücken
- 0-39: gefährlich falsch, stark unstrukturiert oder kaum beantwortet
Die Prozentwerte sollen sich sichtbar an den extrahierten Fragen, fehlenden Keypoints und Kategorie-Schwächen orientieren.
Der Server berechnet die endgültige Gesamtnote aus medicalScore, structureScore und communicationScore nach 60/30/10 nach.

Zusätzlich zur allgemeinen "summary" benötige ich fachspezifisches Feedback in "categoryFeedback".
Für die Kategorien "medical", "structure" und "communication" gibst du jeweils 1-3 spezifische Stärken und 1-3 spezifische Wissenslücken an.
Fülle "strengths" und "weaknesses" auf oberster Ebene weiterhin mit den wichtigsten Punkten über alle Kategorien hinweg.

FRAGEN-AUSWERTUNG:
- Extrahiere 3-6 wirklich relevante Fragen aus dem Gespräch, bevorzugt Fragen mit Fehlern, Lücken, unsicherer Struktur oder hohem klinischem Gewicht.
- Markiere solche Fragen mit "isCritical": true.
- "expectedAnswer" bleibt eine knappe Erwartung in Stichpunkten.
- "idealAnswer" ist eine kurze mögliche Orientierung in 2-4 Sätzen, so wie sie in einem medizinischen Fachgespräch gut gewesen wäre. Keine langen Lehrbuchtexte.
- "missedKeyPoints" enthält 0-4 konkrete Punkte, die in der Antwort gefehlt haben.

Gib das Ergebnis GENAU in dieser JSON Struktur zurück, keine Markdown Tags:
{
  "score": 85,
  "medicalScore": 80,
  "communicationScore": 90,
  "structureScore": 85,
  "summary": "Du zeigst... (zweite Person, direkt an den Nutzer gerichtet)",
  "strengths": ["Stärke 1", "Stärke 2"],
  "weaknesses": ["Wissenslücke 1", "Wissenslücke 2"],
  "categoryFeedback": {
    "medical": { "strengths": ["...", "..."], "weaknesses": ["...", "..."] },
    "structure": { "strengths": ["...", "..."], "weaknesses": ["...", "..."] },
    "communication": { "strengths": ["...", "..."], "weaknesses": ["...", "..."] }
  },
  "passed": true,
  "topics_covered": ["Asthma bronchiale", "Hypertensive Entgleisung"],
  "questions": [
    {
      "question": "Die gestellte Frage",
      "expectedAnswer": "Stichpunktartig: was wurde primär erwartet",
      "userAnswer": "Wie du geantwortet hast",
      "isCritical": true,
      "idealAnswer": "Beste kurze mündliche Antwort in 2-4 Sätzen",
      "missedKeyPoints": ["fehlender Punkt 1", "fehlender Punkt 2"]
    }
  ]
}`;

feedbackRouter.post('/final-feedback', async (req, res) => {
  try {
    const parsed = FinalFeedbackRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Ungültige Feedback-Anfrage.' });

    const safeHistory = sanitizePromptHistory(parsed.data.history);
    const safeCases = sanitizeCompletedCases(parsed.data.casesCompleted);

    const previousCasesContext =
      safeCases.length > 0
        ? `\n\nHINWEIS ZUR GESAMTBEWERTUNG:\nDie Simulation bestand aus mehreren Fällen. Die Person hat bereits ${safeCases.length} Fälle absolviert, bevor der aktuelle (letzte) Fall besprochen wurde.\nZusammenfassung der vorherigen Fälle:\n${JSON.stringify(safeCases)}\nBitte bewerte die gesamte Leistung über ALLE diese Fälle hinweg INKLUSIVE dem Gesprächsverlauf des letzten Falles.`
        : '';

    const { text } = await generateStructured({
      system: FINAL_FEEDBACK_SYSTEM,
      user: `Gespräch (Letzter Fall): ${JSON.stringify(safeHistory)}${previousCasesContext}`,
      maxTokens: 8000,
    });

    const validated = FinalFeedbackSchema.safeParse(parseJsonLoose(text));
    if (!validated.success) {
      // The simulation still counts — the user gets a generic evaluation rather
      // than losing the session to a malformed model response.
      logServerError('api.final-feedback.schema', redactForLog(validated.error.issues));
      return res.json({
        score: 50,
        medicalScore: 50,
        communicationScore: 50,
        structureScore: 50,
        summary:
          'Das fachliche Feedback konnte aufgrund eines unerwarteten KI-Antwortformats nicht vollständig strukturiert werden. Die Simulation wurde dennoch gespeichert.',
        strengths: ['Die Simulation wurde vollständig abgeschlossen.'],
        weaknesses: ['(Fehlendes KI-Datenformat)'],
        passed: false,
        topics_covered: ['Allgemein'],
        questions: [],
      });
    }

    res.json(normalizeFinalFeedbackScores(validated.data, safeCases));
  } catch (err) {
    logServerError('api.final-feedback', err);
    sendError(res, err);
  }
});

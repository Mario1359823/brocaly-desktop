import { FinalFeedbackSchema } from './schemas';
import { sanitizeString } from './text';

// Score normalisation ported from the Brocaly web backend. Language models are
// generous graders, so the model's own scores are blended 35/65 with evidence
// derived from the extracted questions and the completed cases.

type FinalFeedbackPayload = import('zod').z.infer<typeof FinalFeedbackSchema>;

export interface SanitizedCompletedCase {
  outcome: 'bestanden' | 'nicht bestanden' | 'abgebrochen';
  topic: string;
  keyErrors: string[];
  duration: number;
  caseId?: string;
}

export function sanitizePromptHistory(history: { role: string; text: string; timestamp?: number }[]) {
  return history.map((message) => ({
    role: ['user', 'model', 'assistant'].includes(message.role) ? message.role : 'user',
    text: sanitizeString(message.text, 4000),
    ...(message.timestamp ? { timestamp: message.timestamp } : {}),
  }));
}

export function sanitizeCompletedCases(casesCompleted: any[] = []): SanitizedCompletedCase[] {
  return casesCompleted.slice(0, 100).map((item) => ({
    outcome: item.outcome,
    topic: sanitizeString(item.topic, 120),
    keyErrors: (item.keyErrors ?? []).map((entry: unknown) => sanitizeString(entry, 120)).filter(Boolean).slice(0, 3),
    duration: item.duration ?? 0,
    ...(item.caseId ? { caseId: sanitizeString(item.caseId, 120) } : {}),
  }));
}

export function clampScore(value: number, min = 0, max = 100): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function countFeedbackItems(feedback: FinalFeedbackPayload, category: 'medical' | 'structure' | 'communication', kind: 'strengths' | 'weaknesses'): number {
  return feedback.categoryFeedback?.[category]?.[kind]?.filter(Boolean).length ?? 0;
}

function answerLooksEmpty(answer: string): boolean {
  const normalized = answer.toLowerCase().trim();
  return normalized.length < 20 || /\b(weiß nicht|weiss nicht|keine ahnung|unsicher|keine antwort)\b/.test(normalized);
}

function questionEvidenceScore(feedback: FinalFeedbackPayload): number | null {
  const questions = feedback.questions?.filter((question) => question.question?.trim() && question.userAnswer?.trim()) ?? [];
  if (questions.length === 0) return null;

  const questionScores = questions.map((question) => {
    const missedCount = question.missedKeyPoints?.filter(Boolean).length ?? 0;
    const criticalPenalty = question.isCritical ? 8 + missedCount * 4 : 0;
    const emptyPenalty = answerLooksEmpty(question.userAnswer) ? 18 : 0;
    return clampScore(94 - missedCount * 10 - criticalPenalty - emptyPenalty, 15, 98);
  });

  return clampScore(questionScores.reduce((sum, score) => sum + score, 0) / questionScores.length);
}

function completedCaseEvidenceScore(casesCompleted: SanitizedCompletedCase[]): number | null {
  if (casesCompleted.length === 0) return null;

  const caseScores = casesCompleted.map((item) => {
    const errorPenalty = item.keyErrors.length * 7;
    if (item.outcome === 'bestanden') return clampScore(76 - errorPenalty, 55, 92);
    if (item.outcome === 'nicht bestanden') return clampScore(48 - errorPenalty, 15, 58);
    return 25;
  });

  return clampScore(caseScores.reduce((sum, score) => sum + score, 0) / caseScores.length);
}

function categoryEvidenceScore(
  feedback: FinalFeedbackPayload,
  category: 'medical' | 'structure' | 'communication',
  base: number,
): number {
  const strengths = countFeedbackItems(feedback, category, 'strengths');
  const weaknesses = countFeedbackItems(feedback, category, 'weaknesses');
  return clampScore(base + strengths * 3 - weaknesses * 8, 20, 98);
}

function blendScores(modelScore: number, evidenceScore: number): number {
  return clampScore(modelScore * 0.35 + evidenceScore * 0.65);
}

export function normalizeFinalFeedbackScores(
  feedback: FinalFeedbackPayload,
  casesCompleted: SanitizedCompletedCase[],
): FinalFeedbackPayload {
  const questionScore = questionEvidenceScore(feedback);
  const caseScore = completedCaseEvidenceScore(casesCompleted);
  const topLevelWeaknessPenalty = Math.min((feedback.weaknesses?.length ?? 0) * 2, 10);
  const topLevelStrengthBonus = Math.min((feedback.strengths?.length ?? 0), 5);

  const medicalEvidenceBase = questionScore !== null && caseScore !== null
    ? questionScore * 0.75 + caseScore * 0.25
    : questionScore ?? caseScore ?? feedback.medicalScore;

  const medicalEvidence = clampScore(medicalEvidenceBase + topLevelStrengthBonus - topLevelWeaknessPenalty);
  const structureEvidence = categoryEvidenceScore(feedback, 'structure', questionScore ?? feedback.structureScore);
  const communicationEvidence = categoryEvidenceScore(feedback, 'communication', questionScore ?? feedback.communicationScore);

  const medicalScore = blendScores(feedback.medicalScore, medicalEvidence);
  const structureScore = blendScores(feedback.structureScore, structureEvidence);
  const communicationScore = blendScores(feedback.communicationScore, communicationEvidence);
  const score = clampScore(medicalScore * 0.6 + structureScore * 0.3 + communicationScore * 0.1);

  return {
    ...feedback,
    score,
    medicalScore,
    structureScore,
    communicationScore,
    passed: score >= 60,
  };
}


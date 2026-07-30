import { z } from 'zod';

// SECURITY: Zod-Schemas für LLM-Output-Validierung
// Verhindert, dass unerwartete/injizierte Felder unkontrolliert weitergegeben werden.

export const CaseSummarySchema = z.object({
  outcome: z.enum(['bestanden', 'nicht bestanden', 'abgebrochen']),
  topic: z.string().max(200).default('Unbekannt'),
  keyErrors: z.array(z.string().max(300)).max(3).default([]),
  duration: z.number().min(0).default(0),
});

const CategoryFeedbackSchema = z.object({
  strengths: z.array(z.string().max(300)).max(10).default([]),
  weaknesses: z.array(z.string().max(300)).max(10).default([]),
});

export const FinalFeedbackSchema = z.object({
  score: z.number().min(0).max(100),
  medicalScore: z.number().min(0).max(100),
  communicationScore: z.number().min(0).max(100),
  structureScore: z.number().min(0).max(100),
  summary: z.string().max(3000).default(''),
  strengths: z.array(z.string().max(300)).max(10).default([]),
  weaknesses: z.array(z.string().max(300)).max(10).default([]),
  categoryFeedback: z.object({
    medical: CategoryFeedbackSchema.optional(),
    structure: CategoryFeedbackSchema.optional(),
    communication: CategoryFeedbackSchema.optional(),
  }).optional(),
  passed: z.boolean(),
  topics_covered: z.array(z.string().max(100)).max(20).default([]),
  questions: z.array(z.object({
    question: z.string().max(500),
    expectedAnswer: z.string().max(1000),
    userAnswer: z.string().max(1000),
    isCritical: z.boolean().optional().default(false),
    idealAnswer: z.string().max(1500).optional().default(''),
    missedKeyPoints: z.array(z.string().max(200)).max(6).optional().default([]),
  })).max(50).default([]),
});

export type CaseSummary = z.infer<typeof CaseSummarySchema>;
export type FinalFeedback = z.infer<typeof FinalFeedbackSchema>;

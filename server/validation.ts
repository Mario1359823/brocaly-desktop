import { z } from 'zod';
import { CaseSummarySchema } from './schemas';
import { MAX_FOCUS_LENGTH, MAX_TEXT_LENGTH } from './text';

// Request validation is kept even though the only caller is the app's own
// renderer: it turns malformed state into a clean 400 instead of an upstream
// bill, and it caps how much text can be pushed into a paid model call.

const MessageSchema = z.object({
  role: z.enum(['user', 'model', 'assistant']),
  text: z.string().trim().min(1).max(MAX_TEXT_LENGTH),
  timestamp: z.coerce.number().finite().optional(),
});

const HistorySchema = z.array(MessageSchema).max(80);
const StringArraySchema = z.array(z.string().trim().max(120)).max(20).default([]);

const UserContextSchema = z
  .object({
    name: z.string().trim().max(120).optional().default(''),
    role: z.string().trim().max(40).optional().default('student'),
    target: z.string().trim().max(120).optional().default('Staatsexamen'),
    specialtyTarget: z.string().trim().max(120).optional().default(''),
    electiveSubject1: z.string().trim().max(120).optional().default(''),
    electiveSubject2: z.string().trim().max(120).optional().default(''),
    difficulties: StringArraySchema,
  })
  .passthrough()
  .optional();

const ExaminerSchema = z
  .object({
    name: z.string().trim().max(120).optional(),
    personality: z.string().trim().max(4000).optional(),
    voice: z.string().trim().max(80).optional(),
  })
  .passthrough()
  .optional();

const CaseCompletedSchema = CaseSummarySchema.extend({
  caseId: z.string().trim().max(120).optional(),
}).passthrough();

export const ExamRequestSchema = z.object({
  history: HistorySchema,
  subject: z.string().trim().min(1).max(200),
  user: UserContextSchema,
  focusTopics: z.string().trim().max(MAX_FOCUS_LENGTH).optional(),
  excludedTopics: z.string().trim().max(MAX_FOCUS_LENGTH).optional(),
  remainingTime: z.coerce.number().finite().min(-60).max(24 * 60 * 60).optional(),
  durationMinutes: z.coerce.number().finite().min(1).max(240).optional(),
  examiner: ExaminerSchema,
  examMode: z.enum(['relaxed', 'strict']).optional(),
  doneIds: z.array(z.string().trim().max(120)).max(500).optional(),
  endIds: z.array(z.string().trim().max(120)).max(500).optional(),
  casesCompleted: z.array(CaseCompletedSchema).max(100).optional(),
});

export const HistoryOnlyRequestSchema = z.object({
  history: HistorySchema.min(1),
});

export const FinalFeedbackRequestSchema = z.object({
  history: HistorySchema.min(1),
  user: UserContextSchema,
  casesCompleted: z.array(CaseCompletedSchema).max(100).optional(),
});

export const TtsRequestSchema = z.object({
  text: z.string().min(1).max(5000),
});

export const TranscribeRequestSchema = z.object({
  audio: z.string().min(1),
  mimeType: z.string().trim().max(120).optional(),
  subject: z.string().trim().max(200).optional(),
});

export const KeyRequestSchema = z.object({
  apiKey: z.string().trim().min(8).max(400),
});

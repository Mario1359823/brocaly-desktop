import { EXAM_TIMEOUT_MS, UTILITY_MODEL, fromSdkError, openai, recordUsage, withRetry } from './providers';

export interface StructuredRequest {
  /** System instruction describing the desired JSON shape. */
  system: string;
  /** The user turn — usually the serialized conversation. */
  user: string;
  maxTokens: number;
  temperature: number;
}

export interface StructuredResult {
  /** Raw model text; callers parse and validate it against their zod schema. */
  text: string;
}

/**
 * Führt einen JSON-liefernden Prompt aus. `json_object` garantiert
 * syntaktisch gültiges JSON — die inhaltliche Prüfung machen die Aufrufer
 * weiterhin gegen ihr zod-Schema.
 */
export async function generateStructured(request: StructuredRequest): Promise<StructuredResult> {
  return withRetry(async () => {
    try {
      const response = await openai(EXAM_TIMEOUT_MS).responses.create({
        model: UTILITY_MODEL,
        instructions: request.system,
        input: request.user,
        max_output_tokens: request.maxTokens,
        temperature: request.temperature,
        text: { format: { type: 'json_object' } },
      });
      recordUsage(response.usage);
      return { text: response.output_text || '{}' };
    } catch (err) {
      throw fromSdkError(err);
    }
  });
}

/** Strips markdown fences and preamble, then parses the first JSON object. */
export function parseJsonLoose(text: string): unknown {
  const withoutFences = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const match = withoutFences.match(/\{[\s\S]*\}/);
  try {
    return JSON.parse(match ? match[0] : withoutFences);
  } catch {
    return null;
  }
}

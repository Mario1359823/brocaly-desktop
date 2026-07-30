import {
  ANTHROPIC_UTILITY_MODEL,
  EXAM_FETCH_TIMEOUT_MS,
  anthropicClient,
  geminiJson,
  geminiText,
  hasKey,
  withRetry,
} from './providers';
import { geminiChatModel } from './models';

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
  engine: 'anthropic' | 'gemini';
}

/**
 * Runs a JSON-producing prompt on whichever provider the user has configured.
 *
 * Anthropic Haiku is preferred when a key exists because the original Brocaly
 * prompts were tuned against it. With a Google-only setup (the default for a
 * free BYOK install) the same prompt runs on Gemini, where
 * `responseMimeType: application/json` guarantees syntactically valid JSON.
 */
export async function generateStructured(request: StructuredRequest): Promise<StructuredResult> {
  if (hasKey('anthropic')) {
    return withRetry(async () => {
      const message = await anthropicClient().messages.create({
        model: ANTHROPIC_UTILITY_MODEL,
        max_tokens: request.maxTokens,
        system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: request.user }],
        temperature: request.temperature,
      });
      const block = message.content[0];
      return {
        text: block?.type === 'text' ? block.text : '{}',
        engine: 'anthropic' as const,
      };
    });
  }

  return withRetry(async () => {
    const model = await geminiChatModel();
    const genConfig: Record<string, unknown> = {
      maxOutputTokens: request.maxTokens,
      temperature: request.temperature,
      responseMimeType: 'application/json',
    };
    if (model.startsWith('gemini-2.5-flash') && model !== 'gemini-flash-latest') {
      genConfig.thinkingConfig = { thinkingBudget: 0 };
    }
    const payload = await geminiJson(
      `${model}:generateContent`,
      {
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [{ role: 'user', parts: [{ text: request.user }] }],
        generationConfig: genConfig,
      },
      EXAM_FETCH_TIMEOUT_MS,
    );
    return { text: geminiText(payload) || '{}', engine: 'gemini' as const };
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

import type { VoiceProvider } from '../../shared/types';
import { TTS_MODEL, TTS_TIMEOUT_MS, fromSdkError, openai } from './providers';

export interface SynthesisResult {
  buffer: Buffer;
  contentType: string;
}

/**
 * Dr. Brocaly hat genau eine Stimme. `instructions` steuert die Sprechweise —
 * anders als bei Gemini, wo derselbe Versuch die Anfrage entweder mit 400
 * abgelehnt oder minutenlang hängen lassen hat.
 */
const VOICE = 'sage';
const INSTRUCTIONS =
  'Sprich Deutsch mit einer erwachsenen weiblichen Stimme: erfahrene Chefärztin im Prüfungsgespräch. Sachlich, bestimmt, klar artikuliert, zügiges Tempo, kurze Pausen, lebendige Betonung. Nicht langsam, nicht monoton, keine Theatralik.';

export function voiceEnabled(preference: VoiceProvider): boolean {
  return preference !== 'off';
}

export async function synthesize(text: string, preference: VoiceProvider): Promise<SynthesisResult> {
  if (!voiceEnabled(preference)) throw new Error('Sprachausgabe ist deaktiviert.');

  try {
    const response = await openai(TTS_TIMEOUT_MS).audio.speech.create({
      model: TTS_MODEL,
      input: text,
      voice: VOICE,
      instructions: INSTRUCTIONS,
      response_format: 'mp3',
    });
    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType: 'audio/mpeg',
    };
  } catch (err) {
    throw fromSdkError(err);
  }
}

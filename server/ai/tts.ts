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
  'Sprich Deutsch mit einer erwachsenen weiblichen Stimme: erfahrene Chefärztin im Prüfungsgespräch. Sprich deutlich zügig — flottes, natürliches Konversationstempo wie im Klinikalltag, keine Kunstpausen, kein Vorlesen. Sachlich, bestimmt, klar artikuliert, lebendige Betonung.';
/**
 * Die Sprechanweisung allein bringt nur wenig Tempo (gemessen: −8 %). Erst
 * `speed` macht den Unterschied hörbar: dieselbe Textprobe dauert bei 1.0
 * 8,6 s, bei 1.3 noch 5,7 s. 1.3 ist die abgehörte Wahl.
 */
const SPEED = 1.3;

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
      speed: SPEED,
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

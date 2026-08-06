import { toFile } from 'openai';
import { getWhisperPrompt } from '../sttPrompts';
import { stripSttHallucinations } from '../text';
import { STT_TIMEOUT_MS, TRANSCRIBE_MODEL, fromSdkError, openai } from './providers';

export const MAX_STT_AUDIO_BYTES = 25 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  'audio/webm;codecs=opus': 'webm',
  'audio/webm': 'webm',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

export async function transcribe(
  audioBuffer: Buffer,
  mimeType: string,
  subject?: string,
): Promise<{ text: string }> {
  const ext = MIME_TO_EXT[mimeType] ?? 'webm';

  try {
    const result = await openai(STT_TIMEOUT_MS).audio.transcriptions.create({
      file: await toFile(audioBuffer, `audio.${ext}`, { type: mimeType }),
      model: TRANSCRIBE_MODEL,
      language: 'de',
      // Medical vocabulary hints noticeably improve domain term recognition.
      prompt: getWhisperPrompt(subject),
    });
    return { text: stripSttHallucinations((result.text ?? '').trim()) };
  } catch (err) {
    throw fromSdkError(err);
  }
}

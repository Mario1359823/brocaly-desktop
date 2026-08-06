import fs from 'node:fs';
import path from 'node:path';
import { safeStorage } from 'electron';
import type { KeystoreState } from '../shared/types';
import { keysFile } from './paths';

interface StoredKey {
  /** base64 of safeStorage ciphertext, or the raw key when `encrypted` is false. */
  value: string;
  encrypted: boolean;
  masked: string;
  updatedAt: string;
}

/**
 * Historisch lag hier ein Eintrag pro Anbieter (`google`, `anthropic`, …).
 * Brocaly spricht nur noch mit OpenAI; alte Einträge werden beim Lesen
 * ignoriert und beim nächsten Schreiben still entsorgt.
 */
interface KeyFile {
  openai?: StoredKey;
}

let cache: KeyFile | null = null;

function readFile(): KeyFile {
  if (cache) return cache;
  try {
    const file = keysFile();
    const raw = fs.existsSync(file)
      ? (JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, StoredKey>)
      : {};
    cache = raw.openai ? { openai: raw.openai } : {};
  } catch {
    cache = {};
  }
  return cache;
}

function writeFile(next: KeyFile): void {
  cache = next;
  const file = keysFile();
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // 0600: readable by the current user only, even if the keychain is unavailable.
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { encoding: 'utf-8', mode: 0o600 });
  fs.renameSync(tmp, file);
}

export function encryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

function mask(apiKey: string): string {
  const trimmed = apiKey.trim();
  if (trimmed.length <= 10) return '••••••';
  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}

export function setKey(apiKey: string): void {
  const trimmed = apiKey.trim();
  if (!trimmed) throw new Error('Leerer API-Schlüssel.');

  const canEncrypt = encryptionAvailable();
  writeFile({
    openai: {
      value: canEncrypt
        ? safeStorage.encryptString(trimmed).toString('base64')
        : Buffer.from(trimmed, 'utf-8').toString('base64'),
      encrypted: canEncrypt,
      masked: mask(trimmed),
      updatedAt: new Date().toISOString(),
    },
  });
}

export function getKey(): string | null {
  const entry = readFile().openai;
  if (!entry) return null;
  try {
    const buffer = Buffer.from(entry.value, 'base64');
    return entry.encrypted ? safeStorage.decryptString(buffer) : buffer.toString('utf-8');
  } catch (err) {
    // Happens when the OS keychain entry was reset — surface it as "not configured".
    console.error('[keystore] OpenAI-Schlüssel nicht lesbar:', err);
    return null;
  }
}

export function deleteKey(): void {
  writeFile({});
}

export function state(): KeystoreState {
  const entry = readFile().openai;
  return {
    encryptionAvailable: encryptionAvailable(),
    key: {
      configured: Boolean(entry),
      maskedKey: entry?.masked ?? null,
      updatedAt: entry?.updatedAt ?? null,
    },
  };
}

export function clearAll(): void {
  writeFile({});
}

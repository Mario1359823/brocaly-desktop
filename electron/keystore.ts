import fs from 'node:fs';
import path from 'node:path';
import { safeStorage } from 'electron';
import { API_PROVIDERS, type ApiProvider, type KeystoreState } from '../shared/types';
import { keysFile } from './paths';

interface StoredKey {
  /** base64 of safeStorage ciphertext, or the raw key when `encrypted` is false. */
  value: string;
  encrypted: boolean;
  masked: string;
  updatedAt: string;
}

type KeyFile = Partial<Record<ApiProvider, StoredKey>>;

let cache: KeyFile | null = null;

function readFile(): KeyFile {
  if (cache) return cache;
  try {
    const file = keysFile();
    cache = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf-8')) as KeyFile) : {};
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

export function isProvider(value: unknown): value is ApiProvider {
  return typeof value === 'string' && (API_PROVIDERS as string[]).includes(value);
}

export function setKey(provider: ApiProvider, apiKey: string): void {
  const trimmed = apiKey.trim();
  if (!trimmed) throw new Error('Leerer API-Schlüssel.');

  const canEncrypt = encryptionAvailable();
  const entry: StoredKey = {
    value: canEncrypt
      ? safeStorage.encryptString(trimmed).toString('base64')
      : Buffer.from(trimmed, 'utf-8').toString('base64'),
    encrypted: canEncrypt,
    masked: mask(trimmed),
    updatedAt: new Date().toISOString(),
  };
  writeFile({ ...readFile(), [provider]: entry });
}

export function getKey(provider: ApiProvider): string | null {
  const entry = readFile()[provider];
  if (!entry) return null;
  try {
    const buffer = Buffer.from(entry.value, 'base64');
    return entry.encrypted ? safeStorage.decryptString(buffer) : buffer.toString('utf-8');
  } catch (err) {
    // Happens when the OS keychain entry was reset — surface it as "not configured".
    console.error(`[keystore] ${provider}-Schlüssel nicht lesbar:`, err);
    return null;
  }
}

export function deleteKey(provider: ApiProvider): void {
  const next = { ...readFile() };
  delete next[provider];
  writeFile(next);
}

export function state(): KeystoreState {
  const file = readFile();
  return {
    encryptionAvailable: encryptionAvailable(),
    keys: API_PROVIDERS.map((provider) => {
      const entry = file[provider];
      return {
        provider,
        configured: Boolean(entry),
        maskedKey: entry?.masked ?? null,
        updatedAt: entry?.updatedAt ?? null,
      };
    }),
  };
}

export function clearAll(): void {
  writeFile({});
}

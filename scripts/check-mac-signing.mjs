import { execFileSync } from 'node:child_process';

const notarizationModes = [
  ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'],
  ['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER'],
  ['APPLE_KEYCHAIN_PROFILE'],
];

function hasEnv(name) {
  return Boolean(process.env[name]?.trim());
}

function hasCompleteMode(mode) {
  return mode.every(hasEnv);
}

function listSigningIdentities() {
  try {
    return execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const stderr = error.stderr?.toString?.() ?? '';
    throw new Error(`Konnte den macOS-Schluesselbund nicht lesen.\n${stderr}`.trim());
  }
}

if (process.platform !== 'darwin') {
  console.error('macOS-Signing kann nur auf macOS geprueft werden.');
  process.exit(1);
}

const identityOutput = listSigningIdentities();
const hasDeveloperIdInKeychain = /Developer ID Application: .+\([A-Z0-9]+\)/.test(identityOutput);
const hasCertificateExport = hasEnv('CSC_LINK');
const hasNotarizationCredentials = notarizationModes.some(hasCompleteMode);

console.log(identityOutput.trim() || 'Keine gueltigen Code-Signing-Identitaeten gefunden.');

const problems = [];

if (!hasDeveloperIdInKeychain && !hasCertificateExport) {
  problems.push(
    'Es wurde kein Developer-ID-Application-Zertifikat gefunden. ' +
      'Apple Development reicht fuer direkt verteilte DMG/ZIP-Releases nicht aus.',
  );
}

if (!hasNotarizationCredentials) {
  problems.push(
    'Es fehlen Notarisierungsdaten: setze entweder APPLE_ID + ' +
      'APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID oder die App-Store-Connect-API-Key-Variablen.',
  );
}

if (problems.length > 0) {
  console.error('\nSigning-Setup ist noch nicht bereit:');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}

console.log('\nSigning-Setup ist bereit: Developer-ID-Signatur und Notarisierung koennen laufen.');

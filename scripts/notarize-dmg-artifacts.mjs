import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { appBuilderPath } = require('app-builder-bin');

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' });
}

function signingIdentity() {
  if (/^[A-Fa-f0-9]{40}$/.test(process.env.CSC_NAME || '')) return process.env.CSC_NAME;
  if (/^[A-Fa-f0-9]{40}$/.test(process.env.CSC_IDENTITY || '')) return process.env.CSC_IDENTITY;

  const requestedName = process.env.CSC_NAME || 'Developer ID Application: Mario Urbanek (3BHTW7LQ3X)';
  const identities = execFileSync('security', ['find-identity', '-v', '-p', 'codesigning'], {
    encoding: 'utf8',
  });
  const match = identities
    .split('\n')
    .map((line) => line.match(/^\s*\d+\)\s+([A-Fa-f0-9]{40})\s+"(.+)"$/))
    .find((matchResult) => matchResult && matchResult[2].includes(requestedName.replace(/^Developer ID Application:\s*/, '')));

  return match?.[1] || requestedName;
}

function notaryArgs() {
  if (process.env.APPLE_KEYCHAIN_PROFILE) {
    return ['--keychain-profile', process.env.APPLE_KEYCHAIN_PROFILE];
  }

  if (
    process.env.APPLE_ID &&
    process.env.APPLE_APP_SPECIFIC_PASSWORD &&
    process.env.APPLE_TEAM_ID
  ) {
    return [
      '--apple-id',
      process.env.APPLE_ID,
      '--password',
      process.env.APPLE_APP_SPECIFIC_PASSWORD,
      '--team-id',
      process.env.APPLE_TEAM_ID,
    ];
  }

  return null;
}

export default async function notarizeDmgArtifacts(context) {
  if (process.platform !== 'darwin') return;

  const credentials = notaryArgs();
  if (!credentials) {
    console.log('  • keine Notary-Credentials fuer DMG-Notarisierung gefunden');
    return;
  }

  const dmgPaths = context.artifactPaths.filter((artifactPath) => artifactPath.endsWith('.dmg'));
  if (dmgPaths.length === 0) return;

  for (const dmgPath of dmgPaths) {
    console.log(`  • signiere DMG ${path.basename(dmgPath)}`);
    run('codesign', ['--force', '--sign', signingIdentity(), dmgPath]);

    console.log(`  • notarisiere DMG ${path.basename(dmgPath)}`);
    run('xcrun', ['notarytool', 'submit', dmgPath, ...credentials, '--wait']);

    console.log(`  • staple DMG ${path.basename(dmgPath)}`);
    run('xcrun', ['stapler', 'staple', dmgPath]);

    const blockmapPath = `${dmgPath}.blockmap`;
    if (fs.existsSync(blockmapPath)) {
      console.log(`  • erneuere Blockmap ${path.basename(blockmapPath)}`);
      run(appBuilderPath, ['blockmap', '--input', dmgPath, '--output', blockmapPath]);
    }
  }
}

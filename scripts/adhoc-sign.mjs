// electron-builder afterPack-Hook: signiert die macOS-App ad hoc — aber nur,
// solange kein echtes Developer-ID-Zertifikat vorliegt.
//
// Warum das ohne Zertifikat nötig ist: electron-builder signiert dann gar
// nicht. Übrig bleibt die linker-signierte Signatur der Electron-Binary
// (Identifier=Electron, "Info.plist=not bound"), die den ausgetauschten
// Bundle-Inhalt nicht abdeckt — macOS lehnt das rundheraus ab.
//
// Die Ad-hoc-Signatur ist gültig (codesign --verify --deep --strict läuft
// durch), reicht aber nicht gegen Gatekeeper: Ein aus dem Browser geladenes
// Bundle trägt das Quarantäne-Merkmal, und dafür verlangt macOS eine
// Notarisierung. Nutzer sehen sonst „Brocaly ist beschädigt" und kommen nur
// über `xattr -dr com.apple.quarantine` weiter.
//
// Sobald CSC_LINK gesetzt ist, signiert und notarisiert electron-builder
// selbst. Dann muss dieser Hook die Finger davon lassen: Eine Ad-hoc-Signatur
// über das fertige Bundle würde die echte Signatur überschreiben und die
// Notarisierung wertlos machen.

import { execFileSync } from 'node:child_process';
import path from 'node:path';

export default async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;

  if (process.env.CSC_LINK || process.env.CSC_NAME) {
    console.log('  • echtes Zertifikat vorhanden — Ad-hoc-Signatur übersprungen');
    return;
  }

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );

  // Erweiterte Attribute entfernen, sonst scheitert codesign an Resource-Forks.
  execFileSync('xattr', ['-cr', appPath], { stdio: 'inherit' });
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' });

  console.log(`  • ad-hoc signed  ${appPath}`);
}

// electron-builder afterPack-Hook: signiert die macOS-App ad hoc.
//
// Warum das nötig ist: Ohne Developer-ID signiert electron-builder gar nicht.
// Übrig bleibt dann die linker-signierte Signatur der Electron-Binary
// (Identifier=Electron, "Info.plist=not bound"), die den ausgetauschten
// Bundle-Inhalt nicht abdeckt. macOS lehnt das mit
// „Brocaly ist beschädigt und kann nicht geöffnet werden" ab — und da hilft
// auch Rechtsklick → Öffnen nicht.
//
// Eine Ad-hoc-Signatur über das fertige Bundle macht daraus die normale
// „unbekannter Entwickler"-Meldung, die sich per Rechtsklick → Öffnen
// bestätigen lässt. Kostenpflichtiges Apple-Zertifikat bleibt so unnötig.

import { execFileSync } from 'node:child_process';
import path from 'node:path';

export default async function adhocSign(context) {
  if (context.electronPlatformName !== 'darwin') return;

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

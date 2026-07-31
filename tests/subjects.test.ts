import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { examDataset } from '../src/data/examDataset';

vi.mock('electron', () => ({
  app: { getPath: () => '', getAppPath: () => process.cwd(), isPackaged: false },
}));

// Nahtstelle zwischen Oberfläche und Server: Die Fächerliste kommt aus dem
// Datensatz im Renderer, die Fallbibliothek wird serverseitig über das Label
// aufgelöst. Fällt beides auseinander, wählt jemand ein Fach — und bekommt eine
// Simulation ganz ohne Fall. Das merkt man sonst erst mitten in der Prüfung.
const uiSubjectLabels = Object.entries(examDataset.specialties)
  .filter(([, data]) => !(data as { hidden?: boolean }).hidden)
  .map(([, data]) => (data as { label: string }).label);

const caseDir = path.join(process.cwd(), 'resources', 'cases');

describe('Fächer der Oberfläche', () => {
  it('bietet überhaupt Fächer an', () => {
    expect(uiSubjectLabels.length).toBeGreaterThan(0);
  });

  it('hat für jedes angebotene Fach eine gemappte Falldatei', async () => {
    const { getCaseFileNameForSubject } = await import('../server/cases');
    const unmapped = uiSubjectLabels.filter((label) => !getCaseFileNameForSubject(label));
    expect(unmapped).toEqual([]);
  });

  it('hat für jedes angebotene Fach eine Falldatei mit mindestens einem Fall', async () => {
    if (!fs.existsSync(caseDir)) return; // Fallbibliothek nicht ausgecheckt
    const { getCaseFileNameForSubject, loadCases } = await import('../server/cases');

    const empty = uiSubjectLabels.filter((label) => {
      const file = getCaseFileNameForSubject(label);
      return !file || loadCases(file).length === 0;
    });
    expect(empty).toEqual([]);
  });

  it('lässt keine Falldatei ungenutzt in resources/cases liegen', async () => {
    if (!fs.existsSync(caseDir)) return;
    const { SUBJECT_TO_CASE_FILE } = await import('../server/cases');

    const referenced = new Set(Object.values(SUBJECT_TO_CASE_FILE));
    const orphans = fs
      .readdirSync(caseDir)
      .filter((file) => file.endsWith('.json') && !referenced.has(file));
    expect(orphans).toEqual([]);
  });
});

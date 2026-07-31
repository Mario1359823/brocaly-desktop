import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => ({ userData: '' }));
vi.mock('electron', () => ({
  app: {
    getPath: () => mocked.userData,
    getAppPath: () => mocked.userData,
    isPackaged: false,
  },
}));

type Cases = typeof import('../server/cases');
let cases: Cases;

// Die Warteschlange lebt in einer Modulvariablen — jeder Test braucht ein
// frisches Modul, sonst trägt er den Zustand des vorigen mit.
async function freshCases(): Promise<Cases> {
  vi.resetModules();
  return import('../server/cases');
}

function makeCase(id: string, titel = `Fall ${id}`, tags: string[] = []) {
  return { id, titel, tags };
}

const pool = ['a', 'b', 'c', 'd', 'e'].map((id) => makeCase(id));

beforeEach(async () => {
  mocked.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'brocaly-cases-'));
  cases = await freshCases();
});

afterEach(() => {
  fs.rmSync(mocked.userData, { recursive: true, force: true });
});

describe('getCaseFileNameForSubject', () => {
  it('findet die Datei zu einem aktuellen Fachgebiet', () => {
    expect(cases.getCaseFileNameForSubject('Kardiologie')).toBe('brocaly_cases_Kardiologie.json');
  });

  it('hält alte Profile am Leben, die noch die früheren Bezeichnungen tragen', () => {
    expect(cases.getCaseFileNameForSubject('Chirurgie')).toBe('brocaly_cases_chirurgie.json');
    expect(cases.getCaseFileNameForSubject('Innere Medizin (allgemein)')).toBe(
      'brocaly_cases_innere_medizin.json',
    );
  });

  it('jedes gemappte Fachgebiet zeigt auf eine Datei, die es wirklich gibt', () => {
    const dir = path.join(process.cwd(), 'resources', 'cases');
    if (!fs.existsSync(dir)) return; // Fallbibliothek nicht ausgecheckt
    const missing = Object.entries(cases.SUBJECT_TO_CASE_FILE)
      .filter(([, file]) => !fs.existsSync(path.join(dir, file)))
      .map(([subject, file]) => `${subject} → ${file}`);
    expect(missing).toEqual([]);
  });

  it('weist unbekannte und unsinnige Eingaben ab', () => {
    expect(cases.getCaseFileNameForSubject('Raumfahrtmedizin')).toBeNull();
    expect(cases.getCaseFileNameForSubject('')).toBeNull();
    expect(cases.getCaseFileNameForSubject(undefined)).toBeNull();
    expect(cases.getCaseFileNameForSubject(42)).toBeNull();
    expect(cases.getCaseFileNameForSubject('x'.repeat(201))).toBeNull();
  });
});

describe('loadCases', () => {
  it('flacht kategorien → faelle in eine Liste ab und hängt die Kategorie an', () => {
    fs.mkdirSync(path.join(mocked.userData, 'resources', 'cases'), { recursive: true });
    fs.writeFileSync(
      path.join(mocked.userData, 'resources', 'cases', 'test.json'),
      JSON.stringify({
        kategorien: {
          kardio: { label: 'Kardiologie', faelle: [makeCase('k1'), makeCase('k2')] },
          pneumo: { faelle: [makeCase('p1')] },
        },
      }),
    );

    const loaded = cases.loadCases('test.json');
    expect(loaded.map((c) => c.id)).toEqual(['k1', 'k2', 'p1']);
    expect(loaded[0].kategorieLabel).toBe('Kardiologie');
    // Ohne label fällt das Label auf den Schlüssel zurück.
    expect(loaded[2].kategorieLabel).toBe('pneumo');
  });

  it('gibt bei fehlender oder beschädigter Datei eine leere Liste zurück, statt zu werfen', () => {
    expect(cases.loadCases('gibt-es-nicht.json')).toEqual([]);

    fs.mkdirSync(path.join(mocked.userData, 'resources', 'cases'), { recursive: true });
    fs.writeFileSync(path.join(mocked.userData, 'resources', 'cases', 'kaputt.json'), '{ nope');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(cases.loadCases('kaputt.json')).toEqual([]);
  });
});

describe('pickCase', () => {
  it('überspringt bestandene Fälle', () => {
    for (let i = 0; i < 20; i++) {
      const { chosen } = cases.pickCase(pool, 'Kardiologie', ['a', 'b', 'c'], []);
      expect(['d', 'e']).toContain(chosen.id);
    }
  });

  it('spielt jeden Fall einmal, bevor sich einer wiederholt', () => {
    const seen: string[] = [];
    for (let i = 0; i < pool.length; i++) {
      seen.push(cases.pickCase(pool, 'Kardiologie', [], []).chosen.id);
    }
    expect([...seen].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('merkt sich die Warteschlange über einen Neustart hinweg', async () => {
    const first = cases.pickCase(pool, 'Kardiologie', [], []).chosen.id;

    cases = await freshCases(); // App neu gestartet

    const rest = [
      cases.pickCase(pool, 'Kardiologie', [], []).chosen.id,
      cases.pickCase(pool, 'Kardiologie', [], []).chosen.id,
      cases.pickCase(pool, 'Kardiologie', [], []).chosen.id,
      cases.pickCase(pool, 'Kardiologie', [], []).chosen.id,
    ];
    expect(rest).not.toContain(first);
    expect([first, ...rest].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('hält die Warteschlangen verschiedener Fachgebiete auseinander', () => {
    const kardio = cases.pickCase(pool, 'Kardiologie', [], []).chosen.id;
    const neuro = cases.pickCase(pool, 'Neurologie', [], []).chosen.id;
    // Beide starten mit vollem Pool; die Wahl des einen darf den anderen nicht
    // einschränken.
    expect(pool.map((c) => c.id)).toContain(kardio);
    expect(pool.map((c) => c.id)).toContain(neuro);
  });

  it('holt gescheiterte Fälle zurück, sobald keine frischen mehr da sind', () => {
    const { chosen } = cases.pickCase(pool, 'Kardiologie', ['a', 'b', 'c'], ['d', 'e']);
    expect(['d', 'e']).toContain(chosen.id);
  });

  it('beginnt einen neuen Zyklus, wenn alle Fälle bestanden sind', () => {
    const allIds = pool.map((c) => c.id);
    const { chosen, totalCases } = cases.pickCase(pool, 'Kardiologie', allIds, []);
    expect(allIds).toContain(chosen.id);
    expect(totalCases).toBe(pool.length);
  });

  it('bevorzugt bei Schwerpunktthemen einen passenden Fall', () => {
    const themed = [
      makeCase('herz-1', 'Vorhofflimmern', ['Kardiologie', 'Rhythmus']),
      ...['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8', 'x9'].map((id) => makeCase(id)),
    ];

    let hits = 0;
    for (let i = 0; i < 300; i++) {
      if (cases.pickCase(themed, 'Kardiologie', [], [], 'Vorhofflimmern').chosen.id === 'herz-1') {
        hits++;
      }
    }
    // Ohne Schwerpunkt wäre die Trefferquote 1/10; mit ~65 % plus Restchance.
    expect(hits / 300).toBeGreaterThan(0.5);
  });

  it('ignoriert zu kurze Schwerpunktbegriffe, die auf alles passen würden', () => {
    const themed = [makeCase('a', 'Vorhofflimmern'), makeCase('b', 'Pneumonie')];
    // "im" hat 2 Zeichen und wird verworfen — sonst würde es in beliebigen
    // Titeln matchen und die Auswahl verzerren.
    const ids = new Set<string>();
    for (let i = 0; i < 40; i++) {
      ids.add(cases.pickCase(themed, 'Kardiologie', [], [], 'im').chosen.id);
    }
    expect([...ids].sort()).toEqual(['a', 'b']);
  });

  it('kommt mit einem einzigen Fall zurecht', () => {
    const single = [makeCase('nur-einer')];
    expect(cases.pickCase(single, 'Kardiologie', [], []).chosen.id).toBe('nur-einer');
    expect(cases.pickCase(single, 'Kardiologie', ['nur-einer'], []).chosen.id).toBe('nur-einer');
  });

  it('meldet die Gesamtzahl der Fälle des Fachgebiets', () => {
    expect(cases.pickCase(pool, 'Kardiologie', [], []).totalCases).toBe(5);
  });
});

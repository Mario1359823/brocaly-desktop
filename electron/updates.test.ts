import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getVersion: () => '1.0.0' } }));

const { compareVersions } = await import('./updates');

/**
 * Der Versionsvergleich entscheidet, ob der Update-Hinweis erscheint. Ein Fehler
 * hier ist unsichtbar: Entweder verpassen alle das Update, oder es wird eines
 * beworben, das gar nicht neuer ist.
 */
describe('compareVersions', () => {
  it('erkennt neuere, ältere und gleiche Versionen', () => {
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('vergleicht zahlenweise, nicht als Text', () => {
    // Als Zeichenkette wäre "1.0.10" kleiner als "1.0.9" — das wäre der Fehler.
    expect(compareVersions('1.0.10', '1.0.9')).toBe(1);
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
  });

  it('ignoriert ein führendes v und Vorab-Kennzeichnungen', () => {
    expect(compareVersions('v1.2.0', '1.2.0')).toBe(0);
    expect(compareVersions('1.2.0-beta.1', '1.2.0')).toBe(0);
  });

  it('kommt mit unterschiedlich langen Versionen klar', () => {
    expect(compareVersions('1.1', '1.1.0')).toBe(0);
    expect(compareVersions('2', '1.9.9')).toBe(1);
  });
});

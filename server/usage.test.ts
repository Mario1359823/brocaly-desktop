import { beforeEach, describe, expect, it } from 'vitest';
import { recordTokens, resetUsage, usageSnapshot } from './usage';

/**
 * Der Kostenzähler ist eine Vertrauensangabe: Wenn er zu niedrig steht, fühlt
 * sich BYOK unehrlich an. Hier geht es um Zählen und Zurücksetzen, nicht um die
 * genauen Preise — die sind eine Schätzung und stehen in usage.ts.
 */
describe('Verbrauchszähler', () => {
  beforeEach(() => {
    resetUsage();
  });

  it('startet leer', () => {
    const snapshot = usageSnapshot();
    expect(snapshot.inputTokens).toBe(0);
    expect(snapshot.outputTokens).toBe(0);
    expect(snapshot.requests).toBe(0);
    expect(snapshot.estimatedCostEur).toBe(0);
  });

  it('summiert über mehrere Aufrufe', () => {
    recordTokens(1000, 500);
    recordTokens(2000, 1500);
    const snapshot = usageSnapshot();
    expect(snapshot.inputTokens).toBe(3000);
    expect(snapshot.outputTokens).toBe(2000);
    expect(snapshot.requests).toBe(2);
  });

  it('ignoriert fehlende oder unsinnige Zahlen, statt NaN zu erzeugen', () => {
    recordTokens(Number.NaN, undefined as unknown as number);
    recordTokens(-50, 100);
    const snapshot = usageSnapshot();
    expect(snapshot.inputTokens).toBe(0);
    expect(snapshot.outputTokens).toBe(100);
    expect(Number.isFinite(snapshot.estimatedCostEur)).toBe(true);
  });

  it('schätzt Kosten, die mit dem Verbrauch steigen', () => {
    recordTokens(100_000, 50_000);
    const small = usageSnapshot().estimatedCostEur;
    recordTokens(900_000, 450_000);
    const large = usageSnapshot().estimatedCostEur;
    expect(small).toBeGreaterThan(0);
    expect(large).toBeGreaterThan(small);
  });

  it('setzt beim Start einer neuen Simulation zurück', () => {
    recordTokens(5000, 5000);
    resetUsage();
    expect(usageSnapshot().requests).toBe(0);
    expect(usageSnapshot().estimatedCostEur).toBe(0);
  });
});

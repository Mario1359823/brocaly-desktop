import type { UsageTotals } from '../types';

/**
 * Formatiert den geschätzten Verbrauch einer Simulation.
 *
 * Bewusst als Schätzung ausgewiesen: Die Zahl entsteht aus den Token-Zahlen des
 * Anbieters und den in server/usage.ts hinterlegten Näherungspreisen. Verbindlich
 * ist die Abrechnung beim Anbieter.
 */
export function formatEstimatedCost(usage?: UsageTotals): string | null {
  if (!usage || usage.requests === 0) return null;
  const cents = usage.estimatedCostEur * 100;
  if (cents < 1) return '< 1 ct';
  return `${cents.toLocaleString('de-DE', { maximumFractionDigits: cents < 10 ? 1 : 0 })} ct`;
}

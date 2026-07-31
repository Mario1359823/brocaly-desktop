/**
 * Verbrauchszähler für die laufende Simulation.
 *
 * Bei BYOK zahlt die Nutzer:in direkt beim Anbieter — dann soll sie auch sehen,
 * was eine Simulation ungefähr gekostet hat. Gezählt wird zentral dort, wo die
 * Anbieter-Antworten ankommen (`geminiJson`, Anthropic-Aufruf); der Renderer
 * holt am Ende eine Momentaufnahme und schreibt sie in die Session.
 *
 * Alles bleibt lokal und wird nirgendwohin gemeldet.
 */

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  requests: number;
  /** Grobe Schätzung in Euro — bewusst als Schätzung ausgewiesen. */
  estimatedCostEur: number;
}

/**
 * Näherungspreise für Gemini 2.5 Flash in Euro je 1 Mio. Tokens, Stand Juli 2026.
 *
 * Bewusst eine einzige, grobe Stelle: Die Anzeige ist eine Orientierung, keine
 * Abrechnung. Sprachausgabe und Transkription laufen ebenfalls über Tokens,
 * werden hier aber mit denselben Sätzen gerechnet — verbindlich ist immer die
 * Preisliste unter ai.google.dev/pricing. Bei Preisänderungen nur hier anfassen.
 */
const RATE_INPUT_PER_MILLION = 0.28;
const RATE_OUTPUT_PER_MILLION = 2.3;

function emptyTotals(): UsageTotals {
  return { inputTokens: 0, outputTokens: 0, requests: 0, estimatedCostEur: 0 };
}

let current: UsageTotals = emptyTotals();

/** Setzt den Zähler zurück — der Renderer ruft das beim Start einer Simulation. */
export function resetUsage(): UsageTotals {
  current = emptyTotals();
  return current;
}

export function recordTokens(input: number, output: number): void {
  if (!Number.isFinite(input) && !Number.isFinite(output)) return;
  current.inputTokens += Math.max(0, input || 0);
  current.outputTokens += Math.max(0, output || 0);
  current.requests += 1;
}

export function usageSnapshot(): UsageTotals {
  const cost =
    (current.inputTokens / 1_000_000) * RATE_INPUT_PER_MILLION +
    (current.outputTokens / 1_000_000) * RATE_OUTPUT_PER_MILLION;
  return { ...current, estimatedCostEur: Math.round(cost * 10_000) / 10_000 };
}

import { defineConfig } from 'vitest/config';

// Getestet wird die Logik hinter der Simulation: Prompt-Sanitising, Score-
// Normalisierung, Request-Validierung, lokaler Speicher und Fallauswahl.
// Alles läuft in Node — kein Electron-Fenster, kein Netz, keine API-Schlüssel.
export default defineConfig({
  test: {
    environment: 'node',
    // Zwei Orte mit Absicht: `tests/` für Tests, die mehrere Module verdrahten,
    // daneben Tests direkt neben dem Modul, das sie prüfen.
    include: ['tests/**/*.test.ts', 'electron/**/*.test.ts', 'server/**/*.test.ts'],
    globals: false,
  },
});

import { describe, expect, it } from 'vitest';
import { clampScore, normalizeFinalFeedbackScores, sanitizeCompletedCases } from './scoring';

/**
 * Die Bewertung ist die Stelle, an der ein stiller Fehler am teuersten ist:
 * Falsche Zahlen sehen plausibel aus, und niemand merkt es. Deshalb hier die
 * Grenzfälle festnageln, nicht die Formel nachrechnen.
 */

const baseFeedback = {
  score: 0,
  medicalScore: 80,
  structureScore: 70,
  communicationScore: 60,
  passed: false,
  strengths: [],
  weaknesses: [],
  questions: [],
  topics_covered: [],
} as any;

describe('clampScore', () => {
  it('hält Werte in den Grenzen', () => {
    expect(clampScore(120)).toBe(100);
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(72.4)).toBe(72);
  });

  it('macht aus Unsinn den Mindestwert statt NaN', () => {
    expect(clampScore(Number.NaN)).toBe(0);
    expect(clampScore(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('normalizeFinalFeedbackScores', () => {
  it('liefert für jede Teilnote eine ganze Zahl zwischen 0 und 100', () => {
    const result = normalizeFinalFeedbackScores(baseFeedback, []);
    for (const value of [
      result.score,
      result.medicalScore,
      result.structureScore,
      result.communicationScore,
    ]) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it('setzt "bestanden" genau ab 60 Punkten', () => {
    const strong = normalizeFinalFeedbackScores(
      { ...baseFeedback, medicalScore: 95, structureScore: 95, communicationScore: 95 },
      [],
    );
    const weak = normalizeFinalFeedbackScores(
      { ...baseFeedback, medicalScore: 10, structureScore: 10, communicationScore: 10 },
      [],
    );
    expect(strong.passed).toBe(strong.score >= 60);
    expect(weak.passed).toBe(false);
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it('zieht Schwächen ab und rechnet Stärken an', () => {
    const withWeaknesses = normalizeFinalFeedbackScores(
      { ...baseFeedback, weaknesses: ['a', 'b', 'c'] },
      [],
    );
    const withStrengths = normalizeFinalFeedbackScores(
      { ...baseFeedback, strengths: ['a', 'b', 'c'] },
      [],
    );
    expect(withStrengths.score).toBeGreaterThan(withWeaknesses.score);
  });

  it('lässt die übrigen Felder unangetastet', () => {
    const result = normalizeFinalFeedbackScores(
      { ...baseFeedback, topics_covered: ['Lungenembolie'] },
      [],
    );
    expect(result.topics_covered).toEqual(['Lungenembolie']);
  });
});

describe('sanitizeCompletedCases', () => {
  it('kürzt die Liste und begrenzt die Fehlerangaben je Fall', () => {
    const many = Array.from({ length: 150 }, () => ({
      outcome: 'bestanden',
      topic: 'Thema',
      keyErrors: ['a', 'b', 'c', 'd', 'e'],
      duration: 60,
    }));
    const result = sanitizeCompletedCases(many);
    expect(result).toHaveLength(100);
    expect(result[0].keyErrors).toHaveLength(3);
  });

  it('verträgt fehlende Angaben', () => {
    const result = sanitizeCompletedCases([{ outcome: 'abgebrochen', topic: 'X' }]);
    expect(result[0].keyErrors).toEqual([]);
    expect(result[0].duration).toBe(0);
  });
});

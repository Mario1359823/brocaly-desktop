import { Router } from 'express';
import { SUBJECT_TO_CASE_FILE, getCaseFileNameForSubject, loadCases } from '../cases';
import { logServerError } from '../text';
import { sendError } from './http';

export const casesRouter = Router();

casesRouter.get('/subjects', (_req, res) => {
  // Only the canonical labels — legacy aliases stay resolvable but hidden.
  const seen = new Set<string>();
  const subjects = Object.entries(SUBJECT_TO_CASE_FILE)
    .filter(([, file]) => {
      if (seen.has(file)) return false;
      seen.add(file);
      return true;
    })
    .map(([label]) => label)
    .sort((a, b) => a.localeCompare(b, 'de'));
  res.json({ subjects });
});

casesRouter.get('/case-count', (req, res) => {
  try {
    const fileName = getCaseFileNameForSubject(req.query.subject);
    res.json({ count: fileName ? loadCases(fileName).length : 0 });
  } catch (err) {
    logServerError('api.case-count', err);
    res.json({ count: 0 });
  }
});

casesRouter.get('/cases', (req, res) => {
  try {
    const fileName = getCaseFileNameForSubject(req.query.subject);
    if (!fileName) return res.json({ cases: [] });
    // Titles and tags only — the diagnosis and findings must not leak into the UI.
    const cases = loadCases(fileName).map((item) => ({
      id: item.id,
      titel: item.titel ?? '',
      tags: item.tags ?? [],
      kategorie: item.kategorie ?? '',
      kategorieLabel: item.kategorieLabel ?? '',
    }));
    res.json({ cases });
  } catch (err) {
    logServerError('api.cases', err);
    sendError(res, err);
  }
});

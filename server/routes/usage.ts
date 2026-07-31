import { Router } from 'express';
import { resetUsage, usageSnapshot } from '../usage';

/** Verbrauch der laufenden Simulation — nur lokal, nur lesend bzw. zurücksetzend. */
export const usageRouter = Router();

usageRouter.post('/usage/reset', (_req, res) => {
  res.json(resetUsage());
});

usageRouter.get('/usage', (_req, res) => {
  res.json(usageSnapshot());
});

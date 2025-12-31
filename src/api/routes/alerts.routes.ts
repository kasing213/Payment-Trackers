/**
 * Alerts Routes
 * API endpoints for alert management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { GetPendingAlertsQuery } from '../../application/queries/get-pending-alerts.query';

/**
 * Create Alerts Router
 */
export function createAlertsRouter(
  getPendingAlertsQuery: GetPendingAlertsQuery
): Router {
  const router = Router();

  /**
   * GET /api/alerts/pending
   * Get all pending alerts
   */
  router.get('/pending', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const alerts = await getPendingAlertsQuery.execute();
      res.json({ count: alerts.length, alerts });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/alerts/ar/:ar_id
   * Get alerts for a specific AR
   */
  router.get('/ar/:ar_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const alerts = await getPendingAlertsQuery.executeByAR(req.params.ar_id);
      res.json({ count: alerts.length, alerts });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

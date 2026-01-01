/**
 * AR Routes
 * API endpoints for AR management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { CreateARCommand } from '../../application/commands/create-ar.command';
import { LogFollowUpCommand } from '../../application/commands/log-follow-up.command';
import { VerifyPaymentCommand } from '../../application/commands/verify-payment.command';
import { ChangeDueDateCommand } from '../../application/commands/change-due-date.command';
import { GetARStateQuery } from '../../application/queries/get-ar-state.query';
import { validateRequired, validateDateFields } from '../middleware/validation';
import { ActorType } from '../../domain/events/types';

/**
 * Create AR Router
 */
export function createARRouter(
  createARCommand: CreateARCommand,
  logFollowUpCommand: LogFollowUpCommand,
  verifyPaymentCommand: VerifyPaymentCommand,
  changeDueDateCommand: ChangeDueDateCommand,
  getARStateQuery: GetARStateQuery
): Router {
  const router = Router();

  /**
   * POST /api/ar
   * Create a new AR
   */
  router.post(
    '/',
    validateRequired(['customer_id', 'customer_name', 'amount', 'invoice_date', 'due_date']),
    validateDateFields(['invoice_date', 'due_date']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const ar_id = await createARCommand.execute(req.body);
        res.status(201).json({ ar_id, message: 'AR created successfully' });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * GET /api/ar/:ar_id
   * Get AR state by ID
   */
  router.get('/:ar_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ar = await getARStateQuery.execute(req.params.ar_id);
      if (!ar) {
        res.status(404).json({ error: 'AR not found' });
        return;
      }
      res.json(ar);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/ar/customer/:customer_id
   * Get all ARs for a customer
   */
  router.get('/customer/:customer_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ars = await getARStateQuery.executeByCustomer(req.params.customer_id);
      res.json({ count: ars.length, ars });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/ar/sales/:sales_id
   * Get ARs assigned to a sales person
   */
  router.get('/sales/:sales_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ars = await getARStateQuery.executeBySales(req.params.sales_id);
      res.json({ count: ars.length, ars });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /api/ar/:ar_id/follow-up
   * Log a follow-up note on an AR
   */
  router.post(
    '/:ar_id/follow-up',
    validateRequired(['notes', 'actor_user_id', 'actor_type']),
    validateDateFields(['next_action_date']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await logFollowUpCommand.execute({
          ar_id: req.params.ar_id,
          ...req.body,
        });
        res.json({ message: 'Follow-up logged successfully' });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/ar/:ar_id/verify-payment
   * Verify payment received for an AR
   */
  router.post(
    '/:ar_id/verify-payment',
    validateRequired(['paid_amount', 'payment_date', 'verification_method', 'verified_by']),
    validateDateFields(['payment_date']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await verifyPaymentCommand.execute({
          ar_id: req.params.ar_id,
          ...req.body,
        });
        res.json({ message: 'Payment verified successfully' });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /api/ar/:ar_id/change-due-date
   * Change the due date of an AR (for Excel import updates)
   */
  router.post(
    '/:ar_id/change-due-date',
    validateRequired(['new_due_date']),
    validateDateFields(['new_due_date']),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { ar_id } = req.params;
        const { new_due_date, reason } = req.body;

        await changeDueDateCommand.execute({
          ar_id,
          new_due_date: new Date(new_due_date),
          reason: reason || 'Due date updated via API',
          actor_user_id: 'API_CLIENT',
          actor_type: ActorType.SYSTEM
        });

        res.json({ success: true, ar_id, message: 'Due date changed successfully' });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

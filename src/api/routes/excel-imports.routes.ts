/**
 * Excel Imports Routes
 * API endpoints for Excel import log management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { IExcelImportLogRepository } from '../../domain/repositories/excel-import-log-repository.interface';

/**
 * Create Excel Imports Router
 */
export function createExcelImportsRouter(
  excelImportLogRepository: IExcelImportLogRepository
): Router {
  const router = Router();

  /**
   * POST /api/excel-imports
   * Save import log from local processor
   */
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const importLog = req.body;
      await excelImportLogRepository.save(importLog);
      res.json({ success: true, import_id: importLog.import_id });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/excel-imports/:import_id
   * Get import log by ID
   */
  router.get('/:import_id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { import_id } = req.params;
      const log = await excelImportLogRepository.findById(import_id);

      if (!log) {
        res.status(404).json({ error: 'Import log not found' });
        return;
      }

      res.json(log);
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /api/excel-imports
   * Get recent import logs (last 100)
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const logs = await excelImportLogRepository.findRecent(100);
      res.json({ count: logs.length, logs });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

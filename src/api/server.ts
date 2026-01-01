/**
 * Express Server Setup
 * Configures and creates the Express application
 */

import express, { Application } from 'express';
import { createARRouter } from './routes/ar.routes';
import { createAlertsRouter } from './routes/alerts.routes';
import { createExcelImportsRouter } from './routes/excel-imports.routes';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { apiKeyAuth } from './middleware/auth';

/**
 * Dependencies for server
 */
export interface ServerDependencies {
  createARCommand: any;
  logFollowUpCommand: any;
  verifyPaymentCommand: any;
  changeDueDateCommand: any;
  getARStateQuery: any;
  getPendingAlertsQuery: any;
  excelImportLogRepository: any;
}

/**
 * Create and configure Express server
 */
export function createServer(dependencies: ServerDependencies): Application {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });

  // Health check endpoint (no auth required)
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'ar-event-alert-engine',
    });
  });

  // Apply authentication to all /api/* routes
  app.use('/api', apiKeyAuth);

  // API Routes (all protected by auth middleware)
  app.use(
    '/api/ar',
    createARRouter(
      dependencies.createARCommand,
      dependencies.logFollowUpCommand,
      dependencies.verifyPaymentCommand,
      dependencies.changeDueDateCommand,
      dependencies.getARStateQuery
    )
  );

  app.use(
    '/api/alerts',
    createAlertsRouter(dependencies.getPendingAlertsQuery)
  );

  app.use(
    '/api/excel-imports',
    createExcelImportsRouter(dependencies.excelImportLogRepository)
  );

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

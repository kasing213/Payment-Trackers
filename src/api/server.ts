/**
 * Express Server Setup
 * Configures and creates the Express application
 */

import express, { Application } from 'express';
import { createARRouter } from './routes/ar.routes';
import { createAlertsRouter } from './routes/alerts.routes';
import { errorHandler, notFoundHandler } from './middleware/error-handler';

/**
 * Dependencies for server
 */
export interface ServerDependencies {
  createARCommand: any;
  logFollowUpCommand: any;
  verifyPaymentCommand: any;
  getARStateQuery: any;
  getPendingAlertsQuery: any;
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

  // Health check endpoint
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'ar-event-alert-engine',
    });
  });

  // API Routes
  app.use(
    '/api/ar',
    createARRouter(
      dependencies.createARCommand,
      dependencies.logFollowUpCommand,
      dependencies.verifyPaymentCommand,
      dependencies.getARStateQuery
    )
  );

  app.use(
    '/api/alerts',
    createAlertsRouter(dependencies.getPendingAlertsQuery)
  );

  // 404 handler
  app.use(notFoundHandler);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

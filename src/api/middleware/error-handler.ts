/**
 * Error Handler Middleware
 * Global error handling for Express
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Error response structure
 */
interface ErrorResponse {
  error: string;
  message: string;
  status: number;
  timestamp: string;
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error occurred:', err);

  const status = (err as any).statusCode || 500;
  const message = err.message || 'Internal server error';

  const errorResponse: ErrorResponse = {
    error: err.name || 'Error',
    message,
    status,
    timestamp: new Date().toISOString(),
  };

  res.status(status).json(errorResponse);
}

/**
 * Not found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    status: 404,
    timestamp: new Date().toISOString(),
  });
}

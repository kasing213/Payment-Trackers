/**
 * API Key Authentication Middleware
 * Protects Railway API endpoints from unauthorized access
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to validate API key from X-API-Key header
 * Returns 401 if key is missing or invalid
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.API_KEY;

  if (!expectedKey) {
    console.error('API_KEY not configured in environment');
    res.status(500).json({ error: 'Server misconfigured' });
    return;
  }

  if (!apiKey || apiKey !== expectedKey) {
    res.status(401).json({ error: 'Unauthorized: Invalid API key' });
    return;
  }

  next();
}

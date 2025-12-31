/**
 * Validation Middleware
 * Request validation helpers
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Validate required fields in request body
 */
export function validateRequired(fields: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missingFields: string[] = [];

    for (const field of fields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      res.status(400).json({
        error: 'Validation Error',
        message: `Missing required fields: ${missingFields.join(', ')}`,
        status: 400,
      });
      return;
    }

    next();
  };
}

/**
 * Validate date format
 */
export function validateDateFields(fields: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const invalidFields: string[] = [];

    for (const field of fields) {
      if (req.body[field]) {
        const date = new Date(req.body[field]);
        if (isNaN(date.getTime())) {
          invalidFields.push(field);
        } else {
          // Convert string to Date object
          req.body[field] = date;
        }
      }
    }

    if (invalidFields.length > 0) {
      res.status(400).json({
        error: 'Validation Error',
        message: `Invalid date format for fields: ${invalidFields.join(', ')}`,
        status: 400,
      });
      return;
    }

    next();
  };
}

import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error(err.stack);
  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({
    error: 'Something went wrong!',
    message: isProd ? 'Internal server error' : err.message,
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
  });
}

import { NextFunction, Request, Response } from 'express';

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export function rateLimit({ windowMs, max }: RateLimitOptions) {
  const hits = new Map<string, RateLimitEntry>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= max) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    entry.count += 1;
    return next();
  };
}

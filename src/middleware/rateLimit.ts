import type { Request, RequestHandler } from 'express';

type RateLimitOptions = {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const defaultKeyGenerator = (req: Request): string => {
  return req.ip ?? 'unknown';
};

export const createRateLimiter = (options: RateLimitOptions): RequestHandler => {
  const { windowMs, max, message, keyGenerator = defaultKeyGenerator } = options;
  const entries = new Map<string, RateLimitEntry>();
  let lastCleanup = Date.now();

  const cleanup = (now: number): void => {
    if (now - lastCleanup < windowMs) {
      return;
    }
    for (const [key, entry] of entries.entries()) {
      if (entry.resetAt <= now) {
        entries.delete(key);
      }
    }
    lastCleanup = now;
  };

  return (req, res, next) => {
    const now = Date.now();
    cleanup(now);

    const key = keyGenerator(req);
    const entry = entries.get(key);

    if (!entry || entry.resetAt <= now) {
      const resetAt = now + windowMs;
      entries.set(key, { count: 1, resetAt });
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - 1));
      res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000));
      next();
      return;
    }

    entry.count += 1;
    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader('Retry-After', retryAfterSeconds);
      res.status(429).json({
        data: null,
        error: message ?? 'Too many requests, please try again later.',
      });
      return;
    }

    next();
  };
};

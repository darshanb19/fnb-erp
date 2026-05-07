/**
 * rate-limit.ts — Minimal per-IP in-memory token-bucket rate limiter.
 *
 * Usage:
 *   router.post('/endpoint', rateLimit({ windowMs: 60_000, max: 5 }), handler);
 *
 * Over-limit responses use the §17.5 error envelope:
 *   { code: 'rate_limit.exceeded', message: '...', timestamp }
 *
 * No external dependencies — keeps the install surface minimal.
 * Not persistent across restarts; suitable for single-instance API servers.
 * If horizontal scaling is needed later, swap this for Redis-backed rate limiting.
 */

import type { Request, Response, NextFunction } from 'express';

interface WindowState {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Time window in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed within the window. */
  max: number;
}

/**
 * Returns an Express middleware that enforces per-IP rate limiting.
 * Each call to rateLimit() creates a fresh in-memory window store scoped
 * to that middleware instance — so different routes can have independent limits.
 */
export function rateLimit(options: RateLimitOptions) {
  const { windowMs, max } = options;
  const windows = new Map<string, WindowState>();

  // Periodic cleanup — remove expired windows to prevent unbounded memory growth.
  // Runs every windowMs (lazy: only scheduled on first invocation of the middleware).
  let cleanupScheduled = false;

  function scheduleCleanup(): void {
    if (cleanupScheduled) return;
    cleanupScheduled = true;
    setInterval(() => {
      const now = Date.now();
      for (const [ip, state] of windows.entries()) {
        if (now >= state.resetAt) {
          windows.delete(ip);
        }
      }
    }, windowMs).unref(); // .unref() so the timer doesn't prevent process exit
  }

  return function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    scheduleCleanup();

    const ip =
      (Array.isArray(req.headers['x-forwarded-for'])
        ? req.headers['x-forwarded-for'][0]
        : req.headers['x-forwarded-for']) ??
      req.socket.remoteAddress ??
      'unknown';

    const now = Date.now();
    let state = windows.get(ip);

    if (!state || now >= state.resetAt) {
      state = { count: 0, resetAt: now + windowMs };
      windows.set(ip, state);
    }

    state.count += 1;

    if (state.count > max) {
      res.status(429).json({
        code: 'rate_limit.exceeded',
        message: `Too many requests. Max ${max} per ${windowMs / 1000}s window.`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}

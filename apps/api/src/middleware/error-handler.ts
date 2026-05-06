/**
 * Error handler middleware — Task A2
 *
 * Terminal middleware (4-argument signature) that converts thrown errors
 * into structured JSON envelopes per Master Spec §7.5 / architecture §17.5.
 *
 * Mapping:
 * - AppError subclass → res.status(err.httpStatus).json(err.toEnvelope())
 * - Anything else     → 500 with code 'system.unexpected_error' + console.error
 *
 * Full Sentry wiring deferred to Epic 2. For now, programmer errors are logged
 * to stderr with the request ID for correlation.
 *
 * Architecture §17.11 step 8 / §17.5.
 */

import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/index.js';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.httpStatus).json(err.toEnvelope());
    return;
  }

  // Programmer error or unexpected system failure
  // Log with request ID for correlation. Full Sentry wiring is Epic 2.
  console.error(`[${req.requestId ?? '-'}] Unhandled error:`, err);

  res.status(500).json({
    code: 'system.unexpected_error',
    message: 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  });
}

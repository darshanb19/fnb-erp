/**
 * Request logger middleware — Task A2
 *
 * Emits one structured JSON log line per request:
 *   { requestId, method, url, status, durationMs, timestamp }
 *
 * Full Sentry / tracing integration is deferred to Epic 2.
 * The `req.requestId` UUID is set here so all downstream middleware and
 * error-handler can reference it in log output.
 *
 * Architecture §17.11 step 1.
 */

import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = randomUUID();
  req.requestId = requestId;

  const startedAt = Date.now();

  // Log after response is finished so we capture the final status code
  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const logEntry = {
      requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs,
      timestamp: new Date().toISOString(),
    };
    // Full Sentry wiring deferred to Epic 2; structured console output for now
    console.log(JSON.stringify(logEntry));
  });

  next();
}

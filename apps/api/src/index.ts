/**
 * Express bootstrap — Task A2
 *
 * Middleware chain order (architecture §17.11):
 *   1. Request logger (UUID req.requestId, structured JSON log on finish)
 *   2. CORS (permissive origin:true for dev — production will tighten per config)
 *   3. Body parsing (express.json, 1 MB limit; body-parse failure → ValidationError)
 *   4. /health route (mounted BEFORE auth — used by deploy probes)
 *   5. Auth middleware (JWT verify; attaches req.user)
 *   6. Branded-DB middleware (req.db = brandedDb(brandId))
 *   7. Audit-context middleware (req.auditUserId stash; full txn wiring in Task A5)
 *   8. API routes under /api/v1/*
 *   9. Error handler (terminal)
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { env } from './env.js';
import { requestLoggerMiddleware } from './middleware/request-logger.js';
import { authMiddleware } from './middleware/auth.js';
import { brandedDbMiddleware } from './middleware/branded-db.js';
import { auditContextMiddleware } from './middleware/audit-context.js';
import { errorHandler } from './middleware/error-handler.js';
import { ValidationError } from './errors/index.js';
import { apiRouter } from './routes/index.js';

// ---------------------------------------------------------------------------
// App factory (exported for integration tests)
// ---------------------------------------------------------------------------

export function createApp(): express.Application {
  const app = express();

  // 1. Request logger — attaches req.requestId, logs on finish
  app.use(requestLoggerMiddleware);

  // 2. CORS — permissive for development; production will tighten origin allowlist
  // TODO(Epic 2): Restrict origin to known frontend origins from env config
  app.use(cors({ origin: true, credentials: true }));

  // 3. Body parsing — 1 MB limit; body-parse failures become ValidationErrors
  app.use(
    express.json({
      limit: '1mb',
      // Express calls this when body parsing fails (e.g. malformed JSON)
      verify: (_req, _res, _buf, encoding) => {
        // verify runs synchronously; errors thrown here propagate to next(err)
        // Express will catch and call our error handler
        void encoding; // used to satisfy no-unused-vars
      },
    }),
  );

  // Body-parse error handler (express.json throws a SyntaxError on malformed JSON)
  app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in (err as object)) {
      return next(
        new ValidationError({
          code: 'validation.malformed_body',
          message: 'Request body contains invalid JSON',
        }),
      );
    }
    next(err);
  });

  // 4. /health — mounted BEFORE auth middleware (no token required)
  //    Used by deploy probes and load-balancer health checks.
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, version: '0.0.1', timestamp: new Date().toISOString() });
  });

  // 5. Auth — JWT verify; attaches req.user
  app.use(authMiddleware);

  // 6. Branded-DB — req.db = brandedDb(req.user.brandId)
  app.use(brandedDbMiddleware);

  // 7. Audit-context stub — req.auditUserId stash
  //    Full SET LOCAL wiring in service-layer transactions (Task A5).
  app.use(auditContextMiddleware);

  // 8. Routes under /api/v1/* — 10 MDM resource routers + ping
  app.use('/api/v1', apiRouter);

  // 9. Error handler — terminal; must be last
  app.use(errorHandler);

  return app;
}

// ---------------------------------------------------------------------------
// Boot — skipped when imported by integration tests (NODE_ENV=test)
// ---------------------------------------------------------------------------

// Guard prevents EADDRINUSE when routes.test.ts imports createApp() from this module.
// The test runner sets NODE_ENV=test; in that env we export createApp() but do not start
// the server. The server is only started when this module is the process entry-point.
if (env.NODE_ENV !== 'test') {
  const app = createApp();
  const port = env.PORT;

  app.listen(port, () => {
    console.log(
      JSON.stringify({
        event: 'server_started',
        port,
        nodeEnv: env.NODE_ENV,
        timestamp: new Date().toISOString(),
      }),
    );
  });
}

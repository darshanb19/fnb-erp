/**
 * Audit context middleware — Task A2 (stub)
 *
 * Architecture §17.11 step 6:
 * "SET LOCAL app.user_id = $1" only takes effect within an explicit Postgres
 * transaction. A middleware-level SET LOCAL outside a transaction is a no-op —
 * the session variable is discarded immediately.
 *
 * DEFERRED WIRING:
 * Full transaction-scoped audit context is wired in Task A5 via the
 * `setAuditContext(tx, userId)` helper in `db/with-audit-context.ts`.
 * Services open per-method transactions and call setAuditContext() at the
 * start of each txn body.
 *
 * For Task A2 the middleware stashes `req.user.id` on `req.auditUserId` so
 * service-layer transaction wrappers can consume it without re-deriving from
 * the JWT payload.
 *
 * Architecture §17.11 step 6.
 */

import type { Request, Response, NextFunction } from 'express';

export function auditContextMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // req.user is guaranteed by the preceding auth middleware.
  // Stash actor id for service-layer transaction wrappers to consume via
  // `SET LOCAL app.user_id = ${userId}` inside the txn (with-audit-context.ts).
  req.auditUserId = req.user!.id;
  next();
}

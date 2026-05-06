/**
 * Branded-DB middleware — Task A2
 *
 * Constructs `req.db = brandedDb(req.user.brandId)` and calls next().
 * The resulting db object carries:
 *   - Scoped query methods (scopedInsert, scopedFrom, scopedUpdate, scopedDelete)
 *   - Per-request memoization cache (db.requestCache)
 *   - Raw underlying Drizzle client (db.raw) for non-scoped tables
 *
 * Must be mounted AFTER the auth middleware so req.user is guaranteed present.
 *
 * Architecture §17.11 step 5.
 */

import type { Request, Response, NextFunction } from 'express';
import { brandedDb } from '../db/branded-db.js';

export function brandedDbMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // req.user is guaranteed by the preceding auth middleware.
  // The non-null assertion is safe here because this middleware is always
  // mounted after authMiddleware in the chain.
  const user = req.user!;
  req.db = brandedDb(user.brandId);
  next();
}

/**
 * Express Request augmentation — Task A2
 *
 * Adds type-safe properties attached by the middleware chain:
 * - `user`         — set by auth middleware (JWT verify)
 * - `db`           — set by branded-db middleware (brandedDb factory)
 * - `requestId`    — set by request-logger middleware (UUID per request)
 * - `auditUserId`  — set by audit-context middleware (propagated to txn wrapper)
 */

import type { BrandedDb } from '../db/branded-db.js';
import type { UserRole } from '../db/schema/auth.js';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; brandId: string; role: UserRole };
      db?: BrandedDb;
      requestId?: string;
      auditUserId?: string;
    }
  }
}

export {};

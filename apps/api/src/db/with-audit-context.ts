/**
 * setAuditContext — audit log transaction helper
 *
 * Services call this at the START of every transaction body so that
 * Postgres triggers and audit log inserts can read the actor id via
 * `current_setting('app.user_id')`.
 *
 * Usage (inside a service method's transaction):
 * ```typescript
 * await db.raw.transaction(async (tx) => {
 *   await setAuditContext(tx, req.auditUserId);
 *   // ... service logic
 * });
 * ```
 *
 * Why not in middleware:
 * `SET LOCAL` only takes effect within the current transaction; calling it
 * outside a transaction is silently ignored by Postgres. The middleware
 * (audit-context.ts) stashes the userId on req.auditUserId; each service
 * method opens its own transaction and calls this helper inside it.
 *
 * Architecture §17.11 step 6.
 */

import { sql } from 'drizzle-orm';
import type { DrizzleClient } from './client.js';

/**
 * Transaction type — the object passed inside `db.raw.transaction(async (tx) => ...)`.
 * Using the Parameters utility to extract it from the transaction callback signature.
 */
type Tx = Parameters<Parameters<DrizzleClient['transaction']>[0]>[0];

/**
 * SET LOCAL app.user_id = userId within the current Postgres transaction.
 * Must be called at the start of every transaction body in service methods.
 */
export async function setAuditContext(tx: Tx, userId: string): Promise<void> {
  await tx.execute(sql`SET LOCAL app.user_id = ${userId}`);
}

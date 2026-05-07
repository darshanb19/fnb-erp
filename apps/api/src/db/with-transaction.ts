/**
 * withTransaction — transactional service wrapper.
 *
 * Wraps a service method body in a Postgres transaction and sets the audit-context
 * session variable per architecture §17.11 step 6 + §7.4. The transaction sees
 * `current_setting('app.user_id', true)` for any audit-trigger backstop fired
 * during the txn body.
 *
 * Bridge approach (chosen):
 * The Drizzle transaction callback receives a `PgTransaction` object which extends
 * `PgDatabase` and shares the same structural interface as `DrizzleClient`
 * (both expose `select`, `insert`, `update`, `delete`, `execute`, `transaction`).
 * We bridge via `as unknown as DrizzleClient` — a narrowing cast, not `any`.
 * This is sound because `PgTransaction` is a structural subtype of `DrizzleClient`
 * for all operations used by brandedDb's scoped methods.
 *
 * The resulting `txBrandedDb` is a fully scoped BrandedDb that routes all operations
 * through the transaction client. Callers never see the raw transaction.
 */

import { sql } from 'drizzle-orm';
import { brandedDb, type BrandedDb } from './branded-db.js';
import type { DrizzleClient } from './client.js';

/** The transaction client type: the `tx` argument inside db.raw.transaction(async (tx) => ...). */
type TxClient = Parameters<Parameters<DrizzleClient['transaction']>[0]>[0];

/**
 * Run `fn` inside a Postgres transaction on `db.raw`.
 *
 * - Sets `app.user_id` session variable (for audit trigger backstop, architecture §7.4).
 * - Provides a transaction-scoped `BrandedDb` to the callback so all scoped methods
 *   (scopedInsert, scopedFrom, scopedUpdate, scopedDelete) run inside the transaction.
 * - On error, the transaction is automatically rolled back by Drizzle.
 *
 * @param db          The caller's brandedDb (provides brandId + raw DrizzleClient).
 * @param actorUserId Actor identity for audit context; null for system/seed calls.
 * @param fn          Callback receiving a transaction-scoped BrandedDb.
 */
export async function withTransaction<T>(
  db: BrandedDb,
  actorUserId: string | null,
  fn: (txDb: BrandedDb) => Promise<T>,
): Promise<T> {
  return db.raw.transaction(async (tx: TxClient) => {
    if (actorUserId) {
      // PostgreSQL does not support parameterized placeholders in SET statements.
      // actorUserId originates from our verified JWT (uuid format); validate before
      // embedding to guard against injection from malformed upstream callers.
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRe.test(actorUserId)) {
        throw new Error(`withTransaction: actorUserId "${actorUserId}" is not a valid UUID`);
      }
      // sql.raw() embeds the literal string without parameterisation.
      // Safe because actorUserId has been validated as a UUID above.
      await tx.execute(sql`SET LOCAL app.user_id = ${sql.raw(`'${actorUserId}'`)}`);
    }

    // Bridge: PgTransaction extends PgDatabase and shares the same structural
    // interface as DrizzleClient. The cast is a narrowing from a structural
    // supertype — no runtime behavior change.
    const txBrandedDb = brandedDb(db.brandId, {
      underlyingClient: tx as unknown as DrizzleClient,
    });

    return fn(txBrandedDb);
  });
}

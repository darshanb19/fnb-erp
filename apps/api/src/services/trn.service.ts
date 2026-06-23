/**
 * trnService — Phase 4 Epic 4 INV Arc (a) Task 1.4
 *
 * Atomic TRN (Transaction Reference Number) allocator.
 *
 * Allocates a globally unique, human-readable reference in the format:
 *   {TYPE}-{YYYY}-{LOC}-{NNNNNN}
 *   e.g. GRN-2026-MUM-000001
 *
 * Implementation:
 * - Uses `INSERT … ON CONFLICT DO UPDATE SET next_value = next_value + 1 RETURNING next_value`
 *   inside a withTransaction to atomically upsert-and-increment the counter.
 * - The conflict target is (brand_id, transaction_type, location_code, year).
 * - The first call for a given key inserts with next_value = 1 (default).
 *   Subsequent calls increment and return the new value atomically.
 * - Safe for concurrent callers: the `next_value = next_value + 1` update expression
 *   in the ON CONFLICT clause relies on Postgres row-level locking to serialise
 *   competing INSERTs on the same key within the same transaction isolation level.
 *
 * Design rules honoured:
 * - withTransaction wraps the full body (architecture §17.11).
 * - sql tag used for the atomic increment — no raw string concatenation.
 * - BrandedDb type; zero `any`.
 * - actorUserId is null (system-level allocation; no human actor).
 */

import { sql } from 'drizzle-orm';
import type { BrandedDb } from '../db/branded-db.js';
import { withTransaction } from '../db/with-transaction.js';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface TrnSequenceRow {
  next_value: number;
}

// ---------------------------------------------------------------------------
// trnService
// ---------------------------------------------------------------------------

export const trnService = {
  /**
   * Allocates the next TRN for the given (type, locationCode) pair in the given year.
   *
   * @param db           BrandedDb scoped to the caller's brand.
   * @param type         Transaction type slug (e.g. 'grn', 'st', 'adj'). Uppercased internally.
   * @param locationCode Location code (e.g. 'mum', 'del'). Uppercased internally.
   * @param now          Optional date from which to derive the year. Defaults to new Date().
   * @returns            Formatted TRN string, e.g. 'GRN-2026-MUM-000001'.
   */
  async allocate(
    db: BrandedDb,
    type: string,
    locationCode: string,
    now?: Date,
  ): Promise<string> {
    const effectiveDate = now ?? new Date();
    const year = effectiveDate.getFullYear();
    const typePart = type.toUpperCase();
    const locPart = locationCode.toUpperCase();
    const typeNorm = type.toLowerCase();
    const locNorm = locationCode.toLowerCase();

    const nextValue = await withTransaction(db, null, async (txDb) => {
      // Atomic upsert + increment on trn_sequences.
      //
      // First call (row absent): INSERT inserts with next_value = 1.
      //   The conflict UPDATE fires for row present and increments next_value.
      //   RETURNING next_value returns 1 on first insert (the inserted value).
      //
      // Wait — on INSERT the default is 1. On conflict the UPDATE does next_value + 1.
      // So the RETURNING value after conflict is next_value + 1 (the incremented value).
      // For the very first row: INSERT returns 1.  ✓
      // For the second call: UPDATE sets next_value = 1 + 1 = 2, RETURNING 2.  ✓
      //
      // This pattern means:
      //   - Call 1: INSERT → next_value = 1 → return 1
      //   - Call 2: conflict → UPDATE next_value = 1 + 1 = 2 → return 2
      //   - Call N: conflict → UPDATE next_value = (N-1) + 1 = N → return N
      //
      // Note: brandId is injected from txDb.brandId; we use db.raw (the tx raw client)
      // because brandScopedTable's scopedInsert cannot express ON CONFLICT DO UPDATE.
      // We supply brand_id explicitly with an explicit predicate in the conflict target.

      const rows = await txDb.raw.execute(sql`
        INSERT INTO trn_sequences (brand_id, transaction_type, location_code, year, next_value)
        VALUES (
          ${txDb.brandId}::uuid,
          ${typeNorm},
          ${locNorm},
          ${year},
          1
        )
        ON CONFLICT (brand_id, transaction_type, location_code, year)
        DO UPDATE SET
          next_value = trn_sequences.next_value + 1
        RETURNING next_value
      `);

      const row = (rows as unknown as TrnSequenceRow[])[0];
      if (!row) {
        throw new Error('trnService.allocate: upsert returned no row — this should not happen');
      }
      return row.next_value;
    });

    // Format: {TYPE}-{YYYY}-{LOC}-{NNNNNN} (zero-padded to 6 digits)
    const seq = String(nextValue).padStart(6, '0');
    return `${typePart}-${year}-${locPart}-${seq}`;
  },
};

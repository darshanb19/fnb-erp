/**
 * journalStubService — Epic 10 accounting seam (DL-044 §2).
 *
 * Inserts a single `journal_events` row inside the caller's transaction
 * and returns the generated UUID. Real posting logic, balanced-entry
 * validation, and GL reconciliation are deferred to Epic 10.
 *
 * Contract:
 * - Does NOT open its own transaction (no `withTransaction` call).
 * - Must be called with a BrandedDb that is already inside an active
 *   transaction so the journal row commits atomically with the owning
 *   business write.
 * - The returned id is stored as `journalEventId` on stock_movements
 *   and similar tables for the forward link to Epic 10.
 *
 * Per spec §4.2 + §3.7 (journal_events columns) + DL-044 §2.
 */

import { journalEvents } from '../db/schema/inventory.js';
import type { BrandedDb } from '../db/branded-db.js';

export interface JournalRecordInput {
  /** TRN reference linking this event to the originating transaction. */
  trnReference?: string | null;
  /**
   * Semantic event tag consumed by Epic 10.
   * Examples: 'gr_confirmed', 'production_consumption', 'closing_variance'.
   */
  eventType: string;
  /** GL debit account code — informational stub for Epic 10. */
  debitAccount?: string | null;
  /** GL credit account code — informational stub for Epic 10. */
  creditAccount?: string | null;
  /**
   * Monetary amount. Accepts string or number; stored as numeric(18,4).
   * If a number is passed it is coerced to string to satisfy Drizzle's
   * numeric column expectation explicitly.
   */
  amount?: string | number | null;
  /** UUID of the stock_movement row that triggered this event. */
  sourceMovementId?: string | null;
}

export const journalStubService = {
  /**
   * Insert one `journal_events` row scoped to `db.brandId`.
   * Returns the auto-generated UUID of the inserted row.
   *
   * @param db  - BrandedDb already inside an active transaction.
   * @param input - Event fields; see JournalRecordInput.
   * @returns Promise<string> — the journal_events.id UUID.
   */
  async record(db: BrandedDb, input: JournalRecordInput): Promise<string> {
    const amountValue: string | null =
      input.amount == null
        ? null
        : typeof input.amount === 'number'
          ? String(input.amount)
          : input.amount;

    const rows = await db
      .scopedInsert(journalEvents, {
        trnReference:    input.trnReference ?? null,
        eventType:       input.eventType,
        debitAccount:    input.debitAccount ?? null,
        creditAccount:   input.creditAccount ?? null,
        amount:          amountValue,
        sourceMovementId: input.sourceMovementId ?? null,
        posted:          false,
      } as unknown as Parameters<typeof db.scopedInsert<typeof journalEvents>>[1])
      .returning({ id: journalEvents.id });

    const row = rows[0];
    if (!row) throw new Error('journalStubService.record: scopedInsert returned no row — unexpected');
    return row.id;
  },
};

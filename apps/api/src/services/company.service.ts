/**
 * companyService — FR9 (brand identity, addresses, tax IDs, banking, fiscal) + DL-024.
 *
 * DL-024 invariants:
 *   - Single brand per deployment. NO createCompany method exists here.
 *     Brand bootstrap is apps/api/src/db/seed/brand-seed.ts only.
 *   - Status is a one-way gate: setup_pending → setup_complete.
 *     updateCompany() does NOT accept a `status` field (excluded from CompanyUpdate
 *     at compile-time; runtime guard catches `as any` end-runs).
 *   - markSetupComplete() is the only way to transition status. It is idempotent:
 *     calling on an already-complete brand writes an audit business_action (for
 *     traceability) but does NOT write a second status update.
 *
 * Currency:
 *   - accountingCurrency must be 'INR'. Multi-currency is post-MVP per DL-024 /
 *     Master Spec §1.2. updateCompany() rejects any other value.
 *
 * Audit:
 *   - Every mutation (updateCompany, markSetupComplete) writes an audit_log row
 *     atomically inside the same transaction via withTransaction().
 *   - brands is a SYSTEM table (not brandScopedTable); queries use db.raw / tx.raw.
 *   - auditLogService.record() uses db.scopedInsert (scoped to brand), which is correct
 *     because audit_log IS a brand-scoped table.
 */

import { eq } from 'drizzle-orm';
import { brands, type Brand } from '../db/schema/brand.js';
import type { BrandedDb } from '../db/branded-db.js';
import { withTransaction } from '../db/with-transaction.js';
import { auditLogService } from './audit-log.service.js';
import { ValidationError, NotFoundError } from '../errors/index.js';

// ---------------------------------------------------------------------------
// CompanyUpdate type — excludes immutable + status fields
// ---------------------------------------------------------------------------

/**
 * Caller-supplied fields for a company update.
 * Excludes: id, status (one-way gate — use markSetupComplete), and all audit cols.
 * The omission of `status` is the compile-time half of DL-024 status-revert protection.
 */
export type CompanyUpdate = Partial<
  Omit<typeof brands.$inferInsert, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>
>;

// ---------------------------------------------------------------------------
// Runtime guard for status end-runs
// ---------------------------------------------------------------------------

/**
 * DL-024 runtime guard — throws if `input` contains `status`.
 * Catches end-runs where callers cast their update payload to `any` to bypass
 * the compile-time exclusion of `status` from CompanyUpdate.
 */
function assertNoStatusField(input: object): void {
  if ('status' in input) {
    throw new ValidationError({
      code: 'company.status_revert_blocked',
      message:
        'The status field cannot be changed via updateCompany. ' +
        'Use markSetupComplete() for the one-way setup_pending → setup_complete transition (DL-024).',
    });
  }
}

// ---------------------------------------------------------------------------
// companyService
// ---------------------------------------------------------------------------

export const companyService = {
  /**
   * FR9: Return the single brand row scoped by req.user.brandId (db.brandId).
   * Throws NotFoundError if the brand row is missing — means brand-seed wasn't run.
   */
  async getCompany(db: BrandedDb): Promise<Brand> {
    const rows = await db.raw.select().from(brands).where(eq(brands.id, db.brandId));
    const row = rows[0];
    if (!row) {
      throw new NotFoundError({
        code: 'not_found.company',
        message: 'Brand row not found — was brand-seed run?',
      });
    }
    return row;
  },

  /**
   * FR9: Edit FR9 fields with reason captured in audit_log.
   *
   * Validates:
   *  - accountingCurrency must be 'INR' (multi-currency deferred per DL-024 / Master Spec §1.2).
   *  - `status` field is NOT accepted — throws ValidationError with company.status_revert_blocked.
   *
   * Writes an 'update' audit_log row atomically inside the same transaction.
   */
  async updateCompany(
    db: BrandedDb,
    input: CompanyUpdate,
    opts: { actorUserId: string | null; reason: string },
  ): Promise<Brand> {
    // DL-024 runtime guard: status must not be in input (catches `as any` end-runs)
    assertNoStatusField(input);

    // Multi-currency guard (DL-024 / Master Spec §1.2)
    if (input.accountingCurrency !== undefined && input.accountingCurrency !== 'INR') {
      throw new ValidationError({
        code: 'company.multi_currency_deferred',
        message: 'Multi-currency support is post-MVP. Only INR is allowed.',
      });
    }

    return withTransaction(db, opts.actorUserId, async (tx) => {
      const [before] = await tx.raw.select().from(brands).where(eq(brands.id, db.brandId));
      if (!before) {
        throw new NotFoundError({ code: 'not_found.company', message: 'Brand row missing' });
      }

      const [after] = await tx.raw
        .update(brands)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(brands.id, db.brandId))
        .returning();

      if (!after) {
        throw new NotFoundError({ code: 'not_found.company', message: 'Brand row missing after update' });
      }

      const changedFields = auditLogService.computeChangedFields(
        before as Record<string, unknown>,
        after as Record<string, unknown>,
      );

      await auditLogService.record(tx, {
        action: 'update',
        tableName: 'brands',
        rowId: db.brandId,
        actorUserId: opts.actorUserId,
        before: before as Record<string, unknown>,
        after: after as Record<string, unknown>,
        changedFields,
        reason: opts.reason,
        context: { event: 'company_update' },
      });

      return after;
    });
  },

  /**
   * DL-024 one-way status transition: setup_pending → setup_complete.
   *
   * Idempotent: calling on an already-complete brand is a no-op — returns the row
   * unchanged, but still writes a business_action audit row for traceability.
   *
   * There is NO reverse transition. The compile-time type and the runtime guard in
   * updateCompany both block any attempt to set status back to setup_pending.
   */
  async markSetupComplete(
    db: BrandedDb,
    opts: { actorUserId: string | null; reason: string },
  ): Promise<Brand> {
    return withTransaction(db, opts.actorUserId, async (tx) => {
      const [before] = await tx.raw.select().from(brands).where(eq(brands.id, db.brandId));
      if (!before) {
        throw new NotFoundError({ code: 'not_found.company', message: 'Brand row missing' });
      }

      // Idempotent path: already setup_complete — record audit but do NOT update row.
      if (before.status === 'setup_complete') {
        await auditLogService.record(tx, {
          action: 'business_action',
          tableName: 'brands',
          rowId: db.brandId,
          actorUserId: opts.actorUserId,
          reason: opts.reason,
          context: { event: 'mark_setup_complete', already: true },
        });
        return before;
      }

      // Transition path: setup_pending → setup_complete
      const [after] = await tx.raw
        .update(brands)
        .set({ status: 'setup_complete', updatedAt: new Date() })
        .where(eq(brands.id, db.brandId))
        .returning();

      if (!after) {
        throw new NotFoundError({ code: 'not_found.company', message: 'Brand row missing after update' });
      }

      await auditLogService.record(tx, {
        action: 'business_action',
        tableName: 'brands',
        rowId: db.brandId,
        actorUserId: opts.actorUserId,
        before: { status: 'setup_pending' } as Record<string, unknown>,
        after: { status: 'setup_complete' } as Record<string, unknown>,
        changedFields: ['status'],
        reason: opts.reason,
        context: { event: 'mark_setup_complete' },
      });

      return after;
    });
  },
};

// NOTE — DL-024: NO createCompany method. Single brand per deployment.
// Brand bootstrap is apps/api/src/db/seed/brand-seed.ts only.

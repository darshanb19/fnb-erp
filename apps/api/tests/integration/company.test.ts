/**
 * Integration tests for companyService.
 *
 * Covers:
 *  - FR9: read company details (getCompany)
 *  - FR9: update company details (updateCompany)
 *  - DL-024: no createCompany method — single brand per deployment; brand-seed is the only bootstrap
 *  - DL-024: status one-way transition (setup_pending → setup_complete; no revert)
 *
 * Uses fnberp_test database (set via TEST_DATABASE_URL / DATABASE_URL env).
 * afterEach calls truncateTestTables() to clear audit_log rows.
 * The brands table is NOT truncated — we manipulate the test brand row directly
 * in some tests, then restore it via raw SQL.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { setupIntegration, teardownIntegration, getTestBrandedDb, truncateTestTables } from './setup.js';
import { companyService } from '../../src/services/company.service.js';
import { ValidationError, NotFoundError } from '../../src/errors/index.js';
import { auditLog } from '../../src/db/schema/audit.js';
import { brands } from '../../src/db/schema/brand.js';
import { brandedDb } from '../../src/db/branded-db.js';

beforeAll(async () => {
  await setupIntegration();
});

afterEach(async () => {
  // Restore the test brand row to setup_pending after each test that may have flipped it.
  // Also clears audit_log (and other tables) via truncateTestTables.
  const { db } = getTestBrandedDb();
  await db.raw.update(brands).set({ status: 'setup_pending' }).where(eq(brands.id, db.brandId));
  await truncateTestTables();
});

afterAll(async () => {
  await teardownIntegration();
});

// ---------------------------------------------------------------------------
// FR9 — Read company details
// ---------------------------------------------------------------------------

describe('companyService — FR9 read company details', () => {
  it('getCompany returns the single brand row scoped by db.brandId', async () => {
    const { db, testBrandId } = getTestBrandedDb();
    const company = await companyService.getCompany(db);
    expect(company.id).toBe(testBrandId);
    expect(company.legalName).toBeTruthy();
    expect(company.status).toBeDefined();
  });

  it('throws NotFoundError if brandId does not match any brand row', async () => {
    // Use a random UUID as brandId — no brand row will exist for it.
    const nonExistentBrandId = '00000000-0000-0000-0000-000000000001';
    const fakeDb = brandedDb(nonExistentBrandId);
    await expect(companyService.getCompany(fakeDb)).rejects.toBeInstanceOf(NotFoundError);
  });
});

// ---------------------------------------------------------------------------
// FR9 — Update company details
// ---------------------------------------------------------------------------

describe('companyService — FR9 update company details', () => {
  it('updateCompany updates FR9 fields and writes audit-log row with reason and changedFields', async () => {
    const { db } = getTestBrandedDb();
    const updated = await companyService.updateCompany(
      db,
      { tradingName: 'Wild Sugar', city: 'Mumbai' },
      { actorUserId: null, reason: 'Initial brand setup' },
    );
    expect(updated.tradingName).toBe('Wild Sugar');
    expect(updated.city).toBe('Mumbai');

    // Verify audit log row written
    const auditRows = await (db.scopedFrom(auditLog, eq(auditLog.rowId, db.brandId)) as unknown as Promise<
      (typeof auditLog.$inferSelect)[]
    >);
    expect(auditRows.length).toBe(1);
    const auditRow = auditRows[0];
    expect(auditRow).toBeDefined();
    expect(auditRow?.action).toBe('update');
    expect(auditRow?.reason).toBe('Initial brand setup');
    const changedFields = auditRow?.changedFields as string[] | null;
    expect(Array.isArray(changedFields)).toBe(true);
    expect(changedFields).toContain('tradingName');
    expect(changedFields).toContain('city');
  });

  it('updateCompany updates banking fields', async () => {
    const { db } = getTestBrandedDb();
    const updated = await companyService.updateCompany(
      db,
      {
        bankAccountNumber: '1234567890',
        bankIfsc: 'HDFC0001234',
        bankAccountHolder: 'Wild Sugar Pvt Ltd',
      },
      { actorUserId: null, reason: 'Add banking details' },
    );
    expect(updated.bankAccountNumber).toBe('1234567890');
    expect(updated.bankIfsc).toBe('HDFC0001234');
    expect(updated.bankAccountHolder).toBe('Wild Sugar Pvt Ltd');
  });

  it('updateCompany rejects accounting_currency != INR with company.multi_currency_deferred', async () => {
    const { db } = getTestBrandedDb();
    await expect(
      companyService.updateCompany(
        db,
        { accountingCurrency: 'USD' },
        { actorUserId: null, reason: 'attempt multi-currency' },
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      companyService.updateCompany(
        db,
        { accountingCurrency: 'USD' },
        { actorUserId: null, reason: 'attempt multi-currency' },
      ),
    ).rejects.toMatchObject({ code: 'company.multi_currency_deferred' });
  });
});

// ---------------------------------------------------------------------------
// DL-024 — No createCompany method
// ---------------------------------------------------------------------------

describe('companyService — DL-024 no createCompany method', () => {
  it('companyService has no createCompany key', () => {
    expect((companyService as Record<string, unknown>).createCompany).toBeUndefined();
  });

  // Compile-time check: the @ts-expect-error below must produce a TS error.
  // If createCompany were added to the type, this line would fail the typecheck.
  it('compile-time: createCompany call is a TS error', () => {
    // @ts-expect-error createCompany must not exist on companyService per DL-024
    void companyService.createCompany;
  });
});

// ---------------------------------------------------------------------------
// DL-024 — Status one-way transition
// ---------------------------------------------------------------------------

describe('companyService — DL-024 status one-way transition', () => {
  it('markSetupComplete flips setup_pending → setup_complete and writes business_action audit', async () => {
    const { db } = getTestBrandedDb();

    // Ensure we start at setup_pending
    await db.raw.update(brands).set({ status: 'setup_pending' }).where(eq(brands.id, db.brandId));

    const result = await companyService.markSetupComplete(db, {
      actorUserId: null,
      reason: 'Setup completed',
    });
    expect(result.status).toBe('setup_complete');

    // Verify audit log row written with business_action
    const auditRows = await (db.scopedFrom(auditLog, eq(auditLog.rowId, db.brandId)) as unknown as Promise<
      (typeof auditLog.$inferSelect)[]
    >);
    expect(auditRows.length).toBe(1);
    const auditRow = auditRows[0];
    expect(auditRow?.action).toBe('business_action');
    expect(auditRow?.reason).toBe('Setup completed');
    const context = auditRow?.context as Record<string, unknown> | null;
    expect(context?.['event']).toBe('mark_setup_complete');
    expect(context?.['already']).toBeUndefined();
  });

  it('markSetupComplete on already-complete brand is idempotent (no second status flip; audit row still written)', async () => {
    const { db } = getTestBrandedDb();

    // First call: flip to setup_complete
    await companyService.markSetupComplete(db, { actorUserId: null, reason: 'First call' });

    // Second call: idempotent — still returns setup_complete, writes another audit row with already:true
    const result = await companyService.markSetupComplete(db, {
      actorUserId: null,
      reason: 'Second call — should be idempotent',
    });
    expect(result.status).toBe('setup_complete');

    // Verify the brand was not re-updated
    const brand = await companyService.getCompany(db);
    expect(brand.status).toBe('setup_complete');

    // Two audit rows (one per markSetupComplete call)
    const auditRows = await (db.scopedFrom(auditLog, eq(auditLog.rowId, db.brandId)) as unknown as Promise<
      (typeof auditLog.$inferSelect)[]
    >);
    expect(auditRows.length).toBe(2);
    const idempotentRow = auditRows.find((r) => {
      const ctx = r.context as Record<string, unknown> | null;
      return ctx?.['already'] === true;
    });
    expect(idempotentRow).toBeDefined();
    expect(idempotentRow?.reason).toBe('Second call — should be idempotent');
  });

  it('updateCompany rejects status revert via input.status with company.status_revert_blocked', async () => {
    const { db } = getTestBrandedDb();

    // Force brand to setup_pending
    await db.raw.update(brands).set({ status: 'setup_pending' }).where(eq(brands.id, db.brandId));

    // The input type excludes 'status', but an end-run via `as any` must be blocked at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(
      companyService.updateCompany(
        db,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { status: 'setup_pending' } as any,
        { actorUserId: null, reason: 'try to revert status' },
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(
      companyService.updateCompany(
        db,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { status: 'setup_pending' } as any,
        { actorUserId: null, reason: 'try to revert status' },
      ),
    ).rejects.toMatchObject({ code: 'company.status_revert_blocked' });
  });
});

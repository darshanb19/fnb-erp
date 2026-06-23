/**
 * trn.test.ts — Phase 4 Epic 4 INV Arc (a) Task 1.4
 *
 * Integration tests for trnService.allocate — atomic TRN allocator.
 *
 * Test cases (§7 of design spec):
 *   1. Returns format GRN-2026-MUM-000001 for first call.
 *   2. Two sequential calls return distinct values (000001 then 000002).
 *   3. Two concurrent allocations (Promise.all) yield distinct values (no duplicate TRNs).
 *   4. Year is taken from `now` param when provided (2025-01-01 → 2025 in output).
 *
 * trn_sequences is NOT in the shared truncateTestTables list (that list was
 * written before Epic 4 tables existed). We truncate it in beforeEach directly
 * using db.raw, which is the correct place — not setup.ts, which is shared across
 * all integration tests and should only be modified deliberately.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import {
  setupIntegration,
  teardownIntegration,
  truncateTestTables,
  getTestBrandedDb,
} from './setup.js';
import { trnService } from '../../src/services/trn.service.js';
import type { BrandedDb } from '../../src/db/branded-db.js';

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await setupIntegration();
  await truncateTestTables();
});

afterAll(async () => {
  await teardownIntegration();
});

// ---------------------------------------------------------------------------
// Helper: truncate trn_sequences between tests (not in shared setup)
// ---------------------------------------------------------------------------

let db: BrandedDb;

beforeEach(async () => {
  ({ db } = getTestBrandedDb());
  // Truncate trn_sequences before each test for a clean slate.
  // db.raw gives us direct access to the Drizzle client for this non-brand-scoped op.
  await db.raw.execute(sql`TRUNCATE TABLE trn_sequences RESTART IDENTITY CASCADE`);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('trnService.allocate', () => {
  it('returns GRN-2026-MUM-000001 for the first call', async () => {
    const trn = await trnService.allocate(db, 'grn', 'mum', new Date('2026-01-15'));
    expect(trn).toBe('GRN-2026-MUM-000001');
  });

  it('returns distinct sequential values for two sequential calls', async () => {
    const first = await trnService.allocate(db, 'grn', 'mum', new Date('2026-01-15'));
    const second = await trnService.allocate(db, 'grn', 'mum', new Date('2026-01-15'));
    expect(first).toBe('GRN-2026-MUM-000001');
    expect(second).toBe('GRN-2026-MUM-000002');
  });

  it('two concurrent allocations yield distinct values (no duplicate TRNs)', async () => {
    const now = new Date('2026-01-15');
    const [first, second] = await Promise.all([
      trnService.allocate(db, 'grn', 'mum', now),
      trnService.allocate(db, 'grn', 'mum', now),
    ]);
    // Both must be non-null strings
    expect(typeof first).toBe('string');
    expect(typeof second).toBe('string');
    // They must be distinct
    expect(first).not.toBe(second);
    // Both must match the expected pattern
    expect(first).toMatch(/^GRN-2026-MUM-\d{6}$/);
    expect(second).toMatch(/^GRN-2026-MUM-\d{6}$/);
    // Together they must be 000001 and 000002 (in some order)
    const seqs = [first, second].map((t) => t.split('-')[3]);
    expect(seqs.sort()).toEqual(['000001', '000002']);
  });

  it('uses the year from the provided `now` parameter', async () => {
    const trn = await trnService.allocate(db, 'st', 'del', new Date('2025-06-01'));
    expect(trn).toBe('ST-2025-DEL-000001');
  });

  it('sequences are independent per (type, location, year) combination', async () => {
    const now = new Date('2026-03-01');
    const grn1 = await trnService.allocate(db, 'grn', 'mum', now);
    const st1 = await trnService.allocate(db, 'st', 'mum', now);
    const grn2 = await trnService.allocate(db, 'grn', 'mum', now);
    // GRN-MUM-2026 sequence: 000001, 000002
    expect(grn1).toBe('GRN-2026-MUM-000001');
    expect(grn2).toBe('GRN-2026-MUM-000002');
    // ST-MUM-2026 sequence: 000001 (independent)
    expect(st1).toBe('ST-2026-MUM-000001');
  });
});

/**
 * Integration test setup helpers.
 *
 * Design:
 * - This file is NOT registered as a vitest setupFile, so it does NOT run
 *   for unit tests. It is purely side-effect-free — only exports.
 * - Integration test files import { setupIntegration, getTestBrandedDb, truncateTestTables }
 *   from this module and call them in their own beforeAll / afterEach hooks.
 *
 * Isolation strategy: TRUNCATE between tests (afterEach).
 * Per-test transactional rollback (savepoints) is cleaner but Drizzle 0.36's
 * transaction nesting is not ergonomic. TRUNCATE runs in O(rows-in-test-tables)
 * time which is fast for small fixtures. The brands table is NOT truncated —
 * the test brand row is reused across tests.
 *
 * The setup creates exactly one brand row in fnberp_test and caches its id.
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { brandedDb, type BrandedDb } from '../../src/db/branded-db.js';
import { brands } from '../../src/db/schema/brand.js';
import * as schema from '../../src/db/schema/index.js';

// ---------------------------------------------------------------------------
// Module-level state — populated once by setupIntegration()
// ---------------------------------------------------------------------------

type RawDb = ReturnType<typeof drizzle<typeof schema>>;

let _rawDb: RawDb | undefined;
let _pgClient: ReturnType<typeof postgres> | undefined;
let _testBrandId: string | undefined;

/**
 * Call once in beforeAll() of each integration test file.
 * Idempotent — safe to call multiple times (only initialises once per process).
 */
export async function setupIntegration(): Promise<void> {
  if (_rawDb) return; // already initialised

  const url =
    process.env['TEST_DATABASE_URL'] ??
    process.env['DATABASE_URL'] ??
    'postgresql://darshan@localhost:5432/fnberp_test';

  _pgClient = postgres(url, { max: 5 });
  _rawDb = drizzle(_pgClient, { schema });

  // Idempotent: ensure exactly one brand row exists in fnberp_test.
  const existing = await _rawDb.select().from(brands).limit(1);
  if (existing.length === 0) {
    const [created] = await _rawDb
      .insert(brands)
      .values({ legalName: 'Test Brand', country: 'IN' })
      .returning();
    if (!created) throw new Error('Failed to create test brand row');
    _testBrandId = created.id;
  } else {
    _testBrandId = existing[0]!.id;
  }
}

/**
 * Tear down the postgres connection pool.
 * Call in afterAll() of integration test files, or rely on process exit.
 */
export async function teardownIntegration(): Promise<void> {
  if (_pgClient) {
    await _pgClient.end();
    _pgClient = undefined;
    _rawDb = undefined;
  }
}

/**
 * Returns a BrandedDb scoped to the test brand.
 * Must be called after setupIntegration() has resolved.
 */
export function getTestBrandedDb(): { db: BrandedDb; testBrandId: string } {
  if (!_testBrandId) {
    throw new Error(
      'getTestBrandedDb() called before setupIntegration(). ' +
        'Call await setupIntegration() in your beforeAll() hook.',
    );
  }
  // brandedDb() uses the lazy unscopedDb() from client.ts which reads DATABASE_URL.
  // In the test env, DATABASE_URL is set to fnberp_test by vitest.config.ts.
  const db = brandedDb(_testBrandId);
  return { db, testBrandId: _testBrandId };
}

/**
 * Truncates all test tables except brands (which persists the test brand row).
 * Call in afterEach() to reset state between tests.
 *
 * Tables are truncated in dependency order to satisfy FK constraints:
 * audit_log, inventory leaf tables → inventory parents → stores
 * → departments → locations → clusters → users
 * (brands is intentionally excluded; TRUNCATE CASCADE handles FK cascades).
 */
export async function truncateTestTables(): Promise<void> {
  if (!_rawDb) {
    throw new Error(
      'truncateTestTables() called before setupIntegration(). ' +
        'Call await setupIntegration() in your beforeAll() hook.',
    );
  }
  await _rawDb.execute(sql`
    TRUNCATE TABLE
      audit_log,
      vendors,
      enablement_matrix, product_categories, product_uoms, products, categories, uoms,
      stores,
      departments,
      locations,
      clusters,
      users
    RESTART IDENTITY CASCADE
  `);
}

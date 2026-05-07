/**
 * Integration tests for categoryService.findSimilarByName (DL-026 / DL-034).
 *
 * Mirrors the productService.findSimilarByName test shape:
 *  - returns categories whose name has trigram similarity >= threshold
 *  - excludes the candidate row when excludeId is supplied
 *  - returns empty array when no matches above threshold
 *
 * Closes the deferred gap from Epic 1 chrome-freeze review: the third DL-026
 * CC-DUPLICATE-WARN consumer (the Categories page in apps/web) needs this
 * service method to wire up in Arc (c).
 *
 * Uses fnberp_test database. Each test runs against a clean slate via
 * truncateTestTables() in afterEach.
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { setupIntegration, teardownIntegration, getTestBrandedDb, truncateTestTables } from './setup.js';
import { categoryService } from '../../src/services/category.service.js';

beforeAll(async () => {
  await setupIntegration();
});

afterEach(async () => {
  await truncateTestTables();
});

afterAll(async () => {
  await teardownIntegration();
});

// ---------------------------------------------------------------------------
// DL-026 / DL-034 findSimilarByName
// ---------------------------------------------------------------------------

describe('categoryService — DL-026 findSimilarByName', () => {
  it('returns categories whose name has trigram similarity >= threshold (default 0.85)', async () => {
    const { db } = getTestBrandedDb();
    const target = await categoryService.createCategory(
      db,
      { name: 'Dairy & Eggs', parentId: null },
      { actorUserId: null },
    );
    await categoryService.createCategory(
      db,
      { name: 'Frozen Goods', parentId: null },
      { actorUserId: null },
    );

    // Search with the exact same name — should find 'Dairy & Eggs'
    const results = await categoryService.findSimilarByName(db, 'Dairy & Eggs');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.id === target.id)).toBe(true);
    // Each result has a sim score >= default threshold (0.85)
    expect(results.every((r) => r.sim >= 0.85)).toBe(true);
  });

  it('excludes the candidate row when excludeId is supplied', async () => {
    const { db } = getTestBrandedDb();
    const cat = await categoryService.createCategory(
      db,
      { name: 'Dairy & Eggs', parentId: null },
      { actorUserId: null },
    );

    const results = await categoryService.findSimilarByName(db, 'Dairy & Eggs', {
      threshold: 0.85,
      excludeId: cat.id,
    });
    expect(results.every((r) => r.id !== cat.id)).toBe(true);
  });

  it('returns empty array when no matches above threshold', async () => {
    const { db } = getTestBrandedDb();
    await categoryService.createCategory(
      db,
      { name: 'Dairy & Eggs', parentId: null },
      { actorUserId: null },
    );

    const results = await categoryService.findSimilarByName(db, 'Totally Unrelated Name XYZ', {
      threshold: 0.85,
    });
    expect(results.length).toBe(0);
  });
});

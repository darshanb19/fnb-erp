/**
 * Unit tests for brandScopedTable helper — DL-015 verification.
 *
 * These tests verify in-process metadata structures WITHOUT opening a DB connection.
 * SQL correctness is verified by Drizzle Kit when migrations are generated (Task A3+).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { text, integer } from 'drizzle-orm/pg-core';
import { getTableName } from 'drizzle-orm';

// Import the helper AND the registries under test
import {
  brandScopedTable,
  brandScopedTableRegistry,
  auditTriggerRegistry,
  compositeIndexRegistry,
} from '../../src/db/brand-scoped-table.js';

// ---------------------------------------------------------------------------
// Helpers to snapshot registry state before/after calls
// (registries are module-level singletons; we inspect their state)
// ---------------------------------------------------------------------------

describe('brandScopedTable — column injection', () => {
  it('injects standard columns: id, brandId, createdAt, updatedAt, createdBy, updatedBy', () => {
    const things = brandScopedTable('bst_test_things', {
      name: text('name').notNull(),
    });

    const cols = things;
    // Standard columns present
    expect(cols).toHaveProperty('id');
    expect(cols).toHaveProperty('brandId');
    expect(cols).toHaveProperty('createdAt');
    expect(cols).toHaveProperty('updatedAt');
    expect(cols).toHaveProperty('createdBy');
    expect(cols).toHaveProperty('updatedBy');
    // Caller column present
    expect(cols).toHaveProperty('name');
  });

  it('brandId column is not-null', () => {
    const items = brandScopedTable('bst_items_nullable_check', {
      label: text('label').notNull(),
    });

    // Access the underlying column definition via the Drizzle column object
    const brandIdCol = items.brandId;
    // Drizzle column objects expose notNull on their config
    expect(brandIdCol.notNull).toBe(true);
  });

  it('table name is preserved', () => {
    const tbl = brandScopedTable('bst_name_check', {
      code: text('code'),
    });
    expect(getTableName(tbl)).toBe('bst_name_check');
  });
});

describe('brandScopedTable — registry population', () => {
  it('registers table name in brandScopedTableRegistry after call', () => {
    expect(brandScopedTableRegistry.has('bst_registry_target')).toBe(false);

    brandScopedTable('bst_registry_target', {
      val: integer('val'),
    });

    expect(brandScopedTableRegistry.has('bst_registry_target')).toBe(true);
  });

  it('does NOT register in auditTriggerRegistry without auditTrigger: true', () => {
    brandScopedTable('bst_no_audit', {
      val: text('val'),
    });

    expect(auditTriggerRegistry.has('bst_no_audit')).toBe(false);
  });

  it('registers in auditTriggerRegistry when auditTrigger: true', () => {
    brandScopedTable('bst_recipes_test', {
      title: text('title'),
    }, { auditTrigger: true });

    expect(auditTriggerRegistry.has('bst_recipes_test')).toBe(true);
  });

  it('does NOT register in auditTriggerRegistry when auditTrigger is false', () => {
    brandScopedTable('bst_no_audit_explicit', {
      val: text('val'),
    }, { auditTrigger: false });

    expect(auditTriggerRegistry.has('bst_no_audit_explicit')).toBe(false);
  });
});

describe('brandScopedTable — composite index options', () => {
  it('records composite index columns in compositeIndexRegistry', () => {
    brandScopedTable('bst_production_orders', {
      locationId: text('location_id'),
    }, {
      indexes: {
        brandLocation: ['brand_id', 'location_id'],
      },
    });

    const indexes = compositeIndexRegistry.get('bst_production_orders');
    expect(indexes).toBeDefined();
    expect(indexes).toEqual(expect.arrayContaining([
      ['brand_id', 'location_id'],
    ]));
  });

  it('records multiple composite indexes for the same table', () => {
    brandScopedTable('bst_multi_idx', {
      locationId: text('location_id'),
      status: text('status'),
    }, {
      indexes: {
        brandLocation: ['brand_id', 'location_id'],
        brandStatus: ['brand_id', 'status'],
      },
    });

    const indexes = compositeIndexRegistry.get('bst_multi_idx');
    expect(indexes).toBeDefined();
    expect(indexes?.length).toBe(2);
  });

  it('does not populate compositeIndexRegistry when no indexes option given', () => {
    brandScopedTable('bst_no_composite', {
      foo: text('foo'),
    });

    expect(compositeIndexRegistry.has('bst_no_composite')).toBe(false);
  });
});

describe('brandScopedTable — users table (from schema/auth.ts)', () => {
  it('users is registered in brandScopedTableRegistry', async () => {
    // Importing auth.ts triggers brandScopedTable('users', ..., { auditTrigger: true })
    await import('../../src/db/schema/auth.js');
    expect(brandScopedTableRegistry.has('users')).toBe(true);
  });

  it('users is registered in auditTriggerRegistry', async () => {
    await import('../../src/db/schema/auth.js');
    expect(auditTriggerRegistry.has('users')).toBe(true);
  });
});

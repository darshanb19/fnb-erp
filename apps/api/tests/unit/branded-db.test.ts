/**
 * Unit tests for brandedDb factory — DL-012 verification.
 *
 * Tests verify SHAPE-LEVEL and BEHAVIOURAL contract WITHOUT a live DB.
 * Strategy: pass a stub underlying client via options.underlyingClient.
 * The stub records what it receives so we can assert on interception.
 *
 * NOTE: brandedDb uses explicit scoped methods (scopedInsert / scopedFrom /
 * scopedUpdate / scopedDelete) rather than a transparent Proxy over the Drizzle
 * API. This decision was made because Drizzle's generic-heavy insert/update/delete
 * builders make type-safe interception impossible without `any`. See branded-db.ts.
 */

import { describe, it, expect } from 'vitest';
import { text } from 'drizzle-orm/pg-core';
import { pgTable } from 'drizzle-orm/pg-core';
import { brandedDb } from '../../src/db/branded-db.js';
import { brandScopedTable, brandScopedTableRegistry } from '../../src/db/brand-scoped-table.js';
import type { DrizzleClient } from '../../src/db/client.js';

// ---------------------------------------------------------------------------
// Test data: one org-scoped table + one system/plain table
// ---------------------------------------------------------------------------

const TEST_BRAND_ID = '00000000-0000-0000-0000-000000000001';

// Use unique names to avoid registry collisions with other tests
const scopedTable = brandScopedTable('bdt_scoped_orders', {
  trn: text('trn').notNull(),
});

const plainTable = pgTable('bdt_plain_configs', {
  key: text('key').notNull(),
  value: text('value'),
});

// Sanity: assert test setup is correct
if (!brandScopedTableRegistry.has('bdt_scoped_orders')) {
  throw new Error('Test setup error: bdt_scoped_orders not registered');
}
if (brandScopedTableRegistry.has('bdt_plain_configs')) {
  throw new Error('Test setup error: bdt_plain_configs should NOT be registered');
}

// ---------------------------------------------------------------------------
// Minimal stub client factory
// ---------------------------------------------------------------------------

/**
 * Extract Drizzle table name using the Symbol key.
 * Mirrors what getTableName() does internally.
 */
function extractTableName(table: unknown): string {
  if (table && typeof table === 'object') {
    const name = (table as Record<symbol, unknown>)[Symbol.for('drizzle:Name')];
    if (typeof name === 'string') return name;
  }
  return 'unknown';
}

/**
 * Creates a minimal stub of DrizzleClient where operations are recorded.
 * Returns stubs that look like Drizzle builders with chainable methods.
 */
function makeStubClient() {
  let lastInsertValues: unknown = undefined;
  let lastInsertTable: string | undefined;
  let lastSelectFromTable: string | undefined;
  let lastSelectWhere: unknown = undefined;
  let lastUpdateTable: string | undefined;
  let lastUpdateSet: unknown = undefined;
  let lastUpdateWhere: unknown = undefined;
  let lastDeleteTable: string | undefined;
  let lastDeleteWhere: unknown = undefined;

  function makeInsertBuilder(tableName: string) {
    return {
      values(v: unknown) {
        lastInsertValues = v;
        lastInsertTable = tableName;
        return {
          returning() { return this; },
          onConflictDoNothing() { return this; },
          execute() { return Promise.resolve([]); },
          then(resolve: (v: unknown[]) => void) { resolve([]); return this; },
        };
      },
    };
  }

  function makeFromBuilder(tableName: string) {
    lastSelectFromTable = tableName;
    return {
      where(cond: unknown) {
        lastSelectWhere = cond;
        return this;
      },
      limit() { return this; },
      orderBy() { return this; },
      execute() { return Promise.resolve([]); },
      then(resolve: (v: unknown[]) => void) { resolve([]); return this; },
    };
  }

  function makeSelectBuilder() {
    return {
      from(table: unknown) {
        return makeFromBuilder(extractTableName(table));
      },
    };
  }

  function makeSetBuilder(tableName: string) {
    return {
      where(cond: unknown) {
        lastUpdateWhere = cond;
        return {
          execute() { return Promise.resolve([]); },
          then(resolve: (v: unknown[]) => void) { resolve([]); return this; },
        };
      },
    };
  }

  function makeUpdateBuilder(tableName: string) {
    return {
      set(v: unknown) {
        lastUpdateTable = tableName;
        lastUpdateSet = v;
        return makeSetBuilder(tableName);
      },
    };
  }

  function makeDeleteBuilder(tableName: string) {
    return {
      where(cond: unknown) {
        lastDeleteTable = tableName;
        lastDeleteWhere = cond;
        return {
          execute() { return Promise.resolve([]); },
          then(resolve: (v: unknown[]) => void) { resolve([]); return this; },
        };
      },
    };
  }

  const stub = {
    select(..._args: unknown[]) {
      return makeSelectBuilder();
    },
    insert(table: unknown) {
      return makeInsertBuilder(extractTableName(table));
    },
    update(table: unknown) {
      return makeUpdateBuilder(extractTableName(table));
    },
    delete(table: unknown) {
      return makeDeleteBuilder(extractTableName(table));
    },
    $with: () => ({ as: () => ({}) }),
    $count: () => ({}),

    // Accessors for assertions
    get _lastInsertValues() { return lastInsertValues; },
    get _lastInsertTable() { return lastInsertTable; },
    get _lastSelectFromTable() { return lastSelectFromTable; },
    get _lastSelectWhere() { return lastSelectWhere; },
    get _lastUpdateTable() { return lastUpdateTable; },
    get _lastUpdateSet() { return lastUpdateSet; },
    get _lastUpdateWhere() { return lastUpdateWhere; },
    get _lastDeleteTable() { return lastDeleteTable; },
    get _lastDeleteWhere() { return lastDeleteWhere; },
  };

  return stub;
}

// ---------------------------------------------------------------------------
// Tests — shape
// ---------------------------------------------------------------------------

describe('brandedDb — shape', () => {
  it('returns an object with .scopedInsert, .scopedFrom, .scopedUpdate, .scopedDelete, .raw', () => {
    const db = brandedDb(TEST_BRAND_ID, {
      underlyingClient: makeStubClient() as unknown as DrizzleClient,
    });

    expect(typeof db.scopedInsert).toBe('function');
    expect(typeof db.scopedFrom).toBe('function');
    expect(typeof db.scopedUpdate).toBe('function');
    expect(typeof db.scopedDelete).toBe('function');
    expect(typeof db.raw).toBe('object');
  });

  it('exposes .brandId equal to the provided brandId', () => {
    const db = brandedDb(TEST_BRAND_ID, {
      underlyingClient: makeStubClient() as unknown as DrizzleClient,
    });
    expect(db.brandId).toBe(TEST_BRAND_ID);
  });

  it('exposes .requestCache as a Map<string, unknown>', () => {
    const db = brandedDb(TEST_BRAND_ID, {
      underlyingClient: makeStubClient() as unknown as DrizzleClient,
    });
    expect(db.requestCache).toBeInstanceOf(Map);
    db.requestCache.set('test-key', 42);
    expect(db.requestCache.get('test-key')).toBe(42);
  });

  it('each brandedDb call gets its own independent requestCache', () => {
    const db1 = brandedDb(TEST_BRAND_ID, {
      underlyingClient: makeStubClient() as unknown as DrizzleClient,
    });
    const db2 = brandedDb(TEST_BRAND_ID, {
      underlyingClient: makeStubClient() as unknown as DrizzleClient,
    });
    db1.requestCache.set('k', 'v1');
    expect(db2.requestCache.has('k')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests — scopedInsert
// ---------------------------------------------------------------------------

describe('brandedDb — scopedInsert on org-scoped table', () => {
  it('throws when caller explicitly provides brandId (camelCase)', () => {
    const stub = makeStubClient();
    const db = brandedDb(TEST_BRAND_ID, {
      underlyingClient: stub as unknown as DrizzleClient,
    });

    expect(() => {
      db.scopedInsert(scopedTable, {
        trn: 'TRN-001',
        brandId: 'caller-supplied-brand', // should throw
      } as Parameters<typeof db.scopedInsert>[1]);
    }).toThrow(/brand/i);
  });

  it('throws when caller explicitly provides brand_id (snake_case)', () => {
    const stub = makeStubClient();
    const db = brandedDb(TEST_BRAND_ID, {
      underlyingClient: stub as unknown as DrizzleClient,
    });

    expect(() => {
      db.scopedInsert(scopedTable, {
        trn: 'TRN-002',
        // eslint-disable-next-line camelcase
        brand_id: 'caller-supplied-brand',
      } as Parameters<typeof db.scopedInsert>[1]);
    }).toThrow(/brand/i);
  });

  it('auto-injects brandId into the row payload', () => {
    const stub = makeStubClient();
    const db = brandedDb(TEST_BRAND_ID, {
      underlyingClient: stub as unknown as DrizzleClient,
    });

    db.scopedInsert(scopedTable, { trn: 'TRN-003' });

    const received = stub._lastInsertValues as Record<string, unknown>;
    expect(received).toBeDefined();
    expect(received['brandId']).toBe(TEST_BRAND_ID);
    expect(received['trn']).toBe('TRN-003');
  });

  it('auto-injects brandId into every row in a batch', () => {
    const stub = makeStubClient();
    const db = brandedDb(TEST_BRAND_ID, {
      underlyingClient: stub as unknown as DrizzleClient,
    });

    db.scopedInsert(scopedTable, [
      { trn: 'TRN-A' },
      { trn: 'TRN-B' },
    ]);

    const received = stub._lastInsertValues as Record<string, unknown>[];
    expect(Array.isArray(received)).toBe(true);
    for (const row of received) {
      expect(row['brandId']).toBe(TEST_BRAND_ID);
    }
  });

  it('throws when called on a non-scoped (plain pgTable) table', () => {
    const stub = makeStubClient();
    const db = brandedDb(TEST_BRAND_ID, {
      underlyingClient: stub as unknown as DrizzleClient,
    });

    expect(() => {
      db.scopedInsert(
        plainTable as unknown as Parameters<typeof db.scopedInsert>[0],
        { key: 'k' } as Parameters<typeof db.scopedInsert>[1],
      );
    }).toThrow(/not in brandScopedTableRegistry/i);
  });
});

// ---------------------------------------------------------------------------
// Tests — scopedFrom (SELECT)
// ---------------------------------------------------------------------------

describe('brandedDb — scopedFrom on org-scoped table', () => {
  it('calls .select().from(table).where(brandFilter)', () => {
    const stub = makeStubClient();
    const db = brandedDb(TEST_BRAND_ID, {
      underlyingClient: stub as unknown as DrizzleClient,
    });

    db.scopedFrom(scopedTable);

    expect(stub._lastSelectFromTable).toBe('bdt_scoped_orders');
    // .where() was called with the brand filter
    expect(stub._lastSelectWhere).toBeDefined();
  });

  it('throws when called on a non-scoped table', () => {
    const stub = makeStubClient();
    const db = brandedDb(TEST_BRAND_ID, {
      underlyingClient: stub as unknown as DrizzleClient,
    });

    expect(() => {
      db.scopedFrom(plainTable);
    }).toThrow(/not in brandScopedTableRegistry/i);
  });
});

// ---------------------------------------------------------------------------
// Tests — scopedUpdate
// ---------------------------------------------------------------------------

describe('brandedDb — scopedUpdate on org-scoped table', () => {
  it('ANDs brand_id into the WHERE clause via .set().where()', () => {
    const stub = makeStubClient();
    const db = brandedDb(TEST_BRAND_ID, {
      underlyingClient: stub as unknown as DrizzleClient,
    });

    db.scopedUpdate(scopedTable).set({ trn: 'TRN-UPDATED' }).where();

    expect(stub._lastUpdateTable).toBe('bdt_scoped_orders');
    expect(stub._lastUpdateSet).toEqual({ trn: 'TRN-UPDATED' });
    expect(stub._lastUpdateWhere).toBeDefined();
  });

  it('returns a ScopedUpdateBuilder', () => {
    const stub = makeStubClient();
    const db = brandedDb(TEST_BRAND_ID, {
      underlyingClient: stub as unknown as DrizzleClient,
    });

    const builder = db.scopedUpdate(scopedTable);
    // ScopedUpdateBuilder exposes .set()
    expect(typeof builder.set).toBe('function');
  });

  it('throws when called on a non-scoped table', () => {
    const stub = makeStubClient();
    const db = brandedDb(TEST_BRAND_ID, {
      underlyingClient: stub as unknown as DrizzleClient,
    });

    expect(() => {
      db.scopedUpdate(plainTable);
    }).toThrow(/not in brandScopedTableRegistry/i);
  });
});

// ---------------------------------------------------------------------------
// Tests — scopedDelete
// ---------------------------------------------------------------------------

describe('brandedDb — scopedDelete on org-scoped table', () => {
  it('ANDs brand_id into the WHERE clause', () => {
    const stub = makeStubClient();
    const db = brandedDb(TEST_BRAND_ID, {
      underlyingClient: stub as unknown as DrizzleClient,
    });

    db.scopedDelete(scopedTable).where();

    expect(stub._lastDeleteTable).toBe('bdt_scoped_orders');
    expect(stub._lastDeleteWhere).toBeDefined();
  });

  it('returns a ScopedDeleteBuilder', () => {
    const stub = makeStubClient();
    const db = brandedDb(TEST_BRAND_ID, {
      underlyingClient: stub as unknown as DrizzleClient,
    });

    const builder = db.scopedDelete(scopedTable);
    expect(typeof builder.where).toBe('function');
  });

  it('throws when called on a non-scoped table', () => {
    const stub = makeStubClient();
    const db = brandedDb(TEST_BRAND_ID, {
      underlyingClient: stub as unknown as DrizzleClient,
    });

    expect(() => {
      db.scopedDelete(plainTable);
    }).toThrow(/not in brandScopedTableRegistry/i);
  });
});

/**
 * brandedDb — DL-012
 *
 * Factory that returns a query builder with automatic brand_id scoping for
 * org-scoped tables (declared via brandScopedTable, registered in brandScopedTableRegistry).
 *
 * Design decision (Phase 4 Epic 1):
 * After exploring the transparent Proxy approach, Drizzle's generic-heavy
 * insert/update/delete builders make type-safe Proxy interception require `any`
 * to satisfy the variance constraints. Per plan §7c fallback guidance, we
 * expose EXPLICIT scoped methods: `scopedInsert`, `scopedFrom`, `scopedUpdate`,
 * `scopedDelete`. Service-layer code uses these; non-scoped operations use
 * `db.raw` (the underlying Drizzle client directly).
 *
 * Scoped method contracts:
 * - scopedInsert(table, rows)  — injects brand_id; throws if caller passes it.
 * - scopedFrom(table)          — SELECT with brand_id filter pre-applied.
 * - scopedUpdate(table)        — ScopedUpdateBuilder: .set().where() ANDs brand filter.
 * - scopedDelete(table)        — ScopedDeleteBuilder: .where() ANDs brand filter.
 *
 * Non-scoped tables: use `db.raw.select()/insert()/update()/delete()` directly.
 * Bypass: unscopedDb() — migrations + bootstrap only; service code forbidden.
 */

import { eq, and, type SQL } from 'drizzle-orm';
import { getTableName } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { InferInsertModel } from 'drizzle-orm';
import { brandScopedTableRegistry } from './brand-scoped-table.js';
import { unscopedDb, type DrizzleClient } from './client.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Symbol used by Drizzle to mark table objects. */
const IsDrizzleTable = Symbol.for('drizzle:IsDrizzleTable');

/**
 * Type-guard: true when `value` is a Drizzle table (has IsDrizzleTable Symbol).
 */
export function isDrizzleTable(value: unknown): value is PgTable {
  return (
    value !== null &&
    typeof value === 'object' &&
    IsDrizzleTable in (value as object)
  );
}

function assertRegistered(table: PgTable): void {
  const name = getTableName(table);
  if (!brandScopedTableRegistry.has(name)) {
    throw new Error(
      `brandedDb: table "${name}" is not in brandScopedTableRegistry. ` +
        `Use db.raw for non-scoped tables.`,
    );
  }
}

/**
 * Returns the brand_id column SQL expression from an org-scoped PgTable.
 * brandScopedTable always names it `brandId` (JS camelCase key → brand_id SQL column).
 */
function getBrandIdColumn(table: PgTable): SQL {
  const col = (table as unknown as Record<string, unknown>)['brandId'];
  if (!col) {
    throw new Error(
      `brandedDb: table "${getTableName(table)}" is registered as org-scoped but ` +
        `has no "brandId" column. This is a schema bug.`,
    );
  }
  return col as SQL;
}

// ---------------------------------------------------------------------------
// Row type helper — exclude brandId from caller-supplied insert rows
// ---------------------------------------------------------------------------

/**
 * Insert row type for scoped tables: caller supplies everything EXCEPT brandId.
 * The wrapper injects brandId automatically.
 */
export type ScopedInsertRow<T extends PgTable> = Omit<InferInsertModel<T>, 'brandId'>;

// ---------------------------------------------------------------------------
// ScopedUpdateBuilder
// ---------------------------------------------------------------------------

/**
 * Wraps Drizzle's update builder so that brand_id filter is ANDed automatically.
 * Service code: `db.scopedUpdate(table).set(values).where(eq(table.status, 'active'))`
 */
export class ScopedUpdateBuilder<T extends PgTable> {
  readonly #builder: ReturnType<DrizzleClient['update']>;
  readonly #brandFilter: SQL;

  constructor(builder: ReturnType<DrizzleClient['update']>, brandFilter: SQL) {
    this.#builder = builder;
    this.#brandFilter = brandFilter;
  }

  set(values: Parameters<ReturnType<DrizzleClient['update']>['set']>[0]) {
    const afterSet = this.#builder.set(values);
    const brandFilter = this.#brandFilter;

    return {
      /**
       * WHERE clause with additional condition (ANDed with brand_id filter).
       * Omit `condition` to update by brand_id only.
       */
      where(condition?: SQL) {
        const combined = condition ? and(brandFilter, condition) : brandFilter;
        return afterSet.where(combined);
      },
    };
  }
}

// ---------------------------------------------------------------------------
// ScopedDeleteBuilder
// ---------------------------------------------------------------------------

/**
 * Wraps Drizzle's delete builder so that brand_id filter is ANDed automatically.
 * Service code: `db.scopedDelete(table).where(eq(table.id, id))`
 */
export class ScopedDeleteBuilder {
  readonly #builder: ReturnType<DrizzleClient['delete']>;
  readonly #brandFilter: SQL;

  constructor(builder: ReturnType<DrizzleClient['delete']>, brandFilter: SQL) {
    this.#builder = builder;
    this.#brandFilter = brandFilter;
  }

  /**
   * WHERE clause with additional condition (ANDed with brand_id filter).
   * Omit `condition` to delete by brand_id only.
   */
  where(condition?: SQL) {
    const combined = condition ? and(this.#brandFilter, condition) : this.#brandFilter;
    return this.#builder.where(combined);
  }
}

// ---------------------------------------------------------------------------
// BrandedDb public interface
// ---------------------------------------------------------------------------

export interface BrandedDb {
  readonly brandId: string;
  readonly requestCache: Map<string, unknown>;

  /**
   * Raw underlying Drizzle client.
   * Use for non-scoped tables (e.g. brands) or when you need full Drizzle API.
   * NEVER use for org-scoped tables without adding brand_id filter manually.
   */
  readonly raw: DrizzleClient;

  /**
   * INSERT into an org-scoped table.
   * - Injects brand_id automatically.
   * - Throws if any row supplies brandId / brand_id explicitly.
   * - Throws if the table is not registered (i.e. not brandScopedTable).
   */
  scopedInsert<T extends PgTable>(
    table: T,
    rows: ScopedInsertRow<T> | ScopedInsertRow<T>[],
  ): ReturnType<ReturnType<DrizzleClient['insert']>['values']>;

  /**
   * SELECT from an org-scoped table with brand_id filter pre-applied.
   * Returns a Drizzle select builder (supports .where(), .orderBy(), .limit(), etc.)
   * and is directly awaitable — resolves to the selected rows.
   *
   * Optional `condition` is ANDed with the brand_id filter.
   * Use it for simple single-condition queries; chain .where() on the result
   * for complex multi-condition queries.
   *
   * NOTE: Joins with other org-scoped tables need manual brand_id filters.
   * Cross-table scoping is not auto-applied (Phase 4 Epic 1 limitation).
   */
  scopedFrom<T extends PgTable>(
    table: T,
    condition?: SQL,
  ): ReturnType<ReturnType<DrizzleClient['select']>['from']>;

  /**
   * UPDATE an org-scoped table.
   * Returns a ScopedUpdateBuilder whose .where() ANDs brand_id automatically.
   */
  scopedUpdate<T extends PgTable>(table: T): ScopedUpdateBuilder<T>;

  /**
   * DELETE from an org-scoped table.
   * Returns a ScopedDeleteBuilder whose .where() ANDs brand_id automatically.
   */
  scopedDelete<T extends PgTable>(table: T): ScopedDeleteBuilder;
}

// ---------------------------------------------------------------------------
// brandedDb factory
// ---------------------------------------------------------------------------

export function brandedDb(
  brandId: string,
  options?: { underlyingClient?: DrizzleClient },
): BrandedDb {
  const inner = options?.underlyingClient ?? unscopedDb();
  const requestCache = new Map<string, unknown>();

  const db: BrandedDb = {
    brandId,
    requestCache,
    raw: inner,

    scopedInsert<T extends PgTable>(
      table: T,
      rows: ScopedInsertRow<T> | ScopedInsertRow<T>[],
    ): ReturnType<ReturnType<DrizzleClient['insert']>['values']> {
      assertRegistered(table);

      const rowArray = Array.isArray(rows) ? rows : [rows];

      // Reject if caller supplied brand_id
      for (const row of rowArray) {
        const r = row as Record<string, unknown>;
        if ('brandId' in r || 'brand_id' in r) {
          throw new Error(
            `brandedDb: scopedInsert caller must not supply "brandId" or "brand_id" — ` +
              `the brandedDb wrapper owns that field. Remove it from the row payload.`,
          );
        }
      }

      // Inject brandId into every row and cast to satisfy Drizzle's insert model.
      // We use `as unknown as InferInsertModel<T>[]` because ScopedInsertRow<T>
      // is `Omit<InferInsertModel<T>, 'brandId'>` + we inject brandId, making it
      // structurally equivalent — but TypeScript can't infer this across the Omit gap.
      const injected = rowArray.map((row) => ({
        ...(row as Record<string, unknown>),
        brandId,
      })) as unknown as InferInsertModel<T>[];

      if (injected.length === 1) {
        return inner.insert(table).values(injected[0] as InferInsertModel<T>);
      }
      return inner.insert(table).values(injected);
    },

    scopedFrom<T extends PgTable>(
      table: T,
      condition?: SQL,
    ): ReturnType<ReturnType<DrizzleClient['select']>['from']> {
      assertRegistered(table);
      const brandIdCol = getBrandIdColumn(table);
      const brandFilter = eq(brandIdCol, brandId);
      // Combine brand_id filter with optional caller-supplied condition.
      const combined = condition ? and(brandFilter, condition) : brandFilter;
      // .from(table) returns a PgSelect; .where() narrows it further.
      // We use `as unknown as ...` to bridge the generic variance gap between
      // `from(T)` and the return type `ReturnType<ReturnType<DrizzleClient['select']>['from']>`.
      return inner
        .select()
        .from(table)
        .where(combined) as unknown as ReturnType<ReturnType<DrizzleClient['select']>['from']>;
    },

    scopedUpdate<T extends PgTable>(table: T): ScopedUpdateBuilder<T> {
      assertRegistered(table);
      const brandIdCol = getBrandIdColumn(table);
      const brandFilter = eq(brandIdCol, brandId);
      return new ScopedUpdateBuilder<T>(inner.update(table), brandFilter);
    },

    scopedDelete<T extends PgTable>(table: T): ScopedDeleteBuilder {
      assertRegistered(table);
      const brandIdCol = getBrandIdColumn(table);
      const brandFilter = eq(brandIdCol, brandId);
      return new ScopedDeleteBuilder(inner.delete(table), brandFilter);
    },
  };

  return db;
}

/**
 * brandScopedTable — DL-015
 *
 * Wraps Drizzle's pgTable to:
 * 1. Inject standard columns: id, brand_id (FK → brands.id), created_at, updated_at,
 *    created_by, updated_by (FK → users.id).
 * 2. Build a single-column brand_id index (or composite when explicitly declared).
 * 3. Register the table name in brandScopedTableRegistry (consumed by brandedDb wrapper).
 * 4. Optionally register in auditTriggerRegistry for the 4 critical DL-013 tables.
 * 5. Record composite index specs in compositeIndexRegistry for migration tooling.
 */

import {
  pgTable,
  uuid,
  timestamp,
  boolean,
  index,
} from 'drizzle-orm/pg-core';
import type { PgColumnBuilderBase, PgTableWithColumns, ExtraConfigColumn } from 'drizzle-orm/pg-core';
import type { BuildColumns, BuildExtraConfigColumns } from 'drizzle-orm/column-builder';
import { brands } from './schema/brand.js';

// ---------------------------------------------------------------------------
// Module-level registries
// ---------------------------------------------------------------------------

/** All table names registered via brandScopedTable. Consumed by brandedDb. */
export const brandScopedTableRegistry = new Set<string>();

/** Table names that require audit triggers (DL-013 critical tables). */
export const auditTriggerRegistry = new Set<string>();

/**
 * Composite index registry.
 * Key: table name. Value: array of column-name arrays (each inner array = one index).
 */
export const compositeIndexRegistry = new Map<string, string[][]>();

// ---------------------------------------------------------------------------
// Standard column builders
// ---------------------------------------------------------------------------

/**
 * Standard columns injected into every brandScopedTable.
 * brand_id FK uses a thunk reference to brands.id to avoid circular imports.
 */
function standardColumns() {
  return {
    id: uuid('id').primaryKey().defaultRandom(),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // created_by / updated_by: FK to users.id.
    // users is itself a brandScopedTable, so we can't import it here without
    // creating a circular dep. The FK is declared at DB level via migration
    // hand-edits (Task A3). Here we emit the UUID column; Task A3 adds the FK.
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
  } as const;
}

// ---------------------------------------------------------------------------
// Options type
// ---------------------------------------------------------------------------

export interface BrandScopedTableOptions {
  /**
   * Composite index declarations.
   * Key: a logical name (used as index name suffix).
   * Value: ordered array of column names included in the composite index.
   *
   * Example: { brandLocation: ['brand_id', 'location_id'] }
   */
  indexes?: Record<string, string[]>;
  /**
   * When true, the table is registered in auditTriggerRegistry.
   * Use for DL-013 critical tables (users, products, recipes, purchase_orders).
   */
  auditTrigger?: boolean;
}

// ---------------------------------------------------------------------------
// Return-type alias
// ---------------------------------------------------------------------------

/**
 * The type returned by brandScopedTable.
 * We merge the standard columns with the caller-supplied columns and let
 * Drizzle's BuildColumns do the heavy lifting.
 */
type StandardColumnsMap = ReturnType<typeof standardColumns>;

type BrandScopedTableResult<
  TName extends string,
  TUserColumns extends Record<string, PgColumnBuilderBase>,
> = PgTableWithColumns<{
  name: TName;
  schema: undefined;
  columns: BuildColumns<TName, StandardColumnsMap & TUserColumns, 'pg'>;
  dialect: 'pg';
}>;

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Declares an org-scoped Drizzle table.
 *
 * @param name   SQL table name (snake_case).
 * @param columns  Caller-supplied column builders (brand_id / standard cols are injected automatically).
 * @param options  Optional composite-index declarations and audit-trigger opt-in.
 */
export function brandScopedTable<
  TName extends string,
  TUserColumns extends Record<string, PgColumnBuilderBase>,
>(
  name: TName,
  columns: TUserColumns,
  options?: BrandScopedTableOptions,
): BrandScopedTableResult<TName, TUserColumns> {
  const std = standardColumns();
  const merged = { ...std, ...columns } as StandardColumnsMap & TUserColumns;

  // Build indexes for the extraConfig callback
  const table = pgTable(
    name,
    merged,
    (self: BuildExtraConfigColumns<TName, StandardColumnsMap & TUserColumns, 'pg'>) => {
      // Base brand_id index — always present unless caller declares a composite that covers brand_id
      const idxList = [];

      if (options?.indexes && Object.keys(options.indexes).length > 0) {
        // Composite indexes — one per entry
        for (const [idxKey, cols] of Object.entries(options.indexes)) {
          const idxName = `idx_${name}_${idxKey}`;
          // Map column names to table column references
          // We cast self to a plain Record to access columns by string name.
          // The values are ExtraConfigColumn instances (what .on() expects).
          const selfRecord = self as Record<string, ExtraConfigColumn>;
          const colRefs = cols.map((colName) => {
            const col = selfRecord[colName];
            if (!col) {
              throw new Error(
                `brandScopedTable: composite index "${idxName}" references unknown column "${colName}" on table "${name}"`,
              );
            }
            return col;
          });
          const [first, ...rest] = colRefs;
          if (!first) {
            throw new Error(`brandScopedTable: composite index "${idxName}" must have at least one column`);
          }
          idxList.push(index(idxName).on(first, ...rest));
        }
      } else {
        // Single-column brand_id index
        idxList.push(
          index(`idx_${name}_brand_id`).on(self.brandId),
        );
      }

      return idxList;
    },
  );

  // ---------------------------------------------------------------------------
  // Register in module-level Sets/Maps
  // ---------------------------------------------------------------------------
  brandScopedTableRegistry.add(name);

  if (options?.auditTrigger === true) {
    auditTriggerRegistry.add(name);
  }

  if (options?.indexes) {
    const existing = compositeIndexRegistry.get(name) ?? [];
    for (const cols of Object.values(options.indexes)) {
      existing.push(cols);
    }
    compositeIndexRegistry.set(name, existing);
  }

  return table as unknown as BrandScopedTableResult<TName, TUserColumns>;
}

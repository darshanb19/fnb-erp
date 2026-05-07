import { uuid, text, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { brandScopedTable } from '../brand-scoped-table.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const locationTypeEnum = pgEnum('location_type_enum', [
  'central_kitchen',
  'pos_outlet',
  'brand_store',
  'cluster_store',
]);

export const departmentTypeEnum = pgEnum('department_type_enum', [
  'production',
  'dispatch',
  'non_production',
  'store',
]);

// ---------------------------------------------------------------------------
// clusters
// ---------------------------------------------------------------------------

export const clusters = brandScopedTable('clusters', {
  name: text('name').notNull(),
  contactPerson: text('contact_person'),
  contactPhone: text('contact_phone'),
  address: text('address'),
  active: boolean('active').notNull().default(true),
});

// ---------------------------------------------------------------------------
// locations — DL-022: clusterId is IMMUTABLE post-creation.
// ON DELETE RESTRICT — re-parenting requires deactivate + recreate per DL-022;
// never modify cluster_id post-insert. Service layer enforces in TypeScript types
// + runtime guard.
// ---------------------------------------------------------------------------

export const locations = brandScopedTable(
  'locations',
  {
    clusterId: uuid('cluster_id')
      .notNull()
      .references(() => clusters.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    type: locationTypeEnum('type').notNull(),
    address: text('address'),
    active: boolean('active').notNull().default(true),
  },
  {
    indexes: { brandCluster: ['brandId', 'clusterId'] },
  },
);

// ---------------------------------------------------------------------------
// departments — DL-022: locationId is IMMUTABLE post-creation.
// ---------------------------------------------------------------------------

export const departments = brandScopedTable(
  'departments',
  {
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    code: text('code'),
    type: departmentTypeEnum('type').notNull(),
    active: boolean('active').notNull().default(true),
  },
  {
    indexes: { brandLocation: ['brandId', 'locationId'] },
  },
);

// ---------------------------------------------------------------------------
// stores — raw material storage per Master Spec §2.3 — Brand and Cluster level only.
// (Location-level stores would conflict with the Department-of-type='store' surface.)
// CHECK constraint (level IN ('brand','cluster')) added via hand-edit in 0001 migration.
// CHECK constraint (level/cluster_id consistency) also added in 0001 migration.
// ---------------------------------------------------------------------------

export const stores = brandScopedTable('stores', {
  level: text('level').notNull(),  // 'brand' | 'cluster' — CHECK constraint in 0001 migration
  clusterId: uuid('cluster_id').references(() => clusters.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  active: boolean('active').notNull().default(true),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type Cluster = typeof clusters.$inferSelect;
export type NewCluster = typeof clusters.$inferInsert;
export type Location = typeof locations.$inferSelect;
export type NewLocation = typeof locations.$inferInsert;
export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;

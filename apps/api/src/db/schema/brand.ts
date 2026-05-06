import {
  pgTable,
  uuid,
  text,
  smallint,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core';

/**
 * `brands` is a SYSTEM table — it IS the brand reference anchor.
 * It must NOT be a brandScopedTable (that would create a circular FK).
 * All org-scoped tables carry brand_id → brands.id (emitted by brandScopedTable helper).
 */
export const brands = pgTable('brands', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Identity
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),

  // Fiscal year configuration (FR9)
  fiscalYearStartMonth: smallint('fiscal_year_start_month').notNull().default(4), // April
  fiscalYearStartDay: smallint('fiscal_year_start_day').notNull().default(1),
  accountingCurrency: text('accounting_currency').notNull().default('INR'),
  timezone: text('timezone').notNull().default('Asia/Kolkata'),

  // Status
  status: text('status').notNull().default('active'), // 'active' | 'suspended' | 'archived'

  // [PLACEHOLDER] per Master Spec §6.5 — will be expanded with proper validation in a later epic
  gstin: text('gstin'),
  pan: text('pan'),

  // Standard audit columns (created_by / updated_by nullable for seed rows on system table)
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by'), // nullable FK to users.id — circular dep resolved at DB level
  updatedBy: uuid('updated_by'), // nullable FK to users.id
});

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;

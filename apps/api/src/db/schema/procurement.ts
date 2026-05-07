/**
 * Procurement domain schema — Phase 4 Epic 1 Arc (a) Task A8
 *
 * Tables: vendors (vendors-only; PO/GR tables deferred to Epic 5)
 *
 * Decisions bound:
 * - DL-026: Trigram index on vendors.name for CC-DUPLICATE-WARN
 * - Master Spec §2.7: Vendor scope mutation logic (brand > cluster > pos hierarchy)
 * - Master Spec §6.5: GSTIN / PAN are [PLACEHOLDER] — stored as raw text; tax-module in a later epic
 *
 * Deferred to Epic 5: purchase_orders, goods_receipts, purchase_order_items.
 */

import { uuid, text, integer, numeric, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { brandScopedTable } from '../brand-scoped-table.js';
import { clusters, locations } from './org.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const vendorScopeEnum = pgEnum('vendor_scope_enum', ['brand', 'cluster', 'pos']);
export const vendorPaymentModeEnum = pgEnum('vendor_payment_mode_enum', ['cash', 'bank_transfer', 'cheque']);

// ---------------------------------------------------------------------------
// vendors
// Unique per (brand_id, code) — composite unique constraint added in 0005_procurement_constraints.sql
// Trigram index on name — added in 0005_procurement_constraints.sql (DL-026 CC-DUPLICATE-WARN)
// Scope consistency CHECK constraint — added in 0005_procurement_constraints.sql (§2.7)
// Quality rating range CHECK constraint — added in 0005_procurement_constraints.sql
// ---------------------------------------------------------------------------

export const vendors = brandScopedTable('vendors', {
  code: text('code').notNull(),                    // 'VEND-{SEQUENCE}' or user-supplied code
  name: text('name').notNull(),

  // §2.7 scope hierarchy: brand > cluster > pos
  // Exactly one of (brand, cluster+clusterId, pos+locationId) is active at any time.
  // Consistency CHECK constraint enforced in 0005_procurement_constraints.sql.
  scope: vendorScopeEnum('scope').notNull(),
  scopeClusterId: uuid('scope_cluster_id').references(() => clusters.id, { onDelete: 'restrict' }),
  scopeLocationId: uuid('scope_location_id').references(() => locations.id, { onDelete: 'restrict' }),

  // Tax IDs — [PLACEHOLDER] per Master Spec §6.5 (tax module in a later epic)
  gstin: text('gstin'),
  pan: text('pan'),

  // Contact
  contactPerson: text('contact_person'),
  contactPhone: text('contact_phone'),
  contactEmail: text('contact_email'),
  street: text('street'),
  city: text('city'),
  postalCode: text('postal_code'),
  state: text('state'),

  // Commerce
  creditTermsDays: integer('credit_terms_days'),
  paymentMode: vendorPaymentModeEnum('payment_mode'),
  preferred: boolean('preferred').notNull().default(false),
  qualityRating: numeric('quality_rating', { precision: 3, scale: 2 }),  // 1.00–5.00; CHECK in migration

  active: boolean('active').notNull().default(true),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;

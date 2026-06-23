/**
 * approval_chains — Phase 4 Epic 3 INF Arc (a) Task A1.
 *
 * BRAND-SCOPED. Configurable approval chains per FR16 and DL-036.
 *
 * One chain per (brand_id, entity_type, name). Multiple chains per entity_type
 * are allowed (e.g., a brand may have separate PO chains by category in
 * future); the routing engine picks the matching chain by entity_type +
 * value-band.
 *
 * `steps` jsonb shape: Array<{
 *   stepIndex: number;
 *   role: UserRole;
 *   valueBandMin?: number;
 *   valueBandMax?: number;
 *   escalationTimeoutMinutes: number;
 *   fallbackDelegateUserId?: string;
 * }>
 *
 * `lastModifiedAt` / `lastModifiedBy` capture the BO-driven chain edits
 * (the user-meaningful "this chain was last tuned by …" history per
 * DL-036). They are intentionally distinct from the helper-injected
 * `updatedAt` / `updatedBy` (which fire on any row mutation, including
 * system-driven status flips like draft→active).
 */

import { pgEnum, text, jsonb, timestamp, uuid } from 'drizzle-orm/pg-core';
import { brandScopedTable } from '../brand-scoped-table.js';
import { users } from './auth.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const approvalChainStatusEnum = pgEnum('approval_chain_status', [
  'draft',
  'active',
  'inactive',
]);

export const approvalChainEntityTypeEnum = pgEnum('approval_chain_entity_type', [
  'po_threshold',
  'gr_shelf_life_exception',
  'recipe_default_change',
  'bo_self_creation',
  'inventory_adjustment',
  'b2b_credit_limit_change',
  'stock_transfer',
]);

// ---------------------------------------------------------------------------
// approval_chains
// ---------------------------------------------------------------------------

export const approvalChains = brandScopedTable('approval_chains', {
  entityType: approvalChainEntityTypeEnum('entity_type').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  steps: jsonb('steps').notNull(),
  status: approvalChainStatusEnum('status').notNull().default('draft'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  lastModifiedBy: uuid('last_modified_by')
    .notNull()
    .references(() => users.id),
  lastModifiedAt: timestamp('last_modified_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type ApprovalChain = typeof approvalChains.$inferSelect;
export type NewApprovalChain = typeof approvalChains.$inferInsert;
export type ApprovalChainStatus = (typeof approvalChainStatusEnum.enumValues)[number];
export type ApprovalChainEntityType =
  (typeof approvalChainEntityTypeEnum.enumValues)[number];

export interface ApprovalChainStep {
  stepIndex: number;
  /** UserRole — kept as string in jsonb so role enum changes don't break old chains. */
  role: string;
  valueBandMin?: number;
  valueBandMax?: number;
  escalationTimeoutMinutes: number;
  fallbackDelegateUserId?: string;
}

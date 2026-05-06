/**
 * users — minimal stub for Task A1.
 *
 * `users` is a DL-013 critical table (audit trigger required) AND carries brand_id
 * (multi-brand user accounts are distinguished by brand_id, not just email).
 * Full RBAC enum, MFA fields, etc. land in Epic 2.
 *
 * NOTE: created_by / updated_by FKs to users.id cannot be declared inline here
 * because users IS the target table. The circular FK is handled at DB level via
 * a migration hand-edit in Task A3 (deferred FK pattern).
 */

import { text, boolean } from 'drizzle-orm/pg-core';
import { brandScopedTable } from '../brand-scoped-table.js';

export const users = brandScopedTable(
  'users',
  {
    email: text('email').notNull().unique(),
    fullName: text('full_name'),
    // Simplified role — full RBAC enum lands in Epic 2
    role: text('role').notNull().default('store_manager'),
    active: boolean('active').notNull().default(true),
  },
  {
    auditTrigger: true,
  },
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

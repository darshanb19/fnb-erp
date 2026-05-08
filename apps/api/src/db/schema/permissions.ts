/**
 * permissions — Phase 4 Epic 2 USR Arc (a) Task A3.
 *
 * !! GLOBAL (NON-BRAND-SCOPED) TABLE !!
 *
 * Rationale: permissions are an application-level catalog (FR15a). Every brand
 * sees the same set of permission keys — they are properties of the codebase,
 * not of any tenant. Adding `brand_id` would mean copy-pasting the catalog per
 * brand and require N inserts on every code-side permission addition. Instead
 * we keep ONE row per permission key, globally.
 *
 * This is the FIRST global table in the codebase. Reads are unrestricted (any
 * authenticated user needs to look up permission metadata); writes are
 * service-role-only (Drizzle migrations + Epic-by-epic seeds per DL-032). RLS
 * is therefore not required — the service-role-only access pattern handles it.
 *
 * Seeding: NOT done in this task. DL-032 mandates incremental seeding per epic
 * — Task A4 seeds the Epic 1 (MDM) + Epic 2 (USR) catalog; later epics extend.
 *
 * Key shape: 'module.resource.action' or 'module.resource.action.scope'
 * (e.g. 'mdm.products.read', 'usr.users.read.cluster'). The `key` column is
 * the canonical application-side identifier and is uniquely indexed.
 *
 * (module, action, scope) tuple is intentionally NOT unique: many permissions
 * share the same triple while differing on resource (e.g. mdm.products.read
 * and mdm.vendors.read both have module=mdm, action=read, scope=brand). The
 * `key` uniqueness is the only guard against accidental duplicates — which
 * is the canonical application-side identifier anyway.
 */

import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const permissions = pgTable(
  'permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    module: text('module').notNull(),
    action: text('action').notNull(),
    scope: text('scope').notNull(),
    key: text('key').notNull().unique(),
    description: text('description').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;

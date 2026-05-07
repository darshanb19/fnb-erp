# Phase 4 Epic 2 — User Management & Security (USR) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Epic 2 USR — full RBAC, 8 SI-USR screens, the DL-029 dev-stub-to-Supabase-Auth swap, and the DL-026 third-consumer cleanup — across the Phase 4 3-arc structure (backend → mockups → frontend).

**Architecture:** Express + Drizzle service-layer RBAC enforcement; permissions catalog + role baselines + per-user overrides (FR15a/b/c); Supabase Auth for login/session; **unchanged** JWT verification path on apps/api; **identical** `useSession()` consumer surface on apps/web; permissions catalog populated incrementally per epic (DL-032).

**Tech Stack:** TypeScript strict, Drizzle ORM, Postgres (via Supabase), Express, React 18, Vite, TanStack Query, Zod, `@supabase/supabase-js`, pg_trgm, Playwright, Vitest. Lucide icons only. Inter font only. DESIGN.md tokens only (zero hex).

**Spec:** `docs/superpowers/specs/2026-05-08-phase-4-epic-2-usr-design.md` — single source of truth for scope, decisions, and rationale. Re-read at the start of every arc-execution chat.

---

## 1. Inputs (locked — do not reopen)

- **Spec.** `docs/superpowers/specs/2026-05-08-phase-4-epic-2-usr-design.md`. Reflects user-approved decisions DL-030 (SI-USR-008 build now route-only), DL-031 (MFA/SSO/custom-role-builder post-MVP), DL-032 (incremental permissions catalog), DL-033 (DL-029 swap is single-commit big-bang), DL-034 (categoryService.findSimilarByName closure).
- **CLAUDE.md** — read at every session start. Critical rules (TypeScript strict, brand_id filter, Drizzle no raw SQL, DESIGN tokens, Approval Engine via Epic 3, Notification Center via Epic 3, `inventoryService.checkEnablement` on stock movement) apply unchanged.
- **Phase 4 invariants.** Per-epic 3-arc structure; chrome-freeze gate at end of each epic; Tier 1 deferred-hero tag (applies to SI-USR-002, SI-USR-003, SI-USR-006); phase-boundary discipline (claude.md `## Current phase` line updated same-commit at C11).
- **Epic 1 plan as shape reference.** `docs/superpowers/plans/2026-05-07-phase-4-epic-1-mdm-build.md` (1395 lines, 35 tasks). Mirror its task granularity + commit cadence.
- **Existing code surfaces.** `apps/api/src/middleware/auth.ts`, `apps/api/src/db/schema/auth.ts`, `apps/web/src/lib/auth.ts`, `mockups/src/shell/index.ts` (25 shells), `apps/api/src/services/categoryService.ts`. All read during brainstorming.
- **DL-026 deferred gap.** Epic 1 chrome-freeze review at `docs/superpowers/reviews/2026-05-07-epic-1-mdm-chrome-freeze-review.md` flagged categoryService.findSimilarByName as the single open gap. Closed in Task A2.

---

## 2. Output

At the end of execution:

- **Arc (a) PR — backend.** Branch `phase-4/epic-2-usr-arc-a-backend`. Schema expansion + 4 new tables + 5 new services + RBAC middleware + REST routes + integration tests against fnberp_dev. Supabase Mumbai project provisioned (cost gate). categoryService.findSimilarByName extended.
- **Arc (b) PR — mockups.** Branch `phase-4/epic-2-usr-arc-b-mockups`. 8 SI-USR mockup screens + CC-PERMISSION-OVERRIDE-MGMT shell (+ CC-ROLE-BADGE if promoted).
- **Arc (c) PR — frontend.** Branch `phase-4/epic-2-usr-arc-c-frontend`. 8 production pages + DL-029 swap + Epic 1 RBAC audit + DL-026 third-consumer wiring + chrome-freeze review.
- **Decision-log update.** DL-030 → DL-034 written to `decision-log.md` on the planning branch (this plan's commit) before any arc starts.
- **Phase boundary update.** `claude.md` `## Current phase` line updated at C11 to reflect Epic 2 ✅ DONE + Epic 3 INF as next entry point.

---

## 3. File structure (locked at plan time)

### 3.1 Backend (`apps/api/`)

```
apps/api/src/db/schema/
  auth.ts                          (EXPAND: full users schema; new role enum; approval_status; scope FKs)
  permissions.ts                   (NEW: global permissions catalog)
  role-permissions.ts              (NEW: global role-baseline mapping)
  user-permission-overrides.ts     (NEW: brand-scoped FR15a/b/c overrides)
  index.ts                         (export new tables)

apps/api/src/db/migrations/
  0007_<timestamp>_epic2_usr.sql           (drizzle-kit generated; users expansion + 3 new tables + indexes)
  0008_<timestamp>_seed_permissions.sql    (hand-authored seed: permissions catalog + role_permissions)

apps/api/src/services/
  userService.ts                   (NEW)
  roleService.ts                   (NEW)
  permissionService.ts             (NEW)
  permissionOverrideService.ts     (NEW)
  passwordResetService.ts          (NEW; thin Supabase wrapper)
  categoryService.ts               (EXTEND: findSimilarByName — DL-034)

apps/api/src/middleware/
  auth.ts                          (TIGHTEN: require role claim; remove 'viewer' fallback)
  rbac.ts                          (NEW: requirePermission factory)

apps/api/src/routes/
  users.ts                         (NEW: SI-USR-001/002/008 endpoints)
  permissions.ts                   (NEW: SI-USR-005/006/007 endpoints)
  auth.ts                          (NEW: password reset endpoints)
  index.ts                         (mount new route groups)

apps/api/src/errors/
  index.ts                         (EXTEND: add auth.permission_denied + auth.role_missing codes)

apps/api/tests/integration/
  users.test.ts                    (NEW)
  permissions.test.ts              (NEW)
  permission-overrides.test.ts     (NEW)
  password-reset.test.ts           (NEW)
  rbac-middleware.test.ts          (NEW)
  category-find-similar.test.ts    (NEW; DL-034)
```

### 3.2 Mockups (`mockups/`)

```
mockups/src/screens/usr/
  SI-USR-001.tsx                   (User List & Filter)
  SI-USR-002.tsx                   (User Create / Edit; Tier 1)
  SI-USR-003.tsx                   (Login; Tier 1; responsive-equal)
  SI-USR-004.tsx                   (Self-Service Password Reset; responsive-equal)
  SI-USR-005.tsx                   (User Effective Permissions View)
  SI-USR-006.tsx                   (Permission Grant / Revoke Flow; Tier 1)
  SI-USR-007.tsx                   (Overrides Expiring Soon)
  SI-USR-008.tsx                   (Brand Owner Account Approval; per DL-030)

mockups/src/shell/
  CCPermissionOverrideMgmt.tsx     (NEW)
  CCRoleBadge.tsx                  (NEW; promote at B6 if >=3 surfaces)
  index.ts                         (re-exports)

mockups/src/screens/index.tsx      (UPDATE: route the 8 new screens)
```

### 3.3 Production frontend (`apps/web/`)

```
apps/web/src/lib/
  auth.ts                          (REPLACE: real Supabase; DL-029 swap; DL-033)
  supabase.ts                      (NEW: shared Supabase client)
  RequireAuth.tsx                  (EXTEND: composable with permission/role guards)
  RequirePermission.tsx            (NEW)
  RequireRole.tsx                  (NEW)
  query-keys.ts                    (EXTEND: add usr.* + permissions.* keys)

apps/web/src/components/shell/
  CCPermissionOverrideMgmt.tsx     (copy-port from mockups; DL-005)
  CCRoleBadge.tsx                  (copy-port from mockups; DL-005, if shipped)
  index.ts                         (re-exports)

apps/web/src/pages/usr/
  UsersPage.tsx                    (SI-USR-001 + SI-USR-002 list+route-form)
  UserCreateEditPage.tsx           (SI-USR-002 dedicated route)
  LoginPage.tsx                    (SI-USR-003)
  PasswordResetPage.tsx            (SI-USR-004; two-step)
  EffectivePermissionsPage.tsx     (SI-USR-005)
  PermissionOverridePage.tsx       (SI-USR-006; grant|revoke|edit)
  OverridesExpiringPage.tsx        (SI-USR-007)
  AccountApprovalPage.tsx          (SI-USR-008; route-only, no nav link)

apps/web/src/hooks/
  useUsers.ts
  usePermissions.ts
  usePermissionOverrides.ts
  useRoles.ts
  useEffectivePermissions.ts

apps/web/src/pages/mdm/
  *.tsx                            (RBAC audit pass: replace ad-hoc role checks)

apps/web/.env.example              (UPDATE: SUPABASE_URL, SUPABASE_ANON_KEY)
apps/api/.env.example              (UPDATE: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET)

apps/web/e2e/
  auth.spec.ts                     (NEW: login, password reset, session expiry)
  users.spec.ts                    (NEW: SI-USR-001/002 happy + RBAC denial)
  permission-overrides.spec.ts     (NEW: SI-USR-005/006/007 happy + audit assertion)
```

### 3.4 Cross-cutting docs to update at end of Arc (c)

```
claude.md                          (## Current phase line — Epic 2 ✅ DONE; Epic 3 INF next)
codebase-inventory.md              (extend with apps/api/src/services/usr-* + apps/web/src/pages/usr/)
docs/superpowers/reviews/2026-05-08-epic-2-usr-chrome-freeze-review.md  (Task C10)
decision-log.md                    (DL-030 → DL-034 — written to planning branch BEFORE arcs start, not at C11)
```

---

## 4. Arc (a) — Backend

Run order: A0 → A1 → (A2 || A3) → A4 → A5 → A6 → A7 → A8. A2 (categoryService DL-034 closure) is independent of A1 and can run in parallel after A0.

### Task A0: Verify monorepo state (skip if already verified)

**Files:** none (read-only).

- [ ] **Step 1: Confirm Epic 1 state.** Run from repo root:

  ```bash
  ls apps/api/src/db/schema/ apps/web/src/pages/mdm/ packages/shared/src/ 2>&1
  cat apps/api/package.json | grep -E '"name"|"drizzle"' | head -5
  cat apps/web/package.json | grep -E '"name"|"react"|"@tanstack/react-query"' | head -5
  ```

  Expected: Epic 1's 7 schema files exist (audit, auth, brand, inventory, org, procurement, index); 7 MDM pages exist; packages/shared exists; apps/api drizzle-orm pinned; apps/web React 18 + TanStack Query pinned.

- [ ] **Step 2: Confirm pre-commit hook scope.** Run:

  ```bash
  cat mockups/.git-hooks/pre-commit | grep -E "apps/web/src" | head -5
  ```

  Expected: `apps/web/src/(components/(shell|pages)|pages|hooks|lib|dev)/` covered.

- [ ] **Step 3: No commit.** Read-only verification.

### Task A1: Supabase Mumbai project provisioning ⚠️ COST GATE

**Files:** `apps/api/.env`, `apps/web/.env.local` (gitignored; not committed).

- [ ] **Step 1: STOP and surface cost authorisation to user.** Plain-language confirmation message:

  > "About to provision a Supabase project in ap-south-1 (Mumbai) under your Supabase account. One-time creation, persistent until deleted, **free tier** expected to cover MVP (1 brand, ≤30 users). Pro tier ($25/month) only if scale demands later. Project credentials write to apps/api/.env (gitignored) + apps/web/.env.local (gitignored). Confirm to proceed."

  Wait for explicit "yes" / "proceed" / "go ahead". Any other response = STOP and clarify.

- [ ] **Step 2: Confirm Supabase organization.** Use `mcp__claude_ai_Supabase__list_organizations` to surface organisations to user. If multiple, surface for choice. If one, proceed.

- [ ] **Step 3: Get cost.** Use `mcp__claude_ai_Supabase__get_cost` with `type: 'project'` and the chosen org. Surface result. Use `mcp__claude_ai_Supabase__confirm_cost` to record acknowledgement; capture the returned confirmation ID.

- [ ] **Step 4: Create project.** Use `mcp__claude_ai_Supabase__create_project` with:

  ```json
  {
    "name": "fnberp-prod",
    "region": "ap-south-1",
    "organization_id": "<chosen-org-id>",
    "confirm_cost_id": "<id-from-step-3>"
  }
  ```

  Capture `project_id` from the response. Wait for project status = `ACTIVE_HEALTHY` (poll via `get_project` if needed).

- [ ] **Step 5: Capture credentials.** Use:

  ```
  mcp__claude_ai_Supabase__get_project_url        → SUPABASE_URL
  mcp__claude_ai_Supabase__get_publishable_keys   → SUPABASE_ANON_KEY (publishable key)
  ```

  For service role key + JWT secret: surface to user that these are read from the Supabase dashboard (project Settings → API). MCP `get_publishable_keys` returns the anon/publishable key only. User pastes the service role key + JWT secret into a follow-up message.

- [ ] **Step 6: Write env files.** Surface to user the destinations + content before writing:

  > "About to write Supabase credentials to:
  > - `apps/api/.env` (existing; appending SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET)
  > - `apps/web/.env.local` (new; VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
  >
  > Both gitignored per existing `.gitignore`. Confirm?"

  On confirm, write the files. Verify `.gitignore` covers both (`apps/**/.env`, `apps/**/.env.local`).

- [ ] **Step 7: Apply existing migrations.** Use `mcp__claude_ai_Supabase__apply_migration` for each of `apps/api/src/db/migrations/0001_*.sql` through `0006_*.sql` (read each file, apply each in order). Use `name: 'epic1_<short>_<n>'` to disambiguate.

- [ ] **Step 8: Run idempotent brand seed.** From repo root:

  ```bash
  cd apps/api && pnpm tsx src/db/seed/seed-brand.ts
  ```

  Expected: "✓ Brand seed applied (1 brand, 1 bootstrap Brand Owner user)".

- [ ] **Step 9: Verify with apps/api smoke test.** Run apps/api dev server pointed at the new Supabase project; `curl localhost:3001/health` returns 200. Stop dev server.

- [ ] **Step 10: Commit nothing.** Env files are gitignored. The provisioning artifacts (Supabase project ID, captured credentials) are user state, not source state.

### Task A2: categoryService.findSimilarByName closure (DL-034) — independent of A1

**Files:**
- Modify: `apps/api/src/services/categoryService.ts`
- Test: `apps/api/tests/integration/category-find-similar.test.ts` (new)

- [ ] **Step 1: Write failing test mirror of productService pattern.** Read `apps/api/tests/integration/product-find-similar.test.ts` (Epic 1) for the exact test shape. Replicate:

  ```typescript
  // apps/api/tests/integration/category-find-similar.test.ts
  import { describe, it, expect, beforeEach } from 'vitest';
  import { categoryService } from '../../src/services/categoryService.js';
  import { setupTestBrand, cleanTestDb } from './_helpers.js';

  describe('categoryService.findSimilarByName', () => {
    let brandId: string;
    beforeEach(async () => {
      await cleanTestDb();
      brandId = await setupTestBrand();
      await categoryService.create(brandId, { name: 'Dairy & Eggs', parentId: null });
      await categoryService.create(brandId, { name: 'Frozen Goods', parentId: null });
    });

    it('returns similar match for typo within trigram threshold', async () => {
      const matches = await categoryService.findSimilarByName(brandId, 'Diary & Eggs');
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].name).toBe('Dairy & Eggs');
    });

    it('returns empty array when no match passes threshold', async () => {
      const matches = await categoryService.findSimilarByName(brandId, 'Hardware Tools');
      expect(matches).toEqual([]);
    });

    it('respects brand_id isolation', async () => {
      const otherBrandId = await setupTestBrand('other');
      const matches = await categoryService.findSimilarByName(otherBrandId, 'Dairy');
      expect(matches).toEqual([]);
    });
  });
  ```

- [ ] **Step 2: Run test, expect failure.** `cd apps/api && pnpm vitest run category-find-similar`. Expected: FAIL — `categoryService.findSimilarByName is not a function`.

- [ ] **Step 3: Implement findSimilarByName mirroring productService.** Read `apps/api/src/services/productService.ts` for the existing pattern (uses `similarity()` from pg_trgm, threshold 0.4, scoped by brand_id). Add to `categoryService.ts`:

  ```typescript
  // categoryService.ts — add to existing module
  export async function findSimilarByName(
    brandId: string,
    candidateName: string,
  ): Promise<Array<{ id: string; name: string; similarity: number }>> {
    const db = getBrandedDb(brandId);
    const rows = await db.execute(sql`
      SELECT id, name, similarity(name, ${candidateName}) AS similarity
      FROM ${categories}
      WHERE brand_id = ${brandId}
        AND active = true
        AND similarity(name, ${candidateName}) > 0.4
      ORDER BY similarity DESC
      LIMIT 5
    `);
    return rows.rows as Array<{ id: string; name: string; similarity: number }>;
  }
  ```

- [ ] **Step 4: Run test, expect pass.** `pnpm vitest run category-find-similar`. Expected: 3/3 pass.

- [ ] **Step 5: Commit.**

  ```bash
  git add apps/api/src/services/categoryService.ts apps/api/tests/integration/category-find-similar.test.ts
  git commit -m "Phase 4 Epic 2 Arc a — Task A2 categoryService.findSimilarByName (DL-026 third-consumer / DL-034)"
  ```

### Task A3: Schema expansion — auth.ts + 3 new tables

**Files:**
- Modify: `apps/api/src/db/schema/auth.ts`
- Create: `apps/api/src/db/schema/permissions.ts`
- Create: `apps/api/src/db/schema/role-permissions.ts`
- Create: `apps/api/src/db/schema/user-permission-overrides.ts`
- Modify: `apps/api/src/db/schema/index.ts`
- Generated: `apps/api/src/db/migrations/0007_<timestamp>_epic2_usr.sql`

- [ ] **Step 1: Define role enum + expand users in `auth.ts`.** Replace contents:

  ```typescript
  // apps/api/src/db/schema/auth.ts
  import { pgEnum, text, boolean, timestamp, uuid } from 'drizzle-orm/pg-core';
  import { brandScopedTable } from '../brand-scoped-table.js';

  export const userRoleEnum = pgEnum('user_role', [
    'brand_owner',
    'cluster_manager',
    'kitchen_manager',
    'store_manager',
    'procurement_manager',
    'finance_manager',
    'dispatch_staff',
    'pos_staff',
    'superadmin',
  ]);

  export const approvalStatusEnum = pgEnum('approval_status', [
    'pending_approval',
    'approved',
    'rejected',
    'suspended',
  ]);

  export const users = brandScopedTable(
    'users',
    {
      email: text('email').notNull().unique(),
      fullName: text('full_name').notNull(),
      role: userRoleEnum('role').notNull(),
      approvalStatus: approvalStatusEnum('approval_status').notNull().default('approved'),
      // RBAC scope FKs — nullable; constrained at service layer per role
      clusterId: uuid('cluster_id'),
      departmentId: uuid('department_id'),
      locationId: uuid('location_id'),
      lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
      active: boolean('active').notNull().default(true),
    },
    {
      auditTrigger: true,
    },
  );

  export type User = typeof users.$inferSelect;
  export type NewUser = typeof users.$inferInsert;
  export type UserRole = (typeof userRoleEnum.enumValues)[number];
  export type ApprovalStatus = (typeof approvalStatusEnum.enumValues)[number];
  ```

- [ ] **Step 2: Create `permissions.ts` (global, non-brand-scoped).**

  ```typescript
  // apps/api/src/db/schema/permissions.ts
  import { pgTable, text, uuid, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

  export const permissions = pgTable(
    'permissions',
    {
      id: uuid('id').primaryKey().defaultRandom(),
      module: text('module').notNull(),    // 'mdm', 'usr', 'inv', etc.
      action: text('action').notNull(),    // 'read', 'write', 'delete', 'approve'
      scope: text('scope').notNull(),      // 'brand', 'cluster', 'department', 'location', 'self'
      key: text('key').notNull().unique(), // computed: module.resource.action (e.g., 'mdm.products.write')
      description: text('description').notNull(),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => ({
      moduleActionScopeIdx: uniqueIndex('permissions_module_action_scope_idx')
        .on(table.module, table.action, table.scope),
    }),
  );

  export type Permission = typeof permissions.$inferSelect;
  ```

- [ ] **Step 3: Create `role-permissions.ts` (global, non-brand-scoped).**

  ```typescript
  // apps/api/src/db/schema/role-permissions.ts
  import { pgTable, uuid, primaryKey } from 'drizzle-orm/pg-core';
  import { userRoleEnum } from './auth.js';
  import { permissions } from './permissions.js';

  export const rolePermissions = pgTable(
    'role_permissions',
    {
      role: userRoleEnum('role').notNull(),
      permissionId: uuid('permission_id')
        .notNull()
        .references(() => permissions.id, { onDelete: 'cascade' }),
    },
    (table) => ({
      pk: primaryKey({ columns: [table.role, table.permissionId] }),
    }),
  );

  export type RolePermission = typeof rolePermissions.$inferSelect;
  ```

- [ ] **Step 4: Create `user-permission-overrides.ts` (brand-scoped).**

  ```typescript
  // apps/api/src/db/schema/user-permission-overrides.ts
  import { pgEnum, text, uuid, timestamp } from 'drizzle-orm/pg-core';
  import { brandScopedTable } from '../brand-scoped-table.js';
  import { users } from './auth.js';
  import { permissions } from './permissions.js';

  export const overrideModeEnum = pgEnum('override_mode', ['grant', 'revoke']);

  export const userPermissionOverrides = brandScopedTable(
    'user_permission_overrides',
    {
      userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
      permissionId: uuid('permission_id').notNull().references(() => permissions.id, { onDelete: 'restrict' }),
      mode: overrideModeEnum('mode').notNull(),
      reasonCode: text('reason_code').notNull(),
      expiresAt: timestamp('expires_at', { withTimezone: true }),
    },
    {
      auditTrigger: true,
    },
  );

  export type UserPermissionOverride = typeof userPermissionOverrides.$inferSelect;
  export type NewUserPermissionOverride = typeof userPermissionOverrides.$inferInsert;
  export type OverrideMode = (typeof overrideModeEnum.enumValues)[number];
  ```

- [ ] **Step 5: Re-export from `index.ts`.** Append:

  ```typescript
  export * from './permissions.js';
  export * from './role-permissions.js';
  export * from './user-permission-overrides.js';
  ```

- [ ] **Step 6: Generate migration.** Run from `apps/api/`:

  ```bash
  pnpm drizzle-kit generate --name epic2_usr
  ```

  Expected: file at `apps/api/src/db/migrations/0007_<timestamp>_epic2_usr.sql`.

- [ ] **Step 7: Inspect generated SQL.** Open `0007_*.sql`. Confirm: enum types created, users table altered (new columns), 3 new tables created, brand_id index on user_permission_overrides (DL-015), 2-policy RLS scaffolding on user_permission_overrides (DL-014). If RLS not auto-generated, hand-edit per Epic 1 pattern.

- [ ] **Step 8: Apply migration locally.** Run:

  ```bash
  pnpm drizzle-kit migrate
  ```

  Against fnberp_dev. Expected: "✓ migrations applied".

- [ ] **Step 9: Smoke test.** Run:

  ```bash
  psql $DATABASE_URL -c "\d users; \d permissions; \d role_permissions; \d user_permission_overrides;" | head -100
  ```

  Confirm: users has new columns + role enum applied; 3 new tables exist; user_permission_overrides has brand_id + brand_id index.

- [ ] **Step 10: Commit.**

  ```bash
  git add apps/api/src/db/schema/auth.ts apps/api/src/db/schema/permissions.ts apps/api/src/db/schema/role-permissions.ts apps/api/src/db/schema/user-permission-overrides.ts apps/api/src/db/schema/index.ts apps/api/src/db/migrations/0007_*.sql
  git commit -m "Phase 4 Epic 2 Arc a — Task A3 schema expansion (users + 3 new tables for RBAC)"
  ```

### Task A4: Seed permissions catalog + role_permissions (migration 0008)

**Files:**
- Create: `apps/api/src/db/migrations/0008_<timestamp>_seed_permissions.sql` (hand-authored, not drizzle-kit)
- Create: `apps/api/src/db/seed/permissions-catalog.ts` (source of truth for the seed)

- [ ] **Step 1: Define permissions catalog.** Create `apps/api/src/db/seed/permissions-catalog.ts`:

  ```typescript
  // apps/api/src/db/seed/permissions-catalog.ts
  // DL-032: incremental per-epic catalog.
  // Epic 1 MDM CRUD seed.
  // Epic 2 USR seed (this file extends).
  // Future epics extend this list as they ship.

  import type { UserRole } from '../schema/auth.js';

  export interface PermissionDef {
    module: string;
    action: string;
    scope: string;
    key: string;
    description: string;
  }

  export const PERMISSIONS_CATALOG: PermissionDef[] = [
    // Epic 1 MDM
    { module: 'mdm', action: 'read',   scope: 'brand', key: 'mdm.org.read',         description: 'View org hierarchy (clusters/locations/departments)' },
    { module: 'mdm', action: 'write',  scope: 'brand', key: 'mdm.org.write',        description: 'Create/edit org hierarchy' },
    { module: 'mdm', action: 'read',   scope: 'brand', key: 'mdm.products.read',    description: 'View product master' },
    { module: 'mdm', action: 'write',  scope: 'brand', key: 'mdm.products.write',   description: 'Create/edit products' },
    { module: 'mdm', action: 'read',   scope: 'brand', key: 'mdm.categories.read',  description: 'View category tree' },
    { module: 'mdm', action: 'write',  scope: 'brand', key: 'mdm.categories.write', description: 'Create/edit categories' },
    { module: 'mdm', action: 'read',   scope: 'brand', key: 'mdm.vendors.read',     description: 'View vendor master' },
    { module: 'mdm', action: 'write',  scope: 'brand', key: 'mdm.vendors.write',    description: 'Create/edit vendors' },
    { module: 'mdm', action: 'read',   scope: 'brand', key: 'mdm.enablement.read',  description: 'View material enablement matrix' },
    { module: 'mdm', action: 'write',  scope: 'brand', key: 'mdm.enablement.write', description: 'Edit material enablement' },
    { module: 'mdm', action: 'read',   scope: 'brand', key: 'mdm.company.read',     description: 'View company registration + fiscal year' },
    { module: 'mdm', action: 'write',  scope: 'brand', key: 'mdm.company.write',    description: 'Edit company registration + fiscal year' },
    // Epic 2 USR
    { module: 'usr', action: 'read',   scope: 'brand',   key: 'usr.users.read',         description: 'View users' },
    { module: 'usr', action: 'read',   scope: 'cluster', key: 'usr.users.read.cluster', description: 'View users within own cluster' },
    { module: 'usr', action: 'write',  scope: 'brand',   key: 'usr.users.write',        description: 'Create/edit users' },
    { module: 'usr', action: 'read',   scope: 'brand',   key: 'usr.permissions.read',   description: 'View effective permissions' },
    { module: 'usr', action: 'write',  scope: 'brand',   key: 'usr.permissions.write',  description: 'Grant/revoke permission overrides' },
    { module: 'usr', action: 'approve',scope: 'brand',   key: 'usr.accounts.approve',   description: 'Approve Brand Owner accounts (Superadmin)' },
  ];

  export const ROLE_BASELINE: Record<UserRole, string[]> = {
    brand_owner: PERMISSIONS_CATALOG.filter(p => p.scope === 'brand' && p.module !== 'usr' || p.key.startsWith('usr.users') || p.key.startsWith('usr.permissions')).map(p => p.key),
    cluster_manager: ['mdm.org.read', 'mdm.products.read', 'mdm.categories.read', 'mdm.enablement.read', 'usr.users.read.cluster'],
    kitchen_manager: ['mdm.org.read', 'mdm.products.read', 'mdm.categories.read', 'mdm.enablement.read'],
    store_manager: ['mdm.org.read', 'mdm.products.read', 'mdm.categories.read', 'mdm.enablement.read'],
    procurement_manager: ['mdm.org.read', 'mdm.products.read', 'mdm.products.write', 'mdm.categories.read', 'mdm.vendors.read', 'mdm.vendors.write', 'mdm.enablement.read'],
    finance_manager: ['mdm.org.read', 'mdm.products.read', 'mdm.categories.read', 'mdm.vendors.read', 'mdm.company.read', 'mdm.company.write'],
    dispatch_staff: ['mdm.org.read', 'mdm.products.read', 'mdm.enablement.read'],
    pos_staff: ['mdm.products.read', 'mdm.categories.read'],
    superadmin: ['usr.accounts.approve'], // multi-tenant role; minimal in MVP
  };
  ```

- [ ] **Step 2: Hand-author migration 0008.** Generate timestamp prefix matching Epic 1 pattern. Create `apps/api/src/db/migrations/0008_<timestamp>_seed_permissions.sql`:

  ```sql
  -- 0008 — Seed permissions catalog + role_permissions (DL-032 incremental Epic 1+2)

  -- Insert permissions catalog
  INSERT INTO permissions (module, action, scope, key, description) VALUES
    ('mdm', 'read', 'brand', 'mdm.org.read', 'View org hierarchy (clusters/locations/departments)'),
    -- ... full list mirroring permissions-catalog.ts ...
    ('usr', 'approve', 'brand', 'usr.accounts.approve', 'Approve Brand Owner accounts (Superadmin)')
  ON CONFLICT (key) DO NOTHING;

  -- Insert role_permissions per ROLE_BASELINE
  INSERT INTO role_permissions (role, permission_id)
  SELECT 'brand_owner'::user_role, id FROM permissions WHERE key IN (
    'mdm.org.read', 'mdm.org.write', 'mdm.products.read', 'mdm.products.write',
    'mdm.categories.read', 'mdm.categories.write', 'mdm.vendors.read', 'mdm.vendors.write',
    'mdm.enablement.read', 'mdm.enablement.write', 'mdm.company.read', 'mdm.company.write',
    'usr.users.read', 'usr.users.write', 'usr.permissions.read', 'usr.permissions.write'
  )
  ON CONFLICT (role, permission_id) DO NOTHING;

  -- Repeat for cluster_manager, kitchen_manager, store_manager, procurement_manager,
  -- finance_manager, dispatch_staff, pos_staff, superadmin per ROLE_BASELINE.
  -- ... full inserts ...
  ```

  *(Engineer: hand-translate every key from `PERMISSIONS_CATALOG` and every role from `ROLE_BASELINE` into the SQL inserts. Use `ON CONFLICT DO NOTHING` for idempotence.)*

- [ ] **Step 3: Apply migration.** `pnpm drizzle-kit migrate`. Expected: "✓ 1 migration applied".

- [ ] **Step 4: Verify seed.** Run:

  ```bash
  psql $DATABASE_URL -c "SELECT count(*) FROM permissions; SELECT role, count(*) FROM role_permissions GROUP BY role ORDER BY role;"
  ```

  Expected: 18 permissions; 9 roles with non-zero counts (superadmin = 1, others vary).

- [ ] **Step 5: Re-run migration to verify idempotence.** Should report "0 migrations applied" (already applied). To exercise idempotence, manually execute the seed SQL again — should succeed silently due to `ON CONFLICT DO NOTHING`.

- [ ] **Step 6: Commit.**

  ```bash
  git add apps/api/src/db/seed/permissions-catalog.ts apps/api/src/db/migrations/0008_*.sql
  git commit -m "Phase 4 Epic 2 Arc a — Task A4 seed permissions catalog + role_permissions (DL-032)"
  ```

### Task A5: Tighten auth middleware + add rbac middleware

**Files:**
- Modify: `apps/api/src/middleware/auth.ts`
- Create: `apps/api/src/middleware/rbac.ts`
- Modify: `apps/api/src/errors/index.ts`
- Test: `apps/api/tests/integration/rbac-middleware.test.ts` (new)

- [ ] **Step 1: Add new error codes.** In `apps/api/src/errors/index.ts`, add:

  ```typescript
  // Existing codes preserved. New codes:
  // 'auth.role_missing'        — 403; JWT valid but role claim absent
  // 'auth.permission_denied'   — 403; user lacks permission key
  ```

  No change to AuthorizationError shape; just new code strings used in throws.

- [ ] **Step 2: Tighten auth.ts (remove 'viewer' fallback).** Replace lines 105–108 in `apps/api/src/middleware/auth.ts`:

  ```typescript
  const role = payload.user_metadata?.role;
  if (!role) {
    return next(
      new AuthorizationError({
        code: 'auth.role_missing',
        message: 'JWT is valid but role claim is absent — contact support',
        httpStatus: 403,
      }),
    );
  }

  req.user = {
    id: payload.sub,
    brandId,
    role,
  };
  ```

  Update `req.user.role` type in `apps/api/src/types/express.d.ts` (or wherever it's declared) from `string` to the imported `UserRole` enum type.

- [ ] **Step 3: Write failing test for rbac middleware.**

  ```typescript
  // apps/api/tests/integration/rbac-middleware.test.ts
  import { describe, it, expect, beforeEach } from 'vitest';
  import express from 'express';
  import request from 'supertest';
  import { authMiddleware } from '../../src/middleware/auth.js';
  import { requirePermission } from '../../src/middleware/rbac.js';
  import { mintTestJwt } from './_helpers.js'; // helper that signs a test JWT

  describe('requirePermission middleware', () => {
    it('allows when user has permission via role baseline', async () => {
      const app = express();
      app.get('/test', authMiddleware, requirePermission('mdm.products.read'),
        (_req, res) => res.json({ ok: true }));
      const token = await mintTestJwt({ role: 'brand_owner', brandId: 'test-brand' });
      const res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('denies with 403 + auth.permission_denied when role lacks permission', async () => {
      const app = express();
      app.get('/test', authMiddleware, requirePermission('mdm.products.write'),
        (_req, res) => res.json({ ok: true }));
      const token = await mintTestJwt({ role: 'pos_staff', brandId: 'test-brand' });
      const res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('auth.permission_denied');
    });

    it('allows when role lacks but user has grant override', async () => {
      // seed override: pos_staff user gets mdm.products.write grant
      // ... assert 200
    });

    it('denies when role has but user has revoke override', async () => {
      // seed override: brand_owner user gets mdm.products.write revoke
      // ... assert 403
    });
  });
  ```

- [ ] **Step 4: Run test, expect failure.** `pnpm vitest run rbac-middleware`. Expected: FAIL — `requirePermission is not exported`.

- [ ] **Step 5: Implement rbac middleware.** Create `apps/api/src/middleware/rbac.ts`:

  ```typescript
  // apps/api/src/middleware/rbac.ts
  import type { Request, Response, NextFunction } from 'express';
  import { AuthorizationError } from '../errors/index.js';
  import { permissionService } from '../services/permissionService.js';

  export function requirePermission(permissionKey: string) {
    return async function (req: Request, _res: Response, next: NextFunction): Promise<void> {
      if (!req.user) {
        return next(new AuthorizationError({
          code: 'auth.token_missing',
          message: 'authMiddleware must run before requirePermission',
          httpStatus: 401,
        }));
      }
      try {
        const allowed = await permissionService.userHasPermission(req.user.id, permissionKey);
        if (!allowed) {
          return next(new AuthorizationError({
            code: 'auth.permission_denied',
            message: `Permission denied: ${permissionKey}`,
            httpStatus: 403,
          }));
        }
        next();
      } catch (err) {
        next(err);
      }
    };
  }
  ```

- [ ] **Step 6: Implement minimal `permissionService.userHasPermission` stub** so tests run. This is finalised in Task A6:

  ```typescript
  // apps/api/src/services/permissionService.ts (stub)
  export const permissionService = {
    async userHasPermission(_userId: string, _key: string): Promise<boolean> {
      return false; // stub; A6 implements
    },
  };
  ```

- [ ] **Step 7: Run test, expect partial pass.** Tests assert specific behaviour requiring real resolution — they'll pass once A6 lands. For now, confirm the middleware structure compiles and the deny-path test passes.

- [ ] **Step 8: Commit.**

  ```bash
  git add apps/api/src/middleware/auth.ts apps/api/src/middleware/rbac.ts apps/api/src/errors/index.ts apps/api/src/services/permissionService.ts apps/api/tests/integration/rbac-middleware.test.ts
  git commit -m "Phase 4 Epic 2 Arc a — Task A5 RBAC middleware + auth role-claim tightening"
  ```

### Task A6: Service modules — userService, roleService, permissionService, permissionOverrideService, passwordResetService

**Files:**
- Create: `apps/api/src/services/userService.ts`
- Create: `apps/api/src/services/roleService.ts`
- Modify: `apps/api/src/services/permissionService.ts` (replace stub)
- Create: `apps/api/src/services/permissionOverrideService.ts`
- Create: `apps/api/src/services/passwordResetService.ts`
- Test: `apps/api/tests/integration/users.test.ts`
- Test: `apps/api/tests/integration/permissions.test.ts`
- Test: `apps/api/tests/integration/permission-overrides.test.ts`
- Test: `apps/api/tests/integration/password-reset.test.ts`

This is the largest task in Arc (a). Proceed in 5 sub-steps, one service per sub-step, each with TDD red→green→commit.

- [ ] **Step 1: roleService (read-only catalog).** TDD: write test for `listRoles()` returning the 9 enum values + `getRole(role)` returning baseline permission keys. Implement against `role_permissions` joined to `permissions`. Commit `roleService + tests`.

- [ ] **Step 2: permissionService.** TDD: write tests for `listPermissions()`, `getEffectivePermissions(userId)`, `userHasPermission(userId, key)`. Effective resolver: role baseline ∪ active grants − active revokes (active = `expires_at IS NULL OR expires_at > NOW()`). Replace the A5 stub with the real implementation. Commit `permissionService + tests`.

- [ ] **Step 3: userService.** TDD: write tests for `list({brandId, scope})`, `get(id)`, `create({email, fullName, role, scopeFKs, reasonCode})`, `update(id, patch, reasonCode)`, `deactivate(id, reasonCode)`. Scope filtering: Brand Owner sees brand-wide; Cluster Manager sees only `cluster_id = req.user.clusterId`. FR14 logic on create: if `role = 'brand_owner'` → `approval_status = 'pending_approval'`; else `approval_status = 'approved'`. Commit `userService + tests`.

- [ ] **Step 4: permissionOverrideService.** TDD: write tests for `grant({userId, permissionId, reasonCode, expiresAt})`, `revoke(...)`, `editOverride(id, {reasonCode, expiresAt})`, `listExpiringSoon(brandId, days)`, `expireOverride(id)`. Each mutation writes audit row (audit-trigger ON in schema = automatic). FR15c expiring-soon: `expires_at BETWEEN NOW() AND NOW() + (days || ' days')::interval`. Commit `permissionOverrideService + tests`.

- [ ] **Step 5: passwordResetService.** TDD: write tests using a Supabase Auth test-mode shim. Methods: `requestReset(email)` calls `supabase.auth.resetPasswordForEmail`; `confirmReset(token, newPassword)` calls `supabase.auth.updateUser`. Service is thin — Supabase manages token + single-use enforcement. Commit `passwordResetService + tests`.

After all 5 sub-steps, re-run the full Task A5 rbac-middleware test suite — the override-grant + override-revoke cases should now pass with the real permissionService.

### Task A7: REST endpoints

**Files:**
- Create: `apps/api/src/routes/users.ts`
- Create: `apps/api/src/routes/permissions.ts`
- Create: `apps/api/src/routes/auth.ts`
- Modify: `apps/api/src/routes/index.ts`
- Test: extend the existing integration tests with HTTP-level assertions

For each endpoint group, write Zod request/response schemas in `packages/shared/src/schemas/usr.ts` first, then the route handler, then HTTP integration tests.

- [ ] **Step 1: Zod schemas in `packages/shared`.** Add user/permission/override DTOs to `packages/shared/src/schemas/usr.ts`. Mirror Epic 1's MDM schema shape. Commit `packages/shared + schemas`.

- [ ] **Step 2: Users routes.** Endpoints:
  - `GET /users` (SI-USR-001) — `requirePermission('usr.users.read')` OR `requirePermission('usr.users.read.cluster')`; scope filter by user's role.
  - `POST /users` (SI-USR-002) — `requirePermission('usr.users.write')`.
  - `GET /users/:id` — `requirePermission('usr.users.read')` plus self-access fallback.
  - `PATCH /users/:id` — `requirePermission('usr.users.write')`.
  - `GET /users/pending-approval` (SI-USR-008) — `requirePermission('usr.accounts.approve')`.
  - `POST /users/:id/approve` — `requirePermission('usr.accounts.approve')`.
  - `POST /users/:id/reject` — `requirePermission('usr.accounts.approve')`.
  HTTP test: 200 happy path, 403 RBAC denial, 400 Zod parse failure. Commit.

- [ ] **Step 3: Permissions routes.** Endpoints:
  - `GET /users/:id/effective-permissions` (SI-USR-005) — `requirePermission('usr.permissions.read')`.
  - `POST /users/:id/permission-overrides` (SI-USR-006 grant|revoke) — `requirePermission('usr.permissions.write')`.
  - `PATCH /users/:userId/permission-overrides/:id` (SI-USR-006 edit) — same.
  - `DELETE /users/:userId/permission-overrides/:id` — same.
  - `GET /permission-overrides/expiring?days=N` (SI-USR-007) — `requirePermission('usr.permissions.read')`.
  HTTP test: same matrix. Commit.

- [ ] **Step 4: Auth routes (password reset).** Endpoints:
  - `POST /auth/reset-password/request` — public; rate-limited (use existing rate-limit middleware or add a per-IP token bucket).
  - `POST /auth/reset-password/confirm` — public; consumes Supabase reset token.
  Commit.

- [ ] **Step 5: Mount in `routes/index.ts`.** Add `app.use('/users', usersRouter)`, `app.use('/permission-overrides', permissionOverridesRouter)`, `app.use('/auth', authRouter)`. Commit.

### Task A8: Arc (a) close

**Files:** none (verification + branch push).

- [ ] **Step 1: Lint + typecheck.** From repo root:

  ```bash
  pnpm -r typecheck
  pnpm -r lint
  ```

  Expected: zero errors. Fix any.

- [ ] **Step 2: Full integration test run.** From `apps/api/`:

  ```bash
  pnpm vitest run
  ```

  Expected: all green.

- [ ] **Step 3: Schema discipline check.** Confirm:
  - Every brand-scoped table has brand_id index (DL-015).
  - Every brand-scoped table has 2-policy RLS template (DL-014).
  - `permissions` and `role_permissions` documented as global exceptions in their schema-file headers.
  - Every mutation writes audit_log row (DL-013) — verify by reading 5 random integration tests' audit-row assertions.

- [ ] **Step 4: Self-review against spec §4 + §7.** Tick each Tier 1 acceptance criterion that is backend-side: SI-USR-002 user create writes audit + handles BO-role pending-approval branch; FR15c reason code mandatory on overrides.

- [ ] **Step 5: Commit Arc (a) close.**

  ```bash
  git add -A
  git commit -m "Phase 4 Epic 2 Arc a — Task A8 close-out (lint/typecheck/tests green; schema discipline verified)"
  ```

- [ ] **Step 6: Push branch.** Branch is `phase-4/epic-2-usr-arc-a-backend` (created at first commit of Arc (a)). Push:

  ```bash
  git push -u origin phase-4/epic-2-usr-arc-a-backend
  ```

  Surface to user: confirm before opening PR. On confirm, open PR via `gh pr create` against `main`.

---

## 5. Arc (b) — Just-in-time mockups

Run order: B0 → B1 → B2 → B3 → B4 → B5 → B6 → B7. B0 is read-only; B5/B6 are extraction tasks; B7 is close.

### Task B0: Pre-flight — read existing shells inventory

- [ ] **Step 1.** Read `mockups/src/shell/index.ts`. Confirm 25 shells (post-Epic 1). Read `mockups/.git-hooks/pre-commit` to refresh on token discipline rules. No code change.

### Task B1: SI-USR-003 Login + SI-USR-004 Password Reset (responsive-equal)

**Files:** `mockups/src/screens/usr/SI-USR-003.tsx`, `mockups/src/screens/usr/SI-USR-004.tsx`. Update `mockups/src/screens/index.tsx` route table.

- [ ] **Step 1: SI-USR-003 Login.** Tier 1 hero. Mockup shows: brand accent header (per DESIGN.md §3 — login splash is one of the four allowed `tenant_brand_accent` surfaces), email field, password field, sign-in button, "Forgot password" link → `/SI-USR-004`, error state for invalid creds. Use existing `Input`, `Button`, `Card` shells. **No** session-aware rendering (mockup-only).

- [ ] **Step 2: SI-USR-004 Password reset two-step.** Step 1 (request): email field + submit → success state ("Check your inbox"). Step 2 (set new): /reset-password/{token} variant with new-password + confirm-password fields. Use `Input` + `Button` shells.

- [ ] **Step 3: Visual self-review.** Run `pnpm dev` in `mockups/`, navigate to both routes, confirm: zero hex literals, Lucide icons only (Mail, Lock, ArrowLeft), Inter font, no banned borders.

- [ ] **Step 4: Commit.**

  ```bash
  git add mockups/src/screens/usr/SI-USR-003.tsx mockups/src/screens/usr/SI-USR-004.tsx mockups/src/screens/index.tsx
  git commit -m "Phase 4 Epic 2 Arc b — Task B1 SI-USR-003 Login + SI-USR-004 Password Reset"
  ```

### Task B2: SI-USR-001 User List & Filter + SI-USR-002 User Create / Edit

**Files:** `mockups/src/screens/usr/SI-USR-001.tsx`, `mockups/src/screens/usr/SI-USR-002.tsx`.

- [ ] **Step 1: SI-USR-001 List.** Use `Table` shell. Columns: name, email, role (CC-ROLE-BADGE candidate), scope (cluster/dept/location summary), status (active/inactive/pending_approval pill via `StatusPill`), override count (clickable → SI-USR-005), last login, actions (edit/deactivate). Filter row above table: role, status, scope, search. Two view variants: Brand Owner (full brand) and Cluster Manager (read-only, filtered to one cluster).

- [ ] **Step 2: SI-USR-002 Create / Edit (Tier 1 hero).** Multi-section form:
  - Section 1: identity (full name, email).
  - Section 2: role (dropdown of 9 enum values; show description per role).
  - Section 3: scope assignment — conditional on role: BO/Superadmin = no scope; Cluster Manager = cluster picker; POS Staff = location + department; etc. Use `Popover` for cluster/department/location pickers (matches §2.7 vendor-scope picker pattern).
  - Section 4: reason code (FR15c style, mandatory).
  - Section 5 (edit only): per-user overrides summary — link to SI-USR-005.
  - Submit warning: if role = `brand_owner`, surface "This will require Superadmin approval" banner.

- [ ] **Step 3: Visual self-review.** Confirm token discipline. Confirm form sections use `<SectionShift>`, not `<Separator>`.

- [ ] **Step 4: Commit.**

  ```bash
  git add mockups/src/screens/usr/SI-USR-001.tsx mockups/src/screens/usr/SI-USR-002.tsx mockups/src/screens/index.tsx
  git commit -m "Phase 4 Epic 2 Arc b — Task B2 SI-USR-001 + SI-USR-002 (Tier 1 hero on USR-002)"
  ```

### Task B3: SI-USR-005 Effective Permissions + SI-USR-006 Grant/Revoke + SI-USR-007 Expiring Soon

**Files:** `mockups/src/screens/usr/SI-USR-005.tsx`, `SI-USR-006.tsx`, `SI-USR-007.tsx`. CC-PERMISSION-OVERRIDE-MGMT shell crystallises here (extracted in B5).

- [ ] **Step 1: SI-USR-005 Effective Permissions View.** Read-only grid. Columns: permission key, source (role baseline / grant override / revoke override), reason code, expiry (if applicable), audit link. Sort by source then key. Filter by source. Header: target user name + role badge. Action buttons: "Grant new permission" → SI-USR-006 (grant mode), "Revoke a permission" → SI-USR-006 (revoke mode).

- [ ] **Step 2: SI-USR-006 Grant / Revoke / Edit (Tier 1 hero).** Mode toggle in header (grant | revoke | edit). Form fields:
  - Target user (read-only, set by entry context).
  - Permission selector — search + filter; in grant mode shows permissions NOT in user's current effective set; in revoke mode shows permissions IN user's current effective set; in edit mode read-only.
  - Mandatory reason code (textarea + dropdown of canonical reason codes).
  - Optional expiry date (date picker; if blank = permanent).
  - Preview: "Effect: User will gain ability to ..." or "User will lose ability to ...".
  - Submit button + cancel.

- [ ] **Step 3: SI-USR-007 Overrides Expiring Soon.** Table sorted by expiry. Columns: user, permission, mode, reason code, expires_at (with band: 0-7d red, 8-30d amber, >30d neutral), actions (Renew → SI-USR-006 edit, Revoke now, Open user → SI-USR-005). Header: count + 0-7-day urgent count.

- [ ] **Step 4: Visual self-review.** Confirm shell reuse, token discipline.

- [ ] **Step 5: Commit.**

  ```bash
  git add mockups/src/screens/usr/SI-USR-005.tsx mockups/src/screens/usr/SI-USR-006.tsx mockups/src/screens/usr/SI-USR-007.tsx mockups/src/screens/index.tsx
  git commit -m "Phase 4 Epic 2 Arc b — Task B3 SI-USR-005/006/007 permission triple (Tier 1 hero on USR-006)"
  ```

### Task B4: SI-USR-008 Brand Owner Account Approval (per DL-030)

**Files:** `mockups/src/screens/usr/SI-USR-008.tsx`.

- [ ] **Step 1: SI-USR-008 — two views.**
  - Superadmin view (default mockup view): pending-approvals queue table (name, email, requested_role, requested_brand if multi-tenant, requested_at, actions: Approve/Reject with reason). Empty state: "No pending Brand Owner accounts." Per DL-030, this is the actionable state — but in MVP single-tenant the queue is always empty.
  - Brand Owner self-status view (entry-from-SI-USR-002 path): "Your Brand Owner account is pending Superadmin approval. You'll receive an email when it's reviewed." Empty for already-approved BO.

- [ ] **Step 2: Visual self-review.**

- [ ] **Step 3: Commit.**

  ```bash
  git add mockups/src/screens/usr/SI-USR-008.tsx mockups/src/screens/index.tsx
  git commit -m "Phase 4 Epic 2 Arc b — Task B4 SI-USR-008 Brand Owner Account Approval (DL-030)"
  ```

### Task B5: Extract CC-PERMISSION-OVERRIDE-MGMT shell

**Files:** `mockups/src/shell/CCPermissionOverrideMgmt.tsx`, `mockups/src/shell/index.ts`. Refactor SI-USR-005/006/007 to consume.

- [ ] **Step 1: Identify shared pattern.** The shared override-card pattern across SI-USR-005/006/007: target-user header, permission key + source badge, reason code display, expiry display with band colour, action affordance. Extract this into `<CCPermissionOverrideMgmt>` with composable subcomponents:

  ```typescript
  // mockups/src/shell/CCPermissionOverrideMgmt.tsx
  export interface OverrideCardProps {
    permissionKey: string;
    permissionDescription: string;
    source: 'role_baseline' | 'grant_override' | 'revoke_override';
    reasonCode?: string;
    expiresAt?: Date;
    auditLinkId?: string;
    actions?: React.ReactNode;
  }
  export const OverrideCard: React.FC<OverrideCardProps> = ({ ... }) => { /* ... */ };
  // Plus: <OverrideExpiryBand>, <OverrideSourceBadge>, <OverrideReasonInput>
  ```

- [ ] **Step 2: Refactor SI-USR-005/006/007** to consume the new shell. Lines saved per file ~30%.

- [ ] **Step 3: Re-export from index.ts.** Add `export * from './CCPermissionOverrideMgmt.js';`

- [ ] **Step 4: Run pre-commit hook.** Confirms token discipline (Lucide-only, etc.).

- [ ] **Step 5: Commit.**

  ```bash
  git add mockups/src/shell/CCPermissionOverrideMgmt.tsx mockups/src/shell/index.ts mockups/src/screens/usr/SI-USR-005.tsx mockups/src/screens/usr/SI-USR-006.tsx mockups/src/screens/usr/SI-USR-007.tsx
  git commit -m "Phase 4 Epic 2 Arc b — Task B5 extract CC-PERMISSION-OVERRIDE-MGMT shell"
  ```

### Task B6: CC-ROLE-BADGE evaluation

**Files:** maybe `mockups/src/shell/CCRoleBadge.tsx`, `mockups/src/shell/index.ts`.

- [ ] **Step 1: Count surfaces using a role badge.** SI-USR-001 list rows, SI-USR-002 form preview, SI-USR-005 header, SI-USR-006 target-user header, SI-USR-007 user column. ≥3 surfaces → promote.

- [ ] **Step 2: Extract CC-ROLE-BADGE if promoted.**

  ```typescript
  // mockups/src/shell/CCRoleBadge.tsx
  export const RoleBadge: React.FC<{ role: UserRole; size?: 'sm' | 'md' }> = ({ role, size = 'md' }) => {
    // pill rendering using StatusPill primitives — mapped role → tone
  };
  ```

- [ ] **Step 3: Refactor consumers** to use the new shell.

- [ ] **Step 4: Document in Arc (b) close as a candidate DL.** Surface to user at C0 review whether CC-ROLE-BADGE warrants a formal DL entry. (Likely not — it's a small composition.)

- [ ] **Step 5: Commit.**

  ```bash
  git add mockups/src/shell/CCRoleBadge.tsx mockups/src/shell/index.ts mockups/src/screens/usr/SI-USR-001.tsx mockups/src/screens/usr/SI-USR-002.tsx mockups/src/screens/usr/SI-USR-005.tsx mockups/src/screens/usr/SI-USR-006.tsx mockups/src/screens/usr/SI-USR-007.tsx
  git commit -m "Phase 4 Epic 2 Arc b — Task B6 CC-ROLE-BADGE shell"
  ```

### Task B7: Arc (b) close

- [ ] **Step 1: Pre-commit hook full sweep.** Run hook against all changed mockup files manually (the hook auto-fires on commit, but run once standalone to surface any latent issues):

  ```bash
  cd mockups && bash .git-hooks/pre-commit
  ```

  Expected: silent.

- [ ] **Step 2: Visual sweep across all 8 USR screens.** Open each in dev server, check token discipline + foundation chrome reuse + no Epic 1 shell drift.

- [ ] **Step 3: Update screen-catalog status.** Mark SI-USR-001 through SI-USR-008 as mockup-shipped.

- [ ] **Step 4: Commit + push branch.**

  ```bash
  git add -A
  git commit -m "Phase 4 Epic 2 Arc b — Task B7 close-out"
  git push -u origin phase-4/epic-2-usr-arc-b-mockups
  ```

  Surface to user: confirm before opening PR.

---

## 6. Arc (c) — Production frontend

Run order: C0 → C1 → C2 → C3 → C4 → C5 → C6 → C7 → C8 → C9 → C10 → C11. C1 is the load-bearing DL-029 swap; C8 is the Epic 1 RBAC audit; C9 is the DL-026 third-consumer wiring.

### Task C0: One-time copy-port (DL-005)

**Files:** `apps/web/src/components/shell/CCPermissionOverrideMgmt.tsx`, `apps/web/src/components/shell/CCRoleBadge.tsx` (if shipped), `apps/web/src/components/shell/index.ts`.

- [ ] **Step 1: Verify no source-side patches needed.** Diff Arc (b)'s shells against Epic 1's shell port pattern; confirm no React.forwardRef silent omissions like the C5 fix-back from Epic 1.

- [ ] **Step 2: Copy-port new shells.** Copy `mockups/src/shell/CCPermissionOverrideMgmt.tsx` → `apps/web/src/components/shell/CCPermissionOverrideMgmt.tsx`. Repeat for CCRoleBadge.tsx if shipped.

- [ ] **Step 3: Update apps/web shell index.** Add `export * from './CCPermissionOverrideMgmt.js';` and `export * from './CCRoleBadge.js';` (if shipped).

- [ ] **Step 4: Typecheck.** `pnpm --filter @fnberp/web typecheck`. Expected: silent.

- [ ] **Step 5: Commit.**

  ```bash
  git add apps/web/src/components/shell/
  git commit -m "Phase 4 Epic 2 Arc c — Task C0 copy-port new shells (DL-005)"
  ```

### Task C1: DL-029 swap to real Supabase Auth ⚠️ Tier 1 invariant

**Files:**
- Create: `apps/web/src/lib/supabase.ts`
- Replace: `apps/web/src/lib/auth.ts`
- Modify: any dev-mode dev-login button surface (search for `signInDev` callers)
- Test: re-run `apps/web/e2e/` Playwright suite

- [ ] **Step 1: Install supabase-js.** From `apps/web/`:

  ```bash
  pnpm add @supabase/supabase-js
  ```

  Pin major version. Update `apps/web/package.json`.

- [ ] **Step 2: Create shared client.**

  ```typescript
  // apps/web/src/lib/supabase.ts
  import { createClient } from '@supabase/supabase-js';
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required');
  }
  export const supabase = createClient(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  ```

- [ ] **Step 3: Replace `apps/web/src/lib/auth.ts`.** New contents:

  ```typescript
  // apps/web/src/lib/auth.ts — DL-033 single-commit replacement of DL-029 dev-stub
  import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
  import { supabase } from './supabase.js';
  import type { Session as SupabaseSession } from '@supabase/supabase-js';

  // The 9 canonical roles (matches apps/api userRoleEnum)
  export type UserRole =
    | 'brand_owner' | 'cluster_manager' | 'kitchen_manager' | 'store_manager'
    | 'procurement_manager' | 'finance_manager' | 'dispatch_staff' | 'pos_staff'
    | 'superadmin';

  export interface Session {
    accessToken: string;
    user: { id: string; brandId: string; role: UserRole };
    expiresAt: number;
  }

  export interface AuthContextValue {
    session: Session | null;
    status: 'loading' | 'authenticated' | 'unauthenticated';
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
  }

  function mapSupabaseSession(s: SupabaseSession | null): Session | null {
    if (!s) return null;
    const meta = s.user.user_metadata as { brand_id?: string; role?: UserRole };
    if (!meta.brand_id || !meta.role) {
      throw new Error('Supabase session missing brand_id or role claim');
    }
    return {
      accessToken: s.access_token,
      user: { id: s.user.id, brandId: meta.brand_id, role: meta.role },
      expiresAt: s.expires_at ?? 0,
    };
  }

  const AuthContext = createContext<AuthContextValue | null>(null);

  export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
    const [session, setSession] = useState<Session | null>(null);
    const [status, setStatus] = useState<AuthContextValue['status']>('loading');

    const signIn = useCallback(async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }, []);

    const signOut = useCallback(async () => {
      await supabase.auth.signOut();
    }, []);

    useEffect(() => {
      supabase.auth.getSession().then(({ data }) => {
        setSession(mapSupabaseSession(data.session));
        setStatus(data.session ? 'authenticated' : 'unauthenticated');
      });
      const { data: sub } = supabase.auth.onAuthStateChange((_event, supSession) => {
        setSession(mapSupabaseSession(supSession));
        setStatus(supSession ? 'authenticated' : 'unauthenticated');
      });
      return () => sub.subscription.unsubscribe();
    }, []);

    return React.createElement(AuthContext.Provider, { value: { session, status, signIn, signOut } }, children);
  }

  export function useSession(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (ctx === null) throw new Error('useSession() must be used inside <AuthProvider>');
    return ctx;
  }
  ```

  Note: the consumer surface `useSession()` returns `{ session, status, signIn, signOut }` — `signIn`/`signOut` replace `signInDev`/`signOut`. Epic 1 pages only consume `session` + `status`, so they're untouched.

- [ ] **Step 4: Search for and remove all `signInDev` callers.**

  ```bash
  grep -rn "signInDev\|VITE_AUTO_DEV_SIGNIN\|VITE_DEV_JWT_SECRET" apps/web/src/
  ```

  Replace any dev-login button with a real LoginPage navigate. Remove `VITE_DEV_JWT_SECRET` and `VITE_AUTO_DEV_SIGNIN` from `apps/web/vite-env.d.ts`. Remove `jose` from `apps/web/package.json` dependencies.

- [ ] **Step 5: Update `.env.example`.** Add `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=`. Remove `VITE_DEV_JWT_SECRET` and `VITE_AUTO_DEV_SIGNIN`.

- [ ] **Step 6: Verify `apps/api` middleware unchanged.** `git diff apps/api/src/middleware/auth.ts` since A5 — only the role-claim tightening from A5; nothing else changes for the swap.

- [ ] **Step 7: Run all 15 Playwright e2e tests against real Supabase.** From `apps/web/`:

  ```bash
  pnpm playwright test
  ```

  Expected: 15/15 pass. Failure = STOP and investigate. Common issues: bootstrap user's `user_metadata.brand_id` and `user_metadata.role` not set in Supabase Auth (set via the seed script in A1 Step 8); session-shape divergence (compare against the verbatim Session interface above).

- [ ] **Step 8: Manual smoke test.** From `apps/web/`:

  ```bash
  pnpm dev
  ```

  Navigate `localhost:5174`, sign in as bootstrap BO, click through all 7 Epic 1 pages — confirm zero regressions in render, data fetch, mutation. Sign out. Verify session cleared.

- [ ] **Step 9: Commit.**

  ```bash
  git add apps/web/src/lib/auth.ts apps/web/src/lib/supabase.ts apps/web/.env.example apps/web/vite-env.d.ts apps/web/package.json apps/web/pnpm-lock.yaml
  git commit -m "Phase 4 Epic 2 Arc c — Task C1 DL-029 swap to real Supabase Auth (DL-033)"
  ```

### Task C2: TanStack Query keys + RBAC components

**Files:**
- Modify: `apps/web/src/lib/query-keys.ts`
- Create: `apps/web/src/lib/RequirePermission.tsx`
- Create: `apps/web/src/lib/RequireRole.tsx`
- Modify: `apps/web/src/lib/RequireAuth.tsx` (optional — composability)

- [ ] **Step 1: Extend query-keys factory.** Add:

  ```typescript
  // apps/web/src/lib/query-keys.ts — append
  export const usrKeys = {
    all: ['usr'] as const,
    users: () => [...usrKeys.all, 'users'] as const,
    user: (id: string) => [...usrKeys.users(), id] as const,
    pendingApproval: () => [...usrKeys.all, 'pending-approval'] as const,
    effectivePermissions: (userId: string) => [...usrKeys.all, 'effective-permissions', userId] as const,
    overrides: (userId: string) => [...usrKeys.all, 'overrides', userId] as const,
    expiringOverrides: (days: number) => [...usrKeys.all, 'expiring', days] as const,
    permissions: () => [...usrKeys.all, 'permissions'] as const,
    roles: () => [...usrKeys.all, 'roles'] as const,
  };
  ```

- [ ] **Step 2: RequirePermission component.**

  ```typescript
  // apps/web/src/lib/RequirePermission.tsx
  import { useEffectivePermissions } from '../hooks/useEffectivePermissions.js';
  import { useSession } from './auth.js';

  export function RequirePermission({
    permission,
    children,
    fallback = null,
  }: { permission: string; children: React.ReactNode; fallback?: React.ReactNode }) {
    const { session } = useSession();
    const { data, isLoading } = useEffectivePermissions(session?.user.id);
    if (isLoading) return null;
    if (!data?.includes(permission)) return <>{fallback}</>;
    return <>{children}</>;
  }
  ```

- [ ] **Step 3: RequireRole component.**

  ```typescript
  // apps/web/src/lib/RequireRole.tsx
  import { useSession, type UserRole } from './auth.js';

  export function RequireRole({
    role, children, fallback = null,
  }: { role: UserRole | UserRole[]; children: React.ReactNode; fallback?: React.ReactNode }) {
    const { session } = useSession();
    const ok = Array.isArray(role)
      ? role.includes(session?.user.role as UserRole)
      : session?.user.role === role;
    return ok ? <>{children}</> : <>{fallback}</>;
  }
  ```

- [ ] **Step 4: Commit.**

  ```bash
  git add apps/web/src/lib/query-keys.ts apps/web/src/lib/RequirePermission.tsx apps/web/src/lib/RequireRole.tsx
  git commit -m "Phase 4 Epic 2 Arc c — Task C2 query-keys + RBAC components"
  ```

### Task C3: SI-USR-003 Login + SI-USR-004 Password Reset (Tier 1 hero on USR-003)

**Files:** `apps/web/src/pages/usr/LoginPage.tsx`, `apps/web/src/pages/usr/PasswordResetPage.tsx`. React Router routes added.

- [ ] **Step 1: LoginPage.** Mirror SI-USR-003 mockup; consume `useSession().signIn(email, password)`. On success, redirect to `/` (or last-attempted-route). On error, surface `auth.invalid_credentials` (Supabase error code) via §17.5 envelope mapping. Use `apiClient` for nothing — Supabase client direct call.

- [ ] **Step 2: PasswordResetPage.** Two routes: `/reset-password` (request) and `/reset-password/{token}` (confirm). Step 1: email + submit → calls `apiClient.post('/auth/reset-password/request', {email})`. Step 2: read token from URL params → submit new password → calls `apiClient.post('/auth/reset-password/confirm', {token, password})`. On success step 2, redirect to `/login` with banner.

- [ ] **Step 3: Add routes to apps/web router.** `/login`, `/reset-password`, `/reset-password/:token`. All public (no AuthRequired wrapper).

- [ ] **Step 4: Manual smoke test against real Supabase.** Sign out, navigate `/login`, sign in as bootstrap BO. Sign out, navigate `/reset-password`, request reset, check Supabase logs for the email send.

- [ ] **Step 5: Commit.**

  ```bash
  git add apps/web/src/pages/usr/LoginPage.tsx apps/web/src/pages/usr/PasswordResetPage.tsx apps/web/src/main.tsx apps/web/src/router.tsx
  git commit -m "Phase 4 Epic 2 Arc c — Task C3 SI-USR-003 Login + SI-USR-004 Password Reset (Tier 1 hero on USR-003)"
  ```

### Task C4: SI-USR-001 User List + SI-USR-002 User Create/Edit (Tier 1 hero on USR-002)

**Files:** `apps/web/src/pages/usr/UsersPage.tsx`, `apps/web/src/pages/usr/UserCreateEditPage.tsx`, `apps/web/src/hooks/useUsers.ts`, `apps/web/src/hooks/useRoles.ts`.

- [ ] **Step 1: useUsers + useRoles hooks.** TanStack Query consumers using `usrKeys.users()` and `usrKeys.roles()`. Mutation hooks: `useCreateUser`, `useUpdateUser`, `useDeactivateUser` — invalidate the list key on success.

- [ ] **Step 2: UsersPage.** Mirror SI-USR-001 mockup. Filter row: role select, status select, search. Table consumes `useUsers({brandId, scope, filters})`. Row actions: edit → `/users/{id}/edit`, deactivate (with reason modal). Brand-Owner-only actions surfaced via `<RequirePermission permission="usr.users.write">`. Click "Add user" → `/users/new`.

- [ ] **Step 3: UserCreateEditPage (Tier 1 hero).** Multi-section form mirroring SI-USR-002 mockup. RHF + Zod (mirror Epic 1 product form pattern). Conditional scope fields based on selected role. BO-role warning banner. Submit calls `useCreateUser` or `useUpdateUser`. On success, redirect to `/users`.

- [ ] **Step 4: Tier 1 acceptance check.** Run scenarios:
  - BO creates non-BO user → user immediately active.
  - BO creates BO-role user → lands in `pending_approval` state (verify via DB or SI-USR-008 queue).
  - Reason code captured on every mutation.
  - Audit row visible (verify via psql).

- [ ] **Step 5: Commit.**

  ```bash
  git add apps/web/src/pages/usr/UsersPage.tsx apps/web/src/pages/usr/UserCreateEditPage.tsx apps/web/src/hooks/useUsers.ts apps/web/src/hooks/useRoles.ts apps/web/src/router.tsx
  git commit -m "Phase 4 Epic 2 Arc c — Task C4 SI-USR-001 + SI-USR-002 (Tier 1 hero on USR-002)"
  ```

### Task C5: SI-USR-005 Effective Permissions + SI-USR-006 Grant/Revoke (Tier 1 hero on USR-006)

**Files:** `apps/web/src/pages/usr/EffectivePermissionsPage.tsx`, `apps/web/src/pages/usr/PermissionOverridePage.tsx`, `apps/web/src/hooks/useEffectivePermissions.ts`, `apps/web/src/hooks/usePermissionOverrides.ts`, `apps/web/src/hooks/usePermissions.ts`.

- [ ] **Step 1: Hooks.** TanStack Query consumers; mutations invalidate `usrKeys.effectivePermissions(userId)` and `usrKeys.overrides(userId)` on success.

- [ ] **Step 2: EffectivePermissionsPage.** Read-only grid consuming `useEffectivePermissions(userId)`. Filter by source. Header shows target user + role badge. Action buttons → `/users/{userId}/overrides/grant` and `/users/{userId}/overrides/revoke`.

- [ ] **Step 3: PermissionOverridePage (Tier 1 hero).** Reads mode from URL (`/users/{userId}/overrides/grant`, `.../revoke`, `.../edit/:overrideId`). Form: permission selector (filtered per mode), mandatory reason code, optional expiry. RHF + Zod. Preview text. Submit calls grant/revoke/editOverride mutation. On success, redirect to `/users/{userId}/effective-permissions`.

- [ ] **Step 4: Tier 1 acceptance check.**
  - FR15a mandatory reason code enforced.
  - FR15b effective view reflects override within 1 page refresh.
  - FR15c audit trail row written (verify via psql).
  - Edit mode preserves permission/user as read-only.

- [ ] **Step 5: Commit.**

  ```bash
  git add apps/web/src/pages/usr/EffectivePermissionsPage.tsx apps/web/src/pages/usr/PermissionOverridePage.tsx apps/web/src/hooks/useEffectivePermissions.ts apps/web/src/hooks/usePermissionOverrides.ts apps/web/src/hooks/usePermissions.ts apps/web/src/router.tsx
  git commit -m "Phase 4 Epic 2 Arc c — Task C5 SI-USR-005 + SI-USR-006 (Tier 1 hero on USR-006)"
  ```

### Task C6: SI-USR-007 Overrides Expiring Soon

**Files:** `apps/web/src/pages/usr/OverridesExpiringPage.tsx`. Hooks reused from C5.

- [ ] **Step 1: Page.** Mirror mockup. Default `days=30`. Sortable + filterable. Bulk-action surfaces (multi-row select, batch renew or revoke). Header tile-style metric (count + 0-7d urgent count).

- [ ] **Step 2: Add route + nav link** in apps/web sidebar (under "Users" category, BO-only).

- [ ] **Step 3: Commit.**

  ```bash
  git add apps/web/src/pages/usr/OverridesExpiringPage.tsx apps/web/src/router.tsx apps/web/src/components/navigation/* 2>/dev/null
  git commit -m "Phase 4 Epic 2 Arc c — Task C6 SI-USR-007 Overrides Expiring Soon"
  ```

### Task C7: SI-USR-008 Account Approval (route-only per DL-030)

**Files:** `apps/web/src/pages/usr/AccountApprovalPage.tsx`.

- [ ] **Step 1: Page.** Implements both views per B4 mockup. Wrap with `<RequireRole role="superadmin">`; in MVP single-tenant nobody satisfies this so the page surfaces a 403 panel. Document this in the file's top-of-file comment:

  ```typescript
  /**
   * SI-USR-008 — Brand Owner Account Approval (DL-030)
   *
   * Build now, route only, NOT linked from sidebar nav. In MVP single-tenant,
   * no real user holds the `superadmin` role; this page returns 403 in normal
   * navigation. Future-proofs Phase 2 multi-tenant migration.
   *
   * Smoke-tested in dev by manually granting a test user the `superadmin` role
   * via direct DB update on fnberp_dev.
   */
  ```

- [ ] **Step 2: Add route** at `/users/approvals` — DO NOT add a nav link. Verify by grepping the nav config.

- [ ] **Step 3: Commit.**

  ```bash
  git add apps/web/src/pages/usr/AccountApprovalPage.tsx apps/web/src/router.tsx
  git commit -m "Phase 4 Epic 2 Arc c — Task C7 SI-USR-008 Account Approval (DL-030 route-only)"
  ```

### Task C8: Epic 1 RBAC audit

**Files:** all 7 Epic 1 production pages: `apps/web/src/pages/mdm/*.tsx`.

- [ ] **Step 1: Audit pass — list current role checks.** Run:

  ```bash
  grep -rn "useSession\|user.role\|brand_owner" apps/web/src/pages/mdm/
  ```

  For each match, document the page + check + matrix expectation.

- [ ] **Step 2: Replace ad-hoc checks with `<RequirePermission>`.** Example replacement pattern:

  ```tsx
  // Before
  {session?.user.role === 'brand_owner' && <Button onClick={handleEdit}>Edit</Button>}

  // After
  <RequirePermission permission="mdm.products.write">
    <Button onClick={handleEdit}>Edit</Button>
  </RequirePermission>
  ```

- [ ] **Step 3: Tighten where matrix says wider.** Per RBAC Matrix:
  - HierarchyPage: BO write; CM/KM/SM read.
  - DepartmentsPage: BO write; CM read.
  - ProductsPage: BO + Procurement Manager write; others read.
  - EnablementMatrixPage: BO write; CM read.
  - VendorsPage: BO + Procurement Manager write; Finance Manager read.
  - CategoriesPage: BO write; others read.
  - CompanyPage: BO write; Finance Manager read; others 403.

- [ ] **Step 4: Manual test as each role.** Use the dev-mode override (manually update test users in fnberp_dev with each of the 9 roles + log in as them). Confirm gating per matrix.

- [ ] **Step 5: Re-run Playwright e2e.** Expected: 15/15 still pass plus any new role-gating-specific tests.

- [ ] **Step 6: Commit.**

  ```bash
  git add apps/web/src/pages/mdm/
  git commit -m "Phase 4 Epic 2 Arc c — Task C8 Epic 1 RBAC audit (replace ad-hoc role checks with <RequirePermission>)"
  ```

### Task C9: DL-026 third-consumer wiring

**Files:** `apps/web/src/pages/mdm/CategoriesPage.tsx`.

- [ ] **Step 1: Wire CCDuplicateWarn to categoryService.findSimilarByName.** Mirror the existing two consumers (Products + Vendors). Hook:

  ```tsx
  const { data: similarMatches } = useFindSimilarCategories(brandId, watchedName);
  // Render CC-DUPLICATE-WARN when similarMatches.length > 0
  ```

- [ ] **Step 2: Add `useFindSimilarCategories` hook.** Mirrors `useFindSimilarProducts` from Epic 1. Wires to the new GET `/categories/find-similar?name=` endpoint added in A2.

  *(If Task A2 didn't add the HTTP endpoint, add it now in apps/api routes; the service method is already there.)*

- [ ] **Step 3: Manual test.** Type a near-duplicate category name; warning appears with the existing similar match.

- [ ] **Step 4: Commit.**

  ```bash
  git add apps/web/src/pages/mdm/CategoriesPage.tsx apps/web/src/hooks/useFindSimilarCategories.ts apps/api/src/routes/categories.ts 2>/dev/null
  git commit -m "Phase 4 Epic 2 Arc c — Task C9 DL-026 third-consumer wiring (Categories CC-DUPLICATE-WARN)"
  ```

### Task C10: Chrome-freeze review gate

**Files:** `docs/superpowers/reviews/2026-05-08-epic-2-usr-chrome-freeze-review.md`.

- [ ] **Step 1: Run the review.** Walk all changed pages (the 8 new USR pages + 7 audited Epic 1 pages) and check:
  - Zero hex literals.
  - No banned borders (allow-list per CLAUDE.md).
  - Lucide-only icons.
  - Inter-only font.
  - No `<Separator>` usage.
  - Foundation chrome reused (no inline shell reinvention).
  - Same-shaped header / page chrome as Epic 1.

- [ ] **Step 2: Document drift.** If any drift exists, file under "Drift" section. Plan + execute fix-back. If none, sign off "no drift".

- [ ] **Step 3: Commit review file.**

  ```bash
  git add docs/superpowers/reviews/2026-05-08-epic-2-usr-chrome-freeze-review.md
  git commit -m "Phase 4 Epic 2 Arc c — chrome-freeze review (sign-off)"
  ```

### Task C11: Arc (c) close + Epic 2 PR

**Files:**
- Modify: `claude.md` (Current phase line)
- Modify: `codebase-inventory.md`

- [ ] **Step 1: Update `claude.md` `## Current phase` line.** Replace with:

  > **Phase 4 Epic 2 USR ✅ DONE 2026-MM-DD.** [summary of what shipped — mirror Epic 1's close-out style]. Next entry point: Phase 4 Epic 3 INF (Approval Engine + Notification Center + Audit Timeline) on a fresh chat.

- [ ] **Step 2: Update `codebase-inventory.md`.** Add new directories: `apps/api/src/services/usr-*`, `apps/api/src/routes/users.ts`, `apps/api/src/routes/permissions.ts`, `apps/api/src/middleware/rbac.ts`, `apps/web/src/pages/usr/`, `apps/web/src/lib/RequirePermission.tsx`, `apps/web/src/lib/RequireRole.tsx`.

- [ ] **Step 3: Final typecheck + build.** From repo root:

  ```bash
  pnpm -r typecheck && pnpm --filter @fnberp/web build && pnpm --filter @fnberp/api vitest run && pnpm --filter @fnberp/web playwright test
  ```

  Expected: all green.

- [ ] **Step 4: Commit close-out.**

  ```bash
  git add claude.md codebase-inventory.md
  git commit -m "Phase 4 Epic 2 Arc c — Task C11 close-out (Epic 2 ✅ DONE; Epic 3 INF is next)"
  ```

- [ ] **Step 5: Push branch.**

  ```bash
  git push -u origin phase-4/epic-2-usr-arc-c-frontend
  ```

  Surface to user: confirm before opening Epic 2 close-out PR. On confirm, open via `gh pr create` against `main`.

---

## 7. Acceptance criteria (Epic 2 close)

**Tier 1 hero acceptance** (per Phase 4 invariant — applies to deferred Tier 1 heroes built in Phase 4):

- [ ] **SI-USR-002 User Create/Edit.**
  - BO creates a non-BO user → active immediately, can log in (verified via Supabase Auth + Playwright).
  - BO creates a BO-role user → `approval_status='pending_approval'`, no login allowed (verified via DB read + login attempt failing).
  - Reason code captured on create AND edit (verified via audit_log row read).
- [ ] **SI-USR-003 Login.**
  - Bootstrap BO logs in successfully (Playwright).
  - Invalid password returns §17.5 error envelope (Playwright).
  - Expired session redirects to `/login` (Playwright with manipulated session expiry).
  - "Forgot password" → `/reset-password` (Playwright click).
- [ ] **SI-USR-006 Permission Grant/Revoke.**
  - FR15a mandatory reason code enforced — submit blocked without reason (Playwright).
  - FR15b effective-permissions view reflects override within 1 page refresh (Playwright).
  - FR15c audit trail row written (DB assertion in test).
  - Edit mode preserves permission + user as read-only (Playwright).

**Tier 2 acceptance** (lighter critique):

- [ ] **SI-USR-001, SI-USR-004, SI-USR-005, SI-USR-007, SI-USR-008.** Functional, FR-compliant, follows token discipline, passes pre-commit hook. Edge-case-deep acceptance not required.

**Cross-cutting acceptance:**

- [ ] All 7 Epic 1 production pages keep working post-C1 (DL-029 swap). 15/15 Playwright e2e pass.
- [ ] Token discipline: zero hex literals, no banned borders, Lucide-only, Inter-only, no `<Separator>`. Pre-commit hook fires zero times across Arc (b) + Arc (c).
- [ ] Chrome-freeze sign-off at C10 (or documented fix-back).
- [ ] DL-030 → DL-034 written to `decision-log.md` on planning branch (pre-Arc-(a)).
- [ ] `claude.md` `## Current phase` updated at C11.
- [ ] `codebase-inventory.md` extended at C11.

---

## 8. Out of scope this Epic (do NOT build)

- **MFA / 2FA / TOTP / authenticator apps** (DL-031).
- **SSO** — SAML/OIDC/Google/Microsoft (DL-031; Master Spec line 125).
- **Custom role builder** — module × action × scope role-template editor (DL-031; PRD line 612).
- **Tenant-switching UI / brand-onboarding self-service flow / subscription billing UI.** Multi-tenant post-MVP.
- **Concurrent session limits / force-logout / custom idle timeout.** Supabase defaults stand.
- **FR16 / FR17 Approval Engine wiring.** Epic 3.
- **FR20 audit timeline UI.** Epic 3.
- **Brand Owner self-creation sign-up form** (multi-tenant post-MVP).

---

## 9. Risks + mitigations

**R1. DL-029 swap breaks an Epic 1 page.** Mitigation: type-level `Session` interface preserved verbatim; full Playwright e2e re-run BEFORE Arc (c) commit; investigate root cause on first regression — do not skip.

**R2. Supabase Mumbai provisioning blocks Arc (a).** Mitigation: A1 is the first cost gate; A2 (categoryService cleanup) runs in parallel without dependency on A1. If A1 lags, A2 still lands and unblocks Arc (c) Task C9.

**R3. Permission catalog seed conflicts with Epic 3+ extensions.** Mitigation: catalog seeded with Epic 1 + Epic 2 only; epic-N+ adds rows via new migrations, never re-seeds.

**R4. RBAC scope FK constraint matrix on `users` is application-layer.** Mitigation: `userService.create` validates per-role scope requirements; integration test asserts each role's required scope FKs.

**R5. Chrome-freeze review surfaces drift in Epic 1 pages from C8 audit.** Mitigation: Task C10 explicit gate; fix-back mandatory before C11.

**R6. Arc (b) mockups silently absorb Epic 2's ad-hoc patterns.** Mitigation: per-epic chrome-freeze gate + B7 pre-commit-hook full sweep.

**R7. Supabase Auth `user_metadata` claim shape mismatch causes auth flow break.** Mitigation: A1 Step 8 seed sets `user_metadata.brand_id` and `user_metadata.role` explicitly; C1 Step 7 e2e test catches any divergence.

---

## 10. Self-review (run before committing this plan)

- [ ] **Spec coverage.** Each spec §4–§7 task has a corresponding plan task. Map: spec A0–A8 → plan A0–A8 (1-to-1). Spec B0–B7 → plan B0–B7 (1-to-1). Spec C0–C11 → plan C0–C11 (1-to-1). DL-030–034 covered in §11 below.
- [ ] **Placeholder scan.** No "TBD", "TODO", "fill in later", "implement later".
- [ ] **Type consistency.** `userRoleEnum` values match across schema (A3) ↔ permissions catalog seed (A4) ↔ frontend `UserRole` type (C1) — 9 values verbatim. `Session` interface in apps/web/src/lib/auth.ts (C1) matches DL-029 dev-stub shape verbatim. `requirePermission` middleware signature (A5) matches `<RequirePermission>` component prop name (C2).
- [ ] **Cross-task references.** A5 stub for `permissionService.userHasPermission` is replaced by A6 real implementation. C9 references Task A2 endpoint addition; if A2 didn't add the HTTP route, C9 adds it.
- [ ] **TDD discipline.** Every backend task has Red→Green→Commit. Frontend tasks fall back to manual smoke + e2e (no TDD on UI per existing project pattern).
- [ ] **Commit cadence.** ~1 commit per task minimum. Arc (a) = ~9 commits; Arc (b) = ~7; Arc (c) = ~12. Total ~28 commits across 3 PRs.

---

## 11. Decision-log entries to land on planning branch

These get written to `decision-log.md` on the planning branch in the same commit as this plan. The plan PR + decision-log update + spec update all land together; arc PRs follow.

**DL-030.** SI-USR-008 build now, route only, no menu link. *Why:* MVP single-tenant has no real Superadmin user; future-proofs Phase 2 multi-tenant without redesign sprint. *Cross-references:* FR14, PRD line 411-412, DL-024. *Source:* 2026-05-08 brainstorming, user choice "Proceed as A".

**DL-031.** MFA + SSO + custom role builder all post-MVP. *Why:* SSO explicit per Master Spec line 125; custom role builder explicit per PRD line 612; MFA silent on canonical sources, defaulted post-MVP. *Source:* 2026-05-08 brainstorming default consolidation.

**DL-032.** Permissions catalog populated incrementally per epic, not big-bang. *Why:* avoids speculation about future epics' resource shapes; keeps catalog accurate vs aspirational. *Cross-references:* FR15a, PRD §RBAC Matrix. *Source:* 2026-05-08 brainstorming default.

**DL-033.** DL-029 dev-stub auth replacement is single-commit big-bang at Arc (c) Task C1. *Why:* `useSession()` consumer surface contractually preserved; type-checking + e2e coverage make regression-detection fast; transition period adds complexity without protective benefit. *Cross-references:* DL-029. *Source:* 2026-05-08 brainstorming default.

**DL-034.** Arc (a) closes Epic 1 chrome-freeze deferred-gap by extending `categoryService.findSimilarByName`. *Why:* the categoryService module belongs to MDM (Epic 1 territory); Arc (a) is already touching service modules; Arc (c) Task C9 wires the frontend consumer. Independent of A1 (Supabase provisioning) so can run in parallel. *Cross-references:* DL-026, Epic 1 chrome-freeze review at `docs/superpowers/reviews/2026-05-07-epic-1-mdm-chrome-freeze-review.md`. *Source:* 2026-05-08 brainstorming default.

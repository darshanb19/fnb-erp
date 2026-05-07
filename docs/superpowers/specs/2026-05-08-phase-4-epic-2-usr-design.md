# Phase 4 Epic 2 — User Management & Security (USR) — Design Spec

**Date:** 2026-05-08
**Phase:** 4
**Epic:** 2 (USR — User Management & Security)
**Status:** Approved (brainstorming pass complete; pending implementation plan)

This spec is the input to `superpowers:writing-plans` for the Epic 2 implementation
plan at `docs/superpowers/plans/2026-05-08-phase-4-epic-2-usr-build.md`.

---

## §1 Inputs

Canonical sources read during the brainstorming pass:

- `_planning/02-master-spec.md` — Epic 2 row (line 270), role list, "Supabase Auth"
  decision (line 125: email/password, SSO post-MVP), test-data role distribution
  (line 692).
- `_planning/03-prd.md` — User Management & Access Control FRs (FR14, FR15,
  FR15a/b/c) at lines 604–614; RBAC Matrix at line 400 (9 roles + scopes +
  permissions); Migration Path note (single→multi-tenant) at line 393–397.
- `_planning/05-screen-inventory.md` — SI-USR-001 through SI-USR-008 (lines
  613–999), each with full 12-field schema content.
- `_planning/06-phase-roadmap.md` — Phase 4 invariants (3-arc structure,
  chrome-freeze gate, Tier 1 deferred-hero tag).
- `decision-log.md` DL-001 → DL-029. Load-bearing for Epic 2: DL-007 (Supabase
  Mumbai region pin), DL-012 (brandedDb application-layer enforcement),
  DL-013 (audit log application-layer primary), DL-014 (canonical 2-policy RLS
  template), DL-015 (brand_id index every brandScopedTable), DL-024 (single-brand
  bootstrap), DL-026 (CC-DUPLICATE-WARN three-consumer pattern; third consumer
  deferred from Epic 1), DL-029 (dev-stub auth carve-out from Epic 1 — Epic 2
  closure).
- `apps/api/src/middleware/auth.ts` — JWT verification path (HS256 +
  `SUPABASE_JWT_SECRET`; claims at `payload.user_metadata.{brand_id,role}`;
  `req.user = {id, brandId, role}`).
- `apps/api/src/db/schema/auth.ts` — minimal users stub (DL-013 audit-trigger ON;
  free-text `role` column defaulting to `'store_manager'`; circular FK to
  `created_by`/`updated_by` deferred).
- `apps/web/src/lib/auth.ts` — DL-029 dev-stub (`AuthProvider` + `useSession()` +
  `signInDev()`; jose-based HS256 minting gated by `import.meta.env.DEV`;
  `VITE_AUTO_DEV_SIGNIN` opt-in for testing convenience).
- `mockups/src/shell/` — 25 existing CC-* shells + `index.ts` (no
  CC-PERMISSION-OVERRIDE-MGMT yet — Arc (b) ships it).
- `mockups/src/screens/usr/` — does not exist (Arc (b) creates it).
- `apps/web/src/pages/usr/` — does not exist (Arc (c) creates it).

---

## §2 Output

Epic 2 ships:

- **Backend (Arc a).** Full RBAC schema (4 new tables); Supabase Mumbai project
  provisioned in ap-south-1 (DL-007); 5 service modules (`userService`,
  `roleService`, `permissionService`, `permissionOverrideService`,
  `passwordResetService`); Express RBAC middleware (`requirePermission`); audit
  hooks on every user/permission mutation; integration tests against fnberp_dev.
  Plus `categoryService.findSimilarByName` extension (DL-026 third-consumer
  closure / DL-034).
- **Mockups (Arc b).** 8 SI-USR screens drawn in `mockups/src/screens/usr/`;
  CC-PERMISSION-OVERRIDE-MGMT and (likely) CC-ROLE-BADGE shipped to
  `mockups/src/shell/`.
- **Frontend (Arc c).** 8 production pages in `apps/web/src/pages/usr/`; DL-029
  dev-stub `apps/web/src/lib/auth.ts` replaced with real `@supabase/supabase-js`
  (DL-033); RBAC middleware/components consumed by all 7 Epic 1 pages (gating
  audit per RBAC Matrix); copy-port of new Arc (b) shells per DL-005.
- **Decision log entries.** DL-030 → DL-034 written to `decision-log.md` at plan
  landing.

---

## §3 File structure (locked)

### Arc (a) — Backend

```
apps/api/src/db/schema/
  auth.ts                          (expand: full users schema; new role enum)
  permissions.ts                   (new: permissions catalog table)
  role-permissions.ts              (new: fixed-role baseline mapping)
  user-permission-overrides.ts     (new: FR15a/b/c per-user overrides)
  index.ts                         (export new tables)

apps/api/src/db/migrations/
  0007_<timestamp>_epic2_usr.sql   (expanded users + 3 new tables + indexes)
  0008_<timestamp>_seed_permissions.sql  (seed permissions catalog + role_permissions)

apps/api/src/services/
  userService.ts                   (new: CRUD with RBAC scope filtering)
  roleService.ts                   (new: read-only role catalog)
  permissionService.ts             (new: catalog + effective-permissions resolver)
  permissionOverrideService.ts     (new: grant/revoke/edit/expire)
  passwordResetService.ts          (new: thin wrapper over Supabase Auth recovery)
  categoryService.ts               (extend: findSimilarByName — DL-034)

apps/api/src/middleware/
  rbac.ts                          (new: requirePermission middleware factory)

apps/api/src/routes/
  users.ts                         (new: REST endpoints for SI-USR-001/002)
  permissions.ts                   (new: REST endpoints for SI-USR-005/006/007/008)

apps/api/tests/integration/
  users.test.ts                    (new)
  permissions.test.ts              (new)
  permission-overrides.test.ts     (new)
  password-reset.test.ts           (new)
  rbac-middleware.test.ts          (new)
```

### Arc (b) — Mockups

```
mockups/src/screens/usr/
  SI-USR-001.tsx                   (User List & Filter)
  SI-USR-002.tsx                   (User Create / Edit; Tier 1 hero)
  SI-USR-003.tsx                   (Login; Tier 1 hero; responsive-equal)
  SI-USR-004.tsx                   (Self-Service Password Reset; responsive-equal)
  SI-USR-005.tsx                   (User Effective Permissions View)
  SI-USR-006.tsx                   (Permission Grant / Revoke Flow; Tier 1 hero)
  SI-USR-007.tsx                   (Overrides Expiring Soon)
  SI-USR-008.tsx                   (Brand Owner Account Approval; per DL-030)

mockups/src/shell/
  CCPermissionOverrideMgmt.tsx     (new shell; consumed by SI-USR-005/006/007)
  CCRoleBadge.tsx                  (new shell; consumed by SI-USR-001/002/005;
                                    promote at Arc (b) close if it crystallises;
                                    otherwise inline-only)
  index.ts                         (re-exports updated)
```

### Arc (c) — Frontend

```
apps/web/src/lib/
  auth.ts                          (REPLACE: real Supabase; DL-029 swap; DL-033)
  RequireAuth.tsx                  (extend: composes RequirePermission/RequireRole)
  RequirePermission.tsx            (new)
  RequireRole.tsx                  (new)

apps/web/src/components/shell/
  CCPermissionOverrideMgmt.tsx     (copy-port from mockups per DL-005)
  CCRoleBadge.tsx                  (copy-port from mockups per DL-005, if shipped)

apps/web/src/pages/usr/
  UsersPage.tsx                    (SI-USR-001 + SI-USR-002; list+modal/route)
  LoginPage.tsx                    (SI-USR-003)
  PasswordResetPage.tsx            (SI-USR-004; two-step flow)
  EffectivePermissionsPage.tsx     (SI-USR-005)
  PermissionOverridePage.tsx       (SI-USR-006; grant|revoke|edit modes)
  OverridesExpiringPage.tsx        (SI-USR-007)
  AccountApprovalPage.tsx          (SI-USR-008; route-only per DL-030)

apps/web/src/hooks/
  useUsers.ts                      (TanStack Query consumers)
  usePermissions.ts
  usePermissionOverrides.ts
  useRoles.ts

apps/web/src/pages/mdm/
  *.tsx                            (audit pass: replace ad-hoc role === 'brand_owner'
                                    checks with <RequirePermission> shells)
```

---

## §4 Arc (a) Backend — work items

**Task A0 — verify monorepo state.** Skip-if-already-done check: `apps/api`, `apps/web`,
`packages/shared` exist (yes, from Epic 1). Pre-commit hook scope still covers
`apps/web/src/(components/(shell|pages)|pages|hooks|lib|dev)/` (yes, post-Epic-1).

**Task A1 — Supabase Mumbai project provisioning. ⚠️ COST GATE — STOP and surface to user.**
- Confirm cost authorisation in plain language: one-time project creation in
  ap-south-1; persistent credentials tied to user's Supabase account; Supabase
  **free tier** expected to cover MVP (1 brand, ≤30 users, low traffic) — Pro
  tier ($25/month) only if scale demands later.
- After explicit user go-ahead: use Supabase MCP `create_project` with
  `region=ap-south-1` (DL-007).
- Run `apply_migration` for the 6 existing migrations + 0007/0008 from this epic.
- Run idempotent brand seed (one Wild Sugar brand + bootstrap Brand Owner user).
- Capture credentials: write `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET` to `apps/api/.env` and
  `apps/web/.env.local`. Confirm `.gitignore` covers both. Surface destinations
  before writing.

**Task A2 — DL-026 third-consumer closure (DL-034).** Extend `categoryService` with
`findSimilarByName(brandId, candidateName)` using pg_trgm exactly as
`productService.findSimilarByName` does. Integration test mirrors the Epic 1
product-side test. Frontend wiring of CC-DUPLICATE-WARN on SI-MDM-006 happens in
Arc (c).

**Task A3 — Schema expansion + migrations 0007 & 0008.**
- `users` table: add `cluster_id` / `department_id` / `location_id` (nullable FKs;
  application-layer constrained by role per FR12), `approval_status` enum
  (`pending_approval | approved | rejected | suspended`), `last_login_at`
  timestamp. Convert `role` from free-text to enum of the 9 canonical values.
- `permissions` table — **global / non-brand-scoped** (the permission key
  `mdm.products.write` is the same across all brands). Schema: `id, module,
  action, scope, key (computed), description`. Documented as a brandedDb-pattern
  exception alongside the existing `brands` table exception. No brand_id, no
  RLS.
- `role_permissions` table — **global / non-brand-scoped** fixed-role baseline.
  Schema: `role` (enum) × `permission_id`. Seeded per the PRD §RBAC Matrix; not
  editable in MVP (PRD line 612).
- `user_permission_overrides` table — **brand-scoped** (DL-012). Schema: `id,
  brand_id, user_id, permission_id, mode (grant|revoke), reason_code,
  expires_at, created_by, created_at`. Audit-trigger ON. brand_id index (DL-015).
  2-policy RLS (DL-014).
- Migration 0008 seeds permissions catalog with Epic 1 MDM CRUD permissions
  (10 resources × {read, write, delete} = ~30 rows) and seeds role_permissions
  per the PRD §RBAC Matrix.

**Task A4 — Service modules.**
- `userService.ts` — `list({brandId, scope, filters})`, `get(id)`, `create(input)`,
  `update(id, input)`, `deactivate(id, reason)`. Scope filtering applies the
  acting user's RBAC scope (e.g., Cluster Manager sees only their cluster's
  users).
- `roleService.ts` — `listRoles()`, `getRole(role)`. Read-only.
- `permissionService.ts` — `listPermissions()`, `getEffectivePermissions(userId)`
  (returns role baseline ∪ active grants − active revokes; expired overrides
  excluded), `userHasPermission(userId, key)`.
- `permissionOverrideService.ts` — `grant({userId, permissionId, reason, expiry})`,
  `revoke({userId, permissionId, reason, expiry})`, `editOverride(id, {reason,
  expiry})`, `listExpiringSoon(brandId, days)`. Each mutation writes audit row
  per FR15c.
- `passwordResetService.ts` — `requestReset(email)` (calls Supabase Auth
  `resetPasswordForEmail`), `confirmReset(token, newPassword)` (Supabase manages
  token validity; service is thin). Service-layer single-use enforcement is
  Supabase's responsibility.

**Task A5 — RBAC middleware.** `requirePermission(key)` middleware factory.
Consumes `permissionService.userHasPermission(req.user.id, key)`. Returns §17.5
error envelope `{code: 'auth.permission_denied', httpStatus: 403, ...}` on
denial. Compose with existing `authMiddleware` chain.

Sub-step: tighten `apps/api/src/middleware/auth.ts` to **require** the role
claim (return `auth.role_missing` 403 if absent), not fall back to `'viewer'`.
Epic 2 every user has a role assigned at creation (FR12); the dev-stub fallback
is no longer warranted. The `'viewer'` literal is removed from the dev-stub
type union when `apps/web/src/lib/auth.ts` is rewritten in Arc (c) Task C1.

**Task A6 — REST endpoints.**
- `GET/POST /users`, `GET/PATCH /users/:id` (SI-USR-001/002).
- `GET /users/:id/effective-permissions` (SI-USR-005).
- `POST/PATCH /users/:id/permission-overrides`, `DELETE
  /users/:id/permission-overrides/:overrideId` (SI-USR-006).
- `GET /permission-overrides/expiring` (SI-USR-007).
- `GET /users/pending-approval`, `POST /users/:id/approve`, `POST
  /users/:id/reject` (SI-USR-008 — endpoints exist; UI route is Superadmin-only
  per DL-030).
- `POST /auth/reset-password/request`, `POST /auth/reset-password/confirm`
  (SI-USR-004; thin wrappers).

**Task A7 — Integration tests.** Run against **fnberp_dev** (local Postgres +
drizzle migrations) — same pattern as Epic 1 Arc (a). The Arc-(a)-provisioned
Supabase project is reserved for Arc (c) Playwright e2e tests where real
Supabase Auth flow matters. Coverage matrix:
- Happy paths for each endpoint per role.
- RBAC denial paths (Cluster Manager attempting brand-wide list returns scoped
  result, not 403).
- Effective-permissions resolver edge cases: override-grants-baseline (no-op),
  override-revokes-baseline (effective drop), expired-override (excluded).
- Audit row written on every mutation (read audit_log after each test).
- Password reset: Supabase Auth integration test using its test-mode token
  generation.

**Task A8 — Arc (a) close.** Self-review:
- Schema: every brand-scoped table has brand_id index (DL-015). 2-policy RLS
  applied to every brand-scoped table (DL-014). `permissions` non-brand-scoped
  exception documented.
- Audit: every mutation writes audit_log row (DL-013). Reason code mandatory on
  permission overrides (FR15c).
- Tests pass against provisioned Supabase. Commit + push to
  `phase-4/epic-2-usr-arc-a-backend` branch. Open PR.

---

## §5 Arc (b) Mockups — work items

**Task B0 — Just-in-time mockups discipline.** Only the 8 SI-USR screens. Don't
pre-mock anything from later epics; that's their own arc (b).

**Task B1 — Login + Password Reset (responsive-equal, Tier 1).** SI-USR-003 +
SI-USR-004. These are the only two responsive-equal screens in Epic 2.

**Task B2 — User CRUD pair (Tier 1).** SI-USR-001 + SI-USR-002. List with role
badges; create/edit form respects FR12 role-scope constraint visualisation
(e.g., POS Staff role surfaces location + department pickers; Cluster Manager
surfaces cluster picker only).

**Task B3 — Permission triple (Tier 1 hero on SI-USR-006).** SI-USR-005 + SI-USR-006
+ SI-USR-007. The CC-PERMISSION-OVERRIDE-MGMT shell crystallises here. Mode
toggle on SI-USR-006 (grant | revoke | edit). FR15a mandatory reason code +
optional expiry. SI-USR-007 expiry-band sort + bulk-action surfaces.

**Task B4 — Account approval (per DL-030).** SI-USR-008. Two views: Brand Owner
(self-status — empty for already-approved BO) + Superadmin (pending-approvals
queue with approve/reject + reason).

**Task B5 — CC-PERMISSION-OVERRIDE-MGMT extraction.** Promote shared override-card
pattern from B3 into `mockups/src/shell/CCPermissionOverrideMgmt.tsx`.
`mockups/src/shell/index.ts` re-export updated.

**Task B6 — CC-ROLE-BADGE evaluation.** If 3 surfaces use it (SI-USR-001 list +
SI-USR-002 form preview + SI-USR-005 header), promote to a shell. If only 1–2
use it, leave inline. Surface decision in Arc (b) self-review.

**Task B7 — Arc (b) chrome-freeze pre-flight.** Run pre-commit hook scope check
(token discipline, no banned borders, Lucide-only). Cross-check no Epic 1
shells got monkey-patched. Commit + push to `phase-4/epic-2-usr-arc-b-mockups`
branch. Open PR.

---

## §6 Arc (c) Frontend — work items

**Task C0 — One-time copy-port (DL-005).** Copy any new shells from
`mockups/src/shell/` to `apps/web/src/components/shell/` (CC-PERMISSION-OVERRIDE-MGMT
+ CC-ROLE-BADGE if promoted). Update `apps/web/src/components/shell/index.ts`.

**Task C1 — DL-029 swap (DL-033). ⚠️ Tier 1 invariant — Epic 1 pages MUST keep working.**
- Install `@supabase/supabase-js`. Lock version.
- Replace `apps/web/src/lib/auth.ts` with Supabase integration. Preserve the
  `useSession()` consumer surface verbatim.
- Delete: `signInDev()`, `mintToken()`, `verifyToken()`, jose import, the
  `VITE_DEV_JWT_SECRET` / `VITE_AUTO_DEV_SIGNIN` env handling, the dev-mode
  dev-login button (wherever it's surfaced).
- Run all 15 Playwright e2e tests against real Supabase auth flow (login as the
  bootstrap Brand Owner; navigate through all 7 Epic 1 pages; verify zero
  regressions). Failure here = STOP. The session-shape invariant is load-bearing.

**Task C2 — TanStack Query hooks.** `useUsers`, `usePermissions`,
`usePermissionOverrides`, `useRoles`. Query keys per the existing factory.

**Task C3 — Login + Password Reset (Tier 1).** SI-USR-003 + SI-USR-004.
LoginPage + PasswordResetPage. Respond to Supabase Auth state changes.

**Task C4 — User List + Create/Edit (Tier 1).** SI-USR-001 + SI-USR-002. UsersPage
with list + create/edit modal-or-route (pick one, document; Epic 1 used route).
RBAC scope filtering visible (CM gets cluster-scoped list).

**Task C5 — Effective Permissions + Override Flow (Tier 1 hero on SI-USR-006).**
SI-USR-005 + SI-USR-006. Effective permissions grid; override authoring with
mandatory reason + optional expiry; mode toggle (grant|revoke|edit).

**Task C6 — Overrides Expiring Soon.** SI-USR-007. Bulk renew/revoke surfaces.

**Task C7 — Account Approval (route-only per DL-030).** SI-USR-008. Page exists at
`/users/approvals`; not added to sidebar nav. Route guarded by
`<RequireRole role="superadmin">` — in MVP single-tenant no real user holds
this role, so the page returns 403 in normal navigation. Documented in route
comments. Smoke-tested in dev by manually granting a test user the
`superadmin` role (via direct DB update in fnberp_dev), confirming the
approve/reject UI renders + endpoints respond. Production navigation never
reaches this route in MVP.

**Task C8 — Epic 1 RBAC audit.** Walk the 7 Epic 1 production pages
(HierarchyPage, DepartmentsPage, ProductsPage, EnablementMatrixPage,
VendorsPage, CategoriesPage, CompanyPage). Replace ad-hoc `useSession().user.role
=== 'brand_owner'` checks with `<RequirePermission permission="<key>">`. Tighten
where RBAC Matrix says wider access is appropriate (e.g., CM read-only on
SI-USR-001-equivalent affordances; Procurement Manager full access to vendor
master per matrix).

**Task C9 — DL-026 third-consumer wiring.** SI-MDM-006 CategoriesPage gets the
CC-DUPLICATE-WARN consumer (now that Arc (a) shipped
`categoryService.findSimilarByName`). Self-review: third consumer matches the
existing two consumers' shape.

**Task C10 — Chrome-freeze review.** Per Phase 4 invariant. Cross-epic chrome
consistency check: any drift in the Epic 1 pages caused by Arc (c)'s RBAC audit?
File review at
`docs/superpowers/reviews/2026-05-08-epic-2-usr-chrome-freeze-review.md`. Sign-off
or fix-back.

**Task C11 — Arc (c) close.** Run typecheck + vite build + full Playwright suite.
Update `claude.md` "## Current phase" line to reflect Epic 2 ✅ DONE + Epic 3 INF
as next entry point. Update `codebase-inventory.md`. Commit + push to
`phase-4/epic-2-usr-arc-c-frontend` branch. Open PR.

---

## §7 Acceptance criteria

**Tier 1 hero acceptance** (per Phase 4 invariant — applies to deferred Tier 1
heroes built in Phase 4):

- **SI-USR-002 User Create/Edit.** Full FR14 happy path: BO creates a non-BO user
  (active immediately); BO creates a BO-role user (lands in `pending_approval`
  state, no login until approved). Reason code captured on every mutation. Audit
  trail row visible in audit_log for each.
- **SI-USR-003 Login.** Real Supabase Auth flow: bootstrap BO logs in; invalid
  password returns §17.5 error envelope; expired session redirects to login;
  password reset link routes to SI-USR-004.
- **SI-USR-006 Permission Grant/Revoke.** FR15a mandatory reason code enforced.
  FR15b effective-permissions view reflects override within 1 page refresh.
  FR15c audit trail row written. Edit-existing-override mode preserves
  permission/user (read-only), allows reason/expiry edit only.

**Tier 2 acceptance** (lighter critique):

- **SI-USR-001, SI-USR-004, SI-USR-005, SI-USR-007, SI-USR-008.** Functional, FR-
  compliant, follows token discipline, passes pre-commit hook. Edge-case-deep
  acceptance not required.

**Cross-cutting acceptance:**

- All 7 Epic 1 production pages keep working after Task C1 (DL-029 swap). 15/15
  Playwright e2e tests pass.
- Token discipline: zero hex literals, no banned borders, Lucide-only, Inter-only,
  no `<Separator>`. Pre-commit hook fires zero times across Arc (b) + Arc (c).
- Chrome-freeze sign-off at C10 (or documented fix-back).
- DL-030 → DL-034 written to `decision-log.md` at plan landing (not at Arc
  close — these are decisions made *during* brainstorming, before
  implementation).

---

## §8 Out of scope (explicit)

- **MFA / 2FA / TOTP / authenticator apps.** Silent in canonical sources. DL-031
  consolidates as post-MVP per silent-on-canonical default + Master Spec line 125
  SSO-post-MVP pattern.
- **SSO** (SAML / OIDC / Google / Microsoft). Explicitly post-MVP per Master Spec
  line 125. DL-031.
- **Custom role builder** (module × action × scope role-template editor). Per PRD
  line 612: deferred to Phase 2. DL-031.
- **Tenant-switching UI / brand-onboarding self-service flow / subscription
  billing UI.** Per PRD §"Migration path": all post-MVP multi-tenant.
- **Concurrent session limits / force-logout / custom idle timeout.** None
  specified in canonical sources. Supabase Auth defaults stand (1-hour access,
  7-day refresh).
- **FR16 / FR17 Approval Engine wiring.** Epic 3 cross-cutting. Epic 2 ships
  SI-USR-008 per DL-030 (option A: route exists, no menu link); Epic 3
  later wraps it in the Unified Approval Inbox without UX change.
- **FR20 audit timeline UI.** Epic 3. Epic 2 writes audit rows; the timeline
  viewer is Epic 3.
- **Brand Owner self-creation flow front-end** (sign-up form for new prospective
  BOs to request a new brand). Multi-tenant — post-MVP. The schema's
  `approval_status='pending_approval'` state is future-proofed; no UI surface
  in Epic 2.

---

## §9 Risks + mitigations

**R1. DL-029 swap breaks an Epic 1 page (session-shape divergence).**
Mitigation: type-level enforcement of `Session` interface unchanged
(`{ accessToken, user: { id, brandId, role } }` — exact match). All 15
Playwright e2e tests re-run against real Supabase BEFORE Arc (c) commit. Hard
stop on first regression.

**R2. Supabase Mumbai provisioning blocks Arc (a) end-to-end.** Mitigation:
provisioning is Task A1, surfaced as the first cost gate when Arc (a) starts.
Tasks A2 (categoryService cleanup) is independent and can run in parallel while
A1 awaits authorisation. A3+ depend on A1 — flag clearly in plan.

**R3. Permission catalog seed conflicts with Epic 3+ extensions.** Mitigation:
catalog seeded with Epic 1 MDM CRUD only (10 resources × 3 actions ≈ 30 rows).
Epic 3+ adds rows via new migrations, not by re-seeding. DL-032 documents the
incremental-per-epic discipline.

**R4. RBAC scope FKs (cluster_id, department_id, location_id) on `users` violate
brandedDb pattern when role is BO (no scope) vs POS Staff (location +
department).** Mitigation: nullable columns; application-layer constraint via
`userService.create` validation (POS Staff requires location+department; CM
requires cluster; BO requires nothing). Document constraint matrix in
service-layer JSDoc.

**R5. Chrome-freeze review surfaces drift in Epic 1 pages caused by RBAC audit.**
Mitigation: Task C10 explicitly runs the chrome-freeze review; fix-back is
mandatory before C11 commits. Pattern matches Epic 1's chrome-freeze cycle.

**R6. Arc (b) mockups absorb Epic 2's ad-hoc patterns and silently drift from
Epic 1's chrome.** Mitigation: per-epic chrome-freeze gate (Phase 4 invariant)
catches this at C10. Arc (b) Task B7 also runs the pre-commit hook before merge.

---

## §10 New decision-log entries (DL-030 → DL-034)

To be written to `decision-log.md` at plan landing.

**DL-030. SI-USR-008 Brand Owner Account Approval — build now, route only, no
menu link.** *Decision:* Ship the page + RBAC + endpoint in Epic 2 as
future-proofing for multi-tenant migration; route exists at
`/users/approvals` but not surfaced in sidebar nav. *Why:* In single-tenant MVP
there is only one Brand Owner (bootstrapped per DL-024); no real Superadmin
user exists; FR14's approval workflow has nothing to act on. Building it now
keeps the SI-USR inventory honest at 8/8 and avoids a redesign sprint when
multi-tenant migration lands. Cost: ~half a day of mockup + page work for a
screen that has no MVP user. *Why not skip entirely:* User judgment call —
preferred future-proofing over deferral. *Cross-references:* FR14, PRD line
411–412 (Superadmin future-proofing), DL-024 (single-brand bootstrap).
*Source:* 2026-05-08 brainstorming, user choice "Proceed as A".

**DL-031. MFA + SSO + custom role builder — post-MVP.** *Decision:* All three
explicitly out of MVP scope. *Why:* SSO explicitly post-MVP per Master Spec
line 125. Custom role builder explicitly post-MVP per PRD line 612 ("fixed
role definitions ... not editable in MVP"). MFA silent on canonical sources;
defaulted post-MVP by silent-on-canonical interpretation matching the SSO
pattern. *Cross-references:* Master Spec line 125, PRD line 612, FR14 / FR15a.
*Source:* 2026-05-08 brainstorming, default consolidation.

**DL-032. Permission catalog populated incrementally per epic, not big-bang.**
*Decision:* Epic 2 seeds the `permissions` table with Epic 1 MDM CRUD
permissions only (~30 rows: 10 resources × 3 actions). Each subsequent epic
adds its own permissions via new migrations as it ships. No upfront enumeration
across all 12 epics. *Why:* Big-bang catalog requires speculating about future
epics' resource shapes; incremental keeps the catalog accurate vs aspirational
and avoids mid-build catalog refactors. *Cross-references:* FR15a (module ×
action × scope), PRD §RBAC Matrix. *Source:* 2026-05-08 brainstorming, default.

**DL-033. DL-029 dev-stub auth replacement is single-commit big-bang.**
*Decision:* `apps/web/src/lib/auth.ts` is replaced wholesale in one commit at
Arc (c) Task C1. No transition period, no parallel-run, no feature flag. The
Playwright e2e suite (15/15 against real Supabase) is the safety net.
*Why:* The `useSession()` consumer surface is contractually preserved; the
swap is mechanical; type checking + e2e coverage make regression-detection
fast. A transition period adds complexity without protective benefit.
*Cross-references:* DL-029. *Source:* 2026-05-08 brainstorming, default.

**DL-034. Arc (a) closes Epic 1 chrome-freeze deferred-gap (DL-026 third
consumer).** *Decision:* Extend `categoryService` with `findSimilarByName`
(pg_trgm-based, mirroring `productService.findSimilarByName`) in Arc (a)
Task A2. Frontend wiring of CC-DUPLICATE-WARN on SI-MDM-006 happens in Arc (c)
Task C9. *Why:* Epic 1 chrome-freeze review (2026-05-07) deferred this as the
single open gap; folding the closure into Epic 2 Arc (a) is the natural
unblock since the categoryService module belongs to MDM (Epic 1 territory)
and Arc (a) is already touching service modules. Independent of A1 (Supabase
provisioning) so can land in parallel. *Cross-references:* DL-026, Epic 1
chrome-freeze review at `docs/superpowers/reviews/2026-05-07-epic-1-mdm-
chrome-freeze-review.md`. *Source:* 2026-05-08 brainstorming, default.

---

## §11 Self-review

Run before handing the spec to the user for written-spec review.

- [ ] No "TBD" / "TODO" / placeholder content.
- [ ] Internal consistency: §3 file structure matches §4–§6 task descriptions.
- [ ] Internal consistency: §7 acceptance criteria match §4–§6 task outputs.
- [ ] Scope check: 8 SI-USR screens + auth swap + Epic 1 RBAC audit + DL-026
      closure — coherent for one implementation plan.
- [ ] Ambiguity check: every load-bearing decision has a §10 DL entry or
      cross-references to existing canonical source.
- [ ] DL-030 verbiage matches user's actual choice ("Proceed as A").
- [ ] Risk mitigations are concrete (not "be careful").
- [ ] Out-of-scope list has rationale for each item.
- [ ] No drift from Phase 4 invariants (3-arc structure, chrome-freeze gate,
      Tier 1 deferred-hero tag).

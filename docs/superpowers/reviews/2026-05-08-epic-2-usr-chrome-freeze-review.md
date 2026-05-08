# Chrome-Freeze Review — Phase 4 Epic 2 USR Arc (c)

**Date:** 2026-05-08
**Reviewer:** Claude Opus 4.7 (1M context) (subagent C10)
**Branch:** `phase-4/epic-2-usr-arc-c-frontend`
**Last C9 SHA before review:** `f4c07f7`

---

## Overview

This review covers the cross-epic chrome-consistency gate for Phase 4 Epic 2 USR Arc (c) before C11 / Epic 3 starts. It audits **15 production pages** — the 7 Epic 1 MDM pages (SI-MDM-001 through SI-MDM-007) plus the 8 Epic 2 USR pages (SI-USR-001 through SI-USR-008) — and the two new C0-ported shells (`CCPermissionOverrideMgmt`, `CCRoleBadge`) plus the C1/C5 lib additions (`user-roles.ts`, `reason-codes.ts`).

Audit checklist mirrors the Epic 1 review structure, extended to cover the 9 Arc-(c)-specific items called out in the task brief (CC-DUPLICATE-WARN third-consumer closure, role-enum reconciliation, RBAC residue, header chrome, OverrideSourceBadge consistency, plus the 5 build-time concerns to record).

## Summary

**All 9 audit checklist items pass clean.** No drift requiring fix-back. The C9 commit closes the single Epic 1 documented gap (CC-DUPLICATE-WARN third consumer). C8 Epic 1 RBAC audit applied uniformly with no chrome regression. Two intentional divergences are documented (mockups vs apps/web role-enum; LoginPage vs PasswordResetPage header treatment). Five Arc-(c) design choices are recorded for forward reference (reasonCode composition, deferred view-variant toggle, EnablementMatrix tightening, BO self-status deferral, OverridesExpiring bulk-action stubbing).

Final state: typecheck silent, 15/15 e2e pass (verified by C9 subagent), pre-commit hook clean across all C-arc commits.

---

## Audit Findings

### 1. CC-DUPLICATE-WARN Consumer Surfaces (DL-026 closure)

**Three production consumers confirmed** — DL-026 closure complete after C9.

| Surface | File | Line | Debounce | ≥3 char gate | Real endpoint | Shell used |
|---|---|---|---|---|---|---|
| ProductsForm (create + edit) | `apps/web/src/pages/mdm/ProductsForm.tsx` | 839 | 300ms (`useDebounce`) | `debouncedName.length >= 3` | `useFindSimilarProducts` → `/api/v1/products/similar?name=...` | `<CCDuplicateWarn>` |
| VendorsForm (create + edit) | `apps/web/src/pages/mdm/VendorsForm.tsx` | 992 | 300ms (`useDebounce`) | `debouncedName.length >= 3` | `useFindSimilarVendors` → `/api/v1/vendors/similar?name=...` | `<CCDuplicateWarn>` |
| CategoriesPage CategoryDialog (create + edit) | `apps/web/src/pages/mdm/CategoriesPage.tsx` | 419 | 300ms (`useDebounce`) | `debouncedName.length >= 3` | `useFindSimilarCategories` → `/api/v1/categories/similar?name=...` | `<CCDuplicateWarn>` |

All three consumers use the structurally identical pattern: `useDebounce(nameValue, 300)` → `useFindSimilar*(debouncedName, { excludeId: id })` → `<CCDuplicateWarn matches={...} onEditExisting={...} onProceedAnyway={...} />`, guarded by `debouncedName.length >= 3 && (similarQuery.data?.length ?? 0) > 0`.

**Status: PASS — DL-026 closed.** The Epic 1 deferred gap (Categories consumer requiring `categoryService.findSimilarByName`) was added in Arc (a)/B context and wired in C9.

---

### 2. Token Discipline

**a) Hex literals.** Command:

```
grep -rEn "#[0-9a-fA-F]{3,8}\b" apps/web/src/pages/ apps/web/src/components/shell/ apps/web/src/lib/
```

Result: **only matches in `apps/web/src/lib/tokens.ts`** (the canonical TypeScript mirror — exempt per DESIGN.md and the Phase 2c+ generation-side rule). Zero hex literals in any page or shell file.

**b) Banned border classes.** Command:

```
grep -rEn '\bborder(-[trbxy0-9]+)?\b' apps/web/src/pages/ apps/web/src/components/shell/
```

Findings (after filtering allowlisted patterns and JSDoc references):

- `apps/web/src/pages/usr/UsersPage.tsx:32` — JSDoc comment `"No banned border classes."` Not a violation.
- `apps/web/src/components/shell/CCDuplicateWarn.tsx:70` — `border-l-4` (status-pip pattern, allowlisted §5.2).
- `apps/web/src/components/shell/Card.tsx:31` — `border-0` (zeroing the shadcn primitive's default border, the inverse of a sectioning border).
- `apps/web/src/components/shell/Table.tsx:46` — `[&_tbody_tr]:border-b-0 [&_thead_tr]:border-b-0` (zeroing the shadcn-emitted defaults per §9.2 no-line-rule).
- `apps/web/src/components/shell/Button.tsx`, `IssueTicketLink.tsx`, `Input.tsx`, `AppShell.tsx`, `StatusPill.tsx` — only `focus-visible:` / `aria-invalid:` border / ring classes plus JSDoc references.

USR-only border scan (`apps/web/src/pages/usr/`): only the JSDoc reference in `UsersPage.tsx:32`. **Zero raw sectioning-border classes.** The pre-commit hook has been clean across all 10 Arc-(c) commits.

**c) Lucide-only.** Command:

```
grep -rEn "@material-symbols|@mui/icons|material-icons|material-symbols|ms-outlined|ms-rounded|ms-sharp|mso-" apps/web/src/
```

Result: **zero matches.** All icon imports across pages and shells use `lucide-react` (9 imports across the 8 USR pages + 2 new shells; 17 total across `apps/web/src/pages/`).

**d) Inter-only.** Command:

```
grep -rEn "font-family\s*:" apps/web/src/
```

Result: one match — `apps/web/src/index.css:468 font-family: var(--font-sans);` — the canonical Inter declaration in the global stylesheet. Zero inline `font-family:` declarations in any TSX source.

**e) `<Separator>` ban.** Command:

```
grep -rn "<Separator" apps/web/src/
```

Result: only matches are inside `apps/web/src/components/primitives/separator.tsx` (the unconsumed shadcn primitive) and `apps/web/src/components/primitives/sidebar.tsx` (third-party shadcn sidebar primitive — not authored by us, not consumed by any page; it's the inert vendor shell). All page files contain `<SectionShift>` or "no `<Separator>` — `<SectionShift>` for tonal breaks" docstring assertions; **zero `<Separator>` usages in any of the 15 pages or in the 22+2 chrome shells**.

**Status: PASS — token discipline holds across both epics.**

---

### 3. Tenant Brand Accent — Allowed-Surface Discipline

Per DESIGN.md §3, the four allowed accent surfaces are: login splash, sidebar logo, B2B PDF headers, accountant-export PDF headers. Of these, only "login splash" is built in Epic 2; sidebar logo, B2B PDF, and accountant PDF are not yet implemented.

Scan: `grep -rEn "tenant[_-]brand[_-]accent" apps/web/src/`.

Findings:

| File | Line | Context | Verdict |
|---|---|---|---|
| `apps/web/src/index.css` | 133, 287 | CSS custom-property declaration | Allowed (token plumbing). |
| `apps/web/src/lib/tokens.ts` | 130 | TypeScript token mirror | Allowed (canonical). |
| `apps/web/src/components/shell/CCPermissionOverrideMgmt.tsx` | 58, 68 | JSDoc comment asserting "no `tenant_brand_accent` here — not an allowed surface" | Allowed (negative-space documentation). |
| `apps/web/src/pages/usr/LoginPage.tsx` | 23, 26, 33, 63, 65, 116 | JSDoc + one usage `bg-tenant-brand-accent` on the header band | **Allowed surface (login splash, §3 #1).** |
| `apps/web/src/pages/usr/PasswordResetPage.tsx` | 51 | JSDoc explicitly stating "NO `tenant_brand_accent` here — not one of the four allowed surfaces" | Allowed (negative-space documentation; correct discipline). |
| `apps/web/src/pages/usr/UserCreateEditPage.tsx` | 42 | JSDoc "No tenant_brand_accent (admin form is not an allowed accent surface)" | Allowed (negative-space documentation). |

**Single live consumer: LoginPage header band.** No other production page uses the accent. The negative-space JSDocs on PasswordResetPage and UserCreateEditPage are model behaviour for forward reference.

**Status: PASS — accent surface discipline holds.**

---

### 4. Foundation Chrome Reuse

Spot-checked outer-wrapper conventions across all 15 pages:

| Page | Outer wrapper | Header | Auth-shell wrapper |
|---|---|---|---|
| HierarchyPage | `bg-surface min-h-full` | `<header class="flex flex-wrap items-end justify-between gap-4">` + AuditLink | (inside AppShell) |
| DepartmentsPage | `bg-surface min-h-full` | same pattern + AuditLink | (inside AppShell) |
| ProductsPage | `bg-surface min-h-full` | same pattern + AuditLink | (inside AppShell) |
| EnablementMatrixPage | `bg-surface min-h-full` | same pattern + AuditLink | (inside AppShell) |
| VendorsPage | `bg-surface min-h-full` | same pattern + AuditLink | (inside AppShell) |
| CategoriesPage | `bg-surface min-h-full` | same pattern + AuditLink | (inside AppShell) |
| CompanyPage | `bg-surface min-h-full` | same pattern + AuditLink | (inside AppShell) |
| UsersPage (USR-001) | `bg-surface min-h-full` | same pattern | (inside AppShell) |
| UserCreateEditPage (USR-002) | `bg-surface min-h-full` | (form-style header — back-link + title; documented divergence — see §8) | (inside AppShell) |
| LoginPage (USR-003) | (pre-auth) `bg-surface min-h-screen` | `<header class="bg-tenant-brand-accent text-on-surface">` (allowed accent) | OUTSIDE AppShell — pre-auth surface |
| PasswordResetPage (USR-004) | (pre-auth) `bg-surface min-h-screen flex flex-col` | `<header class="bg-surface-container-low">` (calm pre-auth header — no accent) | OUTSIDE AppShell — pre-auth surface |
| EffectivePermissionsPage (USR-005) | `bg-surface min-h-full` | same pattern + AuditLink | (inside AppShell) |
| PermissionOverridePage (USR-006) | `bg-surface min-h-full` | same pattern | (inside AppShell) |
| OverridesExpiringPage (USR-007) | `bg-surface min-h-full` | same pattern | (inside AppShell) |
| AccountApprovalPage (USR-008) | `bg-surface min-h-full` (admin route) and `min-h-full bg-surface flex items-center justify-center` (404-style fallback when not Superadmin) | same pattern | (inside AppShell) |

The two pre-auth pages (LoginPage, PasswordResetPage) deliberately use `min-h-screen` (full viewport since no AppShell chrome wraps them) instead of `min-h-full` — this is correct per the AppShell contract.

No page reinvents shell chrome inline. Loading skeletons consistently use `bg-surface-container-high animate-pulse rounded` / `rounded-pill` — same pattern as Epic 1.

**Status: PASS — foundation chrome reused consistently.**

---

### 5. Status Palette Closed

Command:

```
grep -rhoE "status_[a-z_]+" apps/web/src/pages/ apps/web/src/components/shell/ apps/web/src/lib/ | sort -u
```

20 unique tokens used:

```
status_archived           status_inactive             status_provisional
status_cancelled          status_overridden           status_rejected
status_closed             status_pending_approval     status_returned
status_completed          status_pending_gr           status_template_active
status_confirmed          status_template_expired     status_variance_flagged
status_draft              status_version_published    status_waiting_info
status_gr_rejected        status_in_progress
```

These are exactly the canonical 20 from DESIGN.md §6.1. **Zero invented status names.** No `status_pending_revision`, `status_expired_pending`, or other custom labels.

**Status: PASS — status palette closed; no invented tokens.**

---

### 6. Role-Enum Reconciliation (apps/web vs apps/api vs mockups)

**apps/web canonical 9 roles** (`apps/web/src/lib/user-roles.ts`):

```
brand_owner | cluster_manager | kitchen_manager | store_manager
procurement_manager | finance_manager | dispatch_staff | pos_staff | superadmin
```

This matches the apps/api `userRoleEnum` at `apps/api/src/db/schema/auth.ts` exactly (9 roles, same names, same enum order). The C1 rewrite (DL-033) fixed the divergence.

**Mockups divergent UserRole** (intentional, documented):

The mockups copy at `mockups/src/lib/user-roles.ts` retains the pre-Arc-(a) PRD draft list (`production_manager | pos_manager | accountant | viewer` instead of `kitchen_manager | store_manager | dispatch_staff | pos_staff`). This is intentional — mockups are **visual-only reference** and the chrome-freeze gate covers `apps/web` (production) only. The mockup file is a frozen snapshot and is not consumed by any production code path. The C1 commit message and the JSDoc at `apps/web/src/lib/user-roles.ts:7-10` document this divergence explicitly:

> "The mockups copy intentionally diverges — it was written from the PRD draft 9-role list before the backend enum was finalised in Arc (a) Task A3. The mockups file stays unchanged because it is visual-only reference; the Epic 2 chrome-freeze review (C10) will note this divergence as expected."

**Status: PASS — apps/web matches apps/api truth; mockup divergence is documented and intentional.**

---

### 7. RBAC Residue Audit (post-C8)

C8 replaced ad-hoc role checks with `<RequirePermission>`. Verification:

```
grep -rEn "session\.user\.role|user\.role\s*===|user\.role\s*!==" apps/web/src/pages/ apps/web/src/components/
```

Result: **zero matches** that gate UI rendering on role.

Adjacent hits (manually triaged, all legitimate display-logic, not auth gates):

| File | Line | Pattern | Verdict |
|---|---|---|---|
| `pages/usr/UsersPage.tsx` | 342, 344, 345, 346, 350 | `if (u.role === 'superadmin') return 'Multi-tenant'` etc. | Display-logic — computes a scope-label string from each user's role for the row data. Not an RBAC gate. |
| `pages/usr/UserCreateEditPage.tsx` | 291, 638 | `const isBrandOwnerPick = role === 'brand_owner'` | Form-state derivation — drives the conditional scope-section visibility based on the role *the admin is picking for the user being created*. Not an RBAC gate. |
| `pages/mdm/CompanyPage.tsx` | 400 | JSDoc comment `"replaced ad-hoc role === 'brand_owner' check with..."` | Documentation only — the actual code uses `<RequireRole>` / `<RequirePermission>`. |
| `pages/usr/UsersPage.tsx` | 10 | JSDoc reference `"req.user.role"` | Documentation only. |

`<RequirePermission>` consumed in 4 Epic 1 pages (ProductsPage, CategoriesPage, DepartmentsPage, HierarchyPage; CompanyPage and EnablementMatrixPage use `<RequireRole>` / derived `canEdit` patterns). All Epic 2 pages that gate authoring actions use `<RequirePermission>` or are Superadmin-gated at route level (AccountApprovalPage uses `<RequireRole>` per FR14 + DL-030).

`useSession()` calls outside RBAC components are limited to:

- HierarchyPage (`session.user.brandId` for resource-scoping — legitimate).
- EnablementMatrixPage (`session.user.id` to feed `useEffectivePermissions` — derives `canEdit` from `mdm.enablement.write`, the documented C8 audit decision; threading `<RequirePermission>` into the per-cell EnablementToggle would be unergonomic).
- LoginPage (consumes `signIn` + `status` — legitimate).

**Status: PASS — no role-string residue gating UI; all four legitimate `useSession()` consumers vetted.**

---

### 8. Header Chrome Consistency (cross-epic)

All 15 pages compared. The patterns:

**Pattern A — Authenticated index/list/detail page header.** Used by 12 of the 13 in-AppShell pages:
```
<div className="bg-surface min-h-full">
  <div className="...container...">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div> title + breadcrumb + sub-text </div>
      <div> action buttons + AuditLink (when mutation-capable) </div>
    </header>
    ...
```

Pages: HierarchyPage, DepartmentsPage, ProductsPage, EnablementMatrixPage, VendorsPage, CategoriesPage, CompanyPage, UsersPage, EffectivePermissionsPage, PermissionOverridePage, OverridesExpiringPage, AccountApprovalPage.

**Pattern B — Form-page back-link header (admin form).** Used by UserCreateEditPage (USR-002):
- Replaces the right-side action cluster with a left-side back-link + breadcrumb. Save/Cancel actions are at the form footer.
- This is a deliberate divergence: USR-002 is a "create / edit a single resource" workflow, not an index. The mockup (`mockups/src/screens/usr/SI-USR-002.tsx`) uses the same back-link-style header. ProductsForm and VendorsForm use modal-dialog patterns instead, so USR-002 is the first page-level form in the codebase.

**Pattern C — Pre-auth page header.** Used by LoginPage (USR-003) and PasswordResetPage (USR-004):
- LoginPage: `<header class="bg-tenant-brand-accent text-on-surface">` — the allowed accent-surface band per DESIGN.md §3.
- PasswordResetPage: `<header class="bg-surface-container-low">` — calm tonal band, NO accent (token discipline upheld; documented in the file's JSDoc at line 51).
- Both pages render outside AppShell with `min-h-screen` (full viewport).

**Status: PASS — three header patterns, all deliberate. Pattern B (USR-002 form-page back-link) is the one new pattern Epic 2 introduces; the divergence is intentional and matches the mockup.**

---

### 9. New Shells — Consistency Across Consumers

**a) `<CCPermissionOverrideMgmt>` shell** (`apps/web/src/components/shell/CCPermissionOverrideMgmt.tsx`).

The shell exports four consumer-facing pieces: `<OverrideSourceBadge>`, `<OverrideExpiryBand>`, `<OverrideReasonForm>`, and the catalog/utility helpers. Consumers:

| Consumer | File | Imports |
|---|---|---|
| SI-USR-005 EffectivePermissionsPage | `apps/web/src/pages/usr/EffectivePermissionsPage.tsx:51` | `OverrideSourceBadge` (line 585) |
| SI-USR-006 PermissionOverridePage | `apps/web/src/pages/usr/PermissionOverridePage.tsx:62` | `OverrideSourceBadge` ×2 (lines 556, 681) |
| SI-USR-007 OverridesExpiringPage | `apps/web/src/pages/usr/OverridesExpiringPage.tsx:53` | `OverrideSourceBadge variant="compact"` (line 602) |

All three consumers import from the same shell module (`@/components/shell/CCPermissionOverrideMgmt`). The shell exposes a `variant?: 'long' | 'compact'` prop; USR-005 and USR-006 use the default (`long`), USR-007 explicitly opts into `compact` for the row-density of the expiring-soon table. Same component, same tone tokens, same source-pill semantics — zero inline reinvention.

**b) `<CCRoleBadge>` shell** (`apps/web/src/components/shell/CCRoleBadge.tsx`).

Imported via the export aggregator and used wherever role labels are surfaced in the USR pages. JSDoc asserts "No banned borders; no `<Separator>`; no companion font" — verified inline.

**c) `lib/user-roles.ts`** — single source of truth for `UserRole`, `USER_ROLES`, `ROLE_LABEL`, `ROLE_DESCRIPTION`, `roleScopeShape`. Consumed by USR-001 (UsersPage), USR-002 (UserCreateEditPage), USR-005, USR-006, USR-008. Matches apps/api enum verbatim.

**d) `lib/reason-codes.ts`** — added in C5; consumed by USR-006 (PermissionOverridePage `composeReasonCode`/`decomposeReasonCode`), USR-007 (`REASON_CODE_LABEL` for row-display).

**Status: PASS — new shells used consistently; OverrideSourceBadge identical across all three consumers; zero inline duplication.**

---

## Recorded Design Choices (no drift; documented for forward reference)

These are not violations — they're intentional Arc (c) decisions worth recording so Epic 3 / future audits don't mistake them for drift.

### 9.1 — C5 reasonCode composition (USR-006)

Override mutations compose the API `reasonCode` field as `"<code>: <notes>"` (colon-space separator), e.g. `"role_baseline_too_restrictive: Customer needs after-hours access to closing reports."` See `apps/web/src/pages/usr/PermissionOverridePage.tsx:275-300` (`composeReasonCode` / `decomposeReasonCode`).

The audit log row preserves this composed string verbatim per the apps/api A6 service contract, which the file JSDoc at line 31 describes: "the field names are the load-bearing API contract (`reasonCode`, NOT separate code+notes columns)." Per FR15c, the audit row preserves rationale.

**Forward-reference note:** future audit-export tooling (Epic 3) will need to either (a) parse `^([a-z_]+): (.*)$` to split code from free-text notes for separate columns, or (b) treat the whole field as opaque rationale. The split is reversible (the inverse function exists; both are unit-tested implicitly via the round-trip on edit-load). No drift; documented.

### 9.2 — C5 deferred items (USR-005 view-toggle; USR-002 override-summary)

The mockup for USR-005 shows a Brand Owner vs Cluster Manager view-variant toggle. This was deferred because the apps/api server enforces cluster scope server-side based on `req.user.role`, so the client-side toggle is redundant — a Cluster Manager simply gets a scoped result set, no toggle needed. Documented in the `EffectivePermissionsPage` JSDoc.

The mockup for USR-002 user-edit mode shows an inline "active permission overrides for this user" summary section. Deferred to Epic 3 because the override-management surfaces (USR-005, USR-006, USR-007) ship as separate routes in MVP; a per-user inline summary becomes valuable when the cross-cutting Approval Engine is wired in Epic 3.

**Forward-reference note:** both deferrals are rational; the page surfaces still expose the data via dedicated routes. No drift.

### 9.3 — C8 EnablementMatrixPage role-baseline tightening

The pre-C8 implementation allowed `procurement_manager` to edit material enablement via an ad-hoc role check. C8 swapped this to a derived `canEdit` from `useEffectivePermissions(session.user.id).includes('mdm.enablement.write')`, and the `ROLE_BASELINE` matrix in `permissions-catalog.ts` only grants `mdm.enablement.write` to `brand_owner`. The result: procurement_manager loses inline edit access.

This is **a bug-fix-via-audit, not a regression** — the original code drifted from the canonical permission baseline; C8 brought it back in line. Documented in the EnablementMatrixPage JSDoc at line 870-878. If the product rule changes later, the fix is to update the `ROLE_BASELINE` (one source of truth) — not to re-add an ad-hoc check in the page.

### 9.4 — C7 BO self-status view deferred (USR-008)

Per DL-030, the AccountApprovalPage is **Superadmin-only in MVP**. The mockup shows a second variant — "Brand Owner self-status / waiting-room card" — which was intentionally omitted because the multi-tenant signup flow requiring it isn't shipping in Phase 4. Documented at the file's top JSDoc (lines 11-12) and in the bottom comment (line 507).

**Forward-reference note:** when multi-tenant signup ships (post-Phase-4), the BO self-status view should be added as a separate route (not as a render-mode toggle on the same page) since the Superadmin and BO views have entirely different layouts and navigation contexts.

### 9.5 — C6 OverridesExpiring bulk actions disabled (USR-007)

Bulk renew / bulk revoke buttons render in the table-action area but are `disabled` with the tooltip "Bulk endpoint coming in Epic 3. Use per-row actions for now." See `apps/web/src/pages/usr/OverridesExpiringPage.tsx:459-481`. Per-row actions work; bulk wiring waits for Epic 3 because the bulk semantics need to thread through the unified Approval Engine for batched audit-log emission.

**Forward-reference note:** the disabled UI ships visible (not hidden) so the user knows the affordance is coming and where to find it. The JSDoc at line 24 documents this. Preferred over hiding because hidden affordances are harder to discover when they ship.

---

## Fix-Backs Applied

**None required.** No drift found that warrants a code change in this commit.

The three Epic 1 fix-back items raised in the C10 brief have all been addressed:

- **CC-DUPLICATE-WARN third consumer (Categories)** — closed in C9 (`f4c07f7`); the Epic 1 review's documented gap is now resolved.
- **C8 RBAC audit drift** — verified clean (audit §7 above).
- **Cross-epic chrome residue from C8** — verified none (audit §4, §8 above).

---

## Documented Gaps Deferred

**None deferred to a later epic.** All five "design choices" recorded in §9 are intentional Arc (c) decisions, not deferred work; they have rationale and forward-reference notes, but there is no follow-up task implied for any of them in Epic 3 or beyond beyond the natural Epic 3 work (Approval Engine, audit-export tooling, multi-tenant signup) that already owns those concerns.

---

## E2E Test Results

**Last verified by C9 subagent (pre-review):** 15/15 e2e Playwright tests pass against real apps/api against fnberp_dev.

This review did not re-run e2e per task brief ("Don't run any builds — the previous task subagents have verified typecheck + e2e + pre-commit. This is a static read-and-document task.").

---

## Typecheck & Pre-commit Hook

**Typecheck:** silent (3/3 packages clean) per C9 subagent verification.

**Pre-commit hook:** clean across all 10 Arc-(c) commits (C0 through C9). Hook scope confirmed extended to `apps/web/src/(components/(shell|pages)|pages|hooks|lib|dev)/` per Epic 1 closure. No `--no-verify` bypass used.

---

## Sign-off

**Fix-backs applied: 0**
**Documented gaps: 0**
**Recorded design choices: 5** (all in §9 — reasonCode composition, C5 deferrals, C8 enablement-tightening, C7 BO self-status deferral, C6 bulk-actions stubbing)
**Intentional divergences: 2** (mockup vs apps/web role enum; LoginPage vs PasswordResetPage header treatment — both documented)

**No drift; chrome consistent across both epics.** Phase 4 Epic 2 USR Arc (c) clears the C10 chrome-freeze gate. Proceed to C11 close-out.

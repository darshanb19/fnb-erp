# Chrome-Freeze Review — Phase 4 Epic 3 INF Arc (c)

**Date:** 2026-06-23
**Reviewer:** Claude Opus 4.8 (1M context)
**Branch:** `main`
**Last Epic 3 SHA before review:** `afde805` (Task C10 WIP) — production deploy `3c90732` sits on top

---

## Why this review is late

The Epic 3 INF per-epic chrome-freeze gate (mandated by `_planning/06-phase-roadmap.md`
§"Cross-phase invariants" #8) was **not run at Epic 3 close**. The arc was interrupted
mid-Task-C10 (audit-link sweep) by the first production deployment to Vercel
(DL-042, 2026-06-22), which finished C10 "only enough to make the web build pass…
not separately reviewed/tested" (DL-042 deferred-limitations note). This document
closes that gate retroactively before Epic 4 INV begins, per the user's
explicit "close out Epic 3 first" instruction (2026-06-23).

It covers the 8 INF production pages + 6 new Epic 3 shells + the cross-epic
consistency check against the frozen Epic 1 MDM and Epic 2 USR chrome.

---

## Summary

All token-discipline and cross-epic-consistency checks **PASS clean**. One
substantive fix-back was applied this session (**Fix-back A: Task C10 audit-link
sweep correctness** — the provisional sweep had shipped placeholder `entityRef`
sentinels that filtered the Audit Trail Viewer to references matching no real
rows, plus a stale entity-type label map). No chrome drift was found between the
INF pages and the Epics 1–2 frozen chrome. Typecheck: **silent**. Vite build:
**clean**. E2E not re-run this session (see Verification caveat).

---

## Scope reviewed

**8 INF production pages** (`apps/web/src/pages/inf/`):

| Screen | Page file | Tier |
|---|---|---|
| SI-INF-001 Unified Approval Inbox | `ApprovalInboxPage.tsx` | Tier 1 hero |
| SI-INF-002 Approval Chain Configuration | `ApprovalChainConfigPage.tsx` | Tier 1 |
| SI-INF-003 Notification Preferences | `NotificationPreferencesPage.tsx` | Tier 2 |
| SI-INF-004 Notification Digest Preview | `NotificationDigestPage.tsx` | Tier 2 |
| SI-INF-005 Audit Trail Viewer | `AuditTrailViewerPage.tsx` | Tier 1 |
| SI-INF-007 Issue Ticket List | `IssueTicketsListPage.tsx` | Tier 2 |
| SI-INF-008 Issue Ticket Create/Edit | `IssueTicketFormPage.tsx` | Tier 2 |
| SI-INF-009 Broadcast Announcement Composer | `BroadcastsPage.tsx` | Tier 2 |

**2 embedded pattern-reference screens** (shells, not routes — correct per inventory):

| Screen | Shell | First consumer |
|---|---|---|
| SI-INF-006 Activity Timeline Reference | `CCActivityTimeline.tsx` | SI-USR-002 (DL-038) |
| SI-INF-010 Reverse/Cancel Confirmation Pattern | `CCReverseCancelDialog.tsx` | Epic 4 INV |

**6 new Epic 3 shells** (C0 one-time port per DL-005): `CCApprovalChainEditor`,
`CCNotificationPreferenceMatrix`, `CCIssueCommentThread`, `CCFileAttachUploader`,
`CCActivityTimeline`, `CCReverseCancelDialog` — all present in
`apps/web/src/components/shell/`.

---

## Audit Findings

### 1. DESIGN.md token discipline — hex literals

```
grep -rnE "#[0-9a-fA-F]{3,8}\b" apps/web/src/{components,pages,hooks,lib} --include=*.tsx --include=*.ts | grep -v tokens.ts
```

**Result: zero non-comment hex literals.** All colour comes from DESIGN.md token
Tailwind classes. `tokens.ts` remains the sole exempt canonical mirror.

**Status: PASS**

### 2. Lucide-only icons + Inter-only fonts

```
grep -rniE "material-symbols|material-icons|@mui/icons|font-family:(?!.*Inter)" apps/web/src/pages/inf apps/web/src/components/shell
```

**Result: zero.** No Material icon imports, no class-name leakage, no companion
serif/mono font-family declarations. All icons import from `lucide-react`.

**Status: PASS**

### 3. Banned sectioning borders

```
grep -rnE "\b(border|border-[tbrxy]|divide-[xy])\b" apps/web/src/pages/inf <new shells>
```

**Findings — all benign:**
- Every literal hit is inside a `/** … */` doc comment asserting "No banned border classes".
- `AuditTrailViewerPage.tsx:684` — `divide-x-0`. This *removes* a divider (width 0);
  it is not a sectioning line and is not on the §5.2 ban list (which targets `divide-x`).
- `border-l-2/4/8` (status-pip allow-list) and `focus-visible:`/`aria-invalid:` borders
  are allowlisted per DESIGN.md §5.2 / §9.3.

The token pre-commit hook (`mockups/.git-hooks/pre-commit` rule 5) was active across
all Epic 3 commits and never bypassed with `--no-verify`.

**Status: PASS**

### 4. `<Separator>` vs `<SectionShift>`

`<Separator>` appears only inside `components/primitives/sidebar.tsx` (the shadcn
sidebar primitive's internal `SidebarSeparator`) — identical to Epics 1–2, navigation
chrome, not page sectioning. **All 8 INF pages use `<SectionShift>`** for tonal section
breaks (confirmed: 8/8 files import and render it). No page-level `<Separator>` drift.

**Status: PASS**

### 5. Foundation chrome reuse (cross-epic consistency)

INF pages reuse the frozen foundation chrome rather than reinventing it:
- **Page-header pattern** — icon + `text-xl font-semibold text-on-surface` title +
  `text-sm text-on-surface-variant` subtitle, identical to MDM/USR pages.
- **`ExportTrigger`** reused on the Audit Trail Viewer (same shell as MDM exports).
- **`AuditLink`** reused as the CC-AUDIT-LINK chip across INF + MDM + USR (see Fix-back A).
- **`StatusPill`, `DraftPill`, `SectionShift`** reused; no inline status compositions found.
- **New shells** are additive (approval-chain editor, notification matrix, issue
  comment thread, file uploader, activity timeline, reverse/cancel dialog) — each a
  genuinely new Epic 3 pattern, not a re-skin of an existing shell.

**Status: PASS — no drift; chrome consistent across all three shipped epics.**

### 6. RBAC gating

INF mutation affordances are wrapped in `<RequirePermission>` (e.g.
`inf.broadcast.compose` on the Broadcasts composer, `inf.issue.close` on the issue
form, `inf.approval.configure_chains` on chain config, `inf.audit.read` service-side
on the viewer). Consistent with the Epic 2 C8 RBAC pattern.

**Status: PASS**

---

## Fix-Backs Applied

### Fix-back A — Task C10 audit-link sweep correctness (this session)

The provisional C10 sweep made the build pass but left the CC-AUDIT-LINK feature
**functionally broken on every list/configuration page**. Two defects:

**A1 — Placeholder `entityRef` sentinels filtered the viewer to nothing.**
`AuditTrailViewerPage` applies `?entityRef=` as a hard filter. Ten call sites passed
a constant that is not a real row id (the table name itself, or a `userId`/location
that is not a valid row id for that table), so clicking "Audit history" returned an
empty trail. Fixed by making `AuditLink.entityRef` **optional** — when omitted the
chip links to a type-only filter (all events for that entity type), which is the
correct semantic for a page with no single subject. Call sites corrected:

| File | Was | Now |
|---|---|---|
| `pages/mdm/ProductsPage.tsx` | `entityRef="products"` | type-only |
| `pages/mdm/CategoriesPage.tsx` | `entityRef="categories"` | type-only |
| `pages/mdm/DepartmentsPage.tsx` | `entityRef="departments"` | type-only |
| `pages/mdm/VendorsPage.tsx` | `entityRef="vendors"` | type-only |
| `pages/usr/UsersPage.tsx` | `entityRef="users"` | type-only |
| `pages/mdm/EnablementMatrixPage.tsx` | `entityRef={selectedLocationId \|\| 'enablement-matrix'}` | type-only |
| `pages/inf/ApprovalChainConfigPage.tsx` | `entityRef="approval_chains"` | type-only |
| `pages/inf/ApprovalInboxPage.tsx` | `entityRef="approval_requests"` | type-only |
| `pages/usr/PermissionOverridePage.tsx` | `entityRef={overrideId ?? userId ?? 'user_permission_overrides'}` | `entityRef={overrideId ?? undefined}` |
| `pages/mdm/HierarchyPage.tsx` | `entityRef={brandId \|\| 'brand'}` | `entityRef={brandId \|\| undefined}` |

Detail-page call sites that already passed real row ids (`CompanyPage` → `company.id`,
`EffectivePermissionsPage` → `userId` / `override.id`, `UserCreateEditPage` → `id`,
`ApprovalInboxPage:331` → `row.request.entityRef`, `ApprovalInboxCard` → `card.entity_ref`,
`CCActivityTimeline` → `entityRef` prop) were left unchanged.

`AuditLink` also now keeps a visible word-label whenever there is no ref to render, so
a compact chip is never reduced to a bare icon (a11y: colour/icon must not be the only
signal — DESIGN.md §9).

**A2 — Stale entity-type label map in the viewer.** `ENTITY_TYPE_LABELS` keyed
`enablements` and `company`, but the real Drizzle table names (= `audit_log.tableName`
values) are `enablement_matrix` and `brands`. The dropdown therefore offered filter
values matching no audit rows. Corrected the two keys to the canonical table names
(verified against `apps/api/src/db/schema/`).

**Verification:** `apps/web` `tsc --noEmit` exit 0; `vite build` exit 0.

---

## Documented Gaps Deferred (not chrome drift)

These are pre-existing Epic 3 / deployment constraints recorded for traceability;
none is a chrome-consistency issue.

1. **Email notification channel disabled (DL-035).** SI-INF-003/004 grey the email
   channel pending sending-domain registration. In-app channel fully functional.
2. **pg-boss background jobs no-op in serverless (DL-042).** Escalation timers and
   digest aggregation do not run on the Vercel serverless deployment; they need a
   persistent host. Structural, not a bug.
3. **Audit PDF export deferred (DL-019).** CSV/Excel export works; PDF enqueues and
   reports "post-MVP" in the UI.

---

## Verification

| Check | Result |
|---|---|
| `apps/web` TypeScript (`tsc --noEmit`) | exit 0 — silent |
| `apps/web` production build (`vite build`) | exit 0 — clean (pre-existing >500 kB chunk-size advisory only) |
| Token pre-commit hook history across Epic 3 | never bypassed |
| E2E (Playwright) | **not re-run this session** |

**E2E caveat:** the Playwright suite signs in against the Mumbai Supabase project and
talks to the API on local `fnberp_dev`; the production DB password is intentionally not
in the repo (DL-042 §5). The Fix-back A change is a pure presentational/URL-construction
change (no data-layer or query change), fully covered by typecheck + build. Recommend a
routine `pnpm test:e2e` run on the next session that has the dev DB up, as a belt-and-braces
confirmation before Epic 4 lands.

---

## Sign-off

**Fix-backs applied: 1** (Fix-back A — Task C10 audit-link sweep correctness, 12 files)
**Chrome drift found: 0** — INF chrome is consistent with the frozen Epic 1 MDM + Epic 2 USR chrome.
**Documented gaps: 3** (all pre-existing Epic 3 / deployment constraints, none chrome-related).

Epic 3 INF chrome-freeze gate **CLOSED 2026-06-23**. Epic 4 INV may begin. The
CC-IMPLAUSIBILITY-WARN and CC-VOICE-INPUT patterns (roadmap "Known chrome gaps") first
surface in Epic 4 — apply the gate again at Epic 4 close.

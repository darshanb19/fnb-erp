# Epic 4 INV — Arc (c) Production Frontend — Design Spec

**Date:** 2026-06-23
**Phase:** Phase 4 · Epic 4 INV (Inventory Management) · Arc (c) — production frontend
**Branch:** `phase-4/epic-4-inv-arc-c-frontend` (co-located build; NOT on `main`/production until close-out deploy)
**Status:** Approved design, ready for implementation planning.

## Purpose

Turn the Epic-4 inventory mockups (Arc b) into real, routed, RBAC-gated React pages in the
production app (`apps/web`) that consume the live Arc-(a) inventory services + the foundation
chrome, replacing mockup fixtures with real data and wiring real actions (create / submit /
approve / dispatch / confirm / reject, Realtime where it genuinely applies).

**This Arc does NOT:** change the mockups, invent new Realtime channels, or merge to `main` /
deploy to production without the founder's explicit go-ahead (pushes to `main` auto-deploy to
the live site per DL-042). It makes **one narrowly-scoped backend exception only** (see
Decision 5 below): a single read-only stock-list endpoint required to back the flagship stock
view. No other backend changes.

## Context & inputs (all already built and live)

- **Arc (a) backend** — full inventory engine, live on `main`. Services in
  `apps/api/src/services/{inventory.service.ts, transfer.service.ts, trn.service.ts, journal-stub.service.ts}`;
  REST routes in `apps/api/src/routes/{stock.ts, goods-receipts.ts, stock-transfers.ts,
  inventory-adjustments.ts, closing-inventory.ts, par-levels.ts}`. 523 tests passing.
- **Arc (b) mockups** — 16 `SI-INV-*` screens + 2 new pattern shells (`CCImplausibilityWarn`,
  `CCVoiceInput`) + `mockups/src/lib/inv-sample-data.ts` fixtures. Visual targets for the
  production pages.
- **Epic 3 INF Arc (c)** — the canonical production-frontend pattern in `apps/web`
  (8 INF pages + shells). This Arc replicates that architecture exactly.

## Decisions locked in this brainstorm

1. **Build & deploy staging** — build all 16 screens **on a branch in 3 waves** with a review
   gate per wave. Nothing reaches production until the whole Epic-4 frontend is done AND the
   chrome-freeze gate passes; then a single deliberate production deploy on the founder's say-so.
2. **CCVoiceInput depth (FR112)** — **real voice, progressively enhanced**: use the browser's
   built-in Web Speech API; the mic shows and works where supported (Chrome/Edge, Safari) and
   hides where it isn't (older Firefox). No new services, no cost. Manual typing always
   available; the implausibility warning still applies regardless of input method.
3. **Pattern-shell promotion** — **port** both new shells (`CCImplausibilityWarn`,
   `CCVoiceInput`) from `mockups/src/shell/` into the production shell library
   `apps/web/src/components/shell/`, matching how Epic 3 ported its new shells. They become real
   production components (wired to backend, not fixtures).
4. **"Real-time" stock & no new Realtime channels** — the backend does not broadcast
   stock/transfer/GR changes. Reuse the existing `approval_requests` Realtime channel only
   where approval routing applies (Transfer Detail, Adjustment). For stock freshness use
   React-Query refetch (on focus / after mutation) plus the "last updated" timestamp the stock
   API already returns ("fresh as of HH:MM"), not a fake live push.
5. **One scoped backend exception — department stock-list endpoint** — grounding the plan
   revealed the live stock API exposes only single-item lookup (`GET /stock/available?itemId&departmentId`),
   expiring-batches, and movements; there is **no endpoint that lists on-hand stock for all
   items in a department**, which the flagship Real-Time Stock View (SI-INV-001, Tier-1) + its
   drill-in (SI-INV-002) require. Founder-approved exception: add **one read-only endpoint**
   `GET /api/v1/stock/department/:departmentId` that lists `{ productId, productName, quantity,
   unit, lastUpdatedAt }` for every item in a department (reads the existing `stock_levels`
   table; no new tables, no migration, no writes; brand-scoped; TDD with the API's existing test
   harness). This is the ONLY backend change in this Arc.

### Resolved planning facts (grounded against the live code)

- **API mounts:** all inventory routes are under `/api/v1/<resource>` —
  `/api/v1/stock`, `/api/v1/goods-receipts`, `/api/v1/stock-transfers`,
  `/api/v1/inventory-adjustments`, `/api/v1/closing-inventory`, `/api/v1/par-levels`
  (mirrors the INF convention).
- **RBAC gating — auth-only for inventory.** Unlike the INF routes, the inventory routes carry
  **no `requirePermission()` middleware** — they enforce only authentication + brand context
  (`req.db`), and **no `inv.*` permissions exist** in the seed catalog. Since broadening RBAC is
  a backend concern beyond the one approved exception, inventory pages are gated with
  `<RequireAuth>` only (every authenticated user in the brand can reach them — matching what the
  backend actually enforces). **Deferred:** fine-grained `inv.*` permissions + route middleware
  are a future backend story (logged as a decision, NOT built here). Inventory nav/routes are
  registered without a `<RequirePermission>` wrapper.
- **Product-name resolution.** `GET /par-levels/below` and `GET /stock/expiring` return
  `productId` without a name; `GET /api/v1/products` (existing MDM endpoint + the existing
  `hooks/mdm` products hook) returns `{ id, name, … }`. Pages that render those rows build a
  `productId → name` map from the products list. (The new department stock-list endpoint and
  `GET /stock-transfers/suggestions` already include the product name server-side.)
- **Transfer-suggestions UX constraint.** `GET /stock-transfers/suggestions` **requires both**
  `sourceDepartmentId` and `destinationDepartmentId`. SI-INV-009 is therefore a "pick a source
  and destination department → see ranked suggestions" flow, not an unscoped board (minor,
  in-bounds adaptation of the mockup; no backend change).
- **Shell delta = exactly the two named ports.** Every component the Wave-1 screens import from
  the mockup `@/shell` already exists in the production `@/components/shell`; only
  `CCImplausibilityWarn` + `CCVoiceInput` are missing, and Wave-1 screens use neither (so those
  two ports land in Wave 2, their first consumer). `FilterChipPicker` is an inline per-screen
  helper in the mockups (not a shared export) and is carried inline into each ported page.

## Architecture (follows the Epic 3 INF Arc-c pattern)

The production app is `apps/web` (Vite + React + react-router-dom + TanStack Query + Zod +
Supabase Auth; TypeScript strict). No per-page `AppShell` wrapping — each page is a
full-width self-contained route, exactly as the INF pages are.

### Per page
- **Routing:** registered in `apps/web/src/App.tsx` under `<RequireAuth>`, **without** a
  `<RequirePermission>` wrapper (see "RBAC gating — auth-only for inventory" above; the backend
  enforces auth only and no `inv.*` permissions exist). An inventory nav group is added to the
  sidebar catalog.
- **Data fetching:** typed hooks using `useApiClient()` (injects the Supabase bearer token) +
  `useQuery` for reads and `useMutation` for writes, each with a Zod schema matching the
  Arc-(a) REST envelope (`{ data, meta? }` on success; `{ code, message, details? }` on error).
- **Foundation chrome:** reuse the frozen `apps/web/src/components/shell/` set — `Table`,
  `StatusPill`, `DraftPill`, `DashboardTile`, `LifecycleStepper`, `AuditLink`, `TrnDisplay`,
  `CCReverseCancelDialog`, `CCFileAttachUploader`, `ApprovalInboxCard`, `SectionShift`,
  `Popover`, `Input`, `Button`, `Select`. No ad-hoc patterns.
- **States:** explicit loading (skeleton/`role="status"`) and error (`role="alert"`,
  `ApiError` message) states on every page; warn-and-log `meta.warnings` surfaced but
  non-blocking.

### Data-hook modules (one per backend domain — mirrors the route files)
Rejected a single "mega inventory hook" (violates the small-focused-unit rule). Create:
- `useStock` — `GET /stock/available`, `/stock/expiring`, `/stock/movements`
- `useGoodsReceipts` — list/get + `recordGoodsReceipt` / `confirm` / `reject`
- `useStockTransfers` — list/get/detail + draft / submit / approve / dispatch / confirm-receipt /
  cancel; bundles (create / approve); suggestions (list / dismiss)
- `useInventoryAdjustments` — list/get + record / confirm / cancel
- `useClosingInventory` — list/get + record / confirm / mark-variance-ok; summary; cut-off-compliance
- `useParLevels` — list + below-PAR + set / bulk-set

Each module adds query keys under a new `qk.inv.*` factory namespace in
`apps/web/src/lib/query-keys.ts`, and request/response Zod schemas matching Arc-(a) envelopes.

### The two ported shells
- **`CCImplausibilityWarn`** — port the mockup component verbatim (visual parity); wire its
  selected reason + override so they are submitted to the backend on confirm. Backend already
  enforces "reason mandatory when `warningCount > 0`" at the confirm endpoints (GR confirm,
  closing confirm, adjustment), so the UI's job is to capture and pass the reason, never to
  block submit (warn-and-log per FR114).
- **`CCVoiceInput`** — port the visual, then add a real progressive-enhancement layer:
  - Feature-detect `window.SpeechRecognition ?? window.webkitSpeechRecognition`; if absent,
    render the plain number field with no mic (no broken affordance).
  - On mic tap: start recognition (requires the existing HTTPS production context + a user
    gesture, both satisfied), show the listening strip (reduced-motion-guarded pulse retained),
    parse the transcript to a decimal number, populate the field via `onChange`, allow
    accept/cancel.
  - `inputMode="decimal"` typing path always available; voice never the only way to enter a value.
  - No new dependency; uses the browser-native API only.

## Page set — 16 screens in 3 waves

Each wave is gated: built on the branch, two-stage per-screen review, typecheck + vite build
clean at the wave gate, verified against real `tsc` / `build` / `git log` (not subagent
self-reports).

**Tier-1 acceptance rigor** applies to the founder-enumerated set: **SI-INV-003, 008, 010,
014, 015** (`015` is in `TIER_1_IDS` per the Phase-4 invariant). The Arc-(b) mockups also tag
**SI-INV-012** (QC rejection — money/vendor-credit stakes) and the foundation **SI-INV-007** as
Tier-1 heroes. **Planning resolves the exact Tier-1 set against the authoritative
`_planning/05-screen-inventory.md`** and treats any screen carrying the Tier-1 tag there with
full Tier-1 acceptance; the founder-enumerated five are the floor, not the ceiling.

### Wave 1 — "see" (read-only views & dashboards)
| Screen | Title | Backend it calls | Notes |
|---|---|---|---|
| SI-INV-001 | Real-Time Stock View *(Tier 1)* | `GET /stock/available`, `/stock/expiring` | FR25; "fresh as of" timestamp; FEFO expiry bands |
| SI-INV-002 | Department Stock Detail | `/stock/available`, `/stock/movements`, batches | FEFO batch table + 30-day movement history; links to transfer/adjust |
| SI-INV-003 | Below-PAR Flag List *(Tier 1)* | `GET /par-levels/below` | FR34; urgency bands; day-of-week-adjusted PAR |
| SI-INV-008 | Expiry Countdown Dashboard *(Tier 1)* | `GET /stock/expiring` | FR30; 24/48/72h bands; value-at-risk; suggestion-type badges |
| SI-INV-009 | Cross-Location Transfer Suggestions | `GET /stock-transfers/suggestions`, dismiss | FR32; single-hop vs paired; dismissal |
| SI-INV-016 | Closing Inventory Cluster Review | `GET /closing-inventory/summary`, `/cut-off-compliance` | Cluster-wide; cut-off compliance (IST); not-submitted pane |

### Wave 2 — "move" (config + transfers)
| Screen | Title | Backend it calls | Notes |
|---|---|---|---|
| SI-INV-004 | PAR Level Configuration | `POST /par-levels`, `/par-levels/bulk`, `GET /par-levels` | FR33; matrix; day-of-week overrides; bulk-set |
| SI-INV-005 | Stock Transfer Create | `POST /stock-transfers` (+ suggestions prefill) | FR28 flow rules; CCVoiceInput + CCImplausibilityWarn + CCDuplicateWarn; submit → approval when over threshold |
| SI-INV-006 | Stock Transfer Detail & Status | `GET /stock-transfers/:id`, submit/approve/dispatch/confirm-receipt/cancel | LifecycleStepper; approval Realtime; CCReverseCancelDialog (FR117) |
| SI-INV-007 | Paired Cross-Cluster Transfer *(Tier 1)* | `POST /stock-transfers/bundles`, `/bundles/:id/approve` | Cross-cluster Brand-Store routing; single approval → dual transfers |

### Wave 3 — "record" (receipt + adjust + count)
| Screen | Title | Backend it calls | Notes |
|---|---|---|---|
| SI-INV-010 | Goods Receipt Entry — PO-Driven *(Tier 1)* | `POST /goods-receipts`, `/:id/confirm`, `/:id/reject` | FR27 yield; FR114/115 warn-and-log; CCVoiceInput; CCFileAttachUploader (FR39); QC reject → 012 |
| SI-INV-011 | Goods Receipt Entry — Transfer-Driven | `POST /goods-receipts` (transfer-sourced) | Variance vs dispatched; CCVoiceInput; mandatory reason on variance |
| SI-INV-012 | Goods Receipt Rejection at QC *(Tier 1)* | `POST /goods-receipts/:id/reject` | Mandatory rejection reasons; evidence upload; VCN preview (Epic 5 stub, visual only) |
| SI-INV-013 | Inventory Adjustment | `POST /inventory-adjustments`, `/:id/confirm`, `/:id/cancel` | FR37 mandatory reason; value-impact → approval routing; CCImplausibilityWarn; CCReverseCancelDialog |
| SI-INV-014 | Closing Inventory Entry — POS Daily *(Tier 1)* | `POST /closing-inventory`, `/:id/confirm`, `/cut-off-compliance` | FR35/36/77; cut-off countdown (IST, DL-046); CCVoiceInput; variance reasons |
| SI-INV-015 | Closing Inventory Entry — Dispatch Daily *(Tier 1)* | same as 014, Dispatch context | Sibling of 014; expected = production received − dispatched |

## Approvals, reversals, cross-epic seams

- **Approval routing** — over-threshold transfers (`submitTransfer`) and adjustments
  (`recordAdjustment`) already return `status: 'pending_approval'` + an approval request id from
  the backend (which calls the Epic-3 Unified Approval Engine). The page surfaces this and routes
  the user to the existing Epic-3 Approval Inbox (SI-INF-001). **No inventory-specific approval
  UI** (CLAUDE.md rule). Approval decisions flow back via the `approval_requests` Realtime channel.
- **Reverse / cancel (FR117)** — reuse `CCReverseCancelDialog`: clean cancel from
  `draft`/`pending_approval`; compensating-document path after dispatch/confirm. The backend
  returns `TransferLifecycleError` / `AdjustmentLifecycleError` (422) on invalid transitions —
  the UI gates the affordances by status and surfaces those errors.
- **Cross-epic seams the UI must NOT assume exist** — Purchase Orders (Epic 5; `poId` optional,
  no FR114 ordered-qty unless supplied), vendor Credit Notes (Epic 5; VCN preview is visual-only
  stub), real journals (Epic 10), production deductStock caller (Epic 7), recipe/POS expected
  counts (Epics 6/9; closing "expected" computes from the movement ledger with those inputs
  stubbed to 0). Screens render these as stubs/placeholders matching the mockups, never as live data.

## Testing

The production app's test layer is Playwright happy-path e2e
(`apps/web/tests/e2e/*.spec.ts`, the 7 MDM specs; single-threaded, pre-authenticated bootstrap
session, requires `apps/api` + dev DB running). Approach:

- **Add e2e happy-path specs for the Tier-1 hero screens** — the founder-enumerated five (003,
  008, 010, 014, 015) at minimum, extended to any additional Tier-1-tagged screen the planning
  step confirms (e.g. 012) — following the existing MDM spec pattern
  (`getByRole`/`getByLabel`/`getByText`, explicit timeouts, no CSS selectors).
- Rely on real `tsc --noEmit` + `vite build` + the per-screen two-stage review gate for the
  remaining screens.
- Every implementation task verified against actual command output and `git log`, never against
  subagent self-reports.

## Guardrails (token discipline & invariants — enforced)

- No hex literals (DESIGN.md tokens only). Lucide-only icons. Inter-only font. Closed 20-token
  `status_*` palette (inventing one is stop-the-line). No sectioning borders (allow-list per
  CLAUDE.md). Motion: NO entrance animations on inventory/transaction screens — the sole motion
  is CCVoiceInput's reduced-motion-guarded listening pulse. `tenant_brand_accent` decorative-only.
- TypeScript strict, zero `any`. Every org-scoped query includes `brand_id` (enforced
  server-side by the branded DB; client never sends a cross-brand filter).
- Route approvals through the Epic-3 Unified Approval Engine and notifications through the
  Epic-3 Notification Center — never per-module.

## Close-out

- New micro-decisions captured from **DL-048** onward. Expected at minimum: voice-input depth
  (real, progressive Web Speech API), the no-new-Realtime-channel / honest-freshness call, and
  the two-shell port into the production shell library.
- At Arc (c) end run the **Epic-4 chrome-freeze review gate** (cross-epic chrome consistency);
  any drift = mandatory fix-back before Epic 4 closes.
- Update `## Current phase` in `CLAUDE.md` in the same commit that crosses the Arc boundary
  (Phase-boundary discipline).
- Hand the branch to the founder for the single, deliberate production deploy. **No merge to
  `main` / no deploy without explicit go-ahead.**

## Definition of done

- All 16 `SI-INV` production pages routed, permission-gated, consuming real Arc-(a) services,
  visually matching their Arc-(b) mockups; mockup fixtures removed from the production path.
- `CCImplausibilityWarn` + `CCVoiceInput` ported into `apps/web/src/components/shell/` and
  consumed by the relevant screens; CCVoiceInput's real progressive Web Speech API working.
- Approval routing, reverse/cancel, warn-and-log, FEFO/yield/cut-off behaviors surfaced
  correctly per the FR set.
- e2e specs added for the Tier-1 heroes (founder-enumerated five + any others planning
  confirms); `tsc --noEmit` silent + `vite build` clean at each wave gate.
- Token discipline held (hook clean); chrome-freeze gate signed off; DL-048+ logged;
  `CLAUDE.md` current-phase updated.
- Branch ready for founder-authorized production deploy.

## Out of scope

Backend changes **other than the single read-only `GET /stock/department/:departmentId`
endpoint** (Decision 5). Fine-grained `inv.*` RBAC permissions + route middleware (deferred
backend story). Mockup changes. New Realtime channels. Merge to `main` / production deploy
without explicit founder go-ahead. Epic-5/6/7/9/10 seams (PO, VCN, recipe/POS counts, real
journals, production caller) beyond the visual stubs already present in the mockups.

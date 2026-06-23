# Epic 4 INV — Arc (c) Production Frontend — Wave 2 ("move") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 4 Wave-2 inventory "move" pages (SI-INV-004 PAR Config, SI-INV-005 Transfer Create, SI-INV-006 Transfer Detail, SI-INV-007 Paired Cross-Cluster Transfer) into `apps/web`, consuming live Arc-(a) transfer/PAR/bundle services, plus the inventory **write** data layer and the two new pattern shells (`CCImplausibilityWarn`, `CCVoiceInput`) ported into the production shell.

**Architecture:** Mirror the Epic-3 INF Arc-(c) + the Wave-1 pattern exactly — each screen is a full-width routed page under `<RequireAuth>` (auth-only; NO `<RequirePermission>` — DL-049), fed by typed `useApiClient` + TanStack Query hooks (queries + mutations) with Zod schemas matching the REST envelopes, reusing the frozen `@/components/shell` chrome. Port each Wave-2 mockup from `mockups/src/screens/inv/` into `apps/web/src/pages/inv/`, swapping the mockup shell alias + fixtures for the production shell + real hooks. One scoped, read-only backend endpoint (`GET /api/v1/stores`) is added (founder-authorized, **DL-050**) to back SI-INV-007.

**Tech Stack:** Vite + React + react-router-dom + TanStack Query v5 + Zod + Supabase Auth (frontend); Express + Drizzle + vitest (backend). TypeScript strict throughout.

**Spec:** `docs/superpowers/specs/2026-06-23-epic-4-inv-arc-c-frontend-design.md`
**Wave-1 plan (canonical pattern to mirror):** `docs/superpowers/plans/2026-06-23-epic-4-inv-arc-c-wave1.md`
**SDD ledger:** `.superpowers/sdd/progress.md`

## Global Constraints

Every task implicitly includes all of these (exact values from the spec + CLAUDE.md + Wave-1 hard-won lessons):

- **TypeScript strict, zero `any`.** No `any` types anywhere.
- **Token discipline.** No hex literals (DESIGN.md tokens only). Lucide-only icons (`lucide-react`). Inter-only font (no inline `font-family`). Closed 20-token `status_*` palette — inventing a status name is stop-the-line. No sectioning borders (`border`, `border-t/-b/-r/-x/-y`, `divide-y/-x`) except the allow-list: `border-l-2/-l-4/-l-8` status pips, and `focus:`/`focus-visible:`/`aria-invalid:` rings (`border-2` only when paired with `focus-visible:`). Use `<SectionShift>` for tonal breaks, never `<Separator>`.
- **Motion policy.** NO entrance animations on inventory tables/forms/dashboards. The ONLY animation in the whole Arc is `CCVoiceInput`'s listening pulse — `animate-pulse motion-reduce:animate-none` on the indicator dots only. `animate-pulse` loading skeletons are allowed (loading affordance, not entrance).
- **`tenant_brand_accent` is decorative-only** — never a status/state colour.
- **Every org-scoped query includes `brand_id`** — enforced server-side by the branded DB; the client never sends a cross-brand filter.
- **RBAC:** inventory pages are gated with `<RequireAuth>` only — NO `<RequirePermission>` wrapper (backend enforces auth only; no `inv.*` permissions exist — DL-049).
- **Routes are semantic under `/inventory/...`** (mirroring Wave 1's `/inventory/stock`, `/inventory/below-par`, etc.).
- **Envelope rule (CRITICAL — verified against `apps/web/src/lib/api-client.ts:160-191`):** `client.get/post({ schema })` parses the **entire** response body against `schema` — it does NOT auto-unwrap `{ data }`.
  - **Stock-transfers + par-levels endpoints return `{ data: <result> }`** → hooks pass `envelope(<inner>)` (helper in `hooks/inv/schemas.ts`) + `.then(r => r.data)`.
  - **Org/MDM list endpoints return the body BARE** (no `data` wrapper): `GET /clusters`, `/locations`, `/departments`, `/uoms`, `/products`, and the new `GET /stores` all `res.json(await ...)`. Their hooks pass the bare schema, NO envelope. **A wrong envelope is a runtime crash tsc cannot catch.**
- **Rules of Hooks (eslint is NOT installed — not auto-caught):** place EVERY hook (`useState`/`useMemo`/`useMutation`/`use*` data hooks) ABOVE the early loading/error/guard returns in the MAIN component. A Wave-1 page crashed on this exact mistake.
- **No inert / unbacked controls.** A filter chip / button the live endpoint cannot back is a defect, not a divergence — REMOVE it (record the removal in the commit message). Deferred actions render clearly `disabled` with a `title`. Never fabricate data; absent fields render `—`.
- **No Radix `Select` in `apps/web`.** The production app has **no** `@/components/ui/select` primitive (Wave-1 used native `<select>`). Every mockup `Select`/`SelectTrigger`/`SelectContent`/`SelectItem` import becomes a token-styled **native `<select>`** on port. This includes the `CCImplausibilityWarn` port (Task 3).
- **Verify against reality, never self-reports:** every task's verification runs the real command (`npm run test`, `npx tsc --noEmit`, `npm run build`, `git log`) and reads its output. Sanity-check that any review file targets the right screen.
- **Commit per task.** Conventional commit messages, scoped `feat(inv)` / `feat(api)` / `test(inv)`. End every commit message with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Branch:** all work on `phase-4/epic-4-inv-arc-c-frontend`. NEVER commit to `main` (auto-deploys to production). NO merge / NO deploy without explicit founder go-ahead.
- **Commands run from the package dir:** backend commands from `apps/api/`; frontend commands from `apps/web/`.

---

## File Structure

**Backend (one read-only addition — DL-050):**
- Modify: `apps/api/src/services/org.service.ts` — add `listStores(db): Promise<Store[]>`.
- Modify: `apps/api/src/routes/index.ts` — register `storesRouter` under `/stores`.
- Create: `apps/api/src/routes/stores.ts` — `GET /stores` (bare `res.json(rows)`).
- Create: `apps/api/tests/integration/stores-list.test.ts` — TDD for the new method.

**Frontend data layer (extend Wave-1 modules + one new file):**
- Modify: `apps/web/src/lib/query-keys.ts` — add `qk.inv` write/detail/org keys.
- Modify: `apps/web/src/hooks/inv/schemas.ts` — add transfer detail/list, lifecycle/create results, bundle results, PAR list/set results, org-list schemas.
- Modify: `apps/web/src/hooks/inv/useStockTransfers.ts` — add `useTransferDetail`, `useTransferList`, and mutations.
- Modify: `apps/web/src/hooks/inv/useParLevels.ts` — add `useParLevelsList`, `useSetParLevel`, `useBulkSetParLevel`.
- Modify: `apps/web/src/hooks/inv/useProductNames.ts` — widen `useInventoryDepartments` to `{ id, name, code, locationId, type }`.
- Create: `apps/web/src/hooks/inv/useOrgLists.ts` — `useInventoryClusters`, `useInventoryUoms`, `useInventoryStores`.

**Frontend shells (port mockup → production shell):**
- Create: `apps/web/src/components/shell/CCImplausibilityWarn.tsx` (+ export in `index.ts`).
- Create: `apps/web/src/components/shell/CCVoiceInput.tsx` (+ export in `index.ts`).

**Frontend pages (port from mockups):**
- Create: `apps/web/src/pages/inv/ParLevelConfigPage.tsx` (SI-INV-004)
- Create: `apps/web/src/pages/inv/StockTransferCreatePage.tsx` (SI-INV-005)
- Create: `apps/web/src/pages/inv/StockTransferDetailPage.tsx` (SI-INV-006)
- Create: `apps/web/src/pages/inv/PairedTransferPage.tsx` (SI-INV-007)
- Modify: `apps/web/src/App.tsx` — register 4 routes + HomePage nav entries.

**Frontend e2e (Tier-1 hero — SI-INV-007):**
- Create: `apps/web/tests/e2e/inv-paired-transfer.spec.ts`

### Page-port procedure (applies to every page task — identical to Wave 1)

Each page task is a **port**, not a rewrite. The mockup file is the complete visual source of truth (already token-clean and shell-based). For each page:

1. Copy the mockup's JSX structure and sub-components (`FilterChipPicker`, pips, cards, table rows, `StorePicker`, etc.) verbatim into the new page file.
2. **Swap the shell import** `from '@/shell'` → `from '@/components/shell'`. Swap any mockup `Select` import (`@/components/ui/select`) for a **native `<select>`** (no such primitive in prod).
3. **Delete the fixture imports** from `@/lib/sample-data` / `@/lib/inv-sample-data` and the fixture-derived `const … = (() => {…})()` blocks.
4. **Replace them with hook-derived data** of the same row shape (the precise mapping code is given per task), including a `productId → name` join where the task says so. Place ALL hooks ABOVE the loading/error guards.
5. **Swap mockup links** `to="/SI-INV-00X?…"` → the real `/inventory/...` route; `to="/SI-INF-001…"` → `/approvals/inbox`.
6. **Add loading + error + empty states** (shared JSX below; identical across pages). When a page resolves product/dept names via a `nameOf` hook, include its `isLoading` in the loading guard so rows never flash raw UUIDs.
7. **Wire real actions** (mutations) per the task; surface mutation `isPending`/`error`; gate affordances by status; route approval-bound submits to `/approvals/inbox`.
8. **Remove every unbacked control** (filter chips the endpoint can't back, fixture-only demo pickers, fabricated columns). Render genuinely deferred actions `disabled` with a `title`. Record removals in the commit message.
9. Register the route in `App.tsx` and add a HomePage nav entry.
10. Verify `npx tsc --noEmit` + `npm run build`; for the Tier-1 page (007) add + run the e2e spec.
11. Commit.

**Shared loading/error JSX** (use verbatim in every page, swapping the page title):

```tsx
// imports: import { ApiError } from '@/lib/api-client'
// at top of the returned component, AFTER all hooks, BEFORE the main render:
if (isLoading) {
  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8">
        <div role="status" aria-label="Loading" className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-md bg-surface-container-low animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  )
}
if (error) {
  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8">
        <div role="alert" className="rounded-md bg-error-container p-6 text-on-error-container">
          <p className="text-sm font-medium">
            {error instanceof ApiError ? error.message : 'Failed to load. Please retry.'}
          </p>
        </div>
      </div>
    </div>
  )
}
```

`ApiError` is imported from `@/lib/api-client`.

### Wave-2 divergence ledger (consume the backend AS-IS; never fabricate)

These are the deliberate, documented gaps between the Arc-(b) mockups and the live Arc-(a) backend. Each affected task names what it drops/changes and why; the commit message records it.

- **SI-INV-004:** Drop the scope/product-type/category filter chips (mockup marks them "visual chrome only" — no backing field). Drop the FR111 "drift recommendation" badge + accept/ignore buttons (Epic-12 AI seam, no backend). The matrix is built from **department-scoped** PAR rows (`departmentId != null`); location-scoped / brand-wide rows are shown in a small secondary list. "Confirm changes" calls `bulkSetParLevel` with only the changed rows.
- **SI-INV-005:** "Available" + implausibility are computed from **department on-hand stock** (`useDepartmentStock`), not batch-level fixtures. FR28 cross-cluster destination-disabling is **not** replicated client-side (the frontend has no dept→cluster map) — all departments are offered as destinations and the **backend** enforces FR28/§5 (`ClusterBoundaryError`/`FlowDirectionError`/`EnablementViolationError`), surfaced as the form error. `CCImplausibilityWarn` is **client-advisory only** here (warn-and-log, never blocks): the transfer-create endpoint has no plausibility-reason field, so the override is acknowledged client-side and NOT sent (only the line's transfer `reasonCode` is sent). `CCDuplicateWarn` matches are computed from the transfer **list** endpoint (same source department + same business date) — not line-item identical.
- **SI-INV-006:** Remove the fixture demo `StatusPicker`; replace with a real **recent-transfers picker** (from `GET /stock-transfers`) + `:id` route param. Line table shows what the real `stock_transfer_lines` carry (item name, requested, fulfilled, reason); drop the batch-number/expiry-date/expiry-band columns (not on transfer lines). Reverse/cancel is **backed only pre-dispatch** (`draft`/`pending_approval` → `cancelTransfer`); post-dispatch reverse (compensating document) has no backend and renders as a disabled affordance with an explanatory `title`.
- **SI-INV-007:** The backend bundle service takes **one product per bundle** → the production screen is a **single-item bundle** (not the mockup's 3 lines). Store/cluster pickers are backed by the new `GET /stores` (DL-050) + `GET /clusters` + `GET /uoms`. Submit = `createBundledTransfer` (returns `bundleRef`); approval = the direct `POST /bundles/:id/approve` (`confirmBundleApproval` decomposes into 2 transfers) — the Arc-(a) bundle path does NOT create an Epic-3 `approval_request`, so there is no inbox routing for bundles (surfaced inline with the bundle ref + decomposed transfer ids). Drop the destination/source consumption fixture panels' hard-coded numbers (render as static explanatory copy only, no fabricated metrics) OR omit them; keep `PairedTransferBundle` fed by the real single line.

---

## Task 1: Backend — read-only `GET /stores` list endpoint (DL-050)

**Files:**
- Modify: `apps/api/src/services/org.service.ts` (add `listStores` near `listClusters` ~line 170)
- Create: `apps/api/src/routes/stores.ts`
- Modify: `apps/api/src/routes/index.ts` (import + `apiRouter.use('/stores', storesRouter)`)
- Test: `apps/api/tests/integration/stores-list.test.ts` (create)

**Interfaces:**
- Produces: `orgService.listStores(db: BrandedDb): Promise<Store[]>` where `Store = typeof stores.$inferSelect` (`{ id, brandId, level, clusterId, name, active, createdAt, updatedAt }`).
- Produces: `GET /api/v1/stores` → **bare** `Store[]` (mirrors `GET /clusters` which is `res.json(await orgService.listClusters(...))`). Consumed by `useInventoryStores` (Task 2).

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/integration/stores-list.test.ts`. Mirror the harness used by `stock-department-list.test.ts` (`setupIntegration`, `getTestBrandedDb`, `truncateTestTables`, `unscopedDb`). Seed a cluster + a brand-level store + a cluster-level store; assert `listStores` returns both, brand-scoped, with `level`/`clusterId`/`name`. Add a cross-brand isolation case (seed a store under a second brand; assert it is NOT returned).

```ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import {
  setupIntegration,
  teardownIntegration,
  truncateTestTables,
  getTestBrandedDb,
} from './setup.js'
import { unscopedDb } from '../../src/db/client.js'
import { clusters, stores } from '../../src/db/schema/org.js'
import { orgService } from '../../src/services/org.service.js'

beforeAll(async () => {
  await setupIntegration()
  await truncateTestTables()
})
afterAll(async () => {
  await teardownIntegration()
})
afterEach(async () => {
  await truncateTestTables()
})

describe('orgService.listStores', () => {
  it('lists brand + cluster level stores for the brand, scoped', async () => {
    const { db, testBrandId } = getTestBrandedDb()
    const raw = unscopedDb()
    const [cluster] = await raw.insert(clusters)
      .values({ brandId: testBrandId, name: 'C1', active: true })
      .returning({ id: clusters.id })
    await raw.insert(stores).values([
      { brandId: testBrandId, level: 'brand', clusterId: null, name: 'Brand Store', active: true },
      { brandId: testBrandId, level: 'cluster', clusterId: cluster!.id, name: 'C1 Store', active: true },
    ])
    const result = await orgService.listStores(db)
    expect(result).toHaveLength(2)
    const byName = Object.fromEntries(result.map((s) => [s.name, s]))
    expect(byName['Brand Store']!.level).toBe('brand')
    expect(byName['Brand Store']!.clusterId).toBeNull()
    expect(byName['C1 Store']!.level).toBe('cluster')
    expect(byName['C1 Store']!.clusterId).toBe(cluster!.id)
  })

  it('does not return another brand\'s stores', async () => {
    const { db, testBrandId } = getTestBrandedDb()
    const raw = unscopedDb()
    // seed a store under the test brand and one under a different brand id
    await raw.insert(stores).values([
      { brandId: testBrandId, level: 'brand', clusterId: null, name: 'Mine', active: true },
      { brandId: '00000000-0000-0000-0000-0000000000aa', level: 'brand', clusterId: null, name: 'Theirs', active: true },
    ])
    const result = await orgService.listStores(db)
    expect(result.map((s) => s.name)).toEqual(['Mine'])
  })
})
```

> **Verify before finishing:** open `apps/api/tests/integration/stock-department-list.test.ts` to confirm the exact `getTestBrandedDb()` return keys (`db`, `testBrandId`) and the `setup.js` export names; match them. If the harness lacks a stray-brand insert helper, the literal UUID above is fine (it is a valid v4-shaped UUID and a different brand id than the test brand).

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && npm run test -- stores-list.test.ts`
Expected: FAIL — `orgService.listStores is not a function`.

- [ ] **Step 3: Implement the service method**

In `apps/api/src/services/org.service.ts`, add near `listClusters`. Use the same `scopedFrom` pattern the other `list*` methods use:

```ts
async listStores(db: BrandedDb): Promise<Store[]> {
  return (await db.scopedFrom(stores)) as unknown as Store[]
},
```

Add the imports if missing: `stores` from `../db/schema/org.js` and the `Store` type. If `Store` is not exported from the schema, add `export type Store = typeof stores.$inferSelect` in `apps/api/src/db/schema/org.ts` (mirror the `Cluster` type export), or define it locally in the service.

> **Verify:** confirm how `listClusters` reads (`db.scopedFrom(clusters)` vs an order-by). Mirror it. If the codebase orders list results by name, add `.orderBy(stores.name)` for consistency — read `listClusters` first and match its shape.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && npm run test -- stores-list.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the route + register it**

Create `apps/api/src/routes/stores.ts` (mirror `clusters.ts`'s bare GET):

```ts
/**
 * stores router — read-only list for the brand's Brand/Cluster stores.
 * Epic 4 Arc (c) Wave 2 — DL-050 (founder-authorized scoped read endpoint to
 * back SI-INV-007 paired cross-cluster transfer store pickers). No writes.
 */
import { Router, type Router as ExpressRouter } from 'express';
import { orgService } from '../services/org.service.js';

export const storesRouter: ExpressRouter = Router();

storesRouter.get('/', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' });
      return;
    }
    res.json(await orgService.listStores(req.db));
  } catch (e) {
    next(e);
  }
});
```

In `apps/api/src/routes/index.ts`, add the import (next to `clustersRouter`) and the mount (next to `apiRouter.use('/clusters', clustersRouter)`):

```ts
import { storesRouter } from './stores.js';
// ...
apiRouter.use('/stores', storesRouter);
```

- [ ] **Step 6: Full API suite — no regressions**

Run: `cd apps/api && npm run test`
Expected: all prior tests pass + the 2 new ones (527+ passing). Read the summary line.

- [ ] **Step 7: Typecheck the API package**

Run: `cd apps/api && npm run typecheck`
Expected: no output (silent success).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/services/org.service.ts apps/api/src/routes/stores.ts apps/api/src/routes/index.ts apps/api/tests/integration/stores-list.test.ts apps/api/src/db/schema/org.ts
git commit -m "feat(api): read-only GET /stores list endpoint (DL-050)

Lists the brand's Brand/Cluster stores (id, name, level, clusterId),
brand-scoped, read-only — no new tables, no migration, no writes. The
second scoped backend exception in Epic 4 Arc (c) (founder-authorized),
to back the SI-INV-007 paired cross-cluster transfer store pickers.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Frontend inventory write/detail/org data layer

**Files:**
- Modify: `apps/web/src/lib/query-keys.ts`
- Modify: `apps/web/src/hooks/inv/schemas.ts`
- Modify: `apps/web/src/hooks/inv/useStockTransfers.ts`
- Modify: `apps/web/src/hooks/inv/useParLevels.ts`
- Modify: `apps/web/src/hooks/inv/useProductNames.ts`
- Create: `apps/web/src/hooks/inv/useOrgLists.ts`

**Interfaces:**
- Consumes: `useApiClient` from `@/hooks/use-api-client`; `useSession` from `@/lib/auth`; `qk` from `@/lib/query-keys`; `envelope` from `./schemas`; `useMutation`/`useQueryClient` from `@tanstack/react-query`.
- Produces (consumed by Tasks 5–8):
  - `useTransferDetail(id?: string)` → `UseQueryResult<TransferDetail>`
  - `useTransferList(filter?: { status?: TransferStatus })` → `UseQueryResult<TransferListItem[]>`
  - `useCreateTransfer()` → mutation `(input: CreateTransferInput) => Promise<CreateTransferResult>`
  - `useSubmitTransfer()` / `useApproveTransfer()` / `useDispatchTransfer()` / `useCancelTransfer()` → mutation `(transferId: string) => Promise<{ status: string }>`
  - `useConfirmReceipt()` → mutation `({ transferId, quantities?, varianceReasons? }) => Promise<{ status: string }>`
  - `useCreateBundle()` → mutation `(input: CreateBundleInput) => Promise<CreateBundleResult>`
  - `useApproveBundle()` → mutation `(bundleId: string) => Promise<{ transferIds: string[] }>`
  - `useParLevelsList(filter?: { locationId?: string })` → `UseQueryResult<ParLevelRow[]>`
  - `useSetParLevel()` → mutation `(input: SetParLevelInput) => Promise<ParLevelRow>`
  - `useBulkSetParLevel()` → mutation `(rows: SetParLevelInput[]) => Promise<{ count: number }>`
  - `useInventoryClusters()` → `UseQueryResult<{ id: string; name: string }[]>`
  - `useInventoryUoms()` → `UseQueryResult<{ id: string; code: string; displayName: string }[]>`
  - `useInventoryStores()` → `UseQueryResult<Store[]>`
  - (widened) `useInventoryDepartments()` → now returns rows `{ id, name, code, locationId, type }`

- [ ] **Step 1: Add query keys**

In `apps/web/src/lib/query-keys.ts`, extend the existing `inv` namespace with (place inside the `inv: { … }` object):

```ts
    transfers: {
      list: (filter: object) => ['inv', 'transfers', 'list', filter] as const,
      detail: (id: string) => ['inv', 'transfers', 'detail', id] as const,
    },
    parList: (filter: object) => ['inv', 'parList', filter] as const,
    clusters: () => ['inv', 'clusters', 'minimal'] as const,
    uoms: () => ['inv', 'uoms', 'minimal'] as const,
    stores: () => ['inv', 'stores', 'minimal'] as const,
```

> Keep distinct from any existing key. Wave-1 already added `inv.stock.*`, `inv.belowPar`, `inv.suggestions`, `inv.closing.*`, `inv.productNames`, `inv.departments` (`['inv','departments','minimal']`), `inv.locations` (`['inv','locations','minimal']`). Do NOT collide.

- [ ] **Step 2: Add the Zod schemas**

In `apps/web/src/hooks/inv/schemas.ts`, append (the `envelope` helper already exists). Numeric DB columns serialize as strings → use `z.coerce.number()`:

```ts
// ── Stock transfer detail / list (GET /stock-transfers/:id, GET /stock-transfers) ──
export const transferStatusEnum = z.enum([
  'draft', 'pending_approval', 'approved', 'in_transit', 'received', 'cancelled',
])
export type TransferStatus = z.infer<typeof transferStatusEnum>

export const transferLineSchema = z.object({
  id: z.string().uuid(),
  stockTransferId: z.string().uuid(),
  productId: z.string().uuid(),
  requestedQty: z.coerce.number(),
  fulfilledQty: z.coerce.number().nullable(),
  sourceBatchId: z.string().uuid().nullable(),
  reasonCode: z.string().nullable(),
})
export type TransferLine = z.infer<typeof transferLineSchema>

export const transferHeaderSchema = z.object({
  id: z.string().uuid(),
  stTrn: z.string(),
  sourceDepartmentId: z.string().uuid(),
  destinationDepartmentId: z.string().uuid(),
  status: transferStatusEnum,
  reasonCode: z.string().nullable(),
  bundleLegId: z.string().uuid().nullable(),
  requestedByUserId: z.string().uuid().nullable(),
  requestedAt: z.string().nullable(),
  approvalRequestId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type TransferListItem = z.infer<typeof transferHeaderSchema>

export const transferDetailSchema = transferHeaderSchema.extend({
  lines: z.array(transferLineSchema),
})
export type TransferDetail = z.infer<typeof transferDetailSchema>

export const transferListSchema = z.array(transferHeaderSchema)

// ── Create / lifecycle / bundle result envelopes (POST endpoints, all `{ data }`) ──
export const createTransferResultSchema = z.object({
  transferId: z.string().uuid(),
  stTrn: z.string(),
  status: z.string(),
})
export type CreateTransferResult = z.infer<typeof createTransferResultSchema>

export const transferStatusResultSchema = z.object({ status: z.string() })

export const createBundleResultSchema = z.object({
  bundleId: z.string().uuid(),
  bundleRef: z.string(),
})
export type CreateBundleResult = z.infer<typeof createBundleResultSchema>

export const approveBundleResultSchema = z.object({
  transferIds: z.array(z.string().uuid()),
})

// ── PAR list / set (GET /par-levels, POST /par-levels, POST /par-levels/bulk) ──
export const dayOfWeekOverridesSchema = z.object({
  mon: z.number().int().optional(),
  tue: z.number().int().optional(),
  wed: z.number().int().optional(),
  thu: z.number().int().optional(),
  fri: z.number().int().optional(),
  sat: z.number().int().optional(),
  sun: z.number().int().optional(),
})
export const parLevelRowSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  locationId: z.string().uuid().nullable(),
  departmentId: z.string().uuid().nullable(),
  basePar: z.coerce.number(),
  dayOfWeekOverrides: dayOfWeekOverridesSchema.nullable(),
  lastModifiedByUserId: z.string().uuid().nullable(),
  lastModifiedAt: z.string(),
})
export type ParLevelRow = z.infer<typeof parLevelRowSchema>
export const parLevelListSchema = z.array(parLevelRowSchema)
export const bulkParResultSchema = z.object({ count: z.number() })

// ── Org lists (BARE — no envelope) ──
export const inventoryDepartmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string().nullable().optional(),
  locationId: z.string().uuid(),
  type: z.string(),
})
export const inventoryDepartmentListSchema = z.array(inventoryDepartmentSchema)
export type InventoryDepartment = z.infer<typeof inventoryDepartmentSchema>

export const clusterMinimalSchema = z.object({ id: z.string().uuid(), name: z.string() })
export const clusterListSchema = z.array(clusterMinimalSchema)

export const uomMinimalSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  displayName: z.string(),
})
export const uomListSchema = z.array(uomMinimalSchema)

export const storeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  level: z.enum(['brand', 'cluster']),
  clusterId: z.string().uuid().nullable(),
})
export type Store = z.infer<typeof storeSchema>
export const storeListSchema = z.array(storeSchema)
```

> **Verify before finishing:** open `apps/api/src/routes/stock-transfers.ts` + `transfer.service.ts` + `par-levels.ts` and confirm each field above matches the actual returned object (statuses, result keys, numeric-as-string). Do not guess — the field names above were read from the live service/route, but re-confirm after any backend drift.

- [ ] **Step 3: Widen `useInventoryDepartments`**

In `apps/web/src/hooks/inv/useProductNames.ts`, change the departments hook's schema from the minimal `{ id, name }` to `inventoryDepartmentListSchema` (import it from `./schemas`) and update its return type to `InventoryDepartment[]`. Keep the SAME query key (`qk.inv.departments()` / `['inv','departments','minimal']`) — the endpoint already returns these fields; widening the schema only stops stripping them. Existing Wave-1 consumers that read `{ id, name }` are unaffected (extra fields are additive).

> If the current hook hard-codes a local `z.array(z.object({ id, name }))`, replace it with the imported `inventoryDepartmentListSchema`. Confirm the bare-vs-envelope handling is unchanged (departments is BARE).

- [ ] **Step 4: Add transfer queries + mutations**

In `apps/web/src/hooks/inv/useStockTransfers.ts`, add (keep the existing `useTransferSuggestions`):

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/use-api-client'
import { useSession } from '@/lib/auth'
import { qk } from '@/lib/query-keys'
import {
  envelope,
  transferDetailSchema,
  transferListSchema,
  createTransferResultSchema,
  transferStatusResultSchema,
  createBundleResultSchema,
  approveBundleResultSchema,
  type TransferDetail,
  type TransferListItem,
  type CreateTransferResult,
  type CreateBundleResult,
  type TransferStatus,
} from './schemas'

export interface CreateTransferInput {
  sourceDepartmentId: string
  destinationDepartmentId: string
  locationCode: string
  reasonCode?: string
  lines: Array<{ productId: string; requestedQty: number; reasonCode?: string }>
}

export interface CreateBundleInput {
  originatingClusterId: string
  destinationClusterId: string
  locationCode: string
  productId: string
  qty: number
  uomId: string
  fromStoreId: string
  toStoreId: string
  brandStoreId: string
  reasonCode?: string
}

export function useTransferDetail(id: string | undefined) {
  const client = useApiClient()
  const { session } = useSession()
  return useQuery<TransferDetail>({
    queryKey: id ? qk.inv.transfers.detail(id) : ['inv', 'transfers', 'detail', null],
    queryFn: ({ signal }) => {
      if (!id) throw new Error('useTransferDetail called without id')
      return client
        .get({ path: `/api/v1/stock-transfers/${id}`, schema: envelope(transferDetailSchema), signal })
        .then((r) => r.data)
    },
    enabled: Boolean(session) && Boolean(id),
  })
}

export function useTransferList(filter: { status?: TransferStatus } = {}) {
  const client = useApiClient()
  const { session } = useSession()
  const params = new URLSearchParams()
  if (filter.status) params.set('status', filter.status)
  const qs = params.toString()
  return useQuery<TransferListItem[]>({
    queryKey: qk.inv.transfers.list(filter),
    queryFn: ({ signal }) =>
      client
        .get({
          path: `/api/v1/stock-transfers${qs ? `?${qs}` : ''}`,
          schema: envelope(transferListSchema),
          signal,
        })
        .then((r) => r.data),
    enabled: Boolean(session),
  })
}

export function useCreateTransfer() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<CreateTransferResult, Error, CreateTransferInput>({
    mutationFn: (input) =>
      client
        .post({ path: '/api/v1/stock-transfers', body: input, schema: envelope(createTransferResultSchema) })
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inv', 'transfers', 'list'] })
    },
  })
}

function useTransferLifecycleAction(action: 'submit' | 'approve' | 'dispatch' | 'cancel') {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<{ status: string }, Error, string>({
    mutationFn: (transferId) =>
      client
        .post({ path: `/api/v1/stock-transfers/${transferId}/${action}`, body: {}, schema: envelope(transferStatusResultSchema) })
        .then((r) => r.data),
    onSuccess: (_res, transferId) => {
      void queryClient.invalidateQueries({ queryKey: qk.inv.transfers.detail(transferId) })
      void queryClient.invalidateQueries({ queryKey: ['inv', 'transfers', 'list'] })
    },
  })
}
export const useSubmitTransfer = () => useTransferLifecycleAction('submit')
export const useApproveTransfer = () => useTransferLifecycleAction('approve')
export const useDispatchTransfer = () => useTransferLifecycleAction('dispatch')
export const useCancelTransfer = () => useTransferLifecycleAction('cancel')

export function useConfirmReceipt() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<
    { status: string },
    Error,
    { transferId: string; quantities?: Record<string, number>; varianceReasons?: Record<string, string> }
  >({
    mutationFn: ({ transferId, quantities, varianceReasons }) =>
      client
        .post({
          path: `/api/v1/stock-transfers/${transferId}/confirm-receipt`,
          body: { quantities, varianceReasons },
          schema: envelope(transferStatusResultSchema),
        })
        .then((r) => r.data),
    onSuccess: (_res, { transferId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.inv.transfers.detail(transferId) })
      void queryClient.invalidateQueries({ queryKey: ['inv', 'transfers', 'list'] })
    },
  })
}

export function useCreateBundle() {
  const client = useApiClient()
  return useMutation<CreateBundleResult, Error, CreateBundleInput>({
    mutationFn: (input) =>
      client
        .post({ path: '/api/v1/stock-transfers/bundles', body: input, schema: envelope(createBundleResultSchema) })
        .then((r) => r.data),
  })
}

export function useApproveBundle() {
  const client = useApiClient()
  return useMutation<{ transferIds: string[] }, Error, string>({
    mutationFn: (bundleId) =>
      client
        .post({ path: `/api/v1/stock-transfers/bundles/${bundleId}/approve`, body: {}, schema: envelope(approveBundleResultSchema) })
        .then((r) => r.data),
  })
}
```

- [ ] **Step 5: Add PAR list + set mutations**

In `apps/web/src/hooks/inv/useParLevels.ts`, add (keep the existing `useBelowPar`):

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  parLevelListSchema,
  parLevelRowSchema,
  bulkParResultSchema,
  type ParLevelRow,
} from './schemas'

export interface SetParLevelInput {
  productId: string
  locationId?: string | null
  departmentId?: string | null
  basePar: number
  dayOfWeekOverrides?: Record<string, number> | null
}

export function useParLevelsList(filter: { locationId?: string } = {}) {
  const client = useApiClient()
  const { session } = useSession()
  const params = new URLSearchParams()
  if (filter.locationId) params.set('locationId', filter.locationId)
  const qs = params.toString()
  return useQuery<ParLevelRow[]>({
    queryKey: qk.inv.parList(filter),
    queryFn: ({ signal }) =>
      client
        .get({
          path: `/api/v1/par-levels${qs ? `?${qs}` : ''}`,
          schema: envelope(parLevelListSchema),
          signal,
        })
        .then((r) => r.data),
    enabled: Boolean(session),
  })
}

export function useSetParLevel() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<ParLevelRow, Error, SetParLevelInput>({
    mutationFn: (input) =>
      client
        .post({ path: '/api/v1/par-levels', body: input, schema: envelope(parLevelRowSchema) })
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inv', 'parList'] })
      void queryClient.invalidateQueries({ queryKey: ['inv', 'belowPar'] })
    },
  })
}

export function useBulkSetParLevel() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<{ count: number }, Error, SetParLevelInput[]>({
    mutationFn: (rows) =>
      client
        .post({ path: '/api/v1/par-levels/bulk', body: { rows }, schema: envelope(bulkParResultSchema) })
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inv', 'parList'] })
      void queryClient.invalidateQueries({ queryKey: ['inv', 'belowPar'] })
    },
  })
}
```

> Ensure `useParLevels.ts` already imports `useQuery`, `useApiClient`, `useSession`, `qk`, `envelope`. Add `useMutation`/`useQueryClient` and the new schema imports.

- [ ] **Step 6: Create `useOrgLists.ts`**

Create `apps/web/src/hooks/inv/useOrgLists.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/use-api-client'
import { useSession } from '@/lib/auth'
import { qk } from '@/lib/query-keys'
import {
  clusterListSchema,
  uomListSchema,
  storeListSchema,
  type Store,
} from './schemas'

export function useInventoryClusters() {
  const client = useApiClient()
  const { session } = useSession()
  return useQuery<{ id: string; name: string }[]>({
    queryKey: qk.inv.clusters(),
    queryFn: ({ signal }) => client.get({ path: '/api/v1/clusters', schema: clusterListSchema, signal }),
    enabled: Boolean(session),
    staleTime: 5 * 60_000,
  })
}

export function useInventoryUoms() {
  const client = useApiClient()
  const { session } = useSession()
  return useQuery<{ id: string; code: string; displayName: string }[]>({
    queryKey: qk.inv.uoms(),
    queryFn: ({ signal }) => client.get({ path: '/api/v1/uoms', schema: uomListSchema, signal }),
    enabled: Boolean(session),
    staleTime: 5 * 60_000,
  })
}

export function useInventoryStores() {
  const client = useApiClient()
  const { session } = useSession()
  return useQuery<Store[]>({
    queryKey: qk.inv.stores(),
    queryFn: ({ signal }) => client.get({ path: '/api/v1/stores', schema: storeListSchema, signal }),
    enabled: Boolean(session),
    staleTime: 5 * 60_000,
  })
}
```

> **BARE endpoints** — clusters/uoms/stores all `res.json(await ...)`. NO `envelope()`, NO `.then(r => r.data)`. (Confirmed: `clusters.ts:26`, `uoms.ts:43`, `stores.ts` Task 1.)

- [ ] **Step 7: Typecheck + build**

Run: `cd apps/web && npx tsc --noEmit && npm run build`
Expected: tsc silent; vite build clean.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/query-keys.ts apps/web/src/hooks/inv/
git commit -m "feat(inv): Wave-2 data layer — transfer/PAR write hooks + org lists

Adds qk.inv transfer/par/org keys + schemas; useStockTransfers gains
detail/list queries + create/submit/approve/dispatch/confirm-receipt/
cancel + bundle create/approve mutations; useParLevels gains list +
set + bulk-set; new useOrgLists (clusters/uoms/stores); widens
useInventoryDepartments to {id,name,code,locationId,type}. No UI yet.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Port `CCImplausibilityWarn` into the production shell

**Files:**
- Create: `apps/web/src/components/shell/CCImplausibilityWarn.tsx`
- Modify: `apps/web/src/components/shell/index.ts` (add `export * from './CCImplausibilityWarn'`)

**Interfaces:**
- Mockup source: `mockups/src/shell/CCImplausibilityWarn.tsx` (visual source of truth).
- Produces: `CCImplausibilityWarn` + `ImplausibilityReasonCode` + `CCImplausibilityWarnProps` (props identical to the mockup): `{ message, reasonCodes, selectedReason, onSelectReason, onOverride, overridden, className }`.

- [ ] **Step 1: Port the component, swapping Radix Select → native `<select>`**

Copy the mockup verbatim, but the mockup imports `Select`/`SelectTrigger`/`SelectContent`/`SelectItem`/`SelectValue` from `@/components/ui/select` — that primitive does NOT exist in `apps/web`. Replace the reason `<Select>` block with a token-styled native `<select>`. Keep everything else byte-identical (the `overridden` summary branch, the `border-l-4 border-warning` pip, `AlertTriangle`/`Check` icons, `warning` token, copy). Import `cn` from `@/lib/utils` and `Button` from `./Button` (both exist in prod).

```tsx
import { AlertTriangle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

export interface ImplausibilityReasonCode {
  value: string
  label: string
}

export interface CCImplausibilityWarnProps {
  message: string
  reasonCodes: ReadonlyArray<ImplausibilityReasonCode>
  selectedReason: string | null
  onSelectReason: (value: string) => void
  onOverride: () => void
  overridden: boolean
  className?: string
}

export function CCImplausibilityWarn({
  message,
  reasonCodes,
  selectedReason,
  onSelectReason,
  onOverride,
  overridden,
  className,
}: CCImplausibilityWarnProps): JSX.Element | null {
  if (overridden) {
    const selectedLabel =
      reasonCodes.find((r) => r.value === selectedReason)?.label ?? selectedReason ?? ''
    return (
      <div
        data-slot="cc-implausibility-warn"
        data-overridden="true"
        className={cn('flex items-center gap-2 bg-surface-container-low rounded-sm px-3 py-2', className)}
      >
        <AlertTriangle aria-hidden size={14} className="shrink-0 text-on-surface-variant" />
        <span className="text-xs text-on-surface-variant">Overridden · {selectedLabel}</span>
      </div>
    )
  }

  return (
    <div data-slot="cc-implausibility-warn" role="alert" className={cn('flex', className)}>
      <div className="border-l-4 border-warning shrink-0" />
      <div className="flex flex-col gap-3 bg-surface-container rounded-sm p-3 flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <AlertTriangle aria-hidden size={16} className="shrink-0 text-warning mt-0.5" />
          <span className="text-sm text-on-surface">{message}</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cc-implausibility-reason" className="text-xs text-on-surface-variant font-medium">
            Reason · required
          </label>
          <select
            id="cc-implausibility-reason"
            aria-label="Implausibility override reason"
            value={selectedReason ?? ''}
            onChange={(e) => onSelectReason(e.target.value)}
            className="h-10 rounded-sm bg-surface-container-lowest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="" disabled>
              Select a reason…
            </option>
            {reasonCodes.map((code) => (
              <option key={code.value} value={code.value}>
                {code.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end">
          <Button variant="tonal" size="sm" disabled={!selectedReason} onClick={onOverride}>
            <Check size={14} aria-hidden />
            Override &amp; continue
          </Button>
        </div>
      </div>
    </div>
  )
}
```

> **Token-discipline note:** the `border-l-4 border-warning` is the allow-listed §6.1 status-pip pattern. The native `<select>` uses only token classes + a `focus-visible:` ring (allow-listed). No hex, Lucide-only, Inter inherited. If the prod `Button` variant names differ (`tonal` must exist — it does, used across Wave-1 pages), keep `variant="tonal"`.

- [ ] **Step 2: Export from the shell index**

Add to `apps/web/src/components/shell/index.ts` (alphabetical-ish, near the other `CC*` exports):

```ts
export * from './CCImplausibilityWarn'
```

- [ ] **Step 3: Typecheck + build**

Run: `cd apps/web && npx tsc --noEmit && npm run build`
Expected: silent + clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/shell/CCImplausibilityWarn.tsx apps/web/src/components/shell/index.ts
git commit -m "feat(inv): port CCImplausibilityWarn into production shell

Ports the FR114 warn-and-log panel from mockups into apps/web shell,
swapping the mockup Radix Select for a token-styled native <select>
(no ui/select primitive in apps/web). Visual parity; props unchanged.
First consumer: SI-INV-005 (Task 6).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Port `CCVoiceInput` into the production shell (real progressive Web Speech API)

**Files:**
- Create: `apps/web/src/components/shell/CCVoiceInput.tsx`
- Modify: `apps/web/src/components/shell/index.ts` (add `export * from './CCVoiceInput'`)

**Interfaces:**
- Mockup source: `mockups/src/shell/CCVoiceInput.tsx` (visual source of truth).
- Produces: `CCVoiceInput` + `CCVoiceInputProps`: `{ value, onChange, unit?, placeholder?, 'aria-label', disabled?, className }`. **Drop** the mockup's `simulatedHeardValue` prop (it was a fixture-only simulation; real recognition replaces it).

**Behavior (spec Decision 2 — real, progressively enhanced):**
- Feature-detect `window.SpeechRecognition ?? window.webkitSpeechRecognition`. If absent → render the plain number `<Input>` with NO mic (no broken affordance).
- On mic tap (user gesture, HTTPS prod context both satisfied): start recognition, show the inline listening strip (reduced-motion-guarded pulse dots), parse the transcript to a decimal, populate the field via `onChange`, allow accept/cancel.
- `inputMode="decimal"` typing path always available; voice never the only way to enter a value.
- No new dependency — browser-native API only.

- [ ] **Step 1: Write the component**

Create `apps/web/src/components/shell/CCVoiceInput.tsx`. Web Speech API types are not in the default DOM lib for all TS configs — declare a minimal local interface to stay zero-`any` and avoid a global type dependency:

```tsx
/**
 * CCVoiceInput — CC-VOICE-INPUT pattern, FR112, DL-047.
 *
 * Quantity-field input with an optional mic affordance, progressively enhanced
 * with the browser-native Web Speech API. The mic shows only where recognition
 * is supported; typing (inputMode="decimal") is always available. The three
 * pulsing dots use `animate-pulse motion-reduce:animate-none` — the sole
 * animation in this Arc, a reduced-motion-guarded interaction-feedback pattern
 * on a control, NOT an entrance animation (DESIGN.md §10.3 / §10.5).
 */
import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Input } from './Input'
import { Button } from './Button'
import { Mic, Check, X } from 'lucide-react'

export interface CCVoiceInputProps {
  value: string
  onChange: (next: string) => void
  unit?: string
  placeholder?: string
  'aria-label': string
  disabled?: boolean
  className?: string
}

// Minimal structural typing for the Web Speech API (not in the default DOM lib).
interface SpeechRecognitionResultLike {
  0: { transcript: string }
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>
}
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** Parse a spoken transcript to a decimal string, e.g. "five point five kg" → "5.5". */
function parseTranscriptToDecimal(transcript: string): string | null {
  const cleaned = transcript.toLowerCase().replace(/\bpoint\b/g, '.').replace(/[^0-9.]/g, ' ').trim()
  const match = cleaned.match(/\d+(\.\d+)?/)
  return match ? match[0] : null
}

export function CCVoiceInput({
  value,
  onChange,
  unit,
  placeholder,
  'aria-label': ariaLabel,
  disabled,
  className,
}: CCVoiceInputProps): JSX.Element {
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const ctor = getRecognitionCtor()
  const supported = ctor !== null

  function stop() {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setListening(false)
  }

  function startListening() {
    if (!ctor) return
    const recognition = new ctor()
    recognition.lang = 'en-IN'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (e) => {
      const transcript = e.results[0]?.[0]?.transcript ?? ''
      const parsed = parseTranscriptToDecimal(transcript)
      if (parsed !== null) setHeard(parsed)
    }
    recognition.onerror = () => stop()
    recognition.onend = () => {
      recognitionRef.current = null
      setListening(false)
    }
    recognitionRef.current = recognition
    setHeard(null)
    setListening(true)
    recognition.start()
  }

  function accept() {
    if (heard !== null) onChange(heard)
    stop()
    setHeard(null)
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="relative">
        <Input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={ariaLabel}
          disabled={disabled}
          placeholder={placeholder}
          className={supported ? 'pr-20' : 'pr-12'}
        />
        {unit && (
          <span
            className={cn(
              'absolute top-1/2 -translate-y-1/2 text-xs text-on-surface-variant pointer-events-none select-none',
              supported ? 'right-12' : 'right-3',
            )}
          >
            {unit}
          </span>
        )}
        {supported && (
          <Button
            variant="ghost"
            size="sm"
            aria-label="Enter quantity by voice"
            disabled={disabled}
            onClick={startListening}
            className="absolute right-1 top-1/2 -translate-y-1/2 min-h-11 min-w-11 p-0 flex items-center justify-center"
          >
            <Mic className="h-4 w-4" />
          </Button>
        )}
      </div>

      {listening && (
        <div
          role="status"
          aria-live="polite"
          className="bg-surface-container-low rounded-sm px-3 py-2 flex items-center gap-2 text-sm text-on-surface"
        >
          <span className="h-1.5 w-1.5 rounded-pill bg-primary animate-pulse motion-reduce:animate-none" />
          <span className="h-1.5 w-1.5 rounded-pill bg-primary animate-pulse motion-reduce:animate-none" />
          <span className="h-1.5 w-1.5 rounded-pill bg-primary animate-pulse motion-reduce:animate-none" />
          <span className="text-on-surface-variant">Listening…</span>
          <span className="font-medium">{heard ?? '—'}</span>
          <Button
            size="sm"
            variant="tonal"
            aria-label="Use heard value"
            disabled={heard === null}
            onClick={accept}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" aria-label="Cancel voice entry" onClick={stop}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
```

> **Notes for the implementer:**
> - Keep the pulse markup byte-identical to the mockup (`animate-pulse motion-reduce:animate-none`) — it is the single sanctioned animation.
> - Confirm the prod `Input` accepts `inputMode` + `className` passthrough (Wave-1 pages used `Input`; it does). If `Input`'s `onChange` typing differs, adapt the handler signature but keep behavior.
> - Zero `any`: the local `SpeechRecognition*Like` interfaces + `getRecognitionCtor` cast satisfy strict mode without `any`. Do not add `@types` packages.
> - SSR-safety: `typeof window === 'undefined'` guard is defensive (Vite SPA renders client-side, but the guard is free).

- [ ] **Step 2: Export from the shell index**

```ts
export * from './CCVoiceInput'
```

- [ ] **Step 3: Typecheck + build**

Run: `cd apps/web && npx tsc --noEmit && npm run build`
Expected: silent + clean. (If tsc complains about `webkitSpeechRecognition` on `window`, the cast in `getRecognitionCtor` already avoids touching `window` typings directly — confirm no stray global access remains.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/shell/CCVoiceInput.tsx apps/web/src/components/shell/index.ts
git commit -m "feat(inv): port CCVoiceInput into production shell (real Web Speech API)

Ports the FR112 mic-on-quantity-field pattern with REAL progressive
enhancement: feature-detects window.SpeechRecognition ?? webkit…; mic
shows/works where supported, hidden otherwise; typing always available;
parses transcript to a decimal; reduced-motion-guarded listening pulse.
Zero-any local Web Speech typings; no new dependency. First consumer:
SI-INV-005 (Task 6).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: SI-INV-004 PAR Level Configuration — page + route

**Files:**
- Create: `apps/web/src/pages/inv/ParLevelConfigPage.tsx`
- Modify: `apps/web/src/App.tsx` (route `/inventory/par-levels` + nav entry)

**Interfaces:**
- Consumes: `useParLevelsList`, `useSetParLevel`, `useBulkSetParLevel` (Task 2), `useInventoryProductNames`, `useInventoryDepartments` (widened), `ApiError`, `@/components/shell`.
- Mockup source: `mockups/src/screens/inv/SI-INV-004.tsx`.

- [ ] **Step 1: Port the mockup**

Copy `mockups/src/screens/inv/SI-INV-004.tsx` → `apps/web/src/pages/inv/ParLevelConfigPage.tsx`, default export `ParLevelConfigPage`. Apply the Page-port procedure. Keep the matrix table, DoW popover (`DowPopoverPanel`), bulk-set toolbar, mobile card stack, `DraftPill`, `AuditLink`, `SectionShift`, footer verbatim where they survive the divergences below.

- [ ] **Step 2: Replace fixtures with live data + apply divergences**

Delete the imports from `@/lib/sample-data` + `@/lib/inv-sample-data` and the fixture-derived blocks. Wire hooks (ALL above the loading/error guards):

```tsx
import { useParLevelsList, useSetParLevel, useBulkSetParLevel, type SetParLevelInput } from '@/hooks/inv/useParLevels'
import { useInventoryProductNames, useInventoryDepartments } from '@/hooks/inv/useProductNames'
import { ApiError } from '@/lib/api-client'
// ...
const { data: parRows, isLoading, error } = useParLevelsList({})
const { nameOf, isLoading: namesLoading } = useInventoryProductNames()
const { data: depts } = useInventoryDepartments()
const setPar = useSetParLevel()
const bulkSetPar = useBulkSetParLevel()

const deptName = (id: string) => depts?.find((d) => d.id === id)?.name ?? id

// Matrix is built from DEPARTMENT-scoped PAR rows only.
const deptParRows = (parRows ?? []).filter((p) => p.departmentId !== null)
// Location-scoped / brand-wide rows are shown in a small secondary list.
const nonDeptParRows = (parRows ?? []).filter((p) => p.departmentId === null)
```

Apply these **divergences** (record each in the commit message):
- **Drop** the `FilterChipPicker` strip (scope/product-type/category) — unbacked.
- **Drop** the FR111 `DriftBadge`, the accept/ignore buttons, `DRIFT_RECOMMENDATION_IDS`, `driftDismissed`, and the drift legend — Epic-12 seam, no backend.
- Replace `materials`/`departments` fixture lookups with `nameOf(productId)` and `deptName(departmentId)`.
- The matrix groups `deptParRows` by `productId → departmentId`. The `editMap` is keyed by PAR-row `id` (`par.id`), seeded from `basePar` (now a number → `String(p.basePar)`) and `dayOfWeekOverrides` (now `{mon..sun}` numbers → `?.toString() ?? ''`). The mockup's `initialCellState`/`initialDow` adapt directly to the real `ParLevelRow` shape.
- **`handleConfirm`** must persist: diff `editMap` against the original `deptParRows`, build `SetParLevelInput[]` for changed rows, call `bulkSetPar.mutate(changed)`; on success reset draft + selection. A row changed when `basePar` differs or any DoW override string differs from the seed:

```tsx
function toOverrides(dow: Record<string, string>): Record<string, number> | null {
  const entries = Object.entries(dow)
    .filter(([, v]) => v.trim() !== '')
    .map(([k, v]) => [k, Number(v)] as const)
  return entries.length ? Object.fromEntries(entries) : null
}

function handleConfirm() {
  const changed: SetParLevelInput[] = []
  for (const par of deptParRows) {
    const cell = editMap[par.id]
    if (!cell) continue
    const nextBase = Number(cell.basePar)
    const nextOverrides = toOverrides(cell.dowOverrides)
    const baseChanged = Number.isFinite(nextBase) && nextBase !== par.basePar
    const overridesChanged =
      JSON.stringify(nextOverrides ?? null) !== JSON.stringify(par.dayOfWeekOverrides ?? null)
    if (baseChanged || overridesChanged) {
      changed.push({
        productId: par.productId,
        locationId: par.locationId,
        departmentId: par.departmentId,
        basePar: Number.isFinite(nextBase) ? nextBase : par.basePar,
        dayOfWeekOverrides: nextOverrides,
      })
    }
  }
  if (changed.length === 0) { setIsDraft(false); return }
  bulkSetPar.mutate(changed, {
    onSuccess: () => { setIsDraft(false); setSelectedIds(new Set()); setBulkValue('') },
  })
}
```

- The bulk-set toolbar's "Apply to selected" stays (local stage), and `handleConfirm` is the real persist. Surface `bulkSetPar.isPending` (disable Confirm + show "Saving…") and `bulkSetPar.error` (inline `role="alert"`).
- `AuditLink` keeps `entityRef={par.id}` (real PAR row id → audit viewer).
- Add the loading/error guards (shared JSX; include `namesLoading` in the loading condition: `if (isLoading || namesLoading)`). Empty state: when `deptParRows.length === 0 && nonDeptParRows.length === 0`, render a typed empty panel ("No PAR levels configured yet").

- [ ] **Step 3: Render the secondary non-department PAR list**

Below the matrix, add a small read-only list of `nonDeptParRows` (location-scoped + brand-wide) so they are not silently hidden — product name (`nameOf`), scope label ("Brand-wide" if `locationId === null`, else "Location-scoped"), base PAR. (Editing these is out of Wave-2 scope; show them informationally with an `AuditLink`.)

- [ ] **Step 4: Register route + nav**

In `apps/web/src/App.tsx`, add `import ParLevelConfigPage from '@/pages/inv/ParLevelConfigPage'` and:

```tsx
{/* SI-INV-004 PAR Level Configuration — Wave 2 */}
<Route
  path="/inventory/par-levels"
  element={
    <RequireAuth>
      <ParLevelConfigPage />
    </RequireAuth>
  }
/>
```

Nav entry: `{ href: '/inventory/par-levels', label: 'PAR configuration (SI-INV-004)' },`.

- [ ] **Step 5: Typecheck + build**

Run: `cd apps/web && npx tsc --noEmit && npm run build`
Expected: silent + clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/inv/ParLevelConfigPage.tsx apps/web/src/App.tsx
git commit -m "feat(inv): SI-INV-004 PAR Level Configuration production page

Ports the Arc-(b) matrix, fed by useParLevelsList + product/dept name
resolution; base-PAR + DoW edits stage locally, 'Confirm changes' diffs
and persists via bulkSetParLevel. Department-scoped rows form the matrix;
location/brand-wide rows listed separately. Dropped (unbacked): scope/
type/category filter chips and the FR111 drift-recommendation chrome
(Epic-12 seam). Route /inventory/par-levels + nav.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: SI-INV-005 Stock Transfer Create — page + route

**Files:**
- Create: `apps/web/src/pages/inv/StockTransferCreatePage.tsx`
- Modify: `apps/web/src/App.tsx` (route `/inventory/transfers/new` + nav entry)

**Interfaces:**
- Consumes: `useInventoryDepartments` (widened — needs `code`), `useDepartmentStock` (Wave-1, source on-hand), `useCreateTransfer` + `useSubmitTransfer` (Task 2), `useTransferList` (duplicate detection), `CCVoiceInput` + `CCImplausibilityWarn` (Tasks 3/4) + `CCDuplicateWarn` (prod shell), `useNavigate`/`useSearchParams`, `ApiError`.
- Mockup source: `mockups/src/screens/inv/SI-INV-005.tsx`.

- [ ] **Step 1: Port the mockup**

Copy `mockups/src/screens/inv/SI-INV-005.tsx` → `apps/web/src/pages/inv/StockTransferCreatePage.tsx`, default export `StockTransferCreatePage`. Apply the Page-port procedure. Swap every mockup `Select` for a native `<select>` (route selectors, per-line item/reason). Carry the reason-code constant inline (define `TRANSFER_REASON_OPTIONS` locally — copy the value list from `mockups/src/lib/inv-sample-data.ts`, it is a static `{value,label}[]`) and the implausibility reason constant (`IMPLAUSIBILITY_REASON_OPTIONS`, likewise inline).

- [ ] **Step 2: Replace fixtures with live data + apply divergences**

Wire hooks (ALL above guards):

```tsx
import { useInventoryDepartments } from '@/hooks/inv/useProductNames'
import { useDepartmentStock } from '@/hooks/inv/useStock'
import { useCreateTransfer, useSubmitTransfer, type CreateTransferInput } from '@/hooks/inv/useStockTransfers'
import { useTransferList } from '@/hooks/inv/useStockTransfers'
import { ApiError } from '@/lib/api-client'
// ...
const { data: depts } = useInventoryDepartments()
const [sourceDeptId, setSourceDeptId] = useState<string | undefined>(undefined)
const [destDeptId, setDestDeptId] = useState<string | undefined>(undefined)
const effectiveSource = sourceDeptId ?? depts?.[0]?.id
const { data: sourceStock, isLoading, error } = useDepartmentStock(effectiveSource)
const createTransfer = useCreateTransfer()
const submitTransfer = useSubmitTransfer()
const { data: recentTransfers } = useTransferList({})

// Available materials at source = department on-hand stock rows.
const availableMaterials = (sourceStock?.items ?? []).map((it) => ({
  productId: it.productId,
  name: it.productName,
  available: it.quantity,
  unit: it.unit,
}))
const availableOf = (productId: string) =>
  availableMaterials.find((m) => m.productId === productId)?.available ?? 0
const unitOf = (productId: string) =>
  availableMaterials.find((m) => m.productId === productId)?.unit ?? ''
```

Apply these **divergences** (record in commit):
- Lines reference `productId` (from `availableMaterials`), not fixture `materialId`/`batchId`. A line's "available" + "expiry band" panel reduces to **available qty + unit** (no batch/expiry data on this endpoint) — drop the batch ref + expiry-band sub-row.
- **Destination select** lists ALL `depts` except the source (no client-side FR28 cross-cluster disabling — the frontend has no dept→cluster map; the backend enforces FR28). Keep the FR28 info note copy but reword it to "Invalid routes are rejected on submit with the reason" (it is now honest).
- `CCVoiceInput` on each requested-qty field: drop the `simulatedHeardValue` prop (removed in Task 4).
- `isImplausible = requestedQty > availableOf(productId)`; `CCImplausibilityWarn` is **client-advisory** (warn-and-log). Keep per-line `implausibilitySelectedReason`/`implausibilityOverridden` local state, but note the override is NOT sent (the create endpoint has no implausibility field) — only the line's transfer `reason` is sent.
- **Duplicate warn:** build matches from `recentTransfers` — same `sourceDepartmentId === effectiveSource` AND `createdAt`'s date === today. Map each to a `CCDuplicateWarn` match `{ id, name: stTrn + ' — ' + statusLabel, subtitle?, status: 'active' }`. `onEditExisting={(id) => navigate(\`/inventory/transfers/${id}\`)}`; `onProceedAnyway={() => setDuplicateProceed(true)}`. If no matches, render nothing (`CCDuplicateWarn` returns null on empty).
- **Suggestion banner (`?from=…` / prefill):** support query params `source`, `dest`, `product`, `qty` (set initial state from them) and keep the banner when present. Drop the hard-coded fixture suggestion copy; show generic "Pre-filled from a suggestion — adjust quantities as needed."

- [ ] **Step 3: Wire the real submit**

```tsx
const navigate = useNavigate()

async function handleSubmit() {
  if (!effectiveSource || !destDeptId) return
  const sourceDept = depts?.find((d) => d.id === effectiveSource)
  const locationCode =
    ((sourceDept?.code ?? sourceDept?.name ?? 'INV').replace(/[^A-Za-z0-9]/g, '').slice(0, 20).toUpperCase()) || 'INV'
  const input: CreateTransferInput = {
    sourceDepartmentId: effectiveSource,
    destinationDepartmentId: destDeptId,
    locationCode,
    lines: lines
      .filter((l) => parseFloat(l.requestedQty) > 0)
      .map((l) => ({ productId: l.productId, requestedQty: parseFloat(l.requestedQty), reasonCode: l.reason || undefined })),
  }
  try {
    const created = await createTransfer.mutateAsync(input)
    const submitted = await submitTransfer.mutateAsync(created.transferId)
    if (submitted.status === 'pending_approval') {
      // routed to the Epic-3 approval engine — send the user to the existing inbox
      navigate('/approvals/inbox')
    } else {
      // approved immediately — go to the new transfer's detail
      navigate(`/inventory/transfers/${created.transferId}`)
    }
  } catch {
    // createTransfer.error / submitTransfer.error rendered inline (FR28 backend rejections surface here)
  }
}
```

- Render `createTransfer.error || submitTransfer.error` in a `role="alert"` block (this is where `ClusterBoundaryError`/`FlowDirectionError`/`EnablementViolationError` messages appear — the honest FR28 enforcement). Disable the submit button while `createTransfer.isPending || submitTransfer.isPending`.
- Keep the existing client gates (every line has a reason + a positive qty; a destination is chosen). The implausibility override gate stays advisory (does not hard-block, per warn-and-log — but the mockup disables submit until overridden; keep that client UX since it's non-destructive).
- Add loading/error guards (shared JSX). Empty source: when `availableMaterials.length === 0`, show the mockup's "No stock at this source" panel.

- [ ] **Step 4: Register route + nav**

Add `import StockTransferCreatePage from '@/pages/inv/StockTransferCreatePage'` and:

```tsx
{/* SI-INV-005 Stock Transfer Create — Wave 2 */}
<Route
  path="/inventory/transfers/new"
  element={
    <RequireAuth>
      <StockTransferCreatePage />
    </RequireAuth>
  }
/>
```

Nav entry: `{ href: '/inventory/transfers/new', label: 'New stock transfer (SI-INV-005)' },`.

- [ ] **Step 5: Typecheck + build**

Run: `cd apps/web && npx tsc --noEmit && npm run build`
Expected: silent + clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/inv/StockTransferCreatePage.tsx apps/web/src/App.tsx
git commit -m "feat(inv): SI-INV-005 Stock Transfer Create production page

Ports the multi-line transfer form fed by useDepartmentStock (source
on-hand), real CCVoiceInput + CCImplausibilityWarn (advisory) +
CCDuplicateWarn (from the transfer list). Submit = createDraft → submit;
over-threshold routes to /approvals/inbox, else to the new transfer's
detail. FR28 enforced server-side (no client cross-cluster filter — the
frontend has no dept→cluster map); rejections surface inline. Route
/inventory/transfers/new + nav.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: SI-INV-006 Stock Transfer Detail & Status — page + route

**Files:**
- Create: `apps/web/src/pages/inv/StockTransferDetailPage.tsx`
- Modify: `apps/web/src/App.tsx` (route `/inventory/transfers/:id` + nav entry to the list/create)

**Interfaces:**
- Consumes: `useTransferDetail`, `useTransferList`, `useSubmitTransfer`/`useApproveTransfer`/`useDispatchTransfer`/`useConfirmReceipt`/`useCancelTransfer` (Task 2), `useInventoryProductNames` + `useInventoryDepartments`, `CCReverseCancelDialog`/`LifecycleStepper`/`STOCK_TRANSFER_LIFECYCLE_STEPS`/`StatusPill`/`TrnDisplay`/`AuditLink`/`IssueTicketLink` (prod shell), `useRealtimeChannel` from `@/lib/realtime-bridge`, `useParams`/`useNavigate`, `ApiError`.
- Mockup source: `mockups/src/screens/inv/SI-INV-006.tsx`.

- [ ] **Step 1: Port the mockup**

Copy `mockups/src/screens/inv/SI-INV-006.tsx` → `apps/web/src/pages/inv/StockTransferDetailPage.tsx`, default export `StockTransferDetailPage`. Apply the Page-port procedure. Keep `statusToken`/`statusLabel`/`statusToStepKey`/`terminalChip`/`reverseCancelMode`/`fmtDateTime`/`TransferMetaRow`/`ExpiryPip`, `LifecycleStepper`, the header card, `CCReverseCancelDialog`, `AuditLink`, `IssueTicketLink` verbatim where they survive.

> Note: the mockup's `TransferStatus` union matches the live `transferStatusEnum` exactly (`draft|pending_approval|approved|in_transit|received|cancelled`) — reuse the mockup's status→token/label/step helpers as-is, importing `StatusToken`/`ReverseCancelMode` types from `@/components/shell` (prod exports them).

- [ ] **Step 2: Replace the demo picker + fixtures with live data**

Read the id from the route. Replace the fixture `transfers` demo `StatusPicker` with a real **recent-transfers picker** from `useTransferList`. Wire (ALL hooks above guards):

```tsx
import { useParams, useNavigate } from 'react-router-dom'
import { useTransferDetail, useTransferList, useSubmitTransfer, useApproveTransfer, useDispatchTransfer, useConfirmReceipt, useCancelTransfer } from '@/hooks/inv/useStockTransfers'
import { useInventoryProductNames, useInventoryDepartments } from '@/hooks/inv/useProductNames'
import { useRealtimeChannel } from '@/lib/realtime-bridge'
import { ApiError } from '@/lib/api-client'
// ...
const { id } = useParams<{ id: string }>()
const navigate = useNavigate()
const { data: transfer, isLoading, error } = useTransferDetail(id)
const { data: recent } = useTransferList({})
const { nameOf, isLoading: namesLoading } = useInventoryProductNames()
const { data: depts } = useInventoryDepartments()
const deptName = (did: string) => depts?.find((d) => d.id === did)?.name ?? did

const submit = useSubmitTransfer()
const approve = useApproveTransfer()
const dispatch = useDispatchTransfer()
const confirmReceipt = useConfirmReceipt()
const cancel = useCancelTransfer()

// Realtime: refresh when the linked approval is decided (reuse existing channel; no new channel).
useRealtimeChannel('approval_requests')
```

> **Verify the realtime hook name/signature** in `apps/web/src/lib/realtime-bridge.ts` (`useRealtimeChannel('approval_requests')` — confirm the export; Wave-1/Epic-3 used it). Its job here is to invalidate `qk.inv.transfers.detail(id)` when an `approval_request_change` fires. If the bridge exposes an `onEvent` callback, pass one that calls `queryClient.invalidateQueries({ queryKey: qk.inv.transfers.detail(id!) })`; if it auto-invalidates by table, ensure the detail query re-fetches (a manual `useEffect` invalidation on event is acceptable). Match the Epic-3 `ApprovalInboxPage` usage pattern exactly.

- [ ] **Step 3: Wire status-gated actions + divergences**

Replace the mockup's single confirm-receipt + reverse buttons with the full status-gated action set (record divergences in commit):

- `draft` → **Submit** (`submit.mutate(transfer.id)`) + **Cancel** (opens `CCReverseCancelDialog` `mode="pre-confirmed"`).
- `pending_approval` → **"View in approval inbox"** link to `/approvals/inbox` (+ show `approvalRequestId`) + **Cancel** (pre-confirmed). If/when the realtime refresh shows the approval is decided, the page re-fetches; an **"Advance to approved"** button (`approve.mutate(transfer.id)`) is shown — it will succeed only once the linked `approval_request` is approved (backend guards this; surface the 422 message on failure).
- `approved` → **Dispatch** (`dispatch.mutate(transfer.id)`) + a **disabled** "Reverse (needs compensating document — later wave)" affordance with a `title`.
- `in_transit` → **Confirm receipt** (`confirmReceipt.mutate({ transferId: transfer.id })` — no per-line variance UI in Wave 2; receives full requested qty) + disabled reverse affordance.
- `received` → terminal; disabled reverse affordance.
- `cancelled` → terminal chip only.

Reverse/cancel dialog: render it only for `draft`/`pending_approval` (pre-confirmed). `onConfirm={({ reasonCode }) => cancel.mutate(transfer.id, { onSuccess: () => setDialogOpen(false) })}`. Surface each mutation's `error` (e.g. `TransferLifecycleError` 422 on an invalid transition) in a `role="alert"` block, and disable buttons while the relevant mutation `isPending`.

Line table: map `transfer.lines` → item name (`nameOf(line.productId)`), requested (`line.requestedQty`), fulfilled (`line.fulfilledQty ?? '—'`), reason (`line.reasonCode ?? '—'`). **Drop** the batch-number/expiry-date/expiry-band columns + the `ExpiryPip` usage in the line rows (no batch/expiry data on `stock_transfer_lines`). `AuditLink entityRef={transfer.stTrn}` + `IssueTicketLink entityRef={transfer.stTrn}` stay.

Recent-transfers picker: render `recent` (most recent ~10) as the quick-pick nav (replacing the fixture `StatusPicker`); each chip `onClick={() => navigate(\`/inventory/transfers/${t.id}\`)}` shows `t.stTrn` + a `StatusPill`. When `!id`, render a "Pick a transfer" prompt + the picker (no detail). Add loading/error guards (`if (isLoading || namesLoading)`; only when `id` is present).

- [ ] **Step 4: Register route + nav**

Add `import StockTransferDetailPage from '@/pages/inv/StockTransferDetailPage'` and:

```tsx
{/* SI-INV-006 Stock Transfer Detail & Status — Wave 2 */}
<Route
  path="/inventory/transfers/:id"
  element={
    <RequireAuth>
      <StockTransferDetailPage />
    </RequireAuth>
  }
/>
```

Also register a parameterless entry point so the picker is reachable from the nav — add a `/inventory/transfers` route rendering the SAME component (it handles `!id` with the picker prompt):

```tsx
<Route
  path="/inventory/transfers"
  element={
    <RequireAuth>
      <StockTransferDetailPage />
    </RequireAuth>
  }
/>
```

Nav entry: `{ href: '/inventory/transfers', label: 'Transfer detail (SI-INV-006)' },`.

> Route ordering: ensure `/inventory/transfers/new` (Task 6) is registered so it does NOT get captured by `/inventory/transfers/:id`. In react-router v6, static segments win over params automatically, but place `/inventory/transfers/new` before `/inventory/transfers/:id` for clarity. `useParams().id` will be `'new'` only if ordering is wrong — verify by visiting `/inventory/transfers/new` after wiring and confirming it renders the create page.

- [ ] **Step 5: Typecheck + build**

Run: `cd apps/web && npx tsc --noEmit && npm run build`
Expected: silent + clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/inv/StockTransferDetailPage.tsx apps/web/src/App.tsx
git commit -m "feat(inv): SI-INV-006 Stock Transfer Detail & Status production page

Ports the lifecycle detail fed by useTransferDetail; real status-gated
actions (submit/approve/dispatch/confirm-receipt/cancel) + LifecycleStepper
+ CCReverseCancelDialog (pre-dispatch cancel backed; post-dispatch reverse
disabled pending compensating-doc backend). Demo StatusPicker replaced
with a real recent-transfers picker; line table reduced to backed fields
(no batch/expiry on transfer lines). Reuses the approval_requests realtime
channel to refresh on approval decisions. Routes /inventory/transfers and
/inventory/transfers/:id + nav.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: SI-INV-007 Paired Cross-Cluster Transfer (Tier 1) — page + route + e2e

**Files:**
- Create: `apps/web/src/pages/inv/PairedTransferPage.tsx`
- Modify: `apps/web/src/App.tsx` (route `/inventory/transfers/paired` + nav entry)
- Test: `apps/web/tests/e2e/inv-paired-transfer.spec.ts`

**Interfaces:**
- Consumes: `useInventoryStores` + `useInventoryClusters` + `useInventoryUoms` (Task 2), `useInventoryProductNames` (single product pick), `useCreateBundle` + `useApproveBundle` (Task 2), `PairedTransferBundle`/`DraftPill`/`StatusPill`/`AuditLink`/`SectionShift`/`Popover` (prod shell), `ApiError`.
- Mockup source: `mockups/src/screens/inv/SI-INV-007.tsx`. **Tier-1 acceptance rigor applies** (founder-enumerated hero).

> **Route ordering:** register `/inventory/transfers/paired` BEFORE `/inventory/transfers/:id` (Task 7) so `paired` is not captured as an `:id`. (Static segments win in react-router v6, but keep them ordered for clarity.)

- [ ] **Step 1: Port the mockup, reduced to a single-item bundle**

Copy `mockups/src/screens/inv/SI-INV-007.tsx` → `apps/web/src/pages/inv/PairedTransferPage.tsx`, default export `PairedTransferPage`. Apply the Page-port procedure. Keep the header, the `StorePicker` sub-component (it is a `Popover`-based picker — `Popover` exists in prod shell), the `PairedTransferBundle` visualisation, the `ReasonPicker` (carry `REASON_OPTIONS` inline), and the footer. **Reduce line items to a single product** (backend bundle = one product).

- [ ] **Step 2: Replace fixtures with live data + apply divergences**

Wire hooks (ALL above guards):

```tsx
import { useInventoryStores } from '@/hooks/inv/useOrgLists'
import { useInventoryUoms } from '@/hooks/inv/useOrgLists'
import { useInventoryProductNames } from '@/hooks/inv/useProductNames'
import { useCreateBundle, useApproveBundle, type CreateBundleInput } from '@/hooks/inv/useStockTransfers'
import { ApiError } from '@/lib/api-client'
// ...
const { data: stores, isLoading, error } = useInventoryStores()
const { data: uoms } = useInventoryUoms()
const { products, isLoading: productsLoading } = (() => {
  // reuse the product-names list as a product picker source; expose the raw list
  // NOTE: useInventoryProductNames returns { nameOf, isLoading }. For a picker we
  // also need the id list — add a `list` to that hook OR fetch products here.
})()
```

> **Product picker source:** `useInventoryProductNames` currently exposes only `{ nameOf, isLoading }`. For 007 you need the product **list** (id + name) to pick ONE product. Extend `useInventoryProductNames` (in `useProductNames.ts`) to also return `list: { id: string; name: string }[]` from the already-fetched query data (no new request) — a one-line additive change — and consume `list` here. This keeps a single products query.

Store partitioning + selection:
```tsx
const clusterStores = (stores ?? []).filter((s) => s.level === 'cluster')
const brandStores = (stores ?? []).filter((s) => s.level === 'brand')
const [sourceStoreId, setSourceStoreId] = useState<string | undefined>(undefined)
const [destStoreId, setDestStoreId] = useState<string | undefined>(undefined)
const [productId, setProductId] = useState<string | undefined>(undefined)
const [qty, setQty] = useState<string>('')
const [reason, setReason] = useState<string>('')

const sourceStore = clusterStores.find((s) => s.id === sourceStoreId)
const destStore = clusterStores.find((s) => s.id === destStoreId)
const brandStore = brandStores[0]   // the brand-level intermediary
const uomId = uoms?.[0]?.id          // or a product-default-uom lookup if available
```

Apply these **divergences** (record in commit):
- Replace the hard-coded `CLUSTER_STORE_OPTIONS` fixture with `clusterStores` (from `useInventoryStores`); the `StorePicker`'s option shape adapts to `{ id, name, clusterId }` — show the store name + (optional) cluster. `excludeId` still prevents picking the same store both sides.
- Replace the 3-line `INITIAL_LINE_ITEMS` + `SourceExpiryPanel`/`DestinationConsumptionPanel` fabricated metrics with a **single product picker** (native `<select>` from `useInventoryProductNames().list`) + a **single qty** field + a **uom** (native `<select>` from `useInventoryUoms`, or the brand's default). Drop the fabricated "value at risk" / "destination consumption" numbers entirely (they were fixtures — no backend) — keep only static explanatory copy about the §2.2 Brand-Store hop. Feed `PairedTransferBundle` with the single line so the two-leg visualisation still renders (Leg 1: source cluster store → Brand Store; Leg 2: Brand Store → dest cluster store).
- Cluster ids derive from the chosen stores: `originatingClusterId = sourceStore.clusterId`, `destinationClusterId = destStore.clusterId` (both non-null for cluster-level stores). `brandStoreId = brandStore.id`.
- `AuditLink` uses the returned `bundleRef` after creation (before creation, omit it or use a neutral placeholder — do NOT fabricate a `BUNDLE_REF` constant).

- [ ] **Step 3: Wire real create + approve**

Replace the two fixture "Submit bundle" `<Link>`s with real actions:

```tsx
const createBundle = useCreateBundle()
const approveBundle = useApproveBundle()
const [createdBundle, setCreatedBundle] = useState<{ bundleId: string; bundleRef: string } | null>(null)
const [decomposedIds, setDecomposedIds] = useState<string[] | null>(null)

const canSubmit =
  Boolean(sourceStore?.clusterId) && Boolean(destStore?.clusterId) &&
  Boolean(brandStore) && Boolean(productId) && Boolean(uomId) &&
  parseFloat(qty) > 0 && reason !== '' && sourceStoreId !== destStoreId

async function handleSubmitBundle() {
  if (!sourceStore?.clusterId || !destStore?.clusterId || !brandStore || !productId || !uomId) return
  const locationCode =
    ((sourceStore.name ?? 'BND').replace(/[^A-Za-z0-9]/g, '').slice(0, 20).toUpperCase()) || 'BND'
  const input: CreateBundleInput = {
    originatingClusterId: sourceStore.clusterId,
    destinationClusterId: destStore.clusterId,
    locationCode,
    productId,
    qty: parseFloat(qty),
    uomId,
    fromStoreId: sourceStore.id,
    toStoreId: destStore.id,
    brandStoreId: brandStore.id,
    reasonCode: reason,
  }
  const created = await createBundle.mutateAsync(input)
  setCreatedBundle(created)
}

async function handleApproveBundle() {
  if (!createdBundle) return
  const result = await approveBundle.mutateAsync(createdBundle.bundleId)
  setDecomposedIds(result.transferIds)
}
```

- Until `createdBundle`, show **"Submit bundle"** (`disabled={!canSubmit || createBundle.isPending}` → `handleSubmitBundle`). After creation, show the **bundle ref** + an **"Approve bundle (decompose into 2 transfers)"** button (`approveBundle.isPending`). After approval, show the two resulting transfer ids as links to `/inventory/transfers/:id`.
- **Divergence note (record in commit):** the Arc-(a) bundle path does NOT create an Epic-3 `approval_request`; approval is the direct `/bundles/:id/approve` call. So there is NO routing to `/approvals/inbox` for bundles — surface the bundle + decomposition inline. (This honestly reflects the backend; the mockup's "Submit to Brand Owner → approval inbox" is not backed for bundles.)
- Surface `createBundle.error` / `approveBundle.error` (e.g. `ClusterBoundaryError` 422 when store levels/clusters are inconsistent) in a `role="alert"` block.
- Add loading/error guards (`if (isLoading || productsLoading)`). Empty state: if `clusterStores.length < 2 || brandStores.length === 0`, render a typed panel explaining a Brand Store + ≥2 cluster stores are required to route a paired transfer.

- [ ] **Step 4: Register route + nav**

Add `import PairedTransferPage from '@/pages/inv/PairedTransferPage'` and (BEFORE the `/inventory/transfers/:id` route):

```tsx
{/* SI-INV-007 Paired Cross-Cluster Transfer — Wave 2 (Tier 1) */}
<Route
  path="/inventory/transfers/paired"
  element={
    <RequireAuth>
      <PairedTransferPage />
    </RequireAuth>
  }
/>
```

Nav entry: `{ href: '/inventory/transfers/paired', label: 'Paired cross-cluster transfer (SI-INV-007)' },`.

- [ ] **Step 5: Typecheck + build**

Run: `cd apps/web && npx tsc --noEmit && npm run build`
Expected: silent + clean.

- [ ] **Step 6: Write the e2e spec (Tier-1 hero)**

Create `apps/web/tests/e2e/inv-paired-transfer.spec.ts` (resilient to empty data — the page must load its frame + either the form or the "requires stores" empty state, never an error alert):

```ts
import { test, expect } from '@playwright/test'

test('paired cross-cluster transfer page loads with header and no error alert', async ({ page }) => {
  await page.goto('/inventory/transfers/paired')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('alert')).toHaveCount(0)
})
```

- [ ] **Step 7: Run the e2e spec**

Run (requires `apps/api` on :3001 + dev DB; Playwright auto-starts the web server):
`cd apps/web && npx playwright test inv-paired-transfer.spec.ts`
Expected: 1 passed. If the dev DB/API is not running in this environment, record that the spec is written + tsc/build are green, and run it at the wave gate.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/pages/inv/PairedTransferPage.tsx apps/web/src/hooks/inv/useProductNames.ts apps/web/src/App.tsx apps/web/tests/e2e/inv-paired-transfer.spec.ts
git commit -m "feat(inv): SI-INV-007 Paired Cross-Cluster Transfer production page (Tier 1)

Ports the §2.2 Brand-Store paired transfer as a SINGLE-item bundle (backend
bundle = one product), fed by the new GET /stores (DL-050) + clusters +
uoms + product pickers. Submit = createBundledTransfer; approve = the direct
/bundles/:id/approve (confirmBundleApproval decomposes into 2 transfers) —
surfaced inline (the Arc-a bundle path creates no approval_request, so no
inbox routing). Fabricated value-at-risk/consumption fixtures dropped.
Route /inventory/transfers/paired + nav + e2e smoke.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Wave-2 gate (run after Task 8, before the chrome-freeze gate / Wave 3)

- [ ] **Full typecheck + build, both packages:**
  `cd apps/api && npm run typecheck && cd ../web && npx tsc --noEmit && npm run build` → all silent/clean.
- [ ] **Backend suite:** `cd apps/api && npm run test` → all passing (527+, incl. the 2 new stores tests).
- [ ] **e2e (Tier-1 hero 007 + the Wave-1 specs), with `apps/api` + dev DB running:**
  `cd apps/web && npx playwright test inv-paired-transfer.spec.ts` → passing. (If dev DB unavailable in this env, record typecheck/build green + the spec written; the founder runs it locally before the deploy.)
- [ ] **Two-stage per-screen review** completed for all four pages — Tier-1 acceptance rigor for SI-INV-007; standard for 004/005/006. Sanity-check each review file targets the right screen.
- [ ] **Token-discipline scan** across the new `apps/web/src/pages/inv/` + the two ported shells: no hex, no banned borders (only `border-l-4` warning pip + `focus-visible:`/`aria-invalid:` rings), Lucide-only, Inter-only, closed status palette, the only animation is CCVoiceInput's guarded pulse → clean.
- [ ] **Envelope audit:** confirm transfer/par hooks use `envelope()` + `.then(r => r.data)`; clusters/uoms/stores hooks are bare. (The exact Wave-1 failure class tsc cannot catch.)
- [ ] **Rules-of-Hooks audit:** every page calls all hooks above the first early return (eslint not installed).
- [ ] **Decision log:** append **DL-050** (founder-authorized read-only `GET /stores` endpoint) and **DL-051** (real progressive Web Speech API for CCVoiceInput; the no-bundle-approval-request reality for SI-INV-007 — bundle approval is a direct decompose call, not Epic-3-routed). Keep `.superpowers/sdd/progress.md` updated per task.
- [ ] **Verify against `git log`** that every task committed as expected; nothing on `main`.

---

## Self-Review (against the spec)

- **Spec coverage (Wave-2 scope):** SI-INV-004 (Task 5), 005 (Task 6), 006 (Task 7), 007 (Task 8) — all four Wave-2 screens have tasks. The two new shells (`CCImplausibilityWarn`, `CCVoiceInput`) are ported as their own early tasks (3, 4) before their consumer (005). The write data layer (transfer create/submit/approve/dispatch/confirm/cancel; bundle create/approve; PAR set/bulk) = Task 2. The founder-authorized stores endpoint = Task 1 (DL-050). Approval routing (over-threshold → `/approvals/inbox`), FR117 reverse/cancel (CCReverseCancelDialog, pre-dispatch backed), CCDuplicateWarn, the `approval_requests` realtime reuse, and the real Web Speech CCVoiceInput are all covered. Tier-1 acceptance for 007 (e2e spec + rigor). Auth-only RBAC, semantic routes, token discipline = Global Constraints.
- **Divergences are explicit, never silent:** the Wave-2 divergence ledger + each task's divergence list name what is dropped/changed and why (FR28 client filter, batch/expiry columns, single-item bundle, fabricated metrics, bundle-has-no-approval-request, post-dispatch reverse), and the commit messages record them. No screen silently claims a capability it does not have; no fabricated data.
- **Placeholder scan:** all code steps show real code; the two "verify against the route before finishing" notes (Task 2 schemas; Task 7 realtime hook signature) are directed verifications against named files, not vague placeholders.
- **Type consistency:** hook names + return types in the Task-2 Interfaces block match their consumers in Tasks 5–8 (`useTransferDetail`/`useCreateTransfer`/`useSubmitTransfer`/`useConfirmReceipt`/`useCreateBundle`/`useApproveBundle`/`useParLevelsList`/`useBulkSetParLevel`/`useInventoryStores`/`useInventoryClusters`/`useInventoryUoms`); `CreateTransferInput`/`CreateBundleInput`/`SetParLevelInput`/`TransferDetail`/`ParLevelRow`/`Store` are defined once and imported everywhere. The envelope helper + bare-vs-enveloped split matches the live routes read during planning.
</content>
</invoke>

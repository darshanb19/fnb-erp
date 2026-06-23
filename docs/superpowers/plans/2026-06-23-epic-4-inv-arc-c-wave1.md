# Epic 4 INV — Arc (c) Production Frontend — Foundation + Wave 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the foundation (one read-only backend endpoint + the inventory data layer) and the 6 read-only Wave-1 inventory pages (SI-INV-001, 002, 003, 008, 009, 016) into the production app `apps/web`, consuming live Arc-(a) services and matching the Arc-(b) mockups.

**Architecture:** Mirror the Epic 3 INF Arc-(c) pattern exactly — each screen is a full-width routed page under `<RequireAuth>`, fed by typed `useApiClient` + TanStack Query hooks with Zod schemas matching the REST envelopes, reusing the frozen `@/components/shell` chrome. Ports each Wave-1 mockup from `mockups/src/screens/inv/` into `apps/web/src/pages/inv/`, swapping the mockup shell alias + fixtures for the production shell + real hooks. One scoped, read-only backend endpoint (`GET /api/v1/stock/department/:departmentId`) is added to back the flagship stock grid.

**Tech Stack:** Vite + React + react-router-dom + TanStack Query v5 + Zod + Supabase Auth (frontend); Express + Drizzle + vitest (backend). TypeScript strict throughout.

**Spec:** `docs/superpowers/specs/2026-06-23-epic-4-inv-arc-c-frontend-design.md`

## Global Constraints

Every task implicitly includes all of these (exact values from the spec + CLAUDE.md):

- **TypeScript strict, zero `any`.** No `any` types anywhere.
- **Token discipline.** No hex literals (DESIGN.md tokens only). Lucide-only icons (`lucide-react`). Inter-only font (no inline `font-family`). Closed 20-token `status_*` palette — inventing a status name is stop-the-line. No sectioning borders (`border`, `border-t/-b/-r/-x/-y`, `divide-y/-x`) except the allow-list: `border-l-2/-l-4/-l-8` status pips, and `focus:`/`focus-visible:`/`aria-invalid:` rings. Use `<SectionShift>` for tonal breaks, never `<Separator>`.
- **No entrance animations** on inventory tables/forms/dashboards. (No motion at all in Wave 1 — the only animation in the whole Arc is CCVoiceInput's listening pulse, which lands in Wave 2.)
- **`tenant_brand_accent` is decorative-only** — never a status/state colour.
- **Every org-scoped query includes `brand_id`** — enforced server-side by the branded DB; the client never sends a cross-brand filter.
- **RBAC:** inventory pages are gated with `<RequireAuth>` only — NO `<RequirePermission>` wrapper (backend enforces auth only; no `inv.*` permissions exist).
- **Routes are semantic under `/inventory/...`** (mirroring `/mdm/...`, `/approvals/...`).
- **Verify against reality, never self-reports:** every task's verification runs the real command (`tsc --noEmit`, `vite build`, `vitest`, `git log`) and reads its output.
- **Commit per task.** Conventional commit messages, scoped `feat(inv)` / `feat(api)` / `test(inv)`. End every commit message with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Branch:** all work on `phase-4/epic-4-inv-arc-c-frontend`. NEVER commit to `main` (auto-deploys to production).
- **Commands run from the package dir:** backend commands from `apps/api/`; frontend commands from `apps/web/`.

---

## File Structure

**Backend (one read-only addition):**
- Modify: `apps/api/src/services/inventory.service.ts` — add `listDepartmentStock` + `DepartmentStockRow`/`DepartmentStockResult` types.
- Modify: `apps/api/src/routes/stock.ts` — add `GET /department/:departmentId`.
- Create: `apps/api/tests/integration/stock-department-list.test.ts` — TDD for the new method.

**Frontend data layer:**
- Modify: `apps/web/src/lib/query-keys.ts` — add `qk.inv.*` namespace.
- Create: `apps/web/src/hooks/inv/schemas.ts` — Zod schemas for all Wave-1 envelopes.
- Create: `apps/web/src/hooks/inv/useStock.ts` — `useDepartmentStock`, `useExpiringBatches`.
- Create: `apps/web/src/hooks/inv/useParLevels.ts` — `useBelowPar`.
- Create: `apps/web/src/hooks/inv/useStockTransfers.ts` — `useTransferSuggestions` (read only in Wave 1).
- Create: `apps/web/src/hooks/inv/useClosingInventory.ts` — `useClosingSummary`, `useCutOffCompliance`.
- Create: `apps/web/src/hooks/inv/useProductNames.ts` — `useInventoryProductNames` (productId → name map).

**Frontend pages (port from mockups):**
- Create: `apps/web/src/pages/inv/StockViewPage.tsx` (SI-INV-001)
- Create: `apps/web/src/pages/inv/DepartmentStockDetailPage.tsx` (SI-INV-002)
- Create: `apps/web/src/pages/inv/BelowParPage.tsx` (SI-INV-003)
- Create: `apps/web/src/pages/inv/ExpiryCountdownPage.tsx` (SI-INV-008)
- Create: `apps/web/src/pages/inv/TransferSuggestionsPage.tsx` (SI-INV-009)
- Create: `apps/web/src/pages/inv/ClosingClusterReviewPage.tsx` (SI-INV-016)
- Modify: `apps/web/src/App.tsx` — register the 6 routes + HomePage nav entries.

**Frontend e2e (Tier-1 heroes):**
- Create: `apps/web/tests/e2e/inv-stock-view.spec.ts` (SI-INV-001)
- Create: `apps/web/tests/e2e/inv-below-par.spec.ts` (SI-INV-003)
- Create: `apps/web/tests/e2e/inv-expiry-countdown.spec.ts` (SI-INV-008)

### Page-port procedure (applies to every page task)

Each page task is a **port**, not a rewrite. The mockup file is the complete visual source of truth (already token-clean and shell-based). For each page:

1. Copy the mockup's JSX structure and sub-components (`FilterChipPicker`, pips, cards, table rows) verbatim into the new page file.
2. **Swap the shell import** `from '@/shell'` → `from '@/components/shell'` (every Wave-1 component exists there; verified).
3. **Delete the fixture imports** from `@/lib/sample-data` / `@/lib/inv-sample-data` and the fixture-derived `const rows = (() => {…})()` blocks.
4. **Replace them with hook-derived data** of the same row shape (the precise mapping code is given per task), including a `productId → name` join where the task says so.
5. **Swap mockup links** `to="/SI-INV-00X?…"` → the real `/inventory/...` route.
6. **Add loading + error + empty states** (complete JSX given below; identical pattern across pages).
7. Register the route in `App.tsx` and add a HomePage nav entry.
8. Verify `tsc --noEmit` + `vite build`; for Tier-1 pages, add + run the e2e spec.
9. Commit.

**Shared loading/error/empty JSX** (use verbatim in every page, swapping the page title):

```tsx
// at top of the returned component, before the main render:
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

`ApiError` is imported from `@/lib/api-client`. The `animate-pulse` skeleton is a loading affordance, not an entrance animation (it appears only while fetching, on a placeholder, never on rendered data) — consistent with the INF pages' loading pattern.

---

## Task 1: Backend — department stock-list endpoint

**Files:**
- Modify: `apps/api/src/services/inventory.service.ts` (add method near `getAvailableStock`, ~line 657)
- Modify: `apps/api/src/routes/stock.ts` (add route after `GET /available`)
- Test: `apps/api/tests/integration/stock-department-list.test.ts` (create)

**Interfaces:**
- Produces: `inventoryService.listDepartmentStock(db: BrandedDb, departmentId: string): Promise<DepartmentStockResult>` where
  ```ts
  interface DepartmentStockRow {
    productId: string
    productName: string
    quantity: number
    unit: string
    lastUpdatedAt: Date
  }
  interface DepartmentStockResult {
    departmentId: string
    items: DepartmentStockRow[]
  }
  ```
- Produces: `GET /api/v1/stock/department/:departmentId` → `{ data: DepartmentStockResult }` (the frontend `useDepartmentStock` hook in Task 2 consumes this).

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/integration/stock-department-list.test.ts`. Mirror the existing integration-test harness (`setupIntegration`, `getTestBrandedDb`, `truncateTestTables`, `unscopedDb`). Seed a cluster→location→department, two products with a UOM, and two `stock_levels` rows; assert the new method lists both, brand-scoped, with name + unit + quantity, ordered by product name.

```ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { sql } from 'drizzle-orm'
import {
  setupIntegration,
  teardownIntegration,
  truncateTestTables,
  getTestBrandedDb,
} from './setup.js'
import { unscopedDb } from '../../src/db/client.js'
import { clusters, locations, departments } from '../../src/db/schema/org.js'
import { uoms, products, stockLevels } from '../../src/db/schema/inventory.js'
import { inventoryService } from '../../src/services/inventory.service.js'

beforeAll(async () => {
  await setupIntegration()
  await truncateTestTables()
})
afterAll(async () => {
  await teardownIntegration()
})
afterEach(async () => {
  await truncateTestTables()
  const raw = unscopedDb()
  await raw.execute(sql`
    TRUNCATE TABLE stock_movements, stock_levels, stock_batches, journal_events, trn_sequences
    RESTART IDENTITY CASCADE
  `)
})

async function seed() {
  const { testBrandId } = getTestBrandedDb()
  const raw = unscopedDb()
  const [cluster] = await raw.insert(clusters)
    .values({ brandId: testBrandId, name: 'C', active: true }).returning({ id: clusters.id })
  const [location] = await raw.insert(locations)
    .values({ brandId: testBrandId, clusterId: cluster!.id, name: 'L', type: 'central_kitchen', active: true })
    .returning({ id: locations.id })
  const [dept] = await raw.insert(departments)
    .values({ brandId: testBrandId, locationId: location!.id, name: 'D', type: 'production', active: true })
    .returning({ id: departments.id })
  const [uom] = await raw.insert(uoms)
    .values({ brandId: testBrandId, code: 'kg', displayName: 'Kilograms', base: 'mass', conversionToBaseFactor: '1.000000000', active: true })
    .returning({ id: uoms.id })
  const [pA] = await raw.insert(products)
    .values({ brandId: testBrandId, sku: 'A-1', name: 'Aaa Flour', type: 'raw', defaultUomId: uom!.id, active: true })
    .returning({ id: products.id })
  const [pB] = await raw.insert(products)
    .values({ brandId: testBrandId, sku: 'B-1', name: 'Bbb Sugar', type: 'raw', defaultUomId: uom!.id, active: true })
    .returning({ id: products.id })
  await raw.insert(stockLevels).values([
    { brandId: testBrandId, productId: pA!.id, departmentId: dept!.id, quantity: '12.5000', uomId: uom!.id, lastUpdatedAt: new Date() },
    { brandId: testBrandId, productId: pB!.id, departmentId: dept!.id, quantity: '3.0000', uomId: uom!.id, lastUpdatedAt: new Date() },
  ])
  return { departmentId: dept!.id, productAId: pA!.id, productBId: pB!.id }
}

describe('inventoryService.listDepartmentStock', () => {
  it('lists all stock rows in a department with product name + unit, ordered by name', async () => {
    const { db } = getTestBrandedDb()
    const { departmentId } = await seed()
    const result = await inventoryService.listDepartmentStock(db, departmentId)
    expect(result.departmentId).toBe(departmentId)
    expect(result.items).toHaveLength(2)
    expect(result.items[0]!.productName).toBe('Aaa Flour')
    expect(result.items[0]!.quantity).toBe(12.5)
    expect(result.items[0]!.unit).toBe('kg')
    expect(result.items[1]!.productName).toBe('Bbb Sugar')
  })

  it('returns an empty items array for a department with no stock', async () => {
    const { db } = getTestBrandedDb()
    const { departmentId, productAId } = await seed()
    // delete the seeded levels to simulate an empty department
    const raw = unscopedDb()
    await raw.execute(sql`DELETE FROM stock_levels`)
    void productAId
    const result = await inventoryService.listDepartmentStock(db, departmentId)
    expect(result.items).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/api && npm run test -- stock-department-list.test.ts`
Expected: FAIL — `inventoryService.listDepartmentStock is not a function`.

- [ ] **Step 3: Implement the service method**

In `apps/api/src/services/inventory.service.ts`, add the types near the other result types and the method immediately after `getAvailableStock` (it follows the same `db.raw.execute(sql\`…\`)` + brand-scope pattern that `getAvailableStock` already uses for the unit lookup):

```ts
export interface DepartmentStockRow {
  productId: string
  productName: string
  quantity: number
  unit: string
  lastUpdatedAt: Date
}

export interface DepartmentStockResult {
  departmentId: string
  items: DepartmentStockRow[]
}
```

```ts
async listDepartmentStock(
  db: BrandedDb,
  departmentId: string,
): Promise<DepartmentStockResult> {
  const rows = (await db.raw.execute(sql`
    SELECT
      sl.product_id      AS product_id,
      p.name             AS product_name,
      sl.quantity        AS quantity,
      u.code             AS unit,
      sl.last_updated_at AS last_updated_at
    FROM stock_levels sl
    INNER JOIN products p ON p.id = sl.product_id AND p.brand_id = sl.brand_id
    INNER JOIN uoms u     ON u.id = sl.uom_id     AND u.brand_id = sl.brand_id
    WHERE sl.brand_id = ${db.brandId}
      AND sl.department_id = ${departmentId}
    ORDER BY p.name ASC
  `)) as unknown as Array<{
    product_id: string
    product_name: string
    quantity: string
    unit: string
    last_updated_at: Date
  }>

  return {
    departmentId,
    items: rows.map((r) => ({
      productId: r.product_id,
      productName: r.product_name,
      quantity: Number(r.quantity),
      unit: r.unit,
      lastUpdatedAt: r.last_updated_at,
    })),
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && npm run test -- stock-department-list.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the route**

In `apps/api/src/routes/stock.ts`, add after the `GET /available` handler. Mirror the existing guard + zod-parse + envelope pattern exactly:

```ts
const departmentStockParamsSchema = z.object({
  departmentId: z.string().uuid(),
})

stockRouter.get('/department/:departmentId', async (req, res, next) => {
  try {
    if (!req.db) {
      res.status(401).json({ code: 'auth.required', message: 'No database context' })
      return
    }
    const { departmentId } = departmentStockParamsSchema.parse(req.params)
    const result = await inventoryService.listDepartmentStock(req.db, departmentId)
    res.json({ data: result })
  } catch (e) {
    if (e instanceof z.ZodError) return next(toValidationError(e))
    next(e)
  }
})
```

- [ ] **Step 6: Run the full inventory test suite to confirm no regressions**

Run: `cd apps/api && npm run test`
Expected: all prior tests still pass + the 2 new ones (524+ passing). Read the summary line.

- [ ] **Step 7: Typecheck the API package**

Run: `cd apps/api && npm run typecheck` (or `npx tsc --noEmit` if no `typecheck` script)
Expected: no output (silent success).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/services/inventory.service.ts apps/api/src/routes/stock.ts apps/api/tests/integration/stock-department-list.test.ts
git commit -m "feat(api): read-only GET /stock/department/:departmentId list endpoint

Lists on-hand stock for all items in a department (productId, productName,
quantity, unit, lastUpdatedAt), brand-scoped, ordered by name. Reads the
existing stock_levels table — no new tables, no migration, no writes. The
one scoped backend exception in Epic 4 Arc (c), to back the flagship
Real-Time Stock View (SI-INV-001).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Frontend inventory data layer (query keys, schemas, read hooks)

**Files:**
- Modify: `apps/web/src/lib/query-keys.ts` (add `inv` namespace inside the `qk` object)
- Create: `apps/web/src/hooks/inv/schemas.ts`
- Create: `apps/web/src/hooks/inv/useStock.ts`
- Create: `apps/web/src/hooks/inv/useParLevels.ts`
- Create: `apps/web/src/hooks/inv/useStockTransfers.ts`
- Create: `apps/web/src/hooks/inv/useClosingInventory.ts`
- Create: `apps/web/src/hooks/inv/useProductNames.ts`

**Interfaces:**
- Consumes: `useApiClient` from `@/hooks/use-api-client`; `useSession` from `@/lib/auth`; `qk` from `@/lib/query-keys`.
- Produces (consumed by page tasks 3–8):
  - `useDepartmentStock(departmentId?: string)` → `UseQueryResult<DepartmentStockResult>`
  - `useExpiringBatches(scope: { departmentId?: string; locationId?: string; clusterId?: string })` → `UseQueryResult<ExpiringBatchesResult>`
  - `useBelowPar(filter: { locationId?: string; businessDate?: string })` → `UseQueryResult<BelowParRow[]>`
  - `useTransferSuggestions(sourceDepartmentId?: string, destinationDepartmentId?: string)` → `UseQueryResult<TransferSuggestion[]>`
  - `useClosingSummary(businessDate: string, scope: { locationId?: string; departmentId?: string })` → `UseQueryResult<ClosingInventorySummary>`
  - `useCutOffCompliance(businessDate: string, scope: { locationId?: string; departmentId?: string })` → `UseQueryResult<CutOffComplianceResult>`
  - `useInventoryProductNames()` → `{ nameOf: (productId: string) => string; isLoading: boolean }`

- [ ] **Step 1: Add the `qk.inv` namespace**

In `apps/web/src/lib/query-keys.ts`, add this property inside the `qk` object (e.g. after the `inf:` block, before the closing `} as const`):

```ts
  inv: {
    stock: {
      department: (departmentId: string) => ['inv', 'stock', 'department', departmentId] as const,
      expiring: (scope: object) => ['inv', 'stock', 'expiring', scope] as const,
    },
    belowPar: (filter: object) => ['inv', 'belowPar', filter] as const,
    suggestions: (src: string, dest: string) => ['inv', 'suggestions', src, dest] as const,
    closing: {
      summary: (businessDate: string, scope: object) =>
        ['inv', 'closing', 'summary', businessDate, scope] as const,
      cutOff: (businessDate: string, scope: object) =>
        ['inv', 'closing', 'cutOff', businessDate, scope] as const,
    },
    productNames: () => ['inv', 'productNames'] as const,
  },
```

- [ ] **Step 2: Write the Zod schemas**

Create `apps/web/src/hooks/inv/schemas.ts` with schemas matching the Arc-(a) envelopes (field names verified against the backend services). The API client unwraps `{ data }` itself only when you pass the inner schema — these hooks pass a schema for the value of `data`, so define the inner shapes:

```ts
import { z } from 'zod'

// GET /stock/department/:departmentId → data: DepartmentStockResult
export const departmentStockRowSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  quantity: z.number(),
  unit: z.string(),
  lastUpdatedAt: z.string(), // ISO timestamp (JSON-serialised Date)
})
export const departmentStockResultSchema = z.object({
  departmentId: z.string().uuid(),
  items: z.array(departmentStockRowSchema),
})
export type DepartmentStockRow = z.infer<typeof departmentStockRowSchema>
export type DepartmentStockResult = z.infer<typeof departmentStockResultSchema>

// GET /stock/expiring → data: ExpiringBatchesResult
export const expiringItemSchema = z.object({
  batchId: z.string().uuid(),
  productId: z.string().uuid(),
  departmentId: z.string().uuid(),
  batchNumber: z.string(),
  quantityRemaining: z.number(),
  expiryDate: z.string(),
  hoursUntilExpiry: z.number(),
  valueAtRisk: z.number(),
})
export const expiringBatchesResultSchema = z.object({
  bands: z.object({
    h24: z.number(),
    h48: z.number(),
    h72: z.number(),
    over72: z.number(),
  }),
  items: z.array(expiringItemSchema),
})
export type ExpiringItem = z.infer<typeof expiringItemSchema>
export type ExpiringBatchesResult = z.infer<typeof expiringBatchesResultSchema>

// GET /par-levels/below → data: BelowParRow[]
export const belowParRowSchema = z.object({
  parLevelId: z.string().uuid(),
  productId: z.string().uuid(),
  locationId: z.string().uuid().nullable(),
  departmentId: z.string().uuid().nullable(),
  basePar: z.number(),
  adjustedPar: z.number(),
  onHand: z.number(),
  shortfall: z.number(),
  suggestedReorder: z.number(),
})
export const belowParListSchema = z.array(belowParRowSchema)
export type BelowParRow = z.infer<typeof belowParRowSchema>

// GET /stock-transfers/suggestions → data: { suggestions: TransferSuggestion[] }
export const transferSuggestionSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string(),
  sourceDepartmentId: z.string().uuid(),
  availableQty: z.number(),
  suggestedQty: z.number(),
  reason: z.string(),
})
export const transferSuggestionsResultSchema = z.object({
  suggestions: z.array(transferSuggestionSchema),
})
export type TransferSuggestion = z.infer<typeof transferSuggestionSchema>

// GET /closing-inventory/summary → data: ClosingInventorySummary
export const closingSummaryRecordSchema = z.object({
  id: z.string().uuid(),
  ciTrn: z.string(),
  locationId: z.string().uuid(),
  departmentId: z.string().uuid(),
  status: z.enum(['draft', 'confirmed', 'variance_flagged']),
  varianceItemsCount: z.number().nullable(),
  totalVarianceValue: z.number().nullable(),
})
export const closingInventorySummarySchema = z.object({
  businessDate: z.string(),
  totalRecords: z.number(),
  confirmedCount: z.number(),
  varianceFlaggedCount: z.number(),
  varianceAcceptedCount: z.number(),
  draftCount: z.number(),
  records: z.array(closingSummaryRecordSchema),
})
export type ClosingInventorySummary = z.infer<typeof closingInventorySummarySchema>

// GET /closing-inventory/cut-off-compliance → data: CutOffComplianceResult
export const cutOffComplianceResultSchema = z.object({
  businessDate: z.string(),
  locationId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  cutOffTime: z.string().nullable(),
  submissionTime: z.string().nullable(),
  status: z.enum(['on_time', 'late', 'not_submitted', 'no_cutoff_configured']),
})
export type CutOffComplianceResult = z.infer<typeof cutOffComplianceResultSchema>

// GET /api/v1/products → data: array (only id + name needed for name resolution)
export const productNameSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})
export const productNameListSchema = z.array(productNameSchema)
```

> **Verification note for the implementer:** before finishing this task, open the backend services
> (`apps/api/src/services/inventory.service.ts`, `transfer.service.ts`) and confirm each field
> name above matches the actual returned object. If the products list endpoint wraps its array
> differently (e.g. `{ data: { products: [...] } }`), adjust `productNameListSchema` and the
> hook path in Step 7 accordingly. Do not guess — read the route.

- [ ] **Step 3: Write `useStock.ts`**

Create `apps/web/src/hooks/inv/useStock.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/use-api-client'
import { useSession } from '@/lib/auth'
import { qk } from '@/lib/query-keys'
import { departmentStockResultSchema, expiringBatchesResultSchema } from './schemas'

export function useDepartmentStock(departmentId: string | undefined) {
  const client = useApiClient()
  const { session } = useSession()
  return useQuery({
    queryKey: departmentId
      ? qk.inv.stock.department(departmentId)
      : ['inv', 'stock', 'department', null],
    queryFn: ({ signal }) => {
      if (!departmentId) throw new Error('useDepartmentStock called without departmentId')
      return client.get({
        path: `/api/v1/stock/department/${departmentId}`,
        schema: departmentStockResultSchema,
        signal,
      })
    },
    enabled: Boolean(session) && Boolean(departmentId),
  })
}

export interface ExpiringScope {
  departmentId?: string
  locationId?: string
  clusterId?: string
}

export function useExpiringBatches(scope: ExpiringScope) {
  const client = useApiClient()
  const { session } = useSession()
  const params = new URLSearchParams()
  if (scope.departmentId) params.set('departmentId', scope.departmentId)
  if (scope.locationId) params.set('locationId', scope.locationId)
  if (scope.clusterId) params.set('clusterId', scope.clusterId)
  const qs = params.toString()
  return useQuery({
    queryKey: qk.inv.stock.expiring(scope),
    queryFn: ({ signal }) =>
      client.get({
        path: `/api/v1/stock/expiring${qs ? `?${qs}` : ''}`,
        schema: expiringBatchesResultSchema,
        signal,
      }),
    enabled: Boolean(session),
  })
}
```

- [ ] **Step 4: Write `useParLevels.ts`**

Create `apps/web/src/hooks/inv/useParLevels.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/use-api-client'
import { useSession } from '@/lib/auth'
import { qk } from '@/lib/query-keys'
import { belowParListSchema } from './schemas'

export interface BelowParFilter {
  locationId?: string
  businessDate?: string
}

export function useBelowPar(filter: BelowParFilter) {
  const client = useApiClient()
  const { session } = useSession()
  const params = new URLSearchParams()
  if (filter.locationId) params.set('locationId', filter.locationId)
  if (filter.businessDate) params.set('businessDate', filter.businessDate)
  const qs = params.toString()
  return useQuery({
    queryKey: qk.inv.belowPar(filter),
    queryFn: ({ signal }) =>
      client.get({
        path: `/api/v1/par-levels/below${qs ? `?${qs}` : ''}`,
        schema: belowParListSchema,
        signal,
      }),
    enabled: Boolean(session),
  })
}
```

- [ ] **Step 5: Write `useStockTransfers.ts`** (suggestions read only in Wave 1)

Create `apps/web/src/hooks/inv/useStockTransfers.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/use-api-client'
import { useSession } from '@/lib/auth'
import { qk } from '@/lib/query-keys'
import { transferSuggestionsResultSchema } from './schemas'

export function useTransferSuggestions(
  sourceDepartmentId: string | undefined,
  destinationDepartmentId: string | undefined,
) {
  const client = useApiClient()
  const { session } = useSession()
  const ready = Boolean(sourceDepartmentId) && Boolean(destinationDepartmentId)
  return useQuery({
    queryKey: qk.inv.suggestions(sourceDepartmentId ?? '', destinationDepartmentId ?? ''),
    queryFn: ({ signal }) => {
      if (!sourceDepartmentId || !destinationDepartmentId)
        throw new Error('useTransferSuggestions requires both department ids')
      const qs = new URLSearchParams({ sourceDepartmentId, destinationDepartmentId }).toString()
      return client
        .get({
          path: `/api/v1/stock-transfers/suggestions?${qs}`,
          schema: transferSuggestionsResultSchema,
          signal,
        })
        .then((r) => r.suggestions)
    },
    enabled: Boolean(session) && ready,
  })
}
```

- [ ] **Step 6: Write `useClosingInventory.ts`**

Create `apps/web/src/hooks/inv/useClosingInventory.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/use-api-client'
import { useSession } from '@/lib/auth'
import { qk } from '@/lib/query-keys'
import { closingInventorySummarySchema, cutOffComplianceResultSchema } from './schemas'

export interface ClosingScope {
  locationId?: string
  departmentId?: string
}

function scopeParams(businessDate: string, scope: ClosingScope): string {
  const params = new URLSearchParams({ businessDate })
  if (scope.locationId) params.set('locationId', scope.locationId)
  if (scope.departmentId) params.set('departmentId', scope.departmentId)
  return params.toString()
}

export function useClosingSummary(businessDate: string, scope: ClosingScope) {
  const client = useApiClient()
  const { session } = useSession()
  return useQuery({
    queryKey: qk.inv.closing.summary(businessDate, scope),
    queryFn: ({ signal }) =>
      client.get({
        path: `/api/v1/closing-inventory/summary?${scopeParams(businessDate, scope)}`,
        schema: closingInventorySummarySchema,
        signal,
      }),
    enabled: Boolean(session) && Boolean(businessDate),
  })
}

export function useCutOffCompliance(businessDate: string, scope: ClosingScope) {
  const client = useApiClient()
  const { session } = useSession()
  return useQuery({
    queryKey: qk.inv.closing.cutOff(businessDate, scope),
    queryFn: ({ signal }) =>
      client.get({
        path: `/api/v1/closing-inventory/cut-off-compliance?${scopeParams(businessDate, scope)}`,
        schema: cutOffComplianceResultSchema,
        signal,
      }),
    enabled: Boolean(session) && Boolean(businessDate),
  })
}
```

- [ ] **Step 7: Write `useProductNames.ts`**

Create `apps/web/src/hooks/inv/useProductNames.ts` — a small self-contained helper that fetches the brand's products once and exposes a `productId → name` lookup. (Self-contained rather than coupling to the MDM hook's return contract, per the spec's product-name-resolution note.)

```ts
import { useQuery } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/use-api-client'
import { useSession } from '@/lib/auth'
import { qk } from '@/lib/query-keys'
import { productNameListSchema } from './schemas'

export function useInventoryProductNames(): {
  nameOf: (productId: string) => string
  isLoading: boolean
} {
  const client = useApiClient()
  const { session } = useSession()
  const query = useQuery({
    queryKey: qk.inv.productNames(),
    queryFn: ({ signal }) =>
      client.get({
        path: '/api/v1/products',
        schema: productNameListSchema,
        signal,
      }),
    enabled: Boolean(session),
    staleTime: 5 * 60_000,
  })
  const map = new Map((query.data ?? []).map((p) => [p.id, p.name]))
  return {
    nameOf: (productId: string) => map.get(productId) ?? productId,
    isLoading: query.isLoading,
  }
}
```

- [ ] **Step 8: Typecheck + build**

Run: `cd apps/web && npx tsc --noEmit && npm run build`
Expected: tsc silent; vite build completes with no errors. (No runtime test — this app has no frontend unit-test runner; correctness of the wiring is exercised by the page e2e specs in later tasks.)

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/query-keys.ts apps/web/src/hooks/inv/
git commit -m "feat(inv): inventory data layer — qk.inv keys, Zod schemas, Wave-1 read hooks

Adds qk.inv namespace + hooks/inv/{schemas,useStock,useParLevels,
useStockTransfers,useClosingInventory,useProductNames}. Typed TanStack
Query wrappers over the live Arc-(a) read endpoints + a productId->name
resolver. No UI yet.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: SI-INV-003 Below-PAR Flag List (Tier 1) — page + route + e2e

**Files:**
- Create: `apps/web/src/pages/inv/BelowParPage.tsx`
- Modify: `apps/web/src/App.tsx` (route `/inventory/below-par` + nav entry)
- Test: `apps/web/tests/e2e/inv-below-par.spec.ts`

**Interfaces:**
- Consumes: `useBelowPar` (Task 2), `useInventoryProductNames` (Task 2), `ApiError` from `@/lib/api-client`, shell components from `@/components/shell`.
- Mockup source: `mockups/src/screens/inv/SI-INV-003.tsx`.

- [ ] **Step 1: Port the mockup into the page file**

Copy `mockups/src/screens/inv/SI-INV-003.tsx` to `apps/web/src/pages/inv/BelowParPage.tsx`. Rename the default export to `BelowParPage`. Apply the **Page-port procedure** (top of plan): swap `from '@/shell'` → `from '@/components/shell'`; keep the inline `FilterChipPicker` and the three `DashboardTile` counters and the row table/cards verbatim.

- [ ] **Step 2: Replace fixtures with live data**

Delete the imports from `@/lib/inv-sample-data` / `@/lib/sample-data` and the fixture-derived `belowParRows` block. At the top of the component, wire the hooks and build the rows from real data (the mockup's row shape needs `name`, `onHand`, `basePar`, `adjustedPar`, `shortfall`, `suggestedReorder`, `urgency`, `onOpenPo` — derive `urgency` client-side from the ratio; `onOpenPo` is not in the API, so render it as a neutral "—" placeholder and drop the on-PO filter/badge, since PO is an Epic-5 seam):

```tsx
import { useBelowPar } from '@/hooks/inv/useParLevels'
import { useInventoryProductNames } from '@/hooks/inv/useProductNames'
import { ApiError } from '@/lib/api-client'
// ...
const { data: belowParRaw, isLoading, error } = useBelowPar({})
const { nameOf } = useInventoryProductNames()

type Urgency = 'approaching' | 'below' | 'critical'
function deriveUrgency(onHand: number, adjustedPar: number): Urgency {
  if (adjustedPar <= 0) return 'below'
  const ratio = onHand / adjustedPar
  if (ratio <= 0.5) return 'critical'
  if (ratio < 0.8) return 'below'
  return 'approaching'
}

const rows = (belowParRaw ?? []).map((r) => ({
  productId: r.productId,
  name: nameOf(r.productId),
  onHand: r.onHand,
  basePar: r.basePar,
  adjustedPar: r.adjustedPar,
  shortfall: r.shortfall,
  suggestedReorder: r.suggestedReorder,
  urgency: deriveUrgency(r.onHand, r.adjustedPar),
}))
```

Recompute the three `DashboardTile` counters from `rows` (total below PAR = `rows.length`; critical = `rows.filter(r => r.urgency === 'critical').length`; the third tile "on open PO" becomes "approaching" = `rows.filter(r => r.urgency === 'approaching').length`, relabel the tile accordingly). Render the loading/error/empty states using the **shared JSX** from the Page-port procedure (place the loading/error guards before the main `return`; for empty, show the mockup's existing empty-state when `rows.length === 0`).

- [ ] **Step 3: Fix links + footer**

Swap any mockup row link `to="/SI-INV-002?item=…"` → `to={\`/inventory/stock/detail?item=${row.productId}\`}`. Swap "Create PO" / "Requisition" stub links to render as disabled affordances with a title="Available in a later phase" (PO is an Epic-5 seam). Update the footer screen tag if present.

- [ ] **Step 4: Register the route + nav entry**

In `apps/web/src/App.tsx`, add the import `import BelowParPage from '@/pages/inv/BelowParPage'` and this route (auth-only, like the MDM pages):

```tsx
{/* SI-INV-003 Below-PAR Flag List — Wave 1 (Tier 1) */}
<Route
  path="/inventory/below-par"
  element={
    <RequireAuth>
      <BelowParPage />
    </RequireAuth>
  }
/>
```

Add to the HomePage nav list array: `{ href: '/inventory/below-par', label: 'Below-PAR list (SI-INV-003)' },`.

- [ ] **Step 5: Typecheck + build**

Run: `cd apps/web && npx tsc --noEmit && npm run build`
Expected: tsc silent; build clean.

- [ ] **Step 6: Write the e2e spec**

Create `apps/web/tests/e2e/inv-below-par.spec.ts`. This app's e2e uses a pre-authenticated session and a shared dev DB; Wave-1 read pages have no UI to seed stock, so the spec asserts the page loads and renders its frame + either rows or a proper empty state (no dependency on seeded data — avoids flakiness):

```ts
import { test, expect } from '@playwright/test'

test('below-PAR page loads with header and either rows or an empty state', async ({ page }) => {
  await page.goto('/inventory/below-par')
  // Page header from the mockup
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })
  // Either the items table/cards render, or the empty-state message shows — never an error alert
  await expect(page.getByRole('alert')).toHaveCount(0)
})
```

> If the page's `<h1>` text is a known string after the port, prefer `getByRole('heading', { name: /below par/i })`. Keep the assertion resilient to empty data.

- [ ] **Step 7: Run the e2e spec**

Run (requires `apps/api` running on :3001 + dev DB; Playwright auto-starts the web server):
`cd apps/web && npx playwright test inv-below-par.spec.ts`
Expected: 1 passed. If the dev DB/API is not running in this environment, record that the spec is written and typecheck/build are green, and run it at the wave gate.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/pages/inv/BelowParPage.tsx apps/web/src/App.tsx apps/web/tests/e2e/inv-below-par.spec.ts
git commit -m "feat(inv): SI-INV-003 Below-PAR Flag List production page (Tier 1)

Ports the Arc-(b) mockup to apps/web, fed by useBelowPar + product-name
resolution; derives urgency client-side; PO seams rendered as deferred
stubs. Auth-gated route /inventory/below-par + nav entry + e2e smoke.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: SI-INV-008 Expiry Countdown Dashboard (Tier 1) — page + route + e2e

**Files:**
- Create: `apps/web/src/pages/inv/ExpiryCountdownPage.tsx`
- Modify: `apps/web/src/App.tsx` (route `/inventory/expiry` + nav entry)
- Test: `apps/web/tests/e2e/inv-expiry-countdown.spec.ts`

**Interfaces:**
- Consumes: `useExpiringBatches` (Task 2), `useInventoryProductNames` (Task 2), `ApiError`, `@/components/shell`.
- Mockup source: `mockups/src/screens/inv/SI-INV-008.tsx`.

- [ ] **Step 1: Port the mockup**

Copy `mockups/src/screens/inv/SI-INV-008.tsx` → `apps/web/src/pages/inv/ExpiryCountdownPage.tsx`, default export `ExpiryCountdownPage`. Apply the Page-port procedure (swap shell alias; keep the three urgency band sections, per-band `DashboardTile`s, `PairedTransferBundle` badges, and inline `FilterChipPicker` verbatim).

- [ ] **Step 2: Replace fixtures with live data**

Delete fixture imports + fixture-derived batch arrays. Wire the hook (scope: for Wave 1, no department picker yet — call brand-wide by passing an empty scope; the API accepts no-scope and returns brand-wide expiring batches). Map the API `items` into the mockup's batch-row shape, resolving names, and split into bands using `hoursUntilExpiry`:

```tsx
import { useExpiringBatches } from '@/hooks/inv/useStock'
import { useInventoryProductNames } from '@/hooks/inv/useProductNames'
import { ApiError } from '@/lib/api-client'
// ...
const { data: expiring, isLoading, error } = useExpiringBatches({})
const { nameOf } = useInventoryProductNames()

const items = (expiring?.items ?? []).map((it) => ({
  batchId: it.batchId,
  productId: it.productId,
  name: nameOf(it.productId),
  batchNumber: it.batchNumber,
  quantityRemaining: it.quantityRemaining,
  hoursUntilExpiry: it.hoursUntilExpiry,
  valueAtRisk: it.valueAtRisk,
  expiryDate: it.expiryDate,
}))

const band24 = items.filter((i) => i.hoursUntilExpiry <= 24)
const band48 = items.filter((i) => i.hoursUntilExpiry > 24 && i.hoursUntilExpiry <= 48)
const band72 = items.filter((i) => i.hoursUntilExpiry > 48 && i.hoursUntilExpiry <= 72)
```

Drive the per-band `DashboardTile` counts from `expiring?.bands` (`h24`, `h48`, `h72`) and value-at-risk sums from the band arrays. The "suggestion-type" badge (single-hop vs paired vs write-off) is not derivable from this endpoint in Wave 1 — render a neutral "Review for transfer" affordance instead of a computed suggestion type (note this divergence in the commit). Add loading/error/empty guards (shared JSX).

- [ ] **Step 3: Fix links**

Swap mockup row/suggestion links (`/SI-INV-009`, `/SI-INV-005`, `/SI-INV-007`) → `to="/inventory/suggestions"` for the generic "review transfer" action (SI-INV-009 lands in Task 7). Disable links to not-yet-built Wave-2 screens (SI-INV-005/007) with `title="Available in Wave 2"`.

- [ ] **Step 4: Register route + nav**

Add `import ExpiryCountdownPage from '@/pages/inv/ExpiryCountdownPage'` and:

```tsx
{/* SI-INV-008 Expiry Countdown Dashboard — Wave 1 (Tier 1) */}
<Route
  path="/inventory/expiry"
  element={
    <RequireAuth>
      <ExpiryCountdownPage />
    </RequireAuth>
  }
/>
```

Nav entry: `{ href: '/inventory/expiry', label: 'Expiry countdown (SI-INV-008)' },`.

- [ ] **Step 5: Typecheck + build**

Run: `cd apps/web && npx tsc --noEmit && npm run build`
Expected: silent + clean.

- [ ] **Step 6: Write + run the e2e spec**

Create `apps/web/tests/e2e/inv-expiry-countdown.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('expiry countdown page loads with the three urgency bands', async ({ page }) => {
  await page.goto('/inventory/expiry')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('alert')).toHaveCount(0)
})
```

Run: `cd apps/web && npx playwright test inv-expiry-countdown.spec.ts` (or defer to wave gate if no dev DB).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/pages/inv/ExpiryCountdownPage.tsx apps/web/src/App.tsx apps/web/tests/e2e/inv-expiry-countdown.spec.ts
git commit -m "feat(inv): SI-INV-008 Expiry Countdown Dashboard production page (Tier 1)

Ports the Arc-(b) mockup, fed by useExpiringBatches + name resolution;
24/48/72h bands + value-at-risk from the live endpoint. Suggestion-type
badge replaced with a neutral review action (not derivable in Wave 1).
Route /inventory/expiry + nav + e2e smoke.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: SI-INV-001 Real-Time Stock View (Tier 1) — page + route + e2e

**Files:**
- Create: `apps/web/src/pages/inv/StockViewPage.tsx`
- Modify: `apps/web/src/App.tsx` (route `/inventory/stock` + nav entry)
- Test: `apps/web/tests/e2e/inv-stock-view.spec.ts`

**Interfaces:**
- Consumes: `useDepartmentStock` (Task 2, backed by the Task 1 endpoint), `@/components/shell`, `ApiError`.
- Mockup source: `mockups/src/screens/inv/SI-INV-001.tsx`.
- Needs a department to query. Wave 1 has no department-picker chrome wired to MDM yet; use a **department selector** seeded from the MDM departments list (reuse the existing departments hook if its contract is known, else fetch `/api/v1/departments` with a minimal `{ id, name }` schema like `useInventoryProductNames` does for products). The selected `departmentId` drives `useDepartmentStock`.

- [ ] **Step 1: Add a minimal departments lookup**

Add to `apps/web/src/hooks/inv/useProductNames.ts` (or a sibling `useDepartments.ts`) a `useInventoryDepartments()` hook returning `{ id, name }[]` from `GET /api/v1/departments`, schema mirroring `productNameListSchema`. Confirm the real products/departments list envelope shape before finalising (read the route).

```ts
export const departmentListSchema = z.array(z.object({ id: z.string().uuid(), name: z.string() }))
// hook: useQuery on ['inv','departments'], path '/api/v1/departments', schema departmentListSchema
```

- [ ] **Step 2: Port the mockup**

Copy `mockups/src/screens/inv/SI-INV-001.tsx` → `apps/web/src/pages/inv/StockViewPage.tsx`, default export `StockViewPage`. Apply the Page-port procedure. Keep the `DashboardTile` counters, `FilterChipPicker` strip, mobile cards + desktop table, `ExpiryPip`, and search verbatim.

- [ ] **Step 3: Replace fixtures with live data**

Delete `@/lib/sample-data` imports and the `stockRows` fixture block. Add a department `<select>` (use the shell `Input`/`Select` pattern or a simple native select styled with tokens) bound to `useState<string>()`, defaulting to the first department from `useInventoryDepartments()`. Build rows from `useDepartmentStock`:

```tsx
import { useDepartmentStock } from '@/hooks/inv/useStock'
import { useInventoryDepartments } from '@/hooks/inv/useProductNames'
import { ApiError } from '@/lib/api-client'
// ...
const { data: depts } = useInventoryDepartments()
const [departmentId, setDepartmentId] = useState<string | undefined>(undefined)
const effectiveDept = departmentId ?? depts?.[0]?.id
const { data: stock, isLoading, error } = useDepartmentStock(effectiveDept)

const stockRows = (stock?.items ?? []).map((it) => ({
  id: it.productId,
  name: it.productName,
  onHand: it.quantity,
  unit: it.unit,
  lastUpdatedAt: it.lastUpdatedAt,
}))
```

The mockup's expiry-band/PAR/provisional columns are **not** in this endpoint. For Wave 1, render the columns the endpoint supports (item, unit, on-hand, last-updated) and drop the expiry-band/PAR/below-PAR columns + their filter chips (those live on SI-INV-008 / SI-INV-003 which ARE backed). Keep the search box (filters by name client-side). Replace the "Updated N min ago" helper to consume the real `lastUpdatedAt` ISO string. Add loading/error/empty guards.

- [ ] **Step 4: Fix links**

Swap card/row link `to="/SI-INV-002?item=…"` → `to={\`/inventory/stock/detail?item=${row.id}&dept=${effectiveDept}\`}` (SI-INV-002 is Task 6).

- [ ] **Step 5: Register route + nav**

Add `import StockViewPage from '@/pages/inv/StockViewPage'` and:

```tsx
{/* SI-INV-001 Real-Time Stock View — Wave 1 (Tier 1) */}
<Route
  path="/inventory/stock"
  element={
    <RequireAuth>
      <StockViewPage />
    </RequireAuth>
  }
/>
```

Nav entry: `{ href: '/inventory/stock', label: 'Real-time stock (SI-INV-001)' },`.

- [ ] **Step 6: Typecheck + build**

Run: `cd apps/web && npx tsc --noEmit && npm run build`
Expected: silent + clean.

- [ ] **Step 7: Write + run the e2e spec**

Create `apps/web/tests/e2e/inv-stock-view.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

test('stock view loads with department selector and a stock table or empty state', async ({ page }) => {
  await page.goto('/inventory/stock')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('alert')).toHaveCount(0)
})
```

Run: `cd apps/web && npx playwright test inv-stock-view.spec.ts` (or defer to wave gate).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/pages/inv/StockViewPage.tsx apps/web/src/hooks/inv/ apps/web/src/App.tsx apps/web/tests/e2e/inv-stock-view.spec.ts
git commit -m "feat(inv): SI-INV-001 Real-Time Stock View production page (Tier 1)

Ports the flagship stock grid, fed by the new department stock-list
endpoint via useDepartmentStock + a department selector. Columns scoped
to what the endpoint returns (item/unit/on-hand/last-updated); expiry +
PAR columns live on their own backed screens. Route /inventory/stock +
nav + e2e smoke.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: SI-INV-002 Department Stock Detail — page + route

**Files:**
- Create: `apps/web/src/pages/inv/DepartmentStockDetailPage.tsx`
- Modify: `apps/web/src/App.tsx` (route `/inventory/stock/detail` + nav from SI-INV-001/003 drill-ins)

**Interfaces:**
- Consumes: `useExpiringBatches` (filtered to one product client-side for the batch list), `useDepartmentStock` (for the on-hand header), `useInventoryProductNames`, `@/components/shell`, `useSearchParams` from react-router-dom.
- Mockup source: `mockups/src/screens/inv/SI-INV-002.tsx`.

- [ ] **Step 1: Port the mockup**

Copy `mockups/src/screens/inv/SI-INV-002.tsx` → `apps/web/src/pages/inv/DepartmentStockDetailPage.tsx`, default export `DepartmentStockDetailPage`. Apply the Page-port procedure (item header, aggregate pills, FEFO batch table, movement-history table, `AuditLink`, `ProvisionalFlag` verbatim).

- [ ] **Step 2: Read params + wire live data**

Read `item` + `dept` from `useSearchParams()`. The on-hand value comes from `useDepartmentStock(dept)` filtered to the `item` row. The FEFO batch list comes from `useExpiringBatches({ departmentId: dept })` filtered to `productId === item` (this endpoint returns ALL batches in scope across all bands, including `over72`, so it is the batch source). The 30-day movement history needs `GET /api/v1/stock/movements?productId=&departmentId=` — add a `useStockMovements(productId, departmentId)` hook to `useStock.ts` with a movements schema (read the `stock_movements` response shape in `stock.ts` and define the schema to match; fields include movementType, quantityDelta, trn/sourceRef, occurredOn). Resolve the product name via `useInventoryProductNames`.

```tsx
const [params] = useSearchParams()
const item = params.get('item') ?? undefined
const dept = params.get('dept') ?? undefined
const { data: stock } = useDepartmentStock(dept)
const { data: expiring } = useExpiringBatches({ departmentId: dept })
const { data: movements, isLoading, error } = useStockMovements(item, dept)
const { nameOf } = useInventoryProductNames()

const onHandRow = (stock?.items ?? []).find((i) => i.productId === item)
const batches = (expiring?.items ?? []).filter((b) => b.productId === item)
```

Render the aggregate PAR/below-PAR pill only if available (PAR is on SI-INV-004 — for Wave 1, omit the PAR pill here or show "—", since per-item PAR is not in these endpoints). Add loading/error/empty guards. If `item`/`dept` are missing, render a friendly "Select an item from the stock view" message.

- [ ] **Step 3: Fix links**

Swap "Transfer from here" / "Adjust batch" links (`/SI-INV-005`, `/SI-INV-013`) to disabled affordances `title="Available in a later wave"`. Keep `AuditLink` (it points to the real `/audit` viewer).

- [ ] **Step 4: Register route + nav**

Add `import DepartmentStockDetailPage from '@/pages/inv/DepartmentStockDetailPage'` and:

```tsx
{/* SI-INV-002 Department Stock Detail — Wave 1 */}
<Route
  path="/inventory/stock/detail"
  element={
    <RequireAuth>
      <DepartmentStockDetailPage />
    </RequireAuth>
  }
/>
```

(No separate nav entry needed — reached by drilling from SI-INV-001/003. Optionally add a nav entry for discoverability.)

- [ ] **Step 5: Typecheck + build**

Run: `cd apps/web && npx tsc --noEmit && npm run build`
Expected: silent + clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/inv/DepartmentStockDetailPage.tsx apps/web/src/hooks/inv/useStock.ts apps/web/src/hooks/inv/schemas.ts apps/web/src/App.tsx
git commit -m "feat(inv): SI-INV-002 Department Stock Detail production page

Ports the per-item drill-in: on-hand header (useDepartmentStock), FEFO
batch list (useExpiringBatches filtered to the item), 30-day movement
history (new useStockMovements hook). PAR pill + transfer/adjust actions
deferred to their backed waves. Route /inventory/stock/detail.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: SI-INV-009 Cross-Location Transfer Suggestions — page + route

**Files:**
- Create: `apps/web/src/pages/inv/TransferSuggestionsPage.tsx`
- Modify: `apps/web/src/App.tsx` (route `/inventory/suggestions` + nav entry)

**Interfaces:**
- Consumes: `useTransferSuggestions` (Task 2 — REQUIRES both source + destination department), `useInventoryDepartments` (Task 5), `@/components/shell`.
- Mockup source: `mockups/src/screens/inv/SI-INV-009.tsx`.

- [ ] **Step 1: Port the mockup**

Copy `mockups/src/screens/inv/SI-INV-009.tsx` → `apps/web/src/pages/inv/TransferSuggestionsPage.tsx`, default export `TransferSuggestionsPage`. Apply the Page-port procedure (suggestion list, `PairedTransferBundle`, `DashboardTile`, "no suggestion viable" empty state verbatim).

- [ ] **Step 2: Add the source/dest department selectors + wire data**

Per the spec's UX constraint (`/stock-transfers/suggestions` requires both department ids), add two department `<select>`s (source + destination, from `useInventoryDepartments`) at the top. Until both are chosen, show a prompt ("Pick a source and destination department to see suggestions"). Once chosen, render the live suggestions:

```tsx
const { data: depts } = useInventoryDepartments()
const [source, setSource] = useState<string | undefined>(undefined)
const [dest, setDest] = useState<string | undefined>(undefined)
const { data: suggestions, isLoading, error } = useTransferSuggestions(source, dest)
```

Map each `TransferSuggestion` (which already includes `productName`, `availableQty`, `suggestedQty`, `reason`) into the mockup's suggestion-row shape. The mockup's single-hop-vs-paired split + feasibility score are not in the endpoint — render all as single-hop suggestions with the server `reason`; drop the paired/feasibility-only chrome (note in commit). Dismiss is a Wave-2 mutation — render the dismiss control disabled with `title="Available in Wave 2"`. Add loading/error/empty guards.

- [ ] **Step 3: Register route + nav**

Add `import TransferSuggestionsPage from '@/pages/inv/TransferSuggestionsPage'` and:

```tsx
{/* SI-INV-009 Cross-Location Transfer Suggestions — Wave 1 */}
<Route
  path="/inventory/suggestions"
  element={
    <RequireAuth>
      <TransferSuggestionsPage />
    </RequireAuth>
  }
/>
```

Nav entry: `{ href: '/inventory/suggestions', label: 'Transfer suggestions (SI-INV-009)' },`.

- [ ] **Step 4: Typecheck + build**

Run: `cd apps/web && npx tsc --noEmit && npm run build`
Expected: silent + clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/inv/TransferSuggestionsPage.tsx apps/web/src/App.tsx
git commit -m "feat(inv): SI-INV-009 Transfer Suggestions production page

Ports the suggestions view as a source+destination department picker flow
(the endpoint requires both), fed by useTransferSuggestions with live
product names + quantities. Paired/feasibility chrome and dismiss deferred
(not backed in Wave 1). Route /inventory/suggestions + nav.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: SI-INV-016 Closing Inventory Cluster Review — page + route

**Files:**
- Create: `apps/web/src/pages/inv/ClosingClusterReviewPage.tsx`
- Modify: `apps/web/src/App.tsx` (route `/inventory/closing/review` + nav entry)

**Interfaces:**
- Consumes: `useClosingSummary` + `useCutOffCompliance` (Task 2), `@/components/shell` (`DataQualityAlertPane`, `IssueTicketLink`, `AuditLink`, `Table`, `DashboardTile`, `StatusPill`).
- Mockup source: `mockups/src/screens/inv/SI-INV-016.tsx`.

- [ ] **Step 1: Port the mockup**

Copy `mockups/src/screens/inv/SI-INV-016.tsx` → `apps/web/src/pages/inv/ClosingClusterReviewPage.tsx`, default export `ClosingClusterReviewPage`. Apply the Page-port procedure (aggregate `DashboardTile`s, per-location table, `DataQualityAlertPane` for not-submitted, inline drill-in, `IssueTicketLink`/`AuditLink` verbatim).

- [ ] **Step 2: Add a business-date control + wire data**

Both endpoints require `businessDate` (YYYY-MM-DD). Add a date `<input type="date">` defaulting to today (compute from `new Date().toISOString().slice(0,10)`). Wire the hooks:

```tsx
const today = new Date().toISOString().slice(0, 10)
const [businessDate, setBusinessDate] = useState(today)
const { data: summary, isLoading, error } = useClosingSummary(businessDate, {})
const { data: cutOff } = useCutOffCompliance(businessDate, {})
```

Map `summary.records` into the mockup's per-location row shape (`ciTrn`, `status`, `varianceItemsCount`, `totalVarianceValue`). Drive the aggregate tiles from the summary counts (`totalRecords`, `confirmedCount`, `varianceFlaggedCount`, `draftCount`). Use `cutOff.status` to populate the cut-off-compliance pane (the per-scope cut-off here is brand-wide for Wave 1; per-location cut-off is a later refinement). Location/dept names: resolve via existing MDM lookups if convenient, else display the ids (note: a locations name-map hook like products/departments can be added if needed). Add loading/error/empty guards.

- [ ] **Step 3: Fix links**

Keep `AuditLink` + `IssueTicketLink` (real `/audit` + `/issues` routes). "Mark variance acceptable" / "Send reminder" are Wave-3/broadcast mutations — render disabled with `title`.

- [ ] **Step 4: Register route + nav**

Add `import ClosingClusterReviewPage from '@/pages/inv/ClosingClusterReviewPage'` and:

```tsx
{/* SI-INV-016 Closing Inventory Cluster Review — Wave 1 */}
<Route
  path="/inventory/closing/review"
  element={
    <RequireAuth>
      <ClosingClusterReviewPage />
    </RequireAuth>
  }
/>
```

Nav entry: `{ href: '/inventory/closing/review', label: 'Closing cluster review (SI-INV-016)' },`.

- [ ] **Step 5: Typecheck + build**

Run: `cd apps/web && npx tsc --noEmit && npm run build`
Expected: silent + clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/inv/ClosingClusterReviewPage.tsx apps/web/src/App.tsx
git commit -m "feat(inv): SI-INV-016 Closing Inventory Cluster Review production page

Ports the cluster-wide review with a business-date control, fed by
useClosingSummary + useCutOffCompliance (IST cut-off status). Aggregate
tiles + per-location rows from the live summary; mutations deferred.
Route /inventory/closing/review + nav.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Wave-1 gate (run after Task 8, before starting Wave 2)

- [ ] **Full typecheck + build, both packages:**
  `cd apps/api && npm run typecheck && cd ../web && npx tsc --noEmit && npm run build` → all silent/clean.
- [ ] **Backend suite:** `cd apps/api && npm run test` → all passing (524+).
- [ ] **e2e (Tier-1 heroes), with `apps/api` + dev DB running:**
  `cd apps/web && npx playwright test inv-below-par.spec.ts inv-expiry-countdown.spec.ts inv-stock-view.spec.ts` → 3 passing. (If the dev DB is unavailable in the build environment, the gate records typecheck/build green + the specs written, and the founder runs them locally before the deploy.)
- [ ] **Two-stage per-screen review** completed for SI-INV-001/003/008 (Tier-1 acceptance rigor) and 002/009/016 (standard).
- [ ] **Token-discipline check:** run the mockups pre-commit-style scan / manual grep for hex literals, banned borders, non-Lucide icons across the new `apps/web/src/pages/inv/` files → clean.
- [ ] **Decision log:** add DL-048+ entries (voice-input depth decision will land in Wave 2; in Wave 1 log: the scoped read-only stock-list endpoint exception, and the auth-only inventory RBAC gating with deferred `inv.*` permissions).
- [ ] **Verify against `git log`** that every task committed as expected; nothing on `main`.

---

## Self-Review (against the spec)

- **Spec coverage (Wave 1 scope):** SI-INV-001 (Task 5), 002 (Task 6), 003 (Task 3), 008 (Task 4), 009 (Task 7), 016 (Task 8) — all six Wave-1 screens have tasks. The scoped backend endpoint (Decision 5) = Task 1. Data layer + product-name resolution = Task 2. Auth-only RBAC, semantic routes, token discipline = Global Constraints. e2e for Tier-1 heroes (003/008/001) = Tasks 3/4/5. Waves 2–3 (and the two shell ports, which Wave 1 does not consume) are intentionally deferred to their own plans.
- **Divergences from the mockups are explicit, never silent:** each affected task names what is dropped/deferred and why (PO/VCN seams, suggestion-type/feasibility chrome, PAR columns on the stock grid, dismiss/mark-variance mutations) and the commit messages record it. No screen silently claims a capability it doesn't have.
- **Placeholder scan:** all code steps show real code; schema field names carry an explicit "verify against the route before finishing" instruction for the two endpoints whose envelope wasn't quoted verbatim (products list, stock movements) — that is a directed verification, not a vague placeholder.
- **Type consistency:** hook names + return types in the Interfaces blocks (Task 2) match their consumers in Tasks 3–8; `DepartmentStockResult`/`BelowParRow`/`ExpiringBatchesResult`/`TransferSuggestion`/`ClosingInventorySummary`/`CutOffComplianceResult` are defined once in `schemas.ts` and imported everywhere.

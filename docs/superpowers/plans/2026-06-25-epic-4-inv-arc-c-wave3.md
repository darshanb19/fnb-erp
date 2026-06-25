# Epic 4 INV — Arc (c) Production Frontend — Wave 3 ("record") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the 6 Wave-3 inventory "record" pages (SI-INV-010 Goods Receipt PO-Driven, SI-INV-011 Goods Receipt Transfer-Driven, SI-INV-012 Goods Receipt Rejection at QC, SI-INV-013 Inventory Adjustment, SI-INV-014 Closing Inventory POS Daily, SI-INV-015 Closing Inventory Dispatch Daily) into `apps/web`, consuming the live Arc-(a) goods-receipt / adjustment / closing-inventory services, plus the inventory **write** data layer for those three domains.

**Architecture:** Mirror the Epic-3 INF Arc-(c) + the Wave-1/Wave-2 pattern exactly — each screen is a full-width routed page under `<RequireAuth>` (auth-only; NO `<RequirePermission>` — DL-049), fed by typed `useApiClient` + TanStack Query hooks (queries + mutations) with Zod schemas matching the REST envelopes, reusing the frozen `@/components/shell` chrome (all six Wave-3 shells — `CCVoiceInput`, `CCImplausibilityWarn`, `CCFileAttachUploader`, `CCReverseCancelDialog`, `CCDuplicateWarn` — are **already ported** into the production shell from Wave 2; this wave adds NO new shells). Port each Wave-3 mockup from `mockups/src/screens/inv/SI-INV-0XX.tsx` into `apps/web/src/pages/inv/`, swapping the mockup shell alias + fixtures for the production shell + real hooks. **No backend changes this wave** (DL-048 + DL-050 were the only two Arc-c backend exceptions; both already shipped).

**Tech Stack:** Vite + React + react-router-dom + TanStack Query v5 + Zod + Supabase Auth (frontend). TypeScript strict throughout.

**Spec:** `docs/superpowers/specs/2026-06-23-epic-4-inv-arc-c-frontend-design.md` (Wave-3 table + "cross-epic seams" + "Approvals, reversals, cross-epic seams")
**Wave-2 plan (canonical pattern to mirror):** `docs/superpowers/plans/2026-06-24-epic-4-inv-arc-c-wave2.md`
**SDD ledger:** `.superpowers/sdd/progress.md` (Wave-3 KICKOFF section)

## Global Constraints

Every task implicitly includes all of these (exact values from the spec + CLAUDE.md + Wave-1/2 hard-won lessons):

- **TypeScript strict, zero `any`.** No `any` types anywhere.
- **Token discipline.** No hex literals (DESIGN.md tokens only). Lucide-only icons (`lucide-react`). Inter-only font (no inline `font-family`). Closed 20-token `status_*` palette — inventing a status name is stop-the-line. No sectioning borders (`border`, `border-t/-b/-r/-x/-y`, `divide-y/-x`) except the allow-list: `border-l-2/-l-4/-l-8` status pips, and `focus:`/`focus-visible:`/`aria-invalid:` rings (`border-2` only when paired with `focus-visible:`). Use `<SectionShift>` for tonal breaks, never `<Separator>`.
- **Motion policy.** NO entrance animations on inventory tables/forms/dashboards. The ONLY animation in the whole Arc is `CCVoiceInput`'s listening pulse (already shipped). `animate-pulse` loading skeletons are allowed (loading affordance, not entrance).
- **`tenant_brand_accent` is decorative-only** — never a status/state colour.
- **Every org-scoped query includes `brand_id`** — enforced server-side by the branded DB; the client never sends a cross-brand filter.
- **RBAC:** inventory pages are gated with `<RequireAuth>` only — NO `<RequirePermission>` wrapper (backend enforces auth only; no `inv.*` permissions exist — DL-049).
- **Routes are semantic under `/inventory/...`** (mirroring Wave 1/2).
- **Envelope rule (CRITICAL — verified against `apps/web/src/lib/api-client.ts:160-191`):** `client.get/post({ schema })` parses the **entire** response body against `schema` — it does NOT auto-unwrap `{ data }`.
  - **goods-receipts, inventory-adjustments, closing-inventory endpoints all return `{ data: <result> }`** (some also with `meta.warnings` or `meta.approvalRequestId`) → hooks pass `envelope(<inner>)` (helper in `hooks/inv/schemas.ts`) + `.then(r => r.data)`. To surface warnings/approval ids, use the `metaEnvelope(...)` variants defined in Task 1 and read `r.meta`.
  - **Org/MDM list endpoints return the body BARE** (no `data` wrapper): `GET /products`, `/departments`, `/locations`, `/uoms`, `/clusters`, `/stores` all `res.json(await ...)`. Their hooks pass the bare schema, NO envelope. **A wrong envelope is a runtime crash tsc cannot catch.**
- **Rules of Hooks (eslint is NOT installed — not auto-caught):** place EVERY hook (`useState`/`useMemo`/`useMutation`/`use*` data hooks) ABOVE the early loading/error/guard returns in the MAIN component. A Wave-1 page crashed on this exact mistake.
- **No inert / unbacked controls.** A filter chip / button the live endpoint cannot back is a defect, not a divergence — REMOVE it (record the removal in the commit message). Deferred actions render clearly `disabled` with a `title`. Never fabricate data; absent fields render `—`. **Client-advisory acknowledgments that gate submit but are not persisted (implausibility override, variance reason on GR lines) are explicitly allowed where the spec's warn-and-log pattern requires them — they are documented per task, not inert.**
- **No Radix `Select` in `apps/web`.** The production app has **no** `@/components/ui/select` primitive. Every mockup `Select`/`SelectTrigger`/`SelectContent`/`SelectItem`/`SelectValue` import becomes a token-styled **native `<select>`** on port (Wave-1/2 precedent; `CCImplausibilityWarn`'s reason select was already converted this way in its port).
- **Verify against reality, never self-reports:** every task's verification runs the real command (`npx tsc --noEmit`, `npm run build`, `npx playwright test <file>`, `git log`) and reads its output. Sanity-check that any review file targets the right screen (a Wave-1 reviewer once reviewed the wrong screen).
- **Commit per task.** Conventional commit messages, scoped `feat(inv)` / `test(inv)`. End every commit message with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Branch:** all work on `phase-4/epic-4-inv-arc-c-frontend`. NEVER commit to `main` (auto-deploys to production). NO merge / NO deploy without explicit founder go-ahead.
- **Commands run from `apps/web/`** (this wave touches only `apps/web`).
- **AuditLink** requires a mandatory `entityType` prop (e.g. `goods_receipts` / `inventory_adjustments` / `closing_inventory`).

---

## File Structure

**Frontend data layer (extend Wave-1/2 modules + two new files):**
- Modify: `apps/web/src/lib/query-keys.ts` — add `qk.inv.goodsReceipts.*`, `qk.inv.adjustments.*`, `qk.inv.closing.list`, `qk.inv.closing.detail`, `qk.inv.productCatalog`.
- Modify: `apps/web/src/hooks/inv/schemas.ts` — add `metaEnvelope` helper + GR / adjustment / closing-detail+list / record-result schemas + `productCatalogSchema`.
- Create: `apps/web/src/hooks/inv/useGoodsReceipts.ts` — list/detail queries + `useRecordGoodsReceipt` / `useConfirmGoodsReceipt` / `useRejectGoodsReceipt`.
- Create: `apps/web/src/hooks/inv/useInventoryAdjustments.ts` — list/detail queries + `useRecordAdjustment` / `useConfirmAdjustment` / `useCancelAdjustment`.
- Modify: `apps/web/src/hooks/inv/useClosingInventory.ts` — add list/detail queries + `useRecordClosing` / `useConfirmClosing` / `useMarkVarianceOk` (today the file is READ-ONLY: only `useClosingSummary` + `useCutOffCompliance`).
- Modify: `apps/web/src/hooks/inv/useProductNames.ts` — add `useInventoryProductCatalog()` (widened product list: `{ id, name, type, defaultUomId, standardYieldFactor, sku }`) with its own query key. Leave `useInventoryProductNames` untouched.

**Frontend pages (port from mockups):**
- Create: `apps/web/src/pages/inv/InventoryAdjustmentPage.tsx` (SI-INV-013)
- Create: `apps/web/src/pages/inv/GoodsReceiptEntryPage.tsx` (SI-INV-010)
- Create: `apps/web/src/pages/inv/GoodsReceiptTransferPage.tsx` (SI-INV-011)
- Create: `apps/web/src/pages/inv/GoodsReceiptRejectPage.tsx` (SI-INV-012)
- Create: `apps/web/src/pages/inv/ClosingCountPage.tsx` (SHARED component for SI-INV-014 + SI-INV-015; takes a `context: 'pos' | 'dispatch'` prop)
- Modify: `apps/web/src/App.tsx` — register 6 routes + HomePage nav entries.

**Frontend e2e (Tier-1 heroes — SI-INV-010, 012, 014, 015):**
- Create: `apps/web/tests/e2e/inv-goods-receipt.spec.ts` (SI-INV-010)
- Create: `apps/web/tests/e2e/inv-gr-reject.spec.ts` (SI-INV-012)
- Create: `apps/web/tests/e2e/inv-closing-pos.spec.ts` (SI-INV-014)
- Create: `apps/web/tests/e2e/inv-closing-dispatch.spec.ts` (SI-INV-015)

### Page-port procedure (applies to every page task — identical to Wave 1/2)

Each page task is a **port**, not a rewrite. The mockup file is the complete visual source of truth (already token-clean and shell-based). For each page:

1. Copy the mockup's JSX structure and sub-components verbatim into the new page file.
2. **Swap the shell import** `from '@/shell'` → `from '@/components/shell'`. Swap any mockup `Select` import (`@/components/ui/select`) for a **native `<select>`** styled with token classes (no such primitive in prod).
3. **Delete the fixture imports** from `@/lib/sample-data` / `@/lib/inv-sample-data` and the fixture-derived `const … = (() => {…})()` blocks. **Keep** the reason-option constant arrays (`IMPLAUSIBILITY_REASON_OPTIONS`, `ADJUSTMENT_REASON_OPTIONS`, `CLOSING_VARIANCE_REASON_OPTIONS`, `REJECTION_REASON_OPTIONS`, `TRANSFER_REASON_OPTIONS`, `REVERSE_CANCEL_REASON_OPTIONS`) by **inlining them as local `const` arrays in the page file** — they are static option lists, not data, and the production app has no shared `inv-sample-data`. Use the exact `{ value, label }` shapes from the mockup.
4. **Replace fixtures with hook-derived data** of the same row shape (the precise mapping is given per task), including a `productId → name` join via `useInventoryProductCatalog().nameOf` where the task says so. Place ALL hooks ABOVE the loading/error guards.
5. **Swap mockup links** `to="/SI-INV-00X?…"` → the real `/inventory/...` route; `to="/SI-INF-001…"` → `/approvals/inbox`.
6. **Add loading + error + empty states** (shared JSX below; identical across pages). When a page resolves product names via `useInventoryProductCatalog`, include its `isLoading` in the loading guard so rows never flash raw UUIDs.
7. **Wire real actions** (mutations) per the task; surface mutation `isPending`/`error`; gate affordances by status; route approval-bound submits (adjustments only) to `/approvals/inbox`.
8. **Remove every unbacked control** (fixture-only demo pickers, fabricated columns, fabricated metric panels). Render genuinely deferred actions `disabled` with a `title`. Record removals in the commit message.
9. Register the route in `App.tsx` and add a HomePage nav entry (SI-INV id in the label, mirroring Wave 1/2).
10. Verify `npx tsc --noEmit` + `npm run build`; for Tier-1 pages add + run (or, if no dev DB, write) the e2e spec.
11. Commit.

**Shared loading/error JSX** (use verbatim in every page, swapping the page title; `ApiError` from `@/lib/api-client`):

```tsx
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

**Shared `locationCode` derivation** (Wave-2 precedent — `StockTransferCreatePage.tsx:324`; inline this helper in every page that records GR/adjustment/closing):

```tsx
function deriveLocationCode(dept: { code?: string | null; name: string } | undefined): string {
  return (
    ((dept?.code ?? dept?.name ?? 'INV').replace(/[^A-Za-z0-9]/g, '').slice(0, 20).toUpperCase()) || 'INV'
  )
}
```

### Wave-3 divergence ledger (consume the backend AS-IS; never fabricate)

These are the deliberate, documented gaps between the Arc-(b) mockups and the live Arc-(a) backend. Each affected task names what it drops/changes and why; the commit message records it.

- **GR has no approval seam in Arc-a.** `confirmGoodsReceipt` transitions `draft → confirmed` only (`gr_status_enum` includes `pending_approval`, but **no `/goods-receipts/:id/approve` endpoint exists** and `recordGoodsReceipt`/`confirmGoodsReceipt` never set `approvalRequestId` — `goods_receipts` has no `approval_request_id` column). So the mockups' "shelf-life exception → pending_approval → route to `/SI-INF-001`" path is **dropped** for GR: on confirm, GR pages route to the GR list / detail, never to `/approvals/inbox`. (Only **adjustments** have a real approval seam — see SI-INV-013.)
- **GR is record-then-confirm.** The mockup "Submit" maps to two backend calls in sequence: `recordGoodsReceipt` (creates the `draft` + returns `goodsReceiptId` + any `meta.warnings`), then `confirmGoodsReceipt(id, { reasonCode })`. **`reasonCode` on confirm is mandatory when the recorded GR has `warningCount > 0`** (server-enforced; FR114 warn-and-log). The page passes the single `CCImplausibilityWarn` override reason (the first overridden line's selected reason) as the confirm `reasonCode`. If recording warned but no reason was selected, the confirm 422s — surface it as the page error.
- **SI-INV-010 (PO-Driven):** there is **no PO backend** (Epic 5). The page is therefore a **manual goods-receipt entry** with an optional free-text PO reference: product lines are chosen from `useInventoryProductCatalog` (not a PO), `poId` is omitted (`null`), and **`orderedQty` is omitted → the FR114 ordered-qty (>150%) check does not fire** (cross-epic seam: "no FR114 ordered-qty unless supplied"). Drop the PO-header card's vendor/expected-date/PO-TRN fixtures; replace with a destination-department picker + an optional "PO reference" text input (sent as nothing to the backend — it has no field — so **omit the PO-ref input entirely** rather than stub it; record the removal). `yieldFactor` defaults per line to the product's `standardYieldFactor` (FR27, real, from the catalog). `usableQty` / `wastageQty` / `adjustedCostPerUnit` are computed client-side for display only (the backend recomputes authoritatively). `CCDuplicateWarn` matches are computed from the GR **list** (`useGoodsReceipts` filtered to same destination department + same business date) — not fabricated. Shelf-life PASS/EXCEPTION is computed client-side for display; it does **not** gate or route (no approval seam).
- **SI-INV-011 (Transfer-Driven):** the line set comes from a **real dispatched transfer** — pick one from `useTransferList({ status: 'in_transit' })` (fallback also offer `approved`), load its lines via `useTransferDetail`, prefill received qty from `line.fulfilledQty ?? line.requestedQty`. Submit = `recordGoodsReceipt` with `transferId` set + lines `{ productId, receivedQty, uomId, expiryDate? }`. **The variance reason is client-advisory only** (the GR line input schema has no reason field): it gates submit (forces acknowledgment when received ≠ dispatched) but is **not sent** — same warn-and-log pattern as Wave-2's transfer-create implausibility override. Document it. `CCImplausibilityWarn` (|variance| > 20% of dispatched) is likewise client-advisory; its override reason flows to the confirm `reasonCode` if `warningCount > 0`.
- **SI-INV-012 (Rejection at QC):** operates on an **existing `draft` GR**. Pick one from `useGoodsReceipts({ status: 'draft' })`; load lines via `useGoodsReceiptDetail`. Per-line rejection reasons are collected, then submit = `useRejectGoodsReceipt({ grId, reasons, evidence })` (`reasons: string[]` — one code per rejected line; `evidence` is an optional free-text note). **Drop the fabricated vendor-CN AP-reduction estimate numbers and the PO-closure preview metrics** — render the VCN section as static "Vendor credit note will be auto-drafted in Epic 5" explanatory copy with no fabricated rupee figures (the backend persists `gr_rejection_records.vcnDeferred = true` only). FR65 consumed/unconsumed split has no backing field → **drop the consumed/unconsumed columns** (render received qty + reason only). `CCFileAttachUploader` is presentation-only (no GR-attachment upload endpoint is wired in Arc-c) → render it `disabled`/read-only with a `title` explaining attachments arrive with the Epic-3 files surface, OR omit; do not fabricate an upload. Confirm with the reviewer which (default: render the section header + a disabled uploader with an explanatory title).
- **SI-INV-013 (Inventory Adjustment):** the **only** Wave-3 page with a real approval seam. `recordAdjustment` returns `status` (`draft` or `pending_approval`) + `meta.approvalRequestId` when the aggregate value impact crosses the backend threshold. The page's on-hand baseline + item set come from `useDepartmentStock(departmentId)` (Wave-1; returns `{ productId, productName, quantity, unit }`). Per line: `delta = adjustedQty − currentOnHand`; `currentOnHand` sent from the stock row; `reasonCode` mandatory (FR37). `CCImplausibilityWarn` (|delta| > 80% of on-hand) is client-advisory (the adjustment line has no plausibility-reason field) and gates submit. **Submit routing:** on `recordAdjustment` success, if `status === 'pending_approval'` (or `approvalRequestId` present) → `navigate('/approvals/inbox')`; else stay and offer **Confirm** (`useConfirmAdjustment`). `CCReverseCancelDialog`: pre-confirmed (`draft`/`pending_approval`) → `useCancelAdjustment`; post-confirmed reverse has no backend → render that dialog mode's confirm `disabled` with a `title`, or restrict the dialog to pre-confirmed only. Drop the fabricated "two-instance demo" (`ADJ_OVER_THRESHOLD` + `ADJ_IMPLAUSIBLE`) — the production page edits ONE adjustment at a time (a create form for a chosen department).
- **SI-INV-014 / 015 (Closing Inventory):** the item set + "expected" baseline come from `useDepartmentStock(departmentId)` — `expectedQty (display) = on-hand quantity` from the stock rollup. The **recipe/POS-derived "expected" is an Epic-6/9 seam stubbed to the on-hand rollup** (spec: "closing 'expected' computes from the movement ledger with those inputs stubbed to 0"); the **backend computes the authoritative `expectedQty` + `variance` server-side** from the ledger when the doc is recorded — the client `expectedQty` is display-only. Submit = `useRecordClosing` with lines `{ itemId: productId, countedQty, reasonCode?, notes? }` (`reasonCode` mandatory client-side when displayed variance ≠ 0; backend also enforces). `businessDate` = today in IST (`YYYY-MM-DD`); `locationId`/`departmentId` from the chosen department (`department.locationId`); `locationCode` via `deriveLocationCode`. Cut-off countdown reads the real cut-off via `useCutOffCompliance(businessDate, scope)` (Wave-1 read hook; returns `cutOffTime` / `status`) — **drop the fixture `SIMULATED_NOW_TIME`** and compute remaining minutes from the real `cutOffTime` against the live clock (IST). The two screens differ only in the `context` prop: POS labels the baseline "Expected (on-hand)"; Dispatch labels it "Prod received − dispatched" (display label only — same on-hand source). `015`'s seeded "implausible mutton line" demo is fixture-only → gone.

---

## Task 1: Frontend Wave-3 data layer — GR / adjustment / closing-write hooks + schemas + product catalog

**Files:**
- Modify: `apps/web/src/lib/query-keys.ts`
- Modify: `apps/web/src/hooks/inv/schemas.ts`
- Create: `apps/web/src/hooks/inv/useGoodsReceipts.ts`
- Create: `apps/web/src/hooks/inv/useInventoryAdjustments.ts`
- Modify: `apps/web/src/hooks/inv/useClosingInventory.ts`
- Modify: `apps/web/src/hooks/inv/useProductNames.ts`

**Interfaces (consumed by Tasks 2–7):**
- `useInventoryProductCatalog()` → `{ list: ProductCatalogItem[]; byId(id): ProductCatalogItem | undefined; nameOf(id): string; defaultUomOf(id): string | undefined; yieldOf(id): number; isLoading: boolean }`
- `useGoodsReceipts(filter?: { status?: GrStatus })` → `UseQueryResult<GoodsReceiptListItem[]>`
- `useGoodsReceiptDetail(id?: string)` → `UseQueryResult<GoodsReceiptDetail>`
- `useRecordGoodsReceipt()` → mutation `(input: RecordGrInput) => Promise<{ goodsReceiptId: string; grTrn: string; warnings: string[] }>`
- `useConfirmGoodsReceipt()` → mutation `({ grId, reasonCode? }) => Promise<{ status: string }>`
- `useRejectGoodsReceipt()` → mutation `({ grId, reasons, evidence? }) => Promise<{ status: string }>`
- `useInventoryAdjustments(filter?: { status?: AdjStatus })` → `UseQueryResult<AdjustmentListItem[]>`
- `useAdjustmentDetail(id?: string)` → `UseQueryResult<AdjustmentDetail>`
- `useRecordAdjustment()` → mutation `(input: RecordAdjustmentInput) => Promise<{ adjustmentId: string; adjTrn: string; status: string; approvalRequestId?: string }>`
- `useConfirmAdjustment()` → mutation `(adjustmentId: string) => Promise<{ status: string }>`
- `useCancelAdjustment()` → mutation `(adjustmentId: string) => Promise<{ status: string }>`
- `useClosingList(filter?: { status?: ClosingStatus; businessDate?: string })` → `UseQueryResult<ClosingListItem[]>`
- `useClosingDetail(id?: string)` → `UseQueryResult<ClosingDetail>`
- `useRecordClosing()` → mutation `(input: RecordClosingInput) => Promise<{ closingId: string; ciTrn: string; warnings: string[] }>`
- `useConfirmClosing()` → mutation `(closingId: string) => Promise<{ status: string }>`
- `useMarkVarianceOk()` → mutation `(closingId: string) => Promise<{ varianceAcceptable: boolean }>`

- [ ] **Step 1: Add query keys**

In `apps/web/src/lib/query-keys.ts`, extend the existing `inv` namespace. Add inside the `inv: { … }` object (keep all existing keys — do NOT collide with `inv.stock.*`, `inv.belowPar`, `inv.suggestions`, `inv.closing.summary`, `inv.closing.cutOff`, `inv.productNames`, `inv.departments`, `inv.locations`, `inv.transfers.*`, `inv.parList`, `inv.clusters`, `inv.uoms`, `inv.stores`):

```ts
    productCatalog: () => ['inv', 'productCatalog', 'minimal'] as const,
    goodsReceipts: {
      list: (filter: object) => ['inv', 'goodsReceipts', 'list', filter] as const,
      detail: (id: string) => ['inv', 'goodsReceipts', 'detail', id] as const,
    },
    adjustments: {
      list: (filter: object) => ['inv', 'adjustments', 'list', filter] as const,
      detail: (id: string) => ['inv', 'adjustments', 'detail', id] as const,
    },
```

And add to the EXISTING `closing` object (next to `summary` and `cutOff`):

```ts
      list: (filter: object) => ['inv', 'closing', 'list', filter] as const,
      detail: (id: string) => ['inv', 'closing', 'detail', id] as const,
```

> Verify the `closing` object's current shape first and append the two keys without disturbing `summary`/`cutOff`.

- [ ] **Step 2: Add the Zod schemas + `metaEnvelope` helper**

In `apps/web/src/hooks/inv/schemas.ts`, append (the `envelope` helper already exists; do NOT redefine it). Numeric DB columns serialize as strings → use `z.coerce.number()`. **Verify every field name against `apps/api/src/db/schema/inventory.ts` and the three route files before finishing** (field names below were read from the live schema/routes on 2026-06-25; re-confirm after any drift):

```ts
// ── meta-aware envelope (for endpoints that return { data, meta } and we need meta) ──
export function metaEnvelope<TData extends z.ZodTypeAny, TMeta extends z.ZodTypeAny>(
  data: TData,
  meta: TMeta,
) {
  return z.object({ data, meta: meta.optional() })
}

// ── Product catalog (BARE GET /products — full Product rows) ──
export const productCatalogItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  sku: z.string(),
  type: z.enum(['raw', 'semi_product', 'final']),
  defaultUomId: z.string().uuid(),
  standardYieldFactor: z.coerce.number(),
})
export type ProductCatalogItem = z.infer<typeof productCatalogItemSchema>
export const productCatalogListSchema = z.array(productCatalogItemSchema)

// ── Goods receipts (GET /goods-receipts, /:id; POST record/confirm/reject) ──
export const grStatusEnum = z.enum(['draft', 'confirmed', 'pending_approval', 'rejected'])
export type GrStatus = z.infer<typeof grStatusEnum>

export const goodsReceiptHeaderSchema = z.object({
  id: z.string().uuid(),
  grTrn: z.string(),
  poId: z.string().uuid().nullable(),
  transferId: z.string().uuid().nullable(),
  destinationDepartmentId: z.string().uuid(),
  status: grStatusEnum,
  receivedByUserId: z.string().uuid().nullable(),
  receivedAt: z.string().nullable(),
  warningCount: z.coerce.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type GoodsReceiptListItem = z.infer<typeof goodsReceiptHeaderSchema>
export const goodsReceiptListSchema = z.array(goodsReceiptHeaderSchema)

export const grLineSchema = z.object({
  id: z.string().uuid(),
  goodsReceiptId: z.string().uuid(),
  productId: z.string().uuid(),
  receivedQty: z.coerce.number(),
  yieldFactor: z.coerce.number(),
  usableQty: z.coerce.number(),
  wastageQty: z.coerce.number(),
  unitCost: z.coerce.number().nullable(),
  adjustedCostPerUnit: z.coerce.number().nullable(),
  expiryDate: z.string().nullable(),
  batchNumber: z.string().nullable(),
  varianceQty: z.coerce.number().nullable(),
  reasonCode: z.string().nullable(),
})
export type GrLine = z.infer<typeof grLineSchema>
export const goodsReceiptDetailSchema = goodsReceiptHeaderSchema.extend({
  lines: z.array(grLineSchema),
})
export type GoodsReceiptDetail = z.infer<typeof goodsReceiptDetailSchema>

export const recordGrResultSchema = z.object({ goodsReceiptId: z.string().uuid(), grTrn: z.string() })
export const grWarningsMetaSchema = z.object({ warnings: z.array(z.string()) })
export const grStatusResultSchema = z.object({ status: z.string() })

// ── Inventory adjustments (GET /inventory-adjustments, /:id; POST record/confirm/cancel) ──
export const adjStatusEnum = z.enum(['draft', 'pending_approval', 'confirmed', 'cancelled'])
export type AdjStatus = z.infer<typeof adjStatusEnum>

export const adjustmentHeaderSchema = z.object({
  id: z.string().uuid(),
  adjTrn: z.string(),
  departmentId: z.string().uuid(),
  status: adjStatusEnum,
  aggregateValueImpact: z.coerce.number().nullable(),
  approvalRequestId: z.string().uuid().nullable(),
  requestedByUserId: z.string().uuid().nullable(),
  requestedAt: z.string().nullable(),
  confirmedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type AdjustmentListItem = z.infer<typeof adjustmentHeaderSchema>
export const adjustmentListSchema = z.array(adjustmentHeaderSchema)

export const adjustmentLineSchema = z.object({
  id: z.string().uuid(),
  inventoryAdjustmentId: z.string().uuid(),
  productId: z.string().uuid(),
  batchId: z.string().uuid().nullable(),
  currentOnHand: z.coerce.number().nullable(),
  delta: z.coerce.number(),
  reasonCode: z.string(),
})
export type AdjustmentLine = z.infer<typeof adjustmentLineSchema>
export const adjustmentDetailSchema = adjustmentHeaderSchema.extend({
  lines: z.array(adjustmentLineSchema),
})
export type AdjustmentDetail = z.infer<typeof adjustmentDetailSchema>

export const recordAdjResultSchema = z.object({
  adjustmentId: z.string().uuid(),
  adjTrn: z.string(),
  status: z.string(),
})
export const adjApprovalMetaSchema = z.object({ approvalRequestId: z.string().uuid() })
export const adjStatusResultSchema = z.object({ status: z.string() })

// ── Closing inventory write/detail/list (existing file already has summary + cutOff READ schemas) ──
export const closingStatusEnum = z.enum(['draft', 'confirmed', 'variance_flagged'])
export type ClosingStatus = z.infer<typeof closingStatusEnum>

export const closingHeaderSchema = z.object({
  id: z.string().uuid(),
  ciTrn: z.string(),
  locationId: z.string().uuid(),
  departmentId: z.string().uuid(),
  businessDate: z.string(),
  status: closingStatusEnum,
  submissionTimestamp: z.string().nullable(),
  cutOffStatus: z.string().nullable(),
  totalVarianceValue: z.coerce.number().nullable(),
  varianceItemsCount: z.coerce.number().nullable(),
  varianceAcceptable: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type ClosingListItem = z.infer<typeof closingHeaderSchema>
export const closingListSchema = z.array(closingHeaderSchema)

export const closingLineSchema = z.object({
  id: z.string().uuid(),
  closingInventoryId: z.string().uuid(),
  productId: z.string().uuid(),
  expectedQty: z.coerce.number(),
  countedQty: z.coerce.number(),
  variance: z.coerce.number(),
  reasonCode: z.string().nullable(),
})
export type ClosingLine = z.infer<typeof closingLineSchema>
export const closingDetailSchema = closingHeaderSchema.extend({
  lines: z.array(closingLineSchema),
})
export type ClosingDetail = z.infer<typeof closingDetailSchema>

export const recordClosingResultSchema = z.object({ closingId: z.string().uuid(), ciTrn: z.string() })
export const closingWarningsMetaSchema = z.object({ warnings: z.array(z.string()) })
export const closingStatusResultSchema = z.object({ status: z.string() })
export const markVarianceOkResultSchema = z.object({ varianceAcceptable: z.boolean() })
```

> **Verify before finishing:** open `apps/api/src/routes/{goods-receipts,inventory-adjustments,closing-inventory}.ts` + `apps/api/src/db/schema/inventory.ts` and confirm: GR record returns `{ data: { goodsReceiptId, grTrn }, meta?: { warnings } }`; GR confirm/reject return `{ data: { status } }`; adjustment record returns `{ data: { adjustmentId, adjTrn, status }, meta?: { approvalRequestId } }`; adjustment confirm/cancel return `{ data: { status } }`; closing record returns `{ data: { closingId, ciTrn }, meta?: { warnings } }`; closing confirm returns `{ data: { status } }`; mark-variance-ok returns `{ data: { varianceAcceptable: true } }`. List/detail rows mirror the `goods_receipts`/`gr_lines`, `inventory_adjustments`/`adjustment_lines`, `closing_inventory`/`closing_inventory_lines` columns. `z.object` strips unknown keys by default, so listing a subset of columns is safe.

- [ ] **Step 3: Add `useInventoryProductCatalog` (widened product list)**

In `apps/web/src/hooks/inv/useProductNames.ts`, add (keep `useInventoryProductNames`/`useInventoryDepartments`/`useInventoryLocations` untouched; import the new schema/type from `./schemas`):

```ts
import { productCatalogListSchema, type ProductCatalogItem } from './schemas'

/**
 * Widened product catalog for the "record" screens (GR / adjustment / closing).
 * GET /api/v1/products returns BARE full Product rows (id, name, sku, type,
 * defaultUomId, standardYieldFactor, …). Distinct query key from
 * useInventoryProductNames so neither hook re-shapes the other's cache.
 */
export function useInventoryProductCatalog(): {
  list: ReadonlyArray<ProductCatalogItem>
  byId: (id: string) => ProductCatalogItem | undefined
  nameOf: (id: string) => string
  defaultUomOf: (id: string) => string | undefined
  yieldOf: (id: string) => number
  isLoading: boolean
} {
  const client = useApiClient()
  const { session } = useSession()
  const query = useQuery({
    queryKey: qk.inv.productCatalog(),
    queryFn: ({ signal }) =>
      client.get({ path: '/api/v1/products', schema: productCatalogListSchema, signal }),
    enabled: Boolean(session),
    staleTime: 5 * 60_000,
  })
  const list = query.data ?? []
  const map = new Map(list.map((p) => [p.id, p]))
  return {
    list,
    byId: (id) => map.get(id),
    nameOf: (id) => map.get(id)?.name ?? id,
    defaultUomOf: (id) => map.get(id)?.defaultUomId,
    yieldOf: (id) => map.get(id)?.standardYieldFactor ?? 1,
    isLoading: query.isLoading,
  }
}
```

- [ ] **Step 4: Create `useGoodsReceipts.ts`**

Create `apps/web/src/hooks/inv/useGoodsReceipts.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/use-api-client'
import { useSession } from '@/lib/auth'
import { qk } from '@/lib/query-keys'
import {
  envelope,
  metaEnvelope,
  goodsReceiptListSchema,
  goodsReceiptDetailSchema,
  recordGrResultSchema,
  grWarningsMetaSchema,
  grStatusResultSchema,
  type GoodsReceiptListItem,
  type GoodsReceiptDetail,
  type GrStatus,
} from './schemas'

export interface RecordGrLineInput {
  productId: string
  receivedQty: number
  uomId: string
  yieldFactor?: number
  unitCost?: number
  batchNumber?: string
  expiryDate?: string | null
  orderedQty?: number
}
export interface RecordGrInput {
  destinationDepartmentId: string
  locationCode: string
  poId?: string | null
  transferId?: string | null
  receivedAt?: string | null
  lines: RecordGrLineInput[]
}

export function useGoodsReceipts(filter: { status?: GrStatus } = {}) {
  const client = useApiClient()
  const { session } = useSession()
  const params = new URLSearchParams()
  if (filter.status) params.set('status', filter.status)
  const qs = params.toString()
  return useQuery<GoodsReceiptListItem[]>({
    queryKey: qk.inv.goodsReceipts.list(filter),
    queryFn: ({ signal }) =>
      client
        .get({ path: `/api/v1/goods-receipts${qs ? `?${qs}` : ''}`, schema: envelope(goodsReceiptListSchema), signal })
        .then((r) => r.data),
    enabled: Boolean(session),
  })
}

export function useGoodsReceiptDetail(id: string | undefined) {
  const client = useApiClient()
  const { session } = useSession()
  return useQuery<GoodsReceiptDetail>({
    queryKey: id ? qk.inv.goodsReceipts.detail(id) : ['inv', 'goodsReceipts', 'detail', null],
    queryFn: ({ signal }) => {
      if (!id) throw new Error('useGoodsReceiptDetail called without id')
      return client
        .get({ path: `/api/v1/goods-receipts/${id}`, schema: envelope(goodsReceiptDetailSchema), signal })
        .then((r) => r.data)
    },
    enabled: Boolean(session) && Boolean(id),
  })
}

export function useRecordGoodsReceipt() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<{ goodsReceiptId: string; grTrn: string; warnings: string[] }, Error, RecordGrInput>({
    mutationFn: (input) =>
      client
        .post({ path: '/api/v1/goods-receipts', body: input, schema: metaEnvelope(recordGrResultSchema, grWarningsMetaSchema) })
        .then((r) => ({ ...r.data, warnings: r.meta?.warnings ?? [] })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inv', 'goodsReceipts', 'list'] })
    },
  })
}

export function useConfirmGoodsReceipt() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<{ status: string }, Error, { grId: string; reasonCode?: string }>({
    mutationFn: ({ grId, reasonCode }) =>
      client
        .post({ path: `/api/v1/goods-receipts/${grId}/confirm`, body: reasonCode ? { reasonCode } : {}, schema: envelope(grStatusResultSchema) })
        .then((r) => r.data),
    onSuccess: (_res, { grId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.inv.goodsReceipts.detail(grId) })
      void queryClient.invalidateQueries({ queryKey: ['inv', 'goodsReceipts', 'list'] })
    },
  })
}

export function useRejectGoodsReceipt() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<{ status: string }, Error, { grId: string; reasons: string[]; evidence?: string | null }>({
    mutationFn: ({ grId, reasons, evidence }) =>
      client
        .post({ path: `/api/v1/goods-receipts/${grId}/reject`, body: { reasons, evidence: evidence ?? null }, schema: envelope(grStatusResultSchema) })
        .then((r) => r.data),
    onSuccess: (_res, { grId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.inv.goodsReceipts.detail(grId) })
      void queryClient.invalidateQueries({ queryKey: ['inv', 'goodsReceipts', 'list'] })
    },
  })
}
```

- [ ] **Step 5: Create `useInventoryAdjustments.ts`**

Create `apps/web/src/hooks/inv/useInventoryAdjustments.ts`:

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/use-api-client'
import { useSession } from '@/lib/auth'
import { qk } from '@/lib/query-keys'
import {
  envelope,
  metaEnvelope,
  adjustmentListSchema,
  adjustmentDetailSchema,
  recordAdjResultSchema,
  adjApprovalMetaSchema,
  adjStatusResultSchema,
  type AdjustmentListItem,
  type AdjustmentDetail,
  type AdjStatus,
} from './schemas'

export interface RecordAdjustmentLineInput {
  productId: string
  delta: number
  reasonCode: string
  currentOnHand?: number
  costPerUnit?: number
}
export interface RecordAdjustmentInput {
  departmentId: string
  locationCode: string
  notes?: string | null
  lines: RecordAdjustmentLineInput[]
}

export function useInventoryAdjustments(filter: { status?: AdjStatus } = {}) {
  const client = useApiClient()
  const { session } = useSession()
  const params = new URLSearchParams()
  if (filter.status) params.set('status', filter.status)
  const qs = params.toString()
  return useQuery<AdjustmentListItem[]>({
    queryKey: qk.inv.adjustments.list(filter),
    queryFn: ({ signal }) =>
      client
        .get({ path: `/api/v1/inventory-adjustments${qs ? `?${qs}` : ''}`, schema: envelope(adjustmentListSchema), signal })
        .then((r) => r.data),
    enabled: Boolean(session),
  })
}

export function useAdjustmentDetail(id: string | undefined) {
  const client = useApiClient()
  const { session } = useSession()
  return useQuery<AdjustmentDetail>({
    queryKey: id ? qk.inv.adjustments.detail(id) : ['inv', 'adjustments', 'detail', null],
    queryFn: ({ signal }) => {
      if (!id) throw new Error('useAdjustmentDetail called without id')
      return client
        .get({ path: `/api/v1/inventory-adjustments/${id}`, schema: envelope(adjustmentDetailSchema), signal })
        .then((r) => r.data)
    },
    enabled: Boolean(session) && Boolean(id),
  })
}

export function useRecordAdjustment() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<
    { adjustmentId: string; adjTrn: string; status: string; approvalRequestId?: string },
    Error,
    RecordAdjustmentInput
  >({
    mutationFn: (input) =>
      client
        .post({ path: '/api/v1/inventory-adjustments', body: input, schema: metaEnvelope(recordAdjResultSchema, adjApprovalMetaSchema) })
        .then((r) => ({ ...r.data, approvalRequestId: r.meta?.approvalRequestId })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inv', 'adjustments', 'list'] })
    },
  })
}

function useAdjustmentLifecycleAction(action: 'confirm' | 'cancel') {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<{ status: string }, Error, string>({
    mutationFn: (adjustmentId) =>
      client
        .post({ path: `/api/v1/inventory-adjustments/${adjustmentId}/${action}`, body: {}, schema: envelope(adjStatusResultSchema) })
        .then((r) => r.data),
    onSuccess: (_res, adjustmentId) => {
      void queryClient.invalidateQueries({ queryKey: qk.inv.adjustments.detail(adjustmentId) })
      void queryClient.invalidateQueries({ queryKey: ['inv', 'adjustments', 'list'] })
    },
  })
}
export const useConfirmAdjustment = () => useAdjustmentLifecycleAction('confirm')
export const useCancelAdjustment = () => useAdjustmentLifecycleAction('cancel')
```

- [ ] **Step 6: Extend `useClosingInventory.ts` with list/detail + write mutations**

In `apps/web/src/hooks/inv/useClosingInventory.ts`, ADD (keep the existing `useClosingSummary` + `useCutOffCompliance` exactly as they are; add the new imports to the existing import block):

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  metaEnvelope,
  closingListSchema,
  closingDetailSchema,
  recordClosingResultSchema,
  closingWarningsMetaSchema,
  closingStatusResultSchema,
  markVarianceOkResultSchema,
  type ClosingListItem,
  type ClosingDetail,
  type ClosingStatus,
} from './schemas'

export interface RecordClosingLineInput {
  itemId: string
  countedQty: number
  reasonCode?: string
  notes?: string | null
}
export interface RecordClosingInput {
  locationId: string
  departmentId: string
  businessDate: string
  locationCode: string
  notes?: string | null
  lines: RecordClosingLineInput[]
}

export function useClosingList(filter: { status?: ClosingStatus; businessDate?: string } = {}) {
  const client = useApiClient()
  const { session } = useSession()
  const params = new URLSearchParams()
  if (filter.status) params.set('status', filter.status)
  if (filter.businessDate) params.set('businessDate', filter.businessDate)
  const qs = params.toString()
  return useQuery<ClosingListItem[]>({
    queryKey: qk.inv.closing.list(filter),
    queryFn: ({ signal }) =>
      client
        .get({ path: `/api/v1/closing-inventory${qs ? `?${qs}` : ''}`, schema: envelope(closingListSchema), signal })
        .then((r) => r.data),
    enabled: Boolean(session),
  })
}

export function useClosingDetail(id: string | undefined) {
  const client = useApiClient()
  const { session } = useSession()
  return useQuery<ClosingDetail>({
    queryKey: id ? qk.inv.closing.detail(id) : ['inv', 'closing', 'detail', null],
    queryFn: ({ signal }) => {
      if (!id) throw new Error('useClosingDetail called without id')
      return client
        .get({ path: `/api/v1/closing-inventory/${id}`, schema: envelope(closingDetailSchema), signal })
        .then((r) => r.data)
    },
    enabled: Boolean(session) && Boolean(id),
  })
}

export function useRecordClosing() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<{ closingId: string; ciTrn: string; warnings: string[] }, Error, RecordClosingInput>({
    mutationFn: (input) =>
      client
        .post({ path: '/api/v1/closing-inventory', body: input, schema: metaEnvelope(recordClosingResultSchema, closingWarningsMetaSchema) })
        .then((r) => ({ ...r.data, warnings: r.meta?.warnings ?? [] })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inv', 'closing', 'list'] })
      void queryClient.invalidateQueries({ queryKey: ['inv', 'closing', 'summary'] })
    },
  })
}

export function useConfirmClosing() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<{ status: string }, Error, string>({
    mutationFn: (closingId) =>
      client
        .post({ path: `/api/v1/closing-inventory/${closingId}/confirm`, body: {}, schema: envelope(closingStatusResultSchema) })
        .then((r) => r.data),
    onSuccess: (_res, closingId) => {
      void queryClient.invalidateQueries({ queryKey: qk.inv.closing.detail(closingId) })
      void queryClient.invalidateQueries({ queryKey: ['inv', 'closing', 'list'] })
    },
  })
}

export function useMarkVarianceOk() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<{ varianceAcceptable: boolean }, Error, string>({
    mutationFn: (closingId) =>
      client
        .post({ path: `/api/v1/closing-inventory/${closingId}/mark-variance-ok`, body: {}, schema: envelope(markVarianceOkResultSchema) })
        .then((r) => r.data),
    onSuccess: (_res, closingId) => {
      void queryClient.invalidateQueries({ queryKey: qk.inv.closing.detail(closingId) })
      void queryClient.invalidateQueries({ queryKey: ['inv', 'closing', 'list'] })
    },
  })
}
```

> Ensure the existing import block already pulls `useQuery`, `useApiClient`, `useSession`, `qk`, `envelope`. Add `useMutation`/`useQueryClient` and the new schema imports. Confirm `envelope` is already imported (the read hooks use it).

- [ ] **Step 7: Typecheck + build**

Run: `cd apps/web && npx tsc --noEmit && npm run build`
Expected: tsc silent; vite build clean.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/query-keys.ts apps/web/src/hooks/inv/
git commit -m "feat(inv): Wave-3 data layer — GR/adjustment/closing write hooks + product catalog

Adds qk.inv goodsReceipts/adjustments/closing list+detail keys +
productCatalog key; schemas for GR/adjustment/closing headers, lines,
detail, list, and record/confirm/reject/cancel/mark-variance results
(+ metaEnvelope for meta.warnings / meta.approvalRequestId); new
useGoodsReceipts + useInventoryAdjustments hook modules; useClosingInventory
gains list/detail + record/confirm/mark-variance-ok writes; new
useInventoryProductCatalog (widened product list with defaultUomId +
standardYieldFactor). No UI yet. No backend changes.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: SI-INV-013 Inventory Adjustment page

**Mockup:** `mockups/src/screens/inv/SI-INV-013.tsx` (visual source of truth).
**Files:** Create `apps/web/src/pages/inv/InventoryAdjustmentPage.tsx`; modify `apps/web/src/App.tsx` (route `/inventory/adjustments/new` + nav entry).
**Interfaces consumed:** `useInventoryDepartments` (`@/hooks/inv/useProductNames`); `useDepartmentStock` (`@/hooks/inv/useStock` — Wave-1; returns `{ productId, productName, quantity, unit, lastUpdatedAt }[]`); `useRecordAdjustment`, `useConfirmAdjustment`, `useCancelAdjustment` (`@/hooks/inv/useInventoryAdjustments`); shells `CCImplausibilityWarn`, `CCReverseCancelDialog`, `DraftPill`, `StatusPill`, `AuditLink`, `SectionShift`, `Button`, `Input`, `Table`+subcomponents, `TrnDisplay`, `ApprovalInboxCard` from `@/components/shell`; `ApiError` from `@/lib/api-client`.

Follow the **Page-port procedure**. This is the first Wave-3 page — it establishes the create-form + approval-routing pattern. Production shape: a **create form for ONE adjustment** against a chosen department (drop the mockup's two-instance `ADJ_OVER_THRESHOLD` / `ADJ_IMPLAUSIBLE` demo panels).

- [ ] **Step 1: Port structure + state**

- Department picker (native `<select>` from `useInventoryDepartments().data`). Selected dept drives `useDepartmentStock(deptId)`.
- One editable line per on-hand product (`useDepartmentStock` rows): columns Item (`row.productName`), On-hand (`row.quantity` + `row.unit`), **Adjusted qty** (`<Input type="number" step="0.01" min="0">`), **Delta** (computed `adjustedQty − quantity`; coloured via `status_*` tokens for +/−/0), **Reason** (native `<select>`, options = inlined `ADJUSTMENT_REASON_OPTIONS`, mandatory — FR37).
- Per line, `CCImplausibilityWarn` when `Math.abs(delta) > 0.8 * onHand` (or, if `onHand <= 0`, when `Math.abs(delta) > 50`), reasonCodes = inlined `IMPLAUSIBILITY_REASON_OPTIONS`; the override gates submit (client-advisory; not sent — document in commit). Mirror the exact `updateLine`/reset-on-qty-change logic from `StockTransferCreatePage.tsx`.
- Aggregate value impact display: computed client-side for display only (the backend authoritatively recomputes + decides approval routing). Show an "approval may be required over the brand's threshold" note (do NOT hard-code ₹5,000 — that's a backend constant; phrase it generically).
- ALL hooks (`useState`, `useMemo`, the three data/mutation hooks) ABOVE the loading/error guards.

- [ ] **Step 2: Wire submit + approval routing**

```tsx
const { mutateAsync: recordAdjustment, isPending } = useRecordAdjustment()
// onSubmit:
const result = await recordAdjustment({
  departmentId: deptId,
  locationCode: deriveLocationCode(selectedDept),
  notes: notes || undefined,
  lines: editedLines.map((l) => ({
    productId: l.productId,
    delta: l.adjustedQty - l.onHand,
    reasonCode: l.reason,           // FR37 mandatory; submit disabled until every edited line has one
    currentOnHand: l.onHand,
  })),
})
if (result.status === 'pending_approval' || result.approvalRequestId) {
  navigate('/approvals/inbox')
} else {
  // draft created → offer Confirm via useConfirmAdjustment(result.adjustmentId)
}
```

Surface `recordAdjustment`/confirm errors via the shared error pattern + an inline `role="alert"` (backend `AdjustmentLifecycleError` / FR37 validation come back as `ApiError`).

- [ ] **Step 3: Reverse/cancel dialog**

`CCReverseCancelDialog` in `pre-confirmed` mode → `useCancelAdjustment(adjustmentId)` on confirm (only meaningful once a draft exists). The `post-confirmed` reverse path has **no backend** → render that dialog's confirm `disabled` with `title="Post-confirmation reversal arrives with the compensating-document workflow (not yet wired)"`, or restrict the dialog to `pre-confirmed`. `reasonCodeOptions` = inlined `REVERSE_CANCEL_REASON_OPTIONS`.

- [ ] **Step 4: Route + nav**

In `App.tsx`: `{ path: '/inventory/adjustments/new', element: <RequireAuth><InventoryAdjustmentPage /></RequireAuth> }`. Add HomePage nav entry `{ href: '/inventory/adjustments/new', label: 'Inventory adjustment (SI-INV-013)' }`.

- [ ] **Step 5: Verify + commit**

Run `npx tsc --noEmit && npm run build` (silent + clean). Commit `feat(inv): SI-INV-013 Inventory Adjustment production page` documenting dropped demo panels + client-advisory implausibility override + generic threshold copy.

---

## Task 3: SI-INV-010 Goods Receipt Entry — PO-Driven *(Tier 1)*

**Mockup:** `mockups/src/screens/inv/SI-INV-010.tsx`.
**Files:** Create `apps/web/src/pages/inv/GoodsReceiptEntryPage.tsx`; modify `App.tsx` (route `/inventory/goods-receipts/new` + nav).
**Interfaces consumed:** `useInventoryDepartments`, `useInventoryProductCatalog` (`@/hooks/inv/useProductNames`); `useInventoryUoms` (`@/hooks/inv/useOrgLists`); `useGoodsReceipts`, `useRecordGoodsReceipt`, `useConfirmGoodsReceipt` (`@/hooks/inv/useGoodsReceipts`); shells `CCVoiceInput`, `CCImplausibilityWarn`, `CCDuplicateWarn`, `CCFileAttachUploader`, `DraftPill`, `StatusPill`, `AuditLink`, `SectionShift`, `Button`, `Input`, `TrnDisplay`.

Apply **Tier-1 acceptance rigor**. Follow the Page-port procedure + the **SI-INV-010 divergence** in the ledger above (manual entry; no PO; `orderedQty` omitted; `poId: null`).

- [ ] **Step 1: Port structure**

- Destination-department picker (native `<select>`, `useInventoryDepartments`). **No PO header card** (no PO backend) — replace with the dept picker + a "manual receipt" eyebrow. **Omit the PO-reference text input** (the backend has no field for it; do not stub).
- Add-line UI: pick a product (native `<select>` from `useInventoryProductCatalog().list`), then per line: **Received qty** (`CCVoiceInput`, `unit` from the product's UOM code via `useInventoryUoms`), **Yield factor** (`<Input>` defaulted to `useInventoryProductCatalog().yieldOf(productId)` — FR27), Usable/Wastage/Adjusted-cost (computed display-only), Expiry date (`<Input type="date">`, optional), Batch ref (`<Input>`, optional), Unit cost (`<Input>`, optional). Each line's `uomId` defaults to `defaultUomOf(productId)`.
- `CCDuplicateWarn`: matches from `useGoodsReceipts({})` filtered to `destinationDepartmentId === deptId && createdAt(date) === today`. `onProceedAnyway` clears the warn; `onEditExisting(id)` → `navigate('/inventory/goods-receipts/' + id)` (detail view — if no detail route exists yet, link to the list). Shelf-life PASS/EXCEPTION computed for display only (no gating; no approval seam — see ledger).
- `CCImplausibilityWarn`: **only fires if `orderedQty` is supplied**, which it is not in Arc-c → effectively dormant here; keep the component import only if a line ever has an orderedQty (it won't). **Prefer removing the per-line implausibility block from this page** (no backing) and record the removal — surface FR114 instead via the confirm-time `reasonCode` path (warningCount comes from the server). Confirm the choice with the reviewer; default = remove the client-side >150% check on this page.
- ALL hooks above the guards.

- [ ] **Step 2: Wire record → confirm**

```tsx
// Submit:
const rec = await recordGoodsReceipt({
  destinationDepartmentId: deptId,
  locationCode: deriveLocationCode(selectedDept),
  poId: null,
  lines: lines.map((l) => ({
    productId: l.productId,
    receivedQty: parseFloat(l.receivedQty),
    uomId: l.uomId,                          // defaultUomOf(productId)
    yieldFactor: parseFloat(l.yieldFactor),
    unitCost: l.unitCost ? parseFloat(l.unitCost) : undefined,
    batchNumber: l.batchNumber || undefined,
    expiryDate: l.expiryDate || undefined,
  })),
})
// rec.warnings surfaced as a non-blocking banner.
await confirmGoodsReceipt({ grId: rec.goodsReceiptId, reasonCode: rec.warnings.length ? selectedWarnReason : undefined })
navigate('/inventory/goods-receipts')   // GR list — NO /approvals/inbox (no GR approval seam)
```

If `rec.warnings.length > 0` and no reason was captured, confirm 422s → surface the error and keep the user on the page to pick a reason. (If a GR list/detail route is added, route to detail; otherwise the list.)

- [ ] **Step 3: `CCFileAttachUploader`**

No GR-attachment upload endpoint is wired in Arc-c → render the uploader **read-only/disabled** with a `title` ("Delivery-document attachments arrive with the Epic-3 files surface"), or omit the section. Default: render the section header + disabled uploader. Do not fabricate uploads.

- [ ] **Step 4: Route + nav + e2e (Tier-1)**

Route `/inventory/goods-receipts/new`; nav `'Goods receipt entry (SI-INV-010)'`. Add `apps/web/tests/e2e/inv-goods-receipt.spec.ts` (Step in Task 8 covers running it).

- [ ] **Step 5: Verify + commit** — `npx tsc --noEmit && npm run build`; commit documenting the manual-entry divergence, dropped PO card/input, dropped client-side >150% check, disabled uploader.

---

## Task 4: SI-INV-011 Goods Receipt Entry — Transfer-Driven

**Mockup:** `mockups/src/screens/inv/SI-INV-011.tsx`.
**Files:** Create `apps/web/src/pages/inv/GoodsReceiptTransferPage.tsx`; modify `App.tsx` (route `/inventory/goods-receipts/transfer` + nav).
**Interfaces consumed:** `useTransferList`, `useTransferDetail` (`@/hooks/inv/useStockTransfers` — Wave-2); `useInventoryProductCatalog`, `useInventoryDepartments`; `useRecordGoodsReceipt`, `useConfirmGoodsReceipt`; shells `CCVoiceInput`, `CCImplausibilityWarn`, `CCFileAttachUploader`, `DraftPill`, `StatusPill`, `AuditLink`, `SectionShift`, `Button`, `Input`, `TrnDisplay`.

Follow the Page-port procedure + the **SI-INV-011 divergence** (line set from a real dispatched transfer; variance reason client-advisory, not sent).

- [ ] **Step 1: Port structure**

- Transfer picker (native `<select>`): `useTransferList({ status: 'in_transit' })`; if empty, also offer `approved`. Selected id → `useTransferDetail(id)`.
- Transfer header card from the detail (TRN via `TrnDisplay`, source/dest dept names via `useInventoryDepartments`, status `StatusPill`, line count). Map source/dest dept IDs → names.
- Per transfer line: dispatched qty (`line.fulfilledQty ?? line.requestedQty`, read-only), **Received qty** (`CCVoiceInput`, prefilled from dispatched), Variance (computed `received − dispatched`, read-only), **Variance reason** (native `<select>`, inlined `TRANSFER_REASON_OPTIONS`; mandatory when variance ≠ 0; **client-advisory — not sent**), `CCImplausibilityWarn` when `|variance| > 0.2 * dispatched` (client-advisory, gates submit).
- ALL hooks above guards (the `useTransferDetail` query is enabled only when an id is chosen — the pre-selection prompt mirrors Wave-1 SI-INV-009: render a "pick a transfer" prompt, not an eternal skeleton, when no id).

- [ ] **Step 2: Wire record → confirm**

```tsx
const rec = await recordGoodsReceipt({
  destinationDepartmentId: detail.destinationDepartmentId,
  locationCode: deriveLocationCode(destDept),
  transferId: detail.id,
  lines: detail.lines.map((l) => ({
    productId: l.productId,
    receivedQty: parseFloat(received[l.id]),
    uomId: defaultUomOf(l.productId)!,    // guard: skip lines whose product has no catalog UOM
    expiryDate: expiry[l.id] || undefined,
  })),
})
await confirmGoodsReceipt({ grId: rec.goodsReceiptId, reasonCode: rec.warnings.length ? selectedWarnReason : undefined })
navigate('/inventory/goods-receipts')
```

Submit disabled until every variance line has a reason AND every implausible line is overridden.

- [ ] **Step 3: `CCFileAttachUploader`** — same disabled/read-only treatment as Task 3 Step 3.

- [ ] **Step 4: Route + nav** — `/inventory/goods-receipts/transfer`; nav `'Goods receipt — transfer (SI-INV-011)'`.

- [ ] **Step 5: Verify + commit** — `npx tsc --noEmit && npm run build`; commit documenting transfer-sourced lines + variance-reason-not-sent + disabled uploader.

---

## Task 5: SI-INV-012 Goods Receipt Rejection at QC *(Tier 1)*

**Mockup:** `mockups/src/screens/inv/SI-INV-012.tsx`.
**Files:** Create `apps/web/src/pages/inv/GoodsReceiptRejectPage.tsx`; modify `App.tsx` (route `/inventory/goods-receipts/reject` + nav).
**Interfaces consumed:** `useGoodsReceipts`, `useGoodsReceiptDetail`, `useRejectGoodsReceipt`; `useInventoryProductCatalog`, `useInventoryDepartments`; shells `CCFileAttachUploader`, `DraftPill`, `StatusPill`, `AuditLink`, `SectionShift`, `Button`, `TrnDisplay`.

Apply **Tier-1 acceptance rigor**. Follow the Page-port procedure + the **SI-INV-012 divergence** (operate on a real `draft` GR; drop fabricated VCN rupee figures + PO-closure metrics + FR65 consumed/unconsumed columns).

- [ ] **Step 1: Port structure**

- Draft-GR picker (native `<select>`): `useGoodsReceipts({ status: 'draft' })`. Selected id → `useGoodsReceiptDetail(id)` (pre-selection prompt when none chosen — not an eternal skeleton).
- Source GR header from detail (GR TRN via `TrnDisplay`, destination dept name, received-at, status). No vendor/PO/GSTIN (no PO backend) — render only what the GR row carries; absent fields render `—`.
- Per GR line: item name (`useInventoryProductCatalog().nameOf(productId)`), received qty (`line.receivedQty`), **Rejection reason** (native `<select>`, inlined `REJECTION_REASON_OPTIONS` = `shelf_life` / `quality` / `quantity_mismatch` / `damage`; required per line that is being rejected). A per-line reason pip uses `status_*` tokens. **No consumed/unconsumed columns** (no backing).
- QC evidence: optional free-text note (sent as the `evidence` arg). `CCFileAttachUploader` disabled/read-only with explanatory `title` (no upload endpoint) — same as Tasks 3/4.
- VCN preview: **static explanatory copy only** — "A vendor credit note will be auto-drafted in Epic 5 (`vcnDeferred`)." **No fabricated AP-reduction rupee figure, no PO-closure metric.**
- ALL hooks above guards.

- [ ] **Step 2: Wire reject**

```tsx
const { mutateAsync: rejectGr, isPending } = useRejectGoodsReceipt()
// Confirm Rejection (enabled when every line being rejected has a reason):
await rejectGr({
  grId: detail.id,
  reasons: lineReasons.filter(Boolean),   // one code per rejected line
  evidence: evidenceNote || undefined,
})
// show "rejected" banner; backend rejects only draft GRs (GoodsReceiptLifecycleError 422 otherwise → surface).
```

- [ ] **Step 3: Route + nav + e2e (Tier-1)** — `/inventory/goods-receipts/reject`; nav `'Goods receipt rejection (SI-INV-012)'`. Add `apps/web/tests/e2e/inv-gr-reject.spec.ts` (run in Task 8).

- [ ] **Step 4: Verify + commit** — `npx tsc --noEmit && npm run build`; commit documenting real-draft-GR sourcing, dropped VCN figures/PO-closure/consumed-split, disabled uploader.

---

## Task 6: SI-INV-014 Closing Inventory Entry — POS Daily *(Tier 1)* + shared `ClosingCountPage`

**Mockup:** `mockups/src/screens/inv/SI-INV-014.tsx`.
**Files:** Create `apps/web/src/pages/inv/ClosingCountPage.tsx` (shared, `context: 'pos' | 'dispatch'` prop); modify `App.tsx` (route `/inventory/closing/pos` rendering `<ClosingCountPage context="pos" />` + nav).
**Interfaces consumed:** `useInventoryDepartments`; `useDepartmentStock` (`@/hooks/inv/useStock`); `useCutOffCompliance` (`@/hooks/inv/useClosingInventory` — Wave-1 read); `useRecordClosing`, `useConfirmClosing` (`@/hooks/inv/useClosingInventory`); shells `CCVoiceInput`, `CCImplausibilityWarn`, `DashboardTile`, `DraftPill`, `StatusPill`, `AuditLink`, `SectionShift`, `Button`, `Table`+subcomponents, `TrnDisplay`.

Apply **Tier-1 acceptance rigor**. Follow the Page-port procedure + the **SI-INV-014/015 divergence** (item set + expected baseline from `useDepartmentStock`; real cut-off via `useCutOffCompliance`; drop fixture `SIMULATED_NOW_TIME`).

- [ ] **Step 1: Build the shared `ClosingCountPage({ context })`**

- Props: `context: 'pos' | 'dispatch'`. The ONLY behavioural difference is the baseline column label: `context === 'pos'` → "Expected (on-hand)"; `'dispatch'` → "Prod received − dispatched". Both read the on-hand quantity from `useDepartmentStock` (the recipe/POS-specific expected is an Epic-6/9 seam; the backend computes the authoritative `expectedQty`+`variance` on record).
- Session context header: department picker (native `<select>`, `useInventoryDepartments`); `businessDate` = today IST `YYYY-MM-DD` (compute once, in a `useMemo`/module helper using `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })`); selected dept's `locationId` + `deriveLocationCode`.
- Cut-off countdown: `useCutOffCompliance(businessDate, { locationId, departmentId })` → `result.cutOffTime` (`'HH:MM'` or null) + `result.status`. Compute remaining minutes from `cutOffTime` against the live IST clock; render the warning banner (`warning` token ≤ 60 min, `error` token past cut-off). If `cutOffTime` is null (`no_cutoff_configured`) → render "No cut-off configured" (no banner). **No `SIMULATED_NOW_TIME`.**
- Aggregate `DashboardTile`s: Items to count (stock rows), Completed (counted entered), Variance items (|counted − expected| > 0), Reason missing (variance lines without a reason).
- Per item (responsive table/cards): Expected baseline (on-hand, read-only), **Counted qty** (`CCVoiceInput`), Variance (computed display), UOM (`row.unit`), **Reason** (native `<select>`, inlined `CLOSING_VARIANCE_REASON_OPTIONS`; mandatory when variance ≠ 0), `CCImplausibilityWarn` when `counted > 1.5 * expected` (client-advisory, gates submit).
- ALL hooks above guards.

- [ ] **Step 2: Wire record (+ confirm)**

```tsx
const rec = await recordClosing({
  locationId: selectedDept.locationId,
  departmentId: deptId,
  businessDate: todayIST,
  locationCode: deriveLocationCode(selectedDept),
  lines: countedRows.map((r) => ({
    itemId: r.productId,
    countedQty: parseFloat(r.counted),
    reasonCode: r.variance !== 0 ? r.reason : undefined,   // mandatory client-side when variance ≠ 0
  })),
})
// rec.warnings → non-blocking banner. Then confirm to write variance movements:
await confirmClosing(rec.closingId)   // backend sets status confirmed | variance_flagged
```

Surface record/confirm `ApiError`s inline. Submit disabled until every variance line has a reason AND every implausible line is overridden.

- [ ] **Step 3: Route + nav + e2e (Tier-1)** — `{ path: '/inventory/closing/pos', element: <RequireAuth><ClosingCountPage context="pos" /></RequireAuth> }`; nav `'Closing inventory — POS (SI-INV-014)'`. Add `apps/web/tests/e2e/inv-closing-pos.spec.ts` (run in Task 8).

- [ ] **Step 4: Verify + commit** — `npx tsc --noEmit && npm run build`; commit `feat(inv): SI-INV-014 Closing Inventory POS + shared ClosingCountPage` documenting on-hand-baseline divergence + real cut-off + dropped SIMULATED_NOW_TIME.

---

## Task 7: SI-INV-015 Closing Inventory Entry — Dispatch Daily *(Tier 1)*

**Mockup:** `mockups/src/screens/inv/SI-INV-015.tsx`.
**Files:** Modify `App.tsx` only (route `/inventory/closing/dispatch` rendering `<ClosingCountPage context="dispatch" />` + nav). **Reuses the shared `ClosingCountPage` from Task 6** — no new page component unless a dispatch-specific element in the mockup demands it.

Apply **Tier-1 acceptance rigor**.

- [ ] **Step 1: Diff the mockups**

Compare `SI-INV-015.tsx` against `SI-INV-014.tsx`. Per the Explore findings the only real differences are the baseline label ("Prod received − dispatched") + the department role ("Dispatch") + the fixture cut-off time + the fixture implausible demo line — all of which the `context="dispatch"` prop + real data already cover. If the diff reveals a genuinely dispatch-only UI element with a real backend field, add it to `ClosingCountPage` behind the `context` switch (keep it DRY); if it's fixture-only, it does not port.

- [ ] **Step 2: Route + nav + e2e (Tier-1)** — `{ path: '/inventory/closing/dispatch', element: <RequireAuth><ClosingCountPage context="dispatch" /></RequireAuth> }`; nav `'Closing inventory — Dispatch (SI-INV-015)'`. Add `apps/web/tests/e2e/inv-closing-dispatch.spec.ts`.

- [ ] **Step 3: Verify + commit** — `npx tsc --noEmit && npm run build`; commit `feat(inv): SI-INV-015 Closing Inventory Dispatch (shared ClosingCountPage, dispatch context)` documenting that 015 reuses the shared page (DRY) with only the context-label difference.

---

## Task 8: Wave-3 gate — Tier-1 e2e specs + whole-wave verification + final review

**Files:** the four e2e specs created in Tasks 3/5/6/7.

The Tier-1 e2e specs mirror the existing MDM/Wave-1 spec pattern (`apps/web/tests/e2e/*.spec.ts`): pre-authenticated bootstrap session, `getByRole`/`getByLabel`/`getByText`, explicit timeouts, NO CSS selectors. **Resilient to empty data** — assert the page `<h1>` is visible and there are **zero** `role="alert"` elements on initial load (the heading renders even with no stock/transfers/GRs). Do NOT assert on seeded rows (the dev DB may be empty).

- [ ] **Step 1: Write the four specs** (`inv-goods-receipt`, `inv-gr-reject`, `inv-closing-pos`, `inv-closing-dispatch`) — each navigates to its route, waits for the `<h1>`, asserts no `role="alert"`, and (where a picker exists) asserts the picker is present. Model them on the Wave-1/Wave-2 inv specs.

- [ ] **Step 2: Run the e2e specs IF a dev DB + `apps/api` are available**

Run: `cd apps/web && npx playwright test inv-goods-receipt inv-gr-reject inv-closing-pos inv-closing-dispatch`
If no dev DB is available (Arc-c precedent — Wave-1/2 e2e were written-not-run), record that the specs are written and hand them to the founder to run before deploy. Do NOT claim a pass you did not observe.

- [ ] **Step 3: Whole-wave gate**

Run from `apps/web/`: `npx tsc --noEmit` (silent) + `npm run build` (clean). Run a token-discipline scan over the 5 new page files + the new hook files (no hex literals, no banned `border`/`border-t/-b/-r/-x/-y`/`divide-*` outside the allow-list, no Material/`material-symbols`, no inline `font-family` ≠ Inter, Lucide-only imports). Confirm every page places hooks above guards (manual Rules-of-Hooks check — eslint is not installed).

- [ ] **Step 4: Final whole-branch review (Opus subagent)**

Dispatch a fresh review subagent over the Wave-3 diff (the data-layer commit through Task 7) checking the six Wave-3 risk classes: (1) **envelope correctness** — every GR/adjustment/closing hook uses `envelope`/`metaEnvelope` + `.then(r=>r.data)`; product catalog is BARE; (2) **Rules of Hooks** — all hooks above early returns; (3) **no inert/unbacked UI** — dropped PO card, VCN figures, consumed/unconsumed, fixture demos; client-advisory acknowledgments documented; (4) **token discipline**; (5) **qk.inv key hygiene** — no collisions, distinct from Wave-1/2 keys; (6) **approval routing honesty** — only adjustments route to `/approvals/inbox`; GR/closing never do. Verify the review file targets the right screens. Address Critical/Important before close; log Minors to defer.

- [ ] **Step 5: Close-out**

Append the Wave-3 status block to `.superpowers/sdd/progress.md` (per-task commit ranges + review verdicts, verified independently). Append new micro-decisions from **DL-052** onward (e.g. GR-no-approval-seam, closing-expected-from-on-hand, shared-ClosingCountPage, GR-disabled-uploader) to `decision-log.md`. **Do NOT** run the Epic-4 chrome-freeze gate or update `CLAUDE.md ## Current phase` here — those happen at **Epic-4 CLOSE** (after this wave, as a separate close-out step). **NOT merged to `main` / NOT deployed** — held for the founder's explicit go-ahead.

---

## Self-Review (run against the spec before execution)

- **Spec coverage:** all 6 Wave-3 screens (010/011/012/013/014/015) → Tasks 3/4/5/2/6/7; the three write-hook modules → Task 1; Tier-1 e2e for 010/012/014/015 → Tasks 3/5/6/7 + run in Task 8. ✅
- **Cross-epic seams rendered as stubs, never live:** PO (010 manual), VCN (012 static copy), recipe/POS expected (014/015 on-hand baseline), GR approval (dropped). ✅
- **Envelope correctness:** GR/adjustment/closing `{ data }` enveloped (+ `metaEnvelope` for warnings/approval id); product catalog BARE. ✅
- **No backend changes:** confirmed — Task 1 is frontend-only; no new routes/migrations. ✅
- **Type consistency:** schema type names (`GoodsReceiptDetail`, `AdjustmentDetail`, `ClosingDetail`, `ProductCatalogItem`, `RecordGrInput`, `RecordAdjustmentInput`, `RecordClosingInput`) are defined in Task 1 and consumed verbatim in Tasks 2–7. ✅
- **No placeholders:** data-layer code is complete; page tasks are ports with explicit hook→row mappings + divergence ledger (the mockup is the visual source of truth, per the Wave-1/2 port methodology). ✅

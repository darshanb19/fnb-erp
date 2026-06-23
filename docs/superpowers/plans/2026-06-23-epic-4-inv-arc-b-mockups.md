# Epic 4 INV Arc (b) Mockups — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build just-in-time mockups for the 14 still-deferred Epic 4 SI-INV screens plus two reusable pattern shells (`CC-IMPLAUSIBILITY-WARN`, `CC-VOICE-INPUT`), all consuming the real Arc (a) backend data shapes and the frozen `@/shell` chrome.

**Architecture:** Static React+TS mockups under `mockups/` (Vite SPA, react-router). Each screen is a default-exported component registered in `App.tsx` + `screen-catalog.ts`, rendering deterministic fixtures. Two new shell components join `@/shell`. New Epic-4-depth fixtures live in a focused new module `mockups/src/lib/inv-sample-data.ts` that reuses base entities from `sample-data.ts` (which is already 1549 lines — do not bloat or mutate it). No backend, no production frontend, no tests beyond typecheck/build/render.

**Tech Stack:** React 18, TypeScript (strict), Vite, react-router-dom, Tailwind (token-mapped), Lucide icons, Radix/shadcn primitives wrapped in `@/shell` + `@/components/ui`.

## Global Constraints

Copied verbatim from the spec + CLAUDE.md "Design token enforcement". Every task implicitly includes these:

- **No hex literals.** All colours via DESIGN.md tokens / Tailwind token classes (`text-on-surface`, `bg-surface-container`, `text-warning`, `border-warning`, etc.). Sole exception `mockups/src/tokens.ts` — not touched here.
- **Lucide React icons only** (`from 'lucide-react'`). No Material Symbols/Icons.
- **Inter font only.** No inline `font-family` other than `Inter`.
- **Closed status palette — the canonical 20 `status_*` tokens only.** Needed set already exists: `status_draft`, `status_pending_approval`, `status_confirmed`, `status_in_progress` (transfer "In Transit"), `status_completed` (transfer "Received" / closing "Submitted"), `status_cancelled`, `status_returned`, `status_gr_rejected`, `status_variance_flagged`, `status_provisional`, `status_inactive`, `status_overridden`. **Do NOT invent a new `status_*` name — that is a stop-the-line.** Implausibility / cut-off / expiry use the *semantic* tokens `warning` / `error` / `tertiary` / `error_container` (all wired into Tailwind — verified) and the §6.1 left-pip pattern.
- **No sectioning borders.** Banned: `border`, `border-t/b/r/x/y`, `divide-x/y`. Allowed: `border-l-2/4/8` (status pip, may carry a colour e.g. `border-l-4 border-warning`), and `focus-visible:` / `aria-invalid:` border+ring utilities. Use `<SectionShift>` for tonal section breaks (never `<Separator>` for sectioning).
- **Animation policy — NO entrance animations** on inventory/transaction screens (no animated tables, forms, dashboards). The ONLY motion permitted in this build is the `CCVoiceInput` listening-indicator pulse: `animate-pulse motion-reduce:animate-none`, on the indicator dot only, never on a surrounding surface. Honour `prefers-reduced-motion`.
- **`tenant_brand_accent` is decorative-only** — never a status/state colour.
- **Match the established chrome exactly.** `mockups/src/screens/inv/SI-INV-001.tsx` is the canonical idiom (page header eyebrow + `<h1>`, `DashboardTile` counter grid, `FilterChipPicker` strip, mobile-card-stack ⁄ desktop-`<Table>` split, `ExpiryPip`, `SectionShift` + footer with `SI-INV-0NN · Tier · Phase` line). Reuse its patterns; do not invent new chrome.
- **Determinism.** No `Date.now()` / `Math.random()` / argless `new Date()` in fixtures or render-affecting code — derive all dates from `NOW = '2026-05-06'` (exported by `sample-data.ts`). Fixtures must be stable across renders.

**Verification commands** (run from `mockups/`):
- Typecheck: `npx tsc --noEmit -p tsconfig.json` → exit 0, no output. (There is no `typecheck` npm script; baseline is currently green.)
- Build: `npm run build` → exits 0.
- The pre-commit token hook at `mockups/.git-hooks/pre-commit` runs on `git commit` and is the safety net; first-pass output must already comply so it never fires.

**Branch:** Work on the current branch `phase-4/epic-4-inv-arc-a-backend`. Commit per task. Do NOT merge PR #25.

**Verification discipline:** When executed via subagents, confirm each task's real output (read the created file, run typecheck, check `git status`) — do not trust subagent self-reports of completion.

---

## File Structure

**Created:**
- `mockups/src/lib/inv-sample-data.ts` — Epic-4-depth fixtures (batches, movements, transfers, bundles, suggestions, adjustments, closing lines, cut-off, PAR). Reuses base entities from `sample-data.ts`.
- `mockups/src/shell/CCImplausibilityWarn.tsx` — `CC-IMPLAUSIBILITY-WARN` shell.
- `mockups/src/shell/CCVoiceInput.tsx` — `CC-VOICE-INPUT` shell.
- `mockups/src/screens/inv/SI-INV-002.tsx` … `SI-INV-006.tsx`, `SI-INV-008.tsx` … `SI-INV-016.tsx` (14 files; 001 + 007 already exist).

**Modified:**
- `mockups/src/shell/index.ts` — add two named exports.
- `mockups/src/dev/ComponentsIndex.tsx` — add gallery entries for the two new shells.
- `mockups/src/App.tsx` — add 14 imports + 14 `<Route>`s.
- `mockups/src/lib/screen-catalog.ts` — add 16 ids to `BUILT_IDS` (the 14 built here + `SI-INV-001`/`SI-INV-007` already-present-but-unflagged); add `SI-INV-015` to `TIER_1_IDS` (deferred Tier-1 acceptance, matching the existing SI-USR/SI-INF deferred-Tier-1 pattern in that file).
- `decision-log.md` — append DL-047.
- `CLAUDE.md` — update `## Current phase` to mark Arc (b) complete.

**Reused as-is (do NOT modify):** every existing `@/shell` component (`DraftPill`, `AuditLink`, `TrnDisplay`, `LifecycleStepper`, `ApprovalInboxCard`, `PairedTransferBundle`, `CCReverseCancelDialog`, `CCFileAttachUploader`, `CCDuplicateWarn`, `DashboardTile`, `StatusPill`, `ProvisionalFlag`, `DataQualityAlertPane`, `IssueTicketLink`, `SectionShift`, `Card`, `Table`, `Input`, `Button`, `Popover`, `Select`), `sample-data.ts`, `tokens.ts`.

**Note on screen-task granularity:** the two shells (Tasks 1–2) and fixtures (Task 0) are reusable infrastructure with precise contracts — full code is given. The 14 screens are creative visual mockups (200–400 lines of JSX each); inlining literal JSX for all 14 would be impractical and lower-quality than letting the implementer author idiomatic JSX. Each screen task therefore gives a **complete build contract** — exact fixtures, shells, props, sections, status mapping, device class, registration — and points to `SI-INV-001.tsx` as the literal idiom to match. This is the correct granularity for subagent-driven mockup authoring.

---

## Task 0: Epic-4 fixtures module (`inv-sample-data.ts`)

**Files:**
- Create: `mockups/src/lib/inv-sample-data.ts`

**Interfaces:**
- Consumes (import from `@/lib/sample-data`): `NOW`, `materials`, `departments`, `locations`, `clusters`, `formatINR`, and types `Material`, `Department`, `Location`, `Uom`.
- Produces (named exports later tasks rely on):
  - `StockBatch` + `stockBatches: ReadonlyArray<StockBatch>` — `{ id, materialId, departmentId, batchNumber, quantityRemaining, expiryDate: string|null, receivedDate, yieldFactor, costPerUnit, uom: Uom, sourceType: 'goods_receipt'|'transfer'|'adjustment'|'opening', sourceRef: string|null, provisional: boolean, expiryBand: '24h'|'48h'|'72h'|'fresh' }`.
  - `StockMovement` + `stockMovements: ReadonlyArray<StockMovement>` — `{ id, materialId, departmentId, batchId: string|null, movementType: 'receipt'|'consumption'|'transfer_in'|'transfer_out'|'adjustment'|'closing_variance', quantityDelta: number, uom: Uom, sourceRef: string, trn: string, occurredOn: string, varianceFlagged: boolean }`.
  - `TransferStatus = 'draft'|'pending_approval'|'approved'|'in_transit'|'received'|'cancelled'`; `TransferLine` `{ materialId, requestedQty, fulfilledQty: number|null, sourceBatchId, uom: Uom, reasonCode: string|null }`; `Transfer` + `transfers: ReadonlyArray<Transfer>` `{ id, stTrn, sourceDepartmentId, destinationDepartmentId, status: TransferStatus, reasonCode: string|null, bundleLegId: string|null, requestedBy, requestedAt, approvalRequestId: string|null, lines: ReadonlyArray<TransferLine> }` — include **one transfer per lifecycle status** for SI-INV-006.
  - `TransferBundle` + `transferBundles` and `BundleLeg` + `bundleLegs` mirroring Arc (a) `transfer_bundles`/`transfer_bundle_legs` (leg 1 = source→brand store, leg 2 = brand store→dest). `{ id, bundleRef, originatingClusterId, destinationClusterId, status: 'draft'|'pending_approval'|'approved'|'rejected', legs }`; leg `{ id, legNo: 1|2, fromStoreId, toStoreId, status: 'pending'|'in_transit'|'received'|'cancelled' }`.
  - `TransferSuggestion` + `transferSuggestions: ReadonlyArray<TransferSuggestion>` — `{ id, batchId, materialId, sourceLocationId, hoursToExpiry: number, valueAtRisk: number, suggestionType: 'single_hop'|'paired', destinationLabel: string, expectedConsumption: number, feasibilityScore: number, dismissed: boolean }`.
  - `AdjustmentStatus = 'draft'|'pending_approval'|'confirmed'|'cancelled'`; `AdjustmentReasonCode = 'physical_recount'|'damage'|'spoilage'|'theft'|'system_correction'|'wastage'`; `AdjustmentLine` `{ materialId, batchId, currentOnHand, delta, uom: Uom, reasonCode: AdjustmentReasonCode }`; `Adjustment` + `inventoryAdjustments` `{ id, adjTrn, departmentId, status, aggregateValueImpact, requestedBy, requestedAt, approvalRequestId: string|null, lines }` — include one over-threshold (approval-routed) and one with an FR114-tripping delta.
  - `CutOffStatus = 'on_time'|'late'|'not_submitted'`; `ClosingStatus = 'draft'|'confirmed'|'variance_flagged'`; `ClosingLine` `{ materialId, expectedQty, countedQty, variance, uom: Uom, reasonCode: string|null }`; `ClosingInventory` + `closingInventory` `{ id, ciTrn, locationId, departmentId, businessDate, status: ClosingStatus, submissionTimestamp: string|null, cutOffStatus: CutOffStatus, totalVarianceValue, varianceItemsCount, varianceAcceptable: boolean, deptType: 'pos'|'dispatch', lines }` — include a POS context (for 014), a Dispatch context (for 015), a cluster spread for 016 incl. one `cutOffStatus: 'not_submitted'` row, and one line whose `countedQty` trips FR114.
  - `CutOffRegistryEntry` + `cutOffRegistry` `{ locationId, departmentId: string|null, cutOffTime: string }` (HH:MM).
  - `ParLevel` + `parLevels` `{ id, materialId, locationId: string|null, departmentId: string|null, basePar, dayOfWeekOverrides: { mon?:number; tue?:number; wed?:number; thu?:number; fri?:number; sat?:number; sun?:number }|null, lastModifiedBy, lastModifiedAt }`; plus a derived helper `belowParRows: ReadonlyArray<{ materialId, departmentId, onHand, basePar, adjustedPar, shortfall, suggestedReorder, urgency: 'approaching'|'below'|'critical', onOpenPo: boolean }>` computed from `parLevels` + `inventoryPositions`.
  - Closing-reason and GR/transfer reason-code option lists for the pickers: `ADJUSTMENT_REASON_OPTIONS`, `CLOSING_VARIANCE_REASON_OPTIONS`, `IMPLAUSIBILITY_REASON_OPTIONS`, `TRANSFER_REASON_OPTIONS` (each `ReadonlyArray<{ value: string; label: string }>`).

- [ ] **Step 1: Author the module.** Create `inv-sample-data.ts`. Import base entities from `@/lib/sample-data`. Define the types and `const` fixtures above. Build fixtures deterministically (index-based math seeded off array position, no RNG); derive all dates from `NOW` via a local `daysFromNow(n: number): string` / `hoursFromNow` helper (return `YYYY-MM-DD` or ISO). Scope batches/transfers/adjustments to CK Bandra departments (`loc-ck-bandra`) so they align with SI-INV-001's scope, plus a second cluster store for the paired-bundle/suggestion fixtures. Assign `expiryBand` using the same band thresholds as SI-INV-001 (`24h`/`48h`/`72h`/`fresh`). Add a JSDoc header citing Arc (a) design §3 as the field-shape source.
- [ ] **Step 2: Typecheck.** Run `npx tsc --noEmit -p tsconfig.json`. Expected: exit 0.
- [ ] **Step 3: Commit.**

```bash
git add mockups/src/lib/inv-sample-data.ts
git commit -m "feat(inv-mock): Epic 4 fixtures module — batches/transfers/bundles/suggestions/adjustments/closing/PAR (Arc b W0)"
```

---

## Task 1: `CCImplausibilityWarn` shell (`CC-IMPLAUSIBILITY-WARN`, FR114)

**Files:**
- Create: `mockups/src/shell/CCImplausibilityWarn.tsx`

**Interfaces:**
- Consumes: `cn` from `@/lib/utils`; `Button` from `./Button`; `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` from `@/components/ui/select`; `AlertTriangle, Check` from `lucide-react`.
- Produces: `ImplausibilityReasonCode` `{ value: string; label: string }`; `CCImplausibilityWarnProps` `{ message: string; reasonCodes: ReadonlyArray<ImplausibilityReasonCode>; selectedReason: string | null; onSelectReason: (value: string) => void; onOverride: () => void; overridden: boolean; className?: string }`; `export function CCImplausibilityWarn(props): JSX.Element | null`.

- [ ] **Step 1: Author the shell.** Mirror `CCDuplicateWarn.tsx`'s structure (read it first). Warn-and-log, **never disables a submit**. Layout:
  - When `overridden` is `true`: render a single muted chip row — `AlertTriangle` (size 14, `text-on-surface-variant`) + `"Overridden · " + selectedReasonLabel` in `text-xs text-on-surface-variant`, container `bg-surface-container-low rounded-sm px-3 py-2`.
  - Otherwise: a panel `flex` with a left pip `border-l-4 border-warning`, body `bg-surface-container rounded-sm p-3`. Top row: `AlertTriangle` (`text-warning`, 16) + `message` in `text-sm text-on-surface`. Then a labelled `Select` ("Reason · required", `aria-label="Implausibility override reason"`) populated from `reasonCodes`, value `selectedReason ?? undefined`, `onValueChange={onSelectReason}`. Then `<Button variant="tonal" size="sm" disabled={!selectedReason} onClick={onOverride}>` with `Check` icon + "Override & continue".
  - JSDoc header citing `CC-IMPLAUSIBILITY-WARN`, FR114, DL-047, sibling `CCDuplicateWarn` (DL-026), and the warn-and-log philosophy. Note the `warning` token + `AlertTriangle` choice (vs DuplicateWarn's `AlertCircle`) so reviewers see the call here.
- [ ] **Step 2: Typecheck.** `npx tsc --noEmit -p tsconfig.json` → exit 0.
- [ ] **Step 3: Commit.**

```bash
git add mockups/src/shell/CCImplausibilityWarn.tsx
git commit -m "feat(shell): CCImplausibilityWarn — CC-IMPLAUSIBILITY-WARN inline warn-and-log (FR114, DL-047)"
```

---

## Task 2: `CCVoiceInput` shell (`CC-VOICE-INPUT`, FR112)

**Files:**
- Create: `mockups/src/shell/CCVoiceInput.tsx`

**Interfaces:**
- Consumes: `useState` from `react`; `cn` from `@/lib/utils`; `Input` from `./Input`; `Button` from `./Button`; `Mic, Check, X` from `lucide-react`.
- Produces: `CCVoiceInputProps` `{ value: string; onChange: (next: string) => void; unit?: string; placeholder?: string; 'aria-label': string; disabled?: boolean; simulatedHeardValue?: string; className?: string }`; `export function CCVoiceInput(props): JSX.Element`.

- [ ] **Step 1: Author the shell.** Quantity-field wrapper, scoped to quantity entry only:
  - Internal `const [listening, setListening] = useState(false)`.
  - **Idle:** a relative wrapper containing `<Input inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} aria-label={ariaLabel} disabled={disabled} className="pr-20" />`, a trailing `unit` label (absolute, `text-xs text-on-surface-variant`, right-offset to clear the mic), and a `Mic` icon `<Button variant="ghost" size="sm">` (absolute right, min 44×44, `aria-label="Enter quantity by voice"`, `onClick={() => setListening(true)}`, `disabled`).
  - **Listening:** when `listening`, render below the field an inline strip (NOT a modal) `bg-surface-container-low rounded-sm px-3 py-2 flex items-center gap-2`: three pulsing dots (`<span className="h-1.5 w-1.5 rounded-pill bg-primary animate-pulse motion-reduce:animate-none" />` ×3), `"Listening…"`, the heard value `simulatedHeardValue ?? value`, then accept `<Button size="sm" variant="tonal">` (`Check`, `aria-label="Use heard value"`, onClick → `onChange(simulatedHeardValue ?? value); setListening(false)`) and cancel `<Button size="sm" variant="ghost">` (`X`, onClick → `setListening(false)`). Wrap the strip in `role="status" aria-live="polite"`.
  - JSDoc header citing `CC-VOICE-INPUT`, FR112, DL-047; the quantity-field-only scope; and the motion note (pulse = reduced-motion-guarded interaction feedback on a control, not an entrance animation — DESIGN.md §10.3/§10.5).
- [ ] **Step 2: Typecheck.** `npx tsc --noEmit -p tsconfig.json` → exit 0.
- [ ] **Step 3: Commit.**

```bash
git add mockups/src/shell/CCVoiceInput.tsx
git commit -m "feat(shell): CCVoiceInput — CC-VOICE-INPUT quantity-field mic affordance (FR112, DL-047)"
```

---

## Task 3: Export shells + gallery entries

**Files:**
- Modify: `mockups/src/shell/index.ts` (append two exports)
- Modify: `mockups/src/dev/ComponentsIndex.tsx` (add a showcase block per shell)

**Interfaces:**
- Consumes: Tasks 1–2 exports.
- Produces: `CCImplausibilityWarn` + `CCVoiceInput` importable via `@/shell`; both visible at `/_dev/components`.

- [ ] **Step 1: Add exports.** Append to `mockups/src/shell/index.ts`:

```ts
export * from './CCImplausibilityWarn'
export * from './CCVoiceInput'
```

- [ ] **Step 2: Add gallery blocks.** In `ComponentsIndex.tsx`, add a showcase for each new shell following the existing card-per-component pattern in that file: `CCImplausibilityWarn` with a sample `message` ("165 kg is 165% of the 100 kg ordered.") + the `IMPLAUSIBILITY_REASON_OPTIONS` and local state for `selectedReason`/`overridden`; `CCVoiceInput` with local `value` state, `unit="kg"`, `simulatedHeardValue="82"`. Use local `useState` in the index (it already uses `useState`).
- [ ] **Step 3: Typecheck + build.** `npx tsc --noEmit -p tsconfig.json` → exit 0; `npm run build` → exit 0.
- [ ] **Step 4: Commit.**

```bash
git add mockups/src/shell/index.ts mockups/src/dev/ComponentsIndex.tsx
git commit -m "feat(shell): export + gallery CCImplausibilityWarn/CCVoiceInput (Arc b W0)"
```

---

## Screen task template (applies to Tasks 4–17)

Each screen task = author `mockups/src/screens/inv/SI-INV-0NN.tsx` (default export, named `SiInv0NN`) **matching the `SI-INV-001.tsx` idiom** (JSDoc header block citing screen ID + tier + FRs + CC-patterns + reused chrome; page header eyebrow + `<h1>`; `SectionShift` + footer line `SI-INV-0NN · <tier/group> · Phase 4 Epic 4 Arc (b)`), then register it:

1. **Register route** — in `App.tsx`: add `import SiInv0NN from '@/screens/inv/SI-INV-0NN'` next to the other inv imports (lines 17–18), and `<Route path="/SI-INV-0NN" element={<SiInv0NN />} />` next to the inv routes (lines 81–82).
2. **Flag built** — in `screen-catalog.ts`, add `'SI-INV-0NN'` to the `BUILT_IDS` array (the label already exists in `RAW`).
3. **Verify** — `npx tsc --noEmit -p tsconfig.json` → exit 0; manually confirm the file exists and route line is present (`git status`).
4. **Commit** — `git add` the screen file + `App.tsx` + `screen-catalog.ts`; message `feat(inv-mock): SI-INV-0NN <name> (Arc b W<n>)`.

Per-screen briefs below give the device class, the exact fixtures + shells to consume, the sections to render, and the status mapping. Build only what the brief lists (YAGNI). Read the matching `_planning/05-screen-inventory.md` entry for journey context if needed.

---

## Wave 1 — read / list / dashboard (reuse SI-INV-001 grid chrome)

### Task 4: SI-INV-002 — Department Stock Detail
**Device:** responsive-equal. **Fixtures:** `stockBatches`, `stockMovements`, `inventoryPositions`, `materials`, `departments` (filter to one material × one CK Bandra department, taken from `?item=` query like SI-INV-001 links). **Shells:** `AuditLink` (entityRef = `${materialId}:${departmentId}`), `ProvisionalFlag`, `StatusPill`, `SectionShift`, `Table`, `DashboardTile`, reuse an `ExpiryPip`-equivalent (copy the small `ExpiryPip` idiom from SI-INV-001). **Sections:** (1) Item header — name, category, UOM, default yield factor, shelf-life policy, dept+location context. (2) Aggregate row — total on-hand, PAR level, below-PAR `StatusPill status="status_variance_flagged"` if on-hand < PAR. (3) FEFO batch `<Table>` (sorted by expiry asc, nulls last) — batch ref, received date, expiry date + expiry-band pip, on-hand qty, source GR/transfer ref, `ProvisionalFlag` per provisional batch. (4) 30-day movement history `<Table>` — timestamp, movement type, signed delta (`tabular-nums`), reference TRN; rows where `varianceFlagged` carry `status_variance_flagged`. **Sub-affordances (Links):** "Transfer from here" → `/SI-INV-005`, "Adjust batch" → `/SI-INV-013`, audit → `AuditLink`. Read-only (no `DraftPill`).

### Task 5: SI-INV-003 — Below-PAR Flag List
**Device:** responsive-equal (Tier 1 hero — already in `TIER_1_IDS`). **Fixtures:** `belowParRows`, `parLevels`, `materials`, `inventoryPositions`. **Shells:** `DashboardTile`, `StatusPill`, `Table`, `SectionShift`, a `FilterChipPicker` (copy from SI-INV-001). **Sections:** (1) `DashboardTile` counters — total below PAR, items below 50% (critical), items already on open PO. (2) Filter strip — scope, product type, category, urgency (`approaching`/`below`/`critical`). (3) Rows (mobile card stack ⁄ desktop `<Table>`): item, UOM, on-hand, base PAR, day-of-week-adjusted PAR (show both when they differ), shortfall, suggested reorder, "Already on open PO" indicator. Colour: `warning`=below PAR, `error`=below 50%, `success`=on open PO. **Sub-affordances:** row → `/SI-INV-002`; "Create PO" → `/SI-PUR-001` (stub link); "Requisition" → `/SI-INV-005`. Read-only.

### Task 6: SI-INV-008 — Expiry Countdown Dashboard
**Device:** responsive-equal (Tier 1 hero). **Fixtures:** `stockBatches` (perishable, with `expiryBand` + `hoursToExpiry` derived), `transferSuggestions`, `materials`, `locations`, `departments`. **Shells:** `DashboardTile`, `PairedTransferBundle` (for the paired-routed badge signature — read its props at `PairedTransferBundle.tsx:73`), `StatusPill`, a `FilterChipPicker`. **Sections:** (1) Three band sections 24h (`error`) / 48h (`warning`) / 72h (`tertiary_container` accent), each with a `DashboardTile` (batches / items / value-at-risk) and a row list: item, batch ref, location, dept, on-hand, hours-to-expiry countdown, value at risk. (2) Per-batch suggestion-type badge: "Single-hop within-cluster" vs "Paired Brand-Store-routed" (carry the `PairedTransferBundle` visual signature) vs "No suggestion — write off". (3) Filter chips — scope, product type, suggestion type. **Sub-affordances:** row → `/SI-INV-009`; single-hop badge → `/SI-INV-005`; paired badge → `/SI-INV-007`; row → `/SI-INV-002`. Read-only.

### Task 7: SI-INV-009 — Cross-Location Transfer Suggestions
**Device:** responsive-equal. **Fixtures:** `transferSuggestions`, `stockBatches`, `materials`, `locations`. **Shells:** `PairedTransferBundle` signature, `StatusPill`, `SectionShift`, a `FilterChipPicker`. **Sections:** (1) Source batch context — item, source location, on-hand, hours-to-expiry, value at risk. (2) Ranked suggestion list split into single-hop (destination dept/location, expected consumption capacity, feasibility score) and paired Brand-Store-routed (destination cluster, expected consumption, feasibility score, **bundled-approval requirement note**). (3) "No suggestion viable" empty state (mirror SI-INV-001's empty-state card). (4) Filter chips — suggestion type, urgency band. **Sub-affordances:** single-hop → `/SI-INV-005`; paired → `/SI-INV-007`; "Dismiss" (visual toggle, sets `dismissed`). Read-only.

### Task 8: SI-INV-016 — Closing Inventory Cluster Review
**Device:** desktop-primary. **Fixtures:** `closingInventory` (cluster spread incl. a `not_submitted` row), `closingInventory[].lines`, `cutOffRegistry`, `locations`, `departments`. **Shells:** `DashboardTile`, `StatusPill`, `Table`, `DataQualityAlertPane` (for the not-submitted pane — read `DataQualityAlert.tsx:22,57`), `IssueTicketLink` (read `IssueTicketLink.tsx:38`), `AuditLink`, `SectionShift`, `FilterChipPicker`. **Sections:** (1) Aggregate `DashboardTile`s — total locations, submitted on-time, submitted late, not submitted, total cluster variance value (`formatINR`). (2) Filter chips — scope (cluster/brand), business date, dept type (POS/Dispatch). (3) Per-location `<Table>` row — location, dept, status pill (Submitted=`status_completed`, Not-Submitted-by-Cutoff=`error` semantic, Pending Review=`status_pending_approval`), submission timestamp, total variance value, variance items count, top variance reasons. (4) Not-Submitted-by-Cut-off pane via `DataQualityAlertPane` — location, dept, expected cut-off time, hours overdue. (5) Per-location drill-in panel (inline expand) — variance lines, reason codes, `AuditLink`. **Sub-affordances:** `IssueTicketLink` per row; "Mark variance acceptable" (visual); "Send reminder" (visual broadcast). Read-only.

**Wave 1 gate:** after Tasks 4–8, run `npm run build` → exit 0.

---

## Wave 2 — config + transfer

### Task 9: SI-INV-004 — PAR Level Configuration
**Device:** desktop-primary. **Fixtures:** `parLevels`, `materials`, `locations`, `departments`. **Shells:** `DraftPill` (read `DraftPill.tsx:32`), `AuditLink`, `StatusPill`, `Table`, `Button`, `Input`, `Popover` (for the day-of-week override drawer), `SectionShift`, `FilterChipPicker`. **Sections:** (1) Page header with `DraftPill isDraft` while edits stage. (2) Filter chips — scope, product type, category. (3) PAR matrix `<Table>` — rows = items, columns = locations/departments in scope; each cell = base PAR `<Input>` (positive integer) + a "DoW" button opening a `Popover` with Mon–Sun override inputs. (4) Last-modified user + timestamp per row. (5) FR111 drift-recommendation badge (visual only, accept/ignore sub-affordance) on a couple of rows. (6) Bulk-set control (select rows → single value). `status_draft`/`status_confirmed` on a "Confirm changes" action. `AuditLink` per row.

### Task 10: SI-INV-005 — Stock Transfer Create
**Device:** mobile-first. **Fixtures:** `stockBatches` (FEFO per-batch on-hand at source), `transfers`/`TransferLine` shape, `departments`, `locations`, `materials`, `TRANSFER_REASON_OPTIONS`, `IMPLAUSIBILITY_REASON_OPTIONS`. **Shells:** `CCVoiceInput` (per-line requested qty), `CCImplausibilityWarn` (when requested > available), `CCDuplicateWarn` (existing — same-day duplicate; read `CCDuplicateWarn.tsx:37,52`), `DraftPill`, `Select`, `Button`, `Input`, `SectionShift`. **Sections:** (1) Header with `DraftPill isDraft mobileEyebrow`. (2) Source selector + destination selector — destination list filtered by FR28 flow rules + enablement; render invalid destinations as disabled items with a short reason ("raw material — cross-cluster not allowed"). (3) Item picker → per-line rows: item, source batch ref, **requested qty via `CCVoiceInput`** (`unit` = material UOM, `simulatedHeardValue` a plausible number), available qty, UOM; mandatory reason `Select` from `TRANSFER_REASON_OPTIONS`. (4) `CCImplausibilityWarn` beneath any line where requested > available (local `selectedReason`/`overridden` state per line; submit stays blocked until each flagged line is overridden). (5) `CCDuplicateWarn` panel when the demo "same-day duplicate" condition is on. (6) Single-hop within-cluster suggestion banner (pre-filled when arriving from 008/009 — read `?from=` query). Submit routes to `/SI-INF-001` when over threshold. `status_draft`/`status_pending_approval`.

### Task 11: SI-INV-006 — Stock Transfer Detail & Status
**Device:** responsive-equal. **Fixtures:** `transfers` (one per lifecycle status; pick via `?id=` or default to an `in_transit` one), `transferLines`, `stockBatches`, `materials`, `departments`. **Shells:** `TrnDisplay` (read `TrnDisplay.tsx:25`), `LifecycleStepper` with `STOCK_TRANSFER_LIFECYCLE_STEPS` (read `LifecycleStepper.tsx:74,131`), `StatusPill`, `AuditLink`, `IssueTicketLink`, `CCReverseCancelDialog` (read `CCReverseCancelDialog.tsx:94,131`), `Table`, `SectionShift`. **Sections:** (1) Header — `TrnDisplay`, source, destination, requested-by, requested-at, status pill. (2) `LifecycleStepper` across Draft→Pending Approval→Approved→In Transit→Received (Cancelled/Returned terminal). (3) Line items `<Table>` — item, requested, fulfilled, source batch refs, expiry per batch. (4) Reason code (if any) + approval-chain status (if routed). (5) `AuditLink`, `IssueTicketLink`. (6) Reverse/cancel via `CCReverseCancelDialog` — mode `pre-confirmed` (Draft/Pending → clean cancel) vs `post-confirmed` (Approved/In Transit/Received → compensating doc) selected by current status (FR117). Read-mostly (no `DraftPill`). Confirm-receipt affordance when `in_transit`. Status mapping: In Transit=`status_in_progress`, Received=`status_completed`, Cancelled=`status_cancelled`, Returned=`status_returned`.

**Wave 2 gate:** after Tasks 9–11, run `npm run build` → exit 0.

---

## Wave 3 — goods receipt + adjustment + closing

### Task 12: SI-INV-010 — Goods Receipt Entry — PO-Driven
**Device:** mobile-first (Tier 1 hero). **Fixtures:** `purchaseOrders` (from `sample-data.ts`, for the PO header + ordered qty), `materials`, `IMPLAUSIBILITY_REASON_OPTIONS`; derive per-line yield math locally (usable = received×yield, wastage = received−usable, adjustedCost). **Shells:** `CCVoiceInput` (received qty), `CCImplausibilityWarn` (>150% of PO), `CCDuplicateWarn` (same-day same-PO), `CCFileAttachUploader` (read `CCFileAttachUploader.tsx:59,77`), `DraftPill`, `TrnDisplay`, `AuditLink`, `StatusPill`, `Select`, `Input`. **Sections:** (1) PO header — PO TRN (`TrnDisplay`), vendor, expected date, expected lines; `DraftPill isDraft mobileEyebrow`. (2) Per line: item, ordered qty, previously-received, **received qty via `CCVoiceInput`**, UOM, yield factor `<Input>` (FR27 default pre-filled), usable qty (computed, read-only), wastage qty (computed), adjusted cost/unit (computed), expiry capture `<Input type=date>` (mandatory for perishables), batch ref; shelf-life acceptance pill PASS (`success`) / EXCEPTION (`warning`) per line. (3) `CCImplausibilityWarn` on any line >150% of PO; `CCDuplicateWarn` when same-day duplicate. (4) `CCFileAttachUploader` (FR39). (5) "Reject at QC" → `/SI-INV-012`. Submit → confirmed (or pending-approval on shelf-life exception → `/SI-INF-001`). `status_draft`/`status_pending_approval`/`status_confirmed`. `AuditLink`.

### Task 13: SI-INV-011 — Goods Receipt Entry — Transfer-Driven
**Device:** mobile-first. **Sibling of Task 12 — same shape, transfer upstream.** **Fixtures:** `transfers` (an `in_transit` one as the inbound), `transferLines`, `stockBatches`, `materials`, `IMPLAUSIBILITY_REASON_OPTIONS`. **Shells:** `CCVoiceInput`, `CCImplausibilityWarn`, `CCFileAttachUploader`, `DraftPill`, `TrnDisplay`, `AuditLink`, `StatusPill`, `Select`, `Input`. **Sections:** (1) Transfer header — transfer TRN (`TrnDisplay`), source location/dept, dispatched-by, dispatched-at, expected lines; `DraftPill isDraft mobileEyebrow`. (2) Per line: item, source batch ref, dispatched qty, **received qty via `CCVoiceInput`** (pre-filled from dispatched qty per CC-PREFILL), UOM, source expiry (carried forward, editable on exception), variance per line; `CCImplausibilityWarn` when variance beyond tolerance (FR114); mandatory reason `Select` when variance > 0. (3) `CCFileAttachUploader` (damage/shortfall). Submit → confirms transfer-leg receipt, transfer → Received. `status_draft`/`status_in_progress`/`status_completed`. `AuditLink`.

### Task 14: SI-INV-012 — Goods Receipt Rejection at QC
**Device:** mobile-first. **Fixtures:** `goodsReceipts` (from `sample-data.ts`, a `confirmed` GR to reject) + its lines, `purchaseOrders`, `vendors`, `materials`. **Shells:** `CCFileAttachUploader`, `DraftPill`, `TrnDisplay`, `AuditLink`, `StatusPill`, `Select`, `SectionShift`. **Sections:** (1) Source GR header — GR TRN (`TrnDisplay`), source PO TRN, vendor, received-by, received-at; `DraftPill isDraft`. (2) Per line: item, received qty, consumed-portion (Pending-GR override, FR65), unconsumed-portion, rejection reason `Select`. (3) Mandatory rejection reason code (per line or per GR) from a canonical list (shelf_life/quality/quantity_mismatch/damage). (4) Evidence `CCFileAttachUploader`. (5) Auto-drafted vendor-CN preview card — VCN draft TRN (`VCN-YYYY-LOC-SEQ`), AP reduction value (`formatINR`), GR+PO refs (Epic 5 stub, visual only). (6) PO-closure preview ("Closed — GR Rejected"). (7) Pending-GR reclassification preview (FR67a) in a `warning` callout. `status_draft`/`status_gr_rejected`; rejection banner uses `error_container`/`text-error`. `AuditLink`.

### Task 15: SI-INV-013 — Inventory Adjustment
**Device:** responsive-equal. **Fixtures:** `inventoryAdjustments` (one over-threshold, one FR114-tripping), `adjustmentLines`, `stockBatches`, `materials`, `departments`, `ADJUSTMENT_REASON_OPTIONS`, `IMPLAUSIBILITY_REASON_OPTIONS`. **Shells:** `CCImplausibilityWarn`, `DraftPill`, `TrnDisplay`, `AuditLink`, `ApprovalInboxCard` (read `ApprovalInboxCard.tsx:89,127` — preview when over threshold), `CCReverseCancelDialog`, `StatusPill`, `Select`, `Input`, `Table`. **Sections:** (1) Header — department/location, requested-by, requested-at; `DraftPill isDraft`. (2) Per line `<Table>`: item, batch ref, current on-hand, adjusted qty `<Input>`, delta (signed, computed), UOM, mandatory reason `Select` from `ADJUSTMENT_REASON_OPTIONS`. **(No `CCVoiceInput` — the screen inventory does not cite FR112 for adjustments.)** (3) Aggregate value impact (₹, `formatINR`) driving approval routing. (4) Approval-chain preview via `ApprovalInboxCard` when over threshold. (5) `CCImplausibilityWarn` on any line whose delta exceeds tolerance (FR114). (6) `CCReverseCancelDialog` for reverse/cancel (FR117). `status_draft`/`status_pending_approval`/`status_confirmed`. `AuditLink`, `TrnDisplay`.

### Task 16: SI-INV-014 — Closing Inventory Entry — POS Daily ⭐ Tier 1 Acceptance
**Device:** mobile-first (already in `TIER_1_IDS`). **Apply full Tier 1 acceptance rigor** — exhaustive states, accessible labels, no chrome shortcuts. **Fixtures:** `closingInventory` (the POS-context record, `deptType: 'pos'`) + its lines (one trips FR114), `cutOffRegistry`, `materials`, `CLOSING_VARIANCE_REASON_OPTIONS`, `IMPLAUSIBILITY_REASON_OPTIONS`. **Shells:** `CCVoiceInput` (counted qty), `CCImplausibilityWarn` (counted > opening+receipts−dispatches), `DraftPill`, `TrnDisplay`, `AuditLink`, `StatusPill`, `Select`, `Table`, `DashboardTile`. **Sections:** (1) POS context header — location, dept, business date, **cut-off countdown** (derive from `cutOffRegistry`; `warning` as it approaches, `error` if missed); `DraftPill isDraft mobileEyebrow` (critical — count spans 30+ min). (2) Aggregate `DashboardTile`s — items to count, completed, unresolved variance, reason missing. (3) Per item: name, expected qty (opening + received − sold − wasted), **counted qty via `CCVoiceInput`**, variance (computed), mandatory reason `Select` from `CLOSING_VARIANCE_REASON_OPTIONS` per non-zero variance, UOM; variance pill `status_variance_flagged`. (4) `CCImplausibilityWarn` on the FR114-tripping line. (5) Submit-before-cutoff banner. Submit → `status_completed` (or `status_variance_flagged`); CC-PREFILL note (yesterday's closing as reference). `AuditLink`, `TrnDisplay`.

### Task 17: SI-INV-015 — Closing Inventory Entry — Dispatch Daily ⭐ Tier 1 Acceptance
**Device:** mobile-first. **Sibling of Task 16, Dispatch context.** **Apply full Tier 1 acceptance rigor.** **Fixtures:** `closingInventory` (the Dispatch-context record, `deptType: 'dispatch'`) + lines, `cutOffRegistry`, `materials`, `CLOSING_VARIANCE_REASON_OPTIONS`, `IMPLAUSIBILITY_REASON_OPTIONS`. **Shells:** same set as Task 16. **Sections:** same shape as Task 16, except expected qty formula = **production received − dispatched**, role = Dispatch Staff, dept = Dispatch. `status_draft`/`status_completed`/`status_variance_flagged`.
- **Extra registration step for this task:** also add `'SI-INV-015'` to `TIER_1_IDS` in `screen-catalog.ts` (deferred Tier-1 acceptance per the session brief + Phase 4 invariant; mirror the existing SI-USR/SI-INF deferred-Tier-1 comment style — cite "Phase 4 Epic 4 Arc (b) — Tier 1 acceptance applies even though built in Phase 4").

**Wave 3 gate:** after Tasks 12–17, run `npm run build` → exit 0.

---

## Task 18: Close-out

**Files:**
- Modify: `decision-log.md` (append DL-047)
- Modify: `CLAUDE.md` (`## Current phase`)
- Modify: `mockups/src/lib/screen-catalog.ts` (confirm `SI-INV-001`/`SI-INV-007` also in `BUILT_IDS`)

- [ ] **Step 1: Append DL-047** to `decision-log.md` (match the file's existing entry format): "DL-047 — CC-IMPLAUSIBILITY-WARN + CC-VOICE-INPUT first visual treatment" — inline per-line warn-and-log (`warning` token + `AlertTriangle`, mirrors `CCDuplicateWarn`); voice = trailing mic button scoped to quantity fields; listening-pulse is reduced-motion-guarded interaction feedback (not an entrance animation). Also note `SI-INV-015` elevated to deferred Tier-1 acceptance.
- [ ] **Step 2: Add `SI-INV-001` + `SI-INV-007` to `BUILT_IDS`** (they exist as files but were never flagged), alongside the 14 new ids — so the ScreenIndex "Built" badge is accurate for all 16 INV screens.
- [ ] **Step 3: Update `## Current phase` in `CLAUDE.md`** — mark "Phase 4 Epic 4 INV — Arc (b) mockups ✅ BUILT" (16 SI-INV mockups complete: 14 new + 001/007; 2 new shells CCImplausibilityWarn/CCVoiceInput; DL-047), and set Next to "Arc (c) production frontend (apply chrome-freeze gate at Epic 4 close)".
- [ ] **Step 4: Final verification.** `npx tsc --noEmit -p tsconfig.json` → exit 0; `npm run build` → exit 0. Confirm all 14 routes resolve (no `ScreenStub` fallback) by checking `App.tsx`.
- [ ] **Step 5: Commit.**

```bash
git add decision-log.md CLAUDE.md mockups/src/lib/screen-catalog.ts
git commit -m "docs(inv): Epic 4 Arc (b) close-out — DL-047, current-phase marker, BUILT_IDS sweep"
```

---

## Self-Review (completed during planning)

- **Spec coverage:** every spec §2 shell → Tasks 1–3; §3 fixtures → Task 0; all 14 §4 screens → Tasks 4–17; §5 waves → task grouping + wave gates; §6 DoD → Task 18. ✅
- **Placeholder scan:** no "TBD"/"handle edge cases"/"similar to". Screen tasks give explicit fixtures, shells (with prop-interface line refs), sections, and status mappings. ✅
- **Type consistency:** fixture export names in Task 0 `Produces` are referenced verbatim in the screen tasks (`stockBatches`, `transfers`, `transferSuggestions`, `closingInventory`, `parLevels`, `belowParRows`, the `*_REASON_OPTIONS` lists). Shell prop names (`message`/`reasonCodes`/`selectedReason`/`overridden`; `value`/`onChange`/`unit`/`simulatedHeardValue`) match Tasks 1–2 → consumers in Tasks 10–16. ✅
- **Token discipline:** every colour reference uses a token class; only allow-listed `border-l-*`/`border-warning` borders; single documented motion exception. ✅

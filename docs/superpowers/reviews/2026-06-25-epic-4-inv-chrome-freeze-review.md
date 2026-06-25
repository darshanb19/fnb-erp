# Epic-4 INV Chrome-Freeze Review
**Date:** 2026-06-25
**Branch:** `phase-4/epic-4-inv-arc-c-frontend`
**Reviewer:** Claude Code (automated gate per CLAUDE.md Phase-4 invariant)

---

## Verdict

**NO DRIFT — chrome consistent across Epics 3 & 4.**

All 14 INV production pages (Wave 1–3) are structurally consistent with the Epic-3 INF baseline. No fix-backs required before Epic-4 close. Two minor findings are noted (deferred-to-sweep): a domain-appropriate fallback string difference in a private helper, and `deriveLocationCode` being copy-pasted per-file rather than extracted to a shared utility.

---

## Pages Reviewed

**INV subject (14 pages):**
- Wave 1: `StockViewPage`, `DepartmentStockDetailPage`, `BelowParPage`, `ExpiryCountdownPage`, `TransferSuggestionsPage`, `ClosingClusterReviewPage`, `ParLevelConfigPage`
- Wave 2: `StockTransferCreatePage`, `StockTransferDetailPage`, `PairedTransferPage`
- Wave 3 (all 5 new pages): `GoodsReceiptEntryPage`, `GoodsReceiptTransferPage`, `GoodsReceiptRejectPage`, `InventoryAdjustmentPage`, `ClosingCountPage`

**INF baseline (2 pages read in full):** `ApprovalInboxPage`, `AuditTrailViewerPage` (plus counters/structure spot-checked on remaining 6).

---

## Check-by-Check Findings

### 1. Shell Reuse — PASS

All 14 INV pages import exclusively from `@/components/shell`. No hand-rolled equivalents of existing shells were found.

- `Table` / `TableHeader` / `TableBody` / `TableRow` / `TableHead` / `TableCell` — used in all desktop data-grid screens (StockViewPage, InventoryAdjustmentPage, ClosingCountPage, etc.)
- `StatusPill` — used correctly on all status-bearing screens
- `DraftPill` — used on all form/create pages (GoodsReceiptEntryPage, GoodsReceiptTransferPage, GoodsReceiptRejectPage, InventoryAdjustmentPage, ClosingCountPage)
- `TrnDisplay` — used on all transaction-referencing screens
- `AuditLink` — present on every form page and detail page
- `DashboardTile` — used on StockViewPage, ExpiryCountdownPage, ClosingCountPage
- `SectionShift` — used throughout for tonal section breaks; no `<Separator>` found
- `CCVoiceInput` — used on GoodsReceiptEntryPage, GoodsReceiptTransferPage, ClosingCountPage (quantity fields)
- `CCImplausibilityWarn` — used on GoodsReceiptTransferPage, InventoryAdjustmentPage, ClosingCountPage
- `CCDuplicateWarn` — used on GoodsReceiptEntryPage
- `CCReverseCancelDialog` — used on InventoryAdjustmentPage
- `Input`, `Button`, `Popover` / `PopoverContent` / `PopoverTrigger` — used throughout

No ad-hoc shell duplications identified.

### 2. Layout Container Consistency — PASS

The canonical two-level wrapper pattern is consistent across all 14 INV pages and matches the INF baseline:

```
<div className="bg-surface min-h-full">
  <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 [desktop:px-10 desktop:py-10]">
```

- All 14 pages use `bg-surface min-h-full` at the outer level
- All 14 pages use `max-w-[1440px]` (no divergent max-width)
- `desktop:px-10 desktop:py-10` is present on full pages; correctly absent on loading/error early-return wrappers (which don't need the third breakpoint)
- No custom max-widths, no `container` class, no `min-h-screen` divergences

Evidence (representative): `StockViewPage:255-256`, `GoodsReceiptEntryPage:386-387`, `InventoryAdjustmentPage:394-395`, `ClosingCountPage:444-445`, `BelowParPage:557-558`, `ParLevelConfigPage:370-371`.

### 3. Loading + Error States — PASS

The standardised skeleton pattern is consistent across all INV pages and matches INF:

**Loading skeleton:**
```tsx
<div role="status" aria-label="Loading" className="flex flex-col gap-3">
  {[1, 2, 3, 4].map((i) => (
    <div key={i} className="h-16 rounded-md bg-surface-container-low animate-pulse" />
  ))}
</div>
```
Confirmed in: `StockViewPage`, `DepartmentStockDetailPage`, `BelowParPage`, `ParLevelConfigPage`, `StockTransferCreatePage`, `GoodsReceiptEntryPage`, `GoodsReceiptTransferPage`, `GoodsReceiptRejectPage`, `InventoryAdjustmentPage` (via `LoadingState` sub-component), `ClosingCountPage` (via `LoadingState` sub-component).

**Error state:**
```tsx
<div role="alert" className="rounded-md bg-error-container p-6 text-on-error-container">
  <p className="text-sm font-medium">…</p>
</div>
```
Confirmed in all pages that surface a full-page error. Form pages (GR entry/transfer/reject, InventoryAdjustment) correctly use inline `role="alert"` banners for mutation errors — this is intentional spec compliance to preserve filled form state, not a deviation.

### 4. Status Token Usage — PASS

All status tokens used across INV pages are from the canonical 20-token palette defined in `apps/web/src/lib/tokens.ts`. The 8 tokens in use:

| Token | Canonical? | Usage |
|---|---|---|
| `status_draft` | ✓ (line 138) | DraftPill, form state |
| `status_pending_approval` | ✓ (line 144) | Transfer/adjustment approval routing |
| `status_in_progress` | ✓ (line 177) | Transfer status |
| `status_completed` | ✓ (line 183) | Received/closed transfer mapping |
| `status_confirmed` | ✓ (line 171) | GR confirmed, adjustment confirmed |
| `status_cancelled` | ✓ (line 213) | Adjustment cancellation |
| `status_gr_rejected` | ✓ (line 222) | GR QC rejection |
| `status_variance_flagged` | ✓ (line 271) | Closing count variance |

No invented or misused status tokens found. The `status_completed` token is correctly used as a mapping target for the `'received'`/`'confirmed'` backend statuses (StockTransferDetailPage:96, ClosingClusterReviewPage:96) — this is a semantic mapping at the display layer, not an invented token.

### 5. Token Discipline (Spot-Check) — PASS

**Hex literals:** `grep -rn "#[0-9A-Fa-f]{3,6}"` across all 14 INV pages — **NO HITS**. Zero hex literals.

**Lucide-only icons:** `grep -rn "@material-symbols|@mui/icons|material-icons"` — **NO HITS**. All icon imports are from `lucide-react`.

**Inter-only font:** `grep -rn "font-family|fontFamily"` — **NO HITS**. No inline font declarations; Inter inherited.

**Sectioning borders:** Full scan for `border[^-l]`, `border-t`, `border-b`, `border-r`, `border-x`, `border-y`, `divide-y`, `divide-x` (excluding focus/aria prefixes) — **NO HITS**.

**border-l-4 pip pattern (allow-listed):** Used correctly in:
- `ExpiryCountdownPage:328,348,422-423` — `border-l-4 border-{error|warning|tertiary}` as accent pip elements inside band heading rows (§6.1 allow-list)
- `ClosingCountPage:500` — `border-l-4 border-warning` as inline status pip in server-warnings banner
- `ClosingCountPage:715` — `border-l-4 border-{error|warning}` in cut-off countdown alert pip

All `border-l-4` usages are on empty `<div>` elements serving as visual pip markers, not on sectioning containers. All comply with the allow-list.

**`<SectionShift>` vs `<Separator>`:** `grep -rn "Separator"` — **NO HITS**. Every tonal break uses `<SectionShift tone="low">` or `<SectionShift tone="high">`.

**Animation policy:** Only `animate-pulse` (skeleton loading pattern) found in INV pages. No entrance animations on data tables, forms, or dashboards. `CCVoiceInput`'s listening-pulse is its own `motion-reduce:animate-none`-guarded pattern (internal to the shell, not introduced by INV pages).

### 6. Native `<select>` Consistency — PASS

All INV pages use token-styled native `<select>` elements consistently. No `@/components/ui/select` imports found (the one hit in `InventoryAdjustmentPage:62` is in a comment explicitly calling out the decision). The canonical select styling is applied uniformly across all pages:

```tsx
className={[
  'h-11 rounded-md px-3 text-sm text-on-surface',
  'bg-surface-container-lowest',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
].join(' ')}
```

Variation with `bg-surface-container-low` (not `bg-surface-container-lowest`) appears on some department-picker selects in StockViewPage (`bg-surface-container-low`). This is minor and consistent within Wave 1.

### 7. Cross-Page Internal Consistency Within Epic 4 — PASS (one minor note)

**Loading/error JSX:** Identical `role="status"` skeleton and `role="alert"` error patterns across all 14 INV pages. Wave-3 pages (InventoryAdjustmentPage, ClosingCountPage) extract into named `LoadingState` / `ErrorState` sub-components — a minor cleanliness improvement over the earlier Wave-1 inline pattern, but structurally identical.

**Header/eyebrow/DraftPill structure:** All form pages use the same three-line header structure (eyebrow `text-[11px] font-medium uppercase tracking-wider text-on-surface-variant`, `h1`, subtitle) with `DraftPill isDraft mobileEyebrow` in the header's right side.

**Record→confirm two-step pattern:** Consistent across GoodsReceiptEntryPage, GoodsReceiptTransferPage, InventoryAdjustmentPage, and ClosingCountPage. Mutation errors surface as inline `role="alert"` banners rather than top-level page replacements — preserving form state.

**`deriveLocationCode` helper:** Present in 4 Wave-3 files (GoodsReceiptEntryPage, GoodsReceiptTransferPage, InventoryAdjustmentPage, ClosingCountPage) as a private copy-pasted function. Two variants exist:
- GR pages use fallback `'GR'` (domain-appropriate)
- Adjustment/closing pages use fallback `'INV'` (domain-appropriate)
- Core logic (regex sanitise → slice(0, 20) → toUpperCase) is identical

**Footer pattern:** All 14 INV pages end with `<SectionShift tone="high" className="mt-10" aria-hidden />` followed by a `<footer>` containing screen ID, tier/group, and FR references. Consistent with INF pattern.

---

## Summary of Findings

| # | Check | Result | Notes |
|---|---|---|---|
| 1 | Shell reuse | PASS | All 14 pages import from `@/components/shell` only |
| 2 | Layout container | PASS | `bg-surface min-h-full` + `max-w-[1440px]` universal |
| 3 | Loading + error states | PASS | `role="status"` skeleton + `role="alert"` banner consistent |
| 4 | Status token usage | PASS | All 8 tokens in canonical 20-token palette |
| 5 | Token discipline | PASS | Zero hex, Lucide-only, Inter-only, no banned borders |
| 6 | Native `<select>` | PASS | Consistent token-styled pattern; no shadcn `Select` |
| 7 | Cross-page consistency | PASS | Minor: `deriveLocationCode` copy-pasted (not shared util) |

### Minor Findings (deferred-to-sweep, not blocking Epic-4 close)

**M-1** — `deriveLocationCode` is copy-pasted into 4 Wave-3 files rather than extracted to `@/hooks/inv/utils.ts` or similar. The core logic is identical; only the fallback code differs by domain context (`'GR'` vs `'INV'`). Not a chrome concern — a DRY concern for a future cleanup sweep.

**M-2** — `StockViewPage` department-picker `<select>` uses `bg-surface-container-low` while later pages (GoodsReceiptEntryPage, InventoryAdjustmentPage, etc.) use `bg-surface-container-lowest`. Both are canonical tokens; the visual difference is one tone step. Not a compliance violation, but worth aligning in a future wave.

---

## Chrome-Freeze Gate Decision

**GATE: CLOSED — no drift requiring fix-back.**

Epic 4 INV chrome is consistent with the Epic 3 INF baseline and with itself across all three waves. The two minor findings (M-1, M-2) are quality-of-life cleanups that do not introduce cross-epic chrome inconsistency. Epic 4 may close.

---

*Review performed: 2026-06-25 | Files inspected: 14 INV pages (all), 2 INF pages (baseline), StatusPill shell, tokens file | Grep scans: hex literals, material icons, border violations, Separator, status tokens, animate-* | Branch: phase-4/epic-4-inv-arc-c-frontend*

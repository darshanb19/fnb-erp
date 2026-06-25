import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  CirclePlus,
  Info,
  Package,
  PackageCheck,
  Trash2,
} from 'lucide-react'

import {
  AuditLink,
  Button,
  CCDuplicateWarn,
  CCFileAttachUploader,
  CCVoiceInput,
  DraftPill,
  Input,
  SectionShift,
  StatusPill,
  TrnDisplay,
  type IssueAttachment,
} from '@/components/shell'

import { useInventoryDepartments, useInventoryProductCatalog } from '@/hooks/inv/useProductNames'
import { useInventoryUoms } from '@/hooks/inv/useOrgLists'
import {
  useGoodsReceipts,
  useRecordGoodsReceipt,
  useConfirmGoodsReceipt,
} from '@/hooks/inv/useGoodsReceipts'
import { ApiError } from '@/lib/api-client'
import type { InventoryDepartment } from '@/hooks/inv/schemas'

/**
 * SI-INV-010 — Goods Receipt Entry (manual, no PO) production page.
 *
 * Tier 1 hero · Group 3 · Phase 4 Epic 4 Arc (c) Wave 3.
 *
 * FRs: FR27 (yield factor — usable/wastage/adjusted cost), FR39 (attachments,
 *      disabled — wired in later Epic-3 files surface), FR114/FR115
 *      (implausibility warn via server warnings after recordGoodsReceipt).
 *
 * Divergences from mockup (Wave-3 spec / task brief):
 *   1. NO PO header card — no PO backend exists. Replaced with destination-
 *      department picker + "manual receipt" eyebrow.
 *   2. NO PO-reference text input (backend has no field; DL-050 context).
 *   3. poId: null on every submission.
 *   4. Client-side >150% implausibility block REMOVED — no orderedQty to
 *      compare against. FR114 surfaces via server: if recordGoodsReceipt
 *      returns warnings[], user must pick a reason before confirmGoodsReceipt.
 *   5. CCFileAttachUploader rendered disabled/read-only (title annotation);
 *      no uploads wired.
 *   6. Success: inline banner with grTrn + "record another" reset (avoids the
 *      dead /inventory/goods-receipts list route); list path is the canonical
 *      target once added in a later task.
 *
 * Submit flow:
 *   recordGoodsReceipt → if warnings → show banner + reason select → confirm
 *                      → if no warnings → confirm immediately → success banner
 *
 * Route: /inventory/goods-receipts/new (RequireAuth only, DL-049 precedent).
 *
 * Animation: NONE per CLAUDE.md. Sole motion is CCVoiceInput's own guarded
 * pulse (reduced-motion-guarded internally).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Inline constants (inlined per brief; NOT imported from inv-sample-data)
// ─────────────────────────────────────────────────────────────────────────────

const IMPLAUSIBILITY_REASON_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'recount_confirmed', label: 'Recount confirmed — count is correct' },
  { value: 'recording_error', label: 'Recording error — correcting now' },
  { value: 'genuine_overage', label: 'Genuine overage — vendor sent extra' },
  { value: 'bonus_stock', label: 'Bonus/promotional stock from vendor' },
  { value: 'other', label: 'Other (add note)' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface GRLineState {
  id: string
  productId: string
  receivedQty: string
  yieldFactor: string
  unitCost: string
  expiryDate: string
  batchRef: string
  /** uomId defaults to product's defaultUomId; resolved from catalog. */
  uomId: string
  /** Shelf-life: null = not evaluated; true = PASS; false = EXCEPTION */
  shelfLifePass: boolean | null
}

type PagePhase =
  | 'draft'
  | 'recording'
  | 'warnings_pending'   // recordGoodsReceipt returned warnings; need reason before confirm
  | 'confirming'
  | 'success'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

let lineIdCounter = 0
function nextLineId(): string {
  lineIdCounter += 1
  return `gr-line-${lineIdCounter}`
}

function makeDefaultLine(productId = '', uomId = ''): GRLineState {
  return {
    id: nextLineId(),
    productId,
    receivedQty: '',
    yieldFactor: '1',
    unitCost: '',
    expiryDate: '',
    batchRef: '',
    uomId,
    shelfLifePass: null,
  }
}

/** Derive a short location code from a department (mirrors StockTransferCreatePage). */
function deriveLocationCode(dept: InventoryDepartment | undefined): string {
  return (
    (dept?.code ?? dept?.name ?? 'GR')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 20)
      .toUpperCase()
  ) || 'GR'
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─────────────────────────────────────────────────────────────────────────────
// Yield math (FR27)
// ─────────────────────────────────────────────────────────────────────────────

function computeYield(receivedQtyStr: string, yieldFactorStr: string, unitCostStr: string) {
  const received = parseFloat(receivedQtyStr) || 0
  const yf = parseFloat(yieldFactorStr) || 1
  const unitCost = parseFloat(unitCostStr) || 0
  const usable = Math.round(received * yf * 100) / 100
  const wastage = Math.round((received - usable) * 100) / 100
  const adjCostUnit = yf > 0 && unitCost > 0 ? Math.round((unitCost / yf) * 100) / 100 : 0
  return { received, usable, wastage, adjCostUnit }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function GoodsReceiptEntryPage() {
  const navigate = useNavigate()

  // ── ALL hooks ABOVE early returns ─────────────────────────────────────────

  const { data: depts, isLoading: deptsLoading } = useInventoryDepartments()
  const catalog = useInventoryProductCatalog()
  const { data: uoms, isLoading: uomsLoading } = useInventoryUoms()

  const recordGR = useRecordGoodsReceipt()
  const confirmGR = useConfirmGoodsReceipt()

  // For CCDuplicateWarn — all GRs today for the selected dept
  const { data: allGRs } = useGoodsReceipts({})

  // ── Local state ───────────────────────────────────────────────────────────

  const [deptId, setDeptId] = useState<string>('')
  const [lines, setLines] = useState<GRLineState[]>(() => [makeDefaultLine()])
  const [isDraft, setIsDraft] = useState(true)
  const [duplicateProceed, setDuplicateProceed] = useState(false)

  // warnings flow state
  const [pagePhase, setPagePhase] = useState<PagePhase>('draft')
  const [recordedId, setRecordedId] = useState<string | null>(null)
  const [recordedTrn, setRecordedTrn] = useState<string | null>(null)
  const [serverWarnings, setServerWarnings] = useState<string[]>([])
  const [selectedWarnReason, setSelectedWarnReason] = useState<string>('')
  const [confirmError, setConfirmError] = useState<string | null>(null)

  // success state
  const [successTrn, setSuccessTrn] = useState<string | null>(null)

  // Disabled uploader (FR39 — not wired yet)
  const disabledAttachments: ReadonlyArray<IssueAttachment> = []

  // ── Derived ───────────────────────────────────────────────────────────────

  const isLoading = deptsLoading || catalog.isLoading || uomsLoading

  const selectedDept = useMemo(
    () => (depts ?? []).find((d) => d.id === deptId),
    [depts, deptId],
  )

  const uomCodeOf = useMemo(() => {
    const map = new Map((uoms ?? []).map((u) => [u.id, u.code]))
    return (uomId: string) => map.get(uomId) ?? uomId
  }, [uoms])

  // Duplicate detection: same destinationDepartmentId + today
  const todayStr = todayIso()
  const duplicateMatches = useMemo(() => {
    if (!deptId || !allGRs) return []
    return allGRs
      .filter(
        (gr) =>
          gr.destinationDepartmentId === deptId &&
          (gr.createdAt ?? '').slice(0, 10) === todayStr,
      )
      .map((gr) => ({
        id: gr.id,
        name: `${gr.grTrn} — status: ${gr.status}`,
        status: 'active' as const,
      }))
  }, [allGRs, deptId, todayStr])

  const hasShelfLifeException = lines.some((l) => l.shelfLifePass === false)

  const submitGated =
    !deptId ||
    lines.length === 0 ||
    lines.some((l) => !l.productId) ||
    lines.some((l) => !l.receivedQty || parseFloat(l.receivedQty) <= 0)

  const isPending = recordGR.isPending || confirmGR.isPending

  // ── Loading guard ─────────────────────────────────────────────────────────

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

  // ── Error guard ───────────────────────────────────────────────────────────

  const loadError = recordGR.error && pagePhase === 'draft' ? recordGR.error : null
  if (loadError) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8">
          <div role="alert" className="rounded-md bg-error-container p-6 text-on-error-container">
            <p className="text-sm font-medium">
              {loadError instanceof ApiError
                ? loadError.message
                : 'Failed to load. Please retry.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleAddLine() {
    setLines((prev) => [...prev, makeDefaultLine()])
  }

  function handleRemoveLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }

  function handleLineChange<K extends keyof GRLineState>(
    id: string,
    field: K,
    value: GRLineState[K],
  ) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l
        const updated: GRLineState = { ...l, [field]: value }
        if (field === 'productId') {
          const newUomId = catalog.defaultUomOf(value as string) ?? ''
          const newYieldFactor = String(catalog.yieldOf(value as string))
          return { ...updated, uomId: newUomId, yieldFactor: newYieldFactor }
        }
        return updated
      }),
    )
  }

  function handleShelfLifeToggle(id: string, pass: boolean) {
    handleLineChange(id, 'shelfLifePass', pass)
  }

  function handleReset() {
    setLines([makeDefaultLine()])
    setDeptId('')
    setIsDraft(true)
    setDuplicateProceed(false)
    setPagePhase('draft')
    setRecordedId(null)
    setRecordedTrn(null)
    setServerWarnings([])
    setSelectedWarnReason('')
    setConfirmError(null)
    setSuccessTrn(null)
  }

  async function handleSubmit() {
    if (submitGated || !deptId) return
    setPagePhase('recording')
    setIsDraft(false)
    setConfirmError(null)

    try {
      const rec = await recordGR.mutateAsync({
        destinationDepartmentId: deptId,
        locationCode: deriveLocationCode(selectedDept),
        poId: null,
        lines: lines
          .filter((l) => l.productId && parseFloat(l.receivedQty) > 0)
          .map((l) => ({
            productId: l.productId,
            receivedQty: parseFloat(l.receivedQty),
            uomId: l.uomId || (catalog.defaultUomOf(l.productId) ?? ''),
            yieldFactor: parseFloat(l.yieldFactor) || 1,
            unitCost: l.unitCost ? parseFloat(l.unitCost) : undefined,
            batchNumber: l.batchRef || undefined,
            expiryDate: l.expiryDate || undefined,
          })),
      })

      if (rec.warnings.length > 0) {
        // FR114: server flagged implausibility — need a reason before confirm
        setRecordedId(rec.goodsReceiptId)
        setRecordedTrn(rec.grTrn)
        setServerWarnings(rec.warnings)
        setSelectedWarnReason('')
        setPagePhase('warnings_pending')
        return
      }

      // No warnings — confirm immediately
      setPagePhase('confirming')
      await confirmGR.mutateAsync({ grId: rec.goodsReceiptId })
      setSuccessTrn(rec.grTrn)
      setPagePhase('success')
    } catch (err) {
      setPagePhase('draft')
      setIsDraft(true)
      // error surfaced via recordGR.error / confirmGR.error
    }
  }

  async function handleConfirmWithReason() {
    if (!recordedId || !selectedWarnReason) return
    setPagePhase('confirming')
    setConfirmError(null)

    try {
      await confirmGR.mutateAsync({ grId: recordedId, reasonCode: selectedWarnReason })
      setSuccessTrn(recordedTrn)
      setPagePhase('success')
    } catch (err) {
      setPagePhase('warnings_pending')
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Confirm failed — please select a reason and try again.'
      setConfirmError(msg)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">

        {/* ── Page header ──────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-4 mb-6 tablet:mb-8">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Inventory · Goods Receipt · Manual Entry
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Goods Receipt Entry
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Record received quantities, yield factors, and expiry data for a manual
              (non-PO) goods receipt.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <DraftPill isDraft={isDraft} mobileEyebrow />
          </div>
        </header>

        {/* ── Success banner ────────────────────────────────────────────── */}
        {pagePhase === 'success' && successTrn && (
          <section
            role="alert"
            aria-live="polite"
            className="mb-6 flex items-start gap-3 rounded-md bg-surface-container p-4"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success mt-0.5" aria-hidden />
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <span className="text-sm font-medium text-on-surface">
                Goods receipt confirmed
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status="status_confirmed" size="sm" />
                <TrnDisplay trn={successTrn} />
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                Stock updated. The receipt has been recorded and confirmed.
              </p>
            </div>
            <div className="flex flex-col gap-2 items-end shrink-0">
              <AuditLink entityType="goods_receipts" entityRef={successTrn} />
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-primary hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm px-1"
              >
                Record another receipt
              </button>
            </div>
          </section>
        )}

        {/* ── Server warnings + reason select (FR114 via server) ────────── */}
        {(pagePhase === 'warnings_pending' || pagePhase === 'confirming') && serverWarnings.length > 0 && (
          <section
            role="alert"
            aria-live="polite"
            className="mb-6 flex flex-col gap-3 rounded-md bg-surface-container p-4"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-warning mt-0.5" aria-hidden />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-on-surface">
                  Implausibility flagged by server (FR114)
                </span>
                <ul className="list-disc list-inside text-xs text-on-surface-variant space-y-0.5">
                  {serverWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Reason select — required before confirm */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="warn-reason"
                className="text-xs font-medium text-on-surface-variant"
              >
                Select a reason to proceed <span aria-hidden className="text-error">*</span>
              </label>
              <select
                id="warn-reason"
                aria-label="Implausibility reason"
                value={selectedWarnReason}
                onChange={(e) => setSelectedWarnReason(e.target.value)}
                className={[
                  'h-11 rounded-md px-3 text-sm text-on-surface',
                  'bg-surface-container-lowest',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  'max-w-sm',
                ].join(' ')}
              >
                <option value="">Select reason…</option>
                {IMPLAUSIBILITY_REASON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Confirm error surfaced inline */}
            {confirmError && (
              <p className="text-xs text-error flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {confirmError}
              </p>
            )}

            <div className="flex items-center gap-3">
              <Button
                variant="default"
                size="sm"
                disabled={!selectedWarnReason || pagePhase === 'confirming'}
                onClick={() => { void handleConfirmWithReason() }}
                aria-label="Confirm receipt with selected reason"
              >
                {pagePhase === 'confirming' ? 'Confirming…' : 'Confirm with reason'}
              </Button>
              {recordedTrn && (
                <AuditLink entityType="goods_receipts" entityRef={recordedTrn} compact />
              )}
            </div>
          </section>
        )}

        {/* ── Inline record error (draft phase) ────────────────────────── */}
        {recordGR.error && pagePhase === 'draft' && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-md bg-error-container p-4 text-on-error-container"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <p className="text-sm">
              {recordGR.error instanceof ApiError
                ? recordGR.error.message
                : 'Failed to record goods receipt. Please check the form and retry.'}
            </p>
          </div>
        )}

        {/* ── Duplicate warn (CCDuplicateWarn — FR115) ─────────────────── */}
        {duplicateMatches.length > 0 && !duplicateProceed && pagePhase === 'draft' && (
          <section aria-label="Possible duplicate receipts" className="mb-6">
            <CCDuplicateWarn
              matches={duplicateMatches}
              onEditExisting={(id) => navigate(`/inventory/goods-receipts/${id}`)}
              onProceedAnyway={() => setDuplicateProceed(true)}
            />
          </section>
        )}

        {/* ── Section 1: Destination department ────────────────────────── */}
        <SectionShift tone="low" className="mb-6" aria-hidden />
        <section aria-label="Receipt destination" className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Destination Department
            </span>
          </div>

          <div className="rounded-md bg-surface-container-low p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5 max-w-sm">
              <label
                htmlFor="dest-dept"
                className="text-xs font-medium text-on-surface-variant"
              >
                Department <span aria-hidden className="text-error">*</span>
              </label>
              <select
                id="dest-dept"
                aria-label="Destination department"
                value={deptId}
                onChange={(e) => {
                  setDeptId(e.target.value)
                  setDuplicateProceed(false)
                }}
                className={[
                  'h-11 rounded-md px-3 text-sm text-on-surface',
                  'bg-surface-container-lowest',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                ].join(' ')}
              >
                <option value="">Select department…</option>
                {(depts ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}{d.code ? ` (${d.code})` : ''}
                  </option>
                ))}
              </select>
              {selectedDept && (
                <p className="text-xs text-on-surface-variant">
                  {selectedDept.name}
                  {selectedDept.code ? ` · ${selectedDept.code}` : ''}
                  {selectedDept.type ? ` · ${selectedDept.type}` : ''}
                </p>
              )}
            </div>

            <div className="flex items-start gap-2 bg-surface-container rounded-sm p-3 max-w-xl">
              <Info aria-hidden className="h-4 w-4 shrink-0 text-on-surface-variant mt-0.5" />
              <p className="text-xs text-on-surface-variant">
                <strong className="font-medium text-on-surface">Manual receipt — no PO.</strong>{' '}
                This form records stock received without a purchase order. The
                backend will call{' '}
                <span className="font-mono">inventoryService.checkEnablement()</span> on
                submit and reject unenabled products.
              </p>
            </div>
          </div>
        </section>

        {/* ── Section 2: Line items ─────────────────────────────────────── */}
        <SectionShift tone="low" className="mb-6" aria-hidden />
        <section aria-label="Line items" className="mb-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
              <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Line Items
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleAddLine}
              className="h-11 tablet:h-9 gap-1.5"
              aria-label="Add another line item"
            >
              <CirclePlus className="h-4 w-4" aria-hidden />
              Add item
            </Button>
          </div>

          {catalog.list.length === 0 && (
            <div className="rounded-md bg-surface-container-low p-6 flex flex-col items-center gap-2 text-center">
              <AlertCircle aria-hidden className="h-8 w-8 text-on-surface-variant" />
              <p className="text-sm text-on-surface-variant">
                No products found. Check the Product Master (SI-MDM-003).
              </p>
            </div>
          )}

          <div className="flex flex-col gap-6">
            {lines.map((line, idx) => {
              const product = catalog.byId(line.productId)
              const uomCode = uomCodeOf(line.uomId)
              const { received, usable, wastage, adjCostUnit } = computeYield(
                line.receivedQty,
                line.yieldFactor,
                line.unitCost,
              )
              const slState = line.shelfLifePass

              return (
                <div
                  key={line.id}
                  className="rounded-md bg-surface-container-low p-4 flex flex-col gap-4"
                >
                  {/* Line header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                        Line {idx + 1}
                      </span>
                      {product && (
                        <>
                          <span className="text-sm font-medium text-on-surface">{product.name}</span>
                          {product.sku && (
                            <span className="text-xs font-mono text-on-surface-variant">{product.sku}</span>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Shelf-life pill */}
                      {slState === true && (
                        <span className="inline-flex items-center gap-1 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-success">
                          <CheckCircle2 className="h-3 w-3" aria-hidden />
                          Shelf-life PASS
                        </span>
                      )}
                      {slState === false && (
                        <span className="inline-flex items-center gap-1 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-warning">
                          <AlertCircle className="h-3 w-3" aria-hidden />
                          EXCEPTION
                        </span>
                      )}
                      {lines.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveLine(line.id)}
                          className="h-9 w-9 p-0"
                          aria-label={`Remove line ${idx + 1}`}
                        >
                          <Trash2 className="h-4 w-4 text-on-surface-variant" aria-hidden />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Product selector */}
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor={`line-product-${line.id}`}
                      className="text-xs font-medium text-on-surface-variant"
                    >
                      Product <span aria-hidden className="text-error">*</span>
                    </label>
                    <select
                      id={`line-product-${line.id}`}
                      aria-label={`Line ${idx + 1} product`}
                      value={line.productId}
                      onChange={(e) => handleLineChange(line.id, 'productId', e.target.value)}
                      className={[
                        'h-11 rounded-md px-3 text-sm text-on-surface',
                        'bg-surface-container-lowest',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      ].join(' ')}
                    >
                      <option value="">Select product…</option>
                      {catalog.list.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.sku ? ` — ${p.sku}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Field grid */}
                  <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-4">

                    {/* Received qty — CCVoiceInput (CC-VOICE-INPUT) */}
                    <div className="flex flex-col gap-1 col-span-2 tablet:col-span-1">
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        Received Qty <span aria-hidden className="text-error">*</span>
                      </span>
                      <CCVoiceInput
                        value={line.receivedQty}
                        onChange={(v) => handleLineChange(line.id, 'receivedQty', v)}
                        unit={uomCode || undefined}
                        aria-label={`Received quantity for line ${idx + 1}`}
                        placeholder="0.00"
                      />
                    </div>

                    {/* Yield factor (FR27 pre-filled from catalog) */}
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`line-yield-${line.id}`}
                        className="text-[11px] text-on-surface-variant font-medium"
                      >
                        Yield Factor (FR27)
                      </label>
                      <Input
                        id={`line-yield-${line.id}`}
                        inputMode="decimal"
                        value={line.yieldFactor}
                        onChange={(e) => handleLineChange(line.id, 'yieldFactor', e.target.value)}
                        aria-label={`Yield factor for line ${idx + 1}`}
                        placeholder="0.00–1.00"
                      />
                    </div>

                    {/* Usable qty (computed, read-only) */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        Usable Qty
                      </span>
                      <div className="flex items-center gap-1 h-10 rounded-sm bg-surface-container-high px-3">
                        <span className="text-sm font-medium text-on-surface">
                          {received > 0 ? usable : '—'}
                        </span>
                        {received > 0 && uomCode && (
                          <span className="text-xs text-on-surface-variant ml-1">{uomCode}</span>
                        )}
                      </div>
                    </div>

                    {/* Wastage qty (computed, read-only) */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        Wastage Qty
                      </span>
                      <div className="flex items-center gap-1 h-10 rounded-sm bg-surface-container-high px-3">
                        <span className={`text-sm font-medium ${wastage > 0 ? 'text-warning' : 'text-on-surface'}`}>
                          {received > 0 ? wastage : '—'}
                        </span>
                        {received > 0 && wastage > 0 && uomCode && (
                          <span className="text-xs text-on-surface-variant ml-1">{uomCode}</span>
                        )}
                      </div>
                    </div>

                    {/* Unit cost (optional) */}
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`line-cost-${line.id}`}
                        className="text-[11px] text-on-surface-variant font-medium"
                      >
                        Unit Cost (optional)
                      </label>
                      <Input
                        id={`line-cost-${line.id}`}
                        inputMode="decimal"
                        value={line.unitCost}
                        onChange={(e) => handleLineChange(line.id, 'unitCost', e.target.value)}
                        aria-label={`Unit cost for line ${idx + 1}`}
                        placeholder="e.g. 120.00"
                      />
                    </div>

                    {/* Adj. cost / unit (computed, read-only) */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        Adj. Cost / Unit
                      </span>
                      <div className="flex items-center h-10 rounded-sm bg-surface-container-high px-3">
                        <span className="text-sm font-medium text-on-surface">
                          {adjCostUnit > 0 ? adjCostUnit.toFixed(2) : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Expiry date */}
                    <div className="flex flex-col gap-1 col-span-2 tablet:col-span-1">
                      <label
                        htmlFor={`line-expiry-${line.id}`}
                        className="text-[11px] text-on-surface-variant font-medium"
                      >
                        Expiry Date (optional)
                      </label>
                      <Input
                        id={`line-expiry-${line.id}`}
                        type="date"
                        value={line.expiryDate}
                        onChange={(e) => {
                          handleLineChange(line.id, 'expiryDate', e.target.value)
                          // Auto-evaluate shelf life: PASS if >3 days ahead
                          const entered = e.target.value
                          if (entered) {
                            const today = new Date()
                            today.setHours(0, 0, 0, 0)
                            const daysAhead =
                              (new Date(entered).getTime() - today.getTime()) / 86400000
                            handleLineChange(line.id, 'shelfLifePass', daysAhead >= 3)
                          } else {
                            handleLineChange(line.id, 'shelfLifePass', null)
                          }
                        }}
                        aria-label={`Expiry date for line ${idx + 1}`}
                      />
                    </div>

                    {/* Batch reference */}
                    <div className="flex flex-col gap-1 col-span-2 tablet:col-span-1">
                      <label
                        htmlFor={`line-batch-${line.id}`}
                        className="text-[11px] text-on-surface-variant font-medium"
                      >
                        Batch Ref (optional)
                      </label>
                      <Input
                        id={`line-batch-${line.id}`}
                        value={line.batchRef}
                        onChange={(e) => handleLineChange(line.id, 'batchRef', e.target.value)}
                        aria-label={`Batch reference for line ${idx + 1}`}
                        placeholder="e.g. BATCH-2026-001"
                      />
                    </div>
                  </div>

                  {/* Shelf-life manual toggle (for lines without an expiry date yet) */}
                  {slState === null && line.receivedQty && parseFloat(line.receivedQty) > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-on-surface-variant">
                        Shelf-life acceptance:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleShelfLifeToggle(line.id, true)}
                        className="inline-flex items-center gap-1 rounded-pill bg-surface-container-high px-2.5 py-1 text-[11px] font-medium text-on-surface hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <CheckCircle2 className="h-3 w-3 text-success" aria-hidden />
                        Mark PASS
                      </button>
                      <button
                        type="button"
                        onClick={() => handleShelfLifeToggle(line.id, false)}
                        className="inline-flex items-center gap-1 rounded-pill bg-surface-container-high px-2.5 py-1 text-[11px] font-medium text-on-surface hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <AlertCircle className="h-3 w-3 text-warning" aria-hidden />
                        Mark EXCEPTION
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Section 3: File attachments (FR39 — disabled) ─────────────── */}
        <SectionShift tone="low" className="mt-8 mb-6" aria-hidden />
        <section aria-label="Delivery documents" className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <PackageCheck className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Delivery Documents (FR39)
            </span>
          </div>
          <div
            title="Delivery-document attachments arrive with the Epic-3 files surface (not yet wired)"
            aria-label="Delivery document upload — not yet available"
          >
            <CCFileAttachUploader
              attachments={disabledAttachments}
              acceptedMimeTypes={['application/pdf', 'image/jpeg', 'image/png']}
              maxSizeBytes={5 * 1024 * 1024}
              onPickFile={() => {
                // Disabled — signed-URL upload surface wired in later Epic-3 task
              }}
              onRemove={() => {
                // No attachments to remove
              }}
              onRetry={() => {
                // No attachments to retry
              }}
            />
          </div>
          <p className="mt-2 text-xs text-on-surface-variant">
            Delivery-document attachments arrive with the Epic-3 files surface (not yet wired).
          </p>
        </section>

        {/* ── Section 4: Shelf-life exception notice ────────────────────── */}
        {hasShelfLifeException && pagePhase === 'draft' && (
          <div className="mb-6 flex items-start gap-3 rounded-md bg-surface-container p-4">
            <AlertCircle aria-hidden className="h-4 w-4 shrink-0 text-warning mt-0.5" />
            <p className="text-sm text-on-surface-variant">
              One or more lines have a shelf-life{' '}
              <span className="font-medium text-warning">EXCEPTION</span>. This is recorded
              for audit. No approval routing is required for goods receipts (display only).
            </p>
          </div>
        )}

        {/* ── Section 5: Actions ────────────────────────────────────────── */}
        <SectionShift tone="low" className="mb-6" aria-hidden />
        <section aria-label="Submit receipt" className="flex flex-col gap-4">

          {/* Submit gating hints */}
          {submitGated && pagePhase === 'draft' && (
            <div className="flex items-start gap-2">
              <Info aria-hidden className="h-3.5 w-3.5 shrink-0 text-on-surface-variant mt-0.5" />
              <p className="text-xs text-on-surface-variant">
                {!deptId
                  ? 'Select a destination department before submitting.'
                  : 'Enter a product and received quantity for at least one line.'}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-11 tablet:h-9"
              onClick={() => navigate(-1)}
              aria-label="Cancel and go back"
              disabled={pagePhase === 'recording' || pagePhase === 'confirming'}
            >
              Cancel
            </Button>
            <Button
              variant="tonal"
              size="sm"
              className="h-11 tablet:h-9"
              disabled={submitGated || isPending || pagePhase !== 'draft'}
              onClick={() => { void handleSubmit() }}
              aria-label="Submit goods receipt"
            >
              {pagePhase === 'recording'
                ? 'Recording…'
                : pagePhase === 'confirming'
                  ? 'Confirming…'
                  : 'Confirm Receipt'}
            </Button>
          </div>

          {/* Audit link */}
          <div className="flex justify-end">
            <AuditLink entityType="goods_receipts" />
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-on-surface-variant">
            SI-INV-010 · Tier 1 hero · Phase 4 Epic 4 Arc (c)
          </p>
          <p className="text-xs text-on-surface-variant">
            FR27 · FR39 · FR114 · FR115 · DL-049 · manual-entry divergence
          </p>
        </footer>
      </div>
    </div>
  )
}

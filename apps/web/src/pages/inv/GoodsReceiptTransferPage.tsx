import { useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Package,
  PackageCheck,
  Paperclip,
  Truck,
} from 'lucide-react'

import {
  AuditLink,
  Button,
  CCImplausibilityWarn,
  CCVoiceInput,
  DraftPill,
  Input,
  SectionShift,
  StatusPill,
  TrnDisplay,
} from '@/components/shell'

import { useInventoryDepartments, useInventoryProductCatalog } from '@/hooks/inv/useProductNames'
import {
  useRecordGoodsReceipt,
  useConfirmGoodsReceipt,
} from '@/hooks/inv/useGoodsReceipts'
import { useTransferList, useTransferDetail } from '@/hooks/inv/useStockTransfers'
import { ApiError } from '@/lib/api-client'
import type { InventoryDepartment } from '@/hooks/inv/schemas'

/**
 * SI-INV-011 — Goods Receipt Entry — Transfer-Driven production page.
 *
 * Tier 2 · Group 3 · Phase 4 Epic 4 Arc (c) Wave 3.
 *
 * Upstream entity is a stock transfer (in_transit or approved) rather than
 * a manual receipt or PO. Lines are pre-seeded from the dispatched transfer.
 *
 * FRs: FR114 (implausibility warn-and-log — |variance| > 20 % of dispatched),
 *      FR39 (attachments — static read-only placeholder pending Epic-3 surface).
 *
 * Key divergences from mockup (SI-INV-011 spec):
 *   1. Transfer picker (native <select>): useTransferList({ status: 'in_transit' });
 *      if that list is empty merged list includes 'approved' transfers too.
 *   2. Per-line variance reason is client-advisory only: gates submit, but is
 *      NOT forwarded to the backend (GR line input has no reasonCode field).
 *   3. CCImplausibilityWarn: gates submit; its override reason is only forwarded
 *      to confirmGoodsReceipt.reasonCode when recordGoodsReceipt returns warnings.
 *   4. File attachments rendered as a static read-only placeholder — the
 *      CCFileAttachUploader shell has no disabled prop; Epic-3 files surface
 *      brings real upload capability.
 *   5. Success: inline banner with grTrn — NEVER navigate to /approvals/inbox
 *      (GR has no approval seam).
 *
 * Submit flow:
 *   recordGoodsReceipt (with transferId) →
 *     if warnings → show banner + reason select → confirmGoodsReceipt({ grId, reasonCode }) →
 *     if no warnings → confirmGoodsReceipt immediately → success banner
 *
 * Route: /inventory/goods-receipts/transfer (RequireAuth only, DL-049 precedent).
 *
 * Animation: NONE per CLAUDE.md. Sole motion is CCVoiceInput's own guarded pulse.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Inline constants (NOT imported from inv-sample-data)
// ─────────────────────────────────────────────────────────────────────────────

/** 20 % variance threshold on transfer receipt (tighter than manual GR). */
const IMPLAUSIBILITY_THRESHOLD = 0.2

const IMPLAUSIBILITY_REASON_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'recount_confirmed', label: 'Recount confirmed — count is correct' },
  { value: 'recording_error', label: 'Recording error — correcting now' },
  { value: 'genuine_overage', label: 'Genuine overage — dispatched extra' },
  { value: 'transit_damage', label: 'Transit damage / shortfall' },
  { value: 'other', label: 'Other (add note)' },
]

const TRANSFER_REASON_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'shortfall_transit', label: 'Shortfall — damaged in transit' },
  { value: 'shortfall_pilferage', label: 'Shortfall — pilferage suspected' },
  { value: 'overage_extra_stock', label: 'Overage — extra stock dispatched' },
  { value: 'recount_corrected', label: 'Recount — count corrected' },
  { value: 'expiry_partial', label: 'Partial receipt — expiry issue' },
  { value: 'other', label: 'Other' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TrGRLineState {
  /** transfer line id */
  lineId: string
  productId: string
  dispatchedQty: number
  /** received qty: pre-filled from dispatched, editable via CCVoiceInput */
  receivedQty: string
  /** Carried-forward expiry from source batch; editable on exception */
  expiryDate: string
  /** Variance reason — mandatory when variance !== 0; client-advisory (NOT sent) */
  varianceReason: string | null
  implausibilitySelectedReason: string | null
  implausibilityOverridden: boolean
}

type PagePhase =
  | 'pick_transfer'        // no transfer selected
  | 'draft'               // transfer selected, form editing
  | 'recording'           // recordGoodsReceipt in flight
  | 'warnings_pending'    // server returned warnings — need reason before confirm
  | 'confirming'          // confirmGoodsReceipt in flight
  | 'success'             // done

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Derive a short location code from a department (mirrors StockTransferCreatePage). */
function deriveLocationCode(dept: InventoryDepartment | undefined): string {
  return (
    (dept?.code ?? dept?.name ?? 'GR')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 20)
      .toUpperCase()
  ) || 'GR'
}

function computeVariance(receivedQtyStr: string, dispatchedQty: number): number {
  const received = parseFloat(receivedQtyStr) || 0
  return Math.round((received - dispatchedQty) * 1000) / 1000
}

function isImplausible(receivedQtyStr: string, dispatchedQty: number): boolean {
  const variance = Math.abs(computeVariance(receivedQtyStr, dispatchedQty))
  const threshold = dispatchedQty * IMPLAUSIBILITY_THRESHOLD
  return variance > threshold && dispatchedQty > 0 && receivedQtyStr !== ''
}

function hasVariance(receivedQtyStr: string, dispatchedQty: number): boolean {
  return computeVariance(receivedQtyStr, dispatchedQty) !== 0 && receivedQtyStr !== ''
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toISOString().slice(0, 16).replace('T', ' ')
  } catch {
    return iso
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function GoodsReceiptTransferPage() {
  // ── ALL hooks ABOVE early returns ─────────────────────────────────────────

  const { data: depts, isLoading: deptsLoading } = useInventoryDepartments()
  const catalog = useInventoryProductCatalog()

  // Transfer picker lists — fetch both; merge if in_transit is empty
  const { data: inTransitList, isLoading: inTransitLoading } = useTransferList({ status: 'in_transit' })
  const { data: approvedList, isLoading: approvedLoading } = useTransferList({ status: 'approved' })

  const [selectedTransferId, setSelectedTransferId] = useState<string>('')

  // Transfer detail — only enabled once an id is chosen
  const { data: detail, isLoading: detailLoading } = useTransferDetail(selectedTransferId || undefined)

  const recordGR = useRecordGoodsReceipt()
  const confirmGR = useConfirmGoodsReceipt()

  // ── Local state ───────────────────────────────────────────────────────────

  const [lines, setLines] = useState<TrGRLineState[]>([])
  const [isDraft, setIsDraft] = useState(true)
  const [pagePhase, setPagePhase] = useState<PagePhase>('pick_transfer')

  const [recordedId, setRecordedId] = useState<string | null>(null)
  const [recordedTrn, setRecordedTrn] = useState<string | null>(null)
  const [serverWarnings, setServerWarnings] = useState<string[]>([])
  const [selectedWarnReason, setSelectedWarnReason] = useState<string>('')

  const [draftError, setDraftError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [successTrn, setSuccessTrn] = useState<string | null>(null)

  // ── Derived ───────────────────────────────────────────────────────────────

  const isLoading = deptsLoading || catalog.isLoading || inTransitLoading || approvedLoading

  /** Merged transfer options: prefer in_transit; include approved if in_transit is empty */
  const transferOptions = useMemo(() => {
    const inTransit = inTransitList ?? []
    const approved = approvedList ?? []
    return inTransit.length > 0 ? inTransit : [...inTransit, ...approved]
  }, [inTransitList, approvedList])

  const deptMap = useMemo(() => {
    const map = new Map((depts ?? []).map((d) => [d.id, d]))
    return map
  }, [depts])

  const sourceDept = useMemo(
    () => (detail ? deptMap.get(detail.sourceDepartmentId) : undefined),
    [detail, deptMap],
  )
  const destDept = useMemo(
    () => (detail ? deptMap.get(detail.destinationDepartmentId) : undefined),
    [detail, deptMap],
  )

  const hasUnoverriddenImplausibility = lines.some(
    (l) => isImplausible(l.receivedQty, l.dispatchedQty) && !l.implausibilityOverridden,
  )
  const hasMissingVarianceReason = lines.some(
    (l) => hasVariance(l.receivedQty, l.dispatchedQty) && l.varianceReason === null,
  )

  const submitGated =
    !selectedTransferId ||
    !detail ||
    lines.length === 0 ||
    lines.some((l) => !l.receivedQty || parseFloat(l.receivedQty) <= 0) ||
    hasUnoverriddenImplausibility ||
    hasMissingVarianceReason

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

  // NOTE: NO top-level full-page error guard. Data-load hooks do not surface an
  // error here. Mutation errors (record/confirm) render via inline banners that
  // keep the form intact.

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleTransferSelect(id: string) {
    setSelectedTransferId(id)
    setLines([]) // will be re-seeded via effect-free pattern below
    setPagePhase(id ? 'draft' : 'pick_transfer')
    setDraftError(null)
    setConfirmError(null)
  }

  /** Seed lines from freshly loaded detail (called when detail arrives or transfer changes). */
  function seedLinesFromDetail() {
    if (!detail) return
    const seeded: TrGRLineState[] = detail.lines.map((l) => ({
      lineId: l.id,
      productId: l.productId,
      dispatchedQty: l.fulfilledQty ?? l.requestedQty,
      receivedQty: String(l.fulfilledQty ?? l.requestedQty),
      expiryDate: '',
      varianceReason: null,
      implausibilitySelectedReason: null,
      implausibilityOverridden: false,
    }))
    setLines(seeded)
  }

  /** Called imperatively: seed lines when detail is ready and lines are stale. */
  if (detail && detail.id === selectedTransferId && lines.length === 0 && pagePhase === 'draft') {
    seedLinesFromDetail()
  }

  function updateLine<K extends keyof TrGRLineState>(
    lineId: string,
    field: K,
    value: TrGRLineState[K],
  ) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.lineId !== lineId) return l
        const updated: TrGRLineState = { ...l, [field]: value }
        if (field === 'receivedQty') {
          // Reset variance + implausibility state when qty changes
          return {
            ...updated,
            varianceReason: null,
            implausibilitySelectedReason: null,
            implausibilityOverridden: false,
          }
        }
        return updated
      }),
    )
  }

  function handleReset() {
    setSelectedTransferId('')
    setLines([])
    setIsDraft(true)
    setPagePhase('pick_transfer')
    setRecordedId(null)
    setRecordedTrn(null)
    setServerWarnings([])
    setSelectedWarnReason('')
    setConfirmError(null)
    setDraftError(null)
    setSuccessTrn(null)
    recordGR.reset()
    confirmGR.reset()
  }

  async function handleSubmit() {
    if (submitGated || !detail) return
    setPagePhase('recording')
    setIsDraft(false)
    setDraftError(null)
    setConfirmError(null)

    // Filter lines that have a product with a known UOM (guard per brief)
    const validLines = lines.filter(
      (l) => l.productId && parseFloat(l.receivedQty) > 0 && catalog.defaultUomOf(l.productId),
    )

    try {
      const rec = await recordGR.mutateAsync({
        destinationDepartmentId: detail.destinationDepartmentId,
        locationCode: deriveLocationCode(destDept),
        transferId: detail.id,
        lines: validLines.map((l) => ({
          productId: l.productId,
          receivedQty: parseFloat(l.receivedQty),
          uomId: catalog.defaultUomOf(l.productId)!,
          expiryDate: l.expiryDate || undefined,
        })),
      })

      if (rec.warnings.length > 0) {
        // FR114: server flagged implausibility — need reason before confirm
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
      // Surface record/confirm failure inline and KEEP the filled form.
      setPagePhase('draft')
      setIsDraft(true)
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Failed to submit goods receipt. Please check and retry.'
      setDraftError(msg)
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
              Inventory · Goods Receipt · Transfer-Driven
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Goods Receipt Entry — Transfer-Driven
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Record quantities received against a dispatched stock transfer; confirm each line and log any variance.
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
                Transfer receipt confirmed
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status="status_confirmed" size="sm" />
                <TrnDisplay trn={successTrn} />
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                Stock updated at destination. The transfer leg has been completed.
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
                  Implausibility flagged by server
                </span>
                <ul className="list-disc list-inside text-xs text-on-surface-variant space-y-0.5">
                  {serverWarnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>

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

        {/* ── Inline submit error (draft phase — record OR no-warnings confirm) ── */}
        {draftError && pagePhase === 'draft' && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-md bg-error-container p-4 text-on-error-container"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <p className="text-sm">{draftError}</p>
          </div>
        )}

        {/* ── Section 1: Transfer Picker ────────────────────────────────── */}
        <SectionShift tone="low" className="mb-6" aria-hidden />
        <section aria-label="Select stock transfer" className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Stock Transfer
            </span>
          </div>

          <div className="rounded-md bg-surface-container-low p-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 max-w-sm">
              <label
                htmlFor="transfer-picker"
                className="text-xs font-medium text-on-surface-variant"
              >
                Select a transfer to receive against{' '}
                <span aria-hidden className="text-error">*</span>
              </label>
              <select
                id="transfer-picker"
                aria-label="Stock transfer"
                value={selectedTransferId}
                onChange={(e) => handleTransferSelect(e.target.value)}
                className={[
                  'h-11 rounded-md px-3 text-sm text-on-surface',
                  'bg-surface-container-lowest',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                ].join(' ')}
              >
                <option value="">Select transfer…</option>
                {transferOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.stTrn} — {t.status.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              {transferOptions.length === 0 && (
                <p className="text-xs text-on-surface-variant">
                  No in-transit or approved transfers found.
                </p>
              )}
              {(inTransitList ?? []).length === 0 && (approvedList ?? []).length > 0 && (
                <p className="text-xs text-on-surface-variant">
                  No in-transit transfers found — showing approved transfers.
                </p>
              )}
            </div>

            {/* Transfer detail header card — only when detail is loaded */}
            {selectedTransferId && detailLoading && (
              <div role="status" aria-label="Loading transfer" className="flex flex-col gap-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-10 rounded-sm bg-surface-container-lowest animate-pulse" />
                ))}
              </div>
            )}

            {detail && detail.id === selectedTransferId && (
              <div className="rounded-sm bg-surface-container p-4 grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-3 desktop:gap-4">
                {/* Transfer TRN */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">Transfer Ref</span>
                  <TrnDisplay trn={detail.stTrn} />
                </div>

                {/* From dept */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">From</span>
                  <div className="flex items-start gap-1">
                    <MapPin className="h-3.5 w-3.5 text-on-surface-variant shrink-0 mt-0.5" aria-hidden />
                    <span className="text-sm text-on-surface">
                      {sourceDept?.name ?? detail.sourceDepartmentId}
                    </span>
                  </div>
                </div>

                {/* To dept */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">To</span>
                  <div className="flex items-start gap-1">
                    <ArrowRight className="h-3.5 w-3.5 text-on-surface-variant shrink-0 mt-0.5" aria-hidden />
                    <span className="text-sm text-on-surface">
                      {destDept?.name ?? detail.destinationDepartmentId}
                    </span>
                  </div>
                </div>

                {/* Requested at */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">Requested At</span>
                  <div className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5 text-on-surface-variant shrink-0" aria-hidden />
                    <span className="text-sm text-on-surface">{fmtDateTime(detail.requestedAt)}</span>
                  </div>
                </div>

                {/* Status + line count */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">Status / Lines</span>
                  <div className="flex items-center gap-2">
                    <StatusPill status="status_in_progress" size="sm" />
                    <span className="text-xs text-on-surface-variant">
                      {detail.lines.length} line{detail.lines.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Pick-a-transfer prompt when nothing selected */}
            {!selectedTransferId && (
              <div className="flex items-start gap-2 bg-surface-container rounded-sm p-3 max-w-xl">
                <Truck aria-hidden className="h-4 w-4 shrink-0 text-on-surface-variant mt-0.5" />
                <p className="text-xs text-on-surface-variant">
                  Select a transfer above to load its dispatched lines and record receipt quantities.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ── Section 2: Per-line receipt (only when detail loaded) ─────── */}
        {detail && detail.id === selectedTransferId && lines.length > 0 && (
          <>
            <SectionShift tone="low" className="mb-6" aria-hidden />
            <section aria-label="Line items" className="mb-2">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Line Items
                </span>
              </div>

              <div className="flex flex-col gap-6">
                {lines.map((line, idx) => {
                  const productName = catalog.nameOf(line.productId)
                  const uomId = catalog.defaultUomOf(line.productId)
                  const hasUom = Boolean(uomId)
                  const implausible = isImplausible(line.receivedQty, line.dispatchedQty)
                  const variance = computeVariance(line.receivedQty, line.dispatchedQty)
                  const hasVar = hasVariance(line.receivedQty, line.dispatchedQty)

                  return (
                    <div
                      key={line.lineId}
                      className="rounded-md bg-surface-container-low p-4 flex flex-col gap-4"
                    >
                      {/* Line header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                            Line {idx + 1}
                          </span>
                          <span className="text-sm font-medium text-on-surface">
                            {productName}
                          </span>
                          {!hasUom && (
                            <span className="text-xs text-warning">
                              No catalog UOM — line will be skipped on submit
                            </span>
                          )}
                        </div>

                        {/* Variance indicator pill */}
                        {hasVar && (
                          <div className="shrink-0">
                            <span
                              className={[
                                'inline-flex items-center gap-1 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium',
                                variance < 0 ? 'text-warning' : 'text-tertiary',
                              ].join(' ')}
                            >
                              <AlertCircle className="h-3 w-3" aria-hidden />
                              {variance > 0 ? '+' : ''}{variance}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Field grid */}
                      <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-4">

                        {/* Dispatched qty (read-only) */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] text-on-surface-variant font-medium">
                            Dispatched Qty
                          </span>
                          <div className="flex items-center gap-1 h-10 rounded-sm bg-surface-container-high px-3">
                            <span className="text-sm font-medium text-on-surface">
                              {line.dispatchedQty}
                            </span>
                          </div>
                        </div>

                        {/* Received qty — CCVoiceInput (CC-VOICE-INPUT, CC-PREFILL) */}
                        <div className="flex flex-col gap-1 col-span-2 tablet:col-span-1">
                          <span className="text-[11px] text-on-surface-variant font-medium">
                            Received Qty <span aria-hidden className="text-error">*</span>
                          </span>
                          <CCVoiceInput
                            value={line.receivedQty}
                            onChange={(v) => updateLine(line.lineId, 'receivedQty', v)}
                            aria-label={`Received quantity for ${productName} (line ${idx + 1})`}
                            placeholder="0.00"
                          />
                        </div>

                        {/* Variance (computed, read-only) */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] text-on-surface-variant font-medium">
                            Variance
                          </span>
                          <div className="flex items-center gap-1 h-10 rounded-sm bg-surface-container-high px-3">
                            {line.receivedQty !== '' ? (
                              <span
                                className={[
                                  'text-sm font-medium',
                                  variance < 0
                                    ? 'text-warning'
                                    : variance > 0
                                      ? 'text-tertiary'
                                      : 'text-on-surface',
                                ].join(' ')}
                              >
                                {variance > 0 ? '+' : ''}{variance}
                              </span>
                            ) : (
                              <span className="text-sm text-on-surface-variant">—</span>
                            )}
                          </div>
                        </div>

                        {/* Expiry date — carried forward from source batch, editable */}
                        <div className="flex flex-col gap-1 col-span-2 tablet:col-span-1">
                          <label
                            htmlFor={`expiry-${line.lineId}`}
                            className="text-[11px] text-on-surface-variant font-medium"
                          >
                            Expiry Date (optional)
                          </label>
                          <Input
                            id={`expiry-${line.lineId}`}
                            type="date"
                            value={line.expiryDate}
                            onChange={(e) => updateLine(line.lineId, 'expiryDate', e.target.value)}
                            aria-label={`Expiry date for ${productName} (line ${idx + 1})`}
                          />
                        </div>

                        {/* Variance reason — mandatory when variance !== 0; client-advisory only */}
                        {hasVar && (
                          <div className="flex flex-col gap-1 col-span-2 desktop:col-span-2">
                            <label
                              htmlFor={`var-reason-${line.lineId}`}
                              className="text-[11px] text-on-surface-variant font-medium"
                            >
                              Variance Reason <span aria-hidden className="text-error">*</span>{' '}
                              <span className="font-normal">(advisory — not stored)</span>
                            </label>
                            <select
                              id={`var-reason-${line.lineId}`}
                              aria-label={`Variance reason for ${productName}`}
                              value={line.varianceReason ?? ''}
                              onChange={(e) =>
                                updateLine(line.lineId, 'varianceReason', e.target.value || null)
                              }
                              className={[
                                'h-11 rounded-md px-3 text-sm text-on-surface',
                                'bg-surface-container-lowest',
                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                              ].join(' ')}
                            >
                              <option value="">Select reason…</option>
                              {TRANSFER_REASON_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* CCImplausibilityWarn (CC-IMPLAUSIBILITY-WARN / FR114) */}
                      {implausible && (
                        <CCImplausibilityWarn
                          message={`Received qty (${parseFloat(line.receivedQty) || 0}) deviates by more than ${Math.round(IMPLAUSIBILITY_THRESHOLD * 100)}% from dispatched qty (${line.dispatchedQty}). Select a reason to override.`}
                          reasonCodes={IMPLAUSIBILITY_REASON_OPTIONS}
                          selectedReason={line.implausibilitySelectedReason}
                          onSelectReason={(reason) =>
                            updateLine(line.lineId, 'implausibilitySelectedReason', reason)
                          }
                          onOverride={() =>
                            updateLine(line.lineId, 'implausibilityOverridden', true)
                          }
                          overridden={line.implausibilityOverridden}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        )}

        {/* ── Section 3: File attachments (FR39 — static read-only placeholder) ── */}
        {/* CCFileAttachUploader has no `disabled` prop; rather than render an
            inert-but-clickable picker, we show a genuinely static placeholder. */}
        <SectionShift tone="low" className="mt-8 mb-6" aria-hidden />
        <section aria-label="Damage / shortfall evidence" className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <PackageCheck className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Damage / Shortfall Evidence
            </span>
          </div>
          <div
            className="flex items-start gap-3 rounded-md bg-surface-container-lowest p-4 text-sm text-on-surface-variant"
            title="Attachments arrive with the Epic-3 files surface (not yet wired)"
          >
            <Paperclip className="h-4 w-4 shrink-0 text-on-surface-variant mt-0.5" aria-hidden />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-on-surface">Attachments (not yet available)</span>
              <span>
                Damage/shortfall evidence arrives with the Epic-3 files surface.
              </span>
            </div>
          </div>
        </section>

        {/* ── Section 4: Submit gating hints + actions ──────────────────── */}
        <SectionShift tone="low" className="mb-6" aria-hidden />
        <section aria-label="Submit receipt" className="flex flex-col gap-4">

          {pagePhase === 'draft' && selectedTransferId && (
            <div className="flex flex-col gap-1">
              {hasUnoverriddenImplausibility && (
                <p className="text-xs text-warning flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Override all implausibility warnings before submitting.
                </p>
              )}
              {hasMissingVarianceReason && !hasUnoverriddenImplausibility && (
                <p className="text-xs text-warning flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Select a variance reason for all lines with quantity differences.
                </p>
              )}
              {lines.some((l) => !catalog.defaultUomOf(l.productId)) && (
                <p className="text-xs text-on-surface-variant flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Lines with no catalog UOM will be skipped on submit.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-11 tablet:h-9"
              onClick={handleReset}
              aria-label="Cancel and reset"
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
              aria-label="Confirm transfer receipt"
            >
              {pagePhase === 'recording'
                ? 'Recording…'
                : pagePhase === 'confirming'
                  ? 'Confirming…'
                  : 'Confirm Transfer Receipt'}
            </Button>
          </div>

          {/* Audit link */}
          <div className="flex justify-end">
            <AuditLink entityType="goods_receipts" />
          </div>
        </section>

      </div>
    </div>
  )
}

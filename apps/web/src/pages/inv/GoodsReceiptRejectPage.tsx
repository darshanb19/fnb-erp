import { useMemo, useState } from 'react'
import {
  AlertCircle,
  CalendarDays,
  ClipboardList,
  FileWarning,
  Package,
  Paperclip,
  Receipt,
  XCircle,
} from 'lucide-react'

import {
  AuditLink,
  Button,
  DraftPill,
  SectionShift,
  StatusPill,
  TrnDisplay,
} from '@/components/shell'

import { useInventoryDepartments, useInventoryProductCatalog } from '@/hooks/inv/useProductNames'
import {
  useGoodsReceipts,
  useGoodsReceiptDetail,
  useRejectGoodsReceipt,
} from '@/hooks/inv/useGoodsReceipts'
import { ApiError } from '@/lib/api-client'

/**
 * SI-INV-012 — Goods Receipt Rejection at QC (Tier 1 hero).
 *
 * Tier 1 · Group 3 · Phase 4 Epic 4 Arc (c) Wave 3.
 *
 * FRs: FR47a (GR rejection with reason codes), FR47b (auto-drafted vendor CN — deferred
 *      to Epic 5, static copy only).
 *
 * SI-INV-012 divergences from mockup:
 *   1. Draft-GR picker (native <select>): useGoodsReceipts({ status: 'draft' }).
 *      Pre-selection prompt when none chosen — NOT an eternal skeleton.
 *   2. GR header sourced from useGoodsReceiptDetail: GR TRN via TrnDisplay,
 *      destination dept NAME (map via useInventoryDepartments), received-at, status.
 *      NO vendor/PO/GSTIN fields (no PO backend) — absent fields render —.
 *   3. Per GR line: item name from useInventoryProductCatalog().nameOf(productId),
 *      received qty (line.receivedQty), per-line rejection reason (native <select>).
 *      NO consumed/unconsumed columns (FR65 has no backing field — dropped).
 *   4. VCN preview: STATIC explanatory copy only — "A vendor credit note will be
 *      auto-drafted in Epic 5 (vcnDeferred)." NO fabricated AP-reduction rupee
 *      figure, NO PO-closure metric.
 *   5. QC evidence: optional free-text note (evidence arg). File attachments rendered
 *      as a static read-only placeholder — same treatment as sibling GR pages.
 *   6. Mutation (reject) error rendered via INLINE banner that keeps the form.
 *      NEVER a top-level full-page error guard.
 *   7. ALL hooks above early returns.
 *
 * Route: /inventory/goods-receipts/reject (RequireAuth only, DL-049 precedent).
 *
 * Animation: NONE per CLAUDE.md.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical per-line rejection reason codes (FR47a). */
const REJECTION_REASON_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'shelf_life', label: 'Shelf life' },
  { value: 'quality', label: 'Quality' },
  { value: 'quantity_mismatch', label: 'Quantity mismatch' },
  { value: 'damage', label: 'Damage' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SubmitState = 'idle' | 'pending' | 'rejected'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string | null | undefined): string {
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

export default function GoodsReceiptRejectPage() {
  // ── ALL hooks ABOVE early returns ─────────────────────────────────────────

  const { data: draftGRs, isLoading: draftGRsLoading } = useGoodsReceipts({ status: 'draft' })
  const { data: depts, isLoading: deptsLoading } = useInventoryDepartments()
  const catalog = useInventoryProductCatalog()

  const [selectedGrId, setSelectedGrId] = useState<string>('')

  // useGoodsReceiptDetail called unconditionally (enabled-gated internally)
  const { data: detail, isLoading: detailLoading } = useGoodsReceiptDetail(
    selectedGrId || undefined,
  )

  const { mutateAsync: rejectGr, isPending: isRejecting } = useRejectGoodsReceipt()

  // ── Local state ───────────────────────────────────────────────────────────

  /** Per-line rejection reason — one entry per GR line, indexed by line index. */
  const [lineReasons, setLineReasons] = useState<string[]>([])
  const [evidenceNote, setEvidenceNote] = useState<string>('')
  const [isDraft, setIsDraft] = useState(true)
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [rejectError, setRejectError] = useState<string | null>(null)

  // ── Derived ───────────────────────────────────────────────────────────────

  const isLoading = draftGRsLoading || deptsLoading || catalog.isLoading

  const deptMap = useMemo(
    () => new Map((depts ?? []).map((d) => [d.id, d])),
    [depts],
  )

  const destDeptName = useMemo(() => {
    if (!detail) return null
    const dept = deptMap.get(detail.destinationDepartmentId)
    return dept?.name ?? detail.destinationDepartmentId
  }, [detail, deptMap])

  /** Seed lineReasons when detail changes (e.g. picker selection changes). */
  const lineCount = detail?.lines.length ?? 0

  // Imperatively reset reasons when the selected GR changes
  if (
    detail &&
    detail.id === selectedGrId &&
    lineReasons.length !== detail.lines.length
  ) {
    setLineReasons(Array(detail.lines.length).fill(''))
  }

  /** All lines must have a rejection reason before submit. */
  const allLinesHaveReason =
    lineCount > 0 && lineReasons.length === lineCount && lineReasons.every((r) => r !== '')

  const submitEnabled =
    Boolean(selectedGrId) &&
    Boolean(detail) &&
    allLinesHaveReason &&
    submitState === 'idle' &&
    !isRejecting

  // ── Loading guard (only data-load hooks trigger this, NOT mutation errors) ─

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

  // NOTE: NO top-level full-page error guard. Mutation errors (reject) render
  // via inline banners that keep the form intact.

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleGrSelect(id: string) {
    setSelectedGrId(id)
    setLineReasons([])
    setEvidenceNote('')
    setSubmitState('idle')
    setRejectError(null)
    setIsDraft(true)
  }

  function updateLineReason(idx: number, reason: string) {
    setLineReasons((prev) => {
      const next = [...prev]
      next[idx] = reason
      return next
    })
  }

  async function handleConfirmRejection() {
    if (!submitEnabled || !detail) return
    setSubmitState('pending')
    setIsDraft(false)
    setRejectError(null)

    try {
      await rejectGr({
        grId: detail.id,
        reasons: lineReasons.filter(Boolean),
        evidence: evidenceNote || undefined,
      })
      setSubmitState('rejected')
    } catch (err) {
      // Surface rejection failure inline — KEEP the filled form
      setSubmitState('idle')
      setIsDraft(true)
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Failed to reject goods receipt. The GR may not be in draft status.'
      setRejectError(msg)
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
              Inventory · Goods Receipt · QC Rejection
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Goods Receipt Rejection at QC
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Record a formal QC rejection of a draft goods receipt with mandatory per-line
              reason codes and optional evidence note.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <DraftPill isDraft={isDraft} mobileEyebrow />
          </div>
        </header>

        {/* ── Rejection success banner ──────────────────────────────────── */}
        {submitState === 'rejected' && detail && (
          <section
            role="alert"
            aria-live="polite"
            className="mb-6 flex items-start gap-3 rounded-md bg-surface-container p-4"
          >
            <XCircle className="h-5 w-5 shrink-0 text-error mt-0.5" aria-hidden />
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <span className="text-sm font-medium text-on-surface">GR Rejected at QC</span>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status="status_gr_rejected" size="sm" />
                <TrnDisplay trn={detail.grTrn} />
              </div>
              <p className="text-xs text-on-surface-variant mt-1">
                Rejection recorded. A vendor credit note will be auto-drafted later in the Procurement module.
              </p>
            </div>
            <div className="shrink-0">
              <AuditLink entityType="goods_receipts" entityRef={detail.grTrn} />
            </div>
          </section>
        )}

        {/* ── Inline reject error (keeps form intact) ───────────────────── */}
        {rejectError && submitState === 'idle' && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-md bg-error-container p-4 text-on-error-container"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <p className="text-sm">{rejectError}</p>
          </div>
        )}

        {/* ── Section 1: Draft GR Picker ────────────────────────────────── */}
        <SectionShift tone="low" className="mb-6" aria-hidden />
        <section aria-label="Select draft goods receipt" className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Draft Goods Receipt
            </span>
          </div>

          <div className="rounded-md bg-surface-container-low p-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1.5 max-w-sm">
              <label
                htmlFor="gr-picker"
                className="text-xs font-medium text-on-surface-variant"
              >
                Select a draft goods receipt to reject{' '}
                <span aria-hidden className="text-error">*</span>
              </label>
              <select
                id="gr-picker"
                aria-label="Draft goods receipt"
                value={selectedGrId}
                onChange={(e) => handleGrSelect(e.target.value)}
                className={[
                  'h-11 rounded-md px-3 text-sm text-on-surface',
                  'bg-surface-container-lowest',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                ].join(' ')}
              >
                <option value="">Select draft GR…</option>
                {(draftGRs ?? []).map((gr) => (
                  <option key={gr.id} value={gr.id}>
                    {gr.grTrn} — {gr.status.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              {(draftGRs ?? []).length === 0 && (
                <p className="text-xs text-on-surface-variant">
                  No draft goods receipts found.
                </p>
              )}
            </div>

            {/* Pre-selection prompt */}
            {!selectedGrId && (
              <div className="flex items-start gap-2 bg-surface-container rounded-sm p-3 max-w-xl">
                <ClipboardList aria-hidden className="h-4 w-4 shrink-0 text-on-surface-variant mt-0.5" />
                <p className="text-xs text-on-surface-variant">
                  Pick a draft goods receipt above to load its lines and record rejection reasons.
                </p>
              </div>
            )}

            {/* Detail loading skeleton */}
            {selectedGrId && detailLoading && (
              <div role="status" aria-label="Loading goods receipt" className="flex flex-col gap-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-10 rounded-sm bg-surface-container-lowest animate-pulse" />
                ))}
              </div>
            )}

            {/* GR header card — only when detail is loaded */}
            {detail && detail.id === selectedGrId && (
              <div className="rounded-sm bg-surface-container p-4 grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-4 desktop:gap-4">
                {/* GR TRN */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">
                    GR Reference
                  </span>
                  <TrnDisplay trn={detail.grTrn} />
                </div>

                {/* Destination dept */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">
                    Destination Dept
                  </span>
                  <span className="text-sm text-on-surface">
                    {destDeptName ?? '—'}
                  </span>
                </div>

                {/* Received at */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">
                    Received At
                  </span>
                  <div className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5 text-on-surface-variant shrink-0" aria-hidden />
                    <span className="text-sm text-on-surface">
                      {fmtDateTime(detail.receivedAt)}
                    </span>
                  </div>
                </div>

                {/* Status */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">
                    Status
                  </span>
                  <StatusPill status="status_draft" size="sm" />
                </div>

                {/* Lines count */}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">
                    Lines
                  </span>
                  <span className="text-sm text-on-surface">
                    {detail.lines.length} line{detail.lines.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Section 2: Per-line rejection reasons ─────────────────────── */}
        {detail && detail.id === selectedGrId && detail.lines.length > 0 && (
          <>
            <SectionShift tone="low" className="mb-6" aria-hidden />
            <section aria-label="Line rejection reasons" className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Line Items — Rejection Reasons
                </span>
              </div>

              <div className="flex flex-col gap-4">
                {detail.lines.map((line, idx) => {
                  const productName = catalog.nameOf(line.productId)
                  const reason = lineReasons[idx] ?? ''
                  const hasReason = reason !== ''

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
                          <span className="text-sm font-medium text-on-surface">
                            {productName}
                          </span>
                        </div>

                        {/* Reason status pip */}
                        {hasReason ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-error shrink-0">
                            <Receipt className="h-3 w-3" aria-hidden />
                            {REJECTION_REASON_OPTIONS.find((r) => r.value === reason)?.label ?? reason}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface-variant shrink-0">
                            <AlertCircle className="h-3 w-3" aria-hidden />
                            Reason required
                          </span>
                        )}
                      </div>

                      {/* Qty + reason grid */}
                      <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3">
                        {/* Received qty (read-only) */}
                        <div className="flex flex-col gap-1">
                          <span className="text-[11px] text-on-surface-variant font-medium">
                            Received Qty
                          </span>
                          <div className="flex items-center gap-1 h-10 rounded-sm bg-surface-container-high px-3">
                            <span className="text-sm font-medium text-on-surface">
                              {line.receivedQty}
                            </span>
                          </div>
                        </div>

                        {/* Rejection reason select */}
                        <div className="flex flex-col gap-1 col-span-2 tablet:col-span-2">
                          <label
                            htmlFor={`reject-reason-${line.id}`}
                            className="text-[11px] text-on-surface-variant font-medium"
                          >
                            Rejection Reason{' '}
                            <span aria-hidden className="text-error">*</span>
                          </label>
                          <select
                            id={`reject-reason-${line.id}`}
                            aria-label={`Rejection reason for ${productName} (line ${idx + 1})`}
                            aria-required
                            value={reason}
                            onChange={(e) => updateLineReason(idx, e.target.value)}
                            className={[
                              'h-11 rounded-md px-3 text-sm text-on-surface',
                              'bg-surface-container-lowest',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            ].join(' ')}
                          >
                            <option value="">Select reason…</option>
                            {REJECTION_REASON_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        )}

        {/* ── Section 3: QC Evidence (free-text note + static attachment placeholder) */}
        {detail && detail.id === selectedGrId && (
          <>
            <SectionShift tone="low" className="mb-6" aria-hidden />
            <section aria-label="QC evidence" className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <FileWarning className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  QC Evidence
                </span>
              </div>

              {/* Optional evidence note */}
              <div className="flex flex-col gap-1.5 mb-4">
                <label
                  htmlFor="evidence-note"
                  className="text-xs font-medium text-on-surface-variant"
                >
                  Evidence note (optional)
                </label>
                <textarea
                  id="evidence-note"
                  aria-label="QC evidence note"
                  value={evidenceNote}
                  onChange={(e) => setEvidenceNote(e.target.value)}
                  rows={3}
                  placeholder="Describe the QC finding, e.g. 'All units found expired on arrival…'"
                  className={[
                    'rounded-md px-3 py-2 text-sm text-on-surface resize-none',
                    'bg-surface-container-lowest',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    'placeholder:text-on-surface-variant',
                  ].join(' ')}
                />
              </div>

              {/* Static attachment placeholder — CCFileAttachUploader has no disabled prop;
                  rather than render an inert-but-clickable picker, we show a genuinely
                  static placeholder. QC evidence attachments arrive with the Epic-3
                  files surface. */}
              <div
                className="flex items-start gap-3 rounded-md bg-surface-container-lowest p-4 text-sm text-on-surface-variant"
                title="QC evidence attachments arrive with the Epic-3 files surface (not yet wired)"
              >
                <Paperclip className="h-4 w-4 shrink-0 text-on-surface-variant mt-0.5" aria-hidden />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium text-on-surface">
                    Photo &amp; lab-report attachments (not yet available)
                  </span>
                  <span>
                    QC evidence attachments arrive with the Epic-3 files surface.
                  </span>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ── Section 4: Vendor CN — static deferred copy only ──────────── */}
        {detail && detail.id === selectedGrId && (
          <>
            <SectionShift tone="low" className="mb-6" aria-hidden />
            <section aria-label="Vendor credit note" className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Receipt className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Vendor Credit Note
                </span>
              </div>

              <div className="rounded-md bg-surface-container p-4 flex flex-col gap-3">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-high px-3 py-1 self-start">
                  <AlertCircle className="h-3.5 w-3.5 text-on-surface-variant shrink-0" aria-hidden />
                  <span className="text-[11px] font-medium text-on-surface-variant">
                    Not yet available
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant">
                  A vendor credit note will be auto-drafted later in the Procurement module. A payables
                  clerk will review and formally issue it. No AP-reduction
                  figure is computed at this stage.
                </p>
              </div>
            </section>
          </>
        )}

        {/* ── Section 5: Actions ────────────────────────────────────────── */}
        <SectionShift tone="low" className="mb-6" aria-hidden />
        <section aria-label="Confirm rejection" className="flex flex-col gap-4">

          {/* Validation hint */}
          {selectedGrId && detail && !allLinesHaveReason && submitState === 'idle' && (
            <p className="text-xs text-warning flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              All line items require a rejection reason before confirming.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-11 tablet:h-9"
              onClick={() => handleGrSelect('')}
              aria-label="Cancel rejection and reset"
              disabled={isRejecting}
            >
              Cancel
            </Button>

            <Button
              variant="tonal"
              size="sm"
              className="h-11 tablet:h-9"
              disabled={!submitEnabled || isRejecting}
              onClick={() => { void handleConfirmRejection() }}
              aria-label="Confirm QC rejection"
            >
              {isRejecting ? (
                'Rejecting…'
              ) : submitState === 'rejected' ? (
                'Rejection Recorded'
              ) : (
                <>
                  <XCircle className="h-4 w-4 shrink-0" aria-hidden />
                  Confirm Rejection
                </>
              )}
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

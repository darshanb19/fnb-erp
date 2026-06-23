/**
 * SI-INV-012 — Goods Receipt Rejection at QC.
 *
 * Tier 1 · Group 3 · Phase 4 Epic 4 Arc (b) W3.
 *
 * FRs: FR47a (GR rejection with reason codes), FR47b (auto-drafted vendor CN),
 *      FR65 (consumed-portion Pending-GR override), FR67a (COGS→Wastage
 *      reclassification when Pending-GR linked GR is rejected).
 *
 * CC-patterns consumed:
 *   - CC-DRAFT-PILL       — DraftPill isDraft mobileEyebrow (unsaved rejection).
 *   - CC-TRN-DISPLAY      — TrnDisplay on GR TRN + VCN draft TRN.
 *   - CC-FILE-ATTACH      — CCFileAttachUploader (QC evidence photos/lab reports).
 *   - CC-AUDIT-LINK       — AuditLink (entityRef = GR TRN).
 *
 * Sections:
 *   1. Source GR header (GR TRN, source PO TRN, vendor, received-by, received-at).
 *   2. Per-line rejection table (item, received qty, consumed-portion,
 *      unconsumed-portion, per-line rejection reason Select).
 *   3. Evidence attachments (CCFileAttachUploader).
 *   4. Auto-drafted vendor-CN preview card (Epic 5 stub, visual only).
 *   5. PO-closure preview ("PO will move to Closed — GR Rejected").
 *   6. FR67a Pending-GR reclassification warning callout.
 *   7. Confirm rejection / Cancel actions.
 *
 * Fixture: picks first `confirmed` GR from goodsReceipts (derived from
 *   closed POs in purchaseOrders). Deterministic; no Date.now/Math.random.
 *
 * Status tokens: status_draft (pre-submission), status_gr_rejected (post).
 * Error banner uses error_container/text-error.
 *
 * Animation — NONE. CLAUDE.md animation policy bans entrance animations on
 * inventory/transaction screens.
 */

import { useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  FileWarning,
  Package,
  Receipt,
  ShieldAlert,
  XCircle,
} from 'lucide-react'

import {
  AuditLink,
  Button,
  CCFileAttachUploader,
  DraftPill,
  SectionShift,
  StatusPill,
  TrnDisplay,
} from '@/shell'
import type { IssueAttachment } from '@/shell'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  goodsReceipts,
  purchaseOrders,
  vendors,
  materials,
  locations,
  NOW,
  formatINR,
} from '@/lib/sample-data'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical per-line rejection reason codes (FR47a). */
const REJECTION_REASON_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'shelf_life', label: 'Shelf Life / Expiry' },
  { value: 'quality', label: 'Quality Substandard' },
  { value: 'quantity_mismatch', label: 'Quantity Mismatch' },
  { value: 'damage', label: 'Physical Damage' },
]

// ─────────────────────────────────────────────────────────────────────────────
// Demo fixture selection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pick the first confirmed GR for rejection demo.
 * confirmed GRs derive from closed POs in the fixture set.
 */
const DEMO_GR = goodsReceipts.find((gr) => gr.status === 'confirmed') ?? goodsReceipts[0]!

const DEMO_PO = purchaseOrders.find((po) => po.id === DEMO_GR.po_id) ?? purchaseOrders[0]!

const DEMO_VENDOR = vendors.find((v) => v.id === DEMO_GR.vendor_id) ?? vendors[0]!

const DEMO_LOCATION = locations.find((l) => l.id === DEMO_GR.location_id)

/**
 * VCN draft TRN — format VCN-YYYY-LOC-####.
 * Deterministic: derived from GR id + location.
 */
const VCN_DRAFT_TRN = (() => {
  const locPart = (DEMO_LOCATION?.name ?? DEMO_GR.location_id)
    .split(/[\s\-_]+/)
    .filter((w) => w.length > 2)
    .slice(-1)[0]
    ?.slice(0, 3)
    .toUpperCase() ?? 'LOC'
  // seq from GR id last 4 chars
  const seq = DEMO_GR.id.replace(/\D/g, '').padStart(4, '0').slice(-4)
  return `VCN-2026-${locPart}-${seq}`
})()

/**
 * AP reduction value — sum of all line received_qty × unit_price from PO lines.
 * Visual only; Epic 5 will compute the real value.
 */
const AP_REDUCTION_VALUE = DEMO_PO.lines.reduce((sum, l) => {
  const grLine = DEMO_GR.lines.find((gl) => gl.material_id === l.material_id)
  const qty = grLine?.received_qty ?? l.qty
  return sum + qty * l.unit_price
}, 0)

/**
 * Pre-seeded QC evidence attachment (FR47a demo — one uploaded file).
 */
const SEED_ATTACHMENTS: IssueAttachment[] = [
  {
    id: 'att-qc-001',
    filename: `QC_Photo_${DEMO_GR.gr_number}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 214528,
    uploadedAt: `${NOW}T09:15:00+05:30`,
    uploadedByLabel: 'QC Inspector (Bandra)',
    state: 'uploaded',
    downloadUrl: '#',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LineRejectionState {
  lineKey: string
  materialId: string
  receivedQty: number
  uom: string
  /** FR65 — portion already consumed/issued under Pending-GR override. */
  consumedPortion: number
  /** Unconsumed = received − consumed. */
  unconsumedPortion: number
  rejectionReason: string
}

type SubmitState = 'idle' | 'rejected'

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiInv012() {
  // ── Initial line states from DEMO_GR ──────────────────────────────────────
  const initialLines: LineRejectionState[] = DEMO_GR.lines.map((gl, idx) => {
    // FR65 — consumed portion is a small deterministic fraction (5–15 %)
    const consumedPct = ((idx + 1) * 7) % 16 // 7, 14, 7, 14... %
    const consumed = Math.round(gl.received_qty * (consumedPct / 100) * 100) / 100
    const unconsumed = Math.round((gl.received_qty - consumed) * 100) / 100
    return {
      lineKey: `line-${idx}`,
      materialId: gl.material_id,
      receivedQty: gl.received_qty,
      uom: gl.uom,
      consumedPortion: consumed,
      unconsumedPortion: unconsumed,
      rejectionReason: '',
    }
  })

  const [lines, setLines] = useState<LineRejectionState[]>(initialLines)
  const [isDraft, setIsDraft] = useState(true)
  const [attachments, setAttachments] = useState<IssueAttachment[]>(SEED_ATTACHMENTS)
  const [submitState, setSubmitState] = useState<SubmitState>('idle')

  // ── Derived ───────────────────────────────────────────────────────────────

  /** All lines must have a rejection reason before submit. */
  const allLinesHaveReason = lines.every((l) => l.rejectionReason !== '')

  // ── Handlers ──────────────────────────────────────────────────────────────

  function updateLineReason(key: string, reason: string) {
    setLines((prev) =>
      prev.map((l) => (l.lineKey === key ? { ...l, rejectionReason: reason } : l)),
    )
  }

  function handleConfirmRejection() {
    if (!allLinesHaveReason) return
    setIsDraft(false)
    setSubmitState('rejected')
  }

  function handleRemoveAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">

        {/* ── Page header ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 mb-6 tablet:mb-8">
          {/* Eyebrow */}
          <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Inventory · Goods Receipt · QC Rejection
          </p>

          {/* Title row */}
          <div className="flex flex-col gap-2 tablet:flex-row tablet:items-start tablet:justify-between">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl tablet:text-[2rem] font-bold text-on-surface leading-tight">
                Goods Receipt Rejection at QC
              </h1>
              <p className="text-sm text-on-surface-variant">
                Record a formal QC rejection of a goods receipt with mandatory reason codes,
                evidence attachments, and an auto-drafted vendor credit-note preview.
              </p>
            </div>

            {/* Draft pill — mobileEyebrow per CC-DRAFT-PILL */}
            <div className="shrink-0">
              <DraftPill isDraft={isDraft} mobileEyebrow />
            </div>
          </div>

          {/* Rejection submitted banner */}
          {submitState === 'rejected' && (
            <div
              role="status"
              className="flex items-start gap-3 rounded-sm bg-error-container px-4 py-3"
            >
              <XCircle className="h-5 w-5 shrink-0 text-error mt-0.5" aria-hidden />
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                <span className="text-sm font-medium text-error">GR Rejected at QC</span>
                <span className="text-xs text-on-surface-variant">
                  Rejection recorded.{' '}
                  <StatusPill
                    status="status_gr_rejected"
                    size="sm"
                    className="inline-flex align-middle"
                  />
                  {' '}Vendor CN drafted — pending Epic 5 issuance.
                </span>
              </div>
              <AuditLink entityRef={DEMO_GR.trn} className="shrink-0" />
            </div>
          )}
        </div>

        {/* ── Section 1: Source GR Header ───────────────────────────────── */}
        <SectionShift tone="low" className="mb-6" aria-hidden />

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Source Goods Receipt
            </span>
          </div>

          <div className="rounded-sm bg-surface-container p-4 flex flex-col gap-4">
            {/* GR identity row */}
            <div className="flex flex-col gap-3 tablet:grid tablet:grid-cols-2 desktop:grid-cols-4 desktop:gap-4">
              {/* GR Number + TRN */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">
                  GR Number
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-on-surface">{DEMO_GR.gr_number}</span>
                  <TrnDisplay trn={DEMO_GR.trn} />
                </div>
              </div>

              {/* Source PO TRN */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">
                  Source PO
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-on-surface">{DEMO_PO.po_number}</span>
                  <TrnDisplay trn={DEMO_PO.trn} />
                </div>
              </div>

              {/* Vendor */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">
                  Vendor
                </span>
                <span className="text-sm font-medium text-on-surface">{DEMO_VENDOR.name}</span>
                {DEMO_VENDOR.gstin && (
                  <span className="text-[11px] font-mono text-on-surface-variant">
                    GSTIN {DEMO_VENDOR.gstin}
                  </span>
                )}
              </div>

              {/* Received on */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">
                  Received On
                </span>
                <div className="flex items-center gap-1">
                  <CalendarDays className="h-3.5 w-3.5 text-on-surface-variant shrink-0" aria-hidden />
                  <span className="text-sm text-on-surface">{DEMO_GR.received_on}</span>
                </div>
              </div>
            </div>

            {/* Secondary row */}
            <div className="flex flex-col gap-3 tablet:grid tablet:grid-cols-2 desktop:grid-cols-4 desktop:gap-4">
              {/* Received by */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">
                  Received By
                </span>
                <span className="text-sm text-on-surface">Store Keeper (QC)</span>
              </div>

              {/* Location */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">
                  Location
                </span>
                <span className="text-sm text-on-surface">{DEMO_LOCATION?.name ?? DEMO_GR.location_id}</span>
              </div>

              {/* GR status */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">
                  Current Status
                </span>
                <StatusPill status="status_confirmed" size="sm" />
              </div>

              {/* Lines count */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">
                  Lines
                </span>
                <span className="text-sm text-on-surface">
                  {DEMO_GR.lines.length} line{DEMO_GR.lines.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Section 2: Per-line rejection reasons ─────────────────────── */}
        <SectionShift tone="low" className="mb-6" aria-hidden />

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Line Items — Rejection Reasons
            </span>
          </div>

          <p className="text-xs text-on-surface-variant mb-4">
            Each line requires a rejection reason code. The unconsumed portion will be returned
            to the vendor; the consumed portion (FR65 Pending-GR override) is noted for
            COGS→Wastage reclassification (FR67a).
          </p>

          <div className="flex flex-col gap-4">
            {lines.map((line, idx) => {
              const mat = materials.find((m) => m.id === line.materialId)
              const hasReason = line.rejectionReason !== ''

              return (
                <div
                  key={line.lineKey}
                  className="rounded-sm bg-surface-container-low p-4 flex flex-col gap-4"
                >
                  {/* Line header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                        Line {idx + 1}
                      </span>
                      <span className="text-sm font-medium text-on-surface">
                        {mat?.name ?? line.materialId}
                      </span>
                      <span className="text-xs text-on-surface-variant">{mat?.category}</span>
                    </div>

                    {/* Reason status pip */}
                    {hasReason ? (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-error shrink-0">
                        <Receipt className="h-3 w-3" aria-hidden />
                        {REJECTION_REASON_OPTIONS.find((r) => r.value === line.rejectionReason)?.label ?? line.rejectionReason}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface-variant shrink-0">
                        <AlertCircle className="h-3 w-3" aria-hidden />
                        Reason required
                      </span>
                    )}
                  </div>

                  {/* Qty breakdown grid */}
                  <div className="grid grid-cols-2 gap-3 tablet:grid-cols-4">
                    {/* Received qty */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        Received Qty
                      </span>
                      <div className="flex items-center gap-1 h-10 rounded-sm bg-surface-container-high px-3">
                        <span className="text-sm font-medium text-on-surface">
                          {line.receivedQty}
                        </span>
                        <span className="text-xs text-on-surface-variant ml-1">{line.uom}</span>
                      </div>
                    </div>

                    {/* Consumed portion (FR65 Pending-GR override) */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        Consumed (FR65)
                      </span>
                      <div className="flex items-center gap-1 h-10 rounded-sm bg-surface-container-high px-3">
                        <span className="text-sm font-medium text-warning">
                          {line.consumedPortion}
                        </span>
                        <span className="text-xs text-on-surface-variant ml-1">{line.uom}</span>
                      </div>
                    </div>

                    {/* Unconsumed portion */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        Unconsumed (Return)
                      </span>
                      <div className="flex items-center gap-1 h-10 rounded-sm bg-surface-container-high px-3">
                        <span className="text-sm font-medium text-on-surface">
                          {line.unconsumedPortion}
                        </span>
                        <span className="text-xs text-on-surface-variant ml-1">{line.uom}</span>
                      </div>
                    </div>

                    {/* Rejection reason Select */}
                    <div className="flex flex-col gap-1 col-span-2 tablet:col-span-1">
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        Rejection Reason · required
                      </span>
                      <Select
                        value={line.rejectionReason}
                        onValueChange={(v) => updateLineReason(line.lineKey, v)}
                      >
                        <SelectTrigger
                          aria-label={`Rejection reason for ${mat?.name ?? line.materialId}`}
                          aria-required
                        >
                          <SelectValue placeholder="Select reason…" />
                        </SelectTrigger>
                        <SelectContent>
                          {REJECTION_REASON_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Section 3: Evidence attachments ───────────────────────────── */}
        <SectionShift tone="low" className="mb-6" aria-hidden />

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FileWarning className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              QC Evidence (Photos / Lab Reports)
            </span>
          </div>

          <CCFileAttachUploader
            attachments={attachments}
            acceptedMimeTypes={['application/pdf', 'image/jpeg', 'image/png']}
            maxSizeBytes={10 * 1024 * 1024}
            onPickFile={() => {
              // §11 comment: file-picker triggers browser file dialog — visual-chrome-only
            }}
            onRemove={handleRemoveAttachment}
            onRetry={(id) => {
              // §11 comment: retry logic is service-side — visual-chrome-only
              void id
            }}
          />
        </div>

        {/* ── Section 4: Auto-drafted vendor-CN preview (Epic 5 stub) ──── */}
        <SectionShift tone="low" className="mb-6" aria-hidden />

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Vendor Credit Note — Auto-Draft Preview
            </span>
          </div>

          <div className="rounded-sm bg-surface-container p-4 flex flex-col gap-4">
            {/* Epic 5 stub badge */}
            <div className="inline-flex items-center gap-1.5 rounded-pill bg-surface-container-high px-3 py-1 self-start">
              <AlertCircle className="h-3.5 w-3.5 text-on-surface-variant shrink-0" aria-hidden />
              <span className="text-[11px] font-medium text-on-surface-variant">
                Draft — Epic 5 will issue
              </span>
            </div>

            <div className="flex flex-col gap-3 tablet:grid tablet:grid-cols-2 desktop:grid-cols-4 desktop:gap-4">
              {/* VCN draft TRN */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">
                  VCN Draft TRN
                </span>
                <TrnDisplay trn={VCN_DRAFT_TRN} />
              </div>

              {/* AP Reduction value */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">
                  AP Reduction (est.)
                </span>
                <span className="text-sm font-semibold text-on-surface">
                  {formatINR(AP_REDUCTION_VALUE)}
                </span>
              </div>

              {/* GR ref */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">
                  GR Reference
                </span>
                <span className="text-sm text-on-surface">{DEMO_GR.gr_number}</span>
              </div>

              {/* PO ref */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">
                  PO Reference
                </span>
                <span className="text-sm text-on-surface">{DEMO_PO.po_number}</span>
              </div>
            </div>

            <p className="text-xs text-on-surface-variant">
              This vendor CN draft is auto-generated from the rejection. A payables clerk
              will review and formally issue it in Epic 5 (Procurement module). The
              estimated AP reduction above is based on full delivered value and may be
              revised during issuance.
            </p>
          </div>
        </div>

        {/* ── Section 5: PO-closure preview ─────────────────────────────── */}
        <SectionShift tone="low" className="mb-6" aria-hidden />

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              PO Status Impact
            </span>
          </div>

          <div className="rounded-sm bg-surface-container p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-on-surface">
                    {DEMO_PO.po_number}
                  </span>
                  <TrnDisplay trn={DEMO_PO.trn} copyable={false} />
                </div>
                <span className="text-xs text-on-surface-variant">
                  {DEMO_VENDOR.name} · {DEMO_PO.lines.length} line{DEMO_PO.lines.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-[11px] text-on-surface-variant">After rejection:</span>
                <StatusPill status="status_gr_rejected" size="sm" />
              </div>
            </div>

            <p className="text-xs text-on-surface-variant">
              Upon confirming this QC rejection, the linked PO will move to{' '}
              <strong className="font-medium text-on-surface">Closed — GR Rejected</strong>.
              No further goods receipts can be raised against this PO. A new PO will be
              required if re-order is intended.
            </p>
          </div>
        </div>

        {/* ── Section 6: FR67a Pending-GR reclassification warning ──────── */}
        <SectionShift tone="low" className="mb-6" aria-hidden />

        <div className="mb-6">
          <div
            role="alert"
            className="rounded-sm bg-surface-container p-4 flex flex-col gap-3"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 shrink-0 text-warning mt-0.5" aria-hidden />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-on-surface">
                  FR67a — Pending-GR Cost Reclassification
                </span>
                <p className="text-xs text-on-surface-variant">
                  Portions of this GR were consumed under a Pending-GR provisional cost
                  override (FR65). Rejecting this GR will trigger an automatic
                  reclassification:
                </p>
              </div>
            </div>

            <ul className="flex flex-col gap-1.5 ml-8">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-warning" aria-hidden />
                <span className="text-xs text-on-surface">
                  <strong className="font-medium">Consumed portion ({lines.reduce((s, l) => s + l.consumedPortion, 0).toFixed(2)} units):</strong>{' '}
                  COGS → Wastage reclassification will be journaled (Epic 10 stub).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-warning" aria-hidden />
                <span className="text-xs text-on-surface">
                  <strong className="font-medium">Unconsumed portion ({lines.reduce((s, l) => s + l.unconsumedPortion, 0).toFixed(2)} units):</strong>{' '}
                  Stock reversal will be applied upon vendor return confirmation.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-on-surface-variant" aria-hidden />
                <span className="text-xs text-on-surface-variant">
                  Any recipe cost cards derived from this GR's provisional LKP will update
                  to reflect the wastage reclassification. Production orders linked under
                  DL-001 Pending-GR are unaffected for completed orders; open orders will
                  re-cost on next save.
                </span>
              </li>
            </ul>

            <p className="text-[11px] text-on-surface-variant ml-8">
              Linked PO consumed value reclassifies COGS → Wastage per FR67a.
              Journal entries will be created by the accounting engine (Epic 10).
            </p>
          </div>
        </div>

        {/* ── Section 7: Actions ────────────────────────────────────────── */}
        <SectionShift tone="low" className="mb-6" aria-hidden />

        <div className="flex flex-col gap-3">
          {/* Validation hint */}
          {!allLinesHaveReason && submitState === 'idle' && (
            <p className="text-xs text-warning flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
              All line items require a rejection reason before confirming.
            </p>
          )}

          <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between">
            {/* Cancel / back link */}
            <Button
              variant="ghost"
              size="lg"
              onClick={() => {
                // §11 comment: navigate back to GR entry — visual-chrome-only
              }}
              aria-label="Cancel rejection and return to goods receipt"
            >
              Cancel
            </Button>

            <div className="flex items-center gap-3">
              {/* Audit link */}
              <AuditLink entityRef={DEMO_GR.trn} label="GR audit history" />

              {/* Confirm rejection CTA */}
              <Button
                variant="default"
                size="lg"
                disabled={!allLinesHaveReason || submitState !== 'idle'}
                onClick={handleConfirmRejection}
                aria-label="Confirm QC rejection"
              >
                {submitState === 'idle' ? (
                  <>
                    <XCircle className="h-4 w-4 shrink-0" aria-hidden />
                    Confirm Rejection
                  </>
                ) : (
                  'Rejection Recorded'
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <SectionShift tone="high" className="mt-10" aria-hidden />
        <p className="mt-4 text-[11px] text-on-surface-variant">
          SI-INV-012 · Tier 1 · Group 3 · Phase 4 Epic 4 Arc (b)
        </p>
      </div>
    </div>
  )
}

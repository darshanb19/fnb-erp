/**
 * SI-INV-011 — Goods Receipt Entry — Transfer-Driven.
 *
 * Tier 2 · Group 3 · Phase 4 Epic 4 Arc (b) W3.
 * Sibling of SI-INV-010 (PO-driven GR) — mirrors its chrome and a11y patterns.
 * Upstream entity is a stock transfer (in_transit) rather than a PO.
 *
 * FRs: FR114 (implausibility warn-and-log — variance beyond tolerance),
 *      FR39 (attachments — damage / shortfall photos).
 *
 * CC-patterns consumed:
 *   - CC-DRAFT-PILL        — DraftPill isDraft mobileEyebrow (unsaved form).
 *   - CC-TRN-DISPLAY       — TrnDisplay on transfer header.
 *   - CC-VOICE-INPUT       — CCVoiceInput for every per-line received qty
 *                            (CC-PREFILL: pre-filled from dispatched qty).
 *   - CC-IMPLAUSIBILITY-WARN — CCImplausibilityWarn when |variance| > tolerance
 *                              (FR114); mandatory reason Select when variance > 0.
 *   - CC-FILE-ATTACH       — CCFileAttachUploader (FR39).
 *   - CC-AUDIT-LINK        — AuditLink (entityRef = GR TRN or transfer id).
 *
 * Reused chrome: page wrapper, header eyebrow + h1, SectionShift footer,
 *   canonical footer line.
 *
 * NOT present (vs SI-INV-010): yield factor, usable/wastage, adjusted cost,
 *   shelf-life PASS/EXCEPTION pill, CCDuplicateWarn.
 *
 * Variance math (per line):
 *   variance = received − dispatched
 *   implausible when |variance| > dispatched * IMPLAUSIBILITY_THRESHOLD
 *
 * Submit flow:
 *   Confirms transfer-leg receipt → transfer visual status → Received.
 *   Submit visually blocked until all implausible lines are overridden
 *   AND all lines with variance > 0 have a reason selected.
 *
 * Demo fixture: transfers[3] — st-004 (in_transit, Tandoor → Andheri Kitchen,
 *   dispatched by Kiran Reddy). Source batch: stockBatches for each line's
 *   sourceBatchId.
 *
 * Animation — NONE. CLAUDE.md animation policy bans entrance animations on
 * inventory/transaction screens.
 */

import { useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Info,
  MapPin,
  Package,
  PackageCheck,
  Truck,
  User,
} from 'lucide-react'

import {
  AuditLink,
  Button,
  CCFileAttachUploader,
  CCImplausibilityWarn,
  CCVoiceInput,
  DraftPill,
  Input,
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

import { materials, departments, locations, NOW } from '@/lib/sample-data'
import {
  transfers,
  stockBatches,
  IMPLAUSIBILITY_REASON_OPTIONS,
  TRANSFER_REASON_OPTIONS,
} from '@/lib/inv-sample-data'

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Implausibility threshold: |variance| > dispatched * THRESHOLD triggers warn.
 * 20 % deviation on a transfer is the tolerance window (tighter than PO).
 */
const IMPLAUSIBILITY_THRESHOLD = 0.2

/** Simulated voice-heard values per material (deterministic). */
const SIMULATED_HEARD: Record<string, string> = {
  'mat-ghee': '3',
  'mat-chicken': '5',
  'mat-paneer': '8',
  'mat-basmati-rice': '10',
  'mat-onion': '8',
  'mat-cream': '2',
  'mat-mutton': '4',
  'mat-atta': '10',
  'mat-milk': '5',
  'mat-turmeric': '1',
  'mat-garam-masala': '1',
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo fixture selection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pick the first in_transit transfer for the GR demo.
 * Falls back to the first transfer if none is in_transit.
 */
const DEMO_TRANSFER = (() => {
  const inTransit = transfers.find((t) => t.status === 'in_transit')
  return inTransit ?? transfers[0]!
})()

/** Resolve source department label. */
function deptLabel(deptId: string): string {
  const dept = departments.find((d) => d.id === deptId)
  if (!dept) return deptId
  const loc = locations.find((l) => l.id === dept.location_id)
  return loc ? `${dept.name} · ${loc.name}` : dept.name
}

/** Resolve destination department label. */
function destDeptLabel(deptId: string): string {
  const dept = departments.find((d) => d.id === deptId)
  if (!dept) return deptId
  const loc = locations.find((l) => l.id === dept.location_id)
  return loc ? `${dept.name} · ${loc.name}` : dept.name
}

/** Friendly date/time display from ISO string. */
function fmtDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toISOString().slice(0, 16).replace('T', ' ')
  } catch {
    return iso
  }
}

/** Resolve reason code label from TRANSFER_REASON_OPTIONS. */
function reasonLabel(code: string | null): string {
  if (!code) return '—'
  const opt = TRANSFER_REASON_OPTIONS.find((r) => r.value === code)
  return opt ? opt.label : code
}

/** Pre-seeded attachment (FR39 demo — one damage photo uploaded). */
const SEED_ATTACHMENTS: IssueAttachment[] = [
  {
    id: 'att-tr-gr-001',
    filename: `Transfer_${DEMO_TRANSFER.stTrn}_DeliveryNote.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 94200,
    uploadedAt: `${NOW}T09:15:00+05:30`,
    uploadedByLabel: 'Store Keeper (Andheri)',
    state: 'uploaded',
    downloadUrl: '#',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TrGRLineState {
  /** Stable key — matches index in DEMO_TRANSFER.lines. */
  lineKey: string
  materialId: string
  dispatchedQty: number
  uom: string
  sourceBatchId: string
  /** Carried-forward expiry from source batch; editable on exception. */
  sourceExpiry: string
  /** CC-PREFILL: pre-filled from dispatchedQty. */
  receivedQty: string
  /** Mandatory when variance !== 0. */
  varianceReason: string | null
  implausibilitySelectedReason: string | null
  implausibilityOverridden: boolean
}

type SubmitState = 'idle' | 'confirmed'

// ─────────────────────────────────────────────────────────────────────────────
// Derived-field helpers
// ─────────────────────────────────────────────────────────────────────────────

function computeVariance(line: TrGRLineState): number {
  const received = parseFloat(line.receivedQty) || 0
  return Math.round((received - line.dispatchedQty) * 1000) / 1000
}

function isImplausible(line: TrGRLineState): boolean {
  const variance = Math.abs(computeVariance(line))
  const threshold = line.dispatchedQty * IMPLAUSIBILITY_THRESHOLD
  return variance > threshold && line.dispatchedQty > 0
}

function hasVariance(line: TrGRLineState): boolean {
  return computeVariance(line) !== 0 && line.receivedQty !== ''
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiInv011() {
  // ── Initial line states from DEMO_TRANSFER ────────────────────────────────

  const initialLines = useMemo<TrGRLineState[]>(() =>
    DEMO_TRANSFER.lines.map((l, idx) => {
      const srcBatch = stockBatches.find((b) => b.id === l.sourceBatchId)
      return {
        lineKey: `tr-line-${idx}`,
        materialId: l.materialId,
        dispatchedQty: l.fulfilledQty ?? l.requestedQty,
        uom: l.uom,
        sourceBatchId: l.sourceBatchId,
        sourceExpiry: srcBatch?.expiryDate ?? '',
        // CC-PREFILL: pre-fill received qty from dispatched qty
        receivedQty: String(l.fulfilledQty ?? l.requestedQty),
        varianceReason: null,
        implausibilitySelectedReason: null,
        implausibilityOverridden: false,
      }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [lines, setLines] = useState<TrGRLineState[]>(initialLines)
  const [isDraft, setIsDraft] = useState(true)
  const [attachments, setAttachments] = useState<IssueAttachment[]>(SEED_ATTACHMENTS)
  const [submitState, setSubmitState] = useState<SubmitState>('idle')

  // ── Derived ───────────────────────────────────────────────────────────────

  /** Any implausible, unoverridden line blocks submit. */
  const hasUnoverriddenImplausibility = lines.some(
    (l) => isImplausible(l) && !l.implausibilityOverridden,
  )

  /** Any line with variance and no reason selected blocks submit. */
  const hasMissingVarianceReason = lines.some(
    (l) => hasVariance(l) && l.varianceReason === null,
  )

  const submitBlocked = submitState !== 'idle' || hasUnoverriddenImplausibility || hasMissingVarianceReason

  /** GR TRN for AuditLink (deterministic — not Date.now). */
  const grTrn = `TRN-TR-GR-DRAFT-${DEMO_TRANSFER.stTrn.slice(-4)}`

  // ── Handlers ──────────────────────────────────────────────────────────────

  function updateLine<K extends keyof TrGRLineState>(
    key: string,
    field: K,
    value: TrGRLineState[K],
  ) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.lineKey !== key) return l
        const updated: TrGRLineState = { ...l, [field]: value }
        // Reset implausibility + variance reason when received qty changes
        if (field === 'receivedQty') {
          return {
            ...updated,
            implausibilitySelectedReason: null,
            implausibilityOverridden: false,
            varianceReason: null,
          }
        }
        return updated
      }),
    )
  }

  function handleImplausibilityReason(key: string, reason: string) {
    updateLine(key, 'implausibilitySelectedReason', reason)
  }

  function handleImplausibilityOverride(key: string) {
    updateLine(key, 'implausibilityOverridden', true)
  }

  function handleSubmit() {
    if (submitBlocked) return
    setIsDraft(false)
    setSubmitState('confirmed')
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
            Inventory · Goods Receipt
          </p>

          {/* Title row */}
          <div className="flex flex-col gap-2 tablet:flex-row tablet:items-start tablet:justify-between">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl tablet:text-[2rem] font-bold text-on-surface leading-tight">
                Goods Receipt Entry — Transfer-Driven
              </h1>
              <p className="text-sm text-on-surface-variant">
                Record quantities received against a dispatched stock transfer; confirm each line and log any variance.
              </p>
            </div>

            {/* Draft pill — mobileEyebrow per CC-DRAFT-PILL */}
            <div className="shrink-0">
              <DraftPill isDraft={isDraft} mobileEyebrow />
            </div>
          </div>

          {/* Submission feedback banner */}
          {submitState === 'confirmed' && (
            <div className="flex items-center gap-2 rounded-sm bg-surface-container px-4 py-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-on-surface">Transfer receipt confirmed</span>
                <span className="text-xs text-on-surface-variant">
                  Stock updated at destination.{' '}
                  <StatusPill status="status_completed" size="sm" className="inline-flex align-middle" />
                </span>
              </div>
              <AuditLink entityRef={grTrn} className="ml-auto" />
            </div>
          )}
        </div>

        {/* ── Section 1: Transfer Header ────────────────────────────────── */}
        <SectionShift tone="low" className="mb-6" aria-hidden />

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Stock Transfer
            </span>
          </div>

          <div className="rounded-sm bg-surface-container p-4 flex flex-col gap-3 tablet:grid tablet:grid-cols-2 desktop:grid-cols-3 desktop:gap-4">
            {/* Transfer TRN */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">Transfer Ref</span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-on-surface">{DEMO_TRANSFER.stTrn}</span>
                <TrnDisplay trn={DEMO_TRANSFER.stTrn} />
              </div>
            </div>

            {/* Source dept / location */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">From</span>
              <div className="flex items-start gap-1">
                <MapPin className="h-3.5 w-3.5 text-on-surface-variant shrink-0 mt-0.5" aria-hidden />
                <span className="text-sm text-on-surface">
                  {deptLabel(DEMO_TRANSFER.sourceDepartmentId)}
                </span>
              </div>
            </div>

            {/* Destination dept */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">To</span>
              <div className="flex items-start gap-1">
                <ArrowRight className="h-3.5 w-3.5 text-on-surface-variant shrink-0 mt-0.5" aria-hidden />
                <span className="text-sm text-on-surface">
                  {destDeptLabel(DEMO_TRANSFER.destinationDepartmentId)}
                </span>
              </div>
            </div>

            {/* Dispatched by */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">Dispatched By</span>
              <div className="flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-on-surface-variant shrink-0" aria-hidden />
                <span className="text-sm text-on-surface">{DEMO_TRANSFER.requestedBy}</span>
              </div>
            </div>

            {/* Dispatched at */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">Dispatched At</span>
              <div className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5 text-on-surface-variant shrink-0" aria-hidden />
                <span className="text-sm text-on-surface">
                  {fmtDateTime(DEMO_TRANSFER.requestedAt)}
                </span>
              </div>
            </div>

            {/* Status / lines count */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">Status / Lines</span>
              <div className="flex items-center gap-2">
                <StatusPill status="status_in_progress" size="sm" />
                <span className="text-xs text-on-surface-variant">
                  {DEMO_TRANSFER.lines.length} line{DEMO_TRANSFER.lines.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Reason */}
            {DEMO_TRANSFER.reasonCode && (
              <div className="flex flex-col gap-0.5 col-span-full desktop:col-span-1">
                <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">Reason</span>
                <span className="text-sm text-on-surface">{reasonLabel(DEMO_TRANSFER.reasonCode)}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Section 2: Per-line receipt ───────────────────────────────── */}
        <SectionShift tone="low" className="mb-6" aria-hidden />

        <div className="mb-2">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Line Items
            </span>
          </div>

          <div className="flex flex-col gap-6">
            {lines.map((line, idx) => {
              const mat = materials.find((m) => m.id === line.materialId)
              const srcBatch = stockBatches.find((b) => b.id === line.sourceBatchId)
              const implausible = isImplausible(line)
              const variance = computeVariance(line)
              const hasVar = hasVariance(line)
              const heardValue = SIMULATED_HEARD[line.materialId] ?? String(line.dispatchedQty)
              const received = parseFloat(line.receivedQty) || 0

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

                    {/* Variance indicator pill (shown once qty is entered and variance present) */}
                    {hasVar && line.receivedQty !== '' && (
                      <div className="shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium ${
                            variance < 0 ? 'text-warning' : 'text-tertiary'
                          }`}
                        >
                          <Info className="h-3 w-3" aria-hidden />
                          {variance > 0 ? '+' : ''}{variance} {line.uom}
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
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium text-on-surface">
                          {line.dispatchedQty}
                        </span>
                        <span className="text-xs text-on-surface-variant">{line.uom}</span>
                      </div>
                    </div>

                    {/* Source batch ref (read-only) */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        Source Batch
                      </span>
                      <span className="text-sm text-on-surface">
                        {srcBatch?.batchNumber ?? line.sourceBatchId}
                      </span>
                    </div>

                    {/* Received qty — CCVoiceInput (CC-VOICE-INPUT, CC-PREFILL) */}
                    <div className="flex flex-col gap-1 col-span-2 tablet:col-span-1">
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        Received Qty · required
                      </span>
                      <CCVoiceInput
                        value={line.receivedQty}
                        onChange={(v) => updateLine(line.lineKey, 'receivedQty', v)}
                        unit={line.uom}
                        aria-label={`Received quantity for ${mat?.name ?? line.materialId}`}
                        simulatedHeardValue={heardValue}
                        placeholder="0.00"
                      />
                    </div>

                    {/* Variance (computed, read-only) */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        Variance
                      </span>
                      <div className="flex items-center gap-1 h-10 rounded-sm bg-surface-container-high px-3">
                        {received > 0 ? (
                          <>
                            <span
                              className={`text-sm font-medium ${
                                variance < 0
                                  ? 'text-warning'
                                  : variance > 0
                                    ? 'text-tertiary'
                                    : 'text-on-surface'
                              }`}
                            >
                              {variance > 0 ? '+' : ''}{variance}
                            </span>
                            <span className="text-xs text-on-surface-variant ml-1">{line.uom}</span>
                          </>
                        ) : (
                          <span className="text-sm text-on-surface-variant">—</span>
                        )}
                      </div>
                    </div>

                    {/* Source expiry — carried forward, editable on exception */}
                    <div className="flex flex-col gap-1 col-span-2 tablet:col-span-1">
                      <label className="text-[11px] text-on-surface-variant font-medium">
                        Source Expiry (edit if exception)
                      </label>
                      <Input
                        type="date"
                        value={line.sourceExpiry}
                        onChange={(e) => updateLine(line.lineKey, 'sourceExpiry', e.target.value)}
                        aria-label={`Source expiry date for ${mat?.name ?? line.materialId}`}
                      />
                    </div>

                    {/* Variance reason — mandatory when variance !== 0 */}
                    {hasVar && (
                      <div className="flex flex-col gap-1 col-span-2 desktop:col-span-2">
                        <span className="text-[11px] text-on-surface-variant font-medium">
                          Variance Reason · required
                        </span>
                        <Select
                          value={line.varianceReason ?? ''}
                          onValueChange={(v) => updateLine(line.lineKey, 'varianceReason', v)}
                        >
                          <SelectTrigger
                            aria-label={`Variance reason for ${mat?.name ?? line.materialId}`}
                          >
                            <SelectValue placeholder="Select a reason…" />
                          </SelectTrigger>
                          <SelectContent>
                            {IMPLAUSIBILITY_REASON_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* CCImplausibilityWarn (CC-IMPLAUSIBILITY-WARN / FR114) */}
                  {implausible && (
                    <CCImplausibilityWarn
                      message={`Received qty (${received} ${line.uom}) deviates by more than ${Math.round(IMPLAUSIBILITY_THRESHOLD * 100)} % from dispatched qty (${line.dispatchedQty} ${line.uom}). Select a reason to override.`}
                      reasonCodes={IMPLAUSIBILITY_REASON_OPTIONS}
                      selectedReason={line.implausibilitySelectedReason}
                      onSelectReason={(reason) =>
                        handleImplausibilityReason(line.lineKey, reason)
                      }
                      onOverride={() => handleImplausibilityOverride(line.lineKey)}
                      overridden={line.implausibilityOverridden}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Section 3: File attachments (CC-FILE-ATTACH / FR39) ───────── */}
        <SectionShift tone="low" className="mt-8 mb-6" aria-hidden />

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <PackageCheck className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Damage / Shortfall Evidence (FR39)
            </span>
          </div>

          <CCFileAttachUploader
            attachments={attachments}
            acceptedMimeTypes={['application/pdf', 'image/jpeg', 'image/png']}
            maxSizeBytes={5 * 1024 * 1024}
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

        {/* ── Section 4: Actions ────────────────────────────────────────── */}
        <SectionShift tone="low" className="mb-6" aria-hidden />

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 tablet:flex-row tablet:items-center tablet:justify-between">
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
            </div>

            <Button
              variant="default"
              size="lg"
              disabled={submitBlocked}
              onClick={handleSubmit}
              aria-label="Confirm transfer receipt"
            >
              {submitState === 'idle' ? 'Confirm Transfer Receipt' : 'Confirmed'}
            </Button>
          </div>

          {/* Audit link */}
          <div className="flex justify-end">
            <AuditLink entityRef={DEMO_TRANSFER.id} label="Transfer audit history" />
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <SectionShift tone="high" className="mt-10" aria-hidden />
        <p className="mt-4 text-[11px] text-on-surface-variant">
          SI-INV-011 · Tier 2 · Phase 4 Epic 4 Arc (b)
        </p>
      </div>
    </div>
  )
}

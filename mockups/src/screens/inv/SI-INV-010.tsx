/**
 * SI-INV-010 — Goods Receipt Entry — PO-Driven.
 *
 * Tier 1 hero · Group 3 · Phase 4 Epic 4 Arc (b) W3.
 * CANONICAL goods-receipt shape; later GR screens (SI-INV-011) mirror it.
 *
 * FRs: FR27 (yield factor — usable/wastage/adjusted cost), FR39 (attachments),
 *      FR114 (implausibility warn-and-log, >150% of PO line qty),
 *      FR115 (duplicate warn-and-log, same-day same-PO).
 *
 * CC-patterns consumed:
 *   - CC-DRAFT-PILL        — DraftPill isDraft mobileEyebrow (unsaved form).
 *   - CC-TRN-DISPLAY       — TrnDisplay on PO header.
 *   - CC-VOICE-INPUT       — CCVoiceInput for every per-line received qty.
 *   - CC-IMPLAUSIBILITY-WARN — CCImplausibilityWarn beneath any line where
 *                              received qty > 150 % of ordered qty; per-line
 *                              local override state (submit visually blocked
 *                              until all lines overridden).
 *   - CC-DUPLICATE-WARN    — CCDuplicateWarn for demo same-day same-PO
 *                              condition (1–2 candidate matches); dismissed
 *                              by "Proceed anyway".
 *   - CC-FILE-ATTACH       — CCFileAttachUploader (FR39).
 *   - CC-AUDIT-LINK        — AuditLink (entityRef = GR TRN or PO id).
 *
 * Reused chrome: page wrapper, header eyebrow + h1, SectionShift footer,
 *   canonical footer line.
 *
 * Yield math (FR27 — computed locally per line):
 *   usable      = received * yieldFactor
 *   wastage     = received − usable
 *   adjCostUnit = lkp_per_uom / yieldFactor
 *   (A yield factor of 1.00 means no waste; 0.85 means 15 % trim/waste.)
 *
 * Submit flow:
 *   - No shelf-life exception → status_confirmed inline.
 *   - Any shelf-life EXCEPTION line → pending-approval route → /SI-INF-001.
 *   - "Reject at QC" link → /SI-INV-012.
 *
 * Fixture PO: purchaseOrders[0] filtered to the first pending_gr PO found
 *   (has 1–3 lines). Demo duplicate: same-day same-PO GR candidate.
 *
 * Animation — NONE. CLAUDE.md animation policy bans entrance animations on
 * inventory/transaction screens.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Info,
  Package,
  PackageCheck,
  XCircle,
} from 'lucide-react'

import {
  AuditLink,
  Button,
  CCDuplicateWarn,
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
  materials,
  purchaseOrders,
  vendors,
  NOW,
  formatINR,
} from '@/lib/sample-data'

import { IMPLAUSIBILITY_REASON_OPTIONS } from '@/lib/inv-sample-data'

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Implausibility threshold: received > 150 % of ordered qty triggers warn. */
const IMPLAUSIBILITY_THRESHOLD = 1.5

/**
 * Perishable categories — expiry date is mandatory for these lines.
 * §11 comment: visual-chrome-only guard (no server call); list derived
 * from material categories in the fixture set.
 */
const PERISHABLE_CATEGORIES = new Set([
  'Dairy',
  'Cheese',
  'Meat',
  'Poultry',
  'Seafood',
  'Herbs',
  'Vegetables',
])

function isPerishable(materialId: string): boolean {
  const mat = materials.find((m) => m.id === materialId)
  return mat ? PERISHABLE_CATEGORIES.has(mat.category) : false
}

/** Default yield factors by category (FR27 pre-fill). */
function defaultYieldFactor(materialId: string): number {
  const mat = materials.find((m) => m.id === materialId)
  if (!mat) return 1.0
  const cat = mat.category
  if (cat === 'Meat' || cat === 'Poultry') return 0.82
  if (cat === 'Seafood') return 0.78
  if (cat === 'Vegetables' || cat === 'Herbs') return 0.88
  if (cat === 'Dairy') return 0.97
  return 1.0
}

/** Simulated voice-heard values per material (deterministic). */
const SIMULATED_HEARD: Record<string, string> = {
  'mat-chicken': '8',
  'mat-mutton': '5',
  'mat-paneer': '10',
  'mat-cream': '4',
  'mat-basmati-rice': '15',
  'mat-onion': '12',
  'mat-ghee': '3',
  'mat-atta': '20',
  'mat-turmeric': '2',
  'mat-garam-masala': '1.5',
  'mat-prawns': '6',
  'mat-milk': '8',
  'mat-butter': '4',
  'mat-cheese-mozz': '5',
  'mat-toor-dal': '10',
  'mat-chana-dal': '8',
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo fixture selection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pick the first pending_gr PO with ≥2 lines for a richer demo.
 * Falls back to the first pending_gr PO, then any PO.
 */
const DEMO_PO = (() => {
  const multi = purchaseOrders.find((p) => p.status === 'pending_gr' && p.lines.length >= 2)
  if (multi) return multi
  const any = purchaseOrders.find((p) => p.status === 'pending_gr')
  return any ?? purchaseOrders[0]!
})()

const DEMO_VENDOR = vendors.find((v) => v.id === DEMO_PO.vendor_id) ?? vendors[0]!

/**
 * Demo same-day same-PO duplicate GR candidate.
 * Represents a GR entry made earlier today for the same PO (shows CCDuplicateWarn).
 */
const DUPLICATE_MATCHES = [
  {
    id: 'gr-demo-dup-01',
    name: `GR entry for ${DEMO_PO.po_number} — earlier today`,
    subtitle: `${DEMO_VENDOR.name} · ${NOW} · In progress`,
    status: 'active' as const,
  },
]

/** Pre-seeded attachment (FR39 demo — one uploaded file). */
const SEED_ATTACHMENTS: IssueAttachment[] = [
  {
    id: 'att-gr-001',
    filename: `Delivery_Note_${DEMO_PO.po_number}.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 148320,
    uploadedAt: `${NOW}T08:42:00+05:30`,
    uploadedByLabel: 'Store Keeper (Bandra)',
    state: 'uploaded',
    downloadUrl: '#',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface GRLineState {
  /** Stable key — matches index in DEMO_PO.lines. */
  lineKey: string
  materialId: string
  orderedQty: number
  uom: string
  unitPrice: number
  /** Previously-received qty (partial PO scenario — always 0 for a fresh PO). */
  prevReceived: number
  receivedQty: string
  yieldFactor: string
  expiryDate: string
  batchRef: string
  /** Shelf-life acceptance: null = not evaluated yet; true = PASS; false = EXCEPTION */
  shelfLifePass: boolean | null
  implausibilitySelectedReason: string | null
  implausibilityOverridden: boolean
}

type SubmitState = 'idle' | 'confirmed' | 'pending_approval'

// ─────────────────────────────────────────────────────────────────────────────
// Derived-field helpers
// ─────────────────────────────────────────────────────────────────────────────

function computeYield(line: GRLineState): {
  usable: number
  wastage: number
  adjCostUnit: number
} {
  const received = parseFloat(line.receivedQty) || 0
  const yf = parseFloat(line.yieldFactor) || 1
  const usable = Math.round(received * yf * 100) / 100
  const wastage = Math.round((received - usable) * 100) / 100
  const adjCostUnit = yf > 0 ? Math.round(line.unitPrice / yf) : line.unitPrice
  return { usable, wastage, adjCostUnit }
}

function isImplausible(line: GRLineState): boolean {
  const received = parseFloat(line.receivedQty) || 0
  return received > line.orderedQty * IMPLAUSIBILITY_THRESHOLD
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiInv010() {
  const navigate = useNavigate()

  // ── Initial line states from DEMO_PO ──────────────────────────────────────

  const initialLines = useMemo<GRLineState[]>(() =>
    DEMO_PO.lines.map((l, idx) => ({
      lineKey: `line-${idx}`,
      materialId: l.material_id,
      orderedQty: l.qty,
      uom: l.uom,
      unitPrice: l.unit_price,
      prevReceived: 0,
      receivedQty: '',
      yieldFactor: String(defaultYieldFactor(l.material_id)),
      expiryDate: '',
      batchRef: '',
      shelfLifePass: null,
      implausibilitySelectedReason: null,
      implausibilityOverridden: false,
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [lines, setLines] = useState<GRLineState[]>(initialLines)
  const [isDraft, setIsDraft] = useState(true)

  // Duplicate warn — demo: always show until "Proceed anyway" clicked
  const [duplicateDismissed, setDuplicateDismissed] = useState(false)
  const showDuplicateWarn = !duplicateDismissed

  // Attachments (FR39)
  const [attachments, setAttachments] = useState<IssueAttachment[]>(SEED_ATTACHMENTS)

  // Submit state
  const [submitState, setSubmitState] = useState<SubmitState>('idle')

  // ── Derived ───────────────────────────────────────────────────────────────

  /** Any implausible line that has not been overridden blocks submit visually. */
  const hasUnoverriddenImplausibility = lines.some(
    (l) => isImplausible(l) && !l.implausibilityOverridden,
  )

  /** Any shelf-life EXCEPTION line routes submit → pending-approval. */
  const hasShelfLifeException = lines.some((l) => l.shelfLifePass === false)

  // GR TRN for AuditLink (deterministic — not Date.now)
  const grTrn = `TRN-GR-DRAFT-${DEMO_PO.po_number.slice(-4)}`

  // ── Handlers ──────────────────────────────────────────────────────────────

  function updateLine<K extends keyof GRLineState>(key: string, field: K, value: GRLineState[K]) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.lineKey !== key) return l
        const updated: GRLineState = { ...l, [field]: value }
        // Reset implausibility state when received qty changes
        if (field === 'receivedQty') {
          return {
            ...updated,
            implausibilitySelectedReason: null,
            implausibilityOverridden: false,
          }
        }
        return updated
      }),
    )
  }

  function handleShelfLifeToggle(key: string, pass: boolean) {
    updateLine(key, 'shelfLifePass', pass)
  }

  function handleImplausibilityReason(key: string, reason: string) {
    updateLine(key, 'implausibilitySelectedReason', reason)
  }

  function handleImplausibilityOverride(key: string) {
    updateLine(key, 'implausibilityOverridden', true)
  }

  function handleSubmit() {
    if (hasUnoverriddenImplausibility) return
    setIsDraft(false)
    if (hasShelfLifeException) {
      setSubmitState('pending_approval')
      // Route to approval inbox after brief state-set (simulated)
      window.setTimeout(() => navigate('/SI-INF-001'), 1200)
    } else {
      setSubmitState('confirmed')
    }
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
                Goods Receipt Entry — PO-Driven
              </h1>
              <p className="text-sm text-on-surface-variant">
                Record received quantities, yield factors, and expiry data against an open PO.
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
                <span className="text-sm font-medium text-on-surface">GR confirmed</span>
                <span className="text-xs text-on-surface-variant">
                  Stock updated. <StatusPill status="status_confirmed" size="sm" className="inline-flex align-middle" />
                </span>
              </div>
              <AuditLink entityRef={grTrn} className="ml-auto" />
            </div>
          )}
          {submitState === 'pending_approval' && (
            <div className="flex items-center gap-2 rounded-sm bg-surface-container px-4 py-3">
              <Info className="h-5 w-5 shrink-0 text-warning" aria-hidden />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-on-surface">Routed for approval</span>
                <span className="text-xs text-on-surface-variant">
                  Shelf-life exception detected.{' '}
                  <StatusPill status="status_pending_approval" size="sm" className="inline-flex align-middle" />
                  {' '}Redirecting to Approval Inbox…
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Duplicate warn (CC-DUPLICATE-WARN) ───────────────────────── */}
        {showDuplicateWarn && (
          <div className="mb-6">
            <CCDuplicateWarn
              matches={DUPLICATE_MATCHES}
              onEditExisting={(id) => {
                // §11 comment: navigate to existing GR entry — visual-chrome-only
                void id
              }}
              onProceedAnyway={() => setDuplicateDismissed(true)}
            />
          </div>
        )}

        {/* ── Section 1: PO Header ──────────────────────────────────────── */}
        <SectionShift tone="low" className="mb-6" aria-hidden />

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Purchase Order
            </span>
          </div>

          <div className="rounded-sm bg-surface-container p-4 flex flex-col gap-3 tablet:grid tablet:grid-cols-2 desktop:grid-cols-4 desktop:gap-4">
            {/* PO TRN */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">PO Number</span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-on-surface">{DEMO_PO.po_number}</span>
                <TrnDisplay trn={DEMO_PO.trn} />
              </div>
            </div>

            {/* Vendor */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">Vendor</span>
              <span className="text-sm font-medium text-on-surface">{DEMO_VENDOR.name}</span>
            </div>

            {/* Expected date */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">Expected On</span>
              <div className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5 text-on-surface-variant shrink-0" aria-hidden />
                <span className="text-sm text-on-surface">{DEMO_PO.expected_on}</span>
              </div>
            </div>

            {/* Status + lines count */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-on-surface-variant uppercase tracking-wider">Status / Lines</span>
              <div className="flex items-center gap-2">
                <StatusPill status="status_pending_approval" size="sm" />
                <span className="text-xs text-on-surface-variant">{DEMO_PO.lines.length} line{DEMO_PO.lines.length > 1 ? 's' : ''}</span>
              </div>
            </div>
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
              const perishable = isPerishable(line.materialId)
              const { usable, wastage, adjCostUnit } = computeYield(line)
              const implausible = isImplausible(line)
              const heardValue = SIMULATED_HEARD[line.materialId] ?? '5'
              const received = parseFloat(line.receivedQty) || 0

              // Shelf-life pass/exception styling
              const slState = line.shelfLifePass

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

                    {/* Shelf-life acceptance pill */}
                    <div className="flex items-center gap-1.5 shrink-0">
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
                    </div>
                  </div>

                  {/* Field grid */}
                  <div className="grid grid-cols-2 gap-3 tablet:grid-cols-3 desktop:grid-cols-4">
                    {/* Ordered qty (read-only) */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-on-surface-variant font-medium">
                        Ordered Qty
                      </label>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium text-on-surface">
                          {line.orderedQty}
                        </span>
                        <span className="text-xs text-on-surface-variant">{line.uom}</span>
                      </div>
                    </div>

                    {/* Previously received (read-only) */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-on-surface-variant font-medium">
                        Prev. Received
                      </label>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-on-surface">{line.prevReceived}</span>
                        <span className="text-xs text-on-surface-variant">{line.uom}</span>
                      </div>
                    </div>

                    {/* Received qty — CCVoiceInput (CC-VOICE-INPUT) */}
                    <div className="flex flex-col gap-1 col-span-2 tablet:col-span-1">
                      <label className="text-[11px] text-on-surface-variant font-medium" htmlFor={`recv-${line.lineKey}`}>
                        Received Qty · required
                      </label>
                      <CCVoiceInput
                        value={line.receivedQty}
                        onChange={(v) => updateLine(line.lineKey, 'receivedQty', v)}
                        unit={line.uom}
                        aria-label={`Received quantity for ${mat?.name ?? line.materialId}`}
                        simulatedHeardValue={heardValue}
                        placeholder="0.00"
                      />
                    </div>

                    {/* Yield factor (FR27 pre-filled) */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-on-surface-variant font-medium">
                        Yield Factor (FR27)
                      </label>
                      <Input
                        inputMode="decimal"
                        value={line.yieldFactor}
                        onChange={(e) => updateLine(line.lineKey, 'yieldFactor', e.target.value)}
                        aria-label={`Yield factor for ${mat?.name ?? line.materialId}`}
                        placeholder="0.00–1.00"
                      />
                    </div>

                    {/* Usable qty (computed, read-only) */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-on-surface-variant font-medium">
                        Usable Qty
                      </label>
                      <div className="flex items-center gap-1 h-10 rounded-sm bg-surface-container-high px-3">
                        <span className="text-sm font-medium text-on-surface">
                          {received > 0 ? usable : '—'}
                        </span>
                        {received > 0 && (
                          <span className="text-xs text-on-surface-variant ml-1">{line.uom}</span>
                        )}
                      </div>
                    </div>

                    {/* Wastage qty (computed, read-only) */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-on-surface-variant font-medium">
                        Wastage Qty
                      </label>
                      <div className="flex items-center gap-1 h-10 rounded-sm bg-surface-container-high px-3">
                        <span className={`text-sm font-medium ${wastage > 0 ? 'text-warning' : 'text-on-surface'}`}>
                          {received > 0 ? wastage : '—'}
                        </span>
                        {received > 0 && wastage > 0 && (
                          <span className="text-xs text-on-surface-variant ml-1">{line.uom}</span>
                        )}
                      </div>
                    </div>

                    {/* Adjusted cost / unit (computed, read-only) */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] text-on-surface-variant font-medium">
                        Adj. Cost / Unit
                      </label>
                      <div className="flex items-center h-10 rounded-sm bg-surface-container-high px-3">
                        <span className="text-sm font-medium text-on-surface">
                          {received > 0 ? formatINR(adjCostUnit) : `${formatINR(line.unitPrice)} (LKP)`}
                        </span>
                      </div>
                    </div>

                    {/* Expiry date — mandatory for perishables */}
                    <div className="flex flex-col gap-1 col-span-2 tablet:col-span-1">
                      <label className="text-[11px] text-on-surface-variant font-medium">
                        Expiry Date{perishable ? ' · required' : ''}
                      </label>
                      <Input
                        type="date"
                        value={line.expiryDate}
                        onChange={(e) => {
                          updateLine(line.lineKey, 'expiryDate', e.target.value)
                          // Auto-evaluate shelf life: PASS if >3 days from NOW
                          const entered = e.target.value
                          if (entered) {
                            const daysAhead =
                              (new Date(entered).getTime() - new Date(`${NOW}T00:00:00Z`).getTime()) /
                              86400000
                            updateLine(line.lineKey, 'shelfLifePass', daysAhead >= 3)
                          }
                        }}
                        aria-label={`Expiry date for ${mat?.name ?? line.materialId}`}
                        aria-required={perishable}
                      />
                    </div>

                    {/* Batch reference */}
                    <div className="flex flex-col gap-1 col-span-2 tablet:col-span-1">
                      <label className="text-[11px] text-on-surface-variant font-medium">
                        Batch Ref
                      </label>
                      <Input
                        value={line.batchRef}
                        onChange={(e) => updateLine(line.lineKey, 'batchRef', e.target.value)}
                        aria-label={`Batch reference for ${mat?.name ?? line.materialId}`}
                        placeholder="e.g. BATCH-2026-001"
                      />
                    </div>
                  </div>

                  {/* Shelf-life acceptance manual toggle (for demo where no date auto-evals) */}
                  {slState === null && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-on-surface-variant">
                        Shelf-life acceptance:
                      </span>
                      <button
                        type="button"
                        onClick={() => handleShelfLifeToggle(line.lineKey, true)}
                        className="inline-flex items-center gap-1 rounded-pill bg-surface-container-high px-2.5 py-1 text-[11px] font-medium text-on-surface hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <CheckCircle2 className="h-3 w-3 text-success" aria-hidden />
                        Mark PASS
                      </button>
                      <button
                        type="button"
                        onClick={() => handleShelfLifeToggle(line.lineKey, false)}
                        className="inline-flex items-center gap-1 rounded-pill bg-surface-container-high px-2.5 py-1 text-[11px] font-medium text-on-surface hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <AlertCircle className="h-3 w-3 text-warning" aria-hidden />
                        Mark EXCEPTION
                      </button>
                    </div>
                  )}

                  {/* Section 3: CCImplausibilityWarn (CC-IMPLAUSIBILITY-WARN) */}
                  {implausible && (
                    <CCImplausibilityWarn
                      message={`Received qty (${received} ${line.uom}) exceeds 150 % of ordered qty (${line.orderedQty} ${line.uom}). Select a reason to override.`}
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

        {/* ── Section 4: File attachments (CC-FILE-ATTACH / FR39) ───────── */}
        <SectionShift tone="low" className="mt-8 mb-6" aria-hidden />

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <PackageCheck className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Delivery Documents (FR39)
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

        {/* ── Section 5: Actions ────────────────────────────────────────── */}
        <SectionShift tone="low" className="mb-6" aria-hidden />

        <div className="flex flex-col gap-3">
          {/* Submit CTA */}
          <div className="flex flex-col gap-2 tablet:flex-row tablet:items-center tablet:justify-between">
            <div className="flex flex-col gap-1">
              {hasUnoverriddenImplausibility && (
                <p className="text-xs text-warning flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Override all implausibility warnings before submitting.
                </p>
              )}
              {hasShelfLifeException && !hasUnoverriddenImplausibility && (
                <p className="text-xs text-warning flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Shelf-life exception detected — will route to approval inbox.
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Reject at QC link → SI-INV-012 */}
              <Link
                to="/SI-INV-012"
                className="inline-flex items-center gap-1.5 text-sm text-error hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm px-2 py-1.5 min-h-[44px]"
              >
                <XCircle className="h-4 w-4 shrink-0" aria-hidden />
                Reject at QC
              </Link>

              <Button
                variant="default"
                size="lg"
                disabled={submitState !== 'idle' || hasUnoverriddenImplausibility}
                onClick={handleSubmit}
                aria-label="Submit goods receipt"
              >
                {submitState === 'idle'
                  ? hasShelfLifeException
                    ? 'Submit for Approval'
                    : 'Confirm Receipt'
                  : submitState === 'confirmed'
                    ? 'Confirmed'
                    : 'Routing…'}
              </Button>
            </div>
          </div>

          {/* Audit link */}
          <div className="flex justify-end">
            <AuditLink entityRef={DEMO_PO.id} label="PO audit history" />
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <SectionShift tone="high" className="mt-10" aria-hidden />
        <p className="mt-4 text-[11px] text-on-surface-variant">
          SI-INV-010 · Tier 1 hero · Phase 4 Epic 4 Arc (b)
        </p>
      </div>
    </div>
  )
}

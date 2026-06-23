/**
 * SI-INV-014 — Closing Inventory Entry — POS Daily.
 *
 * Tier 1 hero · Group 3 · Phase 4 Epic 4 Arc (b) W3.
 *
 * FRs: FR35 (end-of-day physical stock count), FR36 (variance tolerance),
 *      FR77 (closing cut-off enforcement), FR114 (implausibility warn-and-log
 *      when counted qty exceeds plausibility envelope; override + reason captured
 *      in audit log per warn-and-log model).
 *
 * CC-patterns consumed:
 *   - CC-DRAFT-PILL          — DraftPill isDraft mobileEyebrow (count spans 30+ min).
 *   - CC-VOICE-INPUT         — CCVoiceInput for every per-line counted qty (hands-busy
 *                              entry in a busy POS kitchen at end of service).
 *   - CC-IMPLAUSIBILITY-WARN — CCImplausibilityWarn beneath the FR114-tripping line;
 *                              per-line isolated override; submit blocked until resolved.
 *   - CC-TRN-DISPLAY         — TrnDisplay (ciTrn on header).
 *   - CC-AUDIT-LINK          — AuditLink (entityRef = ciTrn).
 *   - CC-PREFILL             — Yesterday's closing counts shown as reference column
 *                              (pre-fill discipline: not auto-accepted, shown for context).
 *
 * Reused chrome: page wrapper, header eyebrow + h1, SectionShift tonal breaks,
 *   DashboardTile aggregate tiles, canonical footer line.
 *
 * Cut-off countdown:
 *   Derived from `cutOffRegistry` cutOffTime vs a fixed SIMULATED_NOW constant
 *   (NOT Date.now() or argless new Date()). `warning` tone ≤ 60 min remaining;
 *   `error` tone if past cut-off. Screen is mobile-first (Tier 1 acceptance).
 *
 * Submit flow:
 *   - All variance reasons supplied + no unresolved implausibility →
 *     status_completed (if total variance value ≤ threshold) or
 *     status_variance_flagged (if variance items exist).
 *
 * Fixtures: closingInventory[0] (ci-001, POS, deptType='pos', confirmed yesterday as
 *   reference for CC-PREFILL); fresh active entry state seeded from ci-001 lines but
 *   with ci-006 TRN/businessDate (today draft). One line (mat-basmati-rice) is seeded
 *   with an implausible counted qty (16 kg vs expected 10 kg, 160%) to demo FR114.
 *
 * Animation — NONE. CLAUDE.md animation policy bans entrance animations on
 * inventory/transaction screens.
 */

import React, { useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  MapPin,
  Package,
} from 'lucide-react'

import {
  AuditLink,
  Button,
  CCImplausibilityWarn,
  CCVoiceInput,
  DashboardTile,
  DraftPill,
  SectionShift,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TrnDisplay,
} from '@/shell'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import {
  departments,
  locations,
  materials,
  NOW,
} from '@/lib/sample-data'

import {
  closingInventory,
  cutOffRegistry,
  CLOSING_VARIANCE_REASON_OPTIONS,
  IMPLAUSIBILITY_REASON_OPTIONS,
  formatINR,
  type ClosingInventory,
  type ClosingLine,
} from '@/lib/inv-sample-data'

// ─────────────────────────────────────────────────────────────────────────────
// Constants & helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Implausibility threshold for closing inventory counts.
 * FR114: counted qty > expectedQty * 1.5 triggers warn-and-log.
 */
const IMPLAUSIBILITY_THRESHOLD = 1.5

/**
 * Simulated current time of day (HH:MM) on NOW — deterministic.
 * 23:10 local time → 49 min remaining until 23:59 cut-off (≤ 60 min warning window).
 * This is intentionally inside the warning zone so the cut-off warning banner
 * and `text-warning` countdown render by default. The missed-cut-off / error
 * path (past 23:59) remains reachable by changing this to e.g. '00:05'.
 * NOT Date.now() or argless new Date().
 */
const SIMULATED_NOW_TIME = '23:10' as const

/**
 * Derive minutes remaining until cut-off.
 * Handles cross-midnight cut-offs (e.g. 00:30 = 02h after 22:30).
 */
function minutesUntilCutOff(cutOffHHMM: string, nowHHMM: string): number {
  const [cutH, cutM] = cutOffHHMM.split(':').map(Number) as [number, number]
  const [nowH, nowM] = nowHHMM.split(':').map(Number) as [number, number]

  const cutoffMinutes = cutH * 60 + cutM
  const nowMinutes    = nowH * 60 + nowM

  let diff = cutoffMinutes - nowMinutes
  // Cross-midnight — cut-off is early next morning
  if (diff <= -720) diff += 1440
  return diff
}

function locationName(locationId: string): string {
  return locations.find((l) => l.id === locationId)?.name ?? locationId
}

function deptName(departmentId: string): string {
  return departments.find((d) => d.id === departmentId)?.name ?? departmentId
}

function materialName(materialId: string): string {
  return materials.find((m) => m.id === materialId)?.name ?? materialId
}

function materialCategory(materialId: string): string {
  return materials.find((m) => m.id === materialId)?.category ?? '—'
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo fixture setup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ci-001 = yesterday's CONFIRMED POS entry (same location + dept).
 * Used as CC-PREFILL reference — shows yesterday's counts for context.
 */
const DEMO_YESTERDAY: ClosingInventory = closingInventory.find(
  (c) => c.id === 'ci-001',
)!

/**
 * ci-006 = today's DRAFT POS entry (TRN + businessDate for active form).
 * Lines are merged/seeded from DEMO_YESTERDAY for a richer demo.
 */
const DEMO_TODAY_META: ClosingInventory = closingInventory.find(
  (c) => c.id === 'ci-006',
)!

/**
 * Cut-off for the POS location.
 * Looked up from cutOffRegistry (loc-bandra-linking → 23:59).
 */
const CUT_OFF_ENTRY = cutOffRegistry.find(
  (e) => e.locationId === DEMO_YESTERDAY.locationId,
)

/**
 * Deterministic simulated voice-heard values per material (FR112).
 * Seeded to produce one FR114-tripping line (basmati: heard "16" vs expected 10).
 */
const SIMULATED_HEARD: Record<string, string> = {
  'mat-chicken':    '8',
  'mat-basmati-rice': '16',   // FR114-tripping: 16 vs expected 10 (160%)
  'mat-onion':      '5',
  'mat-paneer':     '4',
  'mat-ghee':       '3',
  'mat-mutton':     '12',
}

// ─────────────────────────────────────────────────────────────────────────────
// Types — per-line editable state
// ─────────────────────────────────────────────────────────────────────────────

interface LineState {
  materialId: string
  expectedQty: number
  /** Pre-fill: counted qty from YESTERDAY's record (CC-PREFILL reference). */
  yesterdayCountedQty: number | null
  uom: string
  /** Active counted qty input. Initialised to fixture countedQty. */
  countedQty: string
  /** Mandatory reason code when variance ≠ 0. */
  reasonCode: string
  /** FR114 implausibility-override state. */
  implausibilityReason: string | null
  implausibilityOverridden: boolean
}

type SubmitState = 'idle' | 'submitted_ok' | 'submitted_flagged'

// ─────────────────────────────────────────────────────────────────────────────
// Build initial line states from DEMO_YESTERDAY lines (CC-PREFILL)
// The 'active' countedQty seeds are chosen to demo implausibility on basmati.
// ─────────────────────────────────────────────────────────────────────────────

/** Counts we're "entering now" (today's count session). */
const ACTIVE_SEED: Record<string, string> = {
  'mat-chicken':      '8',
  'mat-basmati-rice': '16',  // FR114-tripping seed
  'mat-onion':        '5',
}

function buildInitialLines(yesterdayRecord: ClosingInventory): LineState[] {
  return yesterdayRecord.lines.map((line: ClosingLine) => {
    return {
      materialId: line.materialId,
      expectedQty: line.expectedQty,
      yesterdayCountedQty: line.countedQty,
      uom: line.uom,
      countedQty: ACTIVE_SEED[line.materialId] ?? '',
      reasonCode: '',
      implausibilityReason: null,
      implausibilityOverridden: false,
    }
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Derived helpers
// ─────────────────────────────────────────────────────────────────────────────

function computeVariance(line: LineState): number {
  const counted = parseFloat(line.countedQty)
  if (isNaN(counted)) return 0
  return Math.round((counted - line.expectedQty) * 1000) / 1000
}

function isImplausible(line: LineState): boolean {
  const counted = parseFloat(line.countedQty)
  if (isNaN(counted) || line.expectedQty <= 0) return false
  return counted > line.expectedQty * IMPLAUSIBILITY_THRESHOLD
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiInv014() {
  const [lines, setLines] = useState<LineState[]>(
    () => buildInitialLines(DEMO_YESTERDAY),
  )
  const [isDraft, setIsDraft] = useState(true)
  const [submitState, setSubmitState] = useState<SubmitState>('idle')

  // ── Cut-off countdown ─────────────────────────────────────────────────────
  const cutOffTime = CUT_OFF_ENTRY?.cutOffTime ?? '23:59'
  const minutesLeft = minutesUntilCutOff(cutOffTime, SIMULATED_NOW_TIME)
  const cutOffPassed = minutesLeft < 0
  const cutOffWarning = !cutOffPassed && minutesLeft <= 60

  function formatCountdown(mins: number): string {
    if (mins < 0) return 'Cut-off passed'
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h > 0) return `${h}h ${m}m remaining`
    return `${m}m remaining`
  }

  // ── Aggregate stats ───────────────────────────────────────────────────────
  const totalItems   = lines.length
  const completedItems = useMemo(
    () => lines.filter((l) => l.countedQty !== '').length,
    [lines],
  )
  const varianceItems = useMemo(
    () => lines.filter((l) => {
      const v = computeVariance(l)
      return v !== 0 && l.countedQty !== ''
    }).length,
    [lines],
  )
  const reasonMissing = useMemo(
    () => lines.filter((l) => {
      const v = computeVariance(l)
      return v !== 0 && l.countedQty !== '' && l.reasonCode === ''
    }).length,
    [lines],
  )

  // ── Blocker logic ─────────────────────────────────────────────────────────
  const hasUnoverriddenImplausibility = lines.some(
    (l) => isImplausible(l) && !l.implausibilityOverridden,
  )
  const hasMissingReasons = reasonMissing > 0
  const canSubmit =
    submitState === 'idle' &&
    !hasUnoverriddenImplausibility &&
    !hasMissingReasons &&
    completedItems > 0

  // ── Handlers ──────────────────────────────────────────────────────────────

  function updateLine(idx: number, patch: Partial<LineState>) {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    )
  }

  function handleCountedQtyChange(idx: number, value: string) {
    updateLine(idx, {
      countedQty: value,
      implausibilityOverridden: false,
      implausibilityReason: null,
    })
  }

  function handleSubmit() {
    if (!canSubmit) return
    setIsDraft(false)
    const anyVariance = lines.some((l) => computeVariance(l) !== 0)
    setSubmitState(anyVariance ? 'submitted_flagged' : 'submitted_ok')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">

        {/* ── Page header ──────────────────────────────────────────────── */}
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Inventory · Closing Count
        </p>

        <div className="mt-1 flex flex-col gap-2 tablet:flex-row tablet:items-start tablet:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl tablet:text-[2rem] font-bold leading-tight tracking-tight text-on-surface">
              Closing Inventory Entry — POS Daily
            </h1>
            <p className="text-sm text-on-surface-variant">
              End-of-day physical count for final products at the POS outlet.
              Variance against system-expected quantities requires a mandatory reason code.
            </p>
          </div>
          <div className="shrink-0">
            <DraftPill isDraft={isDraft} mobileEyebrow />
          </div>
        </div>

        {/* ── Submit feedback banner ────────────────────────────────────── */}
        {submitState === 'submitted_ok' && (
          <div className="mt-4 flex items-center gap-2 rounded-sm bg-surface-container px-4 py-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-on-surface">Closing count submitted</span>
              <span className="text-xs text-on-surface-variant">
                Stock reconciled.{' '}
                <StatusPill status="status_completed" size="sm" className="inline-flex align-middle" />
              </span>
            </div>
            <AuditLink entityRef={DEMO_TODAY_META.ciTrn} className="ml-auto" />
          </div>
        )}
        {submitState === 'submitted_flagged' && (
          <div className="mt-4 flex items-center gap-2 rounded-sm bg-surface-container px-4 py-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-warning" aria-hidden />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-on-surface">Submitted with variance flags</span>
              <span className="text-xs text-on-surface-variant">
                Variances recorded for review.{' '}
                <StatusPill status="status_variance_flagged" size="sm" className="inline-flex align-middle" />
              </span>
            </div>
            <AuditLink entityRef={DEMO_TODAY_META.ciTrn} className="ml-auto" />
          </div>
        )}

        {/* ── Section 1: POS context header ────────────────────────────── */}
        <SectionShift tone="low" className="mt-6 mb-5" aria-hidden />

        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Session context
            </span>
          </div>

          <div className="rounded-sm bg-surface-container-low p-4">
            <div className="grid grid-cols-2 gap-3 tablet:grid-cols-4">
              {/* Location */}
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1 text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                  Location
                </span>
                <span className="text-sm font-medium text-on-surface">
                  {locationName(DEMO_YESTERDAY.locationId)}
                </span>
              </div>

              {/* Department */}
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1 text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">
                  <Package className="h-3 w-3 shrink-0" aria-hidden />
                  Department
                </span>
                <span className="text-sm font-medium text-on-surface">
                  {deptName(DEMO_YESTERDAY.departmentId)}
                </span>
              </div>

              {/* Business date */}
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1 text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">
                  <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />
                  Business date
                </span>
                <span className="text-sm font-medium text-on-surface">
                  {NOW}
                </span>
              </div>

              {/* Cut-off countdown */}
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1 text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">
                  <Clock className="h-3 w-3 shrink-0" aria-hidden />
                  Cut-off
                </span>
                <div className="flex flex-col gap-0.5">
                  <span
                    className={[
                      'text-sm font-medium tabular-nums',
                      cutOffPassed
                        ? 'text-error'
                        : cutOffWarning
                          ? 'text-warning'
                          : 'text-on-surface',
                    ].join(' ')}
                    aria-label={`Cut-off at ${cutOffTime}. ${formatCountdown(minutesLeft)}`}
                  >
                    {cutOffTime}
                  </span>
                  <span
                    className={[
                      'text-[11px] tabular-nums',
                      cutOffPassed
                        ? 'text-error'
                        : cutOffWarning
                          ? 'text-warning'
                          : 'text-on-surface-variant',
                    ].join(' ')}
                    aria-hidden
                  >
                    {formatCountdown(minutesLeft)}
                  </span>
                </div>
              </div>
            </div>

            {/* TRN row */}
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">
                Closing TRN
              </span>
              <TrnDisplay trn={DEMO_TODAY_META.ciTrn} />
            </div>
          </div>

          {/* Cut-off warning banner */}
          {(cutOffWarning || cutOffPassed) && (
            <div
              role="alert"
              className={[
                'mt-3 flex items-start gap-2 rounded-sm px-4 py-3',
                cutOffPassed
                  ? 'bg-surface-container'
                  : 'bg-surface-container',
              ].join(' ')}
            >
              <div className={`border-l-4 ${cutOffPassed ? 'border-error' : 'border-warning'} self-stretch shrink-0`} />
              <AlertTriangle
                className={`h-4 w-4 shrink-0 mt-0.5 ${cutOffPassed ? 'text-error' : 'text-warning'}`}
                aria-hidden
              />
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-on-surface">
                  {cutOffPassed
                    ? 'Cut-off window has passed'
                    : 'Cut-off approaching — submit before ' + cutOffTime}
                </span>
                <span className="text-xs text-on-surface-variant">
                  {cutOffPassed
                    ? `Submission after cut-off will be recorded as late (DL-046 TZ limitation applies).`
                    : `${formatCountdown(minutesLeft)} — complete all lines and submit before the cut-off deadline.`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Section 2: Aggregate tiles ───────────────────────────────── */}
        <SectionShift tone="low" className="mb-5" aria-hidden />

        <div className="mb-6">
          <div className="grid grid-cols-2 gap-3 tablet:grid-cols-4">
            <DashboardTile
              label="Items to count"
              value={totalItems}
              secondary="Total lines this session"
              severity="neutral"
            />
            <DashboardTile
              label="Completed"
              value={completedItems}
              secondary={`${totalItems - completedItems} remaining`}
              severity={completedItems === totalItems ? 'success' : 'neutral'}
            />
            <DashboardTile
              label="Variance items"
              value={varianceItems}
              secondary="Count ≠ expected qty"
              severity={varianceItems > 0 ? 'warning' : 'neutral'}
            />
            <DashboardTile
              label="Reason missing"
              value={reasonMissing}
              secondary="Mandatory per variance"
              severity={reasonMissing > 0 ? 'error' : 'neutral'}
            />
          </div>
        </div>

        {/* ── Section 3: Per-item count entry ──────────────────────────── */}
        <SectionShift tone="low" className="mb-5" aria-hidden />

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Count lines
            </span>
            <span className="ml-auto text-[11px] text-on-surface-variant">
              CC-PREFILL: yesterday's count shown for reference
            </span>
          </div>

          {/* Mobile card stack (tablet:hidden) */}
          <div className="flex flex-col gap-4 tablet:hidden">
            {lines.map((line, idx) => {
              const variance     = computeVariance(line)
              const implausible  = isImplausible(line)
              const hasVariance  = line.countedQty !== '' && variance !== 0
              const lineId       = `mob-line-${idx}`
              const varSign      = variance > 0 ? '+' : ''

              return (
                <article
                  key={`${line.materialId}-${idx}`}
                  aria-label={`Line ${idx + 1}: ${materialName(line.materialId)}`}
                  className="rounded-sm bg-surface-container-low p-4 flex flex-col gap-3"
                >
                  {/* Item header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm font-medium text-on-surface">
                        {materialName(line.materialId)}
                      </span>
                      <span className="text-xs text-on-surface-variant">
                        {materialCategory(line.materialId)}
                      </span>
                    </div>
                    <span className="shrink-0 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] text-on-surface-variant tabular-nums">
                      {line.uom}
                    </span>
                  </div>

                  {/* Expected + yesterday reference */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                        Expected qty
                      </span>
                      <span className="text-sm tabular-nums text-on-surface">
                        {line.expectedQty} {line.uom}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                        Yesterday (ref)
                      </span>
                      <span className="text-sm tabular-nums text-on-surface-variant">
                        {line.yesterdayCountedQty !== null
                          ? `${line.yesterdayCountedQty} ${line.uom}`
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Counted qty — CCVoiceInput */}
                  <div className="flex flex-col gap-1">
                    <span
                      className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant"
                    >
                      Counted qty · required
                    </span>
                    <CCVoiceInput
                      value={line.countedQty}
                      onChange={(v) => handleCountedQtyChange(idx, v)}
                      unit={line.uom}
                      aria-label={`Counted quantity for ${materialName(line.materialId)}`}
                      simulatedHeardValue={SIMULATED_HEARD[line.materialId] ?? '0'}
                      placeholder="0.00"
                    />
                  </div>

                  {/* Variance (computed, read-only) */}
                  {line.countedQty !== '' && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                        Variance
                      </span>
                      <div className="flex items-center gap-1.5">
                        {hasVariance ? (
                          <StatusPill status="status_variance_flagged" size="sm" />
                        ) : null}
                        <span
                          className={[
                            'text-sm tabular-nums font-medium',
                            variance < 0 ? 'text-error' : variance > 0 ? 'text-warning' : 'text-on-surface-variant',
                          ].join(' ')}
                          aria-label={`Variance: ${varSign}${variance.toFixed(3)} ${line.uom}`}
                        >
                          {varSign}{variance.toFixed(3)} {line.uom}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Reason code — mandatory when variance ≠ 0 */}
                  {hasVariance && (
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`${lineId}-reason`}
                        className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant"
                      >
                        Reason
                        <span className="text-error ml-0.5" aria-hidden>*</span>
                      </label>
                      <Select
                        value={line.reasonCode}
                        onValueChange={(v) => updateLine(idx, { reasonCode: v })}
                      >
                        <SelectTrigger
                          id={`${lineId}-reason`}
                          aria-required="true"
                          aria-label={`Variance reason for ${materialName(line.materialId)}`}
                        >
                          <SelectValue placeholder="Select reason…" />
                        </SelectTrigger>
                        <SelectContent>
                          {CLOSING_VARIANCE_REASON_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* CCImplausibilityWarn (FR114) */}
                  {implausible && (
                    <CCImplausibilityWarn
                      message={`Counted qty (${line.countedQty} ${line.uom}) exceeds 150% of expected qty (${line.expectedQty} ${line.uom}). Override requires a structured reason.`}
                      reasonCodes={IMPLAUSIBILITY_REASON_OPTIONS}
                      selectedReason={line.implausibilityReason}
                      onSelectReason={(v) => updateLine(idx, { implausibilityReason: v })}
                      onOverride={() => updateLine(idx, { implausibilityOverridden: true })}
                      overridden={line.implausibilityOverridden}
                    />
                  )}
                </article>
              )
            })}
          </div>

          {/* Desktop table (hidden on mobile) */}
          <div className="hidden tablet:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Yesterday (ref)</TableHead>
                  <TableHead className="w-44">Counted qty</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead>UOM</TableHead>
                  <TableHead className="w-52">
                    Reason
                    <span className="text-error ml-0.5" aria-hidden>*</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, idx) => {
                  const variance    = computeVariance(line)
                  const implausible = isImplausible(line)
                  const hasVariance = line.countedQty !== '' && variance !== 0
                  const varSign     = variance > 0 ? '+' : ''
                  const varClass    =
                    variance < 0 ? 'text-error font-medium tabular-nums' :
                    variance > 0 ? 'text-warning font-medium tabular-nums' :
                    'text-on-surface-variant tabular-nums'

                  const lineId = `desk-line-${idx}`

                  return (
                    <React.Fragment key={`frag-${line.materialId}-${idx}`}>
                      <TableRow>
                        {/* Item name */}
                        <TableCell className="font-medium text-on-surface">
                          <div className="flex flex-col gap-0.5">
                            <span>{materialName(line.materialId)}</span>
                            <span className="text-[11px] text-on-surface-variant font-normal">
                              {materialCategory(line.materialId)}
                            </span>
                          </div>
                        </TableCell>

                        {/* Expected qty (read-only) */}
                        <TableCell className="text-right tabular-nums text-on-surface">
                          {line.expectedQty}
                        </TableCell>

                        {/* Yesterday reference (CC-PREFILL) */}
                        <TableCell className="text-right tabular-nums text-on-surface-variant">
                          {line.yesterdayCountedQty !== null ? line.yesterdayCountedQty : '—'}
                        </TableCell>

                        {/* Counted qty — CCVoiceInput */}
                        <TableCell>
                          <CCVoiceInput
                            value={line.countedQty}
                            onChange={(v) => handleCountedQtyChange(idx, v)}
                            unit={line.uom}
                            aria-label={`Counted quantity for ${materialName(line.materialId)}`}
                            simulatedHeardValue={SIMULATED_HEARD[line.materialId] ?? '0'}
                            placeholder="0.00"
                          />
                        </TableCell>

                        {/* Variance (computed) */}
                        <TableCell className="text-right">
                          {line.countedQty !== '' ? (
                            <div className="flex items-center justify-end gap-1.5">
                              {hasVariance ? (
                                <StatusPill status="status_variance_flagged" size="sm" />
                              ) : null}
                              <span
                                className={varClass}
                                aria-label={`Variance: ${varSign}${variance.toFixed(3)} ${line.uom}`}
                              >
                                {varSign}{variance.toFixed(3)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-on-surface-variant tabular-nums">—</span>
                          )}
                        </TableCell>

                        {/* UOM */}
                        <TableCell className="text-on-surface-variant">
                          {line.uom}
                        </TableCell>

                        {/* Reason code */}
                        <TableCell>
                          {hasVariance ? (
                            <Select
                              value={line.reasonCode}
                              onValueChange={(v) => updateLine(idx, { reasonCode: v })}
                            >
                              <SelectTrigger
                                id={`${lineId}-reason`}
                                aria-required="true"
                                aria-label={`Variance reason for ${materialName(line.materialId)}`}
                              >
                                <SelectValue placeholder="Select reason…" />
                              </SelectTrigger>
                              <SelectContent>
                                {CLOSING_VARIANCE_REASON_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-[11px] text-on-surface-variant">No variance</span>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* CCImplausibilityWarn row (FR114) — spans all columns */}
                      {implausible && (
                        <TableRow>
                          <TableCell colSpan={7} className="pt-0 pb-3">
                            <CCImplausibilityWarn
                              message={`Counted qty (${line.countedQty} ${line.uom}) exceeds 150% of expected qty (${line.expectedQty} ${line.uom}). Override requires a structured reason.`}
                              reasonCodes={IMPLAUSIBILITY_REASON_OPTIONS}
                              selectedReason={line.implausibilityReason}
                              onSelectReason={(v) => updateLine(idx, { implausibilityReason: v })}
                              onOverride={() => updateLine(idx, { implausibilityOverridden: true })}
                              overridden={line.implausibilityOverridden}
                              className="mt-1"
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* ── Section 4: Submit actions ─────────────────────────────────── */}
        <SectionShift tone="low" className="mb-5" aria-hidden />

        <div className="flex flex-col gap-3">
          {/* Blocker messages */}
          <div className="flex flex-col gap-1.5">
            {hasUnoverriddenImplausibility && (
              <p className="flex items-center gap-1.5 text-xs text-warning">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Override all implausibility warnings before submitting.
              </p>
            )}
            {hasMissingReasons && (
              <p className="flex items-center gap-1.5 text-xs text-error">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {reasonMissing} variance line{reasonMissing > 1 ? 's' : ''} missing a reason code.
              </p>
            )}
          </div>

          {/* Submit + audit row */}
          <div className="flex flex-col gap-2 tablet:flex-row tablet:items-center tablet:justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-on-surface-variant">
                {formatINR(
                  lines.reduce((sum, l) => {
                    const v = computeVariance(l)
                    const mat = materials.find((m) => m.id === l.materialId)
                    return sum + Math.abs(v) * (mat?.lkp_per_uom ?? 0)
                  }, 0),
                )}{' '}
                total variance value
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="default"
                size="lg"
                disabled={!canSubmit}
                onClick={handleSubmit}
                aria-label="Submit closing inventory count"
                aria-disabled={!canSubmit}
              >
                {submitState === 'idle'
                  ? 'Submit closing count'
                  : submitState === 'submitted_ok'
                    ? 'Submitted'
                    : 'Submitted (variance flagged)'}
              </Button>
            </div>
          </div>

          {/* Audit trail link */}
          <div className="flex justify-end">
            <AuditLink entityRef={DEMO_TODAY_META.ciTrn} label="Closing audit history" />
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <SectionShift tone="high" className="mt-10" aria-hidden />
        <p className="mt-4 text-[11px] text-on-surface-variant">
          SI-INV-014 · Tier 1 hero · Group 3 · Phase 4 Epic 4 Arc (b)
        </p>
      </div>
    </div>
  )
}

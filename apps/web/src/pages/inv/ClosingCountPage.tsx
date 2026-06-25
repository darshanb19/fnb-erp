import { useMemo, useState } from 'react'
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
} from '@/components/shell'

import { useInventoryDepartments } from '@/hooks/inv/useProductNames'
import { useDepartmentStock } from '@/hooks/inv/useStock'
import {
  useCutOffCompliance,
  useRecordClosing,
  useConfirmClosing,
} from '@/hooks/inv/useClosingInventory'
import { ApiError } from '@/lib/api-client'
import type { InventoryDepartment } from '@/hooks/inv/schemas'

/**
 * ClosingCountPage — shared component for SI-INV-014 (POS Daily) and
 * SI-INV-015 (Dispatch Daily).
 *
 * Tier 1 hero · Group 3 · Phase 4 Epic 4 Arc (c) Wave 3.
 *
 * Props:
 *   context: 'pos' | 'dispatch'
 *     The ONLY behavioural difference is the baseline column label:
 *     'pos'      → "Expected (on-hand)"
 *     'dispatch' → "Prod received − dispatched"
 *     Both read on-hand quantity from useDepartmentStock. The recipe/POS-
 *     specific expected is an Epic-6/9 seam; the backend computes authoritative
 *     expectedQty + variance on record.
 *
 * FRs: FR35 (end-of-day physical stock count), FR36 (variance tolerance),
 *      FR77 (closing cut-off enforcement), FR114 (implausibility warn-and-log).
 *
 * Divergences from mockup (SI-INV-014):
 *   1. Department picker (native <select>) instead of fixture. Dept drives the
 *      stock rows — one line per on-hand product in that dept.
 *   2. businessDate = TODAY in IST (Intl.DateTimeFormat, no SIMULATED_NOW_TIME).
 *   3. Cut-off countdown from useCutOffCompliance (real backend data).
 *   4. Record → confirm two-step submit (mirrors GoodsReceiptEntryPage pattern).
 *   5. Mutation errors surface as inline role="alert" banners (never top-level).
 *   6. AuditLink entityType = 'closing_inventory' (the table name).
 *   7. CCVoiceInput: no simulatedHeardValue (production, not demo fixture).
 *
 * Animation: NONE per CLAUDE.md. CCVoiceInput's guarded pulse is its own
 * reduced-motion-guarded interaction-feedback pattern.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface ClosingCountPageProps {
  context: 'pos' | 'dispatch'
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline constants
// ─────────────────────────────────────────────────────────────────────────────

const CLOSING_VARIANCE_REASON_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'physical_count_variance',  label: 'Physical count variance' },
  { value: 'spoilage',                 label: 'Spoilage / waste' },
  { value: 'theft',                    label: 'Theft / shrinkage' },
  { value: 'transfer_unrecorded',      label: 'Transfer not yet recorded' },
  { value: 'production_usage',         label: 'Production usage variance' },
  { value: 'recipe_deviation',         label: 'Recipe deviation' },
  { value: 'pos_consumption',          label: 'POS consumption adjustment' },
  { value: 'receiving_error',          label: 'Receiving entry error' },
  { value: 'other',                    label: 'Other (add note)' },
]

const IMPLAUSIBILITY_REASON_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'recount_confirmed',  label: 'Recount confirmed — count is correct' },
  { value: 'recording_error',    label: 'Recording error — correcting now' },
  { value: 'genuine_spoilage',   label: 'Genuine spoilage event' },
  { value: 'transfer_missing',   label: 'Transfer not yet recorded' },
  { value: 'other',              label: 'Other (add note)' },
]

/**
 * FR114 — counted qty > expectedQty * 1.5 triggers implausibility warn-and-log.
 */
const IMPLAUSIBILITY_THRESHOLD = 1.5

// ─────────────────────────────────────────────────────────────────────────────
// Types — per-line editable state
// ─────────────────────────────────────────────────────────────────────────────

interface LineState {
  productId: string
  productName: string
  expectedQty: number
  unit: string
  countedQty: string
  reasonCode: string
  implausibilityReason: string | null
  implausibilityOverridden: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * deriveLocationCode — sanitised location code from dept name/code.
 * Mirrors helper from InventoryAdjustmentPage.
 */
function deriveLocationCode(dept: InventoryDepartment | undefined): string {
  if (!dept) return 'INV'
  return (
    (dept.code ?? dept.name ?? 'INV')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 20)
      .toUpperCase()
  ) || 'INV'
}

/**
 * todayIST — returns YYYY-MM-DD in Asia/Kolkata timezone.
 * Uses 'en-CA' locale because it produces ISO-8601 YYYY-MM-DD format.
 * Memoised via useMemo at top of component; computed once per mount.
 */
function computeTodayIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

/**
 * currentISTTime — returns current time as 'HH:MM' in Asia/Kolkata timezone.
 * Used for cut-off countdown.
 */
function currentISTTime(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date()).slice(0, 5)
}

/**
 * minutesUntilCutOff — positive = minutes remaining, negative = past cut-off.
 * Handles cross-midnight cut-offs (e.g. 00:30 when now = 23:40 = 50 min away).
 */
function minutesUntilCutOff(cutOffHHMM: string, nowHHMM: string): number {
  const [cutH, cutM] = cutOffHHMM.split(':').map(Number) as [number, number]
  const [nowH, nowM] = nowHHMM.split(':').map(Number) as [number, number]

  const cutoffMinutes = cutH * 60 + cutM
  const nowMinutes = nowH * 60 + nowM

  let diff = cutoffMinutes - nowMinutes
  // Cross-midnight — cut-off is early next day
  if (diff <= -720) diff += 1440
  return diff
}

function formatCountdown(mins: number): string {
  if (mins < 0) return 'Cut-off passed'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0) return `${h}h ${m}m remaining`
  return `${m}m remaining`
}

function computeVariance(countedQty: string, expectedQty: number): number {
  const counted = parseFloat(countedQty)
  if (isNaN(counted)) return 0
  return Math.round((counted - expectedQty) * 1000) / 1000
}

function isImplausible(countedQty: string, expectedQty: number): boolean {
  const counted = parseFloat(countedQty)
  if (isNaN(counted) || expectedQty <= 0) return false
  return counted > expectedQty * IMPLAUSIBILITY_THRESHOLD
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading / error states (brief-specified patterns)
// ─────────────────────────────────────────────────────────────────────────────

function LoadingState() {
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

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function ClosingCountPage({ context }: ClosingCountPageProps) {
  // ── Derived constants ─────────────────────────────────────────────────────
  const baselineLabel = context === 'pos' ? 'Expected (on-hand)' : 'Prod received − dispatched'
  const pageTitle = context === 'pos'
    ? 'Closing Inventory Entry — POS Daily'
    : 'Closing Inventory Entry — Dispatch Daily'
  const pageSubtitle = context === 'pos'
    ? 'End-of-day physical count for final products at the POS outlet. Variance against system-expected quantities requires a mandatory reason code.'
    : 'End-of-day closing count for dispatch-facing inventory. Variance against prod-received−dispatched baseline requires a mandatory reason code.'

  // businessDate = today in IST, memoised once (not affected by re-renders)
  const todayIST = useMemo(() => computeTodayIST(), [])

  // ── ALL hooks ABOVE the early loading/guard returns ───────────────────────
  // (eslint not installed — hooks-above-early-returns is critical after Wave-1 crash)

  const { data: depts, isLoading: deptsLoading } = useInventoryDepartments()

  const [selectedDeptId, setSelectedDeptId] = useState<string | undefined>(undefined)
  const effectiveDeptId = selectedDeptId ?? depts?.[0]?.id

  const {
    data: stockResult,
    isLoading: stockLoading,
  } = useDepartmentStock(effectiveDeptId)

  const selectedDept = depts?.find((d) => d.id === effectiveDeptId)

  const cutOffResult = useCutOffCompliance(todayIST, {
    locationId: selectedDept?.locationId,
    departmentId: effectiveDeptId,
  })

  // ── Cut-off countdown state ───────────────────────────────────────────────
  const cutOffTime = cutOffResult.data?.cutOffTime ?? null
  const cutOffStatus = cutOffResult.data?.status

  // Compute remaining minutes from the real IST clock
  const minutesLeft = useMemo(() => {
    if (!cutOffTime) return null
    return minutesUntilCutOff(cutOffTime, currentISTTime())
  // Re-compute per render (live clock). This is intentional for a countdown.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutOffTime])

  const cutOffPassed = minutesLeft !== null && minutesLeft < 0
  const cutOffWarning = minutesLeft !== null && !cutOffPassed && minutesLeft <= 60

  // ── Lines state ───────────────────────────────────────────────────────────
  const [lines, setLines] = useState<LineState[]>([])
  const [lastSeededDeptId, setLastSeededDeptId] = useState<string | undefined>(undefined)

  const stockItems = stockResult?.items ?? []

  // Seed lines from stock when dept changes (derived-state idiom; React-recommended)
  const seededLines = useMemo<LineState[]>(() => {
    return stockItems.map((row) => ({
      productId: row.productId,
      productName: row.productName,
      expectedQty: row.quantity,
      unit: row.unit,
      countedQty: '',
      reasonCode: '',
      implausibilityReason: null,
      implausibilityOverridden: false,
    }))
  // Only re-seed when product set size changes for this dept
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveDeptId, stockItems.length])

  if (effectiveDeptId !== lastSeededDeptId && stockItems.length > 0) {
    setLastSeededDeptId(effectiveDeptId)
    setLines(seededLines)
  }

  // ── Submit state ──────────────────────────────────────────────────────────
  const [isDraft, setIsDraft] = useState(false)
  const [ciTrn, setCiTrn] = useState<string | undefined>(undefined)
  const [finalStatus, setFinalStatus] = useState<string | undefined>(undefined)
  const [serverWarnings, setServerWarnings] = useState<string[]>([])
  const [recordError, setRecordError] = useState<Error | null>(null)
  const [confirmError, setConfirmError] = useState<Error | null>(null)

  const { mutateAsync: recordClosing, isPending: isRecording } = useRecordClosing()
  const { mutateAsync: confirmClosing, isPending: isConfirming } = useConfirmClosing()

  // ── Aggregate stats (memoised) ────────────────────────────────────────────
  const totalItems = lines.length

  const completedItems = useMemo(
    () => lines.filter((l) => l.countedQty !== '').length,
    [lines],
  )

  const varianceItems = useMemo(
    () => lines.filter((l) => {
      const v = computeVariance(l.countedQty, l.expectedQty)
      return l.countedQty !== '' && v !== 0
    }).length,
    [lines],
  )

  const reasonMissing = useMemo(
    () => lines.filter((l) => {
      const v = computeVariance(l.countedQty, l.expectedQty)
      return l.countedQty !== '' && v !== 0 && l.reasonCode === ''
    }).length,
    [lines],
  )

  // ── Blocker logic ─────────────────────────────────────────────────────────
  const hasUnoverriddenImplausibility = lines.some(
    (l) => isImplausible(l.countedQty, l.expectedQty) && !l.implausibilityOverridden,
  )

  const canSubmit =
    !isDraft &&
    !isRecording &&
    !isConfirming &&
    !hasUnoverriddenImplausibility &&
    reasonMissing === 0 &&
    completedItems > 0

  const isPending = isRecording || isConfirming

  // ── Early loading guard (ONLY loading returns early — NOT errors) ─────────
  if (deptsLoading || (stockLoading && !stockResult && effectiveDeptId)) {
    return <LoadingState />
  }

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

  async function handleSubmit() {
    if (!canSubmit || !effectiveDeptId || !selectedDept) return

    setRecordError(null)
    setConfirmError(null)
    setServerWarnings([])

    const locationCode = deriveLocationCode(selectedDept)

    try {
      const rec = await recordClosing({
        locationId: selectedDept.locationId ?? effectiveDeptId,
        departmentId: effectiveDeptId,
        businessDate: todayIST,
        locationCode,
        lines: lines
          .filter((l) => l.countedQty !== '')
          .map((l) => {
            const variance = computeVariance(l.countedQty, l.expectedQty)
            return {
              itemId: l.productId,
              countedQty: parseFloat(l.countedQty),
              reasonCode: variance !== 0 ? l.reasonCode : undefined,
            }
          }),
      })

      setCiTrn(rec.ciTrn)
      setIsDraft(true)

      if (rec.warnings.length > 0) {
        setServerWarnings(rec.warnings)
      }

      // Proceed directly to confirm
      try {
        const confirmed = await confirmClosing(rec.closingId)
        setFinalStatus(confirmed.status)
        setIsDraft(false)
      } catch (err) {
        setConfirmError(err instanceof Error ? err : new Error('Confirm failed'))
      }
    } catch (err) {
      setRecordError(err instanceof Error ? err : new Error('Record failed'))
    }
  }

  // ── Determine success state ────────────────────────────────────────────────
  const isSuccess = finalStatus !== undefined && !isDraft

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Inventory · Closing Count
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] font-bold leading-tight tracking-tight text-on-surface">
              {pageTitle}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              {pageSubtitle}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isDraft && <DraftPill isDraft mobileEyebrow />}
          </div>
        </header>

        {/* ── Success banner ────────────────────────────────────────────────── */}
        {isSuccess && ciTrn ? (
          <div className="mt-4 flex items-center gap-2 rounded-sm bg-surface-container px-4 py-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-hidden />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-on-surface">
                {finalStatus === 'variance_flagged'
                  ? 'Submitted with variance flags'
                  : 'Closing count submitted'}
              </span>
              <span className="text-xs text-on-surface-variant">
                {finalStatus === 'variance_flagged'
                  ? 'Variances recorded for review. '
                  : 'Stock reconciled. '}
                <StatusPill
                  status={finalStatus === 'variance_flagged' ? 'status_variance_flagged' : 'status_confirmed'}
                  size="sm"
                  className="inline-flex align-middle"
                />
              </span>
            </div>
            <AuditLink
              entityType="closing_inventory"
              entityRef={ciTrn}
              className="ml-auto"
            />
          </div>
        ) : null}

        {/* ── Server warnings (non-blocking — between submit and confirm) ────── */}
        {serverWarnings.length > 0 && (
          <div
            role="alert"
            className="mt-4 flex items-start gap-3 rounded-sm bg-surface-container px-4 py-3"
          >
            <div className="border-l-4 border-warning self-stretch shrink-0" />
            <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" aria-hidden />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-on-surface">Server warnings</span>
              <ul className="mt-0.5 flex flex-col gap-0.5">
                {serverWarnings.map((w, i) => (
                  <li key={i} className="text-xs text-on-surface-variant">{w}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ── Inline mutation error banners (keep the form!) ───────────────── */}
        {recordError ? (
          <div
            role="alert"
            className="mt-4 flex items-start gap-3 rounded-sm bg-error-container px-4 py-3 text-on-error-container"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <p className="text-sm">
              {recordError instanceof ApiError
                ? recordError.message
                : 'Submit failed — please check the form and try again.'}
            </p>
          </div>
        ) : null}
        {confirmError ? (
          <div
            role="alert"
            className="mt-4 flex items-start gap-3 rounded-sm bg-error-container px-4 py-3 text-on-error-container"
          >
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <p className="text-sm">
              {confirmError instanceof ApiError
                ? confirmError.message
                : 'Confirm failed — draft created. Please retry confirm.'}
            </p>
          </div>
        ) : null}

        {/* ── Section 1: Session context header ────────────────────────────── */}
        <SectionShift tone="low" className="mt-6 mb-5" aria-hidden />

        <section
          aria-label="Session context"
          className="mb-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Session context
            </span>
          </div>

          {/* Department picker */}
          <div className="mb-4 flex flex-col gap-1.5">
            <label
              htmlFor="closing-dept"
              className="text-xs font-medium text-on-surface-variant"
            >
              Department
            </label>
            <select
              id="closing-dept"
              aria-label="Department"
              value={effectiveDeptId ?? ''}
              onChange={(e) => {
                setSelectedDeptId(e.target.value || undefined)
                setIsDraft(false)
                setCiTrn(undefined)
                setFinalStatus(undefined)
                setServerWarnings([])
                setRecordError(null)
                setConfirmError(null)
                setLines([])
              }}
              disabled={isDraft}
              className={[
                'h-11 rounded-md px-3 text-sm text-on-surface',
                'bg-surface-container-lowest',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                'min-w-[220px]',
                isDraft ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {(!depts || depts.length === 0) ? (
                <option value="">No departments available</option>
              ) : (
                depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Context card */}
          <div className="rounded-sm bg-surface-container-low p-4">
            <div className="grid grid-cols-2 gap-3 tablet:grid-cols-4">
              {/* Location */}
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1 text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">
                  <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                  Location
                </span>
                <span className="text-sm font-medium text-on-surface">
                  {selectedDept?.locationId
                    ? <span className="font-mono text-xs">{deriveLocationCode(selectedDept)}</span>
                    : '—'
                  }
                </span>
              </div>

              {/* Department */}
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1 text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">
                  <Package className="h-3 w-3 shrink-0" aria-hidden />
                  Department
                </span>
                <span className="text-sm font-medium text-on-surface">
                  {selectedDept?.name ?? '—'}
                </span>
              </div>

              {/* Business date */}
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1 text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">
                  <CalendarDays className="h-3 w-3 shrink-0" aria-hidden />
                  Business date
                </span>
                <span className="text-sm font-medium text-on-surface">
                  {todayIST}
                </span>
              </div>

              {/* Cut-off countdown */}
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-1 text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">
                  <Clock className="h-3 w-3 shrink-0" aria-hidden />
                  Cut-off
                </span>
                {cutOffTime ? (
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
                      aria-label={`Cut-off at ${cutOffTime}. ${minutesLeft !== null ? formatCountdown(minutesLeft) : ''}`}
                    >
                      {cutOffTime}
                    </span>
                    {minutesLeft !== null && (
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
                    )}
                  </div>
                ) : cutOffStatus === 'no_cutoff_configured' || cutOffResult.data ? (
                  <span className="text-sm text-on-surface-variant">No cut-off configured</span>
                ) : (
                  <span className="text-sm text-on-surface-variant">—</span>
                )}
              </div>
            </div>

            {/* TRN row (once draft created) */}
            {ciTrn ? (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-medium">
                  Closing TRN
                </span>
                <TrnDisplay trn={ciTrn} />
              </div>
            ) : null}
          </div>

          {/* Cut-off warning / error banner */}
          {(cutOffWarning || cutOffPassed) && cutOffTime && minutesLeft !== null ? (
            <div
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-sm bg-surface-container px-4 py-3"
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
                    : `Cut-off approaching — submit before ${cutOffTime}`}
                </span>
                <span className="text-xs text-on-surface-variant">
                  {cutOffPassed
                    ? 'Submission after cut-off will be recorded as late (DL-046 TZ limitation applies).'
                    : `${formatCountdown(minutesLeft)} — complete all lines and submit before the cut-off deadline.`}
                </span>
              </div>
            </div>
          ) : null}
        </section>

        {/* ── Section 2: Aggregate tiles ───────────────────────────────────── */}
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
              severity={completedItems === totalItems && totalItems > 0 ? 'success' : 'neutral'}
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

        {/* ── Section 3: Per-item count entry ──────────────────────────────── */}
        {lines.length > 0 ? (
          <>
            <SectionShift tone="low" className="mb-5" aria-hidden />

            <section aria-label="Count lines" className="mb-4">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Count lines
                </span>
              </div>

              {/* Mobile card stack (tablet:hidden) */}
              <div className="flex flex-col gap-4 tablet:hidden">
                {lines.map((line, idx) => {
                  const variance = computeVariance(line.countedQty, line.expectedQty)
                  const implausible = isImplausible(line.countedQty, line.expectedQty)
                  const hasVariance = line.countedQty !== '' && variance !== 0
                  const varSign = variance > 0 ? '+' : ''
                  const lineId = `mob-closing-${idx}`

                  return (
                    <article
                      key={`${line.productId}-${idx}`}
                      aria-label={`Line ${idx + 1}: ${line.productName}`}
                      className="rounded-sm bg-surface-container-low p-4 flex flex-col gap-3"
                    >
                      {/* Item header */}
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-on-surface truncate">
                          {line.productName}
                        </span>
                        <span className="shrink-0 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] text-on-surface-variant tabular-nums">
                          {line.unit}
                        </span>
                      </div>

                      {/* Expected baseline */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                          {baselineLabel}
                        </span>
                        <span className="text-sm tabular-nums text-on-surface">
                          {line.expectedQty} {line.unit}
                        </span>
                      </div>

                      {/* Counted qty — CCVoiceInput */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-on-surface-variant">
                          Counted qty · required
                        </span>
                        <CCVoiceInput
                          value={line.countedQty}
                          onChange={(v) => handleCountedQtyChange(idx, v)}
                          unit={line.unit}
                          aria-label={`Counted quantity for ${line.productName}`}
                          placeholder="0.00"
                          disabled={isSuccess}
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
                              aria-label={`Variance: ${varSign}${variance.toFixed(3)} ${line.unit}`}
                            >
                              {varSign}{variance.toFixed(3)} {line.unit}
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
                          <select
                            id={`${lineId}-reason`}
                            aria-required="true"
                            aria-label={`Variance reason for ${line.productName}`}
                            value={line.reasonCode}
                            onChange={(e) => updateLine(idx, { reasonCode: e.target.value })}
                            disabled={isSuccess}
                            className={[
                              'h-11 rounded-md px-3 text-sm text-on-surface',
                              'bg-surface-container-lowest',
                              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                              isSuccess ? 'opacity-50 cursor-not-allowed' : '',
                            ].join(' ')}
                          >
                            <option value="">Select reason…</option>
                            {CLOSING_VARIANCE_REASON_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* CCImplausibilityWarn (FR114) */}
                      {implausible && !isSuccess && (
                        <CCImplausibilityWarn
                          message={`Counted qty (${line.countedQty} ${line.unit}) exceeds 150% of expected qty (${line.expectedQty} ${line.unit}). Override requires a structured reason.`}
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
                      <TableHead className="text-right">{baselineLabel}</TableHead>
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
                      const variance = computeVariance(line.countedQty, line.expectedQty)
                      const hasVariance = line.countedQty !== '' && variance !== 0
                      const varSign = variance > 0 ? '+' : ''
                      const varClass =
                        variance < 0 ? 'text-error font-medium tabular-nums' :
                        variance > 0 ? 'text-warning font-medium tabular-nums' :
                        'text-on-surface-variant tabular-nums'

                      const lineId = `desk-closing-${idx}`

                      return (
                        // React.Fragment key needs a primitive — use string
                        <TableRow key={`row-${line.productId}-${idx}`}>
                          {/* Item name */}
                          <TableCell className="font-medium text-on-surface">
                            {line.productName}
                          </TableCell>

                          {/* Expected baseline (read-only) */}
                          <TableCell className="text-right tabular-nums text-on-surface">
                            {line.expectedQty}
                          </TableCell>

                          {/* Counted qty — CCVoiceInput */}
                          <TableCell>
                            <CCVoiceInput
                              value={line.countedQty}
                              onChange={(v) => handleCountedQtyChange(idx, v)}
                              unit={line.unit}
                              aria-label={`Counted quantity for ${line.productName}`}
                              placeholder="0.00"
                              disabled={isSuccess}
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
                                  aria-label={`Variance: ${varSign}${variance.toFixed(3)} ${line.unit}`}
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
                            {line.unit}
                          </TableCell>

                          {/* Reason code */}
                          <TableCell>
                            {hasVariance ? (
                              <select
                                id={`${lineId}-reason`}
                                aria-required="true"
                                aria-label={`Variance reason for ${line.productName}`}
                                value={line.reasonCode}
                                onChange={(e) => updateLine(idx, { reasonCode: e.target.value })}
                                disabled={isSuccess}
                                className={[
                                  'h-11 w-full rounded-md px-3 text-sm text-on-surface',
                                  'bg-surface-container-lowest',
                                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                  isSuccess ? 'opacity-50 cursor-not-allowed' : '',
                                ].join(' ')}
                              >
                                <option value="">Select reason…</option>
                                {CLOSING_VARIANCE_REASON_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-[11px] text-on-surface-variant">
                                {line.countedQty !== '' ? 'No variance' : '—'}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>

                {/* Desktop implausibility warnings below table (per affected line) */}
                {!isSuccess && lines.map((line, idx) => {
                  if (!isImplausible(line.countedQty, line.expectedQty)) return null
                  return (
                    <div key={`implaus-${line.productId}-${idx}`} className="mt-2">
                      <p className="text-xs text-on-surface-variant mb-1">
                        <span className="font-medium text-on-surface">{line.productName}</span>
                        {' '}— implausibility warning:
                      </p>
                      <CCImplausibilityWarn
                        message={`Counted qty (${line.countedQty} ${line.unit}) exceeds 150% of expected qty (${line.expectedQty} ${line.unit}). Override requires a structured reason.`}
                        reasonCodes={IMPLAUSIBILITY_REASON_OPTIONS}
                        selectedReason={line.implausibilityReason}
                        onSelectReason={(v) => updateLine(idx, { implausibilityReason: v })}
                        onOverride={() => updateLine(idx, { implausibilityOverridden: true })}
                        overridden={line.implausibilityOverridden}
                      />
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        ) : effectiveDeptId && !stockLoading ? (
          <>
            <SectionShift tone="low" className="mb-5" aria-hidden />
            <div className="mt-6 rounded-sm bg-surface-container-low p-6 flex flex-col items-center gap-2 text-center">
              <AlertCircle aria-hidden className="h-8 w-8 text-on-surface-variant" />
              <p className="text-sm text-on-surface-variant">
                No stock found at the selected department. Try a different department.
              </p>
            </div>
          </>
        ) : null}

        {/* ── Section 4: Submit actions ─────────────────────────────────────── */}
        {lines.length > 0 && !isSuccess ? (
          <>
            <SectionShift tone="low" className="mb-5 mt-8" aria-hidden />

            <section aria-label="Submit closing count" className="flex flex-col gap-3">
              {/* Blocker messages */}
              <div className="flex flex-col gap-1.5">
                {hasUnoverriddenImplausibility && (
                  <p className="flex items-center gap-1.5 text-xs text-warning">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Override all implausibility warnings before submitting.
                  </p>
                )}
                {reasonMissing > 0 && (
                  <p className="flex items-center gap-1.5 text-xs text-error">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {reasonMissing} variance line{reasonMissing > 1 ? 's' : ''} missing a reason code.
                  </p>
                )}
                {completedItems === 0 && (
                  <p className="flex items-center gap-1.5 text-xs text-on-surface-variant">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Enter at least one counted quantity before submitting.
                  </p>
                )}
              </div>

              {/* Submit CTA */}
              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button
                  variant="default"
                  size="lg"
                  disabled={!canSubmit || isPending}
                  onClick={() => { void handleSubmit() }}
                  aria-label="Submit closing inventory count"
                  aria-disabled={!canSubmit || isPending}
                >
                  {isRecording
                    ? 'Recording…'
                    : isConfirming
                      ? 'Confirming…'
                      : 'Submit closing count'}
                </Button>
              </div>

              {/* Audit trail link (before success, uses session context) */}
              {ciTrn ? (
                <div className="flex justify-end">
                  <AuditLink
                    entityType="closing_inventory"
                    entityRef={ciTrn}
                    label="Closing audit history"
                  />
                </div>
              ) : null}
            </section>
          </>
        ) : null}

        {/* Audit link visible post-success */}
        {isSuccess && ciTrn ? (
          <div className="mt-4 flex justify-end">
            <AuditLink
              entityType="closing_inventory"
              entityRef={ciTrn}
              label="Closing audit history"
            />
          </div>
        ) : null}

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-on-surface-variant">
            {context === 'pos' ? 'SI-INV-014' : 'SI-INV-015'} · Tier 1 hero · Group 3 · Phase 4 Epic 4 Arc (c)
          </p>
          <p className="text-xs text-on-surface-variant">
            FR35 · FR36 · FR77 · FR114 · DL-046 · DL-047
          </p>
        </footer>
      </div>
    </div>
  )
}

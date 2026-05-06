import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ChefHat,
  ClipboardList,
  FileText,
  Layers,
  MapPin,
  Play,
  Zap,
} from 'lucide-react'

import {
  AuditLink,
  Button,
  LifecycleStepper,
  PRODUCTION_ORDER_LIFECYCLE_STEPS,
  ProvisionalFlag,
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
  formatINR,
  materials,
  recipes,
  type RecipeIngredient,
} from '@/lib/sample-data'

import { tokens } from '@/tokens'

/**
 * SI-PRO-011 — In Progress Transition Confirm.
 *
 * Tier 1 Group 2 hybrid-widening, screen 2 of Phase 2c-S4. The deliberate
 * Kitchen Manager confirmation surface that fires the DL-001 Confirmed →
 * In Progress transition for a production order. Two side-effects fire
 * atomically at this transition:
 *
 *   1. inventoryService.deductStock() — FEFO-ordered stock deduction (FR68)
 *   2. COGS journal — DR COGS — Raw Material Consumption / CR Inventory —
 *      Raw Materials (FR89)
 *
 * Per DL-001 (2026-05-02), the Kitchen Manager must START the production
 * order deliberately — this surface exists separately from SI-PRO-003 PO
 * detail to honour that deliberateness. The transition is irreversible
 * except via a compensating record (FR117).
 *
 * Reuses LifecycleStepper via its prop-driven `steps` API — the new
 * PRODUCTION_ORDER_LIFECYCLE_STEPS export drives the 5-step DL-001
 * sequence (Draft → Pending GR → Confirmed → In Progress → Completed).
 *
 * Cross-cutting:
 *   - CC-TRN-DISPLAY (header + journal preview)
 *   - CC-AUDIT-LINK (header + footer trail)
 *   - CC-PROVISIONAL-FLAG (deduction summary + journal preview)
 *
 * No animation per CLAUDE.md animation policy + DESIGN.md §10.3.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Static fixture
// ─────────────────────────────────────────────────────────────────────────────

const PO_REFERENCE = 'PRO-2026-CKB-00187'
const PO_TRN = 'TRN-PRO-2026-05-00187'
const JOURNAL_TRN = 'TRN-JV-2026-05-00187'
const RECIPE_ID = 'rec-rasmalai'
const BATCH_SIZE = 30 // 30 plates of Saffron Rasmalai
const TARGET_DEPARTMENT = 'Bakery & Pastry · Central Kitchen Bandra'
const SCHEDULED_DATE = '2026-05-07'
const SCHEDULED_AT = '2026-05-07T14:30:00+05:30'

// Per-ingredient batch fixture (FEFO ordered — earliest expiry first).
// Two of the four ingredient lines (milk, almond) carry a Pending-GR
// provisional cost basis per FR66 / FR67a so the screen exercises
// CC-PROVISIONAL-FLAG without requiring a recipe-level provisional.
interface BatchSlice {
  readonly batch_ref: string
  readonly expiry_on: string
  readonly qty: number
}

interface DeductionLine {
  readonly material_id: string
  readonly batches: ReadonlyArray<BatchSlice>
  readonly provisional: boolean
  readonly provisional_source_po?: string
}

const FIXTURE_DEDUCTION: ReadonlyArray<DeductionLine> = [
  {
    material_id: 'mat-milk',
    // 30 plates × 0.25 l/plate = 7.5 l — split across 3 FEFO lots
    batches: [
      { batch_ref: 'GR-2026-04-2188 · Lot A', expiry_on: '2026-05-08', qty: 3.0 },
      { batch_ref: 'GR-2026-04-2204 · Lot B', expiry_on: '2026-05-09', qty: 3.0 },
      { batch_ref: 'GR-2026-05-0011 · Lot C', expiry_on: '2026-05-11', qty: 1.5 },
    ],
    provisional: true,
    provisional_source_po: 'PO-2026-DAIRY-0188',
  },
  {
    material_id: 'mat-sugar',
    // 30 × 0.04 kg = 1.2 kg — single lot (shelf-stable)
    batches: [
      { batch_ref: 'GR-2026-04-1980 · Lot A', expiry_on: '2027-04-30', qty: 1.2 },
    ],
    provisional: false,
  },
  {
    material_id: 'mat-saffron',
    // 30 × 0.1 g = 3 g — split across 2 FEFO lots
    batches: [
      { batch_ref: 'GR-2026-03-1422 · Lot A', expiry_on: '2026-09-15', qty: 2.0 },
      { batch_ref: 'GR-2026-04-2014 · Lot B', expiry_on: '2026-12-20', qty: 1.0 },
    ],
    provisional: false,
  },
  {
    material_id: 'mat-almond',
    // 30 × 0.005 kg = 0.15 kg — split across 2 FEFO lots
    batches: [
      { batch_ref: 'GR-2026-04-2102 · Lot A', expiry_on: '2026-08-04', qty: 0.10 },
      { batch_ref: 'GR-2026-05-0009 · Lot B', expiry_on: '2026-09-12', qty: 0.05 },
    ],
    provisional: true,
    provisional_source_po: 'PO-2026-DRYFRT-0091',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Lookups + derived helpers
// ─────────────────────────────────────────────────────────────────────────────

const materialById = (id: string) => materials.find((m) => m.id === id)
const recipeById = (id: string) => recipes.find((r) => r.id === id)

const HERO_RECIPE = recipeById(RECIPE_ID)!

function totalForLine(line: DeductionLine): number {
  return line.batches.reduce((acc, b) => acc + b.qty, 0)
}

function lineValueOf(line: DeductionLine): number {
  const mat = materialById(line.material_id)
  if (!mat) return 0
  return Math.round(totalForLine(line) * mat.lkp_per_uom)
}

function recipeIngredientFor(materialId: string): RecipeIngredient | undefined {
  return HERO_RECIPE.ingredients.find((ing) => ing.material_id === materialId)
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface HeaderMetaProps {
  readonly label: string
  readonly value: React.ReactNode
  readonly icon?: React.ReactNode
}

function HeaderMeta({ label, value, icon }: HeaderMetaProps) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant inline-flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className="text-sm text-on-surface truncate">{value}</span>
    </div>
  )
}

interface INRValueProps {
  readonly value: number
  readonly emphasis?: 'default' | 'hero'
}

/** Mirrors the SI-ACC-003 INRValue helper — ₹ rule per DESIGN.md §7.4. */
function INRValue({ value, emphasis = 'default' }: INRValueProps) {
  return (
    <span
      className={[
        'tabular-nums',
        emphasis === 'hero'
          ? 'font-semibold text-lg tablet:text-xl text-on-surface'
          : 'text-on-surface',
      ].join(' ')}
    >
      {formatINR(value)}
    </span>
  )
}

interface BatchListProps {
  readonly batches: ReadonlyArray<BatchSlice>
  readonly uom: string
}

/** FEFO-ordered batch list (earliest expiry first per FR31). */
function BatchList({ batches, uom }: BatchListProps) {
  return (
    <ul className="flex flex-col gap-1">
      {batches.map((b, idx) => (
        <li key={b.batch_ref} className="flex flex-wrap items-center gap-1.5">
          <span
            aria-hidden
            className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-pill bg-surface-container-high px-1 text-[10px] font-medium text-on-surface-variant tabular-nums"
            title={`FEFO order ${idx + 1}`}
          >
            {idx + 1}
          </span>
          <span className="font-mono text-[11px] text-on-surface">
            {b.batch_ref}
          </span>
          <span className="text-[11px] text-on-surface-variant tabular-nums">
            {b.qty} {uom}
          </span>
          <span className="text-[11px] text-on-surface-variant">
            · expires{' '}
            <span className="tabular-nums">{b.expiry_on}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiPro011() {
  const [acknowledged, setAcknowledged] = useState(false)

  const totalDeductionValue = useMemo(
    () => FIXTURE_DEDUCTION.reduce((acc, line) => acc + lineValueOf(line), 0),
    [],
  )

  const hasProvisional = FIXTURE_DEDUCTION.some((l) => l.provisional)

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Production · Lifecycle transition
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-3">
                <h1 className="text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
                  Start production
                </h1>
                <StatusPill status="status_confirmed" label="Confirmed" />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <TrnDisplay trn={PO_TRN} />
                <AuditLink entityRef={PO_REFERENCE} />
              </div>
              <p className="mt-3 text-sm text-on-surface-variant max-w-[68ch]">
                Confirm the Confirmed → In Progress transition. This deducts
                stock per FEFO and fires the COGS journal atomically. Once
                started, the transition can only be reversed via a
                compensating record (FR117).
              </p>
            </div>
          </div>

          {/* PO context strip */}
          <div className="grid grid-cols-2 tablet:grid-cols-3 desktop:grid-cols-6 gap-4 rounded-md bg-surface-container-lowest p-4">
            <HeaderMeta
              label="PO reference"
              icon={<ClipboardList className="h-3 w-3" aria-hidden />}
              value={
                <span className="font-mono text-xs text-on-surface">
                  {PO_REFERENCE}
                </span>
              }
            />
            <HeaderMeta
              label="Recipe"
              icon={<ChefHat className="h-3 w-3" aria-hidden />}
              value={
                <span title={HERO_RECIPE.name}>
                  {HERO_RECIPE.name}
                </span>
              }
            />
            <HeaderMeta
              label="Recipe version"
              icon={<Layers className="h-3 w-3" aria-hidden />}
              value={
                <span className="font-mono text-xs">
                  {HERO_RECIPE.current_default_version}
                </span>
              }
            />
            <HeaderMeta
              label="Batch size"
              icon={<Layers className="h-3 w-3" aria-hidden />}
              value={
                <span className="tabular-nums">
                  {BATCH_SIZE} {HERO_RECIPE.yield_unit}s
                </span>
              }
            />
            <HeaderMeta
              label="Target department"
              icon={<MapPin className="h-3 w-3" aria-hidden />}
              value={TARGET_DEPARTMENT}
            />
            <HeaderMeta
              label="Scheduled"
              icon={<CalendarDays className="h-3 w-3" aria-hidden />}
              value={
                <span className="tabular-nums">
                  {SCHEDULED_AT.replace('T', ' · ').slice(0, 16)} IST
                </span>
              }
            />
          </div>
        </header>

        {/* Lifecycle transition preview */}
        <section
          aria-label="Lifecycle transition preview"
          className="mt-6 rounded-md bg-surface-container-lowest p-4 tablet:p-5"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h2 className="text-base font-semibold text-on-surface">
              Lifecycle transition
            </h2>
            <p className="text-[11px] text-on-surface-variant">
              DL-001 production-order path · 5 canonical states
            </p>
          </div>
          <LifecycleStepper
            status="confirmed"
            steps={PRODUCTION_ORDER_LIFECYCLE_STEPS}
          />
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-sm bg-surface-container-low px-3 py-3">
            <span
              role="status"
              aria-label="Next step preview — In Progress"
              className="inline-flex items-center gap-1.5 rounded-pill px-2 py-1 text-[11px] font-medium uppercase tracking-wider"
              style={{
                backgroundColor: tokens.warning,
                color: tokens.on_warning,
              }}
            >
              <Zap className="h-3 w-3" aria-hidden />
              Stock deducts at next step
            </span>
            <span className="text-sm text-on-surface inline-flex flex-wrap items-center gap-1.5">
              On confirm, status moves
              <StatusPill status="status_confirmed" size="sm" label="Confirmed" />
              <ArrowRight
                className="h-3.5 w-3.5 text-on-surface-variant"
                aria-hidden
              />
              <StatusPill
                status="status_in_progress"
                size="sm"
                label="In Progress"
              />
            </span>
            <span className="ml-auto text-[11px] text-on-surface-variant">
              FR68 deduction + FR89 COGS journal fire atomically
            </span>
          </div>
        </section>

        {/* Two-column layout: deduction summary + journal preview */}
        <div className="mt-6 grid grid-cols-1 desktop:grid-cols-3 gap-6">
          {/* Ingredient deduction summary */}
          <section
            aria-label="Ingredient deduction summary"
            className="desktop:col-span-2 flex flex-col gap-3"
          >
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-on-surface">
                Ingredient deduction summary
                <span className="ml-2 text-[11px] font-normal text-on-surface-variant">
                  ({FIXTURE_DEDUCTION.length} lines · FEFO-ordered per FR31)
                </span>
              </h2>
              <span className="text-[11px] text-on-surface-variant">
                Service-layer enforcement · this surface initiates, does not
                compute
              </span>
            </header>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead className="text-right">Deduction</TableHead>
                  <TableHead>Source batches · expiry (FEFO)</TableHead>
                  <TableHead className="text-right">Unit cost</TableHead>
                  <TableHead className="text-right">Line value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {FIXTURE_DEDUCTION.map((line) => {
                  const mat = materialById(line.material_id)
                  const matName = mat?.name ?? line.material_id
                  const ingredient = recipeIngredientFor(line.material_id)
                  const totalQty = totalForLine(line)
                  const uom = mat?.uom ?? ingredient?.uom ?? 'kg'
                  return (
                    <TableRow key={line.material_id}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-medium text-on-surface">
                            {matName}
                          </span>
                          <span className="text-[11px] text-on-surface-variant">
                            {mat?.category ?? '—'}
                            {ingredient
                              ? ` · ${ingredient.qty} ${ingredient.uom} per plate × ${BATCH_SIZE}`
                              : null}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="tabular-nums font-medium text-on-surface">
                          {totalQty} {uom}
                        </span>
                      </TableCell>
                      <TableCell>
                        <BatchList batches={line.batches} uom={uom} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="tabular-nums text-on-surface">
                            {formatINR(mat?.lkp_per_uom ?? 0)} / {uom}
                          </span>
                          {line.provisional ? (
                            <ProvisionalFlag size="sm" />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-on-surface">
                        {formatINR(lineValueOf(line))}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>

            {/* Total deduction value */}
            <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3 rounded-md bg-surface-container-lowest p-4 tablet:p-5">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Total deduction
                </span>
                <span className="text-[11px] text-on-surface-variant">
                  Cumulative raw-material value about to be deducted · drives
                  the FR89 COGS journal entry
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <INRValue value={totalDeductionValue} emphasis="hero" />
                {hasProvisional ? <ProvisionalFlag size="sm" /> : null}
              </div>
            </div>
          </section>

          {/* Side rail: journal preview */}
          <aside className="flex flex-col gap-6">
            <section
              aria-label="COGS journal preview"
              className="rounded-md bg-surface-container-lowest p-4 tablet:p-5"
            >
              <header className="mb-3 flex items-baseline justify-between">
                <h2 className="text-base font-semibold text-on-surface">
                  Journal preview
                </h2>
                <span className="text-[11px] text-on-surface-variant">
                  FR89
                </span>
              </header>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  TRN
                </span>
                <TrnDisplay trn={JOURNAL_TRN} copyable={false} />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">DR</TableHead>
                    <TableHead className="text-right">CR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-on-surface">
                          COGS — Raw Material Consumption
                        </span>
                        <span className="text-[11px] text-on-surface-variant">
                          Recognised at start of production per FR89
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-on-surface">
                      {formatINR(totalDeductionValue)}
                    </TableCell>
                    <TableCell className="text-right text-on-surface-variant">
                      —
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-on-surface">
                          Inventory — Raw Materials
                        </span>
                        {hasProvisional ? <ProvisionalFlag size="sm" /> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-on-surface-variant">
                      —
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-on-surface">
                      {formatINR(totalDeductionValue)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              {hasProvisional ? (
                <p className="mt-2 text-[11px] text-on-surface-variant">
                  Provisional cost — adjusted on GR confirmation per FR67. Two
                  ingredient lines (milk, almond) are sourced against
                  Pending-GR POs; the journal value will reconcile when those
                  GRs confirm.
                </p>
              ) : null}
            </section>

            {/* Activity timeline drill */}
            <section
              aria-label="Activity timeline preview"
              className="rounded-md bg-surface-container-lowest p-4 tablet:p-5"
            >
              <header className="mb-3 flex items-baseline justify-between">
                <h2 className="text-base font-semibold text-on-surface">
                  Activity timeline
                </h2>
                <span className="text-[11px] text-on-surface-variant">
                  CC-AUDIT-LINK
                </span>
              </header>
              <p className="text-sm text-on-surface-variant">
                Last event · Approval routed and confirmed{' '}
                <span className="tabular-nums text-on-surface">
                  {SCHEDULED_DATE}
                </span>
                {' '}at 11:42 IST by Aanya Khanna (Brand Owner).
              </p>
              <div className="mt-3">
                <AuditLink entityRef={PO_REFERENCE} />
              </div>
            </section>
          </aside>
        </div>

        {/* Confirmation banner — irreversibility warning */}
        <section
          role="alert"
          aria-label="Irreversibility warning"
          className="mt-6 rounded-md p-4 tablet:p-5"
          style={{
            backgroundColor: tokens.warning,
            color: tokens.on_warning,
          }}
        >
          <div className="flex flex-wrap items-start gap-3">
            <AlertTriangle
              className="h-5 w-5 mt-0.5 shrink-0"
              aria-hidden
            />
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <p className="text-sm font-semibold">
                This action deducts stock and fires the COGS journal. It
                cannot be undone except via a compensating record (FR117).
              </p>
              <p className="text-[13px]">
                Stock movements per FR68 and the COGS journal per FR89 fire
                atomically — both succeed together, or neither persists.
                Cancellation after this point requires a compensating
                production-order reversal logged against the same TRN.
              </p>
            </div>
          </div>
        </section>

        {/* Action row */}
        <section
          aria-label="Confirmation actions"
          className="mt-6 flex flex-col gap-3 rounded-md bg-surface-container-lowest p-4 tablet:p-5"
        >
          <label
            htmlFor="acknowledge-irrev"
            className="flex flex-wrap items-start gap-3 cursor-pointer"
          >
            <input
              id="acknowledge-irrev"
              type="checkbox"
              checked={acknowledged}
              onChange={(ev) => setAcknowledged(ev.target.checked)}
              aria-describedby="acknowledge-irrev-hint"
              className="mt-1 h-4 w-4 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
            <span className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="text-sm font-medium text-on-surface">
                I understand this action is irreversible
              </span>
              <span
                id="acknowledge-irrev-hint"
                className="text-[11px] text-on-surface-variant"
              >
                Acknowledges the deliberateness requirement per DL-001 — stock
                deducts at FEFO and the COGS journal posts atomically.
              </span>
            </span>
          </label>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Link to="/SI-PUR-003">
              <Button variant="ghost" size="default" className="min-h-[44px]">
                Cancel
              </Button>
            </Link>
            <Button
              variant="default"
              size="default"
              disabled={!acknowledged}
              aria-disabled={!acknowledged}
              title={
                acknowledged
                  ? 'Atomic — stock deduction (FR68) + COGS journal (FR89) fire together'
                  : 'Acknowledge irreversibility above to enable'
              }
              className="gap-1.5 min-h-[44px]"
            >
              <Play className="h-4 w-4" aria-hidden />
              Confirm — Start production
            </Button>
          </div>
        </section>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <FileText className="h-3 w-3" aria-hidden />
          <span>
            SI-PRO-011 · Tier 1 Group 2 hybrid-widening · Phase 2c-S4 ·
            Source: FR66, FR68, FR87, FR89, FR117 · DL-001 Production Order
            lifecycle ·{' '}
            <Link to="/SI-PRO-010" className="text-primary hover:underline">
              → SI-PRO-010 output entry
            </Link>{' '}
            ·{' '}
            <Link to="/SI-INF-005" className="text-primary hover:underline">
              → SI-INF-005 audit
            </Link>
          </span>
        </footer>
      </div>
    </div>
  )
}

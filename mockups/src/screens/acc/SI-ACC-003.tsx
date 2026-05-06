import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  CalendarRange,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  TriangleAlert,
} from 'lucide-react'

import {
  Button,
  DashboardTile,
  ExportTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionShift,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TrnDisplay,
} from '@/shell'

import { formatINR } from '@/lib/sample-data'

/**
 * SI-ACC-003 — Trial Balance.
 *
 * Tier 1 Group 1, screen 5 of Phase 2c-S3. First report INSTANCE in the
 * mockup harness — establishes the canonical "account-tree" report layout
 * that P&L (SI-ACC-004), Balance Sheet (SI-ACC-005), and Cash Flow
 * (SI-ACC-006) will reuse: rows grouped by account type, group sub-totals
 * via tonal `surface_container` rows (NEVER a top border per §5.2),
 * balanced footer with `success` chrome.
 *
 * Renders from the FR90 internal ledger (service-layer only — see
 * inventory line 4762). The Trial Balance does NOT expose ledger-row
 * create/edit; those are locked to the auto-journal service and the
 * manual journal voucher SI-ACC-014.
 *
 * NO CC-AUDIT-LINK per inventory line 4762 — Trial Balance is a
 * read-only report. Audit affordances live on the source transaction
 * detail screens (PO, GR, B2B challan).
 *
 * CC-EXPORT-TRIGGER applies with FR107 formats (CSV / Excel / PDF). The
 * Tally / Zoho / Generic CSV multi-format set is reserved for SI-ACC-011
 * (Accountant Handoff Exports) — NOT here.
 *
 * CC-TRN-DISPLAY (FR87) appears in the inline journal-ledger drill-down:
 * every journal entry exposes its TRN with a copy-to-clipboard button.
 * The TRN links back to the source transaction detail screen (PO →
 * /SI-PUR-003, GR → /SI-PRO-009 stub, B2B → /SI-DSP-007 stub).
 *
 * Animation policy — NO entrance animations on the table per CLAUDE.md.
 * Tailwind hover transitions only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Period selector — month / quarter / custom
// ─────────────────────────────────────────────────────────────────────────────

type PeriodKey = 'apr_2026' | 'q4_fy26' | 'custom'

const PERIOD_LABEL: Record<PeriodKey, string> = {
  apr_2026: 'April 2026 (current)',
  q4_fy26: 'Q4 FY 25-26',
  custom: 'Custom range',
}

const PERIOD_RANGE: Record<PeriodKey, { from: string; to: string; short: string }> = {
  apr_2026: { from: '2026-04-01', to: '2026-04-30', short: 'Apr 2026' },
  q4_fy26: { from: '2026-01-01', to: '2026-03-31', short: 'Q4 FY 25-26' },
  custom: { from: '2026-04-15', to: '2026-04-30', short: 'Custom · 15–30 Apr' },
}

// ─────────────────────────────────────────────────────────────────────────────
// Scope selector — brand / cluster / location
// ─────────────────────────────────────────────────────────────────────────────

type ScopeLevel = 'brand' | 'cluster_andheri' | 'cluster_bandra' | 'loc_kemps_corner'

const SCOPE_LABEL: Record<ScopeLevel, string> = {
  brand: 'Brand-wide',
  cluster_andheri: 'Cluster · Andheri-East',
  cluster_bandra: 'Cluster · Bandra',
  loc_kemps_corner: 'Kemps Corner outlet',
}

// ─────────────────────────────────────────────────────────────────────────────
// Account types — closed set, drives row grouping
// ─────────────────────────────────────────────────────────────────────────────

type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expenses',
}

const ACCOUNT_TYPE_ORDER: ReadonlyArray<AccountType> = [
  'asset',
  'liability',
  'equity',
  'revenue',
  'expense',
]

const ACCOUNT_TYPE_ANCHOR: Record<AccountType, string> = {
  asset: 'group-assets',
  liability: 'group-liabilities',
  equity: 'group-equity',
  revenue: 'group-revenue',
  expense: 'group-expenses',
}

// ─────────────────────────────────────────────────────────────────────────────
// Row + journal-entry shapes — typed rigorously
// ─────────────────────────────────────────────────────────────────────────────

interface AccountRow {
  readonly code: string
  readonly name: string
  readonly type: AccountType
  readonly opening: number
  readonly debit: number
  readonly credit: number
  readonly closing: number
  /** Closing balance from the prior period for variance calc. */
  readonly priorClosing: number | null
}

type SourceTrnTarget = 'po' | 'gr' | 'b2b' | 'jv'

const TRN_ROUTE: Record<SourceTrnTarget, string> = {
  po: '/SI-PUR-003',
  gr: '/SI-PRO-009',
  b2b: '/SI-DSP-007',
  jv: '/SI-ACC-014',
}

const TRN_LABEL: Record<SourceTrnTarget, string> = {
  po: 'Purchase Order',
  gr: 'Goods Receipt',
  b2b: 'B2B Challan',
  jv: 'Journal Voucher',
}

interface JournalEntry {
  readonly trn: string
  readonly trnTarget: SourceTrnTarget
  readonly date: string
  readonly narration: string
  readonly debit: number
  readonly credit: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Variance rule
//
// Per task brief: a row is `warning` when |closing − priorClosing| / priorClosing
// exceeds 10 %, and `error` when it exceeds 25 %. Rows with no priorClosing
// (e.g. Current Year Profit, Owner's Capital that hasn't moved) carry no flag.
// Imbalanced footer state is built FALSE by default — flip the
// `BALANCED_FIXTURE` toggle below in dev to preview the error-state chrome.
// ─────────────────────────────────────────────────────────────────────────────

type VarianceFlag = 'none' | 'warning' | 'error'

function variance(row: AccountRow): { pct: number | null; flag: VarianceFlag } {
  if (row.priorClosing == null || row.priorClosing === 0) {
    return { pct: null, flag: 'none' }
  }
  const pct = ((row.closing - row.priorClosing) / row.priorClosing) * 100
  const abs = Math.abs(pct)
  if (abs > 25) return { pct, flag: 'error' }
  if (abs > 10) return { pct, flag: 'warning' }
  return { pct, flag: 'none' }
}

// Toggle to FALSE to preview the imbalanced footer. Production fixture stays balanced.
const BALANCED_FIXTURE = true

// ─────────────────────────────────────────────────────────────────────────────
// Wild Sugar chart-of-accounts fixture — April 2026, brand-wide.
//
// Realistic Indian COA conventions. Numbers are plausible for a 9-store
// premium-bakery retail brand: ~₹62 L monthly revenue, ~30.7 % food cost,
// ~₹17.6 L net profit. Postings are derived from a balanced double-entry
// journal — total period debits = total period credits = ₹2,10,92,000.
//
// Sign convention: positive opening / closing for debit-natured accounts
// (assets, expenses); negative for credit-natured (liabilities, equity,
// revenue, accumulated depreciation as contra-asset).
//
// Current Year Profit (3200) shows zero movement — at interim TB the P&L
// accounts have not yet been closed to equity; that posting fires only at
// year-end. The reader sees revenue and expense balances open.
// ─────────────────────────────────────────────────────────────────────────────

const COA: ReadonlyArray<AccountRow> = [
  // Assets ────────────────────────────────────────────────────────────────────
  { code: '1000', name: 'Cash & Bank', type: 'asset', opening: 4_850_000, debit: 5_524_000, credit: 3_936_000, closing: 6_438_000, priorClosing: 4_850_000 },
  { code: '1010', name: 'Accounts Receivable', type: 'asset', opening: 1_840_000, debit: 1_780_000, credit: 1_100_000, closing: 2_520_000, priorClosing: 1_840_000 },
  { code: '1020', name: 'GST Receivable', type: 'asset', opening: 320_000, debit: 412_000, credit: 0, closing: 732_000, priorClosing: 320_000 },
  { code: '1100', name: 'Raw Material Inventory', type: 'asset', opening: 1_640_000, debit: 1_840_000, credit: 1_980_000, closing: 1_500_000, priorClosing: 1_640_000 },
  { code: '1110', name: 'WIP Inventory', type: 'asset', opening: 320_000, debit: 1_980_000, credit: 1_950_000, closing: 350_000, priorClosing: 320_000 },
  { code: '1120', name: 'Finished Goods Inventory', type: 'asset', opening: 580_000, debit: 1_950_000, credit: 1_904_000, closing: 626_000, priorClosing: 580_000 },
  { code: '1200', name: 'Prepaid Expenses', type: 'asset', opening: 240_000, debit: 0, credit: 20_000, closing: 220_000, priorClosing: 240_000 },
  { code: '1300', name: 'Plant & Equipment', type: 'asset', opening: 8_400_000, debit: 0, credit: 0, closing: 8_400_000, priorClosing: 8_400_000 },
  { code: '1310', name: 'Accumulated Depreciation', type: 'asset', opening: -1_260_000, debit: 0, credit: 70_000, closing: -1_330_000, priorClosing: -1_260_000 },

  // Liabilities ───────────────────────────────────────────────────────────────
  { code: '2000', name: 'Accounts Payable', type: 'liability', opening: -1_480_000, debit: 1_350_000, credit: 2_356_000, closing: -2_486_000, priorClosing: -1_480_000 },
  { code: '2010', name: 'GST Payable', type: 'liability', opening: -640_000, debit: 580_000, credit: 412_000, closing: -472_000, priorClosing: -640_000 },
  { code: '2020', name: 'TDS Payable', type: 'liability', opening: -84_000, debit: 84_000, credit: 0, closing: 0, priorClosing: -84_000 },
  { code: '2100', name: 'Salary Payable', type: 'liability', opening: -780_000, debit: 780_000, credit: 1_160_000, closing: -1_160_000, priorClosing: -780_000 },
  { code: '2110', name: 'Statutory Payable (PF, ESI)', type: 'liability', opening: -148_000, debit: 148_000, credit: 0, closing: 0, priorClosing: -148_000 },
  { code: '2200', name: 'Short-Term Loans', type: 'liability', opening: -2_400_000, debit: 200_000, credit: 0, closing: -2_200_000, priorClosing: -2_400_000 },

  // Equity ────────────────────────────────────────────────────────────────────
  { code: '3000', name: "Owner's Capital", type: 'equity', opening: -8_000_000, debit: 0, credit: 0, closing: -8_000_000, priorClosing: -8_000_000 },
  { code: '3100', name: 'Retained Earnings', type: 'equity', opening: -3_398_000, debit: 0, credit: 0, closing: -3_398_000, priorClosing: -3_398_000 },
  { code: '3200', name: 'Current Year Profit', type: 'equity', opening: 0, debit: 0, credit: 0, closing: 0, priorClosing: null },

  // Revenue ───────────────────────────────────────────────────────────────────
  { code: '4000', name: 'POS Sales', type: 'revenue', opening: 0, debit: 0, credit: 4_280_000, closing: -4_280_000, priorClosing: -3_840_000 },
  { code: '4010', name: 'B2B Sales', type: 'revenue', opening: 0, debit: 0, credit: 1_780_000, closing: -1_780_000, priorClosing: -1_240_000 },
  { code: '4020', name: 'Other Income', type: 'revenue', opening: 0, debit: 0, credit: 144_000, closing: -144_000, priorClosing: -156_000 },

  // Expenses ──────────────────────────────────────────────────────────────────
  { code: '5000', name: 'Raw Material Consumption (COGS)', type: 'expense', opening: 0, debit: 1_904_000, credit: 0, closing: 1_904_000, priorClosing: 1_680_000 },
  { code: '5010', name: 'Production Wages', type: 'expense', opening: 0, debit: 540_000, credit: 0, closing: 540_000, priorClosing: 520_000 },
  { code: '5020', name: 'Production Overheads', type: 'expense', opening: 0, debit: 296_000, credit: 0, closing: 296_000, priorClosing: 280_000 },
  { code: '5100', name: 'Rent', type: 'expense', opening: 0, debit: 500_000, credit: 0, closing: 500_000, priorClosing: 480_000 },
  { code: '5110', name: 'Utilities', type: 'expense', opening: 0, debit: 184_000, credit: 0, closing: 184_000, priorClosing: 168_000 },
  { code: '5120', name: 'Salaries', type: 'expense', opening: 0, debit: 620_000, credit: 0, closing: 620_000, priorClosing: 620_000 },
  { code: '5130', name: 'Marketing', type: 'expense', opening: 0, debit: 220_000, credit: 0, closing: 220_000, priorClosing: 96_000 },
  { code: '5140', name: 'Logistics', type: 'expense', opening: 0, debit: 116_000, credit: 0, closing: 116_000, priorClosing: 124_000 },
  { code: '5150', name: 'Depreciation', type: 'expense', opening: 0, debit: 70_000, credit: 0, closing: 70_000, priorClosing: 70_000 },
  { code: '5160', name: 'Bank Charges', type: 'expense', opening: 0, debit: 14_000, credit: 0, closing: 14_000, priorClosing: 12_000 },
]

// ─────────────────────────────────────────────────────────────────────────────
// Per-account journal-entry fixtures (drill-down content).
//
// Three accounts get plausible entries; the rest fall back to the empty
// state ("No journal entries for this account in {period}.") to demonstrate
// that path. Real lookups live in the FR90 internal-ledger service.
// ─────────────────────────────────────────────────────────────────────────────

const JOURNAL_ENTRIES: Record<string, ReadonlyArray<JournalEntry>> = {
  '1000': [
    { trn: 'TRN-POS-2026-04-001', trnTarget: 'jv', date: '2026-04-30', narration: 'POS daily sales sweep · all outlets', debit: 4_280_000, credit: 0 },
    { trn: 'TRN-B2B-2026-04-014', trnTarget: 'b2b', date: '2026-04-28', narration: 'Marriott Powai · ₹ 6.4 L challan settlement', debit: 640_000, credit: 0 },
    { trn: 'TRN-JV-2026-04-022', trnTarget: 'jv', date: '2026-04-25', narration: 'Vendor payment · Western Ghats Wheat Co.', debit: 0, credit: 1_240_000 },
    { trn: 'TRN-JV-2026-04-031', trnTarget: 'jv', date: '2026-04-22', narration: 'Salary disbursement run', debit: 0, credit: 820_000 },
    { trn: 'TRN-B2B-2026-04-007', trnTarget: 'b2b', date: '2026-04-15', narration: 'ITC Grand Central · payment received', debit: 580_000, credit: 0 },
    { trn: 'TRN-JV-2026-04-008', trnTarget: 'jv', date: '2026-04-10', narration: 'Statutory payment · PF + ESI', debit: 0, credit: 162_000 },
    { trn: 'TRN-PUR-2026-04-019', trnTarget: 'po', date: '2026-04-08', narration: 'PO settlement · Mahabaleshwar Strawberry Co-op', debit: 0, credit: 320_000 },
  ],
  '2000': [
    { trn: 'TRN-PUR-2026-04-024', trnTarget: 'po', date: '2026-04-29', narration: 'PO raised · Coorg Specialty Spices', debit: 0, credit: 280_000 },
    { trn: 'TRN-GR-2026-04-038', trnTarget: 'gr', date: '2026-04-27', narration: 'GR receipted · Western Ghats Wheat Co.', debit: 0, credit: 420_000 },
    { trn: 'TRN-PUR-2026-04-019', trnTarget: 'po', date: '2026-04-08', narration: 'PO settlement · Mahabaleshwar Strawberry Co-op', debit: 320_000, credit: 0 },
    { trn: 'TRN-PUR-2026-04-002', trnTarget: 'po', date: '2026-04-04', narration: 'PO settlement · Krishna Valley Dairy', debit: 1_030_000, credit: 0 },
  ],
  '5000': [
    { trn: 'TRN-JV-2026-04-029', trnTarget: 'jv', date: '2026-04-30', narration: 'Production consumption sweep · WIP → COGS', debit: 1_904_000, credit: 0 },
  ],
  '4000': [
    { trn: 'TRN-JV-2026-04-001', trnTarget: 'jv', date: '2026-04-30', narration: 'POS daily sales aggregate · 30 days', debit: 0, credit: 4_280_000 },
  ],
  '4010': [
    { trn: 'TRN-B2B-2026-04-014', trnTarget: 'b2b', date: '2026-04-28', narration: 'Marriott Powai · 4 challans settled', debit: 0, credit: 640_000 },
    { trn: 'TRN-B2B-2026-04-007', trnTarget: 'b2b', date: '2026-04-15', narration: 'ITC Grand Central · weekly delivery', debit: 0, credit: 580_000 },
    { trn: 'TRN-B2B-2026-04-003', trnTarget: 'b2b', date: '2026-04-09', narration: 'Taj Lands End · Easter hamper drop', debit: 0, credit: 560_000 },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function INRValue({ value }: { value: number }) {
  // §7.4 ₹ rule — symbol on_surface_variant, digits on_surface.
  const formatted = formatINR(value)
  const isNeg = formatted.startsWith('-')
  const body = isNeg ? formatted.slice(1) : formatted
  const symbolPart = body.slice(0, 2)
  const digitsPart = body.slice(2)
  return (
    <>
      <span className="text-on-surface-variant">
        {isNeg ? '-' : ''}
        {symbolPart}
      </span>
      <span>{digitsPart}</span>
    </>
  )
}

function INRDigits({ value }: { value: number }) {
  // For columns where opening / debit / credit / closing are predominantly
  // numeric — the ₹ symbol stays in the column header for density.
  const formatted = formatINR(value, { withSymbol: false })
  return <span className="tabular-nums">{formatted}</span>
}

function formatPctSigned(pct: number, digits = 1): string {
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct.toFixed(digits)} %`
}

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components — local to the screen (per task brief, do not extract yet)
// ─────────────────────────────────────────────────────────────────────────────

function PeriodPicker({
  value,
  onChange,
}: {
  value: PeriodKey
  onChange: (v: PeriodKey) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="tonal" size="sm" className="h-9 px-3 gap-1.5 rounded-pill">
          <CalendarRange className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Period
          </span>
          <span className="text-xs font-medium text-on-surface">
            {PERIOD_LABEL[value]}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Quick presets
        </p>
        <ul className="flex flex-col">
          {(Object.keys(PERIOD_LABEL) as ReadonlyArray<PeriodKey>).map((opt) => {
            const active = opt === value
            const range = PERIOD_RANGE[opt]
            return (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                  className={[
                    'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between gap-3 min-h-[44px]',
                    'hover:bg-surface-container-high transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active ? 'bg-surface-container' : '',
                  ].join(' ')}
                >
                  <span className="flex flex-col">
                    <span className="text-sm text-on-surface">{PERIOD_LABEL[opt]}</span>
                    <span className="text-[11px] text-on-surface-variant tabular-nums">
                      {range.from} → {range.to}
                    </span>
                  </span>
                  {active ? (
                    <span className="text-xs font-medium text-primary">Active</span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

function ScopePicker({
  value,
  onChange,
}: {
  value: ScopeLevel
  onChange: (v: ScopeLevel) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="tonal" size="sm" className="h-9 px-3 gap-1.5 rounded-pill">
          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Scope
          </span>
          <span className="text-xs font-medium text-on-surface">{SCOPE_LABEL[value]}</span>
          <ChevronDown className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1">
        <ul className="flex flex-col">
          {(Object.keys(SCOPE_LABEL) as ReadonlyArray<ScopeLevel>).map((opt) => {
            const active = opt === value
            return (
              <li key={opt}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                  className={[
                    'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between min-h-[44px]',
                    'hover:bg-surface-container-high transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active ? 'bg-surface-container' : '',
                  ].join(' ')}
                >
                  <span className="text-sm text-on-surface">{SCOPE_LABEL[opt]}</span>
                  {active ? (
                    <span className="text-xs font-medium text-primary">Active</span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

// CC-TRN-DISPLAY (FR87) — now sourced from `@/shell/TrnDisplay`. Promoted
// from this screen during SI-ACC-013 build (Phase 2c-S3 Task 6) so the
// Integration Status Dashboard can reuse the same visual contract.

interface JournalDrillProps {
  readonly accountCode: string
  readonly accountName: string
  readonly periodLabel: string
  readonly columns: number
}

function JournalDrill({
  accountCode,
  accountName,
  periodLabel,
  columns,
}: JournalDrillProps) {
  const entries = JOURNAL_ENTRIES[accountCode] ?? []
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={columns} className="bg-surface-container-low p-0">
        <div className="px-6 py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-on-surface">
              Journal entries · {accountCode} {accountName}
            </p>
            <p className="text-xs text-on-surface-variant">
              {periodLabel} · {entries.length} entries
            </p>
          </div>

          {entries.length === 0 ? (
            <div className="mt-3 rounded-md bg-surface-container-lowest px-4 py-6 text-center">
              <p className="text-sm text-on-surface-variant">
                No journal entries for this account in {periodLabel}.
              </p>
            </div>
          ) : (
            <div className="mt-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      TRN
                    </TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      Source
                    </TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      Date
                    </TableHead>
                    <TableHead className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      Narration
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      Debit ₹
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      Credit ₹
                    </TableHead>
                    <TableHead className="w-12 text-right" aria-label="Open source" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((e) => (
                    <TableRow key={e.trn}>
                      <TableCell>
                        <TrnDisplay trn={e.trn} />
                      </TableCell>
                      <TableCell className="text-xs text-on-surface-variant">
                        {TRN_LABEL[e.trnTarget]}
                      </TableCell>
                      <TableCell className="text-xs text-on-surface-variant tabular-nums">
                        {formatDateShort(e.date)}
                      </TableCell>
                      <TableCell className="text-sm text-on-surface">{e.narration}</TableCell>
                      <TableCell className="text-right text-sm text-on-surface tabular-nums">
                        {e.debit > 0 ? <INRDigits value={e.debit} /> : <span className="text-on-surface-variant">—</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm text-on-surface tabular-nums">
                        {e.credit > 0 ? <INRDigits value={e.credit} /> : <span className="text-on-surface-variant">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          to={`${TRN_ROUTE[e.trnTarget]}?trn=${e.trn}`}
                          aria-label={`Open ${TRN_LABEL[e.trnTarget]} ${e.trn}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-on-surface-variant hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <ArrowUpRight className="h-4 w-4" aria-hidden />
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const COLUMN_COUNT = 8 // pip + code + name + opening + debit + credit + closing + drill

export default function SiAcc003() {
  const [period, setPeriod] = useState<PeriodKey>('apr_2026')
  const [scope, setScope] = useState<ScopeLevel>('brand')
  const [expandedCode, setExpandedCode] = useState<string | null>(null)

  const periodLabel = PERIOD_LABEL[period]
  const periodShort = PERIOD_RANGE[period].short

  // Group rows by account type — preserve declaration order within each group.
  const groups = useMemo(() => {
    const buckets = new Map<AccountType, AccountRow[]>()
    for (const t of ACCOUNT_TYPE_ORDER) buckets.set(t, [])
    for (const r of COA) buckets.get(r.type)!.push(r)
    return ACCOUNT_TYPE_ORDER.map((t) => {
      const rows = buckets.get(t) ?? []
      const subtotalDebit = rows.reduce((acc, r) => acc + r.debit, 0)
      const subtotalCredit = rows.reduce((acc, r) => acc + r.credit, 0)
      const subtotalClosing = rows.reduce((acc, r) => acc + r.closing, 0)
      return { type: t, rows, subtotalDebit, subtotalCredit, subtotalClosing }
    })
  }, [])

  // Footer totals — debits = credits when fixture balanced.
  const totals = useMemo(() => {
    const debits = COA.reduce((acc, r) => acc + r.debit, 0)
    const credits = COA.reduce((acc, r) => acc + r.credit, 0)
    return { debits, credits, diff: debits - credits }
  }, [])

  const isBalanced = BALANCED_FIXTURE && totals.diff === 0

  // Tile aggregates — closing balances are signed (debit positive, credit
  // negative); display the absolute magnitude on the dashboard tiles.
  const totalAssets = useMemo(
    () => COA.filter((r) => r.type === 'asset').reduce((a, r) => a + r.closing, 0),
    [],
  )
  const totalLiabAndEquity = useMemo(
    () =>
      Math.abs(
        COA.filter((r) => r.type === 'liability' || r.type === 'equity').reduce(
          (a, r) => a + r.closing,
          0,
        ),
      ),
    [],
  )
  const totalRevenue = useMemo(
    () => Math.abs(COA.filter((r) => r.type === 'revenue').reduce((a, r) => a + r.closing, 0)),
    [],
  )
  const totalCogs = useMemo(
    () =>
      COA.filter((r) => r.type === 'expense' && r.code.startsWith('50')).reduce(
        (a, r) => a + r.closing,
        0,
      ),
    [],
  )
  const totalExpenses = useMemo(
    () => COA.filter((r) => r.type === 'expense').reduce((a, r) => a + r.closing, 0),
    [],
  )
  const netProfit = totalRevenue - totalExpenses

  const handleToggleRow = (code: string) => {
    setExpandedCode((current) => (current === code ? null : code))
  }

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-6 py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Accounting &amp; Financial · Period close
            </p>
            <h1 className="mt-1 text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Trial Balance
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Validates that revenue matches daily sales, COGS aligns with
              production consumption, and AP matches the purchase register
              before the period close. Renders from the FR90 internal
              ledger; read-only.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExportTrigger entityLabel="Trial Balance" formats={['csv', 'excel', 'pdf']} />
          </div>
        </header>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
          <span>Last refreshed: 6 May 2026, 09:42 IST</span>
          <span aria-hidden>·</span>
          <span>FR91 Trial Balance · {periodShort}</span>
          <span aria-hidden>·</span>
          <span>{SCOPE_LABEL[scope]}</span>
        </div>

        {/* Filter strip — period + scope */}
        <section
          aria-label="Trial Balance filters"
          className="mt-6 rounded-md bg-surface-container-low p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <PeriodPicker value={period} onChange={setPeriod} />
            <ScopePicker value={scope} onChange={setScope} />
            <span className="ml-auto text-xs text-on-surface-variant">
              Period: {PERIOD_RANGE[period].from} → {PERIOD_RANGE[period].to}
            </span>
          </div>
        </section>

        {/* Summary tiles — CC-DASHBOARD-TILE; click to scroll to group */}
        <section
          aria-label="Trial Balance summary"
          className="mt-6 grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-3"
        >
          <DashboardTile
            label="Total Assets"
            value={<INRValue value={totalAssets} />}
            secondary={<>Closing balance · click to view</>}
            to={`#${ACCOUNT_TYPE_ANCHOR.asset}`}
          />
          <DashboardTile
            label="Total Liabilities &amp; Equity"
            value={<INRValue value={totalLiabAndEquity} />}
            secondary={<>Closing balance · click to view</>}
            to={`#${ACCOUNT_TYPE_ANCHOR.liability}`}
          />
          <DashboardTile
            label="Total Revenue"
            value={<INRValue value={totalRevenue} />}
            secondary={<>{periodShort} · POS + B2B + other</>}
            to={`#${ACCOUNT_TYPE_ANCHOR.revenue}`}
          />
          <DashboardTile
            label="Total COGS"
            value={<INRValue value={totalCogs} />}
            secondary={
              <>
                {((totalCogs / totalRevenue) * 100).toFixed(1)} % of revenue
              </>
            }
            to={`#${ACCOUNT_TYPE_ANCHOR.expense}`}
          />
          <DashboardTile
            label="Net Profit"
            value={<INRValue value={netProfit} />}
            secondary={
              <>
                {((netProfit / totalRevenue) * 100).toFixed(1)} % margin · {periodShort}
              </>
            }
            severity={netProfit > 0 ? 'success' : 'error'}
            trend={netProfit > 0 ? 'up' : 'down'}
          />
          <DashboardTile
            label="Ledger health"
            value={
              <span className="inline-flex items-baseline gap-2">
                <span className="text-on-surface">{isBalanced ? 'Balanced' : 'Imbalanced'}</span>
              </span>
            }
            secondary={
              isBalanced ? (
                <>Total debits = total credits</>
              ) : (
                <>Diff {formatINR(Math.abs(totals.diff))} — review required</>
              )
            }
            severity={isBalanced ? 'success' : 'error'}
          />
        </section>

        {/* Trial Balance table — account-tree */}
        <section aria-label="Trial Balance accounts" className="mt-6">
          <header className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-on-surface">Accounts</h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {COA.length} accounts · grouped by type
            </span>
          </header>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1" aria-hidden />
                <TableHead className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Code
                </TableHead>
                <TableHead className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Account
                </TableHead>
                <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Opening ₹
                </TableHead>
                <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Period Debits ₹
                </TableHead>
                <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Period Credits ₹
                </TableHead>
                <TableHead className="text-right text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  Closing ₹
                </TableHead>
                <TableHead className="w-12 text-right" aria-label="Drill" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => {
                const isPnlGroup = g.type === 'revenue' || g.type === 'expense'
                return (
                  <GroupSection
                    key={g.type}
                    type={g.type}
                    rows={g.rows}
                    subtotalDebit={g.subtotalDebit}
                    subtotalCredit={g.subtotalCredit}
                    subtotalClosing={g.subtotalClosing}
                    expandedCode={expandedCode}
                    onToggleRow={handleToggleRow}
                    periodLabel={periodLabel}
                    showPnlLink={isPnlGroup}
                  />
                )
              })}
            </TableBody>
          </Table>

          {/* Balanced footer — icon + label per §15 (never colour alone) */}
          <div
            role="status"
            aria-live="polite"
            className={[
              'mt-4 rounded-md p-4 flex flex-wrap items-center justify-between gap-4',
              isBalanced ? 'bg-surface-container-lowest' : 'bg-surface-container-lowest',
            ].join(' ')}
          >
            <div className="flex items-center gap-3">
              {isBalanced ? (
                <span
                  aria-hidden
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-success text-on-success"
                >
                  <CheckCheck className="h-5 w-5" aria-hidden />
                </span>
              ) : (
                <span
                  aria-hidden
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-error text-on-error"
                >
                  <TriangleAlert className="h-5 w-5" aria-hidden />
                </span>
              )}
              <div>
                <p className="text-base font-semibold text-on-surface">
                  {isBalanced
                    ? 'Balanced'
                    : `Imbalanced — diff ${formatINR(Math.abs(totals.diff))}`}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {isBalanced
                    ? 'Total debits equal total credits across all accounts.'
                    : 'Review the journal — auto-postings did not net to zero.'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Total debits
              </span>
              <span className="text-right text-on-surface tabular-nums">
                <INRValue value={totals.debits} />
              </span>
              <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                Total credits
              </span>
              <span className="text-right text-on-surface tabular-nums">
                <INRValue value={totals.credits} />
              </span>
            </div>
          </div>
        </section>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant">
          SI-ACC-003 · Tier 1 Group 1 · Phase 2c-S3 · Source: FR90 internal ledger ·{' '}
          <Link to="/SI-RPT-005" className="text-primary hover:underline">
            Report Detail Runner
          </Link>
        </footer>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Group section — sub-component for one account-type's header + rows + sub-total
// ─────────────────────────────────────────────────────────────────────────────

interface GroupSectionProps {
  readonly type: AccountType
  readonly rows: ReadonlyArray<AccountRow>
  readonly subtotalDebit: number
  readonly subtotalCredit: number
  readonly subtotalClosing: number
  readonly expandedCode: string | null
  readonly onToggleRow: (code: string) => void
  readonly periodLabel: string
  readonly showPnlLink: boolean
}

function GroupSection({
  type,
  rows,
  subtotalDebit,
  subtotalCredit,
  subtotalClosing,
  expandedCode,
  onToggleRow,
  periodLabel,
  showPnlLink,
}: GroupSectionProps) {
  return (
    <>
      {/* Group header — tonal background, ID anchor for tile-click scroll */}
      <TableRow id={ACCOUNT_TYPE_ANCHOR[type]} className="hover:bg-transparent">
        <TableCell colSpan={COLUMN_COUNT} className="bg-surface-container py-2">
          <div className="flex flex-wrap items-center justify-between gap-2 px-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-on-surface">
              {ACCOUNT_TYPE_LABEL[type]} · {rows.length} accounts
            </span>
            {showPnlLink ? (
              <Link
                to="/SI-ACC-004"
                className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[11px] font-medium text-primary hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[28px]"
              >
                Open P&amp;L
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ) : null}
          </div>
        </TableCell>
      </TableRow>

      {/* Account rows */}
      {rows.map((r) => {
        const v = variance(r)
        const isExpanded = expandedCode === r.code
        const variancePip =
          v.flag === 'error'
            ? 'bg-error'
            : v.flag === 'warning'
              ? 'bg-warning'
              : 'bg-transparent'
        const varianceTooltip =
          v.pct != null && v.flag !== 'none'
            ? `Variance vs prior period: ${formatPctSigned(v.pct)} — review required`
            : undefined
        return (
          <Fragment key={r.code}>
            <TableRow
              className="transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {/* §12.5 / §6.6 margin-accent — variance pip on the leading cell */}
              <TableCell
                aria-hidden
                className={['p-0', variancePip].join(' ')}
                title={varianceTooltip}
              />
              <TableCell className="font-mono text-xs text-on-surface-variant">
                {r.code}
              </TableCell>
              <TableCell className="text-sm text-on-surface">
                <button
                  type="button"
                  onClick={() => onToggleRow(r.code)}
                  aria-expanded={isExpanded}
                  aria-controls={`drill-${r.code}`}
                  className="inline-flex items-center gap-1.5 rounded-sm px-1 -mx-1 min-h-[28px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <ChevronRight
                    className={[
                      'h-3.5 w-3.5 text-on-surface-variant transition-transform',
                      isExpanded ? 'rotate-90' : '',
                    ].join(' ')}
                    aria-hidden
                  />
                  <span>{r.name}</span>
                  {v.flag !== 'none' && v.pct != null ? (
                    <span
                      className={[
                        'ml-1 rounded-pill px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
                        v.flag === 'error'
                          ? 'bg-error-container text-on-error-container'
                          : 'bg-surface-container-high text-on-surface',
                      ].join(' ')}
                      title={varianceTooltip}
                    >
                      <TriangleAlert
                        className={[
                          'mr-1 inline-block h-3 w-3 -translate-y-px',
                          v.flag === 'error' ? 'text-error' : 'text-warning',
                        ].join(' ')}
                        aria-hidden
                      />
                      {formatPctSigned(v.pct, 0)}
                    </span>
                  ) : null}
                </button>
              </TableCell>
              <TableCell className="text-right text-sm text-on-surface-variant tabular-nums">
                <INRDigits value={r.opening} />
              </TableCell>
              <TableCell className="text-right text-sm text-on-surface tabular-nums">
                {r.debit > 0 ? <INRDigits value={r.debit} /> : <span className="text-on-surface-variant">—</span>}
              </TableCell>
              <TableCell className="text-right text-sm text-on-surface tabular-nums">
                {r.credit > 0 ? <INRDigits value={r.credit} /> : <span className="text-on-surface-variant">—</span>}
              </TableCell>
              <TableCell className="text-right text-sm font-medium text-on-surface tabular-nums">
                <INRDigits value={r.closing} />
              </TableCell>
              <TableCell className="text-right">
                <button
                  type="button"
                  onClick={() => onToggleRow(r.code)}
                  aria-label={`View journal entries for ${r.code} ${r.name}`}
                  aria-expanded={isExpanded}
                  className="inline-flex h-8 items-center gap-1 rounded-sm px-2 text-xs text-on-surface-variant hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-[28px]"
                >
                  <span className="hidden tablet:inline">View journal entries</span>
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </TableCell>
            </TableRow>
            {isExpanded ? (
              <JournalDrill
                accountCode={r.code}
                accountName={r.name}
                periodLabel={periodLabel}
                columns={COLUMN_COUNT}
              />
            ) : null}
          </Fragment>
        )
      })}

      {/* Group sub-total — tonal background per §5.2 (no top border) */}
      <TableRow className="hover:bg-transparent">
        <TableCell aria-hidden className="bg-surface-container p-0" />
        <TableCell colSpan={2} className="bg-surface-container text-[11px] font-semibold uppercase tracking-wider text-on-surface">
          {ACCOUNT_TYPE_LABEL[type]} sub-total
        </TableCell>
        <TableCell aria-hidden className="bg-surface-container" />
        <TableCell className="bg-surface-container text-right text-sm font-semibold text-on-surface tabular-nums">
          <INRDigits value={subtotalDebit} />
        </TableCell>
        <TableCell className="bg-surface-container text-right text-sm font-semibold text-on-surface tabular-nums">
          <INRDigits value={subtotalCredit} />
        </TableCell>
        <TableCell className="bg-surface-container text-right text-sm font-semibold text-on-surface tabular-nums">
          <INRDigits value={subtotalClosing} />
        </TableCell>
        <TableCell aria-hidden className="bg-surface-container" />
      </TableRow>
    </>
  )
}

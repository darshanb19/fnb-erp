import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  CircleOff,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  Star,
  Tag,
  Users,
  X,
} from 'lucide-react'

import {
  AuditLink,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CCDuplicateWarn,
  type CCDuplicateWarnMatch,
  DataQualityAlertPane,
  DraftPill,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionShift,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shell'

import {
  clusters,
  locations,
  vendors,
  type Vendor,
} from '@/lib/sample-data'

/**
 * SI-MDM-005 — Vendor Master CRUD.
 *
 * Tier 2 mockup, Phase 4 Epic 1 Arc (b), Task B4. Two surfaces in one
 * route: a sortable / filterable vendor register on the left and an
 * editable vendor form on the right. The screen anchors three Tier-2
 * specific obligations:
 *   1. Inline scope picker (Brand / Cluster / POS three-state radio) per
 *      Master Spec §2.7. NOT a CC-* shell — a plain radio group plus
 *      cascading selects when Cluster or POS is chosen.
 *   2. CCDuplicateWarn consumer on the create-form Vendor name input —
 *      surfaces fuzzy matches at >=3 input characters using a mock
 *      similarity heuristic (Arc (c) wires the real DL-018 pg_trgm path).
 *   3. §2.7 scope-mutation surface — when the loaded vendor's scope
 *      differs from the form-state scope, the Save button gates through
 *      a confirm dialog with a mandatory reason (>=10 chars). The
 *      narrative differentiates "Widening: free." vs "Narrowing: blocked
 *      when open transactions exist." Lateral changes (Cluster X ->
 *      Cluster Y, POS A -> POS B) classify as narrowing for the leaving
 *      scope. The fixture has zero open transactions, so narrowing
 *      proceeds in this mockup; production gates on FR116.
 *
 * The fixture (mockups/src/lib/sample-data.ts) carries only a subset of
 * the 12 schema fields. Missing fields (code, pan, contact, address,
 * payment_mode, created_at, updated_at, category_ids) are synthesised
 * inline at render time, deterministically per vendor id, so the form
 * lands plausible values without mutating the fixture.
 *
 * Cross-cutting:
 *   - CC-AUDIT-LINK         — header strip + form header (when editing).
 *   - CC-DRAFT-PILL         — top of the form when isDirty.
 *   - CC-DATA-QUALITY-ALERT — paneled DataQualityAlertPane at the top of
 *     the form when the deactivated vendor is loaded; per-row chip in
 *     the list reflecting "0 open POs — safe to deactivate".
 *
 * Status tokens: active rows use status_confirmed; deactivated rows use
 * status_inactive. The canonical 20 has no "active" pip — pre-commit
 * rule 5 rejects any invented status_* token.
 *
 * Animation — NONE (table + form per CLAUDE.md).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types & helpers
// ─────────────────────────────────────────────────────────────────────────────

type VendorScopeUI = 'brand' | 'cluster' | 'pos'

const SCOPE_LABEL: Record<VendorScopeUI, string> = {
  brand: 'Brand',
  cluster: 'Cluster',
  pos: 'POS',
}

/** Brand > Cluster > POS precedence; lower index = wider scope. */
const SCOPE_RANK: Record<VendorScopeUI, number> = {
  brand: 0,
  cluster: 1,
  pos: 2,
}

type PaymentMode = 'Cash' | 'Bank Transfer' | 'Cheque'
const PAYMENT_MODES: ReadonlyArray<PaymentMode> = ['Cash', 'Bank Transfer', 'Cheque']

const POS_LOCATIONS = locations.filter((l) => l.type === 'pos_outlet')

/** Synthesise a stable 6-char user-visible code from id. */
function codeOf(v: Pick<Vendor, 'id'>): string {
  const tail = v.id.replace(/^vnd-/, '').toUpperCase()
  // Compress to first segment (before any hyphen) + first char of remainder if present.
  const parts = tail.split('-')
  const head = parts[0] ?? tail
  const rest = parts.slice(1).join('')
  const compact = (head + rest).slice(0, 8)
  return `VEND-${compact}`
}

/** Synthesise a deterministic-looking PAN (10 char). */
function panOf(v: Pick<Vendor, 'id' | 'name' | 'state_code'>): string {
  const letters = v.name
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X')
  // A 5th letter slot per PAN format — derive from state_code parity.
  const fifth = v.state_code.endsWith('7') ? 'M' : 'A'
  // 4 deterministic digits from id length & charcodes.
  const seed = Array.from(v.id).reduce((s, c) => s + c.charCodeAt(0), 0)
  const digits = String((seed * 13) % 10000).padStart(4, '0')
  // Last char from state_code last digit mapping
  const lastChar = String.fromCharCode(65 + (seed % 26))
  return `${letters}${fifth}${digits}${lastChar}`
}

/** Deterministic contact person — synthesised from name. */
function contactPersonOf(v: Pick<Vendor, 'name'>): string {
  const first = v.name.split(/\s+/)[0] ?? 'Sales'
  return `${first} Desk`
}

function phoneOf(v: Pick<Vendor, 'id'>): string {
  const seed = Array.from(v.id).reduce((s, c) => s + c.charCodeAt(0), 0)
  const tail = String((seed * 31) % 100000000).padStart(8, '0')
  return `+91 9${tail.slice(0, 9)}`
}

function emailOf(v: Pick<Vendor, 'id' | 'name'>): string {
  const slug = v.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 16)
  return `procurement@${slug || v.id.replace(/^vnd-/, '')}.in`
}

interface SyntheticAddress {
  readonly street: string
  readonly city: string
  readonly postal: string
}

function addressOf(v: Vendor, idx: number): SyntheticAddress {
  const streets = [
    'Plot 14, MIDC Industrial Estate',
    'Shop 7, Market Yard',
    'Block B, Trade Centre',
    'Unit 22, APMC Complex',
    'No. 9, Wholesale Market',
  ]
  const seed = Array.from(v.id).reduce((s, c) => s + c.charCodeAt(0), 0)
  const street = streets[seed % streets.length]!
  const city = v.state === 'Maharashtra' ? 'Mumbai' : v.state.split(' ')[0]!
  const postal = String(400000 + ((seed * 7) % 99) + idx).slice(0, 6)
  return { street, city, postal }
}

function paymentModeOf(idx: number): PaymentMode {
  return PAYMENT_MODES[idx % PAYMENT_MODES.length]!
}

function createdAtOf(idx: number): string {
  const d = new Date('2025-09-01T09:00:00+05:30')
  d.setUTCDate(d.getUTCDate() + (idx * 5) % 180)
  return d.toISOString().slice(0, 10)
}

function modifiedAtOf(idx: number): string {
  const d = new Date('2026-04-01T09:00:00+05:30')
  d.setUTCDate(d.getUTCDate() + ((idx * 3) % 30))
  return d.toISOString().slice(0, 10)
}

/** quality_rating = round(performance_score / 20) → 1–5. */
function qualityRatingOf(v: Pick<Vendor, 'performance_score'>): number {
  return Math.max(1, Math.min(5, Math.round(v.performance_score / 20)))
}

/** Pretty scope label. */
function scopeLabel(v: Pick<Vendor, 'scope' | 'cluster_id'>): string {
  if (v.scope === 'brand') return 'Brand'
  if (v.scope === 'cluster') {
    const cl = clusters.find((c) => c.id === v.cluster_id)
    return cl ? `Cluster · ${cl.name}` : 'Cluster'
  }
  return 'POS'
}

// ─────────────────────────────────────────────────────────────────────────────
// Form-state shape
// ─────────────────────────────────────────────────────────────────────────────

interface VendorFormState {
  readonly id: string | null
  readonly name: string
  readonly code: string
  readonly gstin: string
  readonly pan: string
  readonly contactPerson: string
  readonly phone: string
  readonly email: string
  readonly addressStreet: string
  readonly addressCity: string
  readonly addressPostal: string
  readonly state: string
  readonly stateCode: string
  readonly scope: VendorScopeUI
  readonly clusterId: string
  readonly posLocationId: string
  readonly categories: ReadonlyArray<string>
  readonly paymentTermsDays: number
  readonly paymentMode: PaymentMode
  readonly preferred: boolean
  readonly qualityRating: number
  readonly active: boolean
  readonly createdAt: string
  readonly modifiedAt: string
}

interface VendorRow {
  readonly vendor: Vendor
  readonly code: string
  readonly pan: string
  readonly contactPerson: string
  readonly phone: string
  readonly email: string
  readonly address: SyntheticAddress
  readonly paymentMode: PaymentMode
  readonly preferred: boolean
  readonly qualityRating: number
  readonly createdAt: string
  readonly modifiedAt: string
  /** Per fixture there are zero open POs against any vendor; tag explicitly. */
  readonly openPoCount: 0
}

const ROWS: ReadonlyArray<VendorRow> = vendors.map((v, idx) => ({
  vendor: v,
  code: codeOf(v),
  pan: panOf(v),
  contactPerson: contactPersonOf(v),
  phone: phoneOf(v),
  email: emailOf(v),
  address: addressOf(v, idx),
  paymentMode: paymentModeOf(idx),
  // Preferred = top quartile by performance_score (>=88).
  preferred: v.performance_score >= 88,
  qualityRating: qualityRatingOf(v),
  createdAt: createdAtOf(idx),
  modifiedAt: modifiedAtOf(idx),
  openPoCount: 0,
}))

function rowToFormState(row: VendorRow): VendorFormState {
  const v = row.vendor
  return {
    id: v.id,
    name: v.name,
    code: row.code,
    gstin: v.gstin ?? '',
    pan: row.pan,
    contactPerson: row.contactPerson,
    phone: row.phone,
    email: row.email,
    addressStreet: row.address.street,
    addressCity: row.address.city,
    addressPostal: row.address.postal,
    state: v.state,
    stateCode: v.state_code,
    scope: v.scope === 'brand' ? 'brand' : 'cluster',
    clusterId: v.cluster_id ?? '',
    posLocationId: '',
    categories: v.preferred_for,
    paymentTermsDays: v.payment_terms_days,
    paymentMode: row.paymentMode,
    preferred: row.preferred,
    qualityRating: row.qualityRating,
    active: v.is_active,
    createdAt: row.createdAt,
    modifiedAt: row.modifiedAt,
  }
}

const EMPTY_FORM: VendorFormState = {
  id: null,
  name: '',
  code: '',
  gstin: '',
  pan: '',
  contactPerson: '',
  phone: '',
  email: '',
  addressStreet: '',
  addressCity: '',
  addressPostal: '',
  state: 'Maharashtra',
  stateCode: '27',
  scope: 'brand',
  clusterId: '',
  posLocationId: '',
  categories: [],
  paymentTermsDays: 30,
  paymentMode: 'Bank Transfer',
  preferred: false,
  qualityRating: 3,
  active: true,
  createdAt: '',
  modifiedAt: '',
}

// Pool of category labels drawn from existing vendors' preferred_for arrays.
const CATEGORY_OPTIONS: ReadonlyArray<string> = Array.from(
  new Set(vendors.flatMap((v) => v.preferred_for)),
).sort()

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface FilterChipPickerProps<V extends string> {
  readonly title: string
  readonly options: ReadonlyArray<{ value: V; label: string }>
  readonly selected: ReadonlySet<V>
  readonly onToggle: (v: V) => void
  readonly onClear: () => void
}

function FilterChipPicker<V extends string>({
  title,
  options,
  selected,
  onToggle,
  onClear,
}: FilterChipPickerProps<V>) {
  const [open, setOpen] = useState(false)
  const count = selected.size
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={count > 0 ? 'tonal' : 'ghost'}
          size="sm"
          className="h-9 px-3 gap-1.5 rounded-pill"
          aria-label={`Filter by ${title.toLowerCase()}${count > 0 ? ` — ${count} selected` : ''}`}
        >
          <span className="text-xs font-medium">{title}</span>
          {count > 0 ? (
            <span className="inline-flex items-center justify-center rounded-pill bg-primary px-1.5 text-[10px] font-semibold text-on-primary min-w-[1.25rem]">
              {count}
            </span>
          ) : (
            <Plus className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Filter by {title.toLowerCase()}
          </span>
          {count > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                onClear()
                setOpen(false)
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
        <ul className="flex flex-col">
          {options.map((opt) => {
            const active = selected.has(opt.value)
            return (
              <li key={opt.value}>
                <button
                  type="button"
                  onClick={() => onToggle(opt.value)}
                  aria-pressed={active}
                  className={[
                    'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between gap-2 min-h-[44px]',
                    'hover:bg-surface-container-high transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    active ? 'bg-surface-container' : '',
                  ].join(' ')}
                >
                  <span className="text-sm text-on-surface">{opt.label}</span>
                  {active ? (
                    <span className="text-xs font-medium text-primary">
                      Selected
                    </span>
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

interface RowActionMenuProps {
  readonly row: VendorRow
  readonly onEdit: () => void
  readonly onDeactivate: () => void
}

function RowActionMenu({ row, onEdit, onDeactivate }: RowActionMenuProps) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label={`Row actions for ${row.vendor.name}`}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        <ul className="flex flex-col">
          <li>
            <button
              type="button"
              onClick={() => {
                onEdit()
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2 rounded-sm text-sm text-on-surface min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Edit
            </button>
          </li>
          <li>
            <Link
              to={`/SI-PUR-002?vendor=${encodeURIComponent(row.vendor.id)}`}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 rounded-sm text-sm text-on-surface min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              View PO history
            </Link>
          </li>
          <li>
            <Link
              to={`/SI-PUR-005?vendor=${encodeURIComponent(row.vendor.id)}`}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 rounded-sm text-sm text-on-surface min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              View price history
            </Link>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                onDeactivate()
                setOpen(false)
              }}
              disabled={!row.vendor.is_active}
              className="w-full text-left px-3 py-2 rounded-sm text-sm text-error min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:pointer-events-none"
            >
              Deactivate
            </button>
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  )
}

interface CategoryPickerProps {
  readonly value: ReadonlyArray<string>
  readonly onChange: (next: ReadonlyArray<string>) => void
}

function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  const [open, setOpen] = useState(false)
  const toggle = (cat: string) => {
    const next = value.includes(cat)
      ? value.filter((c) => c !== cat)
      : [...value, cat]
    onChange(next)
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {value.length === 0 ? (
          <span className="text-xs text-on-surface-variant">
            No categories selected
          </span>
        ) : (
          value.map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center gap-1 rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface"
            >
              <Tag className="h-3 w-3" aria-hidden />
              {cat}
              <button
                type="button"
                aria-label={`Remove ${cat}`}
                onClick={() => toggle(cat)}
                className="rounded-sm hover:bg-surface-container-highest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </span>
          ))
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1 rounded-pill"
            >
              <Plus className="h-3 w-3" aria-hidden />
              <span className="text-xs">Add category</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-1 max-h-80 overflow-auto">
            <span className="block px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Pick categories
            </span>
            <ul className="flex flex-col">
              {CATEGORY_OPTIONS.map((cat) => {
                const active = value.includes(cat)
                return (
                  <li key={cat}>
                    <button
                      type="button"
                      onClick={() => toggle(cat)}
                      aria-pressed={active}
                      className={[
                        'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between gap-2 min-h-[44px]',
                        'hover:bg-surface-container-high transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        active ? 'bg-surface-container' : '',
                      ].join(' ')}
                    >
                      <span className="text-sm text-on-surface">{cat}</span>
                      {active ? (
                        <span className="text-xs font-medium text-primary">
                          Selected
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

interface ScopePickerProps {
  readonly scope: VendorScopeUI
  readonly clusterId: string
  readonly posLocationId: string
  readonly onChange: (
    next: Pick<VendorFormState, 'scope' | 'clusterId' | 'posLocationId'>,
  ) => void
}

function ScopePicker({
  scope,
  clusterId,
  posLocationId,
  onChange,
}: ScopePickerProps) {
  const select = (next: VendorScopeUI) => {
    if (next === 'brand') {
      onChange({ scope: 'brand', clusterId: '', posLocationId: '' })
    } else if (next === 'cluster') {
      onChange({
        scope: 'cluster',
        clusterId: clusterId || clusters[0]!.id,
        posLocationId: '',
      })
    } else {
      const cl = clusterId || clusters[0]!.id
      const posInCluster = POS_LOCATIONS.filter((l) => l.cluster_id === cl)
      onChange({
        scope: 'pos',
        clusterId: cl,
        posLocationId: posInCluster[0]?.id ?? POS_LOCATIONS[0]!.id,
      })
    }
  }

  const posInCluster = POS_LOCATIONS.filter((l) => l.cluster_id === clusterId)

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-medium text-on-surface">Scope</legend>
      <p className="text-[11px] text-on-surface-variant">
        Determines which locations may purchase from this vendor (Master
        Spec §2.7). Brand &gt; Cluster &gt; POS in widening precedence.
      </p>
      <div
        role="radiogroup"
        aria-label="Vendor scope"
        className="flex flex-wrap items-center gap-2"
      >
        {(['brand', 'cluster', 'pos'] as const).map((s) => {
          const active = scope === s
          return (
            <label
              key={s}
              className={[
                'inline-flex items-center gap-2 rounded-pill px-4 h-11 min-w-[44px] text-sm font-medium cursor-pointer',
                'transition-colors focus-within:ring-2 focus-within:ring-primary',
                active
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest',
              ].join(' ')}
            >
              <input
                type="radio"
                name="vendor-scope"
                value={s}
                checked={active}
                onChange={() => select(s)}
                className="sr-only"
                aria-label={SCOPE_LABEL[s]}
              />
              <span>{SCOPE_LABEL[s]}</span>
            </label>
          )
        })}
      </div>

      {scope === 'cluster' || scope === 'pos' ? (
        <div className="grid grid-cols-1 tablet:grid-cols-2 gap-3 mt-1">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="scope-cluster"
              className="text-xs font-medium text-on-surface"
            >
              Cluster
            </label>
            <select
              id="scope-cluster"
              value={clusterId}
              onChange={(e) => {
                if (scope === 'pos') {
                  const posInNew = POS_LOCATIONS.filter(
                    (l) => l.cluster_id === e.target.value,
                  )
                  onChange({
                    scope: 'pos',
                    clusterId: e.target.value,
                    posLocationId: posInNew[0]?.id ?? '',
                  })
                } else {
                  onChange({
                    scope: 'cluster',
                    clusterId: e.target.value,
                    posLocationId: '',
                  })
                }
              }}
              className="h-11 rounded-sm bg-surface-container-highest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {clusters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {scope === 'pos' ? (
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="scope-pos"
                className="text-xs font-medium text-on-surface"
              >
                POS outlet
              </label>
              <select
                id="scope-pos"
                value={posLocationId}
                onChange={(e) =>
                  onChange({
                    scope: 'pos',
                    clusterId,
                    posLocationId: e.target.value,
                  })
                }
                className="h-11 rounded-sm bg-surface-container-highest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {posInCluster.length === 0 ? (
                  <option value="">No POS outlets in this cluster</option>
                ) : (
                  posInCluster.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  )
}

interface QualityRatingProps {
  readonly value: number
  readonly onChange: (next: number) => void
}

function QualityRating({ value, onChange }: QualityRatingProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Quality rating (1 to 5 stars)"
      className="flex items-center gap-1"
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n === 1 ? '' : 's'}`}
            onClick={() => onChange(n)}
            className="rounded-sm p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Star
              className={[
                'h-5 w-5',
                filled ? 'fill-primary text-primary' : 'text-on-surface-variant',
              ].join(' ')}
              aria-hidden
            />
          </button>
        )
      })}
      <span className="ml-2 text-xs text-on-surface-variant tabular-nums">
        {value} / 5
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Scope-mutation classification
// ─────────────────────────────────────────────────────────────────────────────

type MutationKind = 'widening' | 'narrowing' | 'lateral-narrowing'

interface ScopeMutationDescriptor {
  readonly oldLabel: string
  readonly newLabel: string
  readonly kind: MutationKind
}

function describeMutation(
  loaded: { scope: VendorScopeUI; clusterId: string; posLocationId: string },
  next: { scope: VendorScopeUI; clusterId: string; posLocationId: string },
): ScopeMutationDescriptor | null {
  if (
    loaded.scope === next.scope &&
    loaded.clusterId === next.clusterId &&
    loaded.posLocationId === next.posLocationId
  ) {
    return null
  }
  const oldRank = SCOPE_RANK[loaded.scope]
  const newRank = SCOPE_RANK[next.scope]

  const buildLabel = (s: typeof loaded) => {
    if (s.scope === 'brand') return 'Brand'
    if (s.scope === 'cluster') {
      const cl = clusters.find((c) => c.id === s.clusterId)
      return `Cluster · ${cl?.name ?? '—'}`
    }
    const cl = clusters.find((c) => c.id === s.clusterId)
    const pos = POS_LOCATIONS.find((l) => l.id === s.posLocationId)
    return `POS · ${pos?.name ?? '—'} (${cl?.name ?? '—'})`
  }

  let kind: MutationKind
  if (newRank < oldRank) {
    kind = 'widening'
  } else if (newRank > oldRank) {
    kind = 'narrowing'
  } else {
    // Same rank, different identity — lateral-narrowing for the leaving slot.
    kind = 'lateral-narrowing'
  }

  return {
    oldLabel: buildLabel(loaded),
    newLabel: buildLabel(next),
    kind,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scope-mutation confirm dialog
// ─────────────────────────────────────────────────────────────────────────────

interface ScopeMutationDialogProps {
  readonly descriptor: ScopeMutationDescriptor
  readonly onCancel: () => void
  readonly onConfirm: (reason: string) => void
}

function ScopeMutationDialog({
  descriptor,
  onCancel,
  onConfirm,
}: ScopeMutationDialogProps) {
  const [reason, setReason] = useState('')
  const isWidening = descriptor.kind === 'widening'
  const directionCopy = isWidening
    ? 'Widening: free.'
    : 'Narrowing: blocked when open transactions exist. No open transactions in this fixture; the change will proceed.'
  const headlineKind =
    descriptor.kind === 'lateral-narrowing'
      ? 'lateral-narrowing'
      : descriptor.kind
  const canConfirm = reason.trim().length >= 10

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Confirm scope change"
      className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg rounded-md bg-surface-container-lowest p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Scope change · {headlineKind}
          </p>
          <h3 className="mt-1 text-base font-semibold text-on-surface">
            Change scope: {descriptor.oldLabel} → {descriptor.newLabel}
          </h3>
        </div>
        <div
          className={[
            'rounded-sm bg-surface-container-low p-3 text-sm',
            isWidening ? 'text-on-surface' : 'text-on-surface-variant',
          ].join(' ')}
        >
          <p className="font-medium text-on-surface">{directionCopy}</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            All scope changes are captured in the audit trail (Master Spec
            §2.7). Reason is mandatory and must be at least 10 characters.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="scope-reason"
            className="text-xs font-medium text-on-surface"
          >
            Reason for change
            <span className="text-error ml-0.5" aria-hidden>
              *
            </span>
          </label>
          <textarea
            id="scope-reason"
            aria-required="true"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Vendor expanded delivery to all clusters"
            className="rounded-sm bg-surface-container-highest p-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <span className="text-[11px] text-on-surface-variant">
            {reason.trim().length} / 10 chars minimum
          </span>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onConfirm(reason.trim())}
            disabled={!canConfirm}
          >
            Confirm scope change
          </Button>
        </div>
      </div>
    </div>
  )
}

interface DeactivateConfirmProps {
  readonly vendorName: string
  readonly onCancel: () => void
  readonly onConfirm: () => void
}

function DeactivateConfirm({
  vendorName,
  onCancel,
  onConfirm,
}: DeactivateConfirmProps) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold text-on-surface">
        Deactivate {vendorName}?
      </h3>
      <p className="text-xs text-on-surface-variant">
        This blocks new POs but preserves PO and price history. Open POs (if
        any) require Brand-Owner override per FR3.
      </p>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="destructive" size="sm" onClick={onConfirm}>
          Deactivate
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CCDuplicateWarn matcher (mock similarity heuristic per Task B4 brief)
// ─────────────────────────────────────────────────────────────────────────────

function fuzzyMatchesByName(
  q: string,
  excludeId: string | null,
): ReadonlyArray<CCDuplicateWarnMatch> {
  const trimmed = q.trim()
  if (trimmed.length < 3) return []
  const qChars = new Set(
    trimmed.toLowerCase().replace(/\s+/g, '').slice(0, 5).split(''),
  )
  return vendors
    .filter((v) => v.id !== excludeId)
    .filter((v) => {
      const head = v.name.toLowerCase().replace(/\s+/g, '').slice(0, 5)
      let shared = 0
      for (const ch of head) if (qChars.has(ch)) shared += 1
      return shared >= 3
    })
    .map((v) => ({
      id: v.id,
      name: v.name,
      subtitle: `${
        v.scope === 'brand' ? 'Brand-scope' : 'Cluster-scope'
      } · ${v.preferred_for.slice(0, 2).join(', ')}`,
      status: v.is_active ? 'active' : 'inactive',
    }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiMdm005() {
  // Filter / search state
  const [search, setSearch] = useState('')
  const [scopeFilter, setScopeFilter] = useState<ReadonlySet<VendorScopeUI>>(
    new Set(),
  )
  const [activeFilter, setActiveFilter] = useState<
    ReadonlySet<'active' | 'inactive'>
  >(new Set())
  const [categoryFilter, setCategoryFilter] = useState<ReadonlySet<string>>(
    new Set(),
  )

  // Form state
  const initialRow = ROWS[0]!
  const [formMode, setFormMode] = useState<'edit' | 'create' | 'empty'>('edit')
  const [form, setForm] = useState<VendorFormState>(rowToFormState(initialRow))
  const [loadedScope, setLoadedScope] = useState<{
    scope: VendorScopeUI
    clusterId: string
    posLocationId: string
  }>({
    scope: form.scope,
    clusterId: form.clusterId,
    posLocationId: form.posLocationId,
  })
  const [isDirty, setIsDirty] = useState(false)
  const [duplicateDismissed, setDuplicateDismissed] = useState(false)
  const [pendingMutation, setPendingMutation] =
    useState<ScopeMutationDescriptor | null>(null)
  const [scopeChangeAck, setScopeChangeAck] = useState<string | null>(null)
  const [deactivateConfirmFor, setDeactivateConfirmFor] = useState<
    string | null
  >(null)

  // Filtered list
  const filtered = useMemo(() => {
    return ROWS.filter((row) => {
      const v = row.vendor
      if (scopeFilter.size > 0) {
        const key: VendorScopeUI = v.scope === 'brand' ? 'brand' : 'cluster'
        if (!scopeFilter.has(key)) return false
      }
      if (activeFilter.size > 0) {
        const key: 'active' | 'inactive' = v.is_active ? 'active' : 'inactive'
        if (!activeFilter.has(key)) return false
      }
      if (categoryFilter.size > 0) {
        const hit = v.preferred_for.some((c) => categoryFilter.has(c))
        if (!hit) return false
      }
      if (search.trim().length > 0) {
        const q = search.trim().toLowerCase()
        const hay = `${v.name} ${row.code}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [search, scopeFilter, activeFilter, categoryFilter])

  const anyFilterActive =
    scopeFilter.size > 0 ||
    activeFilter.size > 0 ||
    categoryFilter.size > 0 ||
    search.trim().length > 0

  const toggleSet = <V extends string>(
    set: ReadonlySet<V>,
    v: V,
  ): ReadonlySet<V> => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    return next
  }

  // Form handlers
  const updateForm = <K extends keyof VendorFormState>(
    k: K,
    v: VendorFormState[K],
  ) => {
    setForm((f) => ({ ...f, [k]: v }))
    setIsDirty(true)
    setScopeChangeAck(null)
  }

  const updateScope = (
    next: Pick<VendorFormState, 'scope' | 'clusterId' | 'posLocationId'>,
  ) => {
    setForm((f) => ({ ...f, ...next }))
    setIsDirty(true)
    setScopeChangeAck(null)
  }

  const handleEditRow = (row: VendorRow) => {
    setFormMode('edit')
    const next = rowToFormState(row)
    setForm(next)
    setLoadedScope({
      scope: next.scope,
      clusterId: next.clusterId,
      posLocationId: next.posLocationId,
    })
    setIsDirty(false)
    setDuplicateDismissed(false)
    setScopeChangeAck(null)
  }

  const handleCreateNew = () => {
    setFormMode('create')
    setForm(EMPTY_FORM)
    setLoadedScope({ scope: 'brand', clusterId: '', posLocationId: '' })
    setIsDirty(true)
    setDuplicateDismissed(false)
    setScopeChangeAck(null)
  }

  const handleSaveAttempt = () => {
    // If the scope changed vs. what was loaded, gate through confirm.
    if (formMode === 'edit') {
      const desc = describeMutation(loadedScope, {
        scope: form.scope,
        clusterId: form.clusterId,
        posLocationId: form.posLocationId,
      })
      if (desc !== null) {
        setPendingMutation(desc)
        return
      }
    }
    // Otherwise commit directly (visual only).
    setIsDirty(false)
    if (formMode === 'create') setFormMode('edit')
  }

  const handleConfirmMutation = (reason: string) => {
    if (pendingMutation === null) return
    setScopeChangeAck(
      `Scope changed (${pendingMutation.kind}) · reason logged (${reason.length} chars)`,
    )
    setLoadedScope({
      scope: form.scope,
      clusterId: form.clusterId,
      posLocationId: form.posLocationId,
    })
    setIsDirty(false)
    setPendingMutation(null)
  }

  const handleResetForm = () => {
    if (formMode === 'create') {
      setForm(EMPTY_FORM)
    } else if (form.id !== null) {
      const row = ROWS.find((r) => r.vendor.id === form.id)
      if (row) {
        const next = rowToFormState(row)
        setForm(next)
        setLoadedScope({
          scope: next.scope,
          clusterId: next.clusterId,
          posLocationId: next.posLocationId,
        })
      }
    }
    setIsDirty(false)
    setScopeChangeAck(null)
  }

  const totalVendors = ROWS.length
  const inactiveVendors = ROWS.filter((r) => !r.vendor.is_active).length

  // Duplicate matches for the create-form name input.
  const duplicateMatches = useMemo(() => {
    if (formMode !== 'create') return []
    if (duplicateDismissed) return []
    return fuzzyMatchesByName(form.name, null)
  }, [formMode, form.name, duplicateDismissed])

  // Schema panel state
  const [schemaOpen, setSchemaOpen] = useState(false)

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Master data · Vendors
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Vendor master
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              {totalVendors} vendors across brand and cluster scope ·{' '}
              {inactiveVendors > 0
                ? `${inactiveVendors} deactivated`
                : 'All current'}
              . Scope follows §2.7 precedence (Brand &gt; Cluster &gt; POS);
              widening is free, narrowing is gated by open transactions.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AuditLink entityRef="VEND-MASTER" />
            <Button onClick={handleCreateNew} aria-label="Create new vendor">
              <Plus className="h-4 w-4" aria-hidden />
              New vendor
            </Button>
          </div>
        </header>

        {/* Two-column layout */}
        <div className="mt-6 grid grid-cols-1 desktop:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6">
          {/* ── List column ─────────────────────────────────────────────── */}
          <section aria-label="Vendor list" className="flex flex-col gap-3">
            <div className="rounded-md bg-surface-container-low p-3">
              <div className="flex flex-wrap items-center gap-2">
                <FilterChipPicker<VendorScopeUI>
                  title="Scope"
                  options={[
                    { value: 'brand', label: 'Brand' },
                    { value: 'cluster', label: 'Cluster' },
                    { value: 'pos', label: 'POS' },
                  ]}
                  selected={scopeFilter}
                  onToggle={(v) => setScopeFilter(toggleSet(scopeFilter, v))}
                  onClear={() => setScopeFilter(new Set())}
                />
                <FilterChipPicker<'active' | 'inactive'>
                  title="Status"
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Deactivated' },
                  ]}
                  selected={activeFilter}
                  onToggle={(v) => setActiveFilter(toggleSet(activeFilter, v))}
                  onClear={() => setActiveFilter(new Set())}
                />
                <FilterChipPicker<string>
                  title="Category"
                  options={CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }))}
                  selected={categoryFilter}
                  onToggle={(v) =>
                    setCategoryFilter(toggleSet(categoryFilter, v))
                  }
                  onClear={() => setCategoryFilter(new Set())}
                />
                {anyFilterActive ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2 ml-auto gap-1"
                    onClick={() => {
                      setScopeFilter(new Set())
                      setActiveFilter(new Set())
                      setCategoryFilter(new Set())
                      setSearch('')
                    }}
                    aria-label="Reset filters"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                    <span className="text-xs">Reset</span>
                  </Button>
                ) : null}
              </div>
              <div className="mt-2 relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
                  aria-hidden
                />
                <Input
                  aria-label="Search vendors by name or code"
                  placeholder="Search by name or code"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <Card className="p-0">
              <div className="px-4 py-3 flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold text-on-surface">
                  Vendors
                </h2>
                <span className="text-xs text-on-surface-variant tabular-nums">
                  {filtered.length} of {totalVendors}
                </span>
              </div>
              <SectionShift tone="low" aria-hidden />
              {filtered.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm font-semibold text-on-surface">
                    No vendors match the current filter.
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Adjust the chips above or clear them to see every vendor.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead className="hidden tablet:table-cell">
                        Scope
                      </TableHead>
                      <TableHead className="hidden tablet:table-cell">
                        Categories
                      </TableHead>
                      <TableHead className="hidden desktop:table-cell text-right">
                        Quality
                      </TableHead>
                      <TableHead className="hidden desktop:table-cell text-right">
                        Terms
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12" aria-label="Row actions" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => {
                      const v = row.vendor
                      const isOpenInForm = form.id === v.id
                      return (
                        <TableRow
                          key={v.id}
                          className={[
                            'transition-colors',
                            isOpenInForm
                              ? 'bg-surface-container'
                              : 'hover:bg-surface-container-low',
                          ].join(' ')}
                        >
                          <TableCell className="font-mono text-[11px] text-on-surface-variant">
                            {row.code}
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => handleEditRow(row)}
                              className="block text-left min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm w-full"
                            >
                              <div className="flex items-center flex-wrap gap-1.5">
                                <span className="font-medium text-on-surface">
                                  {v.name}
                                </span>
                                {row.preferred ? (
                                  <span className="inline-flex items-center gap-1 rounded-pill bg-primary-container text-on-primary-container px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
                                    <Star className="h-3 w-3" aria-hidden />
                                    Preferred
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-[11px] text-on-surface-variant mt-0.5">
                                {v.gstin ? v.gstin : 'No GSTIN'} · {v.state}
                              </p>
                              {!v.is_active ? (
                                <span className="mt-1 inline-flex items-center gap-1 rounded-sm bg-surface-container-low px-2 py-0.5 text-[10px] text-on-surface-variant">
                                  <CircleOff className="h-3 w-3" aria-hidden />
                                  {row.openPoCount === 0
                                    ? 'Has 0 open POs — safe to deactivate'
                                    : `${row.openPoCount} open POs`}
                                </span>
                              ) : null}
                            </button>
                          </TableCell>
                          <TableCell className="hidden tablet:table-cell text-on-surface-variant text-xs">
                            {scopeLabel(v)}
                          </TableCell>
                          <TableCell className="hidden tablet:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {v.preferred_for.slice(0, 2).map((c) => (
                                <span
                                  key={c}
                                  className="inline-flex items-center rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface"
                                >
                                  {c}
                                </span>
                              ))}
                              {v.preferred_for.length > 2 ? (
                                <span className="text-[11px] text-on-surface-variant">
                                  +{v.preferred_for.length - 2}
                                </span>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="hidden desktop:table-cell text-right tabular-nums text-on-surface-variant text-xs">
                            {row.qualityRating} / 5
                          </TableCell>
                          <TableCell className="hidden desktop:table-cell text-right tabular-nums text-on-surface-variant text-xs">
                            {v.payment_terms_days} d
                          </TableCell>
                          <TableCell>
                            {v.is_active ? (
                              <StatusPill
                                status="status_confirmed"
                                size="sm"
                                label="Active"
                              />
                            ) : (
                              <StatusPill
                                status="status_inactive"
                                size="sm"
                                label="Deactivated"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <RowActionMenu
                              row={row}
                              onEdit={() => handleEditRow(row)}
                              onDeactivate={() =>
                                setDeactivateConfirmFor(v.id)
                              }
                            />
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </Card>
          </section>

          {/* ── Form column ─────────────────────────────────────────────── */}
          <section aria-label="Vendor detail" className="min-w-0">
            {formMode === 'empty' ? (
              <Card>
                <CardContent className="p-0 flex flex-col items-center justify-center min-h-[320px] text-center">
                  <Users
                    className="h-10 w-10 text-on-surface-variant"
                    aria-hidden
                  />
                  <p className="mt-3 text-base font-semibold text-on-surface">
                    Select a vendor on the left, or use + New vendor to add.
                  </p>
                  <p className="mt-1 text-sm text-on-surface-variant max-w-md">
                    Edits stay in draft until you save. Scope changes route
                    through the §2.7 widening / narrowing confirm flow.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="p-0">
                <CardHeader className="p-4 tablet:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                        {formMode === 'create' ? 'New vendor' : 'Edit vendor'}
                      </p>
                      <CardTitle className="mt-1 text-xl tablet:text-2xl text-on-surface">
                        {form.name || 'Unnamed vendor'}
                      </CardTitle>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <DraftPill isDraft={isDirty} mobileEyebrow />
                        {form.id ? (
                          <AuditLink entityRef={form.code} compact />
                        ) : null}
                        {scopeChangeAck ? (
                          <span className="inline-flex items-center rounded-pill bg-primary-container text-on-primary-container px-2 py-0.5 text-[11px] font-medium">
                            {scopeChangeAck}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResetForm}
                        disabled={!isDirty}
                      >
                        Reset
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveAttempt}
                        disabled={!isDirty}
                      >
                        <Save className="h-4 w-4" aria-hidden />
                        Save
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <SectionShift tone="low" aria-hidden />

                <CardContent className="p-4 tablet:p-6 flex flex-col gap-6">
                  {/* CC-DATA-QUALITY-ALERT — only when the deactivated demo vendor is loaded */}
                  {form.id === 'vnd-bandra-bever' ? (
                    <DataQualityAlertPane
                      alerts={[
                        {
                          id: 'dqa-bandra-bever',
                          kind: 'deactivated_vendor_open_po',
                          severity: 'info',
                          message:
                            'Vendor is deactivated and has 0 open POs — safe to remove from active picker.',
                          link: `/SI-PUR-002?vendor=${encodeURIComponent(form.id)}`,
                          context:
                            'FR116 cross-module check: open-PO count = 0 (mockup fixture; production reads from purchasing service).',
                        },
                      ]}
                    />
                  ) : null}

                  {/* Identity section */}
                  <div className="flex flex-col gap-4">
                    <h3 className="text-sm font-semibold text-on-surface">
                      Identity
                    </h3>
                    <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="form-name"
                          className="text-xs font-medium text-on-surface"
                        >
                          Vendor name
                          <span className="text-error ml-0.5" aria-hidden>
                            *
                          </span>
                        </label>
                        <Input
                          id="form-name"
                          required
                          value={form.name}
                          onChange={(e) => {
                            updateForm('name', e.target.value)
                            setDuplicateDismissed(false)
                          }}
                          placeholder="e.g. Bharat Spice Traders"
                        />
                        {/* CCDuplicateWarn — surfaces only on the create form when
                            the heuristic finds matches and the user has not
                            dismissed via "Proceed anyway". */}
                        {formMode === 'create' && duplicateMatches.length > 0 ? (
                          <CCDuplicateWarn
                            matches={duplicateMatches}
                            onEditExisting={(id) => {
                              const row = ROWS.find((r) => r.vendor.id === id)
                              if (row) handleEditRow(row)
                            }}
                            onProceedAnyway={() => setDuplicateDismissed(true)}
                          />
                        ) : null}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="form-code"
                          className="text-xs font-medium text-on-surface"
                        >
                          Vendor code
                        </label>
                        <Input
                          id="form-code"
                          value={form.code}
                          onChange={(e) => updateForm('code', e.target.value)}
                          placeholder="System-generated if blank"
                          className="font-mono"
                        />
                        <span className="text-[11px] text-on-surface-variant">
                          Leave blank to auto-generate as VEND-{'{SEQUENCE}'}.
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="form-gstin"
                          className="text-xs font-medium text-on-surface"
                        >
                          GSTIN
                        </label>
                        <Input
                          id="form-gstin"
                          value={form.gstin}
                          onChange={(e) => updateForm('gstin', e.target.value)}
                          placeholder="15-char GST identifier (optional)"
                          className="font-mono"
                        />
                        <span className="text-[11px] text-on-surface-variant">
                          Optional — small farms below threshold may not be
                          GST-registered.
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="form-pan"
                          className="text-xs font-medium text-on-surface"
                        >
                          PAN
                        </label>
                        <Input
                          id="form-pan"
                          value={form.pan}
                          onChange={(e) => updateForm('pan', e.target.value)}
                          placeholder="10-char PAN"
                          className="font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <SectionShift tone="lowest" aria-hidden />

                  {/* Contact section */}
                  <div className="flex flex-col gap-4">
                    <h3 className="text-sm font-semibold text-on-surface">
                      Contact
                    </h3>
                    <div className="grid grid-cols-1 tablet:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="form-contact"
                          className="text-xs font-medium text-on-surface"
                        >
                          Contact person
                        </label>
                        <Input
                          id="form-contact"
                          value={form.contactPerson}
                          onChange={(e) =>
                            updateForm('contactPerson', e.target.value)
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="form-phone"
                          className="text-xs font-medium text-on-surface"
                        >
                          Phone
                        </label>
                        <Input
                          id="form-phone"
                          value={form.phone}
                          onChange={(e) => updateForm('phone', e.target.value)}
                          inputMode="tel"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="form-email"
                          className="text-xs font-medium text-on-surface"
                        >
                          Email
                        </label>
                        <Input
                          id="form-email"
                          value={form.email}
                          onChange={(e) => updateForm('email', e.target.value)}
                          inputMode="email"
                        />
                      </div>
                    </div>
                  </div>

                  <SectionShift tone="lowest" aria-hidden />

                  {/* Address section */}
                  <div className="flex flex-col gap-4">
                    <h3 className="text-sm font-semibold text-on-surface">
                      Address
                    </h3>
                    <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5 tablet:col-span-2">
                        <label
                          htmlFor="form-street"
                          className="text-xs font-medium text-on-surface"
                        >
                          Street
                        </label>
                        <Input
                          id="form-street"
                          value={form.addressStreet}
                          onChange={(e) =>
                            updateForm('addressStreet', e.target.value)
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="form-city"
                          className="text-xs font-medium text-on-surface"
                        >
                          City
                        </label>
                        <Input
                          id="form-city"
                          value={form.addressCity}
                          onChange={(e) =>
                            updateForm('addressCity', e.target.value)
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="form-postal"
                          className="text-xs font-medium text-on-surface"
                        >
                          Postal code
                        </label>
                        <Input
                          id="form-postal"
                          value={form.addressPostal}
                          onChange={(e) =>
                            updateForm('addressPostal', e.target.value)
                          }
                          inputMode="numeric"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="form-state"
                          className="text-xs font-medium text-on-surface"
                        >
                          State
                        </label>
                        <Input
                          id="form-state"
                          value={form.state}
                          onChange={(e) => updateForm('state', e.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="form-state-code"
                          className="text-xs font-medium text-on-surface"
                        >
                          State code
                        </label>
                        <Input
                          id="form-state-code"
                          value={form.stateCode}
                          onChange={(e) =>
                            updateForm('stateCode', e.target.value)
                          }
                          className="font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <SectionShift tone="lowest" aria-hidden />

                  {/* Scope section */}
                  <ScopePicker
                    scope={form.scope}
                    clusterId={form.clusterId}
                    posLocationId={form.posLocationId}
                    onChange={updateScope}
                  />

                  <SectionShift tone="lowest" aria-hidden />

                  {/* Categories supplied */}
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold text-on-surface">
                      Categories supplied
                    </h3>
                    <CategoryPicker
                      value={form.categories}
                      onChange={(next) => updateForm('categories', next)}
                    />
                  </div>

                  <SectionShift tone="lowest" aria-hidden />

                  {/* Commercial */}
                  <div className="flex flex-col gap-4">
                    <h3 className="text-sm font-semibold text-on-surface">
                      Commercial
                    </h3>
                    <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="form-terms"
                          className="text-xs font-medium text-on-surface"
                        >
                          Credit terms (days)
                        </label>
                        <Input
                          id="form-terms"
                          type="number"
                          min="0"
                          step="1"
                          value={form.paymentTermsDays}
                          onChange={(e) =>
                            updateForm(
                              'paymentTermsDays',
                              Number(e.target.value),
                            )
                          }
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="form-mode"
                          className="text-xs font-medium text-on-surface"
                        >
                          Payment mode
                        </label>
                        <select
                          id="form-mode"
                          value={form.paymentMode}
                          onChange={(e) =>
                            updateForm(
                              'paymentMode',
                              e.target.value as PaymentMode,
                            )
                          }
                          className="h-11 rounded-sm bg-surface-container-highest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {PAYMENT_MODES.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-on-surface">
                        Quality rating
                      </span>
                      <QualityRating
                        value={form.qualityRating}
                        onChange={(n) => updateForm('qualityRating', n)}
                      />
                      <span className="text-[11px] text-on-surface-variant">
                        Aggregated from GR rejections (FR47a) + yields + manual
                        Brand-Owner input.
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-on-surface">
                          Preferred vendor
                        </span>
                        <span className="text-[11px] text-on-surface-variant max-w-md">
                          Preferred vendors sort first in PO creation pickers
                          (FR47).
                        </span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={form.preferred}
                        aria-label="Preferred vendor"
                        onClick={() =>
                          updateForm('preferred', !form.preferred)
                        }
                        className={[
                          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-pill transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          form.preferred
                            ? 'bg-primary'
                            : 'bg-surface-container-high',
                        ].join(' ')}
                      >
                        <span
                          aria-hidden
                          className={[
                            'inline-block h-5 w-5 rounded-full bg-surface-container-lowest transition-transform',
                            form.preferred
                              ? 'translate-x-6'
                              : 'translate-x-1',
                          ].join(' ')}
                        />
                      </button>
                    </div>

                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-on-surface">
                          Active
                        </span>
                        <span className="text-[11px] text-on-surface-variant max-w-md">
                          Inactive vendors are blocked from new POs but remain
                          visible in historical PO &amp; price records.
                        </span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={form.active}
                        aria-label="Active status"
                        onClick={() => updateForm('active', !form.active)}
                        className={[
                          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-pill transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          form.active ? 'bg-primary' : 'bg-surface-container-high',
                        ].join(' ')}
                      >
                        <span
                          aria-hidden
                          className={[
                            'inline-block h-5 w-5 rounded-full bg-surface-container-lowest transition-transform',
                            form.active ? 'translate-x-6' : 'translate-x-1',
                          ].join(' ')}
                        />
                      </button>
                    </div>

                    {form.id ? (
                      <dl className="grid grid-cols-2 gap-3 rounded-sm bg-surface-container-low p-3">
                        <div>
                          <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                            Created
                          </dt>
                          <dd className="text-sm text-on-surface tabular-nums mt-0.5">
                            {form.createdAt}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                            Last modified
                          </dt>
                          <dd className="text-sm text-on-surface tabular-nums mt-0.5">
                            {form.modifiedAt}
                          </dd>
                        </div>
                      </dl>
                    ) : null}
                  </div>

                  {/* Drill-down quick links — only when an existing vendor is loaded */}
                  {form.id ? (
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <Link
                        to={`/SI-PUR-002?vendor=${encodeURIComponent(form.id)}`}
                        className="inline-flex items-center gap-1.5 rounded-sm bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface min-h-[44px] tablet:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        View PO history
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                      <Link
                        to={`/SI-PUR-005?vendor=${encodeURIComponent(form.id)}`}
                        className="inline-flex items-center gap-1.5 rounded-sm bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface min-h-[44px] tablet:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        View price history
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </section>
        </div>

        {/* Scope-mutation confirm dialog */}
        {pendingMutation ? (
          <ScopeMutationDialog
            descriptor={pendingMutation}
            onCancel={() => setPendingMutation(null)}
            onConfirm={handleConfirmMutation}
          />
        ) : null}

        {/* Per-row deactivate confirm */}
        {deactivateConfirmFor ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm deactivation"
            className="fixed inset-0 z-50 flex items-center justify-center bg-inverse-surface/40 p-4"
            onClick={() => setDeactivateConfirmFor(null)}
          >
            <div
              className="w-full max-w-md rounded-md bg-surface-container-lowest"
              onClick={(e) => e.stopPropagation()}
            >
              <DeactivateConfirm
                vendorName={
                  ROWS.find((r) => r.vendor.id === deactivateConfirmFor)
                    ?.vendor.name ?? 'this vendor'
                }
                onCancel={() => setDeactivateConfirmFor(null)}
                onConfirm={() => setDeactivateConfirmFor(null)}
              />
            </div>
          </div>
        ) : null}

        {/* Inventory schema footer panel — surfaces all 12 schema fields */}
        <Card className="mt-8 p-0">
          <button
            type="button"
            onClick={() => setSchemaOpen((o) => !o)}
            aria-expanded={schemaOpen}
            aria-controls="inventory-schema-panel"
            className="flex w-full items-center justify-between gap-2 p-4 tablet:p-6 text-left min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          >
            <div>
              <CardTitle className="text-base text-on-surface">
                Inventory schema
              </CardTitle>
              <p className="mt-1 text-xs text-on-surface-variant">
                The 12 canonical schema fields surfaced for SI-MDM-005 per
                _planning/05-screen-inventory.md lines 454–503 (Tier 2
                acceptance, DL-025).
              </p>
            </div>
            {schemaOpen ? (
              <ChevronDown
                className="h-5 w-5 text-on-surface-variant shrink-0"
                aria-hidden
              />
            ) : (
              <ChevronRight
                className="h-5 w-5 text-on-surface-variant shrink-0"
                aria-hidden
              />
            )}
          </button>
          {schemaOpen ? (
            <>
              <SectionShift tone="low" aria-hidden />
              <CardContent
                id="inventory-schema-panel"
                className="p-4 tablet:p-6"
              >
                <dl className="grid grid-cols-1 tablet:grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      1 · Primary epic
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Epic 1 — Master Data Management
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      2 · Primary device
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      desktop-primary; mobile collapses to single-column with
                      list-then-form stack.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      3 · Roles &amp; scope
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Procurement Manager (brand / cluster create &amp; edit);
                      Brand Owner (brand) read-only review.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      4 · Purpose
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Create, edit and manage vendor records: contact, tax
                      identity, scope (Brand / Cluster / POS), categories
                      supplied, credit terms, preferred-vendor flag, quality
                      rating.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      5 · Data displayed
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Vendor name, code (system VEND-{'{SEQUENCE}'} or user
                      code), tax ID (GSTIN, PAN), status; contact person,
                      phone, email, address (street/city/postal/state); scope
                      level + linked cluster/POS; product categories supplied;
                      credit terms (days); payment mode; preferred-vendor
                      flag; quality rating (1–5 stars); creation +
                      last-modified dates; row action menu.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      6 · User actions
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Search / filter by name, code, scope, status, category;
                      create new vendor; edit details; deactivate (soft);
                      view PO history → SI-PUR-002; view price history →
                      SI-PUR-005; price-alert config (FR46, deferred to
                      Epic 5).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      7 · Cross-cutting
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      CC-AUDIT-LINK; CC-DRAFT-PILL; CC-DATA-QUALITY-ALERT (when
                      vendor deactivated with open POs); CC-DUPLICATE-WARN
                      (DL-026, B1) on the create-form name input.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      8 · Tokens (DESIGN.md)
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      surface, surface_container_lowest, on_surface,
                      on_surface_variant, status_confirmed (live row),
                      status_inactive (deactivated row), warning,
                      outline_variant.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      9 · Source FRs
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      FR6 (vendor master with scope tag — visible as scope
                      selector); FR46 (price spike monitoring — alert config
                      surface deferred to Epic 5).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      10 · Source journey(s)
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Procurement Manager — vendor price comparison (FR43),
                      price spike monitoring (FR46); references vendor records
                      during PO creation (Epic 5).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      11 · Related screens
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      sibling: SI-MDM-003 (product master); drill-downs:
                      SI-PUR-002 (PO list filtered to vendor) and SI-PUR-005
                      (vendor price comparison).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                      12 · Notes
                    </dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Scope tag determines visibility in PO creation forms
                      (Epic 5). Brand → Brand-Owner POs; Cluster →
                      Cluster-Manager POs; POS → POS-level POs. Preferred
                      flag influences PO sorting. Quality rating 1–5 stars,
                      aggregated from GR rejections (FR47a) + yields + manual
                      Brand-Owner input. Soft-delete; UI warns if vendor has
                      open POs and requires reason code (per §2.7).
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </>
          ) : null}
        </Card>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <Users className="h-3 w-3" aria-hidden />
          <span>
            Tier 2 vendor master · §2.7 scope picker + CCDuplicateWarn
            consumer + scope-mutation gate.
          </span>
          <span className="ml-auto">
            SI-MDM-005 · Tier 2 · Phase 4 Epic 1 Arc (b)
          </span>
        </footer>
      </div>
    </div>
  )
}

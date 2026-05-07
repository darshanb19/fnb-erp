import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronRight,
  CircleOff,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  Tag,
  Trash2,
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

import { materials, type Material, type Uom } from '@/lib/sample-data'

/**
 * SI-MDM-003 — Product Master CRUD.
 *
 * Tier 1 Group 1, screen 9 of Phase 2c-S3. Anchors the canonical heavy-form
 * chrome reused across CRUD master-data screens (SI-MDM-001 hierarchy,
 * SI-MDM-002 department register, SI-MDM-005 vendor master, SI-USR-002
 * user create/edit, SI-INF-008 issue ticket create/edit, SI-DSP-004 B2B
 * customer master).
 *
 * Layout — master-list + detail-form. The list (left) is the index of
 * products at brand scope; the detail panel (right) hosts the editable
 * form for the selected product OR the create-new form OR an empty
 * state. On mobile the layout collapses: the list stacks above and the
 * detail panel slides in / occupies full width when a row is tapped.
 *
 * Cross-cutting:
 *   - CC-AUDIT-LINK     — <AuditLink /> in the form header.
 *   - CC-DRAFT-PILL     — <DraftPill /> at the top of the form, driven
 *     by an `isDirty` flag on the form state. THIS screen introduces
 *     the shell. Per DESIGN.md §6.2 status durability MUST be visible.
 *   - CC-DATA-QUALITY-ALERT — inline chip on rows whose product is
 *     used in a deactivated recipe (FR116 cross-module inconsistency).
 *
 * Notes on Tier 1 acceptance §11 schema fields:
 *   - 12 inventory fields all surface in the form.
 *   - UOM conversions managed inline in a mini-grid (per the screen-
 *     inventory Notes line; not a separate screen).
 *   - Categories are multi-select via a Popover with checkboxes.
 *   - Soft-delete renders as a Confirm popover (no native dialog).
 *   - Bulk-deactivate via per-row checkbox column + top action button.
 *
 * Animation — NONE per CLAUDE.md (forms / tables ban entrance motion).
 *
 * Task B7 fix-back (Phase 4 Epic 1 Arc b): consumes CCDuplicateWarn shell
 * (DL-026) on the create-form Product-name input — mock fuzzy match against
 * the materials fixture; production replaces with `pg_trgm` ≥ 0.85 in Arc (c).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────────────────────

type ProductType = 'raw' | 'semi' | 'final'

const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  raw: 'Raw',
  semi: 'Semi-product',
  final: 'Final',
}

const UOM_OPTIONS: ReadonlyArray<{ value: Uom; label: string }> = [
  { value: 'kg', label: 'kg — kilogram' },
  { value: 'g', label: 'g — gram' },
  { value: 'l', label: 'l — litre' },
  { value: 'ml', label: 'ml — millilitre' },
  { value: 'pc', label: 'pc — piece' },
  { value: 'pkt', label: 'pkt — packet' },
]

const CATEGORY_OPTIONS: ReadonlyArray<string> = [
  'Spices',
  'Dairy',
  'Grains',
  'Meat',
  'Vegetables',
  'Fruits',
  'Beverages',
  'Bakery',
  'Sweet',
  'Dry-goods',
]

/** Heuristic product-type assignment — same logic as SI-INV-001. */
function productTypeOf(mat: Material): ProductType {
  const semiCats = ['Bakery', 'Cheese']
  const finalCats = ['Spirits', 'Wine', 'Beverages']
  if (semiCats.includes(mat.category)) return 'semi'
  if (finalCats.includes(mat.category)) return 'final'
  return 'raw'
}

/** Map raw fixture category onto the canonical 10-category multi-select. */
function defaultCategoriesOf(mat: Material): ReadonlyArray<string> {
  const c = mat.category
  // Direct hits first
  if (CATEGORY_OPTIONS.includes(c)) return [c]
  // Light mapping for fixtures using narrower categories
  if (['Whole Spices', 'Herbs'].includes(c)) return ['Spices']
  if (['Cheese'].includes(c)) return ['Dairy']
  if (['Pulses', 'Flour', 'Rice'].includes(c)) return ['Grains', 'Dry-goods']
  if (['Poultry', 'Seafood'].includes(c)) return ['Meat']
  if (['Coffee', 'Tea', 'Spirits', 'Wine'].includes(c)) return ['Beverages']
  if (['Oils'].includes(c)) return ['Dry-goods']
  return ['Dry-goods']
}

interface UomConversion {
  readonly id: string
  readonly fromUom: Uom
  readonly toUom: Uom
  readonly factor: number
}

const STANDARD_CONVERSIONS_BY_UOM: Record<Uom, ReadonlyArray<UomConversion>> = {
  kg: [{ id: 'kg-g', fromUom: 'kg', toUom: 'g', factor: 1000 }],
  g: [{ id: 'g-kg', fromUom: 'g', toUom: 'kg', factor: 0.001 }],
  l: [{ id: 'l-ml', fromUom: 'l', toUom: 'ml', factor: 1000 }],
  ml: [{ id: 'ml-l', fromUom: 'ml', toUom: 'l', factor: 0.001 }],
  pc: [{ id: 'pc-pkt', fromUom: 'pc', toUom: 'pkt', factor: 0.0833 }],
  pkt: [{ id: 'pkt-pc', fromUom: 'pkt', toUom: 'pc', factor: 12 }],
}

/** Form-state shape — derived from a fixture Material plus UI-only fields. */
interface ProductFormState {
  readonly id: string | null
  readonly name: string
  readonly sku: string
  readonly type: ProductType
  readonly defaultUom: Uom
  readonly conversions: ReadonlyArray<UomConversion>
  readonly yieldFactor: number
  readonly shelfLifeDays: number
  readonly categories: ReadonlyArray<string>
  readonly active: boolean
  readonly createdAt: string
  readonly modifiedAt: string
}

/** Listed-row derived shape. */
interface ProductRow {
  readonly id: string
  readonly material: Material
  readonly sku: string
  readonly type: ProductType
  readonly yieldFactor: number
  readonly shelfLifeDays: number
  readonly active: boolean
  readonly usedInDeactivatedRecipe: boolean
  readonly categories: ReadonlyArray<string>
  readonly createdAt: string
  readonly modifiedAt: string
}

/** Stable sku derived from material id — visible "system-generated" pattern. */
function skuOf(mat: Material): string {
  const tail = mat.id.replace(/^mat-/, '').toUpperCase().slice(0, 12)
  return `WS-${tail}`
}

/** Plausible yield factors per type — deterministic per fixture. */
function yieldFactorOf(mat: Material, type: ProductType): number {
  if (type === 'raw') {
    if (mat.category === 'Vegetables' || mat.category === 'Herbs') return 0.85
    if (mat.category === 'Meat' || mat.category === 'Seafood') return 0.7
    return 0.95
  }
  if (type === 'semi') return 0.92
  return 1.0
}

/** Plausible shelf-life — varies by category. */
function shelfLifeOf(mat: Material): number {
  switch (mat.category) {
    case 'Dairy':
    case 'Cheese':
      return 7
    case 'Meat':
    case 'Poultry':
    case 'Seafood':
      return 3
    case 'Vegetables':
    case 'Fruits':
    case 'Herbs':
      return 5
    case 'Bakery':
      return 4
    case 'Beverages':
      return 90
    case 'Oils':
      return 365
    default:
      return 180
  }
}

// Pre-pick rows. Keep all 50 fixture materials so the search exercises.
const PRODUCT_ROWS: ReadonlyArray<ProductRow> = materials.map((m, idx) => {
  const type = productTypeOf(m)
  // Deterministic activity / data-quality flag distribution.
  const active = !(m.id === 'mat-pork' || m.id === 'mat-wine-red')
  const usedInDeactivatedRecipe =
    m.id === 'mat-cardamom-green' || m.id === 'mat-pomfret'
  const dayOffset = (idx % 90) + 1
  const created = new Date(`2026-01-01T09:00:00+05:30`)
  created.setUTCDate(created.getUTCDate() + (idx % 30))
  const modified = new Date(`2026-04-15T09:00:00+05:30`)
  modified.setUTCDate(modified.getUTCDate() + (dayOffset % 21))
  return {
    id: m.id,
    material: m,
    sku: skuOf(m),
    type,
    yieldFactor: yieldFactorOf(m, type),
    shelfLifeDays: shelfLifeOf(m),
    active,
    usedInDeactivatedRecipe,
    categories: defaultCategoriesOf(m),
    createdAt: created.toISOString().slice(0, 10),
    modifiedAt: modified.toISOString().slice(0, 10),
  } satisfies ProductRow
})

function rowToFormState(row: ProductRow): ProductFormState {
  return {
    id: row.id,
    name: row.material.name,
    sku: row.sku,
    type: row.type,
    defaultUom: row.material.uom,
    conversions: STANDARD_CONVERSIONS_BY_UOM[row.material.uom],
    yieldFactor: row.yieldFactor,
    shelfLifeDays: row.shelfLifeDays,
    categories: row.categories,
    active: row.active,
    createdAt: row.createdAt,
    modifiedAt: row.modifiedAt,
  }
}

const EMPTY_FORM: ProductFormState = {
  id: null,
  name: '',
  sku: '',
  type: 'raw',
  defaultUom: 'kg',
  conversions: STANDARD_CONVERSIONS_BY_UOM.kg,
  yieldFactor: 0.95,
  shelfLifeDays: 30,
  categories: [],
  active: true,
  createdAt: '',
  modifiedAt: '',
}

// ─────────────────────────────────────────────────────────────────────────────
// CCDuplicateWarn matcher (mock similarity heuristic per Task B7 brief)
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
  return materials
    .filter((m) => m.id !== excludeId)
    .filter((m) => {
      const head = m.name.toLowerCase().replace(/\s+/g, '').slice(0, 5)
      let shared = 0
      for (const ch of head) if (qChars.has(ch)) shared += 1
      return shared >= 3
    })
    .map((m) => ({
      id: m.id,
      name: m.name,
      subtitle: `${m.category} · ₹${m.lkp_per_uom}/${m.uom}`,
      status: 'active' as const,
    }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface ProductTypeChipProps {
  readonly type: ProductType
}

/** Distinct chrome per product type — neutral / surface_container_high /
 *  secondary_container — per task brief. */
function ProductTypeChip({ type }: ProductTypeChipProps) {
  const cls =
    type === 'raw'
      ? 'bg-surface-container text-on-surface-variant'
      : type === 'semi'
        ? 'bg-surface-container-high text-on-surface'
        : 'bg-secondary-container text-on-secondary-container'
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {PRODUCT_TYPE_LABEL[type]}
    </span>
  )
}

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
  readonly row: ProductRow
  readonly onEdit: () => void
  readonly onDeactivate: () => void
}

function RowActionMenu({ row, onEdit, onDeactivate }: RowActionMenuProps) {
  const [open, setOpen] = useState(false)
  // Drill-down target depends on type
  const drillLabel =
    row.type === 'raw' ? 'View vendor pricing' : 'View recipes'
  const drillTo =
    row.type === 'raw'
      ? `/SI-PUR-005?product=${encodeURIComponent(row.id)}`
      : `/SI-REC-001?product=${encodeURIComponent(row.id)}`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label={`Row actions for ${row.material.name}`}
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
              to={drillTo}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 rounded-sm text-sm text-on-surface min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {drillLabel}
            </Link>
          </li>
          <li>
            <button
              type="button"
              onClick={() => {
                onDeactivate()
                setOpen(false)
              }}
              disabled={!row.active}
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
          <PopoverContent align="start" className="w-64 p-1">
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

interface UomConversionsEditorProps {
  readonly defaultUom: Uom
  readonly value: ReadonlyArray<UomConversion>
  readonly onChange: (next: ReadonlyArray<UomConversion>) => void
}

function UomConversionsEditor({
  defaultUom,
  value,
  onChange,
}: UomConversionsEditorProps) {
  const addRow = () => {
    const targetUom: Uom = defaultUom === 'kg' ? 'g' : 'kg'
    const newRow: UomConversion = {
      id: `conv-${Date.now()}`,
      fromUom: defaultUom,
      toUom: targetUom,
      factor: 1,
    }
    onChange([...value, newRow])
  }
  const removeRow = (id: string) =>
    onChange(value.filter((c) => c.id !== id))
  const update = (id: string, patch: Partial<UomConversion>) =>
    onChange(value.map((c) => (c.id === id ? { ...c, ...patch } : c)))

  return (
    <div className="flex flex-col gap-2">
      {value.length === 0 ? (
        <p className="text-xs text-on-surface-variant">
          No conversions defined. Add a row to map alternate units.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {value.map((conv) => (
            <div
              key={conv.id}
              className="grid grid-cols-[auto_1fr_auto_1fr_auto_auto] items-center gap-2 rounded-sm bg-surface-container-low p-2"
            >
              <span className="text-xs text-on-surface-variant px-1">
                1
              </span>
              <select
                aria-label="From UOM"
                className="h-9 rounded-sm bg-surface-container-highest px-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                value={conv.fromUom}
                onChange={(e) =>
                  update(conv.id, { fromUom: e.target.value as Uom })
                }
              >
                {UOM_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.value}
                  </option>
                ))}
              </select>
              <span className="text-xs text-on-surface-variant px-1">=</span>
              <Input
                type="number"
                aria-label="Conversion factor"
                step="0.0001"
                min="0"
                value={conv.factor}
                onChange={(e) =>
                  update(conv.id, { factor: Number(e.target.value) })
                }
                className="h-9"
              />
              <select
                aria-label="To UOM"
                className="h-9 rounded-sm bg-surface-container-highest px-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                value={conv.toUom}
                onChange={(e) =>
                  update(conv.id, { toUom: e.target.value as Uom })
                }
              >
                {UOM_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.value}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label="Remove conversion"
                onClick={() => removeRow(conv.id)}
              >
                <Trash2 className="h-4 w-4 text-error" aria-hidden />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button
        variant="tonal"
        size="sm"
        className="self-start"
        onClick={addRow}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Add conversion
      </Button>
    </div>
  )
}

interface DeactivateConfirmProps {
  readonly productName: string
  readonly onCancel: () => void
  readonly onConfirm: () => void
}

function DeactivateConfirm({
  productName,
  onCancel,
  onConfirm,
}: DeactivateConfirmProps) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold text-on-surface">
        Deactivate {productName}?
      </h3>
      <p className="text-xs text-on-surface-variant">
        This blocks assignment to new recipes and POs but preserves history.
        Deactivated products remain visible to data-quality alerts.
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

interface BulkDeactivateConfirmProps {
  readonly count: number
  readonly onCancel: () => void
  readonly onConfirm: () => void
}

function BulkDeactivateConfirm({
  count,
  onCancel,
  onConfirm,
}: BulkDeactivateConfirmProps) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="text-sm font-semibold text-on-surface">
        Deactivate {count} {count === 1 ? 'product' : 'products'}?
      </h3>
      <p className="text-xs text-on-surface-variant">
        They will be hidden from new recipes and POs but remain visible in
        audit history.
      </p>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="destructive" size="sm" onClick={onConfirm}>
          Deactivate {count}
        </Button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function SiMdm003() {
  // Filter / search state
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<ReadonlySet<ProductType>>(
    new Set(),
  )
  const [categoryFilter, setCategoryFilter] = useState<ReadonlySet<string>>(
    new Set(),
  )
  const [activeFilter, setActiveFilter] = useState<ReadonlySet<'active' | 'inactive'>>(
    new Set(),
  )

  // Selection state — bulk-action checkbox
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)

  // Form state
  const initialFormRow = PRODUCT_ROWS[0]!
  const [formMode, setFormMode] = useState<'edit' | 'create' | 'empty'>('edit')
  const [form, setForm] = useState<ProductFormState>(rowToFormState(initialFormRow))
  const [isDirty, setIsDirty] = useState(false)
  const [duplicateDismissed, setDuplicateDismissed] = useState(false)
  const [deactivateConfirmFor, setDeactivateConfirmFor] = useState<string | null>(
    null,
  )

  // Filtered list
  const filtered = useMemo(() => {
    return PRODUCT_ROWS.filter((r) => {
      if (typeFilter.size > 0 && !typeFilter.has(r.type)) return false
      if (categoryFilter.size > 0) {
        const hit = r.categories.some((c) => categoryFilter.has(c))
        if (!hit) return false
      }
      if (activeFilter.size > 0) {
        const key: 'active' | 'inactive' = r.active ? 'active' : 'inactive'
        if (!activeFilter.has(key)) return false
      }
      if (search.trim().length > 0) {
        const q = search.trim().toLowerCase()
        const hay = `${r.material.name} ${r.sku}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [search, typeFilter, categoryFilter, activeFilter])

  const anyFilterActive =
    typeFilter.size > 0 ||
    categoryFilter.size > 0 ||
    activeFilter.size > 0 ||
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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id))
  const toggleSelectAllFiltered = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.id)))
    }
  }

  // Form handlers
  const updateForm = <K extends keyof ProductFormState>(
    k: K,
    v: ProductFormState[K],
  ) => {
    setForm((f) => ({ ...f, [k]: v }))
    setIsDirty(true)
  }

  const handleEditRow = (row: ProductRow) => {
    setFormMode('edit')
    setForm(rowToFormState(row))
    setIsDirty(false)
    setDuplicateDismissed(false)
  }

  const handleCreateNew = () => {
    setFormMode('create')
    setForm(EMPTY_FORM)
    setIsDirty(true)
    setDuplicateDismissed(false)
  }

  const handleSave = () => {
    // Visual-only — flip durability state without mutating the fixture.
    setIsDirty(false)
    if (formMode === 'create') setFormMode('edit')
  }

  const handleResetForm = () => {
    if (formMode === 'create') {
      setForm(EMPTY_FORM)
    } else if (form.id !== null) {
      const row = PRODUCT_ROWS.find((r) => r.id === form.id)
      if (row) setForm(rowToFormState(row))
    }
    setIsDirty(false)
  }

  // Counts
  const totalProducts = PRODUCT_ROWS.length
  const inactiveProducts = PRODUCT_ROWS.filter((r) => !r.active).length

  // Duplicate matches for the create-form name input.
  const duplicateMatches = useMemo(() => {
    if (formMode !== 'create') return []
    if (duplicateDismissed) return []
    return fuzzyMatchesByName(form.name, form.id)
  }, [formMode, form.name, form.id, duplicateDismissed])

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1440px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Master data · Products
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Product master
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              {totalProducts} products at brand scope ·{' '}
              {inactiveProducts > 0
                ? `${inactiveProducts} deactivated`
                : 'All active'}
              . Edit on the right; create new from the action bar. Soft-delete
              preserves history per FR3 / FR7.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Popover
              open={bulkConfirmOpen}
              onOpenChange={(o) => {
                if (selectedIds.size === 0) return
                setBulkConfirmOpen(o)
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="tonal"
                  size="default"
                  disabled={selectedIds.size === 0}
                  aria-label={`Deactivate ${selectedIds.size} selected products`}
                >
                  <CircleOff className="h-4 w-4" aria-hidden />
                  Deactivate selected
                  {selectedIds.size > 0 ? (
                    <span className="ml-1.5 inline-flex items-center justify-center rounded-pill bg-primary px-1.5 text-[10px] font-semibold text-on-primary min-w-[1.25rem]">
                      {selectedIds.size}
                    </span>
                  ) : null}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <BulkDeactivateConfirm
                  count={selectedIds.size}
                  onCancel={() => setBulkConfirmOpen(false)}
                  onConfirm={() => {
                    // Visual only — clear selection and dismiss.
                    setSelectedIds(new Set())
                    setBulkConfirmOpen(false)
                  }}
                />
              </PopoverContent>
            </Popover>
            <Button onClick={handleCreateNew} aria-label="Create new product">
              <Plus className="h-4 w-4" aria-hidden />
              New product
            </Button>
          </div>
        </header>

        {/* Two-column layout: list + form */}
        <div className="mt-6 grid grid-cols-1 desktop:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6">
          {/* ── List column ─────────────────────────────────────────────── */}
          <section aria-label="Product list" className="flex flex-col gap-3">
            {/* Filter strip */}
            <div className="rounded-md bg-surface-container-low p-3">
              <div className="flex flex-wrap items-center gap-2">
                <FilterChipPicker<ProductType>
                  title="Type"
                  options={(['raw', 'semi', 'final'] as const).map((v) => ({
                    value: v,
                    label: PRODUCT_TYPE_LABEL[v],
                  }))}
                  selected={typeFilter}
                  onToggle={(v) => setTypeFilter(toggleSet(typeFilter, v))}
                  onClear={() => setTypeFilter(new Set())}
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
                {anyFilterActive ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2 ml-auto gap-1"
                    onClick={() => {
                      setTypeFilter(new Set())
                      setCategoryFilter(new Set())
                      setActiveFilter(new Set())
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
                  aria-label="Search products by name or SKU"
                  placeholder="Search by name or SKU"
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Result list */}
            <Card className="p-0">
              <div className="px-4 py-3 flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold text-on-surface">
                  Products
                </h2>
                <span className="text-xs text-on-surface-variant tabular-nums">
                  {filtered.length} of {totalProducts}
                </span>
              </div>
              <SectionShift tone="low" aria-hidden />

              {filtered.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm font-semibold text-on-surface">
                    No products match the current filter.
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Adjust the chips above or clear them to see every product.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <input
                          type="checkbox"
                          aria-label={
                            allFilteredSelected
                              ? 'Deselect all filtered'
                              : 'Select all filtered'
                          }
                          checked={allFilteredSelected}
                          onChange={toggleSelectAllFiltered}
                          className="h-4 w-4 cursor-pointer accent-primary"
                        />
                      </TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="hidden tablet:table-cell">
                        Type
                      </TableHead>
                      <TableHead className="hidden tablet:table-cell">
                        UOM
                      </TableHead>
                      <TableHead className="hidden desktop:table-cell text-right">
                        Yield
                      </TableHead>
                      <TableHead className="hidden desktop:table-cell text-right">
                        Shelf
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12" aria-label="Row actions" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((row) => {
                      const isSelected = selectedIds.has(row.id)
                      const isOpenInForm = form.id === row.id
                      return (
                        <TableRow
                          key={row.id}
                          className={[
                            'transition-colors',
                            isOpenInForm
                              ? 'bg-surface-container'
                              : 'hover:bg-surface-container-low',
                          ].join(' ')}
                        >
                          <TableCell>
                            <input
                              type="checkbox"
                              aria-label={`Select ${row.material.name}`}
                              checked={isSelected}
                              onChange={() => toggleSelect(row.id)}
                              className="h-4 w-4 cursor-pointer accent-primary"
                            />
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => handleEditRow(row)}
                              className="block text-left min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm w-full"
                            >
                              <div className="flex items-center flex-wrap gap-1.5">
                                <span className="font-medium text-on-surface">
                                  {row.material.name}
                                </span>
                                {row.usedInDeactivatedRecipe ? (
                                  <StatusPill
                                    status="status_inactive"
                                    size="sm"
                                    label="Used in deactivated recipe"
                                  />
                                ) : null}
                              </div>
                              <p className="text-[11px] text-on-surface-variant font-mono mt-0.5">
                                {row.sku}
                              </p>
                              {/* Type / uom shown inline at mobile */}
                              <div className="flex tablet:hidden items-center flex-wrap gap-1.5 mt-1">
                                <ProductTypeChip type={row.type} />
                                <span className="text-[11px] text-on-surface-variant">
                                  {row.material.uom} · yield{' '}
                                  {row.yieldFactor.toFixed(2)} · {row.shelfLifeDays}{' '}
                                  d
                                </span>
                              </div>
                            </button>
                          </TableCell>
                          <TableCell className="hidden tablet:table-cell">
                            <ProductTypeChip type={row.type} />
                          </TableCell>
                          <TableCell className="hidden tablet:table-cell text-on-surface-variant text-xs">
                            {row.material.uom}
                          </TableCell>
                          <TableCell className="hidden desktop:table-cell text-right tabular-nums text-on-surface-variant text-xs">
                            {row.yieldFactor.toFixed(2)}
                          </TableCell>
                          <TableCell className="hidden desktop:table-cell text-right tabular-nums text-on-surface-variant text-xs">
                            {row.shelfLifeDays} d
                          </TableCell>
                          <TableCell>
                            {row.active ? (
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
                                setDeactivateConfirmFor(row.id)
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
          <section aria-label="Product detail" className="min-w-0">
            {formMode === 'empty' ? (
              <Card>
                <CardContent className="p-0 flex flex-col items-center justify-center min-h-[320px] text-center">
                  <Tag
                    className="h-10 w-10 text-on-surface-variant"
                    aria-hidden
                  />
                  <p className="mt-3 text-base font-semibold text-on-surface">
                    Select a product on the left, or use + New product to add.
                  </p>
                  <p className="mt-1 text-sm text-on-surface-variant max-w-md">
                    The form panel populates with the selected product's
                    fields. Edits stay in draft until you save.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card className="p-0">
                {/* Form header */}
                <CardHeader className="p-4 tablet:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                        {formMode === 'create'
                          ? 'New product'
                          : 'Edit product'}
                      </p>
                      <CardTitle className="mt-1 text-xl tablet:text-2xl text-on-surface">
                        {form.name || 'Unnamed product'}
                      </CardTitle>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <DraftPill isDraft={isDirty} mobileEyebrow />
                        {form.id ? (
                          <AuditLink entityRef={form.sku} compact />
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
                        onClick={handleSave}
                        disabled={!isDirty}
                      >
                        <Save className="h-4 w-4" aria-hidden />
                        Save
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <SectionShift tone="low" aria-hidden />

                {/* Form body */}
                <CardContent className="p-4 tablet:p-6 flex flex-col gap-6">
                  {/* Identity section */}
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="form-name"
                          className="text-xs font-medium text-on-surface"
                        >
                          Product name
                          <span className="text-error ml-0.5" aria-hidden>
                            *
                          </span>
                        </label>
                        <Input
                          id="form-name"
                          required
                          value={form.name}
                          onChange={(e) => updateForm('name', e.target.value)}
                          placeholder="e.g. Fresh Paneer"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="form-sku"
                          className="text-xs font-medium text-on-surface"
                        >
                          SKU
                        </label>
                        <Input
                          id="form-sku"
                          value={form.sku}
                          onChange={(e) => updateForm('sku', e.target.value)}
                          placeholder="System-generated if blank"
                          className="font-mono"
                        />
                        <span className="text-[11px] text-on-surface-variant">
                          Leave blank to auto-generate from product name.
                        </span>
                      </div>
                    </div>

                    {/* DL-026 / Task B7 fix-back: CC-DUPLICATE-WARN below the
                        name input, full-width row outside the 2-col grid so
                        the panel does not break the SKU column. */}
                    <CCDuplicateWarn
                      matches={duplicateMatches}
                      onEditExisting={(id) => {
                        const row = PRODUCT_ROWS.find((r) => r.id === id)
                        if (row) handleEditRow(row)
                      }}
                      onProceedAnyway={() => setDuplicateDismissed(true)}
                    />

                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-on-surface">
                        Product type
                      </span>
                      <div
                        role="radiogroup"
                        aria-label="Product type"
                        className="flex flex-wrap items-center gap-2"
                      >
                        {(['raw', 'semi', 'final'] as const).map((t) => {
                          const active = form.type === t
                          return (
                            <button
                              key={t}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => updateForm('type', t)}
                              className={[
                                'inline-flex items-center gap-2 rounded-pill px-4 h-11 min-w-[44px] text-sm font-medium',
                                'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                                active
                                  ? 'bg-primary text-on-primary'
                                  : 'bg-surface-container text-on-surface hover:bg-surface-container-high',
                              ].join(' ')}
                            >
                              {PRODUCT_TYPE_LABEL[t]}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  <SectionShift tone="lowest" aria-hidden />

                  {/* UOM section */}
                  <div className="flex flex-col gap-4">
                    <h3 className="text-sm font-semibold text-on-surface">
                      Units & conversions
                    </h3>
                    <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="form-uom"
                          className="text-xs font-medium text-on-surface"
                        >
                          Default UOM
                        </label>
                        <select
                          id="form-uom"
                          value={form.defaultUom}
                          onChange={(e) =>
                            updateForm('defaultUom', e.target.value as Uom)
                          }
                          className="h-11 rounded-sm bg-surface-container-highest px-3 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {UOM_OPTIONS.map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-medium text-on-surface">
                        UOM conversions
                      </span>
                      <UomConversionsEditor
                        defaultUom={form.defaultUom}
                        value={form.conversions}
                        onChange={(next) => updateForm('conversions', next)}
                      />
                    </div>
                  </div>

                  <SectionShift tone="lowest" aria-hidden />

                  {/* Yield + shelf life */}
                  <div className="flex flex-col gap-4">
                    <h3 className="text-sm font-semibold text-on-surface">
                      Yield & shelf life
                    </h3>
                    <div className="grid grid-cols-1 tablet:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="form-yield"
                          className="text-xs font-medium text-on-surface"
                        >
                          Yield factor
                        </label>
                        <Input
                          id="form-yield"
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={form.yieldFactor}
                          onChange={(e) =>
                            updateForm('yieldFactor', Number(e.target.value))
                          }
                        />
                        <span className="text-[11px] text-on-surface-variant">
                          Yield factor is the proportion retained after
                          preparation (0.85 = 15 % loss).
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor="form-shelf"
                          className="text-xs font-medium text-on-surface"
                        >
                          Shelf-life (days)
                        </label>
                        <Input
                          id="form-shelf"
                          type="number"
                          step="1"
                          min="0"
                          value={form.shelfLifeDays}
                          onChange={(e) =>
                            updateForm(
                              'shelfLifeDays',
                              Number(e.target.value),
                            )
                          }
                        />
                        <span className="text-[11px] text-on-surface-variant">
                          Shelf-life is the days from receipt before the
                          material expires.
                        </span>
                      </div>
                    </div>
                  </div>

                  <SectionShift tone="lowest" aria-hidden />

                  {/* Categories */}
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold text-on-surface">
                      Categories
                    </h3>
                    <CategoryPicker
                      value={form.categories}
                      onChange={(next) => updateForm('categories', next)}
                    />
                  </div>

                  <SectionShift tone="lowest" aria-hidden />

                  {/* Active toggle + meta */}
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-on-surface">
                          Active
                        </span>
                        <span className="text-[11px] text-on-surface-variant max-w-md">
                          Inactive products are blocked from new recipes and
                          POs but remain visible to data-quality alerts.
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
                          form.active
                            ? 'bg-primary'
                            : 'bg-surface-container-high',
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

                  {/* Drill-down quick links — only when an existing product is loaded */}
                  {form.id ? (
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      {form.type === 'raw' ? (
                        <Link
                          to={`/SI-PUR-005?product=${encodeURIComponent(form.id)}`}
                          className="inline-flex items-center gap-1.5 rounded-sm bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface min-h-[44px] tablet:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          View vendor pricing
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      ) : (
                        <Link
                          to={`/SI-REC-001?product=${encodeURIComponent(form.id)}`}
                          className="inline-flex items-center gap-1.5 rounded-sm bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface min-h-[44px] tablet:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          View recipes using this product
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      )}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )}
          </section>
        </div>

        {/* Per-row deactivate confirm — modal-positioned popover overlay */}
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
                productName={
                  PRODUCT_ROWS.find((r) => r.id === deactivateConfirmFor)
                    ?.material.name ?? 'this product'
                }
                onCancel={() => setDeactivateConfirmFor(null)}
                onConfirm={() => {
                  // Visual only — clear and dismiss.
                  setDeactivateConfirmFor(null)
                }}
              />
            </div>
          </div>
        ) : null}

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <Tag className="h-3 w-3" aria-hidden />
          <span>
            CRUD master-data anchor · CC-DRAFT-PILL surfaces durability per
            DESIGN.md §6.2.
          </span>
          <span className="ml-auto">SI-MDM-003 · Tier 1 Group 1 · Phase 2c-S3</span>
        </footer>
      </div>
    </div>
  )
}

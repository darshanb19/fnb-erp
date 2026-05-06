import { useState, type ComponentType, type SVGProps } from 'react'
import { Link } from 'react-router-dom'
import {
  Archive,
  BookMarked,
  CalendarX,
  Check,
  CheckCheck,
  CircleHelp,
  CircleOff,
  CircleX,
  Clock,
  CornerUpLeft,
  FlaskConical,
  OctagonX,
  PackageX,
  PencilLine,
  Play,
  Repeat,
  TriangleAlert,
  Truck,
} from 'lucide-react'

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  SectionShift,
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  StatusPill as StatusPillShell,
  DashboardTile,
  OverrideWidget,
  PendingGRDrill,
  DataQualityAlertPane,
  ExportTrigger,
  AuditLink,
  ApprovalInboxCard,
  type ApprovalCard,
  PairedTransferBundle,
  type PairedTransferLeg,
  TrnDisplay,
  ProvisionalFlag,
  LifecycleStepper,
  STOCK_TRANSFER_LIFECYCLE_STEPS,
  B2B_CHALLAN_LIFECYCLE_STEPS,
  IssueTicketLink,
  DraftPill,
  FCCCDualSurface,
  type FCCCComparison,
  type FCCCPeriod,
  type FCCCScope,
  type FCCCSurface,
  GSTFieldValidation,
  UnregisteredCustomerWarn,
} from '@/shell'
import { tokens, isStatusPipToken, type StatusKey } from '@/tokens'
import { vendors } from '@/lib/sample-data'
import { personas } from '@/lib/personas'

/**
 * ComponentsIndex — `/_dev/components`, plan §10.9.
 *
 * Permutation viewer for the shell-component primitives shipped in this
 * Phase 2c-S2 scaffold. Each grid renders the variants relevant to that
 * primitive so the reviewer can eyeball the resolved colours, hover states,
 * and dimensional treatment before screen authors consume them.
 *
 * Three-viewport toggle constrains the grid wrapper's max-width so we can
 * sanity-check responsive behaviour without resizing the browser.
 */

type LucideIcon = ComponentType<SVGProps<SVGSVGElement>>

/**
 * Map every kebab-case icon string referenced in tokens.ts to the matching
 * lucide-react component. We import explicitly (not via dynamic-name lookup)
 * so TypeScript can verify each icon exists at build time.
 */
const ICONS: Record<string, LucideIcon> = {
  archive: Archive,
  'book-marked': BookMarked,
  'calendar-x': CalendarX,
  check: Check,
  'check-check': CheckCheck,
  'circle-help': CircleHelp,
  'circle-off': CircleOff,
  'circle-x': CircleX,
  clock: Clock,
  'corner-up-left': CornerUpLeft,
  'flask-conical': FlaskConical,
  'octagon-x': OctagonX,
  'package-x': PackageX,
  'pencil-line': PencilLine,
  play: Play,
  repeat: Repeat,
  'triangle-alert': TriangleAlert,
  truck: Truck,
}

const STATUS_KEYS: ReadonlyArray<StatusKey> = (
  Object.keys(tokens) as Array<keyof typeof tokens>
).filter((k): k is StatusKey => k.startsWith('status_'))

/**
 * StatusPill cell — uses inline `style` for both row and pip variants.
 *
 * Why inline style (not Tailwind utilities like `bg-status-draft-bg`)?
 * Tailwind v4 generates a utility for every `--color-*` declared in
 * `@theme inline`, and globals.css does declare them. In testing the
 * scaffold, the dev build does resolve those utilities; however, mixing 20
 * dynamically-named utilities with the JIT scanner risked false negatives
 * (the scanner can't always prove the class exists when the name is built
 * via interpolation). Driving every pill from `tokens.ts` directly keeps the
 * permutation grid an authoritative round-trip of the token table — what
 * you see here IS the spec. No fallback is needed because nothing builds a
 * Tailwind class name from a runtime string.
 *
 * For pip-pattern statuses (DESIGN.md §6.1 margin-accent pattern), the row
 * background stays `surface_container_lowest` and the colour rides on a
 * 4-px left pip — rendered via a dedicated leading element, never as a
 * 1-px `border` (§5.2 no-line rule).
 */
function StatusPill({ statusKey }: { statusKey: StatusKey }) {
  const token = tokens[statusKey]
  const Icon = ICONS[token.icon] as LucideIcon | undefined
  const label = statusKey.replace(/^status_/, '').replace(/_/g, ' ')

  if (isStatusPipToken(token)) {
    return (
      <div
        className="flex items-stretch rounded-sm overflow-hidden bg-surface-container-lowest"
        role="status"
      >
        <span
          aria-hidden
          className="w-1 shrink-0"
          style={{ backgroundColor: token.pip }}
        />
        <span
          className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium"
          style={{ color: token.fg }}
        >
          {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
          <span>{label}</span>
        </span>
      </div>
    )
  }

  return (
    <span
      role="status"
      className="inline-flex items-center gap-1.5 rounded-pill px-2 py-1 text-xs font-medium"
      style={{ backgroundColor: token.bg, color: token.fg }}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
      <span>{label}</span>
    </span>
  )
}

function GridSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section aria-labelledby={`grid-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <h2
        id={`grid-${title.toLowerCase().replace(/\s+/g, '-')}`}
        className="text-base font-semibold text-on-surface mb-1"
      >
        {title}
      </h2>
      {description ? (
        <p className="text-xs text-on-surface-variant mb-4">{description}</p>
      ) : null}
      {children}
    </section>
  )
}

const VIEWPORTS = [
  { label: '375 px', value: 375 },
  { label: '768 px', value: 768 },
  { label: '1280 px', value: 1280 },
] as const
type Viewport = (typeof VIEWPORTS)[number]['value']

// Permutations for FCCCDualSurface — three variants demonstrating the
// shared chrome (financial / operational tabs) and the cross-link state
// with a selected item. State is local to each permutation so the URL
// search-params don't bleed across the dev grid.
function FCCCDualSurfacePermutations() {
  const variants: ReadonlyArray<{
    surface: FCCCSurface
    label: string
    period: FCCCPeriod
    scope: FCCCScope
    comparison: FCCCComparison
    selectedItemId: string | null
    selectedItemLabel: string | null
  }> = [
    {
      surface: 'financial',
      label: 'Financial — no item followed',
      period: 'apr_2026',
      scope: 'brand',
      comparison: 'prior_month',
      selectedItemId: null,
      selectedItemLabel: null,
    },
    {
      surface: 'operational',
      label: 'Operational — no item followed',
      period: 'apr_2026',
      scope: 'cluster_bandra',
      comparison: 'qoq',
      selectedItemId: null,
      selectedItemLabel: null,
    },
    {
      surface: 'financial',
      label: 'Financial — cross-link active (Mutton Galouti)',
      period: 'apr_2026',
      scope: 'brand',
      comparison: 'prior_month',
      selectedItemId: 'mi-mutton-galouti',
      selectedItemLabel: 'Mutton Galouti Kebab',
    },
  ]
  return (
    <div className="flex flex-col gap-4">
      {variants.map((v, i) => (
        <div key={`${v.surface}-${i}`} className="rounded-md bg-surface-container-low p-2">
          <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            {v.label}
          </p>
          <div className="rounded-md overflow-hidden">
            <FCCCDualSurface
              surface={v.surface}
              period={v.period}
              scope={v.scope}
              comparison={v.comparison}
              selectedItemId={v.selectedItemId}
              selectedItemLabel={v.selectedItemLabel}
              onPeriodChange={() => {}}
              onScopeChange={() => {}}
              onComparisonChange={() => {}}
              onDeselectItem={() => {}}
            >
              <div className="rounded-md bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant">
                {v.surface === 'financial'
                  ? 'Body slot · per-item food-cost table renders here in SI-ACC-010.'
                  : 'Body slot · cost-per-serving + Pareto + trend panels render here in SI-RPT-006.'}
              </div>
            </FCCCDualSurface>
          </div>
        </div>
      ))}
    </div>
  )
}

// Permutations for ApprovalInboxCard.
function ApprovalInboxPermutations() {
  const [selected, setSelected] = useState<Set<string>>(new Set(['perm-card-1']))
  const onToggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const targets = personas.slice(1, 5).map((p) => ({
    id: p.id,
    name: p.name,
    role: p.role,
  }))
  // Build 4 fixture cards covering single/paired/>72h/no-checkbox variants.
  const fixtures: ReadonlyArray<ApprovalCard> = [
    {
      id: 'perm-card-1',
      source_module: 'inventory',
      entity_type: 'Material Requisition',
      entity_ref: 'REQ-2026-WST-BAND-0418',
      entity_route: '/SI-INV-005',
      requesting_user: 'Arjun Reddy',
      requesting_user_role: 'Store Manager',
      requested_at: new Date(Date.now() - 1 * 3600000).toISOString(),
      value: 4200,
      value_band: 'Below ₹ 25,000 · Wild Sugar Bandra',
      chain_step: 'Step 1 of 1 · Cluster Manager',
      route_reason: 'auto_threshold',
      chain_state: 'pending',
      bulk_eligible: true,
    },
    {
      id: 'perm-card-2',
      source_module: 'inventory',
      entity_type: 'Paired Transfer Bundle',
      entity_ref: 'PTR-2026-WST-0042',
      entity_route: '/SI-INV-007',
      requesting_user: 'Rohan Mehta',
      requesting_user_role: 'Cluster Manager',
      requested_at: new Date(Date.now() - 8 * 3600000).toISOString(),
      value: 18450,
      value_band: 'Cross-cluster · semi-product transfer',
      chain_step: 'Step 2 of 2 · Brand Owner',
      route_reason: 'chain_step',
      chain_state: 'pending',
      bulk_eligible: false,
      bundle: {
        source_location: 'CK Bandra',
        brand_step: 'Brand routing',
        destination_location: 'POS Powai',
      },
    },
    {
      id: 'perm-card-3',
      source_module: 'procurement',
      entity_type: 'Purchase Order',
      entity_ref: 'PO-2026-AND-WST-0231',
      entity_route: '/SI-PUR-003',
      requesting_user: 'Vikram Singh',
      requesting_user_role: 'Procurement Manager',
      requested_at: new Date(Date.now() - 76 * 3600000).toISOString(),
      value: 184500,
      value_band: 'Above ₹ 1,00,000 · Bharat Spice Traders',
      chain_step: 'Step 3 of 3 · Brand Owner',
      route_reason: 'auto_threshold',
      chain_state: 'pending',
      bulk_eligible: false,
    },
    {
      id: 'perm-card-4',
      source_module: 'recipe',
      entity_type: 'Recipe default change',
      entity_ref: 'rec-mutton-galouti',
      entity_route: '/SI-REC-003',
      requesting_user: 'Nadia Khan',
      requesting_user_role: 'Kitchen Manager',
      requested_at: new Date(Date.now() - 14 * 3600000).toISOString(),
      value: 0,
      value_band: 'No monetary footprint · default version v3.1 → v3.2',
      chain_step: 'Step 1 of 2 · Cluster Manager',
      route_reason: 'chain_step',
      chain_state: 'awaiting_prior_step',
      bulk_eligible: true,
    },
  ]
  const noop = () => {
    /* visual permutation only */
  }
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs text-on-surface-variant mb-2">
          Desktop row layout — bulk-eligible (with checkbox), paired bundle,
          high-value (no checkbox), recipe default
        </p>
        <div className="flex flex-col gap-2">
          {fixtures.map((c) => (
            <ApprovalInboxCard
              key={`row-${c.id}`}
              card={c}
              selected={selected.has(c.id)}
              onToggleSelect={onToggleSelect}
              layout="row"
              onApprove={noop}
              onReject={noop}
              onDelegate={noop}
              delegateTargets={targets}
            />
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-on-surface-variant mb-2">
          Mobile compact-card layout — same fixtures
        </p>
        <div className="flex flex-col gap-3 max-w-md">
          {fixtures.map((c) => (
            <ApprovalInboxCard
              key={`card-${c.id}`}
              card={c}
              selected={selected.has(c.id)}
              onToggleSelect={onToggleSelect}
              layout="card"
              onApprove={noop}
              onReject={noop}
              onDelegate={noop}
              delegateTargets={targets}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Permutations for PairedTransferBundle (CC-PAIRED-TRANSFER-BUNDLE / P2B-002).
function PairedTransferBundlePermutations() {
  const baseLegs: readonly [PairedTransferLeg, PairedTransferLeg] = [
    {
      label: 'Leg 1 · Return to Brand Store',
      source_label: 'Andheri-East · Phoenix Marketcity outlet',
      destination_label: 'Wild Sugar · Brand Store',
      expiry_context:
        'Andheri-East cluster has 80 kg tomatoes expiring in 48 h',
      line_items: [
        {
          material_id: 'mat-tomato',
          material_name: 'Tomato',
          qty: 80,
          uom: 'kg',
          batch_ref: 'BAT-2026-04-29-T03',
          expires_on: '2026-05-08',
          expiry_pressure: 'expiring in 48 h',
        },
        {
          material_id: 'mat-paneer',
          material_name: 'Fresh Paneer',
          qty: 12,
          uom: 'kg',
          batch_ref: 'BAT-2026-05-01-P11',
          expires_on: '2026-05-07',
          expiry_pressure: 'expiring in 36 h',
        },
      ],
    },
    {
      label: 'Leg 2 · Draw from Brand Store',
      source_label: 'Wild Sugar · Brand Store',
      destination_label: 'Bandra-West · Linking Road outlet',
      line_items: [
        {
          material_id: 'mat-tomato',
          material_name: 'Tomato',
          qty: 80,
          uom: 'kg',
          batch_ref: 'BAT-2026-04-29-T03',
          expires_on: '2026-05-08',
          expiry_pressure: 'expiring in 48 h',
        },
        {
          material_id: 'mat-paneer',
          material_name: 'Fresh Paneer',
          qty: 12,
          uom: 'kg',
          batch_ref: 'BAT-2026-05-01-P11',
          expires_on: '2026-05-07',
          expiry_pressure: 'expiring in 36 h',
        },
      ],
    },
  ]
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs text-on-surface-variant mb-2">
          Full variant — form mode, draft state (used by SI-INV-007).
        </p>
        <PairedTransferBundle
          bundleRef="XFR-2026-BUNDLE-00042"
          originatingCluster="Andheri-East"
          destinationCluster="Bandra-West"
          legs={baseLegs}
          consumptionContext="Bandra-West Linking Road can absorb the bundle within 36–48 hours based on average daily prep."
          bundleStatus="draft"
        />
      </div>
      <div>
        <p className="text-xs text-on-surface-variant mb-2">
          Compact variant — inbox card mode, pending approval. Suitable as a
          slot inside ApprovalInboxCard or as a standalone bundle row.
        </p>
        <div className="max-w-md">
          <PairedTransferBundle
            bundleRef="XFR-2026-BUNDLE-00042"
            originatingCluster="Andheri-East"
            destinationCluster="Bandra-West"
            legs={baseLegs}
            bundleStatus="pending_approval"
            compact
          />
        </div>
      </div>
      <div>
        <p className="text-xs text-on-surface-variant mb-2">
          Compact variant — inbox card mode, approved. Demonstrates the
          atomic-approval terminal state.
        </p>
        <div className="max-w-md">
          <PairedTransferBundle
            bundleRef="XFR-2026-BUNDLE-00041"
            originatingCluster="Powai"
            destinationCluster="Bandra-West"
            legs={[
              {
                label: 'Leg 1 · Return to Brand Store',
                source_label: 'Powai · Hiranandani outlet',
                destination_label: 'Wild Sugar · Brand Store',
                line_items: [
                  {
                    material_id: 'mat-curry-leaves',
                    material_name: 'Fresh Curry Leaves',
                    qty: 6,
                    uom: 'kg',
                    batch_ref: 'BAT-2026-05-02-CL07',
                    expires_on: '2026-05-08',
                  },
                ],
              },
              {
                label: 'Leg 2 · Draw from Brand Store',
                source_label: 'Wild Sugar · Brand Store',
                destination_label: 'Bandra-West · Pali Hill outlet',
                line_items: [
                  {
                    material_id: 'mat-curry-leaves',
                    material_name: 'Fresh Curry Leaves',
                    qty: 6,
                    uom: 'kg',
                    batch_ref: 'BAT-2026-05-02-CL07',
                    expires_on: '2026-05-08',
                  },
                ],
              },
            ]}
            bundleStatus="approved"
            compact
          />
        </div>
      </div>
    </div>
  )
}

// Permutations for GSTFieldValidation — empty / valid intra / valid inter /
// invalid (intra with IGST) / invalid (inter with CGST+SGST) / invalid (no PoS).
function GSTFieldValidationPermutations() {
  const variants: ReadonlyArray<{
    label: string
    placeOfSupplyStateCode: string | null
    cgstAmount: number | null
    sgstAmount: number | null
    igstAmount: number | null
    placeOfSupplyStateLabel?: string
  }> = [
    {
      label: 'Empty — fields not filled',
      placeOfSupplyStateCode: null,
      cgstAmount: null,
      sgstAmount: null,
      igstAmount: null,
    },
    {
      label: 'Valid · intra-state · CGST + SGST',
      placeOfSupplyStateCode: '27',
      placeOfSupplyStateLabel: 'Maharashtra',
      cgstAmount: 38565,
      sgstAmount: 38565,
      igstAmount: null,
    },
    {
      label: 'Valid · inter-state · IGST',
      placeOfSupplyStateCode: '29',
      placeOfSupplyStateLabel: 'Karnataka',
      cgstAmount: null,
      sgstAmount: null,
      igstAmount: 77130,
    },
    {
      label: 'Invalid · intra-state with IGST',
      placeOfSupplyStateCode: '27',
      placeOfSupplyStateLabel: 'Maharashtra',
      cgstAmount: null,
      sgstAmount: null,
      igstAmount: 77130,
    },
    {
      label: 'Invalid · inter-state with CGST + SGST',
      placeOfSupplyStateCode: '29',
      placeOfSupplyStateLabel: 'Karnataka',
      cgstAmount: 38565,
      sgstAmount: 38565,
      igstAmount: null,
    },
    {
      label: 'Invalid · no place of supply selected',
      placeOfSupplyStateCode: null,
      cgstAmount: 38565,
      sgstAmount: 38565,
      igstAmount: null,
    },
  ]
  return (
    <div className="flex flex-col gap-3">
      {variants.map((v, i) => (
        <div
          key={`${v.label}-${i}`}
          className="rounded-md bg-surface-container-low p-2"
        >
          <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            {v.label}
          </p>
          <GSTFieldValidation
            placeOfSupplyStateCode={v.placeOfSupplyStateCode}
            dispatchingStateCode="27"
            cgstAmount={v.cgstAmount}
            sgstAmount={v.sgstAmount}
            igstAmount={v.igstAmount}
            dispatchingStateLabel="Maharashtra"
            placeOfSupplyStateLabel={v.placeOfSupplyStateLabel}
          />
        </div>
      ))}
    </div>
  )
}

// Permutations for UnregisteredCustomerWarn — silent (regular) / unregistered
// (empty reason) / unregistered (filled reason) / consumer.
function UnregisteredCustomerWarnPermutations() {
  const [reason1, setReason1] = useState<string | null>(null)
  const [reason2, setReason2] = useState<string | null>(
    'customer_request_internal',
  )
  const [reason3, setReason3] = useState<string | null>(null)
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md bg-surface-container-low p-2">
        <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Regular customer · panel silent (renders nothing)
        </p>
        <div className="rounded-md bg-surface-container-lowest px-4 py-3 text-sm text-on-surface-variant">
          <UnregisteredCustomerWarn
            gstType="regular"
            reasonCode={null}
            onReasonCodeChange={() => {}}
            selectId="perm-warn-regular"
          />
          <span>(no warning rendered for `regular` per FR119)</span>
        </div>
      </div>
      <div className="rounded-md bg-surface-container-low p-2">
        <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Unregistered · reason code empty (parent gates save)
        </p>
        <UnregisteredCustomerWarn
          gstType="unregistered"
          reasonCode={reason1}
          onReasonCodeChange={setReason1}
          selectId="perm-warn-unreg-empty"
        />
      </div>
      <div className="rounded-md bg-surface-container-low p-2">
        <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Unregistered · reason code filled (save no longer gated)
        </p>
        <UnregisteredCustomerWarn
          gstType="unregistered"
          reasonCode={reason2}
          onReasonCodeChange={setReason2}
          selectId="perm-warn-unreg-filled"
        />
      </div>
      <div className="rounded-md bg-surface-container-low p-2">
        <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Consumer (B2C) · same warning, same gating
        </p>
        <UnregisteredCustomerWarn
          gstType="consumer"
          reasonCode={reason3}
          onReasonCodeChange={setReason3}
          selectId="perm-warn-consumer"
        />
      </div>
    </div>
  )
}

export default function ComponentsIndex() {
  const [viewport, setViewport] = useState<Viewport>(1280)

  return (
    <div className="p-8">
      {/* Three-viewport toggle */}
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-on-surface">
          Component permutations
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Phase 2c-S2 scaffold — every shell primitive rendered against the
          Wild Sugar token surface for visual sign-off.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs text-on-surface-variant mr-2">
            Viewport:
          </span>
          {VIEWPORTS.map((v) => (
            <Button
              key={v.value}
              variant={viewport === v.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewport(v.value)}
              aria-pressed={viewport === v.value}
            >
              {v.label}
            </Button>
          ))}
        </div>
      </header>

      <div
        className="flex flex-col gap-10"
        style={{ maxWidth: `${viewport}px` }}
      >
        {/* Status pills — all 20 tokens */}
        <GridSection
          title="Status pills"
          description={`All ${STATUS_KEYS.length} canonical status tokens (DESIGN.md §6.1).`}
        >
          <div className="flex flex-wrap gap-2">
            {STATUS_KEYS.map((k) => (
              <StatusPill key={k} statusKey={k} />
            ))}
          </div>
        </GridSection>

        {/* StatusPill shell — sm + md sizes, label on / off */}
        <GridSection
          title="StatusPill shell — size & label permutations"
          description="The shipped <StatusPill /> wrapper (mockups/src/shell/StatusPill.tsx)."
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-on-surface-variant w-32 shrink-0">
                size=md, label
              </span>
              {STATUS_KEYS.slice(0, 6).map((k) => (
                <StatusPillShell key={k} status={k} />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-on-surface-variant w-32 shrink-0">
                size=sm, label
              </span>
              {STATUS_KEYS.slice(0, 6).map((k) => (
                <StatusPillShell key={k} status={k} size="sm" />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-on-surface-variant w-32 shrink-0">
                size=md, no label
              </span>
              {STATUS_KEYS.slice(0, 6).map((k) => (
                <StatusPillShell key={k} status={k} showLabel={false} />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-on-surface-variant w-32 shrink-0">
                pip pattern
              </span>
              <StatusPillShell status="status_provisional" />
              <StatusPillShell status="status_overridden" />
              <StatusPillShell status="status_variance_flagged" />
            </div>
          </div>
        </GridSection>

        {/* DashboardTile permutations */}
        <GridSection
          title="DashboardTile (CC-DASHBOARD-TILE)"
          description="Severity wash, sparkline, drill-down, trend arrow."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <DashboardTile
              label="Plain neutral"
              value="42"
              secondary={<>No severity, no sparkline.</>}
            />
            <DashboardTile
              label="With sparkline + trend"
              value="33.4 %"
              secondary={<>Target 32.0 % · 7-day rolling</>}
              trend="up"
              severity="warning"
              sparkline={[33.0, 33.6, 33.2, 33.7, 33.1, 33.4, 33.4]}
              emphasis="above_average"
            />
            <DashboardTile
              label="Drill-down + success"
              value="₹ 4,28,500"
              secondary={<>Daily sales · 412 covers</>}
              trend="up"
              severity="success"
              sparkline={[3.2, 3.0, 3.5, 3.8, 3.4, 3.7, 3.9]}
              to="/SI-RPT-005"
            />
            <DashboardTile
              label="Severity error"
              value="7"
              secondary={<>Rejected GRs awaiting reclassification</>}
              severity="error"
              to="/SI-PRO-009"
            />
            <DashboardTile
              label="Trend down + flat"
              value="12"
              secondary={<>Sample variance count</>}
              trend="down"
              severity="success"
            />
            <DashboardTile
              label="No drill"
              value="100 %"
              secondary={<>Inventory enablement coverage</>}
              trend="flat"
            />
          </div>
        </GridSection>

        {/* OverrideWidget */}
        <GridSection
          title="OverrideWidget (CC-OVERRIDE-WIDGET / P2B-005)"
          description="Hero rate per 100 POs · 30-day sparkline (error when above rolling avg) · per-type filter chips."
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <OverrideWidget
              rate={4.7}
              series={[5, 6, 5, 7, 6, 7, 8, 7, 6, 7, 8, 9, 7, 8, 7, 6, 7, 8, 9, 10, 8, 9, 8, 9, 10, 11, 12, 11, 10, 12]}
              rollingAvg={9.5}
              breakdown={[
                { type: 'pending_gr', count: 18 },
                { type: 'substitution', count: 11 },
                { type: 'enablement', count: 6 },
              ]}
            />
            <OverrideWidget
              rate={2.1}
              series={[8, 7, 6, 7, 8, 6, 5, 7, 6, 5, 6, 7, 5, 6, 5, 4, 5, 6, 5, 4, 5, 4, 5, 4, 5, 4, 3, 4, 3, 4]}
              rollingAvg={4.6}
              breakdown={[
                { type: 'pending_gr', count: 6 },
                { type: 'substitution', count: 3 },
                { type: 'enablement', count: 1 },
              ]}
            />
          </div>
        </GridSection>

        {/* PendingGRDrill */}
        <GridSection
          title="PendingGRDrill (CC-PENDING-GR-DRILL)"
          description="Recent rejections + reclassification journals; row drill into SI-PRO-009."
        >
          <PendingGRDrill
            entries={[
              {
                id: 'demo-1',
                gr_trn: 'TRN-GR-2026-00187',
                po_trn: 'TRN-PO-2026-00248',
                vendor_name: 'Bharat Spice Traders',
                rejected_at: '2026-05-04',
                reason: 'shelf_life',
                journal_trn: 'TRN-RJ-2026-00187',
              },
              {
                id: 'demo-2',
                gr_trn: 'TRN-GR-2026-00184',
                po_trn: 'TRN-PO-2026-00241',
                vendor_name: 'Mumbai Dairy Cooperative',
                rejected_at: '2026-05-03',
                reason: 'quality',
                journal_trn: 'TRN-RJ-2026-00184',
              },
              {
                id: 'demo-3',
                gr_trn: 'TRN-GR-2026-00179',
                po_trn: 'TRN-PO-2026-00233',
                vendor_name: 'Coastal Seafoods',
                rejected_at: '2026-05-02',
                reason: 'quantity_mismatch',
                journal_trn: 'TRN-RJ-2026-00179',
              },
            ]}
          />
        </GridSection>

        {/* DataQualityAlert */}
        <GridSection
          title="DataQualityAlert (CC-DATA-QUALITY-ALERT)"
          description="FR116 cross-module inconsistencies, severity-coded margin accent."
        >
          <DataQualityAlertPane
            alerts={[
              {
                id: 'demo-1',
                kind: 'deactivated_material_in_recipe',
                severity: 'critical',
                message: 'Kashmir Saffron deactivated, still in 3 published recipes.',
                context: 'Affects: rec-mutton-galouti v3.2, rec-paneer-tikka v2.1.',
                link: '/SI-MDM-003',
              },
              {
                id: 'demo-2',
                kind: 'deactivated_vendor_open_po',
                severity: 'warning',
                message: 'Bharat Spice Traders deactivated with 2 open POs.',
                context: 'POs await GR; reassign or close before window closes.',
                link: '/SI-MDM-005',
              },
              {
                id: 'demo-3',
                kind: 'expired_template_active',
                severity: 'info',
                message: '2 recipe templates expired but still flagged as default.',
                link: '/SI-REC-003',
              },
            ]}
          />
        </GridSection>

        {/* ExportTrigger */}
        <GridSection
          title="ExportTrigger (CC-EXPORT-TRIGGER)"
          description="FR107 PDF / CSV / Excel dropdown affordance."
        >
          <div className="flex flex-wrap items-center gap-3">
            <ExportTrigger entityLabel="dashboard snapshot" />
            <ExportTrigger
              entityLabel="trial balance"
              formats={['pdf', 'excel']}
            />
            <ExportTrigger entityLabel="vendor list" formats={['csv']} />
          </div>
        </GridSection>

        {/* AuditLink */}
        <GridSection
          title="AuditLink (CC-AUDIT-LINK)"
          description="Inline chip dropped on every entity-detail screen across Epics 1–12; drills to SI-INF-005 pre-filtered to the entity."
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-on-surface-variant w-24 shrink-0">
                default
              </span>
              <AuditLink entityRef="PO-2026-AND-WST-0231" />
              <AuditLink entityRef="GR-2026-00187" />
              <AuditLink entityRef="rec-mutton-galouti" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-on-surface-variant w-24 shrink-0">
                custom label
              </span>
              <AuditLink entityRef="JV-2026-04-1142" label="Trail" />
              <AuditLink entityRef="VCN-2026-WST-0231" label="Activity" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-on-surface-variant w-24 shrink-0">
                compact
              </span>
              <AuditLink entityRef="PO-2026-AND-WST-0231" compact />
              <AuditLink entityRef="GR-2026-00187" compact />
            </div>
          </div>
        </GridSection>

        {/* ApprovalInboxCard — single card / paired bundle / age >72h / no checkbox */}
        <GridSection
          title="ApprovalInboxCard (CC-APPROVAL-INBOX-CARD)"
          description="Anchor card for the Unified Approval Inbox (SI-INF-001). Single, paired-transfer bundle, >72h age, and no-checkbox high-value variants."
        >
          <ApprovalInboxPermutations />
        </GridSection>

        {/* PairedTransferBundle — full + compact variants (P2B-002) */}
        <GridSection
          title="PairedTransferBundle (CC-PAIRED-TRANSFER-BUNDLE / P2B-002)"
          description="Two-leg bundled-approval visualisation. Master Spec §2.2 raw-material routing constraint is deliberately visible (P2B-004). Full mode anchors SI-INV-007; compact mode is suitable for SI-INF-001 inbox cards."
        >
          <PairedTransferBundlePermutations />
        </GridSection>

        {/* GSTFieldValidation — empty / valid (intra/inter) / invalid (3 violations) */}
        <GridSection
          title="GSTFieldValidation (CC-GST-FIELD-VALIDATION / FR118)"
          description="Live intra-state vs inter-state CGST+SGST / IGST consistency. Empty / valid (intra) / valid (inter) / invalid (intra w/ IGST) / invalid (inter w/ CGST+SGST) / invalid (no place of supply). Anchors SI-DSP-010."
        >
          <GSTFieldValidationPermutations />
        </GridSection>

        {/* UnregisteredCustomerWarn — silent / unregistered (empty + filled) / consumer */}
        <GridSection
          title="UnregisteredCustomerWarn (CC-UNREGISTERED-CUSTOMER-WARN / FR119)"
          description="Warning + mandatory reason-code dropdown when customer is unregistered or consumer. Silent for regular / composition. Anchors SI-DSP-010."
        >
          <UnregisteredCustomerWarnPermutations />
        </GridSection>

        {/* Cards — 4 cells (with/without header, with/without footer) */}
        <GridSection
          title="Cards"
          description="§5.4 soft-lift surface; no border, no shadow."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-0">
                <p className="text-sm">Plain card — content only.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="p-0 mb-3">
                <CardTitle>Card with header</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <p className="text-sm">Header above content.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-0">
                <p className="text-sm">Content with footer.</p>
              </CardContent>
              <CardFooter className="p-0 mt-3">
                <Button variant="ghost" size="sm">
                  Footer action
                </Button>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader className="p-0 mb-3">
                <CardTitle>Full card</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <p className="text-sm">Header + content + footer.</p>
              </CardContent>
              <CardFooter className="p-0 mt-3">
                <Button size="sm">Confirm</Button>
              </CardFooter>
            </Card>
          </div>
        </GridSection>

        {/* Buttons — variants × sizes */}
        <GridSection
          title="Buttons"
          description="§5.2 no-line: outline silently rewrites to ghost."
        >
          <div className="flex flex-col gap-3">
            {(
              [
                'default',
                'secondary',
                'ghost',
                'destructive',
                'link',
                'tonal',
                'outline',
              ] as const
            ).map((variant) => (
              <div key={variant} className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-on-surface-variant w-24 shrink-0">
                  {variant}
                </span>
                <Button variant={variant} size="sm">
                  Small
                </Button>
                <Button variant={variant} size="default">
                  Default
                </Button>
                <Button variant={variant} size="lg">
                  Large
                </Button>
                <Button variant={variant} size="icon" aria-label={`${variant} icon`}>
                  <Check />
                </Button>
              </div>
            ))}
          </div>
        </GridSection>

        {/* Inputs — 5 cells */}
        <GridSection
          title="Inputs"
          description="§9.3 focus ring + aria-invalid ring; no resting border (§5.2)."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-on-surface-variant" htmlFor="in-default">
                Default
              </label>
              <Input id="in-default" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-on-surface-variant" htmlFor="in-placeholder">
                With placeholder
              </label>
              <Input id="in-placeholder" placeholder="Search vendors…" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-on-surface-variant" htmlFor="in-value">
                With value
              </label>
              <Input id="in-value" defaultValue="Bharat Spice Traders" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-on-surface-variant" htmlFor="in-disabled">
                Disabled
              </label>
              <Input id="in-disabled" disabled defaultValue="Read-only" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-on-surface-variant" htmlFor="in-invalid">
                aria-invalid
              </label>
              <Input
                id="in-invalid"
                aria-invalid
                defaultValue="bad@value"
              />
            </div>
          </div>
        </GridSection>

        {/* Popovers — solid + glass side-by-side */}
        <GridSection
          title="Popovers"
          description="solid (default) vs glass (§5.3.1, opt-in)."
        >
          <div className="flex flex-wrap gap-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="tonal">Open solid popover</Button>
              </PopoverTrigger>
              <PopoverContent variant="solid" className="w-64">
                <p className="text-sm">
                  Solid popover surface — `surface_container_lowest`.
                </p>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="tonal">Open glass popover</Button>
              </PopoverTrigger>
              <PopoverContent variant="glass" className="w-64">
                <p className="text-sm">
                  Glass popover — backdrop-blur reserved for hero moments.
                </p>
              </PopoverContent>
            </Popover>
          </div>
        </GridSection>

        {/* SectionShift demo — 3 tones, both orientations */}
        <GridSection
          title="SectionShift"
          description="§5.2 no-line replacement for Separator. 4-px tonal strip."
        >
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-xs text-on-surface-variant mb-2">
                Horizontal — lowest / low / high
              </p>
              <div className="flex flex-col gap-2 bg-surface-container-low p-4 rounded-md">
                <p className="text-sm">Above the shift</p>
                <SectionShift tone="lowest" />
                <p className="text-sm">tone="lowest"</p>
                <SectionShift tone="low" />
                <p className="text-sm">tone="low"</p>
                <SectionShift tone="high" />
                <p className="text-sm">tone="high"</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant mb-2">
                Vertical — lowest / low / high
              </p>
              <div className="flex items-stretch gap-2 bg-surface-container-low p-4 rounded-md h-24">
                <span className="text-sm self-center">Left</span>
                <SectionShift orientation="vertical" tone="lowest" />
                <span className="text-sm self-center">lowest</span>
                <SectionShift orientation="vertical" tone="low" />
                <span className="text-sm self-center">low</span>
                <SectionShift orientation="vertical" tone="high" />
                <span className="text-sm self-center">high</span>
              </div>
            </div>
          </div>
        </GridSection>

        {/* ProvisionalFlag — CC-PROVISIONAL-FLAG / FR67a */}
        <GridSection
          title="ProvisionalFlag (CC-PROVISIONAL-FLAG)"
          description="FR67a — flag for stock / cost values derived from a Pending-GR PO. Reused by SI-INV-001/002, SI-PRO-003, SI-RPT-002, SI-ACC-010."
        >
          <div className="rounded-md bg-surface-container-low p-4">
            <ul className="flex flex-col gap-3">
              <li className="flex items-center gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant w-32 shrink-0">
                  Inline · sm
                </span>
                <ProvisionalFlag />
              </li>
              <li className="flex items-center gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant w-32 shrink-0">
                  Inline · md
                </span>
                <ProvisionalFlag size="md" />
              </li>
              <li className="flex items-center gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant w-32 shrink-0">
                  Badge · sm
                </span>
                <ProvisionalFlag placement="badge" />
              </li>
              <li className="flex items-center gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant w-32 shrink-0">
                  Badge · md
                </span>
                <ProvisionalFlag placement="badge" size="md" />
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant w-32 shrink-0 mt-1">
                  In context
                </span>
                <div className="flex items-center flex-wrap gap-1.5">
                  <span className="text-base font-semibold text-on-surface">
                    Fresh Paneer
                  </span>
                  <ProvisionalFlag />
                </div>
              </li>
            </ul>
          </div>
        </GridSection>

        {/* Table demo — 5-row alternating-row table */}
        <GridSection
          title="TrnDisplay"
          description="CC-TRN-DISPLAY (FR87) — visible TRN + copy-to-clipboard. Promoted from SI-ACC-003 inline definition during SI-ACC-013 build."
        >
          <div className="rounded-md bg-surface-container-low p-4">
            <ul className="flex flex-col gap-3">
              <li className="flex items-center gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant w-32 shrink-0">
                  Default
                </span>
                <TrnDisplay trn="TRN-PO-2026-00012" />
              </li>
              <li className="flex items-center gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant w-32 shrink-0">
                  GR variant
                </span>
                <TrnDisplay trn="TRN-GR-2026-00204" />
              </li>
              <li className="flex items-center gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant w-32 shrink-0">
                  B2B challan
                </span>
                <TrnDisplay trn="BTC-2026-MUM-118" />
              </li>
              <li className="flex items-center gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant w-32 shrink-0">
                  Manual JV
                </span>
                <TrnDisplay trn="JV-2026-MUM-014" />
              </li>
              <li className="flex items-center gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant w-32 shrink-0">
                  Read-only
                </span>
                <TrnDisplay trn="TRN-JV-2026-04-029" copyable={false} />
              </li>
            </ul>
          </div>
        </GridSection>

        {/* LifecycleStepper — PO + stock-transfer + B2B-challan permutations */}
        <GridSection
          title="LifecycleStepper"
          description="DL-001 + FR42 + PRD line 650 + FR47a — canonical 5-status PO lifecycle. Prop-driven so stock-transfer and B2B-challan reuse the chrome."
        >
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant mb-2">
                PO · Draft
              </p>
              <LifecycleStepper status="draft" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant mb-2">
                PO · Approved
              </p>
              <LifecycleStepper status="approved" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant mb-2">
                PO · Partially Received (60 % fulfillment)
              </p>
              <LifecycleStepper
                status="partially_received"
                lineItemFulfillmentRatio={0.6}
              />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant mb-2">
                PO · Closed — GR Rejected (terminal branch)
              </p>
              <LifecycleStepper status="closed_gr_rejected" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant mb-2">
                Stock transfer · In Transit
              </p>
              <LifecycleStepper
                status="in_transit"
                steps={STOCK_TRANSFER_LIFECYCLE_STEPS}
              />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant mb-2">
                B2B challan · Delivered
              </p>
              <LifecycleStepper
                status="delivered"
                steps={B2B_CHALLAN_LIFECYCLE_STEPS}
              />
            </div>
          </div>
        </GridSection>

        {/* DraftPill — draft / saved / mobile eyebrow */}
        <GridSection
          title="DraftPill (CC-DRAFT-PILL)"
          description="P2B-001 + FR68 + FR117 — visible Draft vs Saved indication on every form per DESIGN.md §6.2 (status durability)."
        >
          <div className="rounded-md bg-surface-container-low p-4">
            <ul className="flex flex-col gap-3">
              <li className="flex items-center gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant w-44 shrink-0">
                  Draft (unsaved)
                </span>
                <DraftPill isDraft />
              </li>
              <li className="flex items-center gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant w-44 shrink-0">
                  Draft + mobile eyebrow
                </span>
                <DraftPill isDraft mobileEyebrow />
              </li>
              <li className="flex items-center gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant w-44 shrink-0">
                  Saved (durable)
                </span>
                <DraftPill isDraft={false} />
              </li>
              <li className="flex items-center gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant w-44 shrink-0">
                  Saved · no eyebrow
                </span>
                <DraftPill isDraft={false} mobileEyebrow={false} />
              </li>
            </ul>
          </div>
        </GridSection>

        {/* FCCCDualSurface — financial / operational / cross-link selected */}
        <GridSection
          title="FCCCDualSurface (CC-FCCC-DUAL-SURFACE)"
          description="FR95 + FR108 shared chrome for SI-ACC-010 (financial) and SI-RPT-006 (operational). Tab pair preserves period / scope / compare / item via URL search params."
        >
          <FCCCDualSurfacePermutations />
        </GridSection>

        {/* IssueTicketLink — no tickets / N tickets / open popover */}
        <GridSection
          title="IssueTicketLink (CC-ISSUE-TICKET-LINK)"
          description="FR22 — per-screen affordance to raise a ticket against the current entity, OR jump to existing tickets."
        >
          <div className="rounded-md bg-surface-container-low p-4">
            <ul className="flex flex-col gap-3">
              <li className="flex items-center gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant w-32 shrink-0">
                  No existing
                </span>
                <IssueTicketLink entityRef="TRN-PO-2026-00012" />
              </li>
              <li className="flex items-center gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant w-32 shrink-0">
                  2 existing
                </span>
                <IssueTicketLink
                  entityRef="TRN-PO-2026-00248"
                  existingTicketCount={2}
                  existingTickets={[
                    {
                      id: 'ITK-2026-0248-A',
                      subject: 'Vendor confirmed late dispatch by 2 days',
                      severity: 'medium',
                    },
                    {
                      id: 'ITK-2026-0248-B',
                      subject: 'Quantity short on first GR — reconcile',
                      severity: 'high',
                    },
                  ]}
                />
              </li>
              <li className="flex items-center gap-3">
                <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant w-32 shrink-0">
                  Single existing
                </span>
                <IssueTicketLink
                  entityRef="TRN-GR-2026-00187"
                  existingTicketCount={1}
                  existingTickets={[
                    {
                      id: 'ITK-2026-GR187-A',
                      subject: 'Vendor scorecard penalty applied',
                      severity: 'low',
                    },
                  ]}
                />
              </li>
            </ul>
          </div>
        </GridSection>

        <GridSection
          title="Table"
          description="§9.2 striping (no row dividers); §7.3 tabular-nums."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>State</TableHead>
                <TableHead>GSTIN</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Terms (days)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.slice(0, 5).map((v) => (
                <TableRow key={v.id}>
                  <TableCell>{v.name}</TableCell>
                  <TableCell>{v.state}</TableCell>
                  <TableCell className="font-mono text-xs">{v.gstin}</TableCell>
                  <TableCell className="text-right">{v.performance_score}</TableCell>
                  <TableCell className="text-right">
                    {v.payment_terms_days}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </GridSection>
      </div>

      <footer className="mt-12 pt-6">
        <SectionShift tone="high" className="mb-6" aria-hidden />
        <Link to="/" className="text-sm text-primary hover:underline">
          ← Back to screen index
        </Link>
      </footer>
    </div>
  )
}

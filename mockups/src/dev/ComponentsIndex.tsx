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
} from '@/shell'
import { tokens, isStatusPipToken, type StatusKey } from '@/tokens'
import { vendors } from '@/lib/sample-data'

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

        {/* Table demo — 5-row alternating-row table */}
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

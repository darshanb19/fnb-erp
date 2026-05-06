import { Link, useParams } from 'react-router-dom'
import { Card } from '@/shell/Card'
import { screenById } from '@/lib/screen-catalog'

/**
 * ScreenStub — generic "not yet built" placeholder.
 *
 * Rendered for `/:screenId` routes during Phase 2c-S2 scaffold; individual
 * hero screens replace this stub as they're authored in Sessions 3 & 4.
 * The card uses the §5.4 soft-lift pattern via the `Card` shell wrapper —
 * no border, no shadow, just a tonal surface step.
 */
export default function ScreenStub() {
  const { screenId } = useParams<{ screenId: string }>()
  const id = screenId ?? '(unknown)'
  const entry = screenById[id]
  const name = entry?.name ?? 'Unknown screen'

  return (
    <div className="p-8 max-w-3xl">
      <Card>
        <h1 className="text-lg font-semibold text-on-surface">
          {id} — not yet built
        </h1>
        <p className="text-sm text-on-surface-variant mt-2">
          {name}
        </p>
        <p className="text-sm text-on-surface-variant mt-4">
          This screen is scheduled for a later Phase 2c session or Phase 4
          epic. The placeholder confirms the route + sidebar wiring resolves.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="text-sm text-primary hover:underline"
          >
            ← Back to screen index
          </Link>
        </div>
      </Card>
    </div>
  )
}

import { Link } from 'react-router-dom'
import { SectionShift } from '@/shell/SectionShift'
import {
  EPIC_ORDER,
  EPIC_LABELS,
  screensByEpic,
  type ScreenEntry,
} from '@/lib/screen-catalog'

/**
 * ScreenIndex — clickable mockup directory at `/`.
 *
 * Rendered as the AppShell's default content. Each epic is its own group;
 * groups are separated by a tonal `<SectionShift tone="high">` strip per the
 * §5.2 no-line rule + §10.7 plan ordering. Tier 1 hero screens carry a small
 * "Tier 1" pill so reviewers can spot the heroes at a glance.
 *
 * Footer links to `/_dev/components` for the component permutation viewer.
 */
function Tier1Badge() {
  return (
    <span className="ml-2 inline-flex items-center rounded-pill bg-primary-container text-on-primary-container px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">
      Tier 1
    </span>
  )
}

function ScreenRow({ s }: { s: ScreenEntry }) {
  return (
    <li>
      <Link
        to={`/${s.id}`}
        className="flex items-baseline gap-3 px-3 py-2 rounded-sm hover:bg-surface-container-high transition-colors"
      >
        <span className="text-xs font-mono text-on-surface-variant shrink-0 w-24">
          {s.id}
        </span>
        <span className="text-sm text-on-surface flex-1">{s.name}</span>
        {s.tier1 ? <Tier1Badge /> : null}
      </Link>
    </li>
  )
}

export default function ScreenIndex() {
  return (
    <div className="p-8 max-w-4xl">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-on-surface">
          F&amp;B ERP — Mockup index
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          112 screens grouped by epic. Tier 1 heroes carry the "stricter
          critique" acceptance per Phase 2c plan §6.
        </p>
      </header>

      {EPIC_ORDER.map((epic, i) => {
        const screens = screensByEpic[epic]
        if (screens.length === 0) return null
        return (
          <section key={epic} aria-labelledby={`epic-${epic}-heading`}>
            {i > 0 ? (
              <SectionShift tone="high" className="my-6" aria-hidden />
            ) : null}
            <h2
              id={`epic-${epic}-heading`}
              className="text-sm font-semibold uppercase tracking-wide text-on-surface-variant mb-2"
            >
              {EPIC_LABELS[epic]}{' '}
              <span className="text-on-surface-variant font-normal normal-case tracking-normal">
                ({screens.length})
              </span>
            </h2>
            <ul className="flex flex-col">
              {screens.map((s) => (
                <ScreenRow key={s.id} s={s} />
              ))}
            </ul>
          </section>
        )
      })}

      <footer className="mt-10 pt-6">
        <SectionShift tone="high" className="mb-6" aria-hidden />
        <Link
          to="/_dev/components"
          className="text-sm text-primary hover:underline"
        >
          Developer view → /_dev/components
        </Link>
      </footer>
    </div>
  )
}

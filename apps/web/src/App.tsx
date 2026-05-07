import { Routes, Route, Link, useNavigate } from 'react-router-dom'
import ComponentsIndex from '@/dev/ComponentsIndex'
import { useSession } from '@/lib/auth'

/**
 * App — top-level router for the F&B ERP production web app.
 *
 * Task C2 (DL-029): Wires auth-gated routes + dev-login placeholder.
 *   /              → Home (auth state aware — links to MDM pages when authenticated)
 *   /dev-login     → Dev login button (DEV only; Epic 2 replaces with real login)
 *   /_dev/components → ComponentsIndex — auth-free (parity check; no API calls)
 *
 * Production pages (/mdm/hierarchy etc.) land in Tasks C3–C9.
 * Auth is provided by main.tsx AuthProvider (DL-029 dev-stub auth).
 * RequireAuth wraps any route that requires a valid session.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route
        path="/dev-login"
        element={import.meta.env.DEV ? <DevLoginPage /> : <ProdAuthPlaceholder />}
      />
      <Route path="/_dev/components" element={<ComponentsIndex />} />
      {/* Future auth-gated MDM pages mount here, wrapped in <RequireAuth>. Example:
          <Route path="/mdm/hierarchy" element={<RequireAuth><HierarchyPage /></RequireAuth>} />
      */}
    </Routes>
  )
}

// ---------------------------------------------------------------------------
// Home page — minimal, just enough to navigate
// ---------------------------------------------------------------------------

function HomePage() {
  const { session, status, signInDev, signOut } = useSession()

  return (
    <div className="min-h-screen bg-surface p-8">
      <h1 className="text-xl font-semibold text-on-surface">F&amp;B ERP — MDM</h1>

      {status === 'loading' && (
        <p className="mt-4 text-sm text-on-surface-variant">Loading session…</p>
      )}

      {status === 'unauthenticated' && (
        <div className="mt-4">
          <p className="text-sm text-on-surface-variant">You are not signed in.</p>
          {import.meta.env.DEV && (
            <button
              type="button"
              className="mt-3 rounded bg-primary px-4 py-2 text-sm font-medium text-on-primary"
              onClick={() => { void signInDev() }}
            >
              Sign in (dev)
            </button>
          )}
        </div>
      )}

      {status === 'authenticated' && session && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-on-surface-variant">
            Signed in as <span className="font-medium text-on-surface">{session.user.role}</span>
            {' '}(brand <span className="font-mono text-xs">{session.user.brandId}</span>)
          </p>

          <nav className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              MDM Screens
            </p>
            {[
              { href: '/mdm/hierarchy', label: 'Org Hierarchy (SI-MDM-001)' },
              { href: '/mdm/departments', label: 'Department Register (SI-MDM-002)' },
              { href: '/mdm/cost-centres', label: 'Cost Centres (SI-MDM-003)' },
              { href: '/mdm/uoms', label: 'Units of Measure (SI-MDM-004)' },
              { href: '/mdm/vendors', label: 'Vendor Master (SI-MDM-005)' },
              { href: '/mdm/categories', label: 'Categories (SI-MDM-006)' },
              { href: '/mdm/company', label: 'Company & Fiscal Year (SI-MDM-007)' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                to={href}
                className="block text-sm text-on-surface underline-offset-2 hover:underline"
              >
                {label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            className="mt-2 text-sm text-on-surface-variant underline-offset-2 hover:underline"
            onClick={signOut}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dev login page (DEV only)
// ---------------------------------------------------------------------------

function DevLoginPage() {
  const { signInDev, status } = useSession()
  const navigate = useNavigate()

  async function handleSignIn() {
    await signInDev()
    navigate('/')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="w-full max-w-sm space-y-6 p-8">
        <div>
          <h1 className="text-lg font-semibold text-on-surface">Dev Sign-in</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Mints a local HS256 JWT signed with{' '}
            <span className="font-mono text-xs">VITE_DEV_JWT_SECRET</span>.
            <br />
            Real login UI lands in Epic 2 USR.
          </p>
        </div>

        <button
          type="button"
          disabled={status === 'loading'}
          className="w-full rounded bg-primary px-4 py-2.5 text-sm font-medium text-on-primary disabled:opacity-50"
          onClick={() => { void handleSignIn() }}
        >
          Sign in as brand_owner
        </button>

        <p className="text-center text-xs text-on-surface-variant">
          DL-029 dev-stub auth — removed in Epic 2.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Production auth placeholder (shown in PROD when unauthenticated + not DEV)
// ---------------------------------------------------------------------------

function ProdAuthPlaceholder() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <p className="text-sm text-on-surface-variant">
        Authentication coming in Epic 2. Run in development mode for now.
      </p>
    </div>
  )
}

// Note: RequireAuth is at @/lib/RequireAuth — Tasks C3+ import directly from there.

import { useState } from 'react'
import { AlertCircle, ArrowRight, Lock, LogIn, Mail } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from '@/components/shell'
import { useSession } from '@/lib/auth'

/**
 * SI-USR-003 — Login (pre-auth gate). Tier 1 hero.
 *
 * Phase 4 Epic 2 USR Arc (c), Task C3 production frontend. Replaces the C1
 * `LoginPagePlaceholder` with the real SI-USR-003 chrome (Arc (b) mockup at
 * `mockups/src/screens/usr/SI-USR-003.tsx`), wired to `useSession().signIn`
 * (Mumbai Supabase Auth via DL-033).
 *
 * Brand-accent header (DESIGN.md §3 — `tenant_brand_accent` allowed surface):
 *
 *   Per DESIGN.md §3, the tenant brand accent (Wild Sugar warm peach,
 *   token `tenant_brand_accent`) is decorative-only and rendered on exactly
 *   four surfaces in the entire app:
 *     1. Login splash (this screen).
 *     2. Sidebar logo (AppShell).
 *     3. B2B PDF headers.
 *     4. Accountant-export PDF headers.
 *   The header band on this screen consumes #1 of those four allowed
 *   surfaces. NEVER use `tenant_brand_accent` as a status / state / focus
 *   colour, and never replicate it on /reset-password — that screen is
 *   post-login-flow and not an "allowed surface".
 *
 * Routing decision:
 *
 *   Rendered OUTSIDE the AppShell wrapper in App.tsx (no `<RequireAuth>`).
 *   Login is pre-authentication; the cockpit sidebar + persona switcher only
 *   make sense for authenticated users. Already-authenticated users hitting
 *   `/login` are redirected to `/` via `<Navigate to="/" replace />`.
 *
 * Source FRs:
 *   - FR13 — authentication (email + password; rate-limited; lock after N
 *     failures via Arc (a) `auth.rate-limit`).
 *
 * Cross-cutting:
 *   - Error envelope (§17.5) — invalid creds surface as a single, generic
 *     "Invalid email or password" banner. Never disambiguate "email not
 *     found" vs "wrong password" (security invariant). Supabase returns
 *     `AuthError { message: 'Invalid login credentials' }` for both — we
 *     map that exact string to the friendly copy.
 *
 * Brand naming:
 *
 *   The mockup pulled `BRAND.name` from `mockups/src/lib/sample-data` (which
 *   doesn't exist in apps/web). Hardcoded to "F&B" here so the header reads
 *   "F&B ERP" — matches the placeholder home page heading. Wiring this to a
 *   per-tenant brand name lands later (FR12 / company-record consumer).
 *
 * Token notes:
 *   - Header band: `bg-tenant-brand-accent` + `text-on-surface` (the dark
 *     on-surface token reads correctly against the warm peach; there is no
 *     `on-tenant-brand-accent` token in the canonical 20).
 *   - Error banner: `bg-error-container` + `text-on-error-container` per
 *     DESIGN.md §6.4 / §9.3 error chrome.
 *   - Card surface: `bg-card` (= `surface_container_lowest`).
 *
 * Animation — NONE per CLAUDE.md. Login is a transactional pre-auth screen;
 * entrance motion is banned.
 */

const SUPABASE_INVALID_CREDS_MESSAGE = 'Invalid login credentials'
const FRIENDLY_INVALID_CREDS_COPY = 'Invalid email or password'

export default function LoginPage() {
  const { signIn, status } = useSession()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Already-authenticated users hitting /login redirect to /.
  if (status === 'authenticated') {
    return <Navigate to="/" replace />
  }

  const canSubmit = email.trim().length > 0 && password.length > 0

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (!canSubmit) return
    setErrorMessage(null)
    setSubmitting(true)
    try {
      await signIn(email, password)
      navigate('/', { replace: true })
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Sign in failed — please try again.'
      // Map Supabase's stock invalid-creds message to the friendly generic copy.
      // Per FR13 + §17.5 we never disclose whether the failure was email-not-found
      // vs wrong-password.
      setErrorMessage(raw === SUPABASE_INVALID_CREDS_MESSAGE ? FRIENDLY_INVALID_CREDS_COPY : raw)
    } finally {
      setSubmitting(false)
    }
  }

  const showError = errorMessage !== null

  return (
    <div className="bg-surface min-h-screen flex flex-col">
      {/* Brand-accent header band — DESIGN.md §3 allowed surface #1. */}
      <header className="bg-tenant-brand-accent text-on-surface">
        <div className="mx-auto max-w-[1100px] px-6 py-5 tablet:px-10 tablet:py-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="inline-flex h-8 w-8 items-center justify-center rounded-sm bg-surface-container-lowest text-on-surface shrink-0"
            >
              <LogIn className="h-4 w-4" aria-hidden />
            </span>
            <div className="flex flex-col">
              <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface">
                F&amp;B ERP
              </p>
              <p className="text-sm font-semibold text-on-surface">
                Sign in to continue
              </p>
            </div>
          </div>
          <p className="hidden tablet:block text-xs text-on-surface">
            Multi-location F&amp;B operations · Mumbai
          </p>
        </div>
      </header>

      {/* Centered login card */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 tablet:py-14">
        <div className="w-full max-w-[24rem]">
          <Card className="p-0">
            <CardHeader className="p-6 pb-2">
              <CardTitle className="text-lg text-on-surface">
                Welcome back
              </CardTitle>
              <p className="mt-1 text-xs text-on-surface-variant">
                Use your work email and password. If you need access, ask
                your Brand Owner or Cluster Manager to invite you.
              </p>
            </CardHeader>

            <CardContent className="p-6 pt-4">
              <form
                onSubmit={(e) => { void handleSubmit(e) }}
                className="flex flex-col gap-4"
                noValidate
              >
                {showError ? (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-sm bg-error-container px-3 py-2 text-on-error-container"
                  >
                    <AlertCircle
                      className="h-4 w-4 mt-0.5 shrink-0"
                      aria-hidden
                    />
                    <p className="text-xs">{errorMessage}</p>
                  </div>
                ) : null}

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="login-email"
                    className="text-xs font-medium text-on-surface"
                  >
                    Email
                  </label>
                  <div className="relative">
                    <Mail
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant pointer-events-none"
                      aria-hidden
                    />
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="username"
                      placeholder="you@wildsugar.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      aria-invalid={showError}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor="login-password"
                      className="text-xs font-medium text-on-surface"
                    >
                      Password
                    </label>
                    <Link
                      to="/reset-password"
                      className="text-[11px] text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant pointer-events-none"
                      aria-hidden
                    />
                    <Input
                      id="login-password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9"
                      aria-invalid={showError}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  size="default"
                  disabled={!canSubmit || submitting}
                  className="mt-2 w-full"
                  aria-label="Sign in"
                >
                  {submitting ? 'Signing in...' : 'Sign in'}
                  {submitting ? null : (
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  )}
                </Button>

                <p className="mt-2 text-[11px] text-on-surface-variant">
                  By signing in you agree to F&amp;B ERP's acceptable-use
                  policy. Sessions are audit-logged.
                </p>
              </form>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-[11px] text-on-surface-variant">
            New Brand Owner?{' '}
            <Link
              to="/users/approvals"
              className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            >
              Request a new brand workspace
            </Link>{' '}
            (Superadmin approval required).
          </p>
        </div>
      </main>
    </div>
  )
}

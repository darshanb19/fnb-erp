import { useState } from 'react'
import { AlertCircle, ArrowRight, Lock, LogIn, Mail } from 'lucide-react'
import { Link } from 'react-router-dom'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
} from '@/shell'

import { BRAND } from '@/lib/sample-data'

/**
 * SI-USR-003 — Login (pre-auth gate).
 *
 * Tier 1 hero mockup, Phase 4 Epic 2 USR Arc (b), Task B1. Pre-authentication
 * gateway: collects email + password, posts to the auth service, and either
 * lands the user on their persona-shaped morning briefing (handled in Arc
 * (c)) or surfaces a generic invalid-credentials error.
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
 *   colour, and never replicate it on SI-USR-004 (password reset) — that
 *   screen is post-login-flow and not an "allowed surface".
 *
 * Routing decision (judgment call documented per task spec):
 *
 *   This component is rendered OUTSIDE the AppShell wrapper in App.tsx.
 *   Login is a pre-authentication surface — the cockpit sidebar + persona
 *   switcher in AppShell only make sense for authenticated users. Routing
 *   Login outside AppShell mirrors how the production frontend will gate
 *   the chrome behind a session check (Arc (c) wires `useSession()` to
 *   redirect unauthenticated users to /SI-USR-003 and authenticated users
 *   away from it). Same rationale applies to SI-USR-004 (password reset).
 *
 * Source FRs:
 *   - FR13 — authentication (email + password; rate-limited; lock after N
 *     failures via Arc (a) `auth.rate-limit`).
 *
 * Cross-cutting:
 *   - Error envelope (§17.5) — invalid creds surface as a single, generic
 *     "Invalid email or password" banner. Never disambiguate "email not
 *     found" vs "wrong password" (security invariant).
 *
 * Token notes:
 *   - Header band: `bg-tenant-brand-accent` + `text-on-surface` (the dark
 *     on-surface token reads correctly against the warm peach; there is no
 *     `on-tenant-brand-accent` token in the canonical 20).
 *   - Error banner: `bg-error-container` + `text-on-error-container` per
 *     DESIGN.md §6.4 / §9.3 error chrome.
 *   - Card surface: `bg-card` (= `surface_container_lowest`) — matches
 *     SI-MDM-007 form card.
 *
 * Animation — NONE per CLAUDE.md. Login is a transactional pre-auth screen;
 * entrance motion is banned.
 */

interface FormState {
  readonly email: string
  readonly password: string
}

const INITIAL_FORM: FormState = {
  email: '',
  password: '',
}

export default function SiUsr003() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [showError, setShowError] = useState(false)

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const canSubmit = form.email.trim().length > 0 && form.password.length > 0

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canSubmit) return
    // Mockup-only — Arc (c) wires the real authService.signIn(). Toggle the
    // error banner visually so reviewers can see the invalid-creds chrome.
    setSubmitting(true)
    setShowError(false)
    window.setTimeout(() => {
      setSubmitting(false)
      setShowError(true)
    }, 350)
  }

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
                {BRAND.name} ERP
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
                onSubmit={handleSubmit}
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
                    <p className="text-xs">
                      Invalid email or password. Try again, or use{' '}
                      <span className="font-semibold">Forgot password</span>{' '}
                      below to reset.
                    </p>
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
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
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
                      to="/SI-USR-004"
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
                      value={form.password}
                      onChange={(e) => update('password', e.target.value)}
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
                  By signing in you agree to {BRAND.name}'s acceptable-use
                  policy. Sessions are audit-logged (FR20).
                </p>
              </form>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-[11px] text-on-surface-variant">
            New Brand Owner?{' '}
            <Link
              to="/SI-USR-008"
              className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
            >
              Request a new brand workspace
            </Link>{' '}
            (FR14 — Superadmin approval required).
          </p>
        </div>
      </main>

      <footer className="px-6 py-4 text-center text-[11px] text-on-surface-variant">
        <span>SI-USR-003 · Tier 1 · Phase 4 Epic 2 Arc (b)</span>
      </footer>
    </div>
  )
}

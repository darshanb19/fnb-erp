import { useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  SectionShift,
} from '@/components/shell'
import { useApiClient } from '@/hooks/use-api-client'
import { ApiError } from '@/lib/api-client'

/**
 * SI-USR-004 — Self-service password reset (two-step). Tier 2.
 *
 * Phase 4 Epic 2 USR Arc (c), Task C3 production frontend. Mirrors the Arc (b)
 * mockup at `mockups/src/screens/usr/SI-USR-004.tsx` but splits the mockup's
 * single-component state machine into two routes per the C3 plan:
 *
 *   /reset-password           — request step (email collection).
 *   /reset-password/:token    — confirm step (new password + confirm).
 *
 * The four card chrome shapes (RequestCard, RequestSentCard, ConfirmCard,
 * ConfirmDoneCard) are preserved as internal sub-components — only the
 * outer routing model changed.
 *
 * Backend endpoints (Arc (a) `apps/api/src/routes/auth.ts`):
 *   POST /api/v1/auth/reset-password/request  body: { email }                  → 204
 *   POST /api/v1/auth/reset-password/confirm  body: { accessToken, newPassword } → 204
 *
 * Field-name discipline: the confirm-step body must match
 * `passwordResetConfirmSchema` from `@fnberp/shared` exactly — that schema
 * uses `accessToken` + `newPassword` (NOT `token` / `password`).
 *
 * Routing decision: rendered OUTSIDE AppShell (no `<RequireAuth>`) — both
 * steps are pre-authentication.
 *
 * Token notes:
 *   - NO `tenant_brand_accent` here. DESIGN.md §3 lists exactly four
 *     allowed surfaces for the brand accent (login splash, sidebar logo,
 *     B2B PDF headers, accountant-export PDF headers); password reset is
 *     none of those. The page is plain `bg-surface`.
 *   - Success states use `bg-surface-container-low` for a calm "you're done"
 *     feel rather than `status_confirmed` chip chrome.
 *   - Error chrome on password mismatch uses `aria-invalid` on the Input —
 *     the Input shell already wires the error ring (DESIGN.md §9.3).
 *
 * Animation — NONE per CLAUDE.md (transactional auth flow).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const voidSchema = z.void()

interface FormState {
  readonly email: string
  readonly newPassword: string
  readonly confirmPassword: string
}

const INITIAL_FORM: FormState = {
  email: '',
  newPassword: '',
  confirmPassword: '',
}

/**
 * Lightweight password rule check — Arc (a) `passwordResetConfirmSchema`
 * enforces `min(8)` server-side; this client-side gate uses the stricter
 * mockup ruleset (12+ / upper / lower / digit) so reviewers see the validation
 * chrome. The server is still the source of truth.
 */
function passwordIssues(pw: string): ReadonlyArray<string> {
  const issues: string[] = []
  if (pw.length < 12) issues.push('At least 12 characters')
  if (!/[A-Z]/.test(pw)) issues.push('One uppercase letter')
  if (!/[a-z]/.test(pw)) issues.push('One lowercase letter')
  if (!/[0-9]/.test(pw)) issues.push('One digit')
  return issues
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PasswordResetPage() {
  const params = useParams<{ token?: string }>()
  const token = params.token ?? null
  const mode: 'request' | 'confirm' = token ? 'confirm' : 'request'

  return (
    <div className="bg-surface min-h-screen flex flex-col">
      {/* Compact header — no brand accent (DESIGN.md §3). */}
      <header className="bg-surface-container-low text-on-surface">
        <div className="mx-auto max-w-[1100px] px-6 py-4 tablet:px-10 tablet:py-5 flex items-center justify-between gap-4">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-xs text-on-surface-variant hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm px-1 py-0.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to sign in
          </Link>
          <div className="flex items-center gap-2">
            <KeyRound
              className="h-4 w-4 text-on-surface-variant"
              aria-hidden
            />
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Password reset
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10 tablet:py-14">
        <div className="w-full max-w-[26rem]">
          {mode === 'request' ? <RequestFlow /> : <ConfirmFlow token={token!} />}
        </div>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Request flow (request → request-sent)
// ---------------------------------------------------------------------------

function RequestFlow() {
  const client = useApiClient()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [sentToEmail, setSentToEmail] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (email.trim().length === 0) return
    setSubmitting(true)
    setErrorMessage(null)
    try {
      await client.post({
        path: '/api/v1/auth/reset-password/request',
        body: { email },
        schema: voidSchema,
      })
      setSentToEmail(email)
    } catch (err) {
      // The endpoint should always return 204 (security invariant — never
      // disclose whether email exists). Surface any unexpected error
      // verbatim so we don't silently fail.
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Request failed — please try again.'
      setErrorMessage(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (sentToEmail !== null) {
    return (
      <RequestSentCard
        email={sentToEmail}
        onResend={() => {
          setSentToEmail(null)
          setEmail('')
          setErrorMessage(null)
        }}
      />
    )
  }

  return (
    <RequestCard
      email={email}
      submitting={submitting}
      errorMessage={errorMessage}
      onEmailChange={setEmail}
      onSubmit={(e) => { void handleSubmit(e) }}
    />
  )
}

// ---------------------------------------------------------------------------
// Confirm flow (confirm → confirm-done)
// ---------------------------------------------------------------------------

interface ConfirmFlowProps {
  readonly token: string
}

function ConfirmFlow({ token }: ConfirmFlowProps) {
  const client = useApiClient()
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const issues = passwordIssues(form.newPassword)
  const passwordsMatch =
    form.newPassword.length > 0 && form.newPassword === form.confirmPassword
  const canConfirm = issues.length === 0 && passwordsMatch && !submitting

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (!canConfirm) return
    setSubmitting(true)
    setErrorMessage(null)
    try {
      await client.post({
        path: '/api/v1/auth/reset-password/confirm',
        // Field names must match passwordResetConfirmSchema from @fnberp/shared:
        // { accessToken, newPassword } — NOT { token, password }.
        body: { accessToken: token, newPassword: form.newPassword },
        schema: voidSchema,
      })
      setDone(true)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Could not update password — please try again.'
      setErrorMessage(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return <ConfirmDoneCard />
  }

  return (
    <ConfirmCard
      newPassword={form.newPassword}
      confirmPassword={form.confirmPassword}
      issues={issues}
      passwordsMatch={passwordsMatch}
      canConfirm={canConfirm}
      submitting={submitting}
      errorMessage={errorMessage}
      onChange={update}
      onSubmit={(e) => { void handleSubmit(e) }}
    />
  )
}

// ---------------------------------------------------------------------------
// Step 1 — request reset (collect email)
// ---------------------------------------------------------------------------

interface RequestCardProps {
  readonly email: string
  readonly submitting: boolean
  readonly errorMessage: string | null
  readonly onEmailChange: (v: string) => void
  readonly onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
}

function RequestCard({
  email,
  submitting,
  errorMessage,
  onEmailChange,
  onSubmit,
}: RequestCardProps) {
  const canSubmit = email.trim().length > 0 && !submitting
  return (
    <Card className="p-0">
      <CardHeader className="p-6 pb-2">
        <CardTitle className="text-lg text-on-surface">
          Reset your password
        </CardTitle>
        <p className="mt-1 text-xs text-on-surface-variant">
          Enter your work email. If an account exists, we'll send a reset
          link valid for 30 minutes.
        </p>
      </CardHeader>

      <CardContent className="p-6 pt-4">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {errorMessage !== null ? (
            <div
              role="alert"
              className="rounded-sm bg-error-container px-3 py-2 text-on-error-container"
            >
              <p className="text-xs">{errorMessage}</p>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="reset-email"
              className="text-xs font-medium text-on-surface"
            >
              Work email
            </label>
            <div className="relative">
              <Mail
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant pointer-events-none"
                aria-hidden
              />
              <Input
                id="reset-email"
                type="email"
                autoComplete="username"
                placeholder="you@wildsugar.in"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Button
            type="submit"
            size="default"
            disabled={!canSubmit}
            className="mt-2 w-full"
            aria-label="Send reset link"
          >
            {submitting ? 'Sending...' : 'Send reset link'}
          </Button>
        </form>

        <SectionShift tone="lowest" className="mt-6" aria-hidden />

        <div className="mt-6 flex flex-col gap-2 text-[11px] text-on-surface-variant">
          <p>
            For security, the response is identical whether or not the
            email matches an account. Don't share the reset link.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Step 1.5 — request sent (neutral success)
// ---------------------------------------------------------------------------

interface RequestSentCardProps {
  readonly email: string
  readonly onResend: () => void
}

function RequestSentCard({ email, onResend }: RequestSentCardProps) {
  return (
    <Card className="p-0">
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center gap-4">
          <span
            aria-hidden
            className="inline-flex h-12 w-12 items-center justify-center rounded-sm bg-surface-container-low text-on-surface"
          >
            <CheckCircle2 className="h-6 w-6" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-on-surface">
              Check your inbox
            </h2>
            <p className="text-xs text-on-surface-variant">
              If an account exists for{' '}
              <span className="font-mono text-on-surface">{email}</span>,
              we've sent a reset link valid for 30 minutes.
            </p>
          </div>
          <div className="flex flex-col items-stretch w-full gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResend}
              className="w-full"
            >
              Use a different email
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Step 2 — confirm (set new password)
// ---------------------------------------------------------------------------

interface ConfirmCardProps {
  readonly newPassword: string
  readonly confirmPassword: string
  readonly issues: ReadonlyArray<string>
  readonly passwordsMatch: boolean
  readonly canConfirm: boolean
  readonly submitting: boolean
  readonly errorMessage: string | null
  readonly onChange: <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => void
  readonly onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
}

function ConfirmCard({
  newPassword,
  confirmPassword,
  issues,
  passwordsMatch,
  canConfirm,
  submitting,
  errorMessage,
  onChange,
  onSubmit,
}: ConfirmCardProps) {
  const showMismatch = confirmPassword.length > 0 && !passwordsMatch
  return (
    <Card className="p-0">
      <CardHeader className="p-6 pb-2">
        <CardTitle className="text-lg text-on-surface">
          Choose a new password
        </CardTitle>
        <p className="mt-1 text-xs text-on-surface-variant">
          Pick something memorable. The reset token expires once you save —
          you'll be signed in automatically.
        </p>
      </CardHeader>

      <CardContent className="p-6 pt-4">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          {errorMessage !== null ? (
            <div
              role="alert"
              className="rounded-sm bg-error-container px-3 py-2 text-on-error-container"
            >
              <p className="text-xs">{errorMessage}</p>
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="reset-new-password"
              className="text-xs font-medium text-on-surface"
            >
              New password
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant pointer-events-none"
                aria-hidden
              />
              <Input
                id="reset-new-password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 12 characters"
                value={newPassword}
                onChange={(e) => onChange('newPassword', e.target.value)}
                className="pl-9"
                aria-invalid={newPassword.length > 0 && issues.length > 0}
              />
            </div>
            {newPassword.length > 0 && issues.length > 0 ? (
              <ul className="text-[11px] text-on-surface-variant pl-1">
                {issues.map((rule) => (
                  <li key={rule} className="flex items-center gap-1.5">
                    <span aria-hidden className="text-error">
                      &middot;
                    </span>
                    {rule}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-on-surface-variant">
                12+ chars · upper · lower · digit. Avoid reusing recent
                passwords.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="reset-confirm-password"
              className="text-xs font-medium text-on-surface"
            >
              Confirm new password
            </label>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant pointer-events-none"
                aria-hidden
              />
              <Input
                id="reset-confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="Re-enter the new password"
                value={confirmPassword}
                onChange={(e) => onChange('confirmPassword', e.target.value)}
                className="pl-9"
                aria-invalid={showMismatch}
              />
            </div>
            {showMismatch ? (
              <p className="text-[11px] text-error" role="alert">
                Passwords don't match.
              </p>
            ) : null}
          </div>

          <Button
            type="submit"
            size="default"
            disabled={!canConfirm}
            className="mt-2 w-full"
            aria-label="Save new password"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden />
            {submitting ? 'Saving...' : 'Save new password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Step 2.5 — done (post-confirm)
// ---------------------------------------------------------------------------

function ConfirmDoneCard() {
  const navigate = useNavigate()
  return (
    <Card className="p-0">
      <CardContent className="p-6">
        <div className="flex flex-col items-center text-center gap-4">
          <span
            aria-hidden
            className="inline-flex h-12 w-12 items-center justify-center rounded-sm bg-surface-container-low text-on-surface"
          >
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold text-on-surface">
              Password updated
            </h2>
            <p className="text-xs text-on-surface-variant">
              Your password has been changed. Existing sessions on other
              devices have been signed out.
            </p>
          </div>
          <Button
            type="button"
            size="default"
            className="w-full"
            onClick={() => navigate('/login', { replace: true })}
          >
            Continue to sign in
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

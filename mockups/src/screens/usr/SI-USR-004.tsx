import { useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  SectionShift,
} from '@/shell'

/**
 * SI-USR-004 — Self-service password reset (two-step).
 *
 * Tier 2 mockup, Phase 4 Epic 2 USR Arc (b), Task B1. Two-step recovery
 * flow:
 *
 *   Step 1 — REQUEST.   User enters their email; we always show the same
 *                       neutral confirmation ("If an account exists for
 *                       <email>, we've sent a reset link") regardless of
 *                       whether the email matches a real user. This is the
 *                       FR16 + §17.5 security invariant — never disclose
 *                       account existence to an unauthenticated caller.
 *
 *   Step 2 — CONFIRM.   User clicks the link in the email and lands on a
 *                       /reset-password/{token} variant. The mockup
 *                       simulates this with a "I have a reset token" toggle
 *                       — production routes a real signed token. Step 2
 *                       collects new + confirm password, validates match
 *                       client-side, and shows the post-success card.
 *
 * State machine pattern (judgment call documented per task spec):
 *
 *   The two steps are modelled as a single component with internal local
 *   state (`step: 'request' | 'request-sent' | 'confirm' | 'confirm-done'`)
 *   rather than two separate routes. Rationale: Arc (a) ships
 *   `authService.requestPasswordReset` + `authService.confirmPasswordReset`
 *   as siblings, and the production frontend will route real /forgot vs
 *   /reset-password/{token} URLs in Arc (c). For the mockup the state
 *   machine is the cheapest visual coverage — reviewers see all four
 *   states without needing real token routing. Document this so Arc (c)
 *   reviewers know to split the routes (don't replicate the local-state
 *   approach in production).
 *
 * Routing decision: Same as SI-USR-003 — rendered OUTSIDE the AppShell. A
 * password-reset page is pre-authentication; sidebar + persona switcher
 * don't apply.
 *
 * Source FRs:
 *   - FR16 — self-service password reset; two-step request -> confirm.
 *
 * Cross-cutting:
 *   - §17.5 error envelope — request step always returns the same neutral
 *     success card; never disclose email existence.
 *
 * Token notes:
 *   - NO `tenant_brand_accent` here. DESIGN.md §3 lists exactly four
 *     allowed surfaces for the brand accent (login splash, sidebar logo,
 *     B2B PDF headers, accountant-export PDF headers); password reset is
 *     none of those. The page is plain `bg-surface`.
 *   - Success states use `bg-surface-container-low` + `text-on-surface`
 *     for a calm "you're done" feel rather than `status_confirmed` chip
 *     chrome (which is meant for entity-scope status, not page banners).
 *   - Error chrome on password mismatch uses `aria-invalid` on the
 *     Input — Input shell already wires the error ring (DESIGN.md §9.3).
 *
 * Animation — NONE per CLAUDE.md (transactional auth flow).
 */

type Step = 'request' | 'request-sent' | 'confirm' | 'confirm-done'

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
 * Lightweight password rule check — Arc (a) `authPasswordSchema` enforces
 * this server-side. Mirrored here so reviewers see the validation chrome.
 */
function passwordIssues(pw: string): ReadonlyArray<string> {
  const issues: string[] = []
  if (pw.length < 12) issues.push('At least 12 characters')
  if (!/[A-Z]/.test(pw)) issues.push('One uppercase letter')
  if (!/[a-z]/.test(pw)) issues.push('One lowercase letter')
  if (!/[0-9]/.test(pw)) issues.push('One digit')
  return issues
}

export default function SiUsr004() {
  const [step, setStep] = useState<Step>('request')
  const [form, setForm] = useState<FormState>(INITIAL_FORM)

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const issues = passwordIssues(form.newPassword)
  const passwordsMatch =
    form.newPassword.length > 0 &&
    form.newPassword === form.confirmPassword
  const canConfirm = issues.length === 0 && passwordsMatch

  const handleRequestSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (form.email.trim().length === 0) return
    // Mockup-only — Arc (c) wires authService.requestPasswordReset.
    setStep('request-sent')
  }

  const handleConfirmSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canConfirm) return
    // Mockup-only — Arc (c) wires authService.confirmPasswordReset({ token }).
    setStep('confirm-done')
  }

  return (
    <div className="bg-surface min-h-screen flex flex-col">
      {/* Compact header — no brand accent (DESIGN.md §3). */}
      <header className="bg-surface-container-low text-on-surface">
        <div className="mx-auto max-w-[1100px] px-6 py-4 tablet:px-10 tablet:py-5 flex items-center justify-between gap-4">
          <Link
            to="/SI-USR-003"
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
          {step === 'request' ? (
            <RequestCard
              email={form.email}
              onEmailChange={(v) => update('email', v)}
              onSubmit={handleRequestSubmit}
              onSimulateLink={() => setStep('confirm')}
            />
          ) : null}

          {step === 'request-sent' ? (
            <RequestSentCard
              email={form.email}
              onSimulateLink={() => setStep('confirm')}
              onResend={() => setStep('request')}
            />
          ) : null}

          {step === 'confirm' ? (
            <ConfirmCard
              newPassword={form.newPassword}
              confirmPassword={form.confirmPassword}
              issues={issues}
              passwordsMatch={passwordsMatch}
              canConfirm={canConfirm}
              onChange={update}
              onSubmit={handleConfirmSubmit}
            />
          ) : null}

          {step === 'confirm-done' ? <ConfirmDoneCard /> : null}
        </div>
      </main>

      <footer className="px-6 py-4 text-center text-[11px] text-on-surface-variant">
        <span>SI-USR-004 · Tier 2 · Phase 4 Epic 2 Arc (b)</span>
      </footer>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — request reset (collect email)
// ─────────────────────────────────────────────────────────────────────────────

interface RequestCardProps {
  readonly email: string
  readonly onEmailChange: (v: string) => void
  readonly onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  readonly onSimulateLink: () => void
}

function RequestCard({
  email,
  onEmailChange,
  onSubmit,
  onSimulateLink,
}: RequestCardProps) {
  const canSubmit = email.trim().length > 0
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
            Send reset link
          </Button>
        </form>

        <SectionShift tone="lowest" className="mt-6" aria-hidden />

        <div className="mt-6 flex flex-col gap-2 text-[11px] text-on-surface-variant">
          <p>
            For security, the response is identical whether or not the
            email matches an account. Don't share the reset link.
          </p>
          {/*
           * Reviewer affordance — jump straight into the confirm step so
           * the mockup is fully reviewable without going through email.
           */}
          <button
            type="button"
            onClick={onSimulateLink}
            className="self-start text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          >
            (Mockup-only) Simulate clicking the reset link
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1.5 — request sent (neutral success)
// ─────────────────────────────────────────────────────────────────────────────

interface RequestSentCardProps {
  readonly email: string
  readonly onSimulateLink: () => void
  readonly onResend: () => void
}

function RequestSentCard({
  email,
  onSimulateLink,
  onResend,
}: RequestSentCardProps) {
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
            <button
              type="button"
              onClick={onSimulateLink}
              className="text-[11px] text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm py-1"
            >
              (Mockup-only) Simulate clicking the reset link
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — confirm (set new password)
// ─────────────────────────────────────────────────────────────────────────────

interface ConfirmCardProps {
  readonly newPassword: string
  readonly confirmPassword: string
  readonly issues: ReadonlyArray<string>
  readonly passwordsMatch: boolean
  readonly canConfirm: boolean
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
  onChange,
  onSubmit,
}: ConfirmCardProps) {
  const showMismatch =
    confirmPassword.length > 0 && !passwordsMatch
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
                onChange={(e) =>
                  onChange('confirmPassword', e.target.value)
                }
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
            Save new password
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2.5 — done (post-confirm)
// ─────────────────────────────────────────────────────────────────────────────

function ConfirmDoneCard() {
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
          <Button asChild size="default" className="w-full">
            <Link to="/SI-USR-003">Continue to sign in</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

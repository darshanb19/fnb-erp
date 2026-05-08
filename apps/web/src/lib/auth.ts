/**
 * auth — real Supabase Auth integration (DL-033, replaces DL-029 dev-stub).
 *
 * Exports AuthProvider + useSession() for consumption by all production pages.
 * Wraps `@supabase/supabase-js` with our project's `Session` shape so that
 * Epic 1 pages built against the dev-stub keep working without changes.
 *
 * Consumer surface (LOAD-BEARING — do not change shape):
 *   const { session, status, signIn, signOut } = useSession()
 *   session: { accessToken, user: { id, brandId, role }, expiresAt } | null
 *   status: 'loading' | 'authenticated' | 'unauthenticated'
 *
 * The Supabase access token carries `sub`, `user_metadata.brand_id`, and
 * `user_metadata.role` claims — verified by apps/api auth middleware against
 * SUPABASE_JWT_SECRET (the JWT signing secret of the same Mumbai project).
 *
 * Migration notes:
 *   - The DL-029 `signInDev()` is gone; use `signIn(email, password)` instead.
 *   - Session is persisted by supabase-js to localStorage; we no longer manage
 *     sessionStorage ourselves.
 *   - Auto-refresh is on by default — supabase-js renews the access token
 *     before expiry; the AuthProvider listens for `onAuthStateChange` to keep
 *     React state in sync with the underlying client.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Session as SupabaseSession } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/lib/user-roles'

// ---------------------------------------------------------------------------
// Session shape (LOAD-BEARING — Epic 1 pages depend on this exact shape)
// ---------------------------------------------------------------------------

export interface Session {
  accessToken: string
  user: {
    id: string
    brandId: string
    role: UserRole
  }
  /** Unix timestamp (seconds) when the access token expires. */
  expiresAt: number
}

// ---------------------------------------------------------------------------
// Auth context value
// ---------------------------------------------------------------------------

export interface AuthContextValue {
  session: Session | null
  status: 'loading' | 'authenticated' | 'unauthenticated'
  /**
   * Sign in with email + password against the Mumbai Supabase Auth project.
   * Throws on failure (caller should catch and surface a friendly message).
   */
  signIn: (email: string, password: string) => Promise<void>
  /** Sign out and clear the persisted session. */
  signOut: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Map a Supabase session to our `Session` shape, validating that the JWT
 * carries the brand_id + role claims required by apps/api middleware.
 * Returns null if the claims are missing — the caller treats that as
 * "unauthenticated" (the user shouldn't have been able to sign in without them,
 * but we defend against it explicitly).
 */
function mapSupabaseSession(supaSession: SupabaseSession | null): Session | null {
  if (!supaSession) return null
  const { access_token, expires_at, user } = supaSession
  if (!access_token || !user) return null

  const meta = (user.user_metadata ?? {}) as { brand_id?: unknown; role?: unknown }
  const brandId = typeof meta.brand_id === 'string' ? meta.brand_id : null
  const role = typeof meta.role === 'string' ? (meta.role as UserRole) : null
  if (!brandId || !role) return null

  return {
    accessToken: access_token,
    user: { id: user.id, brandId, role },
    // Supabase `expires_at` is unix seconds; fall back to "1h from now" if the
    // server omits it (shouldn't happen with the default Auth config).
    expiresAt: typeof expires_at === 'number' ? expires_at : Math.floor(Date.now() / 1000) + 3600,
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null)

// ---------------------------------------------------------------------------
// AuthProvider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthContextValue['status']>('loading')

  const signIn = useCallback(async (email: string, password: string): Promise<void> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      throw new Error(error.message)
    }
    // Don't manually setSession here — the onAuthStateChange listener picks it up.
  }, [])

  const signOut = useCallback(async (): Promise<void> => {
    await supabase.auth.signOut()
    // onAuthStateChange will fire with null session; no manual setState needed.
  }, [])

  useEffect(() => {
    let cancelled = false

    // 1. Hydrate from any persisted session (localStorage)
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      const mapped = mapSupabaseSession(data.session)
      setSession(mapped)
      setStatus(mapped ? 'authenticated' : 'unauthenticated')
    })

    // 2. Subscribe to auth changes (sign in / out / refresh)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, supaSession) => {
      if (cancelled) return
      const mapped = mapSupabaseSession(supaSession)
      setSession(mapped)
      setStatus(mapped ? 'authenticated' : 'unauthenticated')
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const value: AuthContextValue = { session, status, signIn, signOut }

  return React.createElement(AuthContext.Provider, { value }, children)
}

// ---------------------------------------------------------------------------
// useSession hook
// ---------------------------------------------------------------------------

export function useSession(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (ctx === null) {
    throw new Error('useSession() must be used inside <AuthProvider>')
  }
  return ctx
}

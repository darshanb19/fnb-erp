/**
 * auth — dev-stub auth module per DL-029.
 *
 * Exports AuthProvider + useSession() for consumption by all production pages.
 * JWT minting uses `jose` (browser-compatible HS256) and is GATED behind
 * `import.meta.env.DEV` — production builds tree-shake the minting code.
 *
 * Epic 2 USR will replace this file with a real Supabase Auth integration.
 * The consumer surface (useSession() return shape) stays identical so all
 * production pages built in Arc (c) keep working without changes.
 *
 * Session storage key: 'fnberp.dev_session_v1'
 * Signing algorithm:   HS256 (matches apps/api/src/middleware/auth.ts verification)
 * Claim shape:         { sub, user_metadata: { brand_id, role }, exp, iat }
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_STORAGE_KEY = 'fnberp.dev_session_v1';
const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

// ---------------------------------------------------------------------------
// Role type (matches apps/api claim shape)
// ---------------------------------------------------------------------------

export type UserRole =
  | 'brand_owner'
  | 'procurement_manager'
  | 'store_manager'
  | 'kitchen_manager'
  | 'finance'
  | 'viewer';

// ---------------------------------------------------------------------------
// Session shape
// ---------------------------------------------------------------------------

export interface Session {
  accessToken: string;
  user: {
    id: string;
    brandId: string;
    role: UserRole;
  };
  /** Unix timestamp (seconds) when the token expires. */
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Auth context value
// ---------------------------------------------------------------------------

export interface AuthContextValue {
  session: Session | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  /** Dev only — gated by import.meta.env.DEV. Throws in production builds. */
  signInDev: (opts?: { role?: UserRole }) => Promise<void>;
  signOut: () => void;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Return the signing key as a Uint8Array for jose. */
function getSigningKey(): Uint8Array {
  // VITE_DEV_JWT_SECRET is typed as string in vite-env.d.ts; defaults to the
  // test secret when the env var is empty (matches apps/api/src/env.ts test default).
  const secret = import.meta.env.VITE_DEV_JWT_SECRET || 'test-secret-do-not-use-in-prod';
  return new TextEncoder().encode(secret);
}

/** Stored session shape written to sessionStorage. */
interface StoredSession {
  accessToken: string;
  userId: string;
  brandId: string;
  role: UserRole;
  expiresAt: number;
}

function writeSessionStorage(session: StoredSession): void {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // sessionStorage not available (e.g. private mode with storage blocked) — ignore
  }
}

function clearSessionStorage(): void {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function readSessionStorage(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

/** Extended JWT payload including our custom claims. */
interface DevJwtPayload extends JWTPayload {
  user_metadata?: {
    brand_id?: string;
    role?: string;
  };
}

/** Verify a stored token against the dev secret. Returns null if invalid/expired. */
async function verifyToken(token: string): Promise<DevJwtPayload | null> {
  try {
    const key = getSigningKey();
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    return payload as DevJwtPayload;
  } catch {
    return null;
  }
}

/** Mint a new HS256 JWT. DEV only — called only when import.meta.env.DEV is true. */
async function mintToken(userId: string, brandId: string, role: UserRole): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const key = getSigningKey();
  return new SignJWT({
    user_metadata: { brand_id: brandId, role },
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_TTL_SECONDS)
    .sign(key);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// AuthProvider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthContextValue['status']>('loading');

  // signOut — always callable regardless of DEV/PROD
  const signOut = useCallback((): void => {
    clearSessionStorage();
    setSession(null);
    setStatus('unauthenticated');
  }, []);

  // signInDev — gated by import.meta.env.DEV
  const signInDev = useCallback(async (opts?: { role?: UserRole }): Promise<void> => {
    if (!import.meta.env.DEV) {
      throw new Error('signInDev() is only available in development builds');
    }

    const userId =
      import.meta.env.VITE_SEED_USER_ID || '00000000-0000-0000-0000-000000000001';
    const brandId =
      import.meta.env.VITE_SEED_BRAND_ID || '00000000-0000-0000-0000-000000000000';
    const role: UserRole = opts?.role ?? 'brand_owner';

    const token = await mintToken(userId, brandId, role);
    const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;

    const stored: StoredSession = { accessToken: token, userId, brandId, role, expiresAt };
    writeSessionStorage(stored);

    const newSession: Session = {
      accessToken: token,
      user: { id: userId, brandId, role },
      expiresAt,
    };
    setSession(newSession);
    setStatus('authenticated');
  }, []);

  // Rehydrate from sessionStorage on mount
  useEffect(() => {
    let cancelled = false;

    async function rehydrate(): Promise<void> {
      const stored = readSessionStorage();

      if (stored) {
        const now = Math.floor(Date.now() / 1000);
        const isExpired = stored.expiresAt <= now;

        if (!isExpired) {
          // Verify the token cryptographically
          const payload = await verifyToken(stored.accessToken);
          if (!cancelled && payload !== null) {
            const hydratedSession: Session = {
              accessToken: stored.accessToken,
              user: { id: stored.userId, brandId: stored.brandId, role: stored.role },
              expiresAt: stored.expiresAt,
            };
            setSession(hydratedSession);
            setStatus('authenticated');
            return;
          }
        }

        // Expired or invalid — clear
        clearSessionStorage();
      }

      if (!cancelled) {
        // Auto sign-in opt-in (saves the dev login button click every reload)
        if (import.meta.env.DEV && import.meta.env.VITE_AUTO_DEV_SIGNIN === 'true') {
          try {
            await signInDev();
          } catch {
            // signInDev failed for some reason — fall back to unauthenticated
            if (!cancelled) setStatus('unauthenticated');
          }
          return;
        }

        setStatus('unauthenticated');
      }
    }

    void rehydrate();

    return () => {
      cancelled = true;
    };
  }, [signInDev]);

  const value: AuthContextValue = { session, status, signInDev, signOut };

  return React.createElement(AuthContext.Provider, { value }, children);
}

// ---------------------------------------------------------------------------
// useSession hook
// ---------------------------------------------------------------------------

export function useSession(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useSession() must be used inside <AuthProvider>');
  }
  return ctx;
}

/**
 * _auth-helper — shared utility for e2e specs that need to call apps/api
 * directly (data seeding) using the bootstrap BO's Supabase access token.
 *
 * Replaces the per-spec `mintJwt()` helpers (DL-029 era) that signed an
 * HS256 JWT with the test-secret — that no longer works because apps/api
 * now verifies tokens against the real Mumbai SUPABASE_JWT_SECRET.
 *
 * The token is written to tests/e2e/.auth-state.json by globalSetup; this
 * module reads it lazily so each spec gets the same token without re-signing.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface AuthState {
  accessToken: string
  refreshToken: string
  userId: string
  brandId: string
  role: string
  expiresAt: number
}

let cached: AuthState | null = null

export function loadAuthState(): AuthState {
  if (cached) return cached
  const path = join(__dirname, '.auth-state.json')
  const raw = readFileSync(path, 'utf8')
  cached = JSON.parse(raw) as AuthState
  return cached
}

/** Convenience wrapper for POST → apps/api with the bootstrap BO's token. */
export async function apiPost(
  api: string,
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { accessToken } = loadAuthState()
  const res = await fetch(`${api}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POST ${path} → ${res.status}: ${text}`)
  }
  return res.json() as Promise<Record<string, unknown>>
}

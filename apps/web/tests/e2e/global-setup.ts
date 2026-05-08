/**
 * Playwright global setup — signs in the bootstrap BO once via supabase-js
 * and persists the resulting session for all e2e specs to reuse.
 *
 * Outputs (both gitignored — see apps/web/.gitignore):
 *   - tests/e2e/.auth-state.json    — { accessToken, brandId, userId, role, expiresAt }
 *                                     for direct apps/api calls (data seeding)
 *   - tests/e2e/.storage-state.json — Playwright storageState format with the
 *                                     Supabase localStorage entry pre-populated
 *                                     so `page.goto('/')` lands signed-in
 *
 * Why globalSetup instead of per-spec sign-in?
 *   - One Auth round-trip per test run instead of N (faster + kinder to Mumbai).
 *   - Storage-state mode is the Playwright-recommended way to skip login UIs.
 *   - The 6 specs that POST to apps/api directly (mdm-departments, -products,
 *     -vendors, -categories, -enablement, -company) read the access token from
 *     .auth-state.json instead of minting their own HS256 JWT — that no longer
 *     works because apps/api now verifies against the real Mumbai JWT secret.
 *
 * Required env vars (loaded by Vite from apps/web/.env.local for `dev`, and
 * read here directly via process.env when running playwright):
 *   - VITE_SUPABASE_URL
 *   - VITE_SUPABASE_ANON_KEY
 *   - VITE_BOOTSTRAP_BO_EMAIL
 *   - VITE_BOOTSTRAP_BO_PASSWORD
 */

import { createClient } from '@supabase/supabase-js'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// Load .env.local manually (Playwright doesn't auto-load Vite envs at runtime)
// ---------------------------------------------------------------------------

function loadEnvLocal(): Record<string, string> {
  const envPath = join(__dirname, '..', '..', '.env.local')
  if (!existsSync(envPath)) return {}
  const raw = readFileSync(envPath, 'utf8')
  const out: Record<string, string> = {}
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    out[key] = value
  }
  return out
}

export default async function globalSetup(): Promise<void> {
  const fileEnv = loadEnvLocal()
  const url = process.env['VITE_SUPABASE_URL'] ?? fileEnv['VITE_SUPABASE_URL']
  const anonKey = process.env['VITE_SUPABASE_ANON_KEY'] ?? fileEnv['VITE_SUPABASE_ANON_KEY']
  const email = process.env['VITE_BOOTSTRAP_BO_EMAIL'] ?? fileEnv['VITE_BOOTSTRAP_BO_EMAIL']
  const password =
    process.env['VITE_BOOTSTRAP_BO_PASSWORD'] ?? fileEnv['VITE_BOOTSTRAP_BO_PASSWORD']

  if (!url || !anonKey || !email || !password) {
    throw new Error(
      'global-setup: missing one or more of VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, ' +
        'VITE_BOOTSTRAP_BO_EMAIL, VITE_BOOTSTRAP_BO_PASSWORD in apps/web/.env.local',
    )
  }

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.session || !data.user) {
    throw new Error(
      `global-setup: bootstrap BO sign-in failed: ${error?.message ?? 'no session returned'}`,
    )
  }

  const meta = (data.user.user_metadata ?? {}) as { brand_id?: unknown; role?: unknown }
  const brandId = typeof meta.brand_id === 'string' ? meta.brand_id : null
  const role = typeof meta.role === 'string' ? meta.role : null
  if (!brandId || !role) {
    throw new Error(
      'global-setup: bootstrap BO user_metadata is missing brand_id or role — ' +
        'rerun `pnpm --filter @fnberp/api bootstrap:bo` to repair the seed.',
    )
  }

  // ── Write .auth-state.json (used by specs that POST to apps/api directly) ──
  const authState = {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    userId: data.user.id,
    brandId,
    role,
    expiresAt: data.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600,
  }
  writeFileSync(join(__dirname, '.auth-state.json'), JSON.stringify(authState, null, 2))

  // ── Write Playwright storageState (used by `use.storageState` config) ──────
  // Supabase persists session to localStorage under sb-<project-ref>-auth-token.
  // The project ref is the subdomain of VITE_SUPABASE_URL (e.g. "rqwlgvozrurftnlhchih").
  const projectRef = new URL(url).hostname.split('.')[0] ?? 'unknown'
  const storageKey = `sb-${projectRef}-auth-token`

  // The localStorage value supabase-js writes is the full session JSON.
  // Replicate the shape the client expects to find on hydration.
  const localStorageValue = JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
    user: data.user,
  })

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: 'http://localhost:5174',
        localStorage: [{ name: storageKey, value: localStorageValue }],
      },
    ],
  }
  writeFileSync(join(__dirname, '.storage-state.json'), JSON.stringify(storageState, null, 2))
}

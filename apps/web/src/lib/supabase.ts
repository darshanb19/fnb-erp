/**
 * supabase — singleton browser client for Supabase Auth.
 *
 * Created in C1 (DL-033) as part of the swap from the DL-029 dev-stub auth
 * to real Supabase Auth (Mumbai project). The client persists the session
 * to localStorage under the key `sb-<project-ref>-auth-token` and auto-
 * refreshes the access token before expiry.
 *
 * Used by:
 *   - apps/web/src/lib/auth.ts — wraps the client with our `useSession()` shape
 *   - Playwright globalSetup — signs in the bootstrap BO once for the test run
 */

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required')
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

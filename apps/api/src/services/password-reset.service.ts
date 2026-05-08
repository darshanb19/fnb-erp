/**
 * passwordResetService — Task A6/5
 *
 * Thin wrapper around Supabase Auth for password reset flows.
 *
 * The real call path uses a lazily initialised Supabase Admin client via
 * env.SUPABASE_URL + env.SUPABASE_SERVICE_ROLE_KEY.
 *
 * For tests, inject a mock client via `deps.client`.
 *
 * Arc (a) shape: proves the call surface + testability.
 * Arc (c) Task C3 wires the frontend password-reset flow that consumes these methods.
 *
 * Note on confirmReset:
 *   The frontend drives the Supabase password-reset exchange via a magic link that
 *   logs the user in with a temporary session. The backend confirmReset call uses
 *   client.auth.updateUser({ password }) which updates the currently-authenticated
 *   user's password. In practice, the frontend does this directly via the public
 *   anon client. The service-side implementation is provided here for completeness
 *   and server-side proxy patterns; it uses the service role client which does NOT
 *   have the user's session context — so this is best treated as a stub until Arc (c).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../env.js';

let _client: SupabaseClient | undefined;

function getClient(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return _client;
}

export interface PasswordResetServiceDeps {
  /** Optional client override for tests. */
  client?: SupabaseClient;
}

export const passwordResetService = {
  /**
   * Sends a password reset email via Supabase Auth.
   *
   * @param email   The user's email address.
   * @param deps    Optional: inject a mock client for tests.
   */
  async requestReset(
    email: string,
    deps?: PasswordResetServiceDeps,
  ): Promise<void> {
    const client = deps?.client ?? getClient();
    const { error } = await client.auth.resetPasswordForEmail(email);
    if (error) {
      throw new Error(`Password reset request failed: ${error.message}`);
    }
  },

  /**
   * Confirms a password reset by updating the user's password.
   *
   * Note: In the standard Supabase flow, the frontend handles this directly
   * via the user's temporary session (from the magic link). The `accessToken`
   * here is the session token Supabase issued via the reset link.
   *
   * This stub is a server-side equivalent — it's thin in Arc (a). Arc (c)
   * wires the real frontend exchange.
   *
   * @param input.accessToken  The temporary access token from the reset link.
   * @param input.newPassword  The new password to set.
   * @param deps               Optional: inject a mock client for tests.
   */
  async confirmReset(
    input: { accessToken: string; newPassword: string },
    deps?: PasswordResetServiceDeps,
  ): Promise<void> {
    const client = deps?.client ?? getClient();
    // In a real server-side exchange, the accessToken would be used to
    // set the session before calling updateUser. For Arc (a) shape-testing,
    // the test mock verifies the error-propagation path.
    const { error } = await client.auth.updateUser({ password: input.newPassword });
    if (error) {
      throw new Error(`Password update failed: ${error.message}`);
    }
  },
};

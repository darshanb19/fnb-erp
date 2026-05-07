/**
 * password-reset-service.test.ts — Task A6/5
 *
 * Tests for the passwordResetService thin Supabase Auth wrapper.
 * Uses fake SupabaseClient via deps.client injection — no real Supabase calls.
 *
 * These tests are NOT integration tests in the DB sense (no DB calls), but
 * are placed in the integration folder per the task structure.
 */

import { describe, it, expect, vi } from 'vitest';
import { passwordResetService } from '../../src/services/password-reset.service.js';
import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Minimal fake SupabaseClient factories
// ---------------------------------------------------------------------------

function makeFakeClient(overrides?: {
  resetPasswordForEmailResult?: { error: { message: string } | null };
  updateUserResult?: { error: { message: string } | null };
}): SupabaseClient {
  const resetSpy = vi.fn().mockResolvedValue(
    overrides?.resetPasswordForEmailResult ?? { error: null },
  );
  const updateUserSpy = vi.fn().mockResolvedValue(
    overrides?.updateUserResult ?? { error: null },
  );

  return {
    auth: {
      resetPasswordForEmail: resetSpy,
      updateUser: updateUserSpy,
    },
  } as unknown as SupabaseClient;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('passwordResetService', () => {
  it('requestReset() calls client.auth.resetPasswordForEmail with the email', async () => {
    const fakeClient = makeFakeClient();
    await passwordResetService.requestReset('user@example.com', { client: fakeClient });

    expect(fakeClient.auth.resetPasswordForEmail).toHaveBeenCalledWith('user@example.com');
  });

  it('requestReset() throws when client returns an error', async () => {
    const fakeClient = makeFakeClient({
      resetPasswordForEmailResult: { error: { message: 'User not found' } },
    });

    await expect(
      passwordResetService.requestReset('ghost@example.com', { client: fakeClient }),
    ).rejects.toThrow('Password reset request failed: User not found');
  });

  it('confirmReset() proxies through client and throws on client error', async () => {
    const fakeClient = makeFakeClient({
      updateUserResult: { error: { message: 'Invalid token' } },
    });

    await expect(
      passwordResetService.confirmReset(
        { accessToken: 'bad-token', newPassword: 'new-password-123' },
        { client: fakeClient },
      ),
    ).rejects.toThrow('Password update failed: Invalid token');
  });
});

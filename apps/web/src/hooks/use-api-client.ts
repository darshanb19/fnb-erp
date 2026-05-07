/**
 * useApiClient — React hook that returns a configured ApiClient instance.
 *
 * Reads the bearer token from the auth context (via useSession) so every
 * TanStack Query hook can call `useApiClient()` without repeating the
 * token-wiring boilerplate.
 *
 * The base URL comes from `VITE_API_BASE_URL` (required in .env.local).
 * Defaults to the standard development URL if the env var is not set.
 *
 * DL-029 note: useSession() returns `null` accessToken until the dev-stub
 * AuthProvider has finished rehydrating. The ApiClient gracefully omits the
 * Authorization header when the token is null, so React Query hooks that
 * mount before auth is ready will receive a 401 from the API — which is
 * correct behaviour (the routes require auth).
 */

import { useMemo } from 'react';
import { createApiClient, type ApiClient } from '@/lib/api-client';
import { useSession } from '@/lib/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined ?? 'http://localhost:3001';

export function useApiClient(): ApiClient {
  const { session } = useSession();

  return useMemo(
    () =>
      createApiClient({
        baseUrl: API_BASE_URL,
        getToken: () => session?.accessToken ?? null,
      }),
    // Re-create the client when the access token changes (sign-in / sign-out).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.accessToken],
  );
}

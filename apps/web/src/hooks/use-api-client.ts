/**
 * useApiClient — React hook that returns a configured ApiClient instance.
 *
 * Reads the bearer token from the auth context (via useSession) so every
 * TanStack Query hook can call `useApiClient()` without repeating the
 * token-wiring boilerplate.
 *
 * The base URL comes from `@/lib/api-config` (single source of truth). That
 * module resolves to same-origin (`/api`) on any deployed host and only uses a
 * separate localhost origin when served from the local Vite dev server — so a
 * stray `VITE_API_BASE_URL=http://localhost:3001` can never again ship a
 * production bundle that points real visitors at localhost.
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
import { API_BASE_URL } from '@/lib/api-config';

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

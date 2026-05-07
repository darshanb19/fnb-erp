/**
 * useUoms — TanStack Query hook for the /api/v1/uoms resource.
 *
 * DL-023 layer 1: the global UOM registry per brand.
 * This hook is read-only — the registry is admin-managed; no CRUD UI in Arc (c).
 *
 * Exports:
 *   useUomsList() — fetch all UOMs for the current brand
 */

import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/hooks/use-api-client';
import { qk } from '@/lib/query-keys';
import { uomsListSchema } from './schemas';

/** Fetch all UOMs (global registry) for the current brand. */
export function useUomsList() {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.uoms.list(),
    queryFn: ({ signal }) =>
      client.get({ path: '/api/v1/uoms', schema: uomsListSchema, signal }),
  });
}

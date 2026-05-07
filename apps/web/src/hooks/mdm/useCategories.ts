/**
 * useCategories — TanStack Query hooks for the /api/v1/categories resource.
 *
 * SI-MDM-003 (Product Master) uses categories as read-only multi-select.
 * Full CRUD lands in Task C8 (SI-MDM-006).
 *
 * Exports:
 *   useCategoriesList() — fetch all categories for the current brand
 *   useCategory(id)     — fetch a single category by ID
 */

import { useQuery } from '@tanstack/react-query';
import { useApiClient } from '@/hooks/use-api-client';
import { qk } from '@/lib/query-keys';
import { categoriesListSchema, categorySchema } from './schemas';

/** Fetch all categories for the current brand. */
export function useCategoriesList() {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.categories.list(),
    queryFn: ({ signal }) =>
      client.get({ path: '/api/v1/categories', schema: categoriesListSchema, signal }),
  });
}

/** Fetch a single category by ID. */
export function useCategory(id: string) {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.categories.byId(id),
    queryFn: ({ signal }) =>
      client.get({ path: `/api/v1/categories/${id}`, schema: categorySchema, signal }),
    enabled: Boolean(id),
  });
}

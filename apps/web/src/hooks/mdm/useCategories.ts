/**
 * useCategories — TanStack Query hooks for the /api/v1/categories resource.
 *
 * SI-MDM-003 (Product Master) uses categories as read-only multi-select.
 * Full CRUD lands in Task C8 (SI-MDM-006).
 *
 * Exports:
 *   useCategoriesList()              — fetch all categories for the current brand
 *   useCategory(id)                  — fetch a single category by ID
 *   useCreateCategory()              — mutation; invalidates categories.all
 *   useUpdateCategory()              — mutation; invalidates categories.all + byId
 *   useDeactivateCategory()          — mutation (DELETE); invalidates categories.all
 *   useFindSimilarCategories(name)   — enabled when name.length >= 3; staleTime: 0
 *                                      Third consumer of DL-026 CC-DUPLICATE-WARN (Task C9).
 *                                      Consumer is responsible for debouncing.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/hooks/use-api-client';
import { qk } from '@/lib/query-keys';
import { categoriesListSchema, categorySchema, similarCategoriesListSchema, type CategoryRow } from './schemas';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateCategoryInput {
  name: string;
  parentId?: string | null;
  active?: boolean;
}

export interface UpdateCategoryInput {
  /** Required by API audit (DL-013). Must be >= 3 chars per API validation. */
  reason: string;
  name?: string;
  active?: boolean;
  parentId?: string | null;
}

export interface DeactivateCategoryInput {
  /** Reason is required by the API (DL-013). Must be >= 3 chars per API validation. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

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

/** Create a new category. Invalidates categories.all. */
export function useCreateCategory() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<CategoryRow, Error, CreateCategoryInput>({
    mutationFn: (input) =>
      client.post({ path: '/api/v1/categories', body: input, schema: categorySchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.categories.all });
    },
  });
}

/** Update a category (mutable fields). Requires `reason`. Invalidates list + byId. */
export function useUpdateCategory() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<CategoryRow, Error, { id: string } & UpdateCategoryInput>({
    mutationFn: ({ id, reason, ...rest }) =>
      client.patch({
        path: `/api/v1/categories/${id}`,
        body: { ...rest, reason },
        schema: categorySchema,
      }),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: qk.categories.all });
      void queryClient.invalidateQueries({ queryKey: qk.categories.byId(id) });
    },
  });
}

/**
 * Deactivate a category (soft-delete via DELETE).
 * M:N product_categories rows are preserved — per soft-delete contract.
 * Requires `reason`.
 */
export function useDeactivateCategory() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<CategoryRow, Error, { id: string } & DeactivateCategoryInput>({
    mutationFn: ({ id, reason }) =>
      client.delete({
        path: `/api/v1/categories/${id}`,
        body: { reason },
        schema: categorySchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.categories.all });
    },
  });
}

/**
 * DL-026 / DL-034: Fuzzy category name search via pg_trgm ≥ 0.85 similarity.
 *
 * Third consumer of CC-DUPLICATE-WARN (Task C9). Closes the gap deferred from
 * the Epic 1 chrome-freeze review (2026-05-07) — categoryService.findSimilarByName
 * shipped in Arc (a) per DL-034 but was unrouted until GET /categories/find-similar
 * was added in Task C9.
 *
 * Query is enabled only when name.length >= 3. staleTime: 0 ensures
 * every keystroke (after debounce in the consumer) hits fresh data.
 * The consumer (CategoryDialog in CategoriesPage) is responsible for
 * debouncing the name value before passing it to this hook.
 *
 * @param name    The name string to search for similar categories.
 * @param opts    Optional excludeId (omit from results; use when editing).
 */
export function useFindSimilarCategories(
  name: string,
  opts?: { excludeId?: string },
) {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.categories.findSimilar(name),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ name });
      if (opts?.excludeId) params.set('excludeId', opts.excludeId);
      return client.get({
        path: `/api/v1/categories/find-similar?${params.toString()}`,
        schema: similarCategoriesListSchema,
        signal,
      });
    },
    enabled: name.length >= 3,
    staleTime: 0,
  });
}

/**
 * useProducts — TanStack Query hooks for the /api/v1/products resource.
 *
 * Covers FR3 (product CRUD) + DL-026 (find-similar for CC-DUPLICATE-WARN)
 * + DL-023 (UOM two-layer; product-uoms CRUD is in useProductUoms.ts).
 *
 * Exports:
 *   useProductsList(filter?)          — list products with optional filters
 *   useProduct(id)                    — fetch a single product by ID (with UOMs + categories)
 *   useCreateProduct()                — mutation; invalidates products.all
 *   useUpdateProduct()                — mutation; invalidates products.all + byId
 *   useDeactivateProduct()            — mutation (DELETE); invalidates products.all
 *   useFindSimilarProducts(name)      — enabled when name.length >= 3; staleTime: 0
 *                                       Consumer is responsible for debouncing.
 *
 * API product type enum values: 'raw' | 'semi_product' | 'final'
 * API requires `reason` on PATCH and DELETE per DL-013.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/hooks/use-api-client';
import { qk } from '@/lib/query-keys';
import {
  productsListSchema,
  productDetailSchema,
  similarProductsListSchema,
  type ProductRow,
  type ProductDetailRow,
  type ProductType,
} from './schemas';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface ProductsFilter {
  type?: ProductType;
  active?: boolean;
  /** Client-side text search; not sent to API */
  q?: string;
}

export interface CreateProductInput {
  sku: string;
  name: string;
  type: ProductType;
  defaultUomId: string;
  standardYieldFactor?: string;
  shelfLifeDays?: number;
  active?: boolean;
}

export interface UpdateProductInput {
  sku?: string;
  name?: string;
  type?: ProductType;
  defaultUomId?: string;
  standardYieldFactor?: string;
  shelfLifeDays?: number | null;
  active?: boolean;
  /** Required by API (DL-013 audit). */
  reason: string;
}

export interface DeactivateProductInput {
  /** Reason is required by the API (DL-013). Must be ≥ 10 chars per UI rule. */
  reason: string;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Fetch all products with optional server-side type and active filters. */
export function useProductsList(filter?: ProductsFilter) {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.products.list(filter ? { type: filter.type, activeOnly: filter.active } : undefined),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (filter?.type) params.set('type', filter.type);
      if (filter?.active !== undefined) params.set('active', String(filter.active));
      const qs = params.toString();
      const path = qs ? `/api/v1/products?${qs}` : '/api/v1/products';
      return client.get({ path, schema: productsListSchema, signal });
    },
  });
}

/** Fetch a single product by ID — returns product with embedded UOMs and categories. */
export function useProduct(id: string) {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.products.byId(id),
    queryFn: ({ signal }) =>
      client.get({ path: `/api/v1/products/${id}`, schema: productDetailSchema, signal }),
    enabled: Boolean(id),
  });
}

/** Create a new product. Invalidates products.all. */
export function useCreateProduct() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<ProductRow, Error, CreateProductInput>({
    mutationFn: (input) =>
      client.post({ path: '/api/v1/products', body: input, schema: productDetailSchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.products.all });
    },
  });
}

/** Update a product (all mutable fields). Requires `reason`. Invalidates list + byId. */
export function useUpdateProduct() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<ProductDetailRow, Error, { id: string } & UpdateProductInput>({
    mutationFn: ({ id, reason, ...rest }) =>
      client.patch({
        path: `/api/v1/products/${id}`,
        body: { ...rest, reason },
        schema: productDetailSchema,
      }),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: qk.products.all });
      void queryClient.invalidateQueries({ queryKey: qk.products.byId(id) });
    },
  });
}

/** Deactivate a product (soft-delete via DELETE). Requires `reason`. */
export function useDeactivateProduct() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<ProductDetailRow, Error, { id: string } & DeactivateProductInput>({
    mutationFn: ({ id, reason }) =>
      client.delete({
        path: `/api/v1/products/${id}`,
        body: { reason },
        schema: productDetailSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.products.all });
    },
  });
}

/**
 * DL-026: Fuzzy product name search via pg_trgm ≥ 0.85 similarity.
 *
 * Query is enabled only when name.length >= 3. staleTime: 0 ensures
 * every keystroke (after debounce in the consumer) hits fresh data.
 * The consumer (ProductsForm) is responsible for debouncing the name
 * value before passing it to this hook.
 *
 * @param name    The name string to search for similar products.
 * @param opts    Optional excludeId (omit from results; use when editing).
 */
export function useFindSimilarProducts(
  name: string,
  opts?: { excludeId?: string },
) {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.products.findSimilar(name),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ name });
      if (opts?.excludeId) params.set('excludeId', opts.excludeId);
      return client.get({
        path: `/api/v1/products/find-similar?${params.toString()}`,
        schema: similarProductsListSchema,
        signal,
      });
    },
    enabled: name.length >= 3,
    staleTime: 0,
  });
}

/**
 * useProductUoms — TanStack Query hooks for the /api/v1/product-uoms resource.
 *
 * DL-023 layer 2: per-product alternate UOM management.
 *
 * Exports:
 *   useProductUomsList(productId)  — list alternate UOMs for a product
 *   useAddProductUom()             — POST: add an alternate UOM to a product
 *   useRemoveProductUom()          — DELETE: remove a product UOM row
 *   useSetDefaultProductUom()      — POST /:id/set-default: make a product UOM the default
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/hooks/use-api-client';
import { qk } from '@/lib/query-keys';
import { productUomSchema, productUomsListSchema, type ProductUomRow } from './schemas';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface AddProductUomInput {
  productId: string;
  uomId: string;
  /** Positive numeric string, e.g. "0.001" */
  factorToDefaultUom: string;
  isDefault?: boolean;
}

export interface RemoveProductUomInput {
  id: string;
  reason: string;
}

export interface SetDefaultProductUomInput {
  /** The product_uoms row id to make default */
  id: string;
  productId: string;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Fetch all product UOM rows for a given product. */
export function useProductUomsList(productId: string) {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.productUoms.byProduct(productId),
    queryFn: ({ signal }) =>
      client.get({
        path: `/api/v1/product-uoms?productId=${encodeURIComponent(productId)}`,
        schema: productUomsListSchema,
        signal,
      }),
    enabled: Boolean(productId),
  });
}

/** Add an alternate UOM to a product. Invalidates the productUoms.byProduct list. */
export function useAddProductUom() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<ProductUomRow, Error, AddProductUomInput>({
    mutationFn: ({ productId, uomId, factorToDefaultUom, isDefault }) =>
      client.post({
        path: '/api/v1/product-uoms',
        body: { productId, uomId, factorToDefaultUom, isDefault },
        schema: productUomSchema,
      }),
    onSuccess: (_data, { productId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.productUoms.byProduct(productId) });
    },
  });
}

/** Remove a product UOM row (requires reason). Invalidates the byProduct list. */
export function useRemoveProductUom() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<ProductUomRow, Error, RemoveProductUomInput & { productId: string }>({
    mutationFn: ({ id, reason }) =>
      client.delete({
        path: `/api/v1/product-uoms/${id}`,
        body: { reason },
        schema: productUomSchema,
      }),
    onSuccess: (_data, { productId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.productUoms.byProduct(productId) });
    },
  });
}

/** Make a product UOM row the default. Invalidates the byProduct list. */
export function useSetDefaultProductUom() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<ProductUomRow, Error, SetDefaultProductUomInput>({
    mutationFn: ({ id, productId }) =>
      client.post({
        path: `/api/v1/product-uoms/${id}/set-default`,
        body: { productId },
        schema: productUomSchema,
      }),
    onSuccess: (_data, { productId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.productUoms.byProduct(productId) });
    },
  });
}

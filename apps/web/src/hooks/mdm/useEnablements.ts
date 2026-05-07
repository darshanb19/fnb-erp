/**
 * useEnablements — TanStack Query hooks for the /api/v1/enablements resource.
 *
 * Covers FR5 (Material Enablement Matrix — cross-cutting enablement gate) and
 * FR8 (audit-log on every cell toggle via DL-013 reason capture).
 *
 * Architecture §6.2.1: the backend's checkEnablement() memoizes within a
 * request. These frontend hooks mirror the backend surface for the UI layer.
 *
 * Exports:
 *   useEnablementsByLocation(locationId, opts?) — matrix cells for a location
 *   useEnablementCheck(productId, departmentId) — spot check for a single cell
 *   useSetEnablement()                          — single-cell UPSERT mutation
 *   useBulkSetEnablements()                     — bulk UPSERT mutation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useApiClient } from '@/hooks/use-api-client';
import { qk } from '@/lib/query-keys';
import {
  enablementCellsListSchema,
  enablementCheckSchema,
  type EnablementCell,
} from './schemas';

// Schema for 204 No Content mutations
const voidSchema = z.void();

// ---------------------------------------------------------------------------
// Re-export for consumers
// ---------------------------------------------------------------------------

export type { EnablementCell };

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface EnablementsByLocationOpts {
  categoryId?: string;
  /** Enable the query only when locationId is non-empty (default: true). */
  enabled?: boolean;
}

export interface SetEnablementInput {
  productId: string;
  departmentId: string;
  enabled: boolean;
  reason?: string;
}

export interface BulkSetEnablementPair {
  productId: string;
  departmentId: string;
  enabled: boolean;
}

export interface BulkSetEnablementInput {
  pairs: BulkSetEnablementPair[];
  reason?: string;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all enablement cells for a location. Each row covers one
 * (active product × department-at-location) pair. Absent matrix rows are
 * returned with enabled=false (default-deny from the API).
 *
 * Optional categoryId filter narrows to products in that category.
 * Query is disabled until locationId is non-empty.
 */
export function useEnablementsByLocation(
  locationId: string,
  opts?: EnablementsByLocationOpts,
) {
  const client = useApiClient();
  const queryEnabled = Boolean(locationId) && (opts?.enabled !== false);

  return useQuery({
    queryKey: qk.enablements.byLocation(locationId, opts?.categoryId ? { categoryId: opts.categoryId } : undefined),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (opts?.categoryId) params.set('categoryId', opts.categoryId);
      const qs = params.toString();
      const path = qs
        ? `/api/v1/enablements/by-location/${locationId}?${qs}`
        : `/api/v1/enablements/by-location/${locationId}`;
      return client.get({ path, schema: enablementCellsListSchema, signal });
    },
    enabled: queryEnabled,
  });
}

/**
 * Spot-check a single (product, department) pair.
 * Matches qk.enablements.check — for use in stock-movement gates.
 */
export function useEnablementCheck(productId: string, departmentId: string) {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.enablements.check(productId, departmentId),
    queryFn: ({ signal }) =>
      client.post({
        path: '/api/v1/enablements/check',
        body: { productId, departmentId },
        schema: enablementCheckSchema,
        signal,
      }),
    enabled: Boolean(productId) && Boolean(departmentId),
  });
}

/**
 * Upsert a single (product, department, enabled) cell.
 * Reason is optional but recorded in the audit log (DL-013).
 * Invalidates the byLocation key for the affected location on success.
 *
 * The caller must supply locationId so the correct cache entry is invalidated.
 */
export function useSetEnablement(locationId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<void, Error, SetEnablementInput>({
    mutationFn: ({ productId, departmentId, enabled, reason }) =>
      client.post({
        path: '/api/v1/enablements/set',
        body: { productId, departmentId, enabled, ...(reason ? { reason } : {}) },
        schema: voidSchema,
      }),
    onSuccess: (_data, { productId, departmentId }) => {
      // Invalidate the matrix for this location (all category filter variants)
      void queryClient.invalidateQueries({
        queryKey: qk.enablements.byLocation(locationId),
        exact: false,
      });
      // Also invalidate any spot-check caches for this cell
      void queryClient.invalidateQueries({
        queryKey: qk.enablements.check(productId, departmentId),
      });
    },
  });
}

/**
 * Bulk-upsert multiple (product, department, enabled) cells in one API call.
 * Reason applies to all pairs in the batch.
 * Invalidates the byLocation key on success.
 */
export function useBulkSetEnablements(locationId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<void, Error, BulkSetEnablementInput>({
    mutationFn: ({ pairs, reason }) =>
      client.post({
        path: '/api/v1/enablements/bulk-set',
        body: { pairs, ...(reason ? { reason } : {}) },
        schema: voidSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: qk.enablements.byLocation(locationId),
        exact: false,
      });
    },
  });
}

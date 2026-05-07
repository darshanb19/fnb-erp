/**
 * useClusters — TanStack Query hooks for the /api/v1/clusters resource.
 *
 * Exports:
 *   useClustersList()      — list all clusters for the authenticated brand
 *   useCluster(id)         — fetch a single cluster by ID
 *   useCreateCluster()     — mutation; invalidates qk.clusters.all on success
 *   useUpdateCluster()     — mutation; invalidates qk.clusters.all + qk.clusters.byId
 *   useDeactivateCluster() — mutation (DELETE /clusters/:id); invalidates qk.clusters.all
 *
 * All mutations require a `reason` string (DL-013 audit obligation — enforced
 * at apps/api route level; minimum 3 chars).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/hooks/use-api-client';
import { qk } from '@/lib/query-keys';
import {
  clusterSchema,
  clustersListSchema,
  type ClusterRow,
} from './schemas';

// ---------------------------------------------------------------------------
// Input types (mirroring apps/api createSchema / updateSchema)
// ---------------------------------------------------------------------------

export interface CreateClusterInput {
  name: string;
  contactPerson?: string;
  contactPhone?: string;
  address?: string;
}

export interface UpdateClusterInput {
  name?: string;
  contactPerson?: string;
  contactPhone?: string;
  address?: string;
  /** Reason is required by the API (DL-013). */
  reason: string;
}

export interface DeactivateClusterInput {
  /** Reason is required by the API (DL-013). */
  reason: string;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Fetch all clusters for the authenticated brand. */
export function useClustersList() {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.clusters.list(),
    queryFn: ({ signal }) =>
      client.get({ path: '/api/v1/clusters', schema: clustersListSchema, signal }),
  });
}

/** Fetch a single cluster by ID. */
export function useCluster(id: string) {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.clusters.byId(id),
    queryFn: ({ signal }) =>
      client.get({ path: `/api/v1/clusters/${id}`, schema: clusterSchema, signal }),
    enabled: Boolean(id),
  });
}

/** Create a new cluster. Invalidates the full clusters list on success. */
export function useCreateCluster() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<ClusterRow, Error, CreateClusterInput>({
    mutationFn: (input) =>
      client.post({ path: '/api/v1/clusters', body: input, schema: clusterSchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.clusters.all });
    },
  });
}

/** Update a cluster (rename, address, contact). Requires `reason`. */
export function useUpdateCluster() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<ClusterRow, Error, { id: string } & UpdateClusterInput>({
    mutationFn: ({ id, reason, ...rest }) =>
      client.patch({
        path: `/api/v1/clusters/${id}`,
        body: { ...rest, reason },
        schema: clusterSchema,
      }),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: qk.clusters.all });
      void queryClient.invalidateQueries({ queryKey: qk.clusters.byId(id) });
    },
  });
}

/** Deactivate a cluster (soft-delete via DELETE). Requires `reason`. */
export function useDeactivateCluster() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<ClusterRow, Error, { id: string } & DeactivateClusterInput>({
    mutationFn: ({ id, reason }) =>
      client.delete({
        path: `/api/v1/clusters/${id}`,
        body: { reason },
        schema: clusterSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.clusters.all });
    },
  });
}

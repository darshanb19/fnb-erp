/**
 * useLocations — TanStack Query hooks for the /api/v1/locations resource.
 *
 * Exports:
 *   useLocationsList(filter?) — list locations, optionally filtered by clusterId
 *   useLocation(id)           — fetch a single location by ID
 *   useCreateLocation()       — mutation; invalidates qk.locations.all
 *   useUpdateLocation()       — mutation; invalidates qk.locations.all + qk.locations.byId
 *   useDeactivateLocation()   — mutation (DELETE); invalidates qk.locations.all
 *
 * DL-022: clusterId is IMMUTABLE after creation. UpdateLocationInput intentionally
 * excludes clusterId — passing it would be a no-op at the route layer (the route
 * strips it) and a thrown error at the service layer.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/hooks/use-api-client';
import { qk } from '@/lib/query-keys';
import {
  locationSchema,
  locationsListSchema,
  type LocationRow,
  type LocationType,
} from './schemas';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateLocationInput {
  clusterId: string;
  name: string;
  type: LocationType;
  address?: string;
  contactPerson?: string;
  contactPhone?: string;
}

export interface UpdateLocationInput {
  name?: string;
  type?: LocationType;
  address?: string;
  contactPerson?: string;
  contactPhone?: string;
  active?: boolean;
  /** Reason is required by the API (DL-013). */
  reason: string;
}

export interface DeactivateLocationInput {
  /** Reason is required by the API (DL-013). */
  reason: string;
}

export interface LocationsFilter {
  clusterId?: string;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Fetch all locations, optionally filtered by clusterId. */
export function useLocationsList(filter?: LocationsFilter) {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.locations.list(filter),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (filter?.clusterId) params.set('clusterId', filter.clusterId);
      const qs = params.toString();
      const path = qs ? `/api/v1/locations?${qs}` : '/api/v1/locations';
      return client.get({ path, schema: locationsListSchema, signal });
    },
  });
}

/** Fetch a single location by ID. */
export function useLocation(id: string) {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.locations.byId(id),
    queryFn: ({ signal }) =>
      client.get({ path: `/api/v1/locations/${id}`, schema: locationSchema, signal }),
    enabled: Boolean(id),
  });
}

/** Create a new location under a cluster. Invalidates the full locations list. */
export function useCreateLocation() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<LocationRow, Error, CreateLocationInput>({
    mutationFn: (input) =>
      client.post({ path: '/api/v1/locations', body: input, schema: locationSchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.locations.all });
    },
  });
}

/**
 * Update a location (rename, type, address, contact).
 * DL-022: Do NOT pass clusterId — it will be rejected by the service layer.
 */
export function useUpdateLocation() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<LocationRow, Error, { id: string } & UpdateLocationInput>({
    mutationFn: ({ id, reason, ...rest }) =>
      client.patch({
        path: `/api/v1/locations/${id}`,
        body: { ...rest, reason },
        schema: locationSchema,
      }),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: qk.locations.all });
      void queryClient.invalidateQueries({ queryKey: qk.locations.byId(id) });
    },
  });
}

/** Deactivate a location (soft-delete via DELETE). Requires `reason`. */
export function useDeactivateLocation() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<LocationRow, Error, { id: string } & DeactivateLocationInput>({
    mutationFn: ({ id, reason }) =>
      client.delete({
        path: `/api/v1/locations/${id}`,
        body: { reason },
        schema: locationSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.locations.all });
    },
  });
}

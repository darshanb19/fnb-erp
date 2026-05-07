/**
 * useDepartments — TanStack Query hooks for the /api/v1/departments resource.
 *
 * Exports:
 *   useDepartmentsList(filter?) — list departments, filtered by locationId and/or type
 *   useDepartment(id)           — fetch a single department by ID
 *   useCreateDepartment()       — mutation; invalidates qk.departments.all
 *   useUpdateDepartment()       — mutation; invalidates qk.departments.all + byId
 *   useDeactivateDepartment()   — mutation (DELETE); invalidates qk.departments.all
 *
 * DL-022: locationId is IMMUTABLE after creation. UpdateDepartmentInput intentionally
 * excludes locationId.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/hooks/use-api-client';
import { qk } from '@/lib/query-keys';
import {
  departmentSchema,
  departmentsListSchema,
  type DepartmentRow,
  type DepartmentType,
} from './schemas';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateDepartmentInput {
  locationId: string;
  name: string;
  type: DepartmentType;
}

export interface UpdateDepartmentInput {
  name?: string;
  type?: DepartmentType;
  active?: boolean;
  /** Reason is required by the API (DL-013). */
  reason: string;
}

export interface DeactivateDepartmentInput {
  /** Reason is required by the API (DL-013). */
  reason: string;
}

export interface DepartmentsFilter {
  locationId?: string;
  type?: DepartmentType;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Fetch all departments, optionally filtered by locationId and/or type. */
export function useDepartmentsList(filter?: DepartmentsFilter) {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.departments.list(filter),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (filter?.locationId) params.set('locationId', filter.locationId);
      if (filter?.type) params.set('type', filter.type);
      const qs = params.toString();
      const path = qs ? `/api/v1/departments?${qs}` : '/api/v1/departments';
      return client.get({ path, schema: departmentsListSchema, signal });
    },
  });
}

/** Fetch a single department by ID. */
export function useDepartment(id: string) {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.departments.byId(id),
    queryFn: ({ signal }) =>
      client.get({ path: `/api/v1/departments/${id}`, schema: departmentSchema, signal }),
    enabled: Boolean(id),
  });
}

/** Create a new department under a location. Invalidates the full departments list. */
export function useCreateDepartment() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<DepartmentRow, Error, CreateDepartmentInput>({
    mutationFn: (input) =>
      client.post({ path: '/api/v1/departments', body: input, schema: departmentSchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.departments.all });
    },
  });
}

/**
 * Update a department (rename, type change).
 * DL-022: Do NOT pass locationId — it will be rejected by the service layer.
 */
export function useUpdateDepartment() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<DepartmentRow, Error, { id: string } & UpdateDepartmentInput>({
    mutationFn: ({ id, reason, ...rest }) =>
      client.patch({
        path: `/api/v1/departments/${id}`,
        body: { ...rest, reason },
        schema: departmentSchema,
      }),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: qk.departments.all });
      void queryClient.invalidateQueries({ queryKey: qk.departments.byId(id) });
    },
  });
}

/** Deactivate a department (soft-delete via DELETE). Requires `reason`. */
export function useDeactivateDepartment() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<DepartmentRow, Error, { id: string } & DeactivateDepartmentInput>({
    mutationFn: ({ id, reason }) =>
      client.delete({
        path: `/api/v1/departments/${id}`,
        body: { reason },
        schema: departmentSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.departments.all });
    },
  });
}

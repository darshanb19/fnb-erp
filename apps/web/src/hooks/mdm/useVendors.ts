/**
 * useVendors — TanStack Query hooks for the /api/v1/vendors resource.
 *
 * Covers FR6 (vendor CRUD) + Master Spec §2.7 (scope mutation)
 * + DL-026 (find-similar for CC-DUPLICATE-WARN).
 *
 * Exports:
 *   useVendorsList(filter?)           — list vendors with optional active/q filters
 *   useVendor(id)                     — fetch a single vendor by ID
 *   useCreateVendor()                 — mutation; invalidates vendors.all
 *   useUpdateVendor()                 — mutation; invalidates vendors.all + byId
 *   useDeactivateVendor()             — mutation (DELETE); invalidates vendors.all
 *   useFindSimilarVendors(name, opts) — enabled when name.length >= 3; staleTime: 0
 *   useMutateVendorScope()            — POST /vendors/:id/scope; invalidates all + byId
 *
 * Scope mutation (§2.7):
 *   - Widening (pos→cluster, pos→brand, cluster→brand): unconditional with reason.
 *   - Narrowing (brand→cluster, brand→pos, cluster→pos): blocked if open txns at dropped locs.
 *   - Lateral (same tier, different ref): always rejected by API.
 *   Error codes from server:
 *     vendor.scope_lateral_not_supported  — lateral change rejected
 *     vendor.scope_narrowing_blocked      — narrowing blocked by open transactions
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/hooks/use-api-client';
import { qk } from '@/lib/query-keys';
import {
  vendorsListSchema,
  vendorSchema,
  similarVendorsListSchema,
  type VendorRow,
  type VendorScope,
  type VendorPaymentMode,
} from './schemas';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface VendorsFilter {
  activeOnly?: boolean;
  /** Client-side text search; not sent to API */
  q?: string;
}

export interface CreateVendorInput {
  code: string;
  name: string;
  scope: VendorScope;
  scopeClusterId?: string | null;
  scopeLocationId?: string | null;
  gstin?: string | null;
  pan?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  state?: string | null;
  creditTermsDays?: number | null;
  paymentMode?: VendorPaymentMode | null;
  preferred?: boolean;
  qualityRating?: string | null;
  active?: boolean;
}

export interface UpdateVendorInput {
  /** Required by API audit (DL-013). */
  reason: string;
  name?: string;
  gstin?: string | null;
  pan?: string | null;
  contactPerson?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  street?: string | null;
  city?: string | null;
  postalCode?: string | null;
  state?: string | null;
  creditTermsDays?: number | null;
  paymentMode?: VendorPaymentMode | null;
  preferred?: boolean;
  qualityRating?: string | null;
  active?: boolean;
}

export interface DeactivateVendorInput {
  /** Reason is required by the API (DL-013). Must be ≥ 10 chars per UI rule. */
  reason: string;
}

/** §2.7 scope mutation payload. */
export interface MutateVendorScopeInput {
  scope: VendorScope;
  clusterId?: string;
  locationId?: string;
  /** Mandatory reason ≥ 10 chars per UI rule (≥ 3 chars per API validation). */
  reason: string;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/** Fetch all vendors for the caller's brand with optional active filter. */
export function useVendorsList(filter?: VendorsFilter) {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.vendors.list(filter ? { activeOnly: filter.activeOnly, q: filter.q } : undefined),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (filter?.activeOnly) params.set('active', 'true');
      const qs = params.toString();
      const path = qs ? `/api/v1/vendors?${qs}` : '/api/v1/vendors';
      return client.get({ path, schema: vendorsListSchema, signal });
    },
  });
}

/** Fetch a single vendor by ID. */
export function useVendor(id: string) {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.vendors.byId(id),
    queryFn: ({ signal }) =>
      client.get({ path: `/api/v1/vendors/${id}`, schema: vendorSchema, signal }),
    enabled: Boolean(id),
  });
}

/** Create a new vendor. Invalidates vendors.all. */
export function useCreateVendor() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<VendorRow, Error, CreateVendorInput>({
    mutationFn: (input) =>
      client.post({ path: '/api/v1/vendors', body: input, schema: vendorSchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.vendors.all });
    },
  });
}

/** Update a vendor (all mutable fields except scope). Requires `reason`. Invalidates list + byId. */
export function useUpdateVendor() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<VendorRow, Error, { id: string } & UpdateVendorInput>({
    mutationFn: ({ id, reason, ...rest }) =>
      client.patch({
        path: `/api/v1/vendors/${id}`,
        body: { ...rest, reason },
        schema: vendorSchema,
      }),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: qk.vendors.all });
      void queryClient.invalidateQueries({ queryKey: qk.vendors.byId(id) });
    },
  });
}

/** Deactivate a vendor (soft-delete via DELETE). Requires `reason`. */
export function useDeactivateVendor() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<VendorRow, Error, { id: string } & DeactivateVendorInput>({
    mutationFn: ({ id, reason }) =>
      client.delete({
        path: `/api/v1/vendors/${id}`,
        body: { reason },
        schema: vendorSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.vendors.all });
    },
  });
}

/**
 * DL-026: Fuzzy vendor name search via pg_trgm ≥ 0.85 similarity.
 *
 * Query is enabled only when name.length >= 3. staleTime: 0 ensures
 * every keystroke (after debounce in the consumer) hits fresh data.
 * The consumer (VendorsForm) is responsible for debouncing the name
 * value before passing it to this hook.
 */
export function useFindSimilarVendors(
  name: string,
  opts?: { excludeId?: string },
) {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.vendors.findSimilar(name),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ name });
      if (opts?.excludeId) params.set('excludeId', opts.excludeId);
      return client.get({
        path: `/api/v1/vendors/find-similar?${params.toString()}`,
        schema: similarVendorsListSchema,
        signal,
      });
    },
    enabled: name.length >= 3,
    staleTime: 0,
  });
}

/**
 * §2.7 Vendor scope mutation — POST /vendors/:id/scope.
 *
 * Invalidates vendors.all + byId on success.
 * On failure, the server returns a typed error code — callers
 * should check error.code to differentiate:
 *   vendor.scope_lateral_not_supported  — lateral change rejected
 *   vendor.scope_narrowing_blocked      — narrowing blocked by open POs
 */
export function useMutateVendorScope() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<VendorRow, Error, { id: string } & MutateVendorScopeInput>({
    mutationFn: ({ id, scope, clusterId, locationId, reason }) =>
      client.post({
        path: `/api/v1/vendors/${id}/scope`,
        body: { scope, clusterId, locationId, reason },
        schema: vendorSchema,
      }),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: qk.vendors.all });
      void queryClient.invalidateQueries({ queryKey: qk.vendors.byId(id) });
    },
  });
}

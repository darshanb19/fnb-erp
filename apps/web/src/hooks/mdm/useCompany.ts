/**
 * useCompany — TanStack Query hooks for the /api/v1/company resource.
 *
 * FR9: brand identity, addresses, tax IDs, banking, fiscal year.
 * DL-024: single brand row per deployment; edit-only (no createCompany).
 *         Status is a one-way gate: setup_pending → setup_complete only.
 *
 * Exports:
 *   useCompanyRead()          — GET /api/v1/company (single-row, always resolves)
 *   useUpdateCompany()        — PATCH /api/v1/company; requires reason (DL-013 audit)
 *   useMarkSetupComplete()    — POST /api/v1/company/mark-setup-complete; one-way (DL-024)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/hooks/use-api-client';
import { qk } from '@/lib/query-keys';
import {
  companySchema,
  type CompanyRow,
  type UpdateCompanyInput,
} from './schemas';

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch the single brand row for the authenticated user's brand.
 * Always returns one row (the seeded brand) or throws if brand-seed
 * was never run.
 */
export function useCompanyRead() {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.company.read(),
    queryFn: ({ signal }) =>
      client.get({ path: '/api/v1/company', schema: companySchema, signal }),
  });
}

/**
 * Mutation: update FR9 fields on the brand row.
 *
 * Requires `reason` (DL-013 audit obligation; ≥ 10 chars enforced at UI
 * level; ≥ 3 chars enforced at API level).
 *
 * Does NOT accept `status` — DL-024 one-way gate; use useMarkSetupComplete
 * for the pending → complete transition.
 *
 * Invalidates qk.company.read() on success.
 */
export function useUpdateCompany() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<CompanyRow, Error, UpdateCompanyInput & { reason: string }>({
    mutationFn: ({ reason, ...rest }) =>
      client.patch({
        path: '/api/v1/company',
        body: { ...rest, reason },
        schema: companySchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.company.read() });
    },
  });
}

/**
 * Mutation: DL-024 one-way status transition (setup_pending → setup_complete).
 *
 * Idempotent — calling on an already-complete brand is a no-op but still
 * writes an audit row. Requires `reason` (≥ 10 chars at UI; ≥ 3 at API).
 *
 * After success the status pill replaces the "Mark setup complete" CTA.
 * Invalidates qk.company.read() so the page re-renders with the new status.
 */
export function useMarkSetupComplete() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<CompanyRow, Error, { reason: string }>({
    mutationFn: ({ reason }) =>
      client.post({
        path: '/api/v1/company/mark-setup-complete',
        body: { reason },
        schema: companySchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.company.read() });
    },
  });
}

/**
 * usePermissions — TanStack Query hook for the global /api/v1/permissions catalog.
 *
 * Phase 4 Epic 2 USR Arc (c), Task C5. Consumers:
 *   SI-USR-005 EffectivePermissionsPage  — renders one row per catalog entry,
 *                                           tagged with the row's resolved source.
 *   SI-USR-006 PermissionOverridePage    — drives the permission selector.
 *
 * The catalog is GLOBAL (single permissions table — no brand_id) and effectively
 * static at runtime: every brand sees the same ~18 keys today, and growth is
 * code-driven (DL-032 — incremental seed per epic). Cached `staleTime: Infinity`
 * so the picker doesn't re-fetch on every form mount.
 *
 * The shape mirrors the apps/api `PermissionDef` interface (module, action,
 * scope, key, description) plus the row's UUID `id` and `createdAt` from the
 * permissions table — both surfaced because the override mutation API takes
 * `permissionId`, not `key`.
 */

import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { useApiClient } from '@/hooks/use-api-client';
import { qk } from '@/lib/query-keys';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const permissionSchema = z.object({
  id: z.string().uuid(),
  module: z.string(),
  action: z.string(),
  scope: z.string(),
  key: z.string(),
  description: z.string(),
  createdAt: z.string(),
});

export type PermissionRow = z.infer<typeof permissionSchema>;

const permissionsListSchema = z.array(permissionSchema);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/** Fetch the full permissions catalog (~18 entries today; grows per DL-032). */
export function usePermissions() {
  const client = useApiClient();
  return useQuery({
    queryKey: qk.permissions.list(),
    queryFn: ({ signal }) =>
      client.get({ path: '/api/v1/permissions', schema: permissionsListSchema, signal }),
    staleTime: Infinity, // Catalog is static at runtime.
  });
}

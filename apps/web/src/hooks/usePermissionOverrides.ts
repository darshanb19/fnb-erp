/**
 * usePermissionOverrides — TanStack Query hooks for per-user permission overrides.
 *
 * Phase 4 Epic 2 USR Arc (c), Task C5. Consumers:
 *   SI-USR-005 EffectivePermissionsPage  — useUserOverrides(userId) provides
 *                                           the source-resolution map (which
 *                                           keys are baseline vs grant vs revoke).
 *   SI-USR-006 PermissionOverridePage    — useGrantOverride / useEditOverride
 *                                           (plus useRevokeOverrideEntirely for
 *                                           "delete the override row" — a
 *                                           separate operation from creating a
 *                                           revoke-mode override).
 *
 * Schema mirrors apps/api/src/db/schema/user-permission-overrides.ts. The mode
 * enum is mirrored as a const tuple per the same pattern used in useUsers.ts
 * (Zod's z.enum needs a non-empty literal tuple).
 *
 * Cache invalidation pattern (FR15b — effective set must reflect mutations
 * immediately): every mutation invalidates BOTH the per-user override list
 * AND the per-user effective-permissions key, so post-success the table on
 * SI-USR-005 reflects the change without a manual refresh.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useApiClient } from '@/hooks/use-api-client';
import { qk } from '@/lib/query-keys';

// ---------------------------------------------------------------------------
// Mode enum (mirror of apps/api overrideModeEnum)
// ---------------------------------------------------------------------------

export const overrideModeValues = ['grant', 'revoke'] as const;
export type OverrideMode = (typeof overrideModeValues)[number];

// ---------------------------------------------------------------------------
// Override row schema (mirror of UserPermissionOverride)
// ---------------------------------------------------------------------------

export const overrideSchema = z.object({
  id: z.string().uuid(),
  brandId: z.string().uuid(),
  userId: z.string().uuid(),
  permissionId: z.string().uuid(),
  mode: z.enum(overrideModeValues),
  reasonCode: z.string(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
});

export type OverrideRow = z.infer<typeof overrideSchema>;

const overrideListSchema = z.array(overrideSchema);

// ---------------------------------------------------------------------------
// Mutation input shapes (mirror of permissionOverrideGrantSchema /
// permissionOverrideEditSchema in @fnberp/shared — re-mirrored locally to
// avoid pulling the package into apps/web; see C4 implementer note).
// ---------------------------------------------------------------------------

export interface PermissionOverrideGrantInput {
  permissionId: string;
  mode: OverrideMode;
  /** Mandatory per FR15a / FR15c — min 3 chars at the API; ≥10 enforced UI-side. */
  reasonCode: string;
  /** ISO YYYY-MM-DD or full ISO datetime. Empty/undefined = permanent. */
  expiresAt?: string;
}

export interface PermissionOverrideEditInput {
  reasonCode?: string;
  /** Pass `null` to clear (make permanent), `undefined` to leave unchanged. */
  expiresAt?: string | null;
}

// ---------------------------------------------------------------------------
// Query hook
// ---------------------------------------------------------------------------

/** List all permission overrides for the given user. Brand-scoped server-side. */
export function useUserOverrides(userId: string | undefined) {
  const client = useApiClient();
  return useQuery({
    queryKey: userId ? qk.users.overrides(userId) : ['users', 'overrides', null],
    queryFn: ({ signal }) => {
      if (!userId) throw new Error('useUserOverrides called without userId');
      return client.get({
        path: `/api/v1/users/${userId}/permission-overrides`,
        schema: overrideListSchema,
        signal,
      });
    },
    enabled: Boolean(userId),
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

/** Create a grant or revoke override. */
export function useGrantOverride() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<
    OverrideRow,
    Error,
    { userId: string; input: PermissionOverrideGrantInput }
  >({
    mutationFn: ({ userId, input }) =>
      client.post({
        path: `/api/v1/users/${userId}/permission-overrides`,
        body: input,
        schema: overrideSchema,
      }),
    onSuccess: (_data, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.users.overrides(userId) });
      void queryClient.invalidateQueries({
        queryKey: qk.users.effectivePermissions(userId),
      });
    },
  });
}

/** Edit an existing override (reasonCode and/or expiresAt). */
export function useEditOverride() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<
    OverrideRow,
    Error,
    { userId: string; overrideId: string; input: PermissionOverrideEditInput }
  >({
    mutationFn: ({ userId, overrideId, input }) =>
      client.patch({
        path: `/api/v1/users/${userId}/permission-overrides/${overrideId}`,
        body: input,
        schema: overrideSchema,
      }),
    onSuccess: (_data, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.users.overrides(userId) });
      void queryClient.invalidateQueries({
        queryKey: qk.users.effectivePermissions(userId),
      });
    },
  });
}

/**
 * Delete (immediately expire) an override. Distinct from creating a revoke-mode
 * override — this removes the override row entirely, restoring the user to the
 * pure role baseline for that permission key.
 */
export function useRevokeOverrideEntirely() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation<void, Error, { userId: string; overrideId: string }>({
    mutationFn: ({ userId, overrideId }) =>
      client.delete({
        path: `/api/v1/users/${userId}/permission-overrides/${overrideId}`,
        schema: z.void(),
      }),
    onSuccess: (_data, { userId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.users.overrides(userId) });
      void queryClient.invalidateQueries({
        queryKey: qk.users.effectivePermissions(userId),
      });
    },
  });
}

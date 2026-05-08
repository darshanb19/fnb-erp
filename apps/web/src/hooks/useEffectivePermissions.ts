/**
 * useEffectivePermissions — fetch the effective permission keys for a user.
 *
 * Backed by GET /users/:id/effective-permissions. Returns the array of
 * permission keys (`mdm.products.write`, etc.) that the user can exercise
 * = role baseline ∪ active grant-overrides − active revoke-overrides.
 *
 * Pre-added in C2 so <RequirePermission> has something to consume from C3
 * onwards. C5 (the override authoring page) will add the mutation siblings.
 *
 * API response shape: string[] (bare JSON array of permission key strings).
 * The route handler does `res.json(permissions)` where `permissions` is the
 * direct output of permissionService.getEffectivePermissions → string[].
 */

import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { qk } from '@/lib/query-keys';
import { useApiClient } from './use-api-client';

const EffectivePermissionsSchema = z.array(z.string());

export function useEffectivePermissions(userId: string | undefined) {
  const client = useApiClient();
  return useQuery({
    queryKey: userId
      ? qk.users.effectivePermissions(userId)
      : ['users', 'effectivePermissions', null],
    queryFn: async () => {
      if (!userId) throw new Error('userId is required');
      return client.get({
        path: `/api/v1/users/${userId}/effective-permissions`,
        schema: EffectivePermissionsSchema,
      });
    },
    enabled: Boolean(userId),
    staleTime: 60_000, // 1 minute — overrides don't change often
  });
}

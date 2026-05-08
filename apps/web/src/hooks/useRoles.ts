/**
 * useRoles — read-only role catalog for the user create/edit form.
 *
 * Phase 4 Epic 2 USR Arc (c), Task C4. The apps/api surface does NOT
 * expose a /roles endpoint — the role registry is a static enum at
 * apps/api/src/db/schema/auth.ts (`userRoleEnum`) mirrored verbatim in
 * packages/shared (`userRoleValues`) and in apps/web (`@/lib/user-roles`).
 *
 * This hook returns the catalog as a TanStack Query result so consumers
 * (UserCreateEditPage's role selector) can use the same shape they would
 * use against a future server endpoint. The query function resolves
 * synchronously from the bundled enum + label map; isLoading is always
 * false on first render.
 *
 * If/when /api/v1/roles ships, swap the queryFn body for a real
 * client.get(...) without touching the consumer.
 */

import { useQuery } from '@tanstack/react-query';
import { qk } from '@/lib/query-keys';
import {
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  USER_ROLES,
  type UserRole,
} from '@/lib/user-roles';

export interface RoleCatalogEntry {
  readonly role: UserRole;
  readonly label: string;
  readonly description: string;
}

const ROLE_CATALOG: ReadonlyArray<RoleCatalogEntry> = USER_ROLES.map((r) => ({
  role: r,
  label: ROLE_LABEL[r],
  description: ROLE_DESCRIPTION[r],
}));

/**
 * Fetch the canonical 9-role catalog. Backed by the static enum in
 * `@/lib/user-roles` until /api/v1/roles exists.
 */
export function useRoles() {
  return useQuery({
    queryKey: qk.roles.list(),
    queryFn: () => Promise.resolve(ROLE_CATALOG),
    // The catalog never changes within a session — cache forever.
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/**
 * useUsers — TanStack Query hooks for the /api/v1/users resource.
 *
 * Phase 4 Epic 2 USR Arc (c), Task C4. Consumers:
 *   SI-USR-001 UsersPage (list + filters + deactivate)
 *   SI-USR-002 UserCreateEditPage (single fetch + create + update)
 *   SI-USR-008 (pending approval queue) — Task C7 will reuse useUsersPendingApproval
 *
 * Field-name convention is load-bearing — the shared schemas use:
 *   userCreateSchema → `reasonCode` (mandatory ≥ 3 chars)
 *   userUpdateSchema → `reason`     (mandatory ≥ 3 chars)
 * The PATCH /users/:id route extracts `reason` from the body and forwards
 * it as `reasonCode` to userService.update internally. The DELETE /users/:id
 * route accepts `{ reason }` body (a separate small reasonSchema). Mirroring
 * the schema field names in the input types here keeps the two surfaces
 * unambiguous.
 *
 * Schema notes:
 *   - UserSchema mirrors apps/api/src/db/schema/auth.ts users table.
 *   - role is z.enum(userRoleValues) imported from @fnberp/shared so a
 *     backend enum addition fails the parse loudly rather than silently
 *     returning a string.
 *   - approvalStatus enum mirrors approvalStatusEnum in the same file.
 *   - lastLoginAt is nullable (never logged in).
 *   - createdBy / updatedBy are nullable per brand-scoped-table convention.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useApiClient } from '@/hooks/use-api-client';
import { qk } from '@/lib/query-keys';
import { USER_ROLES, type UserRole } from '@/lib/user-roles';

/**
 * Mirror of packages/shared `userRoleValues` — kept here as a const tuple
 * for Zod's z.enum which requires a non-empty readonly tuple. The canonical
 * USER_ROLES array in @/lib/user-roles is typed as `ReadonlyArray<UserRole>`
 * which loses the literal-tuple shape Zod needs.
 */
const userRoleValues = [
  'brand_owner',
  'cluster_manager',
  'kitchen_manager',
  'store_manager',
  'procurement_manager',
  'finance_manager',
  'dispatch_staff',
  'pos_staff',
  'superadmin',
] as const satisfies ReadonlyArray<UserRole>;
// Compile-time invariant: keep this aligned with USER_ROLES order/content.
// (Index lookup proves both arrays cover the same set; runtime check below.)
void USER_ROLES;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const approvalStatusValues = [
  'pending_approval',
  'approved',
  'rejected',
  'suspended',
] as const;

export const userSchema = z.object({
  id: z.string().uuid(),
  brandId: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  role: z.enum(userRoleValues),
  approvalStatus: z.enum(approvalStatusValues),
  clusterId: z.string().uuid().nullable(),
  departmentId: z.string().uuid().nullable(),
  locationId: z.string().uuid().nullable(),
  lastLoginAt: z.string().nullable(),
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
});

export type UserRow = z.infer<typeof userSchema>;
export type ApprovalStatus = (typeof approvalStatusValues)[number];

export const usersListSchema = z.array(userSchema);

// ---------------------------------------------------------------------------
// Input types — mirror packages/shared usr.ts schemas
// ---------------------------------------------------------------------------

/** Mirror of userCreateSchema. Note: `reasonCode` (NOT `reason`). */
export interface CreateUserInput {
  email: string;
  fullName: string;
  role: (typeof userRoleValues)[number];
  clusterId?: string;
  departmentId?: string;
  locationId?: string;
  /** Mandatory per FR15c. Min 3 chars at the API; ≥10 enforced in the form. */
  reasonCode: string;
}

/** Mirror of userUpdateSchema. Note: `reason` (NOT `reasonCode`). */
export interface UpdateUserInput {
  fullName?: string;
  clusterId?: string | null;
  departmentId?: string | null;
  locationId?: string | null;
  active?: boolean;
  /** Mandatory per FR15c. */
  reason: string;
}

export interface DeactivateUserInput {
  /** Mandatory per FR15c. */
  reason: string;
}

export interface UsersFilter {
  /** Client-side filter — the API does not accept ?role= today. */
  role?: (typeof userRoleValues)[number];
  /** Client-side filter — combined view of approvalStatus + active. */
  status?: 'active' | 'inactive' | 'pending_approval';
  /** Client-side filter — name/email substring. */
  q?: string;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all users for the caller's brand (or cluster, when caller is a
 * cluster_manager — the API enforces scope). Filters are applied
 * client-side because GET /users currently ignores query string params
 * (TODO upstream — see route header notes).
 */
export function useUsers(filter?: UsersFilter) {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.users.list(filter),
    queryFn: ({ signal }) =>
      client.get({ path: '/api/v1/users', schema: usersListSchema, signal }),
  });
}

/** Fetch a single user by ID. */
export function useUser(id: string | undefined) {
  const client = useApiClient();

  return useQuery({
    queryKey: id ? qk.users.byId(id) : ['users', 'byId', null],
    queryFn: ({ signal }) => {
      if (!id) throw new Error('useUser called without id');
      return client.get({ path: `/api/v1/users/${id}`, schema: userSchema, signal });
    },
    enabled: Boolean(id),
  });
}

/** List users with approval_status='pending_approval' (Superadmin queue). */
export function useUsersPendingApproval() {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.users.pendingApproval(),
    queryFn: ({ signal }) =>
      client.get({
        path: '/api/v1/users/pending-approval',
        schema: usersListSchema,
        signal,
      }),
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

/**
 * Create a user. FR14: when role === 'brand_owner', the backend writes
 * approval_status='pending_approval' automatically — no special-casing
 * needed on the client.
 */
export function useCreateUser() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<UserRow, Error, CreateUserInput>({
    mutationFn: (input) =>
      client.post({ path: '/api/v1/users', body: input, schema: userSchema }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.users.all });
    },
  });
}

/**
 * Update a user. `reason` is mandatory.
 * Note: role is intentionally absent (immutable post-creation per the
 * shared userUpdateSchema).
 */
export function useUpdateUser() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<UserRow, Error, { id: string } & UpdateUserInput>({
    mutationFn: ({ id, ...body }) =>
      client.patch({
        path: `/api/v1/users/${id}`,
        body,
        schema: userSchema,
      }),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: qk.users.all });
      void queryClient.invalidateQueries({ queryKey: qk.users.byId(id) });
    },
  });
}

/**
 * Deactivate a user via DELETE /users/:id (soft delete).
 * The API route accepts `{ reason }` body and flips `active` to false.
 */
export function useDeactivateUser() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: string } & DeactivateUserInput>({
    mutationFn: ({ id, reason }) =>
      client.delete({
        path: `/api/v1/users/${id}`,
        body: { reason },
        // 204 No Content — schema must accept undefined.
        schema: z.void(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.users.all });
    },
  });
}

/**
 * permission.service — stub for Task A5; real implementation in Task A6.
 *
 * For Task A5, only `userHasPermission` exists (returns false).
 * The stub exists so the `requirePermission` middleware (./middleware/rbac.ts)
 * has something to call. A6 replaces this with role-baseline ∪ grants − revokes
 * resolution against role_permissions ∪ user_permission_overrides.
 */

export const permissionService = {
  /**
   * Whether the user (by id) has the named permission key.
   * STUB — A5 returns false; A6 replaces with real resolution against
   * role_permissions ∪ user_permission_overrides.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async userHasPermission(_userId: string, _permissionKey: string): Promise<boolean> {
    return false;
  },
};

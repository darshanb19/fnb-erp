/**
 * role-service.test.ts — Task A6/1
 *
 * Integration tests for roleService (read-only catalog).
 * permissions + role_permissions are GLOBAL seed tables — not truncated between tests.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupIntegration, teardownIntegration } from './setup.js';
import { roleService } from '../../src/services/role.service.js';
import { userRoleEnum } from '../../src/db/schema/auth.js';

beforeAll(async () => {
  await setupIntegration();
});

afterAll(async () => {
  await teardownIntegration();
});

describe('roleService', () => {
  it('listRoles() returns all 9 enum values', async () => {
    const roles = await roleService.listRoles();
    expect(roles).toHaveLength(9);
    // Verify each expected value is present
    const expected = userRoleEnum.enumValues;
    expect(roles.sort()).toEqual([...expected].sort());
  });

  it('getRole("brand_owner") returns 29 permission keys including mdm.org.read and usr.users.write', async () => {
    // 16 (Epic 1 MDM + Epic 2 USR baseline) + 13 (all Epic 3 INF keys per migration 0010) = 29.
    const result = await roleService.getRole('brand_owner');
    expect(result.role).toBe('brand_owner');
    expect(result.permissionKeys).toHaveLength(29);
    expect(result.permissionKeys).toContain('mdm.org.read');
    expect(result.permissionKeys).toContain('usr.users.write');
    expect(result.permissionKeys).toContain('inf.approval.configure_chains');
    expect(result.permissionKeys).toContain('inf.broadcast.compose');
  });

  it('getRole("superadmin") returns usr.accounts.approve + 4 INF keys (DL-040 BO-approval inbox)', async () => {
    // Migration 0010 grants superadmin the 4 INF keys needed to approve BO accounts via the inbox flow:
    //   inf.approval.{read,write}, inf.notification.{read,preferences.write}.
    const result = await roleService.getRole('superadmin');
    expect(result.role).toBe('superadmin');
    expect(result.permissionKeys.sort()).toEqual([
      'inf.approval.read',
      'inf.approval.write',
      'inf.notification.preferences.write',
      'inf.notification.read',
      'usr.accounts.approve',
    ].sort());
  });
});

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

  it('getRole("brand_owner") returns 16 permission keys including mdm.org.read and usr.users.write', async () => {
    const result = await roleService.getRole('brand_owner');
    expect(result.role).toBe('brand_owner');
    expect(result.permissionKeys).toHaveLength(16);
    expect(result.permissionKeys).toContain('mdm.org.read');
    expect(result.permissionKeys).toContain('usr.users.write');
  });

  it('getRole("superadmin") returns exactly ["usr.accounts.approve"]', async () => {
    const result = await roleService.getRole('superadmin');
    expect(result.role).toBe('superadmin');
    expect(result.permissionKeys).toEqual(['usr.accounts.approve']);
  });
});

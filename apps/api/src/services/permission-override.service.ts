/**
 * permissionOverrideService — Task A6/4
 *
 * Manages per-user permission overrides (grants and revokes) on top of the
 * role baseline. FR15a / FR15b / FR15c.
 *
 * FR15c: reason_code is mandatory on every override — ValidationError if blank.
 *
 * Every mutation writes an audit row via auditLogService.record.
 */

import { eq, and, gte, lte, asc, sql } from 'drizzle-orm';
import type { BrandedDb } from '../db/branded-db.js';
import {
  userPermissionOverrides,
  type UserPermissionOverride,
  type NewUserPermissionOverride,
} from '../db/schema/user-permission-overrides.js';
import { users } from '../db/schema/auth.js';
import { permissions } from '../db/schema/permissions.js';
import { ValidationError, NotFoundError } from '../errors/index.js';
import { auditLogService } from './audit-log.service.js';
import { withTransaction } from '../db/with-transaction.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Joined shape returned by listExpiringSoon — includes human-readable user +
 * permission fields so the frontend (SI-USR-007) can render rows without
 * additional API calls.
 *
 * Added in Arc (c) Task C6. The join uses db.raw (non-scoped) with an explicit
 * brand_id filter on user_permission_overrides + users, as required by the
 * branded-db NOTE: "Joins with other org-scoped tables need manual brand_id filters."
 * permissions is a global (non-brand-scoped) table so no brand_id filter needed there.
 */
export interface ExpiringOverrideRow {
  id: string;
  brandId: string;
  userId: string;
  userEmail: string;
  userFullName: string;
  userRole: string;
  permissionId: string;
  permissionKey: string;
  permissionDescription: string;
  mode: 'grant' | 'revoke';
  reasonCode: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface OverrideInput {
  userId: string;
  permissionId: string;
  reasonCode: string;
  expiresAt: Date | null;
}

export type OverridePatch = {
  reasonCode?: string;
  expiresAt?: Date | null;
};

interface MutationOpts {
  actorUserId: string | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function insertReturning<R>(
  promise: ReturnType<ReturnType<BrandedDb['scopedInsert']>['returning']>,
): Promise<R[]> {
  return promise as unknown as Promise<R[]>;
}

async function updateReturning<R>(
  promise: ReturnType<
    ReturnType<ReturnType<ReturnType<BrandedDb['scopedUpdate']>['set']>['where']>['returning']
  >,
): Promise<R[]> {
  return promise as unknown as Promise<R[]>;
}

function validateReasonCode(reasonCode: string): void {
  if (!reasonCode || reasonCode.trim().length === 0) {
    throw new ValidationError({
      code: 'override.reason_code_required',
      message: 'reason_code is mandatory for permission overrides (FR15c)',
    });
  }
}

// ---------------------------------------------------------------------------
// permissionOverrideService
// ---------------------------------------------------------------------------

export const permissionOverrideService = {
  /**
   * Grant a permission to a user.
   * mode = 'grant'. FR15c: reasonCode mandatory.
   */
  async grant(
    db: BrandedDb,
    input: OverrideInput,
    opts: MutationOpts,
  ): Promise<UserPermissionOverride> {
    validateReasonCode(input.reasonCode);

    return withTransaction(db, opts.actorUserId, async (tx) => {
      const rows = await insertReturning<UserPermissionOverride>(
        tx.scopedInsert(userPermissionOverrides, {
          userId: input.userId,
          permissionId: input.permissionId,
          mode: 'grant',
          reasonCode: input.reasonCode,
          expiresAt: input.expiresAt,
        } as unknown as Parameters<typeof tx.scopedInsert<typeof userPermissionOverrides>>[1]).returning(),
      );
      const row = rows[0];
      if (!row) throw new Error('scopedInsert returned no row');

      await auditLogService.record(tx, {
        action: 'insert',
        tableName: 'user_permission_overrides',
        rowId: row.id,
        actorUserId: opts.actorUserId,
        after: row as Record<string, unknown>,
        reason: input.reasonCode,
      });

      return row;
    });
  },

  /**
   * Revoke a permission from a user.
   * mode = 'revoke'. FR15c: reasonCode mandatory.
   */
  async revoke(
    db: BrandedDb,
    input: OverrideInput,
    opts: MutationOpts,
  ): Promise<UserPermissionOverride> {
    validateReasonCode(input.reasonCode);

    return withTransaction(db, opts.actorUserId, async (tx) => {
      const rows = await insertReturning<UserPermissionOverride>(
        tx.scopedInsert(userPermissionOverrides, {
          userId: input.userId,
          permissionId: input.permissionId,
          mode: 'revoke',
          reasonCode: input.reasonCode,
          expiresAt: input.expiresAt,
        } as unknown as Parameters<typeof tx.scopedInsert<typeof userPermissionOverrides>>[1]).returning(),
      );
      const row = rows[0];
      if (!row) throw new Error('scopedInsert returned no row');

      await auditLogService.record(tx, {
        action: 'insert',
        tableName: 'user_permission_overrides',
        rowId: row.id,
        actorUserId: opts.actorUserId,
        after: row as Record<string, unknown>,
        reason: input.reasonCode,
      });

      return row;
    });
  },

  /**
   * Edit an existing override. Only reasonCode + expiresAt are mutable.
   * mode / userId / permissionId are immutable.
   * Writes audit row with changedFields.
   */
  async editOverride(
    db: BrandedDb,
    id: string,
    patch: OverridePatch,
    opts: MutationOpts,
  ): Promise<UserPermissionOverride> {
    return withTransaction(db, opts.actorUserId, async (tx) => {
      // Fetch before state
      const beforeRows = await (tx.scopedFrom(
        userPermissionOverrides,
        eq(userPermissionOverrides.id, id),
      ) as unknown as Promise<UserPermissionOverride[]>);
      const before = beforeRows[0];
      if (!before) {
        throw new NotFoundError({
          code: 'not_found.permission_override',
          message: `Permission override ${id} not found`,
        });
      }

      // Build the mutable update (only reasonCode + expiresAt allowed)
      const update: Partial<Pick<NewUserPermissionOverride, 'reasonCode' | 'expiresAt'>> = {};
      if (patch.reasonCode !== undefined) {
        validateReasonCode(patch.reasonCode);
        update.reasonCode = patch.reasonCode;
      }
      if ('expiresAt' in patch) {
        update.expiresAt = patch.expiresAt;
      }

      const afterRows = await updateReturning<UserPermissionOverride>(
        tx.scopedUpdate(userPermissionOverrides)
          .set(update)
          .where(eq(userPermissionOverrides.id, id))
          .returning(),
      );
      const after = afterRows[0];
      if (!after) {
        throw new NotFoundError({
          code: 'not_found.permission_override',
          message: `Permission override ${id} not found`,
        });
      }

      const changedFields = auditLogService.computeChangedFields(
        before as Record<string, unknown>,
        after as Record<string, unknown>,
      );

      await auditLogService.record(tx, {
        action: 'update',
        tableName: 'user_permission_overrides',
        rowId: id,
        actorUserId: opts.actorUserId,
        before: before as Record<string, unknown>,
        after: after as Record<string, unknown>,
        changedFields,
        reason: patch.reasonCode ?? before.reasonCode,
      });

      return after;
    });
  },

  /**
   * List all permission overrides for a single user.
   *
   * Returns active + expired (the consumer in SI-USR-005 / SI-USR-006 needs
   * the full set so the source-resolution map can show "this used to be a
   * grant override but expired"; expiry filtering is applied UI-side via
   * <OverrideExpiryBand>). Brand-scoped via the BrandedDb.
   */
  async listForUser(
    db: BrandedDb,
    userId: string,
  ): Promise<UserPermissionOverride[]> {
    return db.scopedFrom(
      userPermissionOverrides,
      eq(userPermissionOverrides.userId, userId),
    ) as unknown as Promise<UserPermissionOverride[]>;
  },

  /**
   * List overrides expiring soon — with joined user + permission fields.
   *
   * Returns overrides where expires_at BETWEEN NOW() AND NOW() + `days` days,
   * ordered by expires_at ASC. Joins users + permissions so the frontend
   * (SI-USR-007) can render human-readable rows without extra round-trips.
   *
   * Uses db.raw (bypasses scopedFrom) because scopedFrom does not support JOINs
   * across tables. brand_id filtering is applied manually on both brand-scoped
   * tables (user_permission_overrides + users). permissions is global.
   *
   * FR15d expiring-soon SQL formula.
   */
  async listExpiringSoon(
    db: BrandedDb,
    days: number,
  ): Promise<ExpiringOverrideRow[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 3600 * 1000);

    const rows = await db.raw
      .select({
        id: userPermissionOverrides.id,
        brandId: userPermissionOverrides.brandId,
        userId: userPermissionOverrides.userId,
        userEmail: users.email,
        userFullName: users.fullName,
        userRole: users.role,
        permissionId: userPermissionOverrides.permissionId,
        permissionKey: permissions.key,
        permissionDescription: permissions.description,
        mode: userPermissionOverrides.mode,
        reasonCode: userPermissionOverrides.reasonCode,
        expiresAt: userPermissionOverrides.expiresAt,
        createdAt: userPermissionOverrides.createdAt,
        updatedAt: userPermissionOverrides.updatedAt,
      })
      .from(userPermissionOverrides)
      .leftJoin(users, eq(userPermissionOverrides.userId, users.id))
      .leftJoin(permissions, eq(userPermissionOverrides.permissionId, permissions.id))
      .where(
        and(
          eq(userPermissionOverrides.brandId, db.brandId),
          eq(users.brandId, db.brandId),
          gte(userPermissionOverrides.expiresAt, now),
          lte(userPermissionOverrides.expiresAt, cutoff),
        ),
      )
      .orderBy(asc(userPermissionOverrides.expiresAt));

    // Cast: leftJoin makes email/fullName/role nullable in the Drizzle type,
    // but rows without a matching user can't exist (FK constraint). Filter any
    // orphaned rows defensively and cast to the concrete return type.
    return rows.filter(
      (r): r is ExpiringOverrideRow & typeof r =>
        r.userEmail !== null &&
        r.userFullName !== null &&
        r.userRole !== null &&
        r.permissionKey !== null &&
        r.permissionDescription !== null &&
        r.expiresAt !== null,
    ) as unknown as ExpiringOverrideRow[];
  },

  /**
   * Immediately expire an override by setting expires_at = NOW().
   * Writes audit row.
   */
  async expireOverride(
    db: BrandedDb,
    id: string,
    opts: MutationOpts,
  ): Promise<void> {
    await withTransaction(db, opts.actorUserId, async (tx) => {
      const beforeRows = await (tx.scopedFrom(
        userPermissionOverrides,
        eq(userPermissionOverrides.id, id),
      ) as unknown as Promise<UserPermissionOverride[]>);
      const before = beforeRows[0];
      if (!before) {
        throw new NotFoundError({
          code: 'not_found.permission_override',
          message: `Permission override ${id} not found`,
        });
      }

      const now = new Date();
      const afterRows = await updateReturning<UserPermissionOverride>(
        tx.scopedUpdate(userPermissionOverrides)
          .set({ expiresAt: now })
          .where(eq(userPermissionOverrides.id, id))
          .returning(),
      );
      const after = afterRows[0];
      if (!after) throw new Error('Update returned no row');

      const changedFields = auditLogService.computeChangedFields(
        before as Record<string, unknown>,
        after as Record<string, unknown>,
      );

      await auditLogService.record(tx, {
        action: 'update',
        tableName: 'user_permission_overrides',
        rowId: id,
        actorUserId: opts.actorUserId,
        before: before as Record<string, unknown>,
        after: after as Record<string, unknown>,
        changedFields,
        reason: 'expire_override',
      });
    });
  },
};

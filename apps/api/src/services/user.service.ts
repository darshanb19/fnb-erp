/**
 * userService — Task A6/3
 *
 * Full CRUD for users.
 *
 * FR14: Brand Owner self-creation → approval_status = 'pending_approval'.
 *       All other roles → approval_status = 'approved'.
 *
 * Scope filtering:
 *   - Brand Owner scope: all users for the brand.
 *   - Cluster Manager scope: users where cluster_id = clusterId.
 *
 * Every mutation writes an audit row via auditLogService.record inside the
 * transaction (DL-013).
 */

import { eq, and, ilike, type SQL } from 'drizzle-orm';
import type { BrandedDb } from '../db/branded-db.js';
import { users, type User, type NewUser, type UserRole } from '../db/schema/auth.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import { auditLogService } from './audit-log.service.js';
import { withTransaction } from '../db/with-transaction.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UserUpdate = Partial<
  Omit<NewUser, 'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>
>;

export interface UserCreateInput {
  email: string;
  fullName: string;
  role: UserRole;
  clusterId?: string;
  departmentId?: string;
  locationId?: string;
  reasonCode: string;
}

export interface UserListScope {
  scope: { kind: 'brand' } | { kind: 'cluster'; clusterId: string };
  filters?: {
    role?: UserRole;
    active?: boolean;
    search?: string;
  };
}

interface MutationOpts {
  actorUserId: string | null;
}

interface UpdateOpts extends MutationOpts {
  reasonCode: string;
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

// ---------------------------------------------------------------------------
// userService
// ---------------------------------------------------------------------------

export const userService = {
  /**
   * List users with optional scope + filters.
   */
  async list(db: BrandedDb, opts: UserListScope): Promise<User[]> {
    const conditions: SQL[] = [];

    // Scope filter
    if (opts.scope.kind === 'cluster') {
      conditions.push(eq(users.clusterId, opts.scope.clusterId));
    }

    // Optional filters
    if (opts.filters?.role !== undefined) {
      conditions.push(eq(users.role, opts.filters.role));
    }
    if (opts.filters?.active !== undefined) {
      conditions.push(eq(users.active, opts.filters.active));
    }
    if (opts.filters?.search) {
      conditions.push(ilike(users.fullName, `%${opts.filters.search}%`));
    }

    const condition = conditions.length > 0 ? and(...conditions) : undefined;
    return db.scopedFrom(users, condition) as unknown as Promise<User[]>;
  },

  /**
   * Get a single user by id. Throws NotFoundError if missing.
   */
  async get(db: BrandedDb, id: string): Promise<User> {
    const rows = await (db.scopedFrom(users, eq(users.id, id)) as unknown as Promise<User[]>);
    const row = rows[0];
    if (!row) {
      throw new NotFoundError({ code: 'not_found.user', message: `User ${id} not found` });
    }
    return row;
  },

  /**
   * Create a user.
   * FR14: brand_owner role → approval_status = 'pending_approval'; else → 'approved'.
   * Writes audit row.
   */
  async create(
    db: BrandedDb,
    input: UserCreateInput,
    opts: MutationOpts,
  ): Promise<User> {
    const approvalStatus =
      input.role === 'brand_owner' ? 'pending_approval' : 'approved';

    return withTransaction(db, opts.actorUserId, async (tx) => {
      // Cast via unknown to bridge the ScopedInsertRow type gap.
      // BrandScopedTableResult's BuildColumns inference drops enum columns with
      // .default() from the inferred insert type. The cast is safe: the shape
      // matches NewUser exactly minus brandId (injected by scopedInsert).
      const rows = await insertReturning<User>(
        tx.scopedInsert(users, {
          email: input.email,
          fullName: input.fullName,
          role: input.role,
          approvalStatus,
          clusterId: input.clusterId ?? null,
          departmentId: input.departmentId ?? null,
          locationId: input.locationId ?? null,
        } as unknown as Parameters<typeof tx.scopedInsert<typeof users>>[1]).returning(),
      );
      const row = rows[0];
      if (!row) throw new Error('scopedInsert returned no row');

      await auditLogService.record(tx, {
        action: 'insert',
        tableName: 'users',
        rowId: row.id,
        actorUserId: opts.actorUserId,
        after: row as Record<string, unknown>,
        reason: input.reasonCode,
      });

      return row;
    });
  },

  /**
   * Update mutable user fields. Writes audit row with changedFields.
   */
  async update(
    db: BrandedDb,
    id: string,
    patch: UserUpdate,
    opts: UpdateOpts,
  ): Promise<User> {
    return withTransaction(db, opts.actorUserId, async (tx) => {
      const before = await userService.get(tx, id);

      const rows = await updateReturning<User>(
        tx.scopedUpdate(users).set(patch).where(eq(users.id, id)).returning(),
      );
      const after = rows[0];
      if (!after) {
        throw new NotFoundError({ code: 'not_found.user', message: `User ${id} not found` });
      }

      const changedFields = auditLogService.computeChangedFields(
        before as Record<string, unknown>,
        after as Record<string, unknown>,
      );

      await auditLogService.record(tx, {
        action: 'update',
        tableName: 'users',
        rowId: id,
        actorUserId: opts.actorUserId,
        before: before as Record<string, unknown>,
        after: after as Record<string, unknown>,
        changedFields,
        reason: opts.reasonCode,
      });

      return after;
    });
  },

  /**
   * Soft-deactivate a user (sets active = false). Writes audit row.
   */
  async deactivate(
    db: BrandedDb,
    id: string,
    opts: UpdateOpts,
  ): Promise<void> {
    await userService.update(db, id, { active: false }, opts);
  },

  /**
   * List users with approval_status = 'pending_approval'.
   * Used by the Superadmin / brand_owner approval queue.
   * Read-only — no transaction needed.
   */
  async listPendingApproval(db: BrandedDb): Promise<User[]> {
    return db.scopedFrom(
      users,
      eq(users.approvalStatus, 'pending_approval'),
    ) as unknown as Promise<User[]>;
  },

  /**
   * Approve a pending user — transitions approval_status → 'approved'.
   * Writes a business_action audit row with reason + event context.
   */
  async approve(
    db: BrandedDb,
    id: string,
    opts: { reasonCode: string; actorUserId: string | null },
  ): Promise<User> {
    return withTransaction(db, opts.actorUserId, async (tx) => {
      const before = await userService.get(tx, id);

      if (before.approvalStatus !== 'pending_approval') {
        throw new ValidationError({
          code: 'state.invalid_transition',
          message: `Cannot approve user in status '${before.approvalStatus}'; required status is 'pending_approval'`,
          details: {
            currentStatus: before.approvalStatus,
            requiredStatus: 'pending_approval',
          },
        });
      }

      const rows = await updateReturning<User>(
        tx.scopedUpdate(users)
          .set({ approvalStatus: 'approved' })
          .where(eq(users.id, id))
          .returning(),
      );
      const after = rows[0];
      if (!after) {
        throw new NotFoundError({ code: 'not_found.user', message: `User ${id} not found` });
      }

      await auditLogService.record(tx, {
        action: 'business_action',
        tableName: 'users',
        rowId: id,
        actorUserId: opts.actorUserId,
        before: before as Record<string, unknown>,
        after: after as Record<string, unknown>,
        changedFields: ['approvalStatus'],
        reason: opts.reasonCode,
        context: { event: 'approve_user' },
      });

      return after;
    });
  },

  /**
   * Reject a pending user — transitions approval_status → 'rejected'.
   * Writes a business_action audit row with reason + event context.
   */
  async reject(
    db: BrandedDb,
    id: string,
    opts: { reasonCode: string; actorUserId: string | null },
  ): Promise<User> {
    return withTransaction(db, opts.actorUserId, async (tx) => {
      const before = await userService.get(tx, id);

      if (before.approvalStatus !== 'pending_approval') {
        throw new ValidationError({
          code: 'state.invalid_transition',
          message: `Cannot reject user in status '${before.approvalStatus}'; required status is 'pending_approval'`,
          details: {
            currentStatus: before.approvalStatus,
            requiredStatus: 'pending_approval',
          },
        });
      }

      const rows = await updateReturning<User>(
        tx.scopedUpdate(users)
          .set({ approvalStatus: 'rejected' })
          .where(eq(users.id, id))
          .returning(),
      );
      const after = rows[0];
      if (!after) {
        throw new NotFoundError({ code: 'not_found.user', message: `User ${id} not found` });
      }

      await auditLogService.record(tx, {
        action: 'business_action',
        tableName: 'users',
        rowId: id,
        actorUserId: opts.actorUserId,
        before: before as Record<string, unknown>,
        after: after as Record<string, unknown>,
        changedFields: ['approvalStatus'],
        reason: opts.reasonCode,
        context: { event: 'reject_user' },
      });

      return after;
    });
  },
};

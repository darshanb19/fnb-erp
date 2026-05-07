/**
 * orgService — FR1 (cluster CRUD) + FR2 (department classification) + DL-022 (parent-lock).
 *
 * All mutations run inside withTransaction() which:
 *   1. Opens a Postgres transaction on db.raw.
 *   2. Sets `app.user_id` session variable for audit trigger backstop.
 *   3. Provides a transaction-scoped BrandedDb to service methods.
 *   4. Writes an audit_log row atomically with the mutation.
 *
 * DL-022 enforcement — immutable parent keys:
 *   - Location.clusterId is LOCKED at creation. Attempting to pass clusterId
 *     in an updateLocation() call throws ParentRelinkAttemptError at runtime.
 *   - Department.locationId is LOCKED at creation. Same enforcement.
 *   - Type aliases (LocationUpdate, DepartmentUpdate) EXCLUDE the locked keys
 *     at compile-time. Runtime guard catches end-runs via `as any` casts.
 *
 * DL-013 enforcement — application-layer audit primary:
 *   - Every create and update calls auditLogService.record() inside the same txn.
 *   - Deactivate is implemented via updateCluster/updateLocation/updateDepartment
 *     and therefore also writes an audit row.
 *
 * Type-cast note:
 *   brandedDb's scopedInsert / scopedUpdate return generic Drizzle builder types
 *   that lose specific table column information (the generic collapses to
 *   `{ [x: string]: unknown }`). Each `.returning()` result is cast to the
 *   concrete row type (e.g. `Cluster`) via `as unknown as`. This is safe because
 *   Drizzle always returns fully-populated rows when `.returning()` is called on
 *   the table with no field selection argument.
 */

import { eq, and } from 'drizzle-orm';
import type { BrandedDb } from '../db/branded-db.js';
import {
  clusters,
  locations,
  departments,
  type Cluster,
  type NewCluster,
  type Location,
  type NewLocation,
  type Department,
  type NewDepartment,
} from '../db/schema/org.js';
import { ParentRelinkAttemptError, NotFoundError } from '../errors/index.js';
import { auditLogService } from './audit-log.service.js';
import { withTransaction } from '../db/with-transaction.js';

// ---------------------------------------------------------------------------
// Update types — exclude immutable + injected fields
// ---------------------------------------------------------------------------

/**
 * Caller-supplied fields for a cluster update.
 * Excludes: id, brandId, createdAt, updatedAt, createdBy, updatedBy (auto-managed).
 */
export type ClusterUpdate = Partial<
  Omit<NewCluster, 'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>
>;

/**
 * Caller-supplied fields for a location update.
 * Excludes: id, brandId, standard audit cols, AND clusterId (DL-022 parent-lock).
 */
export type LocationUpdate = Partial<
  Omit<
    NewLocation,
    'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'clusterId'
  >
>;

/**
 * Caller-supplied fields for a department update.
 * Excludes: id, brandId, standard audit cols, AND locationId (DL-022 parent-lock).
 */
export type DepartmentUpdate = Partial<
  Omit<
    NewDepartment,
    'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'locationId'
  >
>;

// ---------------------------------------------------------------------------
// DL-022 runtime guard
// ---------------------------------------------------------------------------

const LOCATION_PARENT_LOCK = ['clusterId'] as const;
const DEPARTMENT_PARENT_LOCK = ['locationId'] as const;

/**
 * Throws ParentRelinkAttemptError if `input` contains any key from `lockedKeys`.
 * Catches end-runs where callers cast their update payload to `any` to bypass
 * the compile-time exclusion in LocationUpdate / DepartmentUpdate.
 */
function assertNoParentRelink(input: object, lockedKeys: readonly string[]): void {
  for (const k of lockedKeys) {
    if (k in input) {
      throw new ParentRelinkAttemptError(k);
    }
  }
}

// ---------------------------------------------------------------------------
// Options types
// ---------------------------------------------------------------------------

interface MutationOpts {
  actorUserId: string | null;
}

interface UpdateOpts extends MutationOpts {
  reason: string;
}

// ---------------------------------------------------------------------------
// Internal typed helpers
// ---------------------------------------------------------------------------

/**
 * Awaitable wrapper for scopedInsert(...).returning() that casts the result
 * to the concrete row type R.
 * The cast is safe: Drizzle's .returning() with no selection arg returns all columns.
 */
async function insertReturning<R>(
  promise: ReturnType<ReturnType<BrandedDb['scopedInsert']>['returning']>,
): Promise<R[]> {
  return promise as unknown as Promise<R[]>;
}

/**
 * Awaitable wrapper for scopedUpdate(...).set(...).where(...).returning() that
 * casts to the concrete row type R.
 */
async function updateReturning<R>(
  promise: ReturnType<ReturnType<ReturnType<ReturnType<BrandedDb['scopedUpdate']>['set']>['where']>['returning']>,
): Promise<R[]> {
  return promise as unknown as Promise<R[]>;
}

// ---------------------------------------------------------------------------
// orgService
// ---------------------------------------------------------------------------

export const orgService = {
  // -------------------------------------------------------------------------
  // Clusters
  // -------------------------------------------------------------------------

  /** FR1: Create a cluster scoped to the caller's brand. Writes audit_log row. */
  async createCluster(
    db: BrandedDb,
    input: Omit<NewCluster, 'brandId'>,
    opts: MutationOpts,
  ): Promise<Cluster> {
    return withTransaction(db, opts.actorUserId, async (tx) => {
      const rows = await insertReturning<Cluster>(tx.scopedInsert(clusters, input).returning());
      const row = rows[0];
      if (!row) throw new Error('scopedInsert returned no row — this should not happen');
      await auditLogService.record(tx, {
        action: 'insert',
        tableName: 'clusters',
        rowId: row.id,
        actorUserId: opts.actorUserId,
        after: row as Record<string, unknown>,
      });
      return row;
    });
  },

  /** FR1: List all clusters for the caller's brand (active + inactive). */
  async listClusters(db: BrandedDb): Promise<Cluster[]> {
    return db.scopedFrom(clusters) as unknown as Promise<Cluster[]>;
  },

  /** FR1: Get a single cluster by id, scoped to caller's brand. */
  async getCluster(db: BrandedDb, id: string): Promise<Cluster> {
    const rows = await (db.scopedFrom(clusters, eq(clusters.id, id)) as unknown as Promise<Cluster[]>);
    const row = rows[0];
    if (!row) {
      throw new NotFoundError({ code: 'not_found.cluster', message: `Cluster ${id} not found` });
    }
    return row;
  },

  /** FR1: Update mutable cluster fields. Writes audit_log row. */
  async updateCluster(
    db: BrandedDb,
    id: string,
    input: ClusterUpdate,
    opts: UpdateOpts,
  ): Promise<Cluster> {
    return withTransaction(db, opts.actorUserId, async (tx) => {
      const before = await orgService.getCluster(tx, id);
      const rows = await updateReturning<Cluster>(
        tx.scopedUpdate(clusters).set(input).where(eq(clusters.id, id)).returning(),
      );
      const after = rows[0];
      if (!after) throw new NotFoundError({ code: 'not_found.cluster', message: `Cluster ${id} not found` });
      const changedFields = auditLogService.computeChangedFields(
        before as Record<string, unknown>,
        after as Record<string, unknown>,
      );
      await auditLogService.record(tx, {
        action: 'update',
        tableName: 'clusters',
        rowId: id,
        actorUserId: opts.actorUserId,
        before: before as Record<string, unknown>,
        after: after as Record<string, unknown>,
        changedFields,
        reason: opts.reason,
      });
      return after;
    });
  },

  /** FR1: Soft-deactivate a cluster. Does NOT cascade to child locations (per DL-022). */
  async deactivateCluster(
    db: BrandedDb,
    id: string,
    opts: UpdateOpts,
  ): Promise<Cluster> {
    return orgService.updateCluster(db, id, { active: false }, opts);
  },

  // -------------------------------------------------------------------------
  // Locations — DL-022: clusterId is IMMUTABLE post-creation.
  // -------------------------------------------------------------------------

  /** FR1: Create a location under a cluster. Writes audit_log row. */
  async createLocation(
    db: BrandedDb,
    input: Omit<NewLocation, 'brandId'>,
    opts: MutationOpts,
  ): Promise<Location> {
    return withTransaction(db, opts.actorUserId, async (tx) => {
      const rows = await insertReturning<Location>(tx.scopedInsert(locations, input).returning());
      const row = rows[0];
      if (!row) throw new Error('scopedInsert returned no row — this should not happen');
      await auditLogService.record(tx, {
        action: 'insert',
        tableName: 'locations',
        rowId: row.id,
        actorUserId: opts.actorUserId,
        after: row as Record<string, unknown>,
      });
      return row;
    });
  },

  /** FR1: List locations for the caller's brand, optionally filtered by clusterId. */
  async listLocations(
    db: BrandedDb,
    filter?: { clusterId?: string },
  ): Promise<Location[]> {
    const condition = filter?.clusterId
      ? eq(locations.clusterId, filter.clusterId)
      : undefined;
    return db.scopedFrom(locations, condition) as unknown as Promise<Location[]>;
  },

  /** FR1: Get a single location by id, scoped to caller's brand. */
  async getLocation(db: BrandedDb, id: string): Promise<Location> {
    const rows = await (db.scopedFrom(locations, eq(locations.id, id)) as unknown as Promise<Location[]>);
    const row = rows[0];
    if (!row) {
      throw new NotFoundError({ code: 'not_found.location', message: `Location ${id} not found` });
    }
    return row;
  },

  /**
   * FR1: Update mutable location fields.
   * DL-022: clusterId is rejected at compile-time (LocationUpdate excludes it)
   * and at runtime (assertNoParentRelink guard catches `as any` end-runs).
   * Writes audit_log row.
   */
  async updateLocation(
    db: BrandedDb,
    id: string,
    input: LocationUpdate,
    opts: UpdateOpts,
  ): Promise<Location> {
    assertNoParentRelink(input, LOCATION_PARENT_LOCK); // DL-022 runtime guard
    return withTransaction(db, opts.actorUserId, async (tx) => {
      const before = await orgService.getLocation(tx, id);
      const rows = await updateReturning<Location>(
        tx.scopedUpdate(locations).set(input).where(eq(locations.id, id)).returning(),
      );
      const after = rows[0];
      if (!after) throw new NotFoundError({ code: 'not_found.location', message: `Location ${id} not found` });
      const changedFields = auditLogService.computeChangedFields(
        before as Record<string, unknown>,
        after as Record<string, unknown>,
      );
      await auditLogService.record(tx, {
        action: 'update',
        tableName: 'locations',
        rowId: id,
        actorUserId: opts.actorUserId,
        before: before as Record<string, unknown>,
        after: after as Record<string, unknown>,
        changedFields,
        reason: opts.reason,
      });
      return after;
    });
  },

  /** FR1: Soft-deactivate a location. */
  async deactivateLocation(
    db: BrandedDb,
    id: string,
    opts: UpdateOpts,
  ): Promise<Location> {
    return orgService.updateLocation(db, id, { active: false }, opts);
  },

  // -------------------------------------------------------------------------
  // Departments — DL-022: locationId is IMMUTABLE post-creation.
  // -------------------------------------------------------------------------

  /** FR2: Create a department under a location. Writes audit_log row. */
  async createDepartment(
    db: BrandedDb,
    input: Omit<NewDepartment, 'brandId'>,
    opts: MutationOpts,
  ): Promise<Department> {
    return withTransaction(db, opts.actorUserId, async (tx) => {
      const rows = await insertReturning<Department>(tx.scopedInsert(departments, input).returning());
      const row = rows[0];
      if (!row) throw new Error('scopedInsert returned no row — this should not happen');
      await auditLogService.record(tx, {
        action: 'insert',
        tableName: 'departments',
        rowId: row.id,
        actorUserId: opts.actorUserId,
        after: row as Record<string, unknown>,
      });
      return row;
    });
  },

  /**
   * FR2: List departments for the caller's brand.
   * Supports filtering by locationId and/or department type.
   */
  async listDepartments(
    db: BrandedDb,
    filter?: { locationId?: string; type?: Department['type'] },
  ): Promise<Department[]> {
    const conds = [];
    if (filter?.locationId) conds.push(eq(departments.locationId, filter.locationId));
    if (filter?.type) conds.push(eq(departments.type, filter.type));
    const condition = conds.length > 0 ? and(...conds) : undefined;
    return db.scopedFrom(departments, condition) as unknown as Promise<Department[]>;
  },

  /** FR2: Get a single department by id, scoped to caller's brand. */
  async getDepartment(db: BrandedDb, id: string): Promise<Department> {
    const rows = await (db.scopedFrom(departments, eq(departments.id, id)) as unknown as Promise<Department[]>);
    const row = rows[0];
    if (!row) {
      throw new NotFoundError({ code: 'not_found.department', message: `Department ${id} not found` });
    }
    return row;
  },

  /**
   * FR2: Update mutable department fields.
   * DL-022: locationId is rejected at compile-time (DepartmentUpdate excludes it)
   * and at runtime (assertNoParentRelink guard catches `as any` end-runs).
   * Writes audit_log row.
   */
  async updateDepartment(
    db: BrandedDb,
    id: string,
    input: DepartmentUpdate,
    opts: UpdateOpts,
  ): Promise<Department> {
    assertNoParentRelink(input, DEPARTMENT_PARENT_LOCK); // DL-022 runtime guard
    return withTransaction(db, opts.actorUserId, async (tx) => {
      const before = await orgService.getDepartment(tx, id);
      const rows = await updateReturning<Department>(
        tx.scopedUpdate(departments).set(input).where(eq(departments.id, id)).returning(),
      );
      const after = rows[0];
      if (!after) throw new NotFoundError({ code: 'not_found.department', message: `Department ${id} not found` });
      const changedFields = auditLogService.computeChangedFields(
        before as Record<string, unknown>,
        after as Record<string, unknown>,
      );
      await auditLogService.record(tx, {
        action: 'update',
        tableName: 'departments',
        rowId: id,
        actorUserId: opts.actorUserId,
        before: before as Record<string, unknown>,
        after: after as Record<string, unknown>,
        changedFields,
        reason: opts.reason,
      });
      return after;
    });
  },

  /** FR2: Soft-deactivate a department. */
  async deactivateDepartment(
    db: BrandedDb,
    id: string,
    opts: UpdateOpts,
  ): Promise<Department> {
    return orgService.updateDepartment(db, id, { active: false }, opts);
  },
};

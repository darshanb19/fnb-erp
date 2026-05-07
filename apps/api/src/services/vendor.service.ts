/**
 * vendorService — FR6 (vendor CRUD) + Master Spec §2.7 (scope mutation)
 *                 + DL-026 (findSimilarByName trigram).
 *
 * All mutations run inside withTransaction() which:
 *   1. Opens a Postgres transaction on db.raw.
 *   2. Sets `app.user_id` session variable for audit trigger backstop.
 *   3. Provides a transaction-scoped BrandedDb to service methods.
 *   4. Writes an audit_log row atomically with the mutation.
 *
 * Master Spec §2.7 — Vendor scope mutation:
 *   Scope hierarchy: Brand > Cluster > POS (Brand is broadest; POS is narrowest).
 *
 *   Widening (broader access):
 *     pos → cluster, pos → brand, cluster → brand
 *     Unconditional: UPDATE + audit business_action with event: scope_widening.
 *
 *   Narrowing (tighter access):
 *     brand → cluster, brand → pos, cluster → pos
 *     Compute dropped location IDs; if hasOpenTransactionsAt returns true → blocked.
 *     Else UPDATE + audit business_action with event: scope_narrowing.
 *
 *   Lateral (same scope level, different binding):
 *     cluster A → cluster B, pos A → pos B (or pos A → cluster not-parent-of-A)
 *     Always rejected: throw ScopeMutationError(scope_lateral_not_supported).
 *
 * DL-026 — findSimilarByName:
 *   Uses pg_trgm similarity() function via db.raw.execute + sql tag template.
 *   Symmetric to productService.findSimilarByName.
 *
 * Type-cast note:
 *   brandedDb's scopedInsert / scopedUpdate return generic Drizzle builder types
 *   that lose specific table column information. Each .returning() result is cast
 *   to the concrete row type via `as unknown as`. This is safe because Drizzle
 *   always returns fully-populated rows when .returning() is called with no selection.
 */

import { eq, and, sql } from 'drizzle-orm';
import type { BrandedDb } from '../db/branded-db.js';
import { vendors, type Vendor, type NewVendor } from '../db/schema/procurement.js';
import { locations } from '../db/schema/org.js';
import { NotFoundError, ValidationError, ScopeMutationError } from '../errors/index.js';
import { auditLogService } from './audit-log.service.js';
import { withTransaction } from '../db/with-transaction.js';

// ---------------------------------------------------------------------------
// Update / filter types
// ---------------------------------------------------------------------------

/**
 * VendorUpdate excludes scope-mutation fields — those go via changeVendorScope.
 * Also excludes immutable / injected columns.
 */
export type VendorUpdate = Partial<
  Omit<
    NewVendor,
    | 'id'
    | 'brandId'
    | 'createdAt'
    | 'updatedAt'
    | 'createdBy'
    | 'updatedBy'
    | 'code'
    | 'scope'
    | 'scopeClusterId'
    | 'scopeLocationId'
  >
>;

export interface VendorFilter {
  scope?: 'brand' | 'cluster' | 'pos';
  clusterId?: string;
  locationId?: string;
  preferred?: boolean;
  active?: boolean;
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
// Internal typed helpers (mirroring product.service.ts pattern)
// ---------------------------------------------------------------------------

async function insertReturning<R>(
  promise: ReturnType<ReturnType<BrandedDb['scopedInsert']>['returning']>,
): Promise<R[]> {
  return promise as unknown as Promise<R[]>;
}

async function updateReturning<R>(
  promise: ReturnType<ReturnType<ReturnType<ReturnType<BrandedDb['scopedUpdate']>['set']>['where']>['returning']>,
): Promise<R[]> {
  return promise as unknown as Promise<R[]>;
}

// ---------------------------------------------------------------------------
// Scope validation helper
// ---------------------------------------------------------------------------

/**
 * Validates that the scope input object is internally consistent per §2.7.
 * Throws ValidationError if not.
 */
function validateScopeInput(
  scope: 'brand' | 'cluster' | 'pos',
  clusterId?: string | null,
  locationId?: string | null,
): void {
  if (scope === 'brand') {
    if (clusterId || locationId) {
      throw new ValidationError({
        code: 'vendor.scope_input_inconsistent',
        message: 'scope=brand requires neither clusterId nor locationId',
        details: { scope, clusterId, locationId },
      });
    }
  } else if (scope === 'cluster') {
    if (!clusterId) {
      throw new ValidationError({
        code: 'vendor.scope_input_inconsistent',
        message: 'scope=cluster requires clusterId',
        details: { scope },
      });
    }
    if (locationId) {
      throw new ValidationError({
        code: 'vendor.scope_input_inconsistent',
        message: 'scope=cluster must not have locationId',
        details: { scope, locationId },
      });
    }
  } else if (scope === 'pos') {
    if (!locationId) {
      throw new ValidationError({
        code: 'vendor.scope_input_inconsistent',
        message: 'scope=pos requires locationId',
        details: { scope },
      });
    }
    if (clusterId) {
      throw new ValidationError({
        code: 'vendor.scope_input_inconsistent',
        message: 'scope=pos must not have clusterId',
        details: { scope, clusterId },
      });
    }
  }
}

/**
 * Determine transition kind for §2.7 scope mutation.
 * Returns 'widening', 'narrowing', or 'lateral'.
 *
 * Widening = broader access (vendor can serve more locations):
 *   pos → cluster, pos → brand, cluster → brand
 *   Special case: pos → cluster where clusterId IS the pos location's parent cluster
 *     is still widening (access expands from one location to entire cluster).
 *
 * Narrowing = tighter access (vendor loses access to some locations):
 *   brand → cluster, brand → pos, cluster → pos
 *
 * Lateral = same scope level, different binding (rejected):
 *   cluster A → cluster B, pos A → pos B,
 *   pos A → cluster where clusterId is NOT parent-of-A (treated as lateral per spec)
 */
type TransitionKind = 'widening' | 'narrowing' | 'lateral';

function classifyTransition(
  currentVendor: Vendor,
  newScope: 'brand' | 'cluster' | 'pos',
  newClusterId?: string | null,
  newLocationId?: string | null,
): TransitionKind {
  const fromScope = currentVendor.scope;
  const toScope = newScope;

  // Same scope level
  if (fromScope === toScope) {
    // Same exact binding → no change (treat as lateral to force a revalidation path;
    // service can decide, but the spec says lateral = deactivate + recreate)
    return 'lateral';
  }

  // Cross-scope transitions
  if (fromScope === 'pos' && toScope === 'cluster') {
    // pos → cluster: widening regardless of which cluster
    // (per spec, even if it's a different cluster than pos's parent, this is widening
    //  because the vendor gains access to more locations)
    // However per the spec lateral definition: "pos (locationA) → cluster (different cluster than locationA's parent)"
    // is lateral. We check: if the new cluster is NOT the parent cluster of the current location, it's lateral.
    // We need to resolve this: the spec classifies pos→cluster(different parent) as lateral.
    // We'll set this to 'widening' for pos → cluster(same parent) and 'lateral' for different parent.
    // Since we don't have the location's clusterId here, we return widening and let the caller verify.
    // The caller (changeVendorScope) will resolve the location's clusterId and reclassify if needed.
    return 'widening'; // may be reclassified to lateral by caller
  }

  if (fromScope === 'pos' && toScope === 'brand') {
    return 'widening';
  }

  if (fromScope === 'cluster' && toScope === 'brand') {
    return 'widening';
  }

  if (fromScope === 'brand' && toScope === 'cluster') {
    return 'narrowing';
  }

  if (fromScope === 'brand' && toScope === 'pos') {
    return 'narrowing';
  }

  if (fromScope === 'cluster' && toScope === 'pos') {
    return 'narrowing';
  }

  // Fallback — should not reach here given the enum values
  return 'lateral';
}

// ---------------------------------------------------------------------------
// vendorService
// ---------------------------------------------------------------------------

export const vendorService = {
  // -------------------------------------------------------------------------
  // Vendor CRUD
  // -------------------------------------------------------------------------

  /**
   * FR6: Create a vendor scoped to the caller's brand.
   * Validates scope consistency before inserting.
   * Writes audit_log row.
   */
  async createVendor(
    db: BrandedDb,
    input: Omit<NewVendor, 'brandId'>,
    opts: MutationOpts,
  ): Promise<Vendor> {
    // Validate scope consistency at service layer (belt-and-suspenders over the DB CHECK)
    validateScopeInput(input.scope, input.scopeClusterId, input.scopeLocationId);

    return withTransaction(db, opts.actorUserId, async (tx) => {
      // Cast required: scopedInsert generic collapses optional fields and TS's
      // excess-property check rejects valid optional fields. Shape is correct.
      const row = {
        ...input,
      } as unknown as import('../db/branded-db.js').ScopedInsertRow<typeof vendors>;

      const rows = await insertReturning<Vendor>(tx.scopedInsert(vendors, row).returning());
      const vendor = rows[0];
      if (!vendor) throw new Error('scopedInsert returned no row — this should not happen');

      await auditLogService.record(tx, {
        action: 'insert',
        tableName: 'vendors',
        rowId: vendor.id,
        actorUserId: opts.actorUserId,
        after: vendor as Record<string, unknown>,
      });
      return vendor;
    });
  },

  /**
   * FR6: List all vendors for the caller's brand with optional filtering.
   */
  async listVendors(db: BrandedDb, filter?: VendorFilter): Promise<Vendor[]> {
    const conds = [];
    if (filter?.scope !== undefined) conds.push(eq(vendors.scope, filter.scope));
    if (filter?.clusterId !== undefined) conds.push(eq(vendors.scopeClusterId, filter.clusterId));
    if (filter?.locationId !== undefined) conds.push(eq(vendors.scopeLocationId, filter.locationId));
    if (filter?.preferred !== undefined) conds.push(eq(vendors.preferred, filter.preferred));
    if (filter?.active !== undefined) conds.push(eq(vendors.active, filter.active));
    const condition = conds.length > 0 ? and(...conds) : undefined;
    return db.scopedFrom(vendors, condition) as unknown as Promise<Vendor[]>;
  },

  /**
   * FR6: Get a single vendor by id.
   * Throws NotFoundError if not found.
   */
  async getVendor(db: BrandedDb, id: string): Promise<Vendor> {
    const rows = await (db.scopedFrom(vendors, eq(vendors.id, id)) as unknown as Promise<Vendor[]>);
    const vendor = rows[0];
    if (!vendor) {
      throw new NotFoundError({ code: 'not_found.vendor', message: `Vendor ${id} not found` });
    }
    return vendor;
  },

  /**
   * FR6: Update mutable vendor fields (excludes scope-mutation fields).
   * Writes audit_log row with reason and changedFields.
   */
  async updateVendor(
    db: BrandedDb,
    id: string,
    input: VendorUpdate,
    opts: UpdateOpts,
  ): Promise<Vendor> {
    return withTransaction(db, opts.actorUserId, async (tx) => {
      const before = await vendorService.getVendor(tx, id);
      const rows = await updateReturning<Vendor>(
        tx.scopedUpdate(vendors).set(input).where(eq(vendors.id, id)).returning(),
      );
      const after = rows[0];
      if (!after) throw new NotFoundError({ code: 'not_found.vendor', message: `Vendor ${id} not found` });
      const changedFields = auditLogService.computeChangedFields(
        before as Record<string, unknown>,
        after as Record<string, unknown>,
      );
      await auditLogService.record(tx, {
        action: 'update',
        tableName: 'vendors',
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

  /**
   * FR6: Soft-deactivate a vendor. Row is preserved for audit history.
   */
  async deactivateVendor(
    db: BrandedDb,
    id: string,
    opts: UpdateOpts,
  ): Promise<Vendor> {
    return vendorService.updateVendor(db, id, { active: false }, opts);
  },

  // -------------------------------------------------------------------------
  // §2.7 scope mutation
  // -------------------------------------------------------------------------

  /**
   * §2.7: Change the scope of a vendor (widening, narrowing, or reject lateral).
   *
   * Algorithm:
   * 1. Read current vendor row.
   * 2. Validate the new scope object's internal consistency.
   * 3. Classify the transition (widening / narrowing / lateral).
   * 4. Widening: UPDATE + audit business_action(scope_widening, from, to).
   * 5. Narrowing: compute droppedLocationIds, call hasOpenTransactionsAt,
   *    block if open transactions exist, else UPDATE + audit business_action(scope_narrowing).
   * 6. Lateral: throw ScopeMutationError(vendor.scope_lateral_not_supported).
   *
   * @param newScope - { scope, clusterId?, locationId? }
   * @param opts     - { actorUserId, reason } — reason is mandatory for scope mutations
   */
  async changeVendorScope(
    db: BrandedDb,
    id: string,
    newScope: { scope: 'brand' | 'cluster' | 'pos'; clusterId?: string; locationId?: string },
    opts: UpdateOpts,
  ): Promise<Vendor> {
    // Step 1: Read current vendor
    const current = await vendorService.getVendor(db, id);

    // Step 2: Validate new scope input consistency
    validateScopeInput(newScope.scope, newScope.clusterId, newScope.locationId);

    // Step 3: Classify transition
    let kind = classifyTransition(current, newScope.scope, newScope.clusterId, newScope.locationId);

    // Special case: pos → cluster needs to verify if the new cluster is the same as
    // the pos location's parent. If different, it's lateral per the spec.
    if (current.scope === 'pos' && newScope.scope === 'cluster') {
      // Resolve current location's parent cluster
      const locRows = await (db.scopedFrom(locations, eq(locations.id, current.scopeLocationId!)) as unknown as Promise<(typeof locations.$inferSelect)[]>);
      const loc = locRows[0];
      if (!loc) {
        throw new NotFoundError({ code: 'not_found.location', message: `Location ${current.scopeLocationId} not found` });
      }
      if (loc.clusterId !== newScope.clusterId) {
        // pos → cluster (different parent) = lateral per spec
        kind = 'lateral';
      }
      // else: pos → cluster (same parent) = widening — kind stays 'widening'
    }

    // Lateral: always rejected
    if (kind === 'lateral') {
      throw new ScopeMutationError({
        code: 'vendor.scope_lateral_not_supported',
        message: 'Lateral scope changes require deactivate + recreate',
        details: { from: current.scope, to: newScope.scope, fromClusterId: current.scopeClusterId, toClusterId: newScope.clusterId, fromLocationId: current.scopeLocationId, toLocationId: newScope.locationId },
      });
    }

    // Compute the update payload
    const updatePayload: Partial<NewVendor> = {
      scope: newScope.scope,
      scopeClusterId: newScope.clusterId ?? null,
      scopeLocationId: newScope.locationId ?? null,
    };

    if (kind === 'widening') {
      // Widening: unconditional UPDATE
      return withTransaction(db, opts.actorUserId, async (tx) => {
        const rows = await updateReturning<Vendor>(
          tx.scopedUpdate(vendors).set(updatePayload).where(eq(vendors.id, id)).returning(),
        );
        const after = rows[0];
        if (!after) throw new NotFoundError({ code: 'not_found.vendor', message: `Vendor ${id} not found` });

        await auditLogService.record(tx, {
          action: 'business_action',
          tableName: 'vendors',
          rowId: id,
          actorUserId: opts.actorUserId,
          reason: opts.reason,
          before: current as Record<string, unknown>,
          after: after as Record<string, unknown>,
          context: {
            event: 'scope_widening',
            from: current.scope,
            to: newScope.scope,
            fromClusterId: current.scopeClusterId,
            fromLocationId: current.scopeLocationId,
            toClusterId: newScope.clusterId ?? null,
            toLocationId: newScope.locationId ?? null,
          },
        });
        return after;
      });
    }

    // Narrowing: compute dropped location IDs and check open transactions
    // ---------------------------------------------------------------------------
    // Compute the set of locations falling OUT of the new scope.
    // We query all locations within the brand that are currently accessible to this
    // vendor under its old scope, then subtract those still accessible under new scope.
    //
    // Implementation strategy per scope transition:
    //   brand → cluster: drop locations whose cluster_id != newClusterId
    //   brand → pos:     drop all locations except the new locationId
    //   cluster → pos:   drop all locations in the prior cluster except the new locationId

    let droppedLocationIds: string[] = [];

    if (current.scope === 'brand' && newScope.scope === 'cluster') {
      // Locations in other clusters that lose access
      const allLocs = await (db.scopedFrom(locations) as unknown as Promise<(typeof locations.$inferSelect)[]>);
      droppedLocationIds = allLocs
        .filter((l) => l.clusterId !== newScope.clusterId)
        .map((l) => l.id);
    } else if (current.scope === 'brand' && newScope.scope === 'pos') {
      // All locations except the one new locationId
      const allLocs = await (db.scopedFrom(locations) as unknown as Promise<(typeof locations.$inferSelect)[]>);
      droppedLocationIds = allLocs
        .filter((l) => l.id !== newScope.locationId)
        .map((l) => l.id);
    } else if (current.scope === 'cluster' && newScope.scope === 'pos') {
      // Locations in the prior cluster except the new locationId
      const clusterLocs = await (db.scopedFrom(locations, eq(locations.clusterId, current.scopeClusterId!)) as unknown as Promise<(typeof locations.$inferSelect)[]>);
      droppedLocationIds = clusterLocs
        .filter((l) => l.id !== newScope.locationId)
        .map((l) => l.id);
    }

    // Check for open transactions at the dropped locations
    const hasOpen = await vendorService.hasOpenTransactionsAt(db, id, droppedLocationIds);
    if (hasOpen) {
      throw new ScopeMutationError({
        code: 'vendor.scope_narrow_blocked_by_open_transactions',
        message: 'Cannot narrow vendor scope: open purchase orders or goods receipts exist at locations losing access',
        details: { droppedLocationIds },
      });
    }

    return withTransaction(db, opts.actorUserId, async (tx) => {
      const rows = await updateReturning<Vendor>(
        tx.scopedUpdate(vendors).set(updatePayload).where(eq(vendors.id, id)).returning(),
      );
      const after = rows[0];
      if (!after) throw new NotFoundError({ code: 'not_found.vendor', message: `Vendor ${id} not found` });

      await auditLogService.record(tx, {
        action: 'business_action',
        tableName: 'vendors',
        rowId: id,
        actorUserId: opts.actorUserId,
        reason: opts.reason,
        before: current as Record<string, unknown>,
        after: after as Record<string, unknown>,
        context: {
          event: 'scope_narrowing',
          from: current.scope,
          to: newScope.scope,
          fromClusterId: current.scopeClusterId,
          fromLocationId: current.scopeLocationId,
          toClusterId: newScope.clusterId ?? null,
          toLocationId: newScope.locationId ?? null,
          droppedLocationIds,
        },
      });
      return after;
    });
  },

  // -------------------------------------------------------------------------
  // Epic 5 stub — hasOpenTransactionsAt
  // -------------------------------------------------------------------------

  /**
   * Stub for Epic 5 to wire — narrowing precondition check.
   *
   * Returns true if the vendor has open transactions (purchase_orders or goods_receipts)
   * at any of the specified location IDs.
   *
   * EPIC 1 STUB: Always returns false — no PO/GR tables exist yet.
   * Epic 5 PR will replace this body with a real query against purchase_orders and
   * goods_receipts filtering by vendor_id + location_id + status = 'open'.
   *
   * The method is on the service object (not a module-level function) so that
   * integration tests can spy on it via vi.spyOn(vendorService, 'hasOpenTransactionsAt').
   */
  async hasOpenTransactionsAt(
    _db: BrandedDb,
    _vendorId: string,
    _locationIds: string[],
  ): Promise<boolean> {
    // STUB: Epic 1 — PO/GR tables do not exist yet. Epic 5 will wire this.
    // When wired: query purchase_orders WHERE vendor_id = _vendorId
    //             AND location_id = ANY(_locationIds) AND status IN ('draft','submitted','approved')
    //             UNION ALL goods_receipts WHERE vendor_id = _vendorId ...
    return false;
  },

  // -------------------------------------------------------------------------
  // DL-026 fuzzy-name lookup (CC-DUPLICATE-WARN consumer)
  // -------------------------------------------------------------------------

  /**
   * DL-026: Return vendors for the caller's brand whose name has trigram similarity
   * >= threshold to `name`, ordered by descending similarity.
   *
   * Uses pg_trgm similarity() via db.raw.execute + sql tag template.
   * The db.raw bypass is required because similarity() is a pg_trgm function not
   * modelled by Drizzle. String concatenation is forbidden — sql template tag only.
   *
   * Symmetric to productService.findSimilarByName.
   */
  async findSimilarByName(
    db: BrandedDb,
    name: string,
    opts?: { threshold?: number; excludeId?: string; limit?: number },
  ): Promise<Array<Vendor & { sim: number }>> {
    const threshold = opts?.threshold ?? 0.85;
    const excludeId = opts?.excludeId ?? null;
    const limit = opts?.limit ?? 5;

    const rows = await db.raw.execute(sql`
      SELECT v.*, similarity(v.name, ${name}) AS sim
      FROM vendors v
      WHERE v.brand_id = ${db.brandId}
        AND v.active = true
        AND (${excludeId}::uuid IS NULL OR v.id <> ${excludeId}::uuid)
        AND similarity(v.name, ${name}) >= ${threshold}
      ORDER BY sim DESC
      LIMIT ${limit}
    `);

    // postgres-js returns rows as an array of objects; cast to the expected shape
    return rows as unknown as Array<Vendor & { sim: number }>;
  },
};

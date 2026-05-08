/**
 * Route helpers shared across resource routers.
 *
 * `param()` coerces an Express 5 `ParamsDictionary` value to a plain string.
 * With multi-handler routes (requirePermission + handler), TypeScript loses
 * the narrow `{ id: string }` inference that single-handler routes get from
 * ParseRouteParameters<>. The cast is safe: named `:params` in route strings
 * always resolve to a single string at runtime; only unnamed `*` patterns
 * can produce `string[]`.
 */

import type { BrandedDb } from '../db/branded-db.js';
import { userService } from '../services/user.service.js';

export function param(p: string | string[] | undefined): string {
  if (Array.isArray(p)) return p[0] ?? '';
  return p ?? '';
}

/**
 * Resolve the cluster_manager actor's clusterId from the database.
 * The JWT does not currently carry clusterId (deferred to a later JWT-claim
 * expansion). When the JWT carries it, this helper can switch to reading
 * from req.user without DB I/O. Single source of truth ensures the migration
 * happens once.
 *
 * Throws when the user has no clusterId — fail-safe for data-integrity drift
 * (a cluster_manager seat without a cluster assignment).
 */
export async function resolveActorClusterId(db: BrandedDb, userId: string): Promise<string> {
  const actor = await userService.get(db, userId);
  if (!actor.clusterId) {
    throw new Error('cluster_manager user has no clusterId assigned');
  }
  return actor.clusterId;
}

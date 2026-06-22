/**
 * Database client setup.
 *
 * Exports:
 * - unscopedDb()  — raw Drizzle client. Used by migrations + pg-boss bootstrap.
 *                   Normal service code must NOT import this directly.
 * - pgClient      — raw postgres.js connection pool.
 *
 * The branded wrapper (brandedDb) lives in branded-db.ts and is the entry point
 * for all service-layer code.
 *
 * LAZY INIT: The postgres + drizzle clients are created on first call to
 * unscopedDb() / pgClient getter. This keeps module load cost low and allows
 * unit tests to import branded-db.ts without opening a real DB connection.
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from '../env.js';
import * as schema from './schema/index.js';

// Lazily initialised singletons
let _queryClient: ReturnType<typeof postgres> | undefined;
let _drizzleClient: ReturnType<typeof drizzle<typeof schema>> | undefined;

function getQueryClient(): ReturnType<typeof postgres> {
  if (!_queryClient) {
    // prepare:false is REQUIRED for Supabase's transaction pooler (PgBouncer),
    // which the serverless/production deploy connects through; it is harmless on
    // a direct local connection. `max` is kept at 1 in production because each
    // serverless instance owns its own short-lived pool and the pooler fans out.
    _queryClient = postgres(env.DATABASE_URL, {
      max: env.NODE_ENV === 'production' ? 1 : 10,
      prepare: false,
    });
  }
  return _queryClient;
}

function getDrizzleClient(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_drizzleClient) {
    _drizzleClient = drizzle(getQueryClient(), { schema });
  }
  return _drizzleClient;
}

/** Raw postgres.js pool — exposed for migrations and diagnostics only. */
export const pgClient = {
  get sql() {
    return getQueryClient();
  },
};

/** Raw Drizzle client — bypasses all brand-id scoping. Migrations + bootstrap only. */
export function unscopedDb() {
  return getDrizzleClient();
}

export type DrizzleClient = ReturnType<typeof drizzle<typeof schema>>;

/**
 * jobs/index — pg-boss boot wiring + module-level singleton.
 *
 * Phase 4 Epic 3 INF Arc (a) Task A10.
 *
 * Singleton accessor pattern (chosen over DI):
 *   The approvalEngine service module is a stateless `export const` object
 *   with no constructor. Wiring pg-boss via DI would require a top-down
 *   refactor of every consumer + every test fixture. Instead, jobs/index.ts
 *   owns one PgBoss instance per process, exposes `getBossInstance()` for
 *   lazy lookup, and the engine no-ops cleanly when null. Tests vi.mock this
 *   module so the engine never calls `boss.send` in unit/integration runs.
 *
 * pg-boss v12 contract (verified against installed @12.18.2):
 *   - `boss.start()` opens the pool + creates the schema if missing.
 *   - `boss.createQueue(name)` is required before `.send` / `.work` (v10+).
 *     The call is idempotent — safe to invoke on every boot.
 *   - `boss.work(name, handler)` registers a worker. v12 hands the handler
 *     a `Job<T>[]` batch (see approval-escalation.ts handleEscalation).
 *   - `boss.stop()` drains gracefully — used by SIGTERM / SIGINT shutdown.
 */

import { PgBoss } from 'pg-boss';
import { env } from '../env.js';
import { APPROVAL_ESCALATION_QUEUE, handleEscalation } from './approval-escalation.js';

export {
  scheduleEscalation,
  APPROVAL_ESCALATION_QUEUE,
  processEscalationJob,
  handleEscalation,
} from './approval-escalation.js';
export type { ApprovalEscalationJob } from './approval-escalation.js';
export { runDailyDigest } from './notification-digest.js';
export type { DigestRunResult } from './notification-digest.js';

let bossInstance: PgBoss | null = null;

/**
 * Boot pg-boss + register the escalation queue + worker.
 * Idempotent — returns the existing instance on repeat calls within a process.
 */
export async function startJobs(): Promise<PgBoss> {
  if (bossInstance) return bossInstance;

  const boss = new PgBoss(env.DATABASE_URL);
  await boss.start();

  // pg-boss v10+: createQueue is required before .work / .send. The call is
  // idempotent and cheap.
  if (typeof (boss as unknown as { createQueue?: unknown }).createQueue === 'function') {
    await boss.createQueue(APPROVAL_ESCALATION_QUEUE);
  }

  await boss.work(APPROVAL_ESCALATION_QUEUE, handleEscalation);

  bossInstance = boss;
  return boss;
}

/**
 * Drain + close the pg-boss pool. Wired into SIGTERM / SIGINT in index.ts.
 */
export async function stopJobs(): Promise<void> {
  if (bossInstance) {
    await bossInstance.stop();
    bossInstance = null;
  }
}

/**
 * Lookup the active boss instance, or null when `startJobs()` was never
 * called (test environment). approvalEngine uses this lazily.
 */
export function getBossInstance(): PgBoss | null {
  return bossInstance;
}

/**
 * Test helper — replace the singleton with a hand-built mock. Returns the
 * previous value so tests can restore it on teardown.
 */
export function setBossInstanceForTests(instance: PgBoss | null): PgBoss | null {
  const prev = bossInstance;
  bossInstance = instance;
  return prev;
}

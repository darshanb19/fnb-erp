/**
 * Vercel serverless entry — handles every `/api/*` request for the production
 * deploy. A vercel.json rewrite (`/api/(.*)` → `/api`) routes all API sub-paths
 * to this single function while preserving the original request path, which is
 * the canonical Vercel + Express integration pattern.
 *
 * It imports a single self-contained bundle (apps/api/dist-vercel/server.mjs,
 * produced by apps/api/scripts/build-vercel.mjs during the Vercel build) whose
 * default export is the constructed Express app. Bundling inlines every
 * dependency (incl. the TypeScript `@fnberp/shared` package) and keeps the
 * module graph ESM end-to-end, avoiding ERR_REQUIRE_ESM and un-transpiled-TS
 * runtime crashes.
 *
 * This directory is marked ESM via api/package.json ("type": "module"). No port
 * is bound and pg-boss is never started here (that lives in
 * apps/api/src/server.ts for traditional hosts), so this is serverless-safe.
 */

import app from '../apps/api/dist-vercel/server.mjs';

export default app;

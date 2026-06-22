/**
 * Vercel serverless entry — handles every `/api/*` request for the production
 * deploy. A vercel.json rewrite (`/api/(.*)` → `/api`) routes all API sub-paths
 * to this single function while preserving the original request path, which is
 * the canonical Vercel + Express integration pattern.
 *
 * It imports the COMPILED app factory from apps/api/dist (built during the
 * Vercel `buildCommand`). Importing the compiled output — rather than the TS
 * source — sidesteps NodeNext `.js`→`.ts` resolution issues during bundling.
 *
 * The Express app is exported as the default handler; Vercel invokes an Express
 * application directly as a (req, res) handler. No port is bound and pg-boss is
 * never started here (that lives in apps/api/src/server.ts for traditional
 * hosts), so this is safe in a serverless context.
 *
 * The Express app mounts its routes under `/api/v1` (plus `/auth`, `/health`),
 * and the rewrite preserves the original request path (e.g. `/api/v1/users`),
 * so the mounts line up without any path manipulation.
 */

import { createApp } from '../apps/api/dist/src/index.js';

const app = createApp();

export default app;

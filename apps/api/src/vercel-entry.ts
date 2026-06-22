/**
 * Bundle entry for the Vercel serverless function.
 *
 * esbuild bundles this (apps/api/scripts/build-vercel.mjs) into a single
 * self-contained ESM file (dist-vercel/server.mjs) with every dependency
 * inlined — including the `@fnberp/shared` workspace package, whose source is
 * TypeScript and would otherwise crash at runtime when copied un-transpiled.
 *
 * Exports the constructed Express app as default; the Vercel function
 * (api/index.ts) re-exports it as its handler.
 */

import { createApp } from './index.js';

export default createApp();

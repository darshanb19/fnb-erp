/**
 * Bundles the Express API into a single self-contained ESM file for the Vercel
 * serverless function (api/index.ts imports the output).
 *
 * Why a custom bundle instead of letting @vercel/node trace the deps:
 *  - The API package is ESM ("type": "module"); @vercel/node was treating the
 *    repo-root function as CJS and require()-ing it → ERR_REQUIRE_ESM.
 *  - `@fnberp/shared` ships TypeScript source (main = src/index.ts); the file
 *    tracer copies it un-transpiled and Node can't execute it at runtime.
 * esbuild bundling inlines + transpiles everything, sidestepping both.
 *
 * Bundles from the compiled dist (apps/api/dist/src/vercel-entry.js) so all
 * relative imports are real .js; esbuild resolves the bare `@fnberp/shared`
 * specifier to its TS source and transpiles it inline.
 */

import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url)); // apps/api/scripts
const apiRoot = path.resolve(here, '..'); // apps/api

await build({
  entryPoints: [path.join(apiRoot, 'dist/src/vercel-entry.js')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: path.join(apiRoot, 'dist-vercel/server.mjs'),
  // pg-native is an optional native dep of `pg` (pulled in via pg-boss). It is
  // not installed and pg falls back gracefully, so leave it external.
  external: ['pg-native'],
  // Shim CJS globals for any bundled CommonJS deps that reference them, since
  // the output is ESM.
  banner: {
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      "import { fileURLToPath as __fileURLToPath } from 'node:url';",
      "import { dirname as __pathDirname } from 'node:path';",
      'const require = __createRequire(import.meta.url);',
      'const __filename = __fileURLToPath(import.meta.url);',
      'const __dirname = __pathDirname(__filename);',
    ].join('\n'),
  },
  logLevel: 'info',
});

console.log('[build-vercel] bundled apps/api → dist-vercel/server.mjs');

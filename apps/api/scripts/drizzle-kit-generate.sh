#!/bin/sh
# Wrapper for drizzle-kit generate that loads the tsx/cjs hook first.
# Required because drizzle-kit's embedded esbuild-register does not remap
# .js extension imports to .ts files (ESM TypeScript convention).
# tsx/cjs handles the remapping transparently.
#
# Must be run from the apps/api directory (pnpm script CWD).
exec node \
  -r tsx/cjs \
  node_modules/drizzle-kit/bin.cjs \
  generate "$@"

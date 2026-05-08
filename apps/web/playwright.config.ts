/**
 * playwright.config.ts — Playwright e2e configuration for apps/web.
 *
 * IMPORTANT: apps/api must be running externally on http://localhost:3001
 * BEFORE running `pnpm test:e2e`. This config auto-starts apps/web on
 * http://localhost:5174 via the webServer entry, but it does NOT start apps/api.
 *
 * In CI, add a separate step to boot apps/api:
 *   `cd apps/api && pnpm dev &`
 *
 * Locally:
 *   1. Start apps/api:   cd apps/api && pnpm dev   (or use the background shell)
 *   2. Run tests:        cd apps/web && pnpm test:e2e
 *
 * Auth strategy (DL-033 swap):
 *   - globalSetup runs once before any spec; it signs in the bootstrap BO
 *     against the Mumbai Supabase Auth project and writes:
 *       tests/e2e/.auth-state.json    — access token + brand/user IDs for direct
 *                                       apps/api calls (specs that seed data)
 *       tests/e2e/.storage-state.json — Playwright storageState with the
 *                                       Supabase localStorage entry pre-loaded
 *   - `use.storageState` makes every page context start signed-in.
 */

import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // single-thread — all e2e tests share one DB; parallel writes cause races
  retries: 0,          // strict; flaky tests must be fixed, not retried
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    headless: true,
    storageState: './tests/e2e/.storage-state.json',
  },
  webServer: {
    // Start apps/web for the test run. apps/api must already be running on :3001.
    command: 'pnpm dev',
    url: 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})

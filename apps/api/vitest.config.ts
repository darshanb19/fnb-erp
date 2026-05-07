import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    // Set env vars before any test file is loaded.
    // DATABASE_URL is the primary DB — for integration tests, this is fnberp_test.
    // TEST_DATABASE_URL can override the integration test DB explicitly.
    env: {
      DATABASE_URL: process.env['DATABASE_URL'] ?? 'postgresql://darshan@localhost:5432/fnberp_test',
      TEST_DATABASE_URL:
        process.env['TEST_DATABASE_URL'] ?? 'postgresql://darshan@localhost:5432/fnberp_test',
      NODE_ENV: 'test',
      SUPABASE_JWT_SECRET: 'test-secret',
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role',
      PORT: '3001',
    },
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
    ],
    // Integration tests need more time (real DB calls).
    testTimeout: 30_000,
  },
});

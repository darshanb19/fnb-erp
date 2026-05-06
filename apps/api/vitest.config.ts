import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    // Set env vars before any test file is loaded.
    // DATABASE_URL must be a valid URL for zod's .url() validator.
    env: {
      DATABASE_URL: process.env['DATABASE_URL'] ?? 'postgres://localhost:5432/fnberp_test',
      NODE_ENV: 'test',
    },
    include: ['tests/**/*.test.ts'],
    // Unit tests don't need a real DB — they stub the underlying client.
    // Integration tests (added in Task A5) use a separate vitest project.
    testTimeout: 10_000,
  },
});

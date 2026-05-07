/**
 * api-config — reads runtime env vars for the API layer.
 *
 * Centralised here so api-client.ts and any future service helpers
 * all read from one place instead of scattering import.meta.env calls.
 *
 * VITE_API_BASE_URL defaults to http://localhost:3001 (apps/api default port
 * per apps/api/src/env.ts PORT default).
 */

export const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

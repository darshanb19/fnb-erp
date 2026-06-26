/**
 * api-config — resolves the API base URL for the client layer.
 *
 * Centralised here so api-client.ts and any future service helpers all read
 * from one place instead of scattering import.meta.env calls.
 *
 * Why this resolves from the RUNTIME hostname rather than `import.meta.env.DEV`:
 * in this toolchain `vite build` does NOT reliably set DEV=false, so a build
 * could (and did) bake `http://localhost:3001` into the production bundle —
 * shipping a fully-empty live app where every data fetch hit
 * ERR_CONNECTION_REFUSED against localhost. The deployed app is always served
 * same-origin with its API under /api, and only needs a separate API origin
 * when served from the local Vite dev server. So we decide at runtime:
 *
 *   1. An explicit NON-local VITE_API_BASE_URL override always wins
 *      (e.g. a staging API on a different host).
 *   2. When the page is served from localhost / 127.0.0.1 → use the configured
 *      value, else the local apps/api default port (http://localhost:3001).
 *   3. Any other (deployed) host → '' → relative, same-origin requests to /api.
 */

const configured = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1)$/;
const isLocalConfigured = /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(configured);

function resolveBaseUrl(): string {
  // Explicit non-local override (staging/preview pointing at a remote API).
  if (configured && !isLocalConfigured) return configured;

  const host =
    typeof window !== 'undefined' && window.location ? window.location.hostname : '';
  if (LOCAL_HOST_RE.test(host)) {
    return configured || 'http://localhost:3001';
  }

  // Deployed on any non-local host → same-origin requests to /api.
  return '';
}

export const API_BASE_URL: string = resolveBaseUrl();

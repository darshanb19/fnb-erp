# Design — Production Shell & API Wiring Fix

**Date:** 2026-06-26
**Author:** AI-assisted (founder-directed)
**Status:** Approved — proceeding to implementation
**Scope:** `apps/web` only. No backend, schema, or design-token changes.

## Problem

The founder reported "the design system is not correctly implemented — all screens look
wrong" on the live site (https://fnb-erp-smoky.vercel.app). Investigation (curl of the
live HTML/CSS/JS, Playwright login + screen render, console-error capture, git/dist
inspection) found the design tokens and individual screens are built correctly. The
"all screens look wrong" symptom has **two distinct root causes**, both wiring/deploy
defects — not design defects:

### Root cause 1 — API base URL baked to `localhost` (every screen loads empty)

The deployed JS bundle resolves the API base to `http://localhost:3001`
(`e6="http://localhost:3001"` in the live `index-BcvIglKb.js`). The live bundle's content
hash is **identical to a local `dist/` built with `apps/web/.env.local` present**, which
sets `VITE_API_BASE_URL=http://localhost:3001`. So the production deploy was a *local*
build that baked in the dev API address, instead of a clean build resolving to same-origin
`/api`.

Evidence:
- Browser console on `/inventory/stock`: `ERR_CONNECTION_REFUSED @ http://localhost:3001/api/v1/departments`.
- `GET https://fnb-erp-smoky.vercel.app/api/v1/departments` → **HTTP 401** (auth-required JSON),
  proving the real same-origin API is deployed and healthy.
- Vercel production env vars do **not** include `VITE_API_BASE_URL` — a clean Vercel build
  would already resolve correctly to `''` (same-origin).

[api-config.ts](../../../apps/web/src/lib/api-config.ts) logic is *correct* for a clean
build (`import.meta.env.DEV ? localhost : ''`), but offers no defense against a leaked
`localhost` value in a production build.

### Root cause 2 — the cockpit app shell is never mounted (no chrome anywhere)

[AppShell.tsx](../../../apps/web/src/components/shell/AppShell.tsx) implements the
DESIGN.md §5.1.5 dark-teal sidebar + §5.4 top bar + persona switcher + epic-grouped nav.
It is fully built but **never rendered** — [App.tsx](../../../apps/web/src/App.tsx) routes
each of the 40 pages raw (each individually wrapped in `<RequireAuth>`), with no layout
route mounting `<AppShell>`. So every signed-in page is bare content with no sidebar, no
top bar, no branding. The landing route `/` renders `HomePage` — a dev scaffold explicitly
commented "minimal, just enough to navigate" (a plain list of links).

Additionally, AppShell builds its nav from `screen-catalog` using `/${s.id}` paths
(e.g. `/SI-MDM-001`) which do **not** match the real routes (`/mdm/hierarchy`, …). So even
once mounted, the nav would point at dead URLs, and would list all 112 catalog screens
(only ~34 are built).

## Goals

1. Production app talks to its own same-origin `/api` — every data screen loads real data.
2. Every signed-in screen renders inside the cockpit shell (sidebar + top bar + branding).
3. Sidebar navigation links only the built screens, grouped by epic, pointing at real routes.
4. `/` shows a clean, on-brand welcome home inside the shell (not a dev link list).
5. A `localhost` API value can never again leak into a production build.

Non-goals: redesigning any screen; building data-dashboard tiles on the home (deferred);
backend/schema/token changes; touching future-epic screens (PUR…RPT) that aren't built.

## Design

### Change 1 — Harden `apps/web/src/lib/api-config.ts`

Resolve the base URL so that in a **production build** a `localhost`/`127.0.0.1` value is
ignored (falls back to same-origin `''`), while a legitimate non-local override is still
honoured. In dev, behaviour is unchanged (configured value, else localhost default).

```ts
const configured = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
const isLocalUrl = /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(configured)

export const API_BASE_URL: string = import.meta.env.DEV
  ? configured || 'http://localhost:3001'
  : configured && !isLocalUrl
    ? configured
    : ''
```

This makes the production bundle correct regardless of whether `.env.local` leaks into the
build — defense in depth on top of the clean-deploy fix.

### Change 2 — `apps/web/src/lib/screen-routes.ts` (new)

A single `SCREEN_ROUTES: Record<string, string>` mapping built screen ids → real route
paths (the top-level navigable screens only — excludes param/drill-through/route-only
screens: SI-USR-002/003/004/006/008, SI-INV-002, SI-INF-006/008/010). This is the single
source of truth for which catalog screens are navigable.

### Change 3 — AppShell nav consumes the route map

`AppShell.tsx` nav rendering filters `screensByEpic` to screens present in `SCREEN_ROUTES`,
links to `SCREEN_ROUTES[s.id]` (not `/${s.id}`), and computes `isActive` against the real
path. Epics with zero built screens render no group. No other AppShell changes (chrome,
persona switcher, branding stay as-is). The "Phase 2c-S2 scaffold" footer label is removed.

### Change 4 — `App.tsx` mounts AppShell as a layout route

Restructure the router so all authenticated screens are children of one layout route:

```tsx
<Routes>
  {/* public */}
  <Route path="/login" element={<LoginPage />} />
  <Route path="/reset-password" element={<PasswordResetPage />} />
  <Route path="/reset-password/:token" element={<PasswordResetPage />} />
  <Route path="/_dev/components" element={<ComponentsIndex />} />

  {/* authenticated — wrapped once in RequireAuth + AppShell (which renders <Outlet/>) */}
  <Route element={<RequireAuth><AppShell /></RequireAuth>}>
    <Route path="/" element={<HomePage />} />
    <Route path="/mdm/hierarchy" element={<HierarchyPage />} />
    … all existing authed routes as children, minus their per-route RequireAuth …
    {/* RequirePermission wrappers on INF routes are preserved inside element */}
  </Route>
</Routes>
```

`RequireAuth` is hoisted from every route to the single layout route. Per-route
`RequirePermission` guards (INF screens) are preserved. Route ordering nuances (static
before `:id` for transfers/goods-receipts) are preserved.

### Change 5 — `HomePage` becomes a clean welcome home

Replace the dev link-list `HomePage` with an on-brand welcome panel rendered inside the
shell's content area: greeting, signed-in role + brand, a short set of quick links to the
most-used screens (stock, approvals, below-PAR, goods receipt). Tokens only (no hex), Inter,
Lucide icons, existing shell components where applicable. The `loading`/`unauthenticated`
branches collapse — auth is now handled by the layout `RequireAuth`, so `HomePage` only
renders for an authenticated session.

## Verification

- `pnpm --filter @fnberp/web typecheck` → silent.
- `pnpm --filter @fnberp/web build` → clean; built JS resolves `API_BASE_URL` to `""`
  (grep the dist bundle: `e?="http://localhost:3001"` must NOT be the resolved constant —
  confirm same-origin).
- Local `vite preview` (or dev) sanity: `/` renders the welcome home inside the sidebar
  shell; sidebar links navigate to real routes; an inner screen renders inside the shell.
- Post-deploy: live `/inventory/stock` makes requests to `/api/...` (same-origin), not
  `localhost:3001`; console has no `ERR_CONNECTION_REFUSED`; data loads.

## Deploy

Founder approved fix → verify locally → **deploy straight to production**. The deploy must
be a clean build (no `.env.local` leak). Two safe paths, in order of preference:
1. Commit to `main`, push, let Vercel build from git (its env lacks `VITE_API_BASE_URL`,
   so the bundle resolves same-origin). Verify the new deployment's bundle + live behaviour.
2. If git auto-deploy is not wired, `vercel --prod` a clean build (with Change 1, localhost
   is rejected in prod regardless).

After deploy: re-run the post-deploy verification above against the live URL. Record the
deploy as a new decision-log entry (DL-058+) and update `## Current phase` in `CLAUDE.md`.

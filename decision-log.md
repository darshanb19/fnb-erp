# Decision Log

Append-only log of micro-decisions accumulated during build.

When a small but binding decision is made — naming, ordering, lifecycle states, contract semantics, choosing among options that are not worth promoting to the master spec or the PRD — record it here so the trail survives.

Format:

```
## DL-NNN — YYYY-MM-DD — One-line title

**Decision:** What was decided.
**Source:** Where the question surfaced (review pass, review note ID, story ID).
**Why this matters:** Operational consequence of the decision.
**Cross-references:** Files / FR IDs / spec sections this decision binds.
```

---

## DL-001 — 2026-05-02 — Production Order canonical 5-status lifecycle

**Decision:** The Production Order lifecycle is canonical at five statuses: `Draft → Pending GR (no deduction) → Confirmed (no deduction yet — order is confirmed but not started) → In Progress (deduction fires via inventoryService.deductStock()) → Completed`. Material deduction fires exactly at the In Progress transition — never earlier (Pending GR or Confirmed do not deduct) and never later. The Kitchen Manager explicitly starts the production order, which moves it to In Progress and triggers the deduction.

**Source:** F-002 (Pass A → Pass C carry-forward), confirmed canonical at PRD FR68.

**Why this matters:**
- `inventoryService.deductStock()` (Master Spec §8.1) must be invoked exactly at the In Progress transition. Any earlier invocation prematurely decrements stock; any later invocation breaks the journal-mapping invariant.
- Journal mapping rule per FR89 fires at the same transition: `Production Order moved to In Progress (DR COGS — Raw Material Consumption, CR Inventory — Raw Materials)`. Inventory deduction and COGS journal are atomic.
- Pending GR sub-status uses provisional figures (LKP × standard yield) per FR66; FR67 retrospective adjustment fires on linked GR confirmation; FR67a closure path fires on linked GR rejection.

**Cross-references:** PRD FR64, FR66, FR67, FR67a, FR68, FR89; Master Spec §8.1 inventoryService.deductStock contract; `_planning/prd-review-notes.md` F-002.

---

## DL-002 — 2026-05-05 — Tailwind CSS v3 → v4 amendment

**Decision:** Master Spec §3.1 row "Tailwind CSS | 3.x | ✅ FINAL" amended to "Tailwind CSS | 4.x | ✅ FINAL — superseded 3.x at Phase 2c-prep, see DL-002". Phase 2c mockup harness pins Tailwind v4 exactly (no caret) per Phase 2c plan §10.1. v4's `@theme` directive is the canonical mechanism for token wiring per Phase 2c plan §10.6 globals.css spec.

**Source:** Phase 2c-prep mockup-build planning (commit `d8333db` — 8 additions from web review including Tailwind v4 token reconciliation; commit `da1c35f` — Session 1 brainstorming captured Q6 shadcn ↔ DESIGN.md token reconciliation confirming v4). Critique-fix surface 2026-05-05: Master Spec §3.1 said v3, Phase 2c plan §10.1 + §19 Q6 + §20 said v4 (silent governance violation per §3 "do not work around it silently").

**Why this matters:**
- Master Spec §3 governance clause permits formal change requests; this DL entry IS the formal change request, not a silent override.
- shadcn/ui defaults to v4 by 2026-05; v3 lock dated from a spec written when v3 was the shadcn default. v4 is the current ecosystem default.
- v4's `@theme` directive is what Phase 2c plan §10.6 globals.css spec is built around. Rolling back to v3 means rewriting the scaffold spec.
- All downstream Phase 2c-scoped + Phase 4 frontend code now references v4 patterns; locking the spec to v4 prevents drift.

**Cross-references:** Master Spec §3.1 (Tailwind row); Phase 2c plan §10.1 (Dependencies), §10.6 (globals.css), §19 Q6 (Session 1 brainstorming capture), §20 (Session 2 kickoff); commits `d8333db`, `da1c35f`; CLAUDE.md "Critical rules" (DESIGN.md token reference).

---

## DL-003 — 2026-05-05 — Phase 3a Architecture before Phase 2c-scoped mockups (re-sequencing)

**Decision:** Re-sequence original Phase 2 → Phase 3a → Phase 4 ordering. New canonical sequence: **Phase 3a (Architecture) → Phase 2c-scoped (15 foundation mockups) → Phase 4 (epic implementation with mockup-as-you-build)**. Phase 2c scoped down from original 89 mockups across 8–12 sessions to 15 mockups across 3 sessions (S2 scaffold + S3 Tier 1 Group 1 + S4 Tier 1 Group 4 + selected G2 [DSP-010 + PRO-011]). Tier 2 / Tier 3 / Index mockups defer to Phase 4 epic-by-epic mockup-as-you-build territory.

**Source:** Phase 2c plan §19 Q7 (post-Session-1 follow-up); roadmap re-sequencing 2026-05-05; commit `eaf0959`.

**Why this matters:**
- Architecture decisions (OQ3 real-time, OQ4 offline, OQ5 PDF library, OQ7 background jobs, OQ8 caching) ripple into mockup design choices. Mockups built before architecture risk aspirational designs the architecture can't deliver — requiring rework when reality surfaces.
- Foundation chrome benefits from architecture knowledge (e.g., dashboards designed knowing "REST query, not Realtime subscription" produce different UX — visible refresh button, last-updated timestamp).
- Scope reduction is real: 89 mockups upfront is too much for solo non-technical founder; most are repetitive standard CRUD patterns the screen inventory already specifies.
- Phase 4 epic-by-epic mockup-as-you-build keeps mockups aligned with epic-level architectural reality (with a chrome-freeze gate per epic to prevent cross-epic chrome drift).

**Cross-references:** `_planning/06-phase-roadmap.md` (canonical phase sequence); Phase 2c plan §19 Q7 (re-sequencing decision capture); Phase 2c plan §1 (Status revision); commit `eaf0959`.

---

## DL-004 — 2026-05-05 — OQ9 UI design tool resolution: in-repo Vite + shadcn (formal capture)

**Decision:** Master Spec §11 OQ9 (UI design tool selection — Stitch / Claude Imagine / hybrid) RESOLVED. Chosen path: in-repo Vite + React + Tailwind + shadcn/ui in this Claude Code workspace. NOT Google Stitch, NOT claude.ai Artifacts, NOT a hybrid of the two. Original §11 OQ9 options list (Stitch / Imagine / hybrid) is superseded — the chosen path was not on that list.

**Source:** Phase 2c-prep tooling review thread (commits `d8333db`, `da1c35f`); Phase 2c plan §3 Tooling decision (already made); §19 Q1–Q6 confirming the workspace.

**Why this matters:**
- shadcn/ui is FINAL per Master Spec §3.1; the in-repo Vite workflow gives mechanical token enforcement (Tailwind config typo = build error), shared shell components (edit once, all screens update), and engineer handoff fidelity (`git checkout` instead of paste-the-block translation).
- Stitch rejected: Gemini-powered (voice drift from Claude), structured design-system data model holds ~25% of DESIGN.md (rest collapses into free-form `designMd`), output not directly extractable as React, async generation hurts iteration scale.
- claude.ai Artifacts rejected: sandboxed Tailwind, no shared component file (paste-the-block fails at scale), engineer handoff requires translation, Inter font load unreliable, voice drift across chats.
- Phase 3a captures this formally in `_planning/architecture.md` so the decision survives reset. Architecture-phase scope on OQ9 = formal capture, not re-debate.

**Cross-references:** Master Spec §11 OQ9 (now RESOLVED); Phase 2c plan §3 Tooling decision; commits `d8333db`, `da1c35f`; `_planning/06-phase-roadmap.md` Phase 3a OQ list (OQ9 marked already-decided).

---

## DL-005 — 2026-05-05 — Mockups-vs-production-code seed relationship

**Decision:** `mockups/` (Phase 2c-scoped Vite + React + Tailwind + shadcn harness) is **visual specification, not production code seed**. Phase 4 epic implementation builds production code in `apps/web` + `apps/api` per Master Spec §3.2 monorepo structure, consuming `mockups/` as visual reference + reusing the 21 shell components (CC-* patterns) by copy-port (NOT by import dependency). The two trees stay separate.

**Source:** Critique-fix surface 2026-05-05; Phase 2c plan §1 ("Mockups are visual specification, not production code"); Master Spec §3.2 (Monorepo with `apps/web` + `apps/api` + `packages/shared`).

**Why this matters:**
- Avoids forcing Phase 2c mockup decisions (Vite-isms, no real auth, no real API, no error boundaries) into production code constraints.
- Phase 4 production code gets fresh React with proper Drizzle data layer, real Supabase auth, error boundaries, accessibility hardening, loading states — without dragging mockup-only fixtures forward.
- 21 shell components copy-port from `mockups/src/shell/` to `apps/web/src/components/shell/` at the start of Phase 4 (one-time migration); subsequent Phase 4 changes don't propagate back to mockups (mockups become frozen visual reference).
- Master Spec §3.2 implies this answer (separate monorepo apps); explicit DL capture so Phase 3a doesn't re-litigate "should mockups become the production tree?".

**Cross-references:** Master Spec §3.2 (Monorepo); Phase 2c plan §1 (Goal — visual specification language); `_planning/06-phase-roadmap.md` Phase 4 (per-epic frontend code consuming foundation chrome).

---

## DL-006 — 2026-05-05 — OQ1 Monorepo tooling: Turborepo on pnpm workspaces

**Decision:** Master Spec §11 OQ1 (Monorepo tooling — Turborepo vs Nx vs pnpm workspaces) RESOLVED. Chosen: **Turborepo orchestrator on top of pnpm workspaces.** Package manager is pnpm; pnpm workspaces define the monorepo shape (`apps/web`, `apps/api`, `packages/shared`); Turborepo runs the task graph (`build`, `lint`, `typecheck`, `test`, `dev`) with local caching from day one. Remote caching deferred — enable only if GitHub Actions CI minutes become painful in Phase 4.

**Source:** Phase 3a brainstorming session 2026-05-05 (OQ1 — first OQ in the constraint-flow sequence per `_planning/06-phase-roadmap.md` Phase 3a kickoff prompt).

**Why this matters:**
- **Vercel-native pairing.** Frontend deploys to Vercel (Master Spec §3.1 FINAL); Turborepo is Vercel-built and Remote Cache integrates with zero friction when we choose to enable it.
- **Minimal config burden vs Nx.** `turbo.json` is ~30 lines for our shape (2 apps + 1 shared package). Nx's `nx.json` + per-package `project.json` + generator system is overkill for a solo developer driving Claude Code; large config surface = more places for AI agent to misconfigure or hallucinate.
- **CI-cache compounds across 12 epics.** GitHub Actions (FINAL §3.1) runs typecheck + lint + test on every PR. Turbo caches per-package: a PR touching only `apps/api` skips the `apps/web` test suite. With 12 epics ahead × many per-epic PRs, the cache savings compound.
- **No vendor lock-in.** If we ever drop Turbo, `pnpm -r build` still works. Nx is harder to walk away from (project-graph metadata embedded across packages).
- **Plain pnpm workspaces rejected:** acceptable today, but no task graph + no caching = re-running the full build on every change. Pain compounds across 12 epics.
- **Nx rejected:** correct call for 5+ engineer teams with strict dependency boundaries and many independently-versioned packages — neither describes this project.

**Cross-references:** Master Spec §3.2 (Monorepo — Shared types in `packages/shared`, frontend in `apps/web`, backend in `apps/api`); Master Spec §3.1 (Vercel FINAL, GitHub Actions FINAL); Master Spec §11 OQ1 (now RESOLVED); `_planning/06-phase-roadmap.md` Phase 3a kickoff prompt (constraint-flow OQ ordering).

---

## DL-007 — 2026-05-05 — OQ2 Backend deployment target: Railway (Mumbai region)

**Decision:** Master Spec §11 OQ2 (Backend deployment target — Railway vs Render vs Fly.io) RESOLVED. Chosen: **Railway, deployed to the Mumbai (asia-southeast1-equivalent India) region.** Express.js API process (Master Spec §3.1 FINAL) runs as a Railway service connected to the GitHub `apps/api` workspace via Turborepo (DL-006). PR preview environments enabled from day one. Hobby plan to start; usage-based billing scales with load.

**Implicit downstream commitment:** Supabase project (Master Spec §3.1 FINAL — Postgres + Auth + Realtime + Storage) MUST be provisioned in **ap-south-1 (Mumbai)** to realize the co-location latency rationale below. This is a Phase 4 Epic 1 setup-task obligation — surface it explicitly in the Phase 3a architecture build plan so it isn't accidentally provisioned in `us-east-1` default at infra-bootstrap time.

**Source:** Phase 3a brainstorming session 2026-05-05 (OQ2 — second OQ in the constraint-flow sequence; affects job engine OQ7 + real-time OQ3 + caching OQ8 downstream).

**Why this matters:**
- **India latency is the deciding factor.** Multi-store F&B operation in India with Supabase Mumbai → API process MUST be in same region for sub-50ms DB roundtrips. Render has no India region (closest is Singapore, ~80–120ms RTT to Mumbai DB); Express middleware that does N+1 enablement checks (`inventoryService.checkEnablement` per Master Spec §7.3) compounds latency visibly across regions.
- **PaaS DX matches solo non-technical founder workflow.** Railway = "push to main, see it deployed, click for logs." Fly.io's machines/apps mental model + CLI-first deploy is more powerful but more ops surface than this user/AI-assisted workflow needs.
- **PR preview environments built-in.** Phase 4 produces many PRs (per-epic, per-story); PR-URL stakeholder demos are gold. Built-in on Railway. Built-in on Render too — but Render lost on the India-region gap. Manual setup on Fly.
- **No vendor lock-in.** Railway uses `nixpacks` / `Procfile` defaults — the same Node 20 app runs unchanged on Render, Fly, or self-hosted later. Walk-away cost is environment-variable wiring only.
- **Cost is not the deciding factor.** All three options are <$30/mo at MVP load.
- **Render rejected:** No native India region; Singapore-Mumbai RTT degrades every API call, compounded across the inventory-heavy domain.
- **Fly.io rejected:** Mumbai region exists and is excellent (would have been the pick on latency alone), but the heavier ops model (machines, fly.toml semantics) and lack of out-of-box PR previews don't justify the trade for solo-AI-assisted workflow at MVP scale. Reconsider post-MVP if multi-region edge deployment becomes a real requirement.

**Cross-references:** Master Spec §3.1 (Express.js FINAL, Node 20+ FINAL, Vercel FINAL frontend, Supabase FINAL DB); Master Spec §11 OQ2 (now RESOLVED); DL-006 (Turborepo monorepo orchestrator); future DL entries on OQ7 (background jobs — must be deployable on Railway) and OQ16 (notification dispatch — same constraint).

---

## DL-008 — 2026-05-05 — OQ8 Caching layer: no Redis in MVP; TanStack Query + Postgres only; recipe-cost-snapshot carve-out

**Decision:** Master Spec §11 OQ8 (Caching layer — Redis additionally for hot paths?) RESOLVED. Chosen: **No additional server-side caching layer in MVP.** TanStack Query (FINAL §3.1) handles client-side server-state caching; Postgres + indexed `brand_id`-scoped reads handle the server-side read path. **One carve-out:** recipe cost roll-up (Master Spec §2.5 yield cascade — recursive across raw → semi → final products) is materialized as a Postgres `recipe_cost_snapshot` table, refreshed on yield-factor or ingredient-price write. This is database-resident memoization (one source of truth in Postgres), not a new caching layer.

**Reconsider trigger:** Phase 4 / post-MVP, gated on production telemetry showing P95 API latency >300ms attributable to recurring read patterns. At that point, evaluate Upstash Redis (Mumbai region; pairs with Railway-Mumbai per DL-007). Do NOT add Redis preemptively.

**Source:** Phase 3a brainstorming session 2026-05-05 (OQ8 — third OQ in the constraint-flow sequence; affects OQ7 background jobs + OQ3 real-time strategy).

**Why this matters:**
- **Invalidation burden = data integrity risk.** Every Master Spec §7.3 service method that mutates enablement / PAR / recipe yield / org hierarchy would need explicit cache-busting calls if Redis were added. Master Spec §2.4 calls a missing enablement check "a data integrity bug, not a style issue" — adding Redis adds exactly the bug class we're trying to prevent. Avoid until load justifies it.
- **MVP load profile doesn't justify Redis.** Single brand × ~10–20 stores × ~50–100 concurrent users. Indexed Postgres reads on `brand_id`-scoped tables sustain this comfortably; Postgres shared buffer cache keeps hot index pages resident.
- **TanStack Query absorbs perceived load.** Client-side `staleTime` + `refetchOnWindowFocus` re-use hierarchy / enablement data across hundreds of UI interactions per session without re-hitting the API.
- **Recipe cost is the one read shape that genuinely needs caching.** Recursive CTE traversal (raw → semi-product → final product) is expensive and queried on every food-cost dashboard hit. Materialized snapshot in Postgres (refreshed on yield-factor / ingredient-price write) keeps the staleness story inside the database — same invalidation discipline as Redis but with one source of truth, not two.
- **In-process LRU rejected:** doesn't survive restart, doesn't span instances if Railway scales to multiple replicas. Stepping stone, not a destination.
- **Upstash Redis rejected for MVP, kept on the table for post-MVP:** correct managed-Redis pick if/when the trigger fires (Mumbai region available, pay-per-request pricing). Premature today.

**Cross-references:** Master Spec §3.1 (TanStack Query FINAL); Master Spec §2.4 (Material enablement enforcement); Master Spec §2.5 (Yield factors and recipe cost cascade); Master Spec §7.3 (Business logic rules — enablement check, recipe roll-up cascade); Master Spec §8.1 (`inventoryService.checkEnablement`); Master Spec §11 OQ8 (now RESOLVED — re-scoped: original "TanStack vs Redis" was a false binary because TanStack is FINAL §3.1; real question was "Redis additionally?"); DL-007 (Railway-Mumbai backend deployment, future Upstash co-location consideration).

---

## DL-009 — 2026-05-05 — OQ7 Background job engine: pg-boss + pg_cron

**Decision:** Master Spec §11 OQ7 (Background job engine — BullMQ vs Inngest vs pg_cron) RESOLVED. Chosen: **pg-boss** (Postgres-backed Node job queue) as the **primary application-level job engine** (notifications, accountant exports, recipe cost recompute, POS sales import, approval escalation, variance calculation, PDF rendering). **pg_cron** (Supabase Postgres extension) as the **complement for DB-only scheduled tasks** (materialized view safety-net refresh, audit log retention sweeps). No Redis. No Inngest in MVP.

**Reconsider triggers (post-MVP):**
- Sustained job throughput >100/sec → migrate to BullMQ + Redis (operational ceiling reached).
- Need durable multi-step workflows with branching / retry-per-step / time-traveling state → migrate to Inngest (its step-function model is genuinely cleaner than rolling our own).

**Source:** Phase 3a brainstorming session 2026-05-05 (OQ7 — fourth OQ in the constraint-flow sequence; depends on OQ2 deployment + OQ8 caching decisions).

**Why this matters:**
- **Transactional job creation = exactly-once for ERP semantics.** pg-boss lets the producer enqueue a job in the **same Postgres transaction** as the business state change (e.g., approval write + notification enqueue commit/rollback together). Eliminates the "job fired but business state didn't commit" failure class that BullMQ-Redis or Inngest force us to defend with outbox patterns. ERP domain is full of "when X is confirmed, do Y" couplings (Master Spec FR67 retrospective cost adjustment on GR confirmation; FR68 deductStock on PO In-Progress per DL-001; journal entry per Master Spec §7.6 on every transaction confirmation).
- **Inherits the "no Redis" decision (DL-008).** Adds zero new infrastructure. Postgres is FINAL §3.1.
- **pg_cron handles SQL-native scheduled tasks elegantly.** `REFRESH MATERIALIZED VIEW recipe_cost_snapshot` nightly as backstop to event-driven refresh from DL-008; `DELETE FROM audit_log WHERE created_at < now() - interval '180 days'` weekly. Not pg-boss's strength (those are SQL-native, not Node functions).
- **Throughput ceiling is not the binding constraint.** pg-boss = hundreds of jobs/sec ceiling vs MVP load = ~hundreds of jobs/day. Three orders of magnitude headroom.
- **Walk-away cost is moderate.** Job *definitions* (business-logic functions) stay portable across pg-boss → BullMQ → Inngest migration. Producer/consumer model is the same shape.
- **BullMQ rejected:** correct call for Redis-backed throughput at scale, but resurrects the Redis decision rejected in DL-008, AND lacks transactional integrity with the business DB. Migration path stays open if MVP load grows.
- **Inngest rejected:** excellent step-function DX, generous free tier — but vendor lock-in on orchestration runtime, US hop adds ~200ms (irrelevant for background work but a dependency to monitor), and step-function complexity is overkill for current job shapes (no branching multi-step workflows in MVP).

**Worker deployment shape:** pg-boss workers run as a separate Railway service (sibling to `apps/api`), sharing the monorepo via Turborepo (DL-006). Worker process subscribes to pg-boss queues and executes jobs; API process produces jobs. Both connect to the same Supabase Postgres (DL-007 Mumbai region). Architecture build plan (Phase 3a deliverable) details the Railway service topology.

**Cross-references:** Master Spec §3.1 (Node 20 FINAL, Express FINAL, Supabase FINAL); Master Spec §7.3 (Business logic rules — enablement, stock movements, approval routing); Master Spec §11 OQ7 (now RESOLVED); DL-001 (Production Order 5-status — In Progress transition fires deductStock + journal entry, both of which use pg-boss for downstream notifications); DL-007 (Railway-Mumbai backend); DL-008 (no Redis in MVP); future DL on OQ16 (Notification Center transport — pg-boss handles dispatch).

---

## DL-010 — 2026-05-05 — OQ3 Real-time strategy: triaged subscription list (5 channels)

**Decision:** Master Spec §11 OQ3 (Real-time strategy — event-triage for Supabase Realtime FINAL §3.1) RESOLVED. **Five Realtime subscription channels in MVP** (all others use polling or on-demand refresh):

| # | Channel | Filter | Why Realtime |
|---|---|---|---|
| 1 | `approval_requests` | `WHERE approver_id = me` | New request landing in queue must appear immediately for approver workflow |
| 2 | `notifications` | `WHERE user_id = me` | In-app Notification Center inbox per FR19 |
| 3 | `production_orders` | `WHERE location_id IN my_locations` | Kitchen Manager observes 5-status lifecycle transitions per DL-001 |
| 4 | `dispatch_challans` | `WHERE source_dept = me OR dest_pos = me` | Dispatch ↔ POS acknowledgement two-direction visibility |
| 5 | `issue_tracker_threads` | `WHERE thread_id IN my_threads` | Collaborative comments / status threads (Epic 3) |

**Polling endpoints (TanStack Query `refetchInterval`):**
- POS sales sync status (Epic 9, FR84) — 60s
- Integration dashboard (FR98) — 30s
- Background job queue depth (admin operations view) — 10s

**On-demand refresh (no auto-update; visible "Refresh" button + "Last updated: HH:MM" stamp):**
- ALL dashboards and reports (Brand Owner Dashboard, Food Cost Control Centre, Trial Balance, P&L, Balance Sheet, Cash Flow, DSR, Variance Reports, Budget vs Actual)
- Inventory level / stock balance views
- Master data (items, vendors, recipes, org hierarchy) — practically static during a session

**Optimistic UI (TanStack Query optimistic mutations + rollback on error):**
- Form submissions with low contention (PO line-item add, recipe edit)
- Approval actions (approve / reject / send-back) — optimistic; Realtime push reconciles

**Source:** Phase 3a brainstorming session 2026-05-05 (OQ3 — fifth OQ in constraint-flow; depends on OQ7 background jobs + OQ8 caching).

**Why this matters:**
- **The triage criterion is "another actor changes state I'm waiting to see."** The five channels share this property; everything else is either reference data, dashboard data, or single-user workflow — none of which need Realtime push.
- **Realtime has cost.** Each subscribed channel = held WebSocket; Supabase Realtime quota and client connection budget both bound how many a session can maintain. Five channels per active session is well within comfortable limits.
- **Dashboards explicitly NOT Realtime.** Per `_planning/06-phase-roadmap.md` re-sequencing rationale §3 — dashboards designed with visible refresh + last-updated timestamp from the start. Foundation chrome (Phase 2c-scoped) bakes this pattern in via SI-RPT-002 Brand Owner Dashboard.
- **Polling > Realtime for slow-changing operational state.** POS sync status / integration dashboard / job queue depth are admin-curiosity views, not collaborative; 10–60s refetch is fine and avoids Realtime quota burn.
- **Optimistic UI for low-contention writes.** The actor *is* the user themselves; Realtime is unnecessary for the same actor's own writes.

**Implementation pattern:** Realtime subscriptions live in TanStack Query's `useQuery` consumers via a `useRealtimeChannel(channelName, filter)` hook that bridges Supabase Realtime events to Query cache invalidation. One consistent pattern across all five channels — not five bespoke implementations. Architecture build plan (Phase 3a deliverable) details the hook signature.

**Cross-references:** Master Spec §3.1 (Supabase Realtime FINAL — vendor was never the question); Master Spec §11 OQ3 (now RESOLVED); `_planning/06-phase-roadmap.md` Phase 3a goals + re-sequencing rationale §3; DL-001 (Production Order 5-status — channel #3); DL-008 (TanStack Query is the single client cache for both polling and Realtime-invalidated queries); future DL on OQ16 (Notification Center — channel #2 is the read side; OQ16 covers the write/dispatch side).

---

## DL-011 — 2026-05-05 — OQ16 Notification Center transport + dispatch model

**Decision:** Master Spec §11 OQ16 (Notification Center transport + dispatch — channels, email provider, dispatch model per FR19) RESOLVED.

**In-app channel:** Write to `notifications` table → Supabase Realtime channel #2 from DL-010 pushes to UI. No queue (Realtime push is instant for the recipient).

**Email channel:** **Resend** (React Email templates, generous free tier — 100/day + 3000/month covers MVP load comfortably, pay-as-you-go scales smoothly post-MVP). Email send is enqueued via **pg-boss** (DL-009) — never synchronous in the originating API request.

**SMS / WhatsApp / mobile push:** Deferred post-MVP. No transport built in MVP.

**Dispatch model: data-driven via `notification_type_config` table** — three dispatch shapes per notification type:

1. **In-app only** — write `notifications` row, Realtime pushes. No email queued.
2. **In-app + immediate email** — write `notifications` row + enqueue `send_email` pg-boss job. User sees in-app instantly; email lands in inbox shortly after.
3. **In-app + batched daily digest email** — write `notifications` row with `digest_eligible: true`. pg_cron job (daily) aggregates pending digestible notifications per user and enqueues a single digest email job per user.

Per-type dispatch shape configured in `notification_type_config(type, in_app, email_mode: 'none'|'immediate'|'digest', digest_window)`. Notification Center §10 spec is data-driven, not hardcoded per-type.

**Source:** Phase 3a brainstorming session 2026-05-05 (OQ16 — sixth OQ in constraint-flow; depends on OQ7 background jobs DL-009 + OQ3 real-time DL-010).

**Why this matters:**
- **In-app uses existing Realtime channel #2 (DL-010)** — no new transport needed; the read side and write side share a single source of truth (`notifications` table).
- **Resend pairs with the React stack.** React Email templates compose with Inter font + DESIGN.md tokens via plain CSS objects; same designer mental model as UI screens. Founder-friendly DX (Vercel-adjacent dev culture); India deliverability comparable to Postmark for transactional volumes.
- **All email through pg-boss (DL-009).** Synchronous send rejected — adds 200–800ms to user-perceived latency, fails open the request on provider hiccup. Queue + retry is the table-stakes pattern.
- **Digest dispatch via pg_cron.** Daily aggregation of `digest_eligible` notifications per user → single email per recipient per day. Reduces inbox noise for managers who don't act on every notification individually (e.g., low-stock daily summary, weekly approval roll-up).
- **Postmark rejected:** premium reputation but more expensive, no compelling reason over Resend at this volume.
- **AWS SES rejected:** cheapest at scale but rougher DX (raw SMTP / sandbox graduation friction); premature at MVP.
- **Supabase built-in email rejected:** Auth emails only; not a general transactional channel.

**Cross-references:** Master Spec §3.1 (Supabase Realtime FINAL); Master Spec §8.3 (`notificationCenter.send`, `sendBulk` contracts); Master Spec §11 OQ16 (now RESOLVED); FR19 (Notification & Alert Center); DL-009 (pg-boss for email job dispatch); DL-010 (Realtime channel #2 — in-app inbox read side).

---

## DL-012 — 2026-05-05 — OQ11 Multi-tenant query pattern: brandedDb factory

**Decision:** Master Spec §11 OQ11 (Multi-tenant query pattern enforcement — Express middleware vs Drizzle wrapper vs `withBrand` builder) RESOLVED. Chosen: **`brandedDb(brandId)` Drizzle factory.**

**Mechanism:**
- Express middleware extracts `brand_id` from the Supabase JWT (`auth.jwt() → user_metadata.brand_id`).
- Middleware constructs a per-request `brandedDb` instance by wrapping Drizzle's query builder; attaches as `req.db`.
- For every org-scoped table, the wrapped builder automatically AND's `brand_id = $brandId` into every SELECT / UPDATE / DELETE.
- INSERT operations on org-scoped tables auto-inject `brand_id = $brandId` into the row payload.
- System tables (`migrations`, `pgboss.*`, system-level audit views) opt out via an explicit non-scoped marker on the table definition (the `brandScopedTable` helper from DL-015 is the canonical mark of "this table is org-scoped"; tables defined with plain Drizzle `pgTable` are non-scoped).
- Service methods receive `brandedDb` (via DI / request scope) and use it like normal Drizzle. **There is no escape hatch in normal service code** — bypass requires explicit use of the underlying unscoped Drizzle client, which is reserved for migrations / housekeeping / pg-boss worker initialization.

**Source:** Phase 3a brainstorming session 2026-05-05 (OQ11 — seventh OQ in constraint-flow; affects every service implementation).

**Why this matters:**
- **Type-level + runtime invariant, not memory discipline.** Master Spec §3.2 + §7.2 say a missing `brand_id` filter is a security vulnerability. Memory-based enforcement (Express middleware that attaches `brandId` to a thread-local for service methods to read) is fragile — one forgotten `WHERE` clause silently leaks cross-tenant data. The factory pattern makes it physically impossible to write that bug in normal service code.
- **Defence-in-depth aligned with §3.2.** RLS policies (DL-014) provide the database-level backstop; `brandedDb` is the application-level primary enforcement. Both layers must be present per Master Spec §3.2 ("RLS = Defence-in-depth, not primary enforcement").
- **Migration to multi-tenant SaaS is a one-line change.** Today: `brand_id` from JWT (single-tenant deployment, brand_id is constant per user). Future: same JWT pattern, but JWT carries the tenant binding. Application code unchanged.
- **Express middleware-only rejected:** attaches `brandId` to request, but service methods still write raw queries that may forget the filter. Not enforcing at the query-builder level = enforcement gap.
- **`withBrand(brandId, queryFn)` higher-order wrapper rejected:** functionally equivalent to `brandedDb` but more verbose (wraps every query in `withBrand(...)`); friction encourages developers to bypass.

**Implementation note for architecture build plan:** The `brandedDb` wrapper is a thin layer over Drizzle — likely 100–200 LOC. Architecture build plan delivers the wrapper alongside the `brandScopedTable` helper (DL-015) so they ship as a co-designed pair in Phase 4 Epic 1 setup.

**Cross-references:** Master Spec §3.2 (RLS = defence-in-depth, Express IS primary enforcement; Single-tenant now, multi-tenant ready); Master Spec §7.2 (Database rules — brand_id filter on every org-scoped query); Master Spec §11 OQ11 (now RESOLVED); DL-014 (RLS policy template — defence-in-depth pair); DL-015 (`brandScopedTable` helper — table-side declaration that this wrapper enforces).

---

## DL-013 — 2026-05-05 — OQ12 Audit trail: application-layer primary, trigger backstop on critical tables

**Decision:** Master Spec §11 OQ12 (Audit trail mechanism — triggers vs application-layer) RESOLVED. Chosen: **application-layer primary via `auditLog.record(...)` called from service methods**, with **Postgres trigger backstop on a critical-table set**.

**Application-layer pattern:**
- Every service-layer mutation calls `auditLog.record({ action, before, after, reason, trnRef, context })` after the mutation succeeds.
- The call is **inside the same transaction** as the mutation (audit row commit is atomic with business commit; pg-boss-style transactional integrity per DL-009).
- Captures business context that triggers cannot see: human-supplied `reason` (override price justification, manual adjustment rationale), originating `trnRef`, screen / story `context`.

**Trigger backstop tables (small, explicit list — these are the "if data here changes silently, it's a security incident" tables):**
- `users` — RBAC role/scope changes
- `enablement_matrix` — material × department enablement (Master Spec §2.4 calls this a data integrity domain)
- `recipes` — yield factor + cost (Master Spec §2.5 cascade impact)
- `chart_of_accounts` — accounting structure (Master Spec §6 reporting integrity)

Triggers on these four tables write `audit_log` rows on INSERT/UPDATE/DELETE with `actor_user_id` from `current_setting('app.user_id', true)` (set by `brandedDb` middleware in DL-012). Reason field is null when triggered (no business context); when both layers fire (application + trigger), prefer the application-layer row (richer context).

**Schema sketch:**
```
audit_log (
  id uuid pk, brand_id uuid fk, occurred_at timestamptz,
  actor_user_id uuid, table_name text, row_id text,
  action text,         -- 'insert' | 'update' | 'delete' | 'business_action'
  changed_fields jsonb,
  before jsonb, after jsonb,
  reason text,         -- application-layer only; null from trigger
  trn_reference text,
  context jsonb
)
```

**Source:** Phase 3a brainstorming session 2026-05-05 (OQ12 — eighth OQ in constraint-flow; affects schema + service-layer wrappers; depends on OQ11 brandedDb wrapper for actor identity propagation).

**Why this matters:**
- **Business context is the high-value audit signal.** FR20/FR21 + CC-AUDIT-LINK want to surface the *why*, not just the *what*. "Who changed this price and what business reason did they give?" — only the application layer can capture the reason.
- **Triggers as backstop close the bypass class.** If someone touches DB directly (Supabase Studio admin session, debug query, migration script) without going through the service layer, the four critical tables still emit audit rows.
- **Pure-trigger approach rejected:** capturing `OLD/NEW` JSON via triggers gives data deltas but loses the business reason. Hard to add later without re-engineering every audit consumer (CC-AUDIT-LINK UI, exports).
- **Pure-application approach rejected:** loses the bypass-protection on critical tables. The four-table trigger set is small enough to maintain (each trigger is ~15 lines of plpgsql, generated by template).
- **Atomic with business write.** `auditLog.record` runs inside the same Postgres transaction as the mutation — both commit or neither commits. No "audit row written for a mutation that rolled back" inconsistency.

**Cross-references:** Master Spec FR20, FR21 (audit FRs); CC-AUDIT-LINK (audit consumer pattern); Master Spec §2.4 (enablement integrity); Master Spec §2.5 (recipe yield cascade); Master Spec §11 OQ12 (now RESOLVED); DL-012 (`brandedDb` middleware sets `actor_user_id` for both layers).

---

## DL-014 — 2026-05-05 — OQ14 RLS policy authoring: per-epic from canonical template, with CI lint

**Decision:** Master Spec §11 OQ14 (RLS policy authoring strategy — when, by whom, from what template) RESOLVED. Chosen: **per-epic authoring**, every `CREATE TABLE` migration emits RLS policies from the **canonical 2-policy template** authored in Phase 3a. **CI lint flags any new table without accompanying RLS policies in the same migration.**

**Canonical template (per org-scoped table):**
```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;

-- Policy 1: brand isolation (defence-in-depth for direct DB access)
CREATE POLICY <table>_brand_isolation ON <table>
  FOR ALL
  USING (brand_id = (
    SELECT brand_id FROM users WHERE id = auth.uid()
  ));

-- Policy 2: service_role bypass (Express uses this key per Master Spec §3.2)
CREATE POLICY <table>_service_role_bypass ON <table>
  FOR ALL TO service_role
  USING (true);
```

System tables (non-org-scoped) get only:
```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY <table>_service_role_only ON <table>
  FOR ALL TO service_role
  USING (true);
```

**Why per-epic, not Phase 3a upfront:**
- Tables don't exist until their epic creates them. Authoring policies for hypothetical future tables = waste + drift risk.
- Each epic owns its tables AND their RLS policies — the migration is the single artifact.
- The **template is authored Phase 3a** (in `_planning/architecture.md` deliverable); each epic *applies* it.

**CI lint:**
- GitHub Actions check (FINAL §3.1) parses migration SQL; fails the build if any `CREATE TABLE` lacks an `ENABLE ROW LEVEL SECURITY` + at least one `CREATE POLICY` on that table.
- Architecture build plan (Phase 3a deliverable) details the lint script.

**Source:** Phase 3a brainstorming session 2026-05-05 (OQ14 — ninth OQ; depends on OQ11 multi-tenant pattern + OQ12 audit trail).

**Why this matters:**
- **Master Spec §3.2 + §7.2 mandate "Enable RLS on every table from creation."** OQ14 was the *when/by-whom/from-what-template* — answered above.
- **CI lint converts the rule into a mechanical check.** Master Spec §7.2 ("missing brand_id filter is a security vulnerability") applies to RLS authoring too — CI is the rule's enforcement.
- **Master Spec §3.2 ("RLS = Defence-in-depth, not primary enforcement") is honored.** Express bypasses RLS via service_role key (the second policy). RLS only fires for direct DB access — the actual security boundary stays in the application layer (DL-012 `brandedDb`).

**Cross-references:** Master Spec §3.2 (RLS defence-in-depth, service_role bypass); Master Spec §7.2 (Database rules); Master Spec §11 OQ14 (now RESOLVED); DL-012 (brandedDb application-layer primary enforcement); DL-015 (`brandScopedTable` helper auto-emits this template).

---

## DL-015 — 2026-05-05 — OQ15 brand_id index migration template: brandScopedTable Drizzle helper

**Decision:** Master Spec §11 OQ15 (canonical migration template / Drizzle helper for `brand_id` index per §3.2) RESOLVED. Chosen: **`brandScopedTable(name, columns)` Drizzle helper** that consolidates DL-012 + DL-013 + DL-014 + DL-015 into a single declaration.

**Helper guarantees per call:**
1. Adds `brand_id uuid not null` column with FK to `brands.id` (cascade on brand delete: RESTRICT — never silently drop tenant data).
2. Adds `idx_<table>_brand_id` B-tree index on `brand_id` (or composite with hot-path column when explicit).
3. Adds the canonical 2-policy RLS template from DL-014.
4. Tags the table for the `brandedDb` wrapper (DL-012) to recognize it as org-scoped.
5. Wires audit-trigger generation (DL-013) for the four critical tables (`users`, `enablement_matrix`, `recipes`, `chart_of_accounts`) via an opt-in flag.

**Conceptual usage:**
```typescript
export const purchaseOrders = brandScopedTable('purchase_orders', {
  trn: text('trn').notNull().unique(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  status: poStatusEnum('status').notNull(),
  // brand_id, brand_id index, RLS policies all generated automatically
});
```

System / non-scoped tables use plain Drizzle `pgTable` — opt-out via choice of helper.

**Source:** Phase 3a brainstorming session 2026-05-05 (OQ15 — tenth OQ; depends on OQ11 query pattern + OQ14 RLS template).

**Why this matters:**
- **Master Spec §3.2 + §7.2 require `brand_id` index on every major table in initial migration.** Per-table memory is the failure mode this OQ identified. The helper makes it mechanical: org-scoped table = one helper call = three guarantees met.
- **Co-designed with DL-012 brandedDb factory.** The helper IS the marker that tells the wrapper "this table is org-scoped, AND brand_id into queries against it." Without the helper marker, `brandedDb` wouldn't know which tables to scope.
- **Composite indexes via explicit option.** Default is `brand_id` only; hot-path tables (e.g., `production_orders` queried by `(brand_id, location_id)`) declare `{ indexes: { brandLocation: ['brand_id', 'location_id'] } }` explicitly. Avoids guessing index strategies in the helper.
- **Architecture build plan delivers the helper itself.** ~200–300 LOC including Drizzle integration + RLS-emitter + index generator. Lands in Phase 4 Epic 1 setup as the foundation everything else uses.

**Cross-references:** Master Spec §3.2 (Single-tenant now multi-tenant ready; brand_id index on every major table); Master Spec §7.2 (Database rules); Master Spec §11 OQ15 (now RESOLVED); DL-012 (brandedDb wrapper consumer of the marker); DL-013 (audit trigger opt-in for 4 critical tables); DL-014 (RLS template emitter).

---

## DL-016 — 2026-05-05 — OQ17 Concurrency / idempotency: per-mechanism resolution

**Decision:** Master Spec §11 OQ17 (Concurrency / idempotency for deductStock + IRN paste + PO approval) RESOLVED with three mechanism-specific patterns.

**1. `inventoryService.deductStock` atomicity (DL-001 — fires at Production Order In Progress transition):**
- Pattern: **Postgres `SELECT ... FOR UPDATE` row lock on the affected stock-batch rows, inside a single transaction.**
- FEFO batch selection (Master Spec §8.1, PRD FR31) happens inside the same transaction: SELECT candidate batches FOR UPDATE ORDER BY expiry_date, deduct, write journal entry, commit.
- Concurrent deductions on the same `(item_id, department_id)` row serialize naturally; no advisory locks needed.
- InsufficientStockError raised inside transaction → rollback → caller retries or surfaces error.
- Advisory locks (`pg_advisory_xact_lock(item_id, dept_id)`) explicitly rejected: row locks are scoped to actual data; advisory locks are namespace-managed conventions that drift over time.

**2. IRN paste idempotency (DSP-010, Master Spec §6.5 placeholder field `irn`):**
- Pattern: **Unique constraint on `(brand_id, irn)`** in the relevant transaction tables (POs, sales, dispatch challans).
- Re-paste of the same IRN: ON CONFLICT clause returns the existing record / ignores. UI surfaces "IRN already attached" — never duplicates.
- No separate idempotency-key infrastructure needed; the IRN itself is the natural idempotency key.

**3. PO approval idempotency (PUR-004):**
- Pattern: **Status-guarded UPDATE** — `UPDATE purchase_orders SET status = 'approved', approved_at = now(), approved_by = $user WHERE id = $po_id AND status = 'pending' AND brand_id = $brand`.
- Double-click → second UPDATE affects 0 rows → return current state ("Already approved by X at HH:MM").
- Same pattern applies to all approval-engine state transitions (Master Spec §8.2 `approvalEngine`).
- No separate idempotency key needed; the status transition itself is naturally idempotent under guard.

**Source:** Phase 3a brainstorming session 2026-05-05 (OQ17 — eleventh OQ; affects DL-001 deductStock contract + DSP-010 IRN workflow + PUR-004 approval workflow).

**Why this matters:**
- **DL-001 commits to `deductStock` firing exactly at the In Progress transition.** OQ17 was the open *mechanism*. Row locks inside the In-Progress transaction are the cleanest answer — atomic with the status change, no separate locking discipline.
- **Each of the three problems has a different shape.** One-size-fits-all (e.g., a generic idempotency-key middleware) would be over-engineered. Mechanism-fit-to-problem keeps the surface small.
- **All three patterns are Postgres-native.** No Redis (DL-008), no separate locking service. All atomic guarantees come from the same database the business state lives in.
- **Pattern reusability:** the status-guarded UPDATE pattern (#3) generalizes beyond PO approval to every state-transition mutation in the system. Document in architecture build plan as the canonical pattern for "any state machine transition."

**Cross-references:** Master Spec §8.1 (`inventoryService.deductStock` contract — FEFO ordering); Master Spec §8.2 (`approvalEngine` contract); Master Spec §6.5 (IRN placeholder field); Master Spec §11 OQ17 (now RESOLVED); DL-001 (Production Order 5-status — In Progress transition fires deductStock under this lock pattern); DSP-010 (IRN paste workflow); PUR-004 (PO approval workflow).

---

## DL-017 — 2026-05-05 — OQ13 File storage layout: per-brand bucket, signed-URL via Express

**Decision:** Master Spec §11 OQ13 (File storage layout — per-brand vs per-entity bucket; signed-URL vs direct upload) RESOLVED. Chosen: **per-brand Supabase Storage bucket with `${entityType}/${entityId}/${filename}` path structure, accessed via Express-issued signed URLs.**

**Bucket layout:**
- One Supabase Storage bucket per brand: `brand-${brand_slug}` (slug for human-readable Supabase Studio nav, not UUID).
- Path structure inside bucket: `${entityType}/${entityId}/${filename}`.
- Examples:
  - `brand-demofb/vendors/${vendorId}/contract.pdf`
  - `brand-demofb/production/${batchId}/batch-photo.jpg`
  - `brand-demofb/exports/${YYYY-MM}-tally-purchase-register.csv`
  - `brand-demofb/issue-tracker/${threadId}/attachment-${n}.png`

**Access pattern:**
- **Uploads:** Browser POSTs upload-intent to Express → Express validates (size, MIME, entity-attribution authorization, content-type) → Express generates short-TTL (5min) Supabase Storage signed PUT URL → returns to browser → browser PUTs file directly to Supabase Storage (no API bandwidth).
- **Reads:** Express generates short-TTL (5min) signed GET URL on demand per request. URL not cached client-side beyond the page render that uses it.
- **No client-side Supabase JS for storage operations.** All file access mediated by Express to enforce authorization + audit trail (DL-013 `auditLog.record` for upload/download events on sensitive files).

**Source:** Phase 3a brainstorming session 2026-05-05 (OQ13 — twelfth OQ; affects FR39 vendor docs + FR81 production batch photos + accountant export storage).

**Why this matters:**
- **Per-brand bucket = clean multi-tenant boundary.** Master Spec §1.2 multi-tenant migration path: each tenant has its own bucket; bucket-level RLS / access control trivially scopes data. Per-entity bucket would require per-entity ACL policy, which doesn't compose with Supabase Storage's bucket-level model.
- **Express-mediated signed URLs enforce authorization + validation.** Master Spec §3.2 is explicit: business logic in Express only. Browser-side Supabase JS would bypass file-type validation, size limits, entity-attribution checks, audit logging — a real authorization gap.
- **Browser PUTs directly to Supabase Storage = no API bandwidth waste.** Express stays out of the data path; only the authorization decision flows through Express.
- **Path-prefix structure inside bucket scales.** Per-entity-type folders keep the Supabase Studio file browser navigable (vendors/ separate from production/ separate from exports/).
- **Single shared bucket with `${brandId}/` prefix rejected:** acceptable today but reduces multi-tenant migration cleanliness; per-brand bucket is the safer pattern from day one with no real cost difference.
- **Direct browser upload via Supabase JS rejected:** convenience tradeoff vs authorization integrity is wrong direction for ERP data.

**Cross-references:** Master Spec §3.1 (Supabase Storage FINAL); Master Spec §3.2 (Business logic in Express only); Master Spec §1.2 (Single-tenant now, multi-tenant ready); Master Spec FR39 (vendor docs); Master Spec FR81 (production batch photos); Master Spec §11 OQ13 (now RESOLVED); DL-013 (audit trail on file access events).

---

## DL-018 — 2026-05-05 — OQ6 Full-text search: Postgres tsvector + pg_trgm

**Decision:** Master Spec §11 OQ6 (Full-text search strategy — tsvector vs Meilisearch / Typesense) RESOLVED. Chosen: **Postgres `tsvector` (GIN-indexed) + `pg_trgm` (fuzzy / trigram matching).** No dedicated search service in MVP.

**Application surface:**
- Item catalog search (raw materials + semi-products + final products)
- Vendor search (by name, GSTIN, contact)
- Recipe search (by name, ingredient inclusion)
- Customer search (B2B challan recipients)
- Transaction search (TRN lookups, PO/GR/dispatch number lookup)

All bounded data — even at scale, ~thousands of items, hundreds of vendors, thousands of recipes per brand. tsvector + GIN handles this comfortably (sub-50ms at the volumes we project).

**Implementation pattern:**
- Each searchable table gets a generated `search_vector tsvector` column populated via trigger (or generated column in PG12+) from the relevant text fields.
- GIN index on `search_vector`.
- `pg_trgm` extension provides similarity matching for typo tolerance ("tomate" → "tomato"); used as a fallback when tsvector returns no results, or as a UNION for combined ranking.

**Reconsider triggers (post-MVP):**
- Search latency on indexed Postgres exceeds 100ms at observed load.
- Need real faceted search (e.g., "items that are [vegetarian] AND [enabled for Pastry] AND [in stock]" with facet counts) at scale where Postgres facet aggregation becomes expensive.
- Then evaluate Meilisearch (Mumbai-deployable, modern DX) or Typesense (similar shape).

**Source:** Phase 3a brainstorming session 2026-05-05 (OQ6 — independent OQ slotted late in constraint-flow).

**Why this matters:**
- **Zero added infrastructure.** Both extensions are Supabase one-click. No new service to deploy / monitor / pay for.
- **Volume profile fits.** ERP search is bounded (master data scales linearly with the business; not log-volume like consumer search). Postgres handles the ceiling.
- **Walk-away path stays open.** If a post-MVP need surfaces, search-index sync (Postgres → Meilisearch via CDC or pg-boss-driven incremental indexing per DL-009) is a known pattern.
- **Meilisearch / Typesense rejected for MVP:** correct call when search volume / latency or faceting requirements exceed Postgres. None of those constraints are present at MVP scale.

**Cross-references:** Master Spec §3.1 (Postgres FINAL); Master Spec §11 OQ6 (now RESOLVED); DL-009 (pg-boss available if/when post-MVP CDC-style indexing needed).

---

## DL-019 — 2026-05-05 — OQ5 PDF generation: @react-pdf/renderer on pg-boss worker

**Decision:** Master Spec §11 OQ5 (PDF generation library — react-pdf vs puppeteer vs @react-pdf/renderer) RESOLVED. Chosen: **`@react-pdf/renderer` (server-side), executed on the pg-boss worker process** (DL-009). Output written to per-brand Supabase Storage bucket (DL-017); API returns signed download URL once PDF lands.

**Use cases covered:**
- B2B + dispatch challans
- Invoices, POs, GR slips, production order printouts
- Financial report exports (Trial Balance, P&L, Balance Sheet, Cash Flow as PDF alternative to Excel)
- Batch-generated PDFs (e.g., print all dispatch challans for a day → ZIP via pg-boss job that fans out child render jobs)

**Why on pg-boss worker, not API process:**
- PDF rendering takes 50–500ms per document (longer for batch). Serving from API = blocks request thread, degrades P95 latency.
- Worker handles render asynchronously: API enqueues `render_pdf` job → worker renders → writes to Supabase Storage → updates `pdf_generated_at` on the source entity → frontend (TanStack Query polling or Realtime if subscribed) picks up the URL.
- For interactive "download as PDF" buttons: enqueue + poll; show "Generating…" state for the brief moment; surface signed URL when ready.

**Charts in financial reports:**
- @react-pdf/renderer can't render Recharts components directly.
- Pattern: render chart server-side as SVG (e.g., via `d3` or `recharts-to-png` library on worker) → embed SVG in PDF via @react-pdf/renderer's SVG primitive.
- For chart-heavy report exports, **Excel is the primary path** (clearer data interaction); PDF is the secondary "snapshot" path.

**Source:** Phase 3a brainstorming session 2026-05-05 (OQ5 — independent OQ slotted late in constraint-flow).

**Why this matters:**
- **Component-based PDF authoring matches the React stack.** Designers can iterate on PDF layouts using the same JSX patterns as UI screens. DESIGN.md tokens reusable in PDF styles via plain-object styles.
- **No browser binary overhead.** Puppeteer ships ~100MB Chrome — bloats Railway deploy image, slow cold starts on the worker. @react-pdf/renderer is a pure-Node library (~5MB).
- **Predictable output.** @react-pdf/renderer renders from declarative components; same input = same output. Puppeteer's HTML-to-PDF is more flexible but introduces rendering nondeterminism (font loading, CSS quirks across Chrome versions).
- **Puppeteer rejected for MVP:** correct call when arbitrary HTML rendering is needed (e.g., importing existing HTML templates). We don't have that need; designers author PDFs as React components from the start.
- **`pdfkit` rejected:** lower-level, more code per document, no React composition story. More work for less benefit.
- **`jsPDF` (client-side) rejected:** moves rendering to the browser; complicates large/batch generation; bypasses server-side audit trail on document creation.

**Cross-references:** Master Spec §3.1 (React + Node FINAL); Master Spec §11 OQ5 (now RESOLVED); DL-009 (pg-boss worker hosts the renderer); DL-017 (per-brand Supabase Storage receives output).

---

## DL-020 — 2026-05-05 — OQ4 Offline capability: deferred post-MVP; MVP resilience via TanStack retry + LocalStorage drafts

**Decision:** Master Spec §11 OQ4 (Offline capability depth — core for MVP or deferred; if core, which workflows) RESOLVED. Chosen: **Defer offline-first capability to post-MVP. No PWA / service worker / IndexedDB / sync engine in MVP.** MVP resilience covered by two lighter mechanisms:

1. **TanStack Query automatic mutation retry** on transient network failure (built into the library; configure exponential backoff with jitter).
2. **LocalStorage form-draft auto-save** every 5 seconds on long-form screens (Goods Receipt entry, Recipe authoring, Production Order creation, B2B challan creation). On next visit, restore unsaved draft with "You have an unsaved draft from HH:MM. Restore?" prompt.

**Reconsider trigger (post-MVP):** production telemetry on `network_offline_during_submit` event count. If outage events cause real lost work at observed frequency, build PWA wrapper around the affected workflows (likely candidates: closing inventory entry on POS in basement / poor-signal areas; goods receipt scanning at warehouse with intermittent WiFi).

**Source:** Phase 3a brainstorming session 2026-05-05 (OQ4 — independent OQ slotted last in constraint-flow because it touches every screen's data layer).

**Why this matters:**
- **MVP is browser-based desktop / tablet workflows** per `_planning/05-screen-inventory.md` device-class designations. Network reliability is the assumed baseline for the device classes targeted.
- **Mobile-heavy workflows are few and have workflow-design mitigations.** GR Entry collects all data on a single screen submitted at the end; user can `Cmd+S → retry on connectivity restore` via TanStack Query retry rather than needing offline-first.
- **PWA + sync + conflict resolution is months of engineering.** Conflict resolution alone (what happens when two offline devices both decrement the same stock?) is a research project. Not justified by current evidence.
- **The two MVP mechanisms cover ~95% of real-world "internet flickered" scenarios** at zero offline-architecture cost. TanStack Query retry handles transient failure transparently; LocalStorage drafts handle browser-tab-closed scenarios.
- **Out-of-scope alignment with Master Spec §4.1.** Native Mobile Apps explicitly deferred — offline-first as an MVP commitment would re-open that scope question.

**Cross-references:** Master Spec §3.1 (TanStack Query FINAL); Master Spec §4.1 (Native Mobile Apps deferred); Master Spec §11 OQ4 (now RESOLVED); `_planning/05-screen-inventory.md` (device-class designations per screen); future post-MVP PWA plan if reconsider trigger fires.

---

## DL-021 — 2026-05-06 — Phase 3a close note

**Decision:** Phase 3a (Architecture) closed 2026-05-06. All Master Spec §11 OQs RESOLVED; canonical architecture document + supporting deliverables shipped on branch `phase-3a/architecture`. Phase 2c-scoped (visual mockup foundation) is the immediate next phase; Phase 4 (epic implementation) remains gated on Phase 2c-scoped closing.

**Deliverables shipped:**
- `_planning/architecture.md` §1–§21 — canonical architecture document covering monorepo + deployment + data layer + service contracts + multi-tenancy + audit + RLS + concurrency + file storage + search + PDF + offline + real-time + caching + jobs + notifications + UI design tool + mockups-vs-production + CI/CD quality gates + cross-reference index.
- `_planning/architecture-oq10-export-mappings.md` — OQ10 column-name mapping spec for FR96 (Tally + Zoho Books + Generic CSV accountant exports).
- 5 Mermaid diagrams committed under `_planning/architecture-diagrams/`:
  - `data-model-erd.md` (data model entity-relationship diagram)
  - `service-graph.md` (service-layer dependency graph)
  - `sequence-b2b-challan.md` (B2B challan two-stage journal flow)
  - `sequence-production-order-lifecycle.md` (production order 5-status lifecycle)
  - `sequence-approval-routing.md` (Unified Approval Engine routing)
- Master Spec §11 status updates — all 17 OQs marked RESOLVED with cross-references to the resolving DL-NNN entry; §3.1 Backend deployment row marked FINAL (Railway per DL-007); §3.3 SUPERSEDED notice added per DL-004 (in-repo Vite/shadcn workflow supersedes earlier Stitch-based UI design tool framing).

**OQ resolution roll-up:**
- 15 OQs resolved fresh in Phase 3a brainstorming sessions: OQ1–OQ8 + OQ11–OQ17 (DL-006 → DL-020).
- OQ9 captured per DL-004 (already-resolved at Phase 2c-prep; in-repo Vite + shadcn + Tailwind workflow via Claude Code).
- OQ10 spec produced as the dedicated column-mapping deliverable `_planning/architecture-oq10-export-mappings.md` (PRD-level resolution per FR96; mapping detail produced this phase).

Total: 17 OQs accounted for — 16 fresh resolutions (15 brainstormed + 1 spec-produced) + 1 already-decided capture.

**Carry-forward into Phase 4 (no edits):**
- **Chrome-freeze review gate per epic** invariant carries forward unchanged: cross-epic chrome consistency review at every Phase 4 epic close before next epic begins; drift = mandatory fix-back.
- **Tier 1 Acceptance Tag for deferred heroes** invariant carries forward unchanged: 12–13 leftover Tier 1 hero screens (Group 2 + Group 3) carry full Tier 1 acceptance even when built mid-Phase-4; Tier 2 lighter-critique acceptance does NOT apply to tagged screens.

**Source:** Phase 3a Architecture build plan execution 2026-05-05 → 2026-05-06 across 3 authoring sessions (A: §1–§9 architecture.md; B: §10–§21 architecture.md; C: OQ10 spec + 5 diagrams + Master Spec §11 status updates + this close note).

**Why this matters:**
- **Architecture is now canonical.** Every Phase 2c-scoped mockup decision and every Phase 4 epic implementation arc references `_planning/architecture.md` as the authoritative tech-stack + integration-pattern source. No more "is real-time WebSocket or polling?" or "are we using Redis?" ambiguity at code time.
- **Phase boundary discipline honored.** Cross-phase invariant 9 (`_planning/06-phase-roadmap.md`) requires same-commit `## Current phase` update on phase boundary crossing. This commit does that — pattern intact for the first time across the recent 2b → 2c-prep → 3a-prep → 3a sequence.
- **Decision-log integrity.** DL-001 → DL-021 is the cumulative micro-decision record; future sessions can reconstruct architectural rationale from the log alone without re-reading brainstorming transcripts.
- **Mockups + Phase 4 unblocked.** The two downstream phases were explicitly gated on this close; gate is now cleared.

**Cross-references:** `_planning/06-phase-roadmap.md` Phase 3a status row (now ✅ DONE) + Phase 2c-scoped row (now 🔄 NEXT) + Closure note (2026-05-06); `_planning/architecture.md` §1–§21; `_planning/architecture-oq10-export-mappings.md`; `_planning/architecture-diagrams/*`; `_planning/02-master-spec.md` §11 (all OQs RESOLVED) + §3.1 Backend deployment FINAL + §3.3 SUPERSEDED notice; CLAUDE.md `## Current phase` (now Phase 2c-scoped); DL-001 → DL-020 (the architectural record this entry closes); cross-phase invariants 8 (chrome-freeze gate) + 9 (phase-boundary update discipline) + 10 (roadmap as invariant doc).

Phase 3a complete; Phase 2c-scoped is NEXT; Phase 4 gated on Phase 2c-scoped closing.

---

## DL-022 — 2026-05-07 — Org-hierarchy parent-lock (no re-parenting in MVP)

**Decision:** Once a Cluster, Location, or Department is created in MVP, its parent assignment is **immutable**. SI-MDM-001 supports rename, address/contact edits, and soft-deactivate — but **not** moving a Location from one Cluster to another, nor moving a Department from one Location to another. Restructuring requires deactivate + recreate under the new parent. The original (deactivated) row stays for historical reference and audit-trail integrity.

**Source:** Phase 4 Epic 1 MDM kickoff brainstorming Q1 (2026-05-07). The screen inventory's SI-MDM-001 Notes commit only to soft-delete, leaving re-parenting unspecified; this DL closes the ambiguity for backend + UI.

**Why this matters:**
- **Cluster/Location IDs are FK targets in vendor scope (§2.7), user role-scope mappings, every transactional row from Epic 4 onwards (POs, GRs, transfers, journal entries, audit rows, file paths in Supabase Storage per DL-017).** Re-parenting silently invalidates `cluster_id`/`location_id` foreign-key joins on historical data — a prior cluster-scope vendor's PO history would now reference a Location that no longer belongs to that Cluster.
- **Audit integrity over operational convenience.** A Location moving cluster mid-year would make Trial Balance + P&L by-cluster reports retroactively rewrite history. MVP cannot afford the cascade-design surface that compliant re-parenting needs.
- **Soft-deactivate + recreate is operationally rare.** The expected MVP usage is brand setup once + occasional new-location addition; restructurings are post-MVP territory anyway.
- **Re-introducing re-parenting later is a non-breaking change.** If a customer asks for it post-MVP, we can ship it as an authorised-action with cascade rules + audit + reason code, layered on top of the locked baseline.

**Cross-references:** Master Spec §2.1 (org hierarchy) + §2.7 (vendor scope FK to cluster/location); PRD FR1 (org hierarchy CRUD); `_planning/05-screen-inventory.md` SI-MDM-001 Notes (soft-delete only); DL-013 (audit-trail integrity); DL-017 (per-brand storage paths reference cluster/location).

---

## DL-023 — 2026-05-07 — UOM two-layer model (registry + per-product overrides)

**Decision:** PRD FR4 (multi-level UOM conversion chains) is realized as a **two-layer model**:

1. **Global `uoms` registry table** — system-seeded with canonical units (`g`, `kg`, `l`, `ml`, `piece`, `dozen`, `pair`, `case`, ...) and a `conversion_to_base_factor` per row keyed against the unit's base (`g` is base for mass; `ml` is base for volume; `piece` is base for count). Brand-scoped per `brandScopedTable` invariant (DL-015) but seeded identically per brand at bootstrap.
2. **Per-product alternate-UOM declarations** — on the product master row (`product_uoms` join: `product_id`, `uom_id`, `factor_to_default_uom`, `is_default`). Edited inline on SI-MDM-003. Captures product-specific units that cannot live in the registry (e.g., "for Paneer, 1 case = 5 kg"; "for eggs, 1 tray = 30 piece"). Default UOM for the product is the one flagged `is_default = true`.

`inventoryService.convertQuantity(itemId, fromUom, toUom, qty)` resolves through the registry first (universal conversions), then per-product overrides (product-specific). Multi-hop conversions (e.g., `case → kg → g`) traverse both layers; max two hops in practice.

**Source:** Phase 4 Epic 1 MDM kickoff brainstorming Q2 (2026-05-07). Screen inventory commits UOM to inline-on-product (no separate screen) but FR4 demands multi-level chains, leaving the storage shape open.

**Why this matters:**
- **Honors FR4 without bloating SI-MDM-003.** Universal conversions (kg ↔ g, l ↔ ml) live once in the registry; only product-specific oddities surface on the product form.
- **Avoids data duplication.** Pure per-product inline-JSON would force every product to re-declare "1 kg = 1000 g" — drift risk.
- **Composes with `inventoryService.deductStock` and `recipeService` cost roll-up.** Recipe lines may be authored in any UOM; the conversion layer normalizes to product default UOM at deduction + cost time.
- **`uoms` table is NOT one of the four DL-013 critical audit tables** — UOM changes are rare and low-stakes vs. enablement / recipes / chart-of-accounts. Application-layer audit via `auditLog.record` is sufficient.
- **No fix-back required to SI-MDM-003 mockup** — the shipped mockup already shows UOM inline; this DL only formalizes the storage shape behind that surface.

**Cross-references:** PRD FR3 (default UOM on product), FR4 (multi-level conversion); Master Spec §7.3 (recipe cost roll-up cascade depends on UOM normalization); architecture §5.1 (`inventory.ts` schema location); architecture §6.2.1 (`inventoryService` is the conversion entry point); `_planning/05-screen-inventory.md` SI-MDM-003 Notes (UOM inline on product form, not a separate screen); DL-015 (`brandScopedTable` for the registry).

---

## DL-024 — 2026-05-07 — SI-MDM-007 edit-only; single brand row seeded at bootstrap

**Decision:** SI-MDM-007 is an **edit-only** screen in MVP — there is **no "Create new brand"** UX. The single `brands` row is seeded at deployment time via the bootstrap obligations from architecture §3.5 (Phase 4 Epic 1 setup-task additions). When the system migrates to multi-tenant SaaS post-MVP, SI-MDM-007 evolves into per-tenant settings without schema change.

Fiscal year stored as `(start_month: smallint, start_day: smallint)` on the `brands` row. Period boundaries are derived; the `periods` table itself is owned by Epic 10 (Accounting), not Epic 1.

**Source:** Phase 4 Epic 1 MDM kickoff brainstorming Q5 (2026-05-07). Master Spec §1.2 commits to "Single-tenant MVP — one brand. Multi-tenant ready from day one" but is silent on the UX implication for SI-MDM-007.

**Why this matters:**
- **Bootstrap obligation must land in architecture §3.5.** Architecture §3.5 currently lists Supabase Mumbai region provisioning, Resend account setup, etc.; Epic 1 plan adds a `brand_seed.ts` script as an explicit obligation so the brand row is never assumed to exist by accident.
- **Multi-brand schema readiness preserved.** The `brandedDb` factory (DL-012) + `brandScopedTable` helper (DL-015) already operate on `brand_id` as a JWT-derived value; SI-MDM-007's edit-only stance does not regress this readiness.
- **Multi-currency deferred per inventory Notes.** SI-MDM-007 fixes accounting currency to INR in MVP; multi-currency support is post-MVP per the screen inventory and is **not** Epic 1 scope.

**Cross-references:** Master Spec §1.2 (single-tenant MVP, multi-tenant ready); PRD FR9 (company registration + fiscal year + currency); architecture §3.5 (bootstrap obligations — Epic 1 plan amends); DL-012 (`brandedDb`); DL-015 (`brandScopedTable`); `_planning/05-screen-inventory.md` SI-MDM-007 Notes (one-time setup; multi-currency deferred).

---

## DL-025 — 2026-05-07 — Phase 4 Epic 1 mockup tier-tagging

**Decision:** Of the seven SI-MDM-### screens in Epic 1, two are already shipped Tier 1 G1 (S3 of Phase 2c-scoped); the remaining five are tagged for Phase 4 Arc (b) as follows:

| Screen | Tag | Rationale |
|---|---|---|
| SI-MDM-001 Org Hierarchy View & Edit | **Tier 2** | Admin/setup; no journal fire; no atomic state. Tree-view chrome moderate novelty but fits Tier-2 lighter critique. |
| SI-MDM-002 Department Register | **Tier 2** | Generic CRUD list with type filter; mirrors many Epic-N admin lists. |
| SI-MDM-003 Product Master CRUD | ✅ Tier 1 G1 (shipped S3) | No rebuild. **Fix-back at Arc (b) close to consume CC-DUPLICATE-WARN — see DL-026.** |
| SI-MDM-004 Material Enablement Matrix | ✅ Tier 1 G1 (shipped S3) | No rebuild. Schema shape (flat per-material × per-department join) confirmed in §6.2.1 architecture refinement. |
| SI-MDM-005 Vendor Master CRUD | **Tier 2** | Mirrors SI-MDM-003 chrome heavily; new fields are scope picker + GSTIN/PAN/credit terms. No journal fire, no atomic state — Tier 2 holds. |
| SI-MDM-006 Category & Sub-Category | **Index-only** | Two-level hierarchy with simple CRUD; parent SI-MDM-003 carries the per-product assignment surface. Index-only stub renders at the route but defers heavy critique. |
| SI-MDM-007 Company Reg & Fiscal Year | **Tier 2** | Single-record edit form (per DL-024); admin/setup only. |

Net Arc (b) deliverable: **4 Tier 2 mockups + 1 Index-only stub** + the new CC-DUPLICATE-WARN shell + SI-MDM-003 fix-back. **No Tier-1-Acceptance-Tag heroes in Epic 1** — those are all Group 2/3 screens in later epics per `_planning/06-phase-roadmap.md`.

**Source:** Phase 4 Epic 1 MDM kickoff brainstorming Q6 (2026-05-07).

**Why this matters:**
- **Fixes the chrome-freeze review gate scope for Epic 1.** The gate at Epic 1 close reviews CC-DUPLICATE-WARN's debut + cross-screen consistency of the four new Tier 2 mockups vs. the 21-shell foundation (DL-005 mockups-as-visual-spec). Drift = mandatory fix-back per `_planning/06-phase-roadmap.md` cross-phase invariant 8.
- **Tier 2 lighter critique applies to the four Tier 2 entries.** Tier 1 acceptance criteria do NOT apply (per the same roadmap invariant). This bounds Arc (b) review effort.
- **SI-MDM-006 Index-only avoids over-investment.** Two-level category hierarchy is so generic that a full mockup would duplicate SI-MDM-003's existing patterns. Index-only stub is the right granularity per `_planning/05-screen-inventory.md` §7 granularity rule.

**Cross-references:** `_planning/06-phase-roadmap.md` Phase 4 Arc (b) (per-epic 3-arc structure + Tier 1 Acceptance Tag rule); `_planning/05-screen-inventory.md` Epic 1 — MDM section; DL-005 (mockups-as-visual-spec); DL-021 carry-forward (Tier 1 Acceptance Tag, chrome-freeze gate).

---

## DL-026 — 2026-05-07 — CC-DUPLICATE-WARN ships in Epic 1; SI-MDM-003 fix-back

**Decision:** The CC-DUPLICATE-WARN shell — flagged in `_planning/06-phase-roadmap.md` as a "known chrome gap" not exercised by the foundation 15 mockups — is built in **Phase 4 Epic 1 Arc (b)**. Three consumers in Epic 1 alone justify the shell:

1. **SI-MDM-003 Product Master** — warn at create-time when a new product name is fuzzy-matched (≥85% trigram similarity per DL-018 `pg_trgm`) to an existing active product. **Fix-back: SI-MDM-003 mockup, already shipped at S3, is updated to consume the new shell at Arc (b) close.** Surfaced explicitly here so the fix-back is visible, not silent drift.
2. **SI-MDM-005 Vendor Master** — same pattern at vendor create-time.
3. **SI-MDM-006 Category & Sub-Category** — same pattern at category create-time (via SI-MDM-003 inline assignment surface, in practice).

Shell shape: a non-blocking inline warning panel directly under the affected name input, listing the matched existing rows with quick "edit existing" / "proceed with create anyway" actions. Consumes `surface_container_low`, `on_surface_variant`, and the canonical 20-status palette (no new status_* token). No approval gate — warn-and-log model per the broader override pattern in PRD FR62.

**Out of scope for the shell in Epic 1:** the three Epic-1 surfaces above. Future epics with create-flows that warrant duplicate warning (recipes, B2B customers, employees) consume the shell as-is — no per-consumer reshape unless the chrome-freeze gate at that epic surfaces drift.

**Source:** Phase 4 Epic 1 MDM kickoff brainstorming Q7 (2026-05-07). The roadmap "Known chrome gaps" list flagged CC-DUPLICATE-WARN with the verbatim instruction: "first surfaces wherever its host screen is defined (verify CC catalogue when that screen builds)." Epic 1 has three host screens — building the shell once is cheaper than three inline reshapes.

**Why this matters:**
- **Three consumers in one epic = shell, not inline.** Inline implementation would force three re-derivations of the same warning surface; the chrome-freeze gate at Epic 1 close would then likely require fix-back to consolidate. Build once, save the gate cycle.
- **SI-MDM-003 fix-back is named explicitly.** Per the auto-mode posture, "a new CC-* pattern that affects existing foundation chrome" is a flagged event. Calling out the fix-back here keeps it from drifting into silent rebuild during Arc (b).
- **Trigram similarity threshold (85%) is debatable.** Architecture §6.3 / DL-018 commits to `pg_trgm`; the threshold is a service-layer constant in Epic 1's `productService.findSimilarByName(name)` and similar methods. Tunable per-consumer if false-positive / false-negative rates surface in Phase 4 dogfooding.
- **Warn-and-log, never block.** Master Spec §7.6 + PRD FR62's override-with-reason pattern is the canonical chrome posture. Hard-blocking duplicate creation would force admin-only escape hatches and delay legitimate near-name products (e.g., "Basmati Rice" vs. "Basmati Rice (long grain)").

**Cross-references:** `_planning/06-phase-roadmap.md` "Known chrome gaps" list (CC-DUPLICATE-WARN entry); DL-005 (mockups-as-visual-spec, copy-port to apps/web); DL-018 (`pg_trgm` for similarity); PRD FR62 (warn-and-log override pattern); architecture §6.3 (service catalogue — `productService.findSimilarByName` lands here); `_planning/06-phase-roadmap.md` cross-phase invariant 8 (chrome-freeze review gate).

## DL-027 — 2026-05-07 — `brandedDb` exposes EXPLICIT scoped methods (not transparent Drizzle pass-through)

**Decision:** The `brandedDb(brandId)` factory exposes explicit scoped helpers — `scopedFrom(table, condition?)`, `scopedInsert(table, values).returning()`, `scopedUpdate(table).set(values).where(condition).returning()`, `scopedDelete(table).where(condition).returning()` — rather than transparently overriding `db.select()` / `db.insert()` / `db.update()` / `db.delete()` to inject `brand_id`. Service-layer code calls the scoped methods directly for org-scoped tables (everything declared via `brandScopedTable`); non-scoped operations (the `brands` system table, ad-hoc raw SQL like `pg_trgm` `similarity()` queries, transaction `SET LOCAL app.user_id`) use `db.raw` (the underlying Drizzle client) explicitly.

**Source:** Phase 4 Epic 1 Arc (a) Task A1 implementation (2026-05-07). The architecture §4.2 spec described the wrapper as if `db.select(...)` etc. would be drop-in replacements. The implementation effort hit irreducible Drizzle 0.36 generic-variance errors when wrapping the insert/update/delete builders generically — every transparent Proxy approach forced an `any` somewhere to satisfy Drizzle's deeply-parameterised PgInsertBuilder / PgUpdateBuilder types. Rather than ship `any`, the explicit-method form was chosen per the plan §7c fallback ("If the Proxy / interception is getting too clever, prefer EXPLICIT helper methods").

**Why this matters:**
- **Zero `any` in `apps/api/src/`.** Master Spec §7.1 + claude.md "Critical rules" forbid `any`. The explicit-method form satisfies that absolutely; the transparent Proxy could not.
- **Bypass site is grep-able.** Calls to `db.raw` are the only legitimate way to skip brand-scoping in service code. Code review can grep `db\.raw` and inspect each site (today: `pg_trgm` similarity queries in `productService.findSimilarByName` / `vendorService.findSimilarByName`; system-table reads/writes in `companyService` against `brands`; transaction `SET LOCAL` in `with-transaction.ts`). A transparent Proxy would have hidden these.
- **Service authoring discipline is now mechanical.** `org.service.ts` (Task A5) is the canonical pattern; later services in the arc (`product`, `category`, `vendor`, `inventory`, `company`) followed it. Future epics adding new services follow the same pattern — read `org.service.ts`, not the wrapper internals.
- **Multi-tenant SaaS migration unchanged.** Architecture §4.6 (the post-MVP migration path) keys on `brand_id` from the JWT. Whether the wrapper is transparent or explicit-method doesn't affect that — the column, the index, the RLS policy pair, and the per-request `brandId` extraction are the load-bearing pieces. DL-027 is a mechanical wrapper-shape decision, not a multi-tenancy semantics decision.

**Cross-references:** DL-012 (brandedDb application-layer enforcement); architecture §4.2 (factory specification — section text describes the original transparent-pass-through intent; this DL is the authorised deviation); architecture §6 (service-layer pattern — every service consumes the scoped helpers); `apps/api/src/db/branded-db.ts` (the implementation, with module-header docstring referencing this DL).

## DL-028 — 2026-05-07 — `audit_log` table carved into Phase 4 Epic 1 Arc (a)

**Decision:** The `audit_log` schema (architecture §7.2) ships in Phase 4 Epic 1 Arc (a) — not Epic 3 as architecture §5.1 originally mapped — because Arc (a) tests assert application-layer audit-log writes for every mutation in `orgService` / `productService` / `categoryService` / `vendorService` / `inventoryService.setEnablement` / `companyService`. Without the table, those assertions are unprovable and Arc (a) cannot close. Epic 3 retains ownership of the consumer-side query API (CC-AUDIT-LINK timeline, FR21 reporting) and the trigger function body (`audit_critical_table_trigger()` per architecture §7.4) that backstops the four critical tables (DL-013).

**Why split application-layer vs trigger:**
- **Application-layer is the primary signal.** Per DL-013 + architecture §7.1, application-layer rows carry the business `reason`, the originating TRN, the screen `context.screen` — the high-value audit content. Every Epic 1 mutation writes one of these, called via `auditLogService.record(tx, ...)` inside the same Postgres transaction as the business write.
- **Trigger backstop is defence-in-depth only.** The trigger fires only when someone bypasses the service layer (Supabase Studio session, `psql`, debug query). It cannot capture business reason. Its function body depends on the `audit_log` table existing; once that table ships in Arc (a), Phase 3a follow-up adds the function + the four `CREATE TRIGGER` statements.
- **`auditTriggerRegistry` is already populated.** Task A1 + Task A6 register `users` and `enablement_matrix` in the registry via `brandScopedTable(..., { auditTrigger: true })`. The CI lint script that emits `CREATE TRIGGER` DDL from this registry is a Phase 3a follow-up; the registry data is in place for it to consume.

**What Epic 3 still owns:**
- The `audit_critical_table_trigger()` plpgsql function body + the four `CREATE TRIGGER` statements.
- The CC-AUDIT-LINK timeline UI screen + the read-side query helper that surfaces audit history per entity (FR21).
- Append-only enforcement at the role/grant level (REVOKE UPDATE/DELETE on `audit_log` from non-superuser roles); for Arc (a), discipline is application-layer only.

**Why this matters:**
- **Arc (a) tests are the proof carrier.** 178 tests including ~20 that directly assert audit-log writes (org create/update/deactivate; product CRUD; category M:N; vendor scope mutation; enablement set; company update + mark-setup-complete). Without the table, those tests would skip — and silent-skip is a worse signal than carved scope.
- **Schema is well-known.** Architecture §7.2 spec is verbatim; no design judgment was applied during Arc (a) carve-out — the table shape is what Epic 3 would have shipped anyway. Epic 3 extends, never recreates.
- **Phase 3a CI lint scripts deferred.** `lint-migrations.ts` (RLS canonical-template enforcement), `lint-brand-id-index.ts`, `lint-design-tokens.ts` — none yet shipped. The CI workflow at `.github/workflows/ci.yml` runs `typecheck` + `test`; the lint steps are commented placeholders referencing this gap. Phase 3a follow-up authors these.

**Cross-references:** DL-013 (two-layer audit; application-layer primary, trigger backstop on four critical tables); architecture §5.1 (schema-file mapping — Epic 3 ownership of `audit.ts`); architecture §7 (audit trail architecture); architecture §20.2 (CI lint deliverables); `apps/api/src/db/schema/audit.ts` (the carved-out table definition with module-header docstring referencing this DL); `apps/api/src/services/audit-log.service.ts` (the application-layer record/computeChangedFields helpers).

## DL-029 — 2026-05-07 — Arc (c) ships dev-stub auth; real Supabase Auth deferred to Epic 2

**Decision:** Phase 4 Epic 1 Arc (c) production frontend ships a dev-only auth module (`apps/web/src/lib/auth.ts`) that hand-mints HS256-signed JWTs in the browser using the `jose` library, signed with `VITE_DEV_JWT_SECRET` from `apps/web/.env.local`. Real Supabase Auth (provisioned Supabase Mumbai project + email/password login UI + session refresh) is deferred to Epic 2 USR (FR14, SI-USR-001). Supabase Mumbai project is NOT provisioned during Arc (c); apps/api continues to run against local Postgres throughout Epic 1.

**Source:** Phase 4 Epic 1 Arc (c) C2 boundary — user direction 2026-05-07.

**Why this matters:**
- **Plan §6 Task C2 Step 2 already carves login UI into Epic 2.** Arc (c) is explicitly downstream of "session exists; show spinner if not" — production login UI is not Epic 1 territory. Defers the cost-bearing Supabase Mumbai provisioning + credential storage to a session that's actually building login UX.
- **JWT contract is preserved.** apps/api JWT middleware (`apps/api/src/middleware/auth.ts`) verifies HS256-signed tokens against `SUPABASE_JWT_SECRET`. The dev-stub token uses the same shared secret + same claim shape (`sub`, `user_metadata.brand_id`, `user_metadata.role`). When Epic 2 swaps in real Supabase Auth, no apps/api changes are needed — the JWT middleware already supports both issuers because the verification key + claim shape are identical. Real Supabase JWTs are signed with the project's JWT secret, which Epic 2 sets as `SUPABASE_JWT_SECRET` in production env.
- **Discovery of seed brand_id is dev-time concern.** The seed brand row at bootstrap has a non-deterministic UUID. Arc (c) populates `apps/web/.env.local` with `VITE_SEED_BRAND_ID` + `VITE_SEED_USER_ID` via a manual one-time copy from the `[brand-seed]` stdout line after `pnpm --filter @fnberp/api db:seed` (the seed script at `apps/api/src/db/seed/brand-seed.ts:48-53` already prints `Created brand id=...`). **Zero apps/api source touches in Arc (c)** — preserves the briefing's "no backend code touched except the one-time copy-port at Task C1" discipline strictly. If dev-loop friction surfaces, Epic 2 can ship a `/api/v1/_dev/seed-info` endpoint as part of its auth UI work.
- **Production-build safety.** The dev-stub auth module gates JWT minting behind `import.meta.env.DEV`. Vite tree-shakes DEV-only code from production bundles. The `VITE_DEV_JWT_SECRET` env var is gitignored (`apps/web/.env.local` in `apps/web/.gitignore`); a sibling `apps/web/.env.example` documents the required vars without committing the secret.
- **Reversibility.** When Epic 2 lands real Supabase Auth, `apps/web/src/lib/auth.ts` rewrites to use `@supabase/supabase-js` (`signInWithPassword`, `useSession()` mapped to Supabase's `onAuthStateChange`); the consumer surface (`useSession()` returning `{ accessToken, user: { id, brandId, role } }`) stays identical, so all 7 production pages built in Arc (c) keep working. The dev login affordance is removed in Epic 2 — replaced by the real login screen at SI-USR-001.

**Cross-references:** Plan §6 Task C2 (Arc (c) auth carve-out); Master Spec FR14 (Brand Owner self-creation flow with Superadmin approval — depends on Approval Engine in Epic 3 — fundamentally Epic 2 territory); architecture §17.11 step 4 (JWT middleware); `apps/api/src/lib/test-jwt.ts` (the existing test-time JWT minter — same secret + claim shape that Arc (c) dev auth mirrors); `apps/api/src/middleware/auth.ts` (the verification path — unchanged); `apps/api/src/db/seed/brand-seed.ts` (prints the brand id at seed time — the one-time copy source); `apps/web/.env.example` (Arc (c) — documents required env vars).

## DL-030 — 2026-05-08 — SI-USR-008 Brand Owner Account Approval ships in Epic 2 as route-only (no menu link)

**Decision:** Phase 4 Epic 2 USR builds the SI-USR-008 Brand Owner Account Approval surface (schema column on `users.approval_status` + the apps/api `/users/pending-approval`, `/users/:id/approve`, `/users/:id/reject` endpoints + the apps/web `AccountApprovalPage` component at `/users/approvals`) — but **does NOT add the route to the apps/web sidebar nav**. Route guard is `<RequireRole role="superadmin">`. In MVP single-tenant (per DL-024 single-brand bootstrap) no real user holds the `superadmin` role, so the page returns 403 in normal navigation. Schema's `pending_approval` state is still populated by `userService.create` when role = `brand_owner` — preserving FR14's create-side semantics — but the approval-side surface is dormant until Phase 2 multi-tenant migration.

**Source:** Phase 4 Epic 2 USR kickoff brainstorming (2026-05-08) — user choice "Proceed as A" on the three-option product question (A: build now route-only / B: build with banner / C: skip entirely).

**Why this matters:**
- **MVP single-tenant has no Superadmin user.** Per PRD line 411–412, "In single-tenant MVP, the Brand Owner has equivalent access. Superadmin is a future-proofing role for multi-tenant migration." There is no existing user who would land on this screen during MVP.
- **Future-proofing without UX clutter.** Building the screen now keeps the SI-USR inventory honest at 8/8 SI-USR screens shipped. When Phase 2 multi-tenant migration ships and a real Superadmin user is provisioned, flipping the sidebar nav link on is mechanical — no schema, no service, no page redesign. Option C (skip entirely) would have forced revisiting Epic 2 territory inside the multi-tenant migration epic, adding an unnecessary cross-epic boundary crossing.
- **Cost vs C is small.** ~half a day of Arc (b) mockup + Arc (c) page work for a screen that has no MVP user. Trade-off: this work happens once; C would force revisiting it later AND would add a cross-epic DL chain explaining why the surface was retroactively added to Epic 2 territory.
- **Smoke-testable in dev.** Engineers can manually grant a test user the `superadmin` role via direct fnberp_dev DB update (not via UI — there is no admin UI to grant superadmin in MVP) to exercise the page during development. Production navigation never reaches this route in MVP.

**Cross-references:** FR14 (Brand Owner self-creation requires Superadmin approval); PRD line 411–412 (Superadmin future-proofing semantics); DL-024 (single-brand bootstrap — only one Brand Owner in MVP); spec `docs/superpowers/specs/2026-05-08-phase-4-epic-2-usr-design.md` §2 + §6 + §10.

## DL-031 — 2026-05-08 — MFA + SSO + custom role builder consolidated as post-MVP

**Decision:** Three security/RBAC features are explicitly out of MVP scope and deferred to post-MVP:

1. **MFA / 2FA / TOTP / authenticator apps** — login uses email + password only.
2. **SSO** — SAML, OIDC, Google, Microsoft, etc. — none integrated.
3. **Custom role builder** — module × action × scope role-template editor where Brand Owner can define new roles by composing permissions. The 9 fixed roles ship as enum values (per Epic 2 Arc (a) Task A3 schema); users can have per-user permission overrides on top of fixed roles (FR15a/b/c, in MVP) but the role definitions themselves are not editable.

**Source:** Phase 4 Epic 2 USR kickoff brainstorming (2026-05-08) — default consolidation, no user pushback.

**Why this matters:**
- **SSO is explicit per Master Spec line 125** — "Supabase Auth | — | Email/password (SSO post-MVP) | ✅ FINAL". The decision was already final before Epic 2.
- **Custom role builder is explicit per PRD line 612** — "the fixed role definitions ... themselves are not editable in MVP — full custom-role definition with module × action × scope permission grids is deferred to Phase 2." Already final before Epic 2.
- **MFA was silent across all canonical sources.** Zero mentions in `_planning/02-master-spec.md`, `_planning/03-prd.md`, `_planning/architecture.md`, `_planning/05-screen-inventory.md`, or `decision-log.md` (DL-001 → DL-029). The brainstorming default applied was: silent + sibling-deferred (SSO) = MFA also post-MVP. If MFA were materially required by any FR, it would surface explicitly somewhere; its absence is itself a signal.
- **Login UX is therefore minimal.** SI-USR-003 ships as plain email/password. No second-factor challenge step, no setup flow, no recovery-codes UX. SI-USR-004 password reset is the sole recovery affordance.
- **Per-user permission overrides cover the operational gap.** FR15a/b/c lets the Brand Owner grant or revoke individual permissions per-user without modifying role definitions — operationally adequate for MVP without a custom-role-builder UI. Power users get their adjustments via overrides; if patterns emerge across many users, that's a Phase 2 trigger to ship the builder.

**Cross-references:** Master Spec line 125 (SSO post-MVP); PRD line 612 (custom role builder post-MVP); FR14 / FR15 / FR15a/b/c (the in-scope user-management surface); spec `docs/superpowers/specs/2026-05-08-phase-4-epic-2-usr-design.md` §8.

## DL-032 — 2026-05-08 — Permissions catalog populated incrementally per epic, not big-bang upfront

**Decision:** The `permissions` table — global / non-brand-scoped — is seeded incrementally as each epic ships, not enumerated upfront across all 12 epics. Phase 4 Epic 2 Arc (a) seeds the catalog with Epic 1 MDM CRUD permissions (~12 keys: `mdm.org.read/write`, `mdm.products.read/write`, `mdm.categories.read/write`, `mdm.vendors.read/write`, `mdm.enablement.read/write`, `mdm.company.read/write`) and Epic 2 USR permissions (~6 keys: `usr.users.read`, `usr.users.read.cluster`, `usr.users.write`, `usr.permissions.read`, `usr.permissions.write`, `usr.accounts.approve`). Epic 3 (INF) adds `inf.approvals.*`, `inf.notifications.*`, `inf.audit.*`. Future epics extend via new migrations on top of `migrations/0008_seed_permissions.sql`, never re-seeding.

**Source:** Phase 4 Epic 2 USR kickoff brainstorming (2026-05-08) — default chosen over the alternative (full catalog upfront across all 12 epics).

**Why this matters:**
- **Avoids speculation.** Future epics' resource shapes (e.g., what permissions does the Approval Engine need? `approve.bulk`? `approve.delegate`? `approve.cancel`?) can only be defined by the epic that builds them. Pre-enumerating forces guessing, which becomes wrong-data-as-source-of-truth.
- **Avoids mid-build catalog refactors.** A big-bang Epic 2 catalog would lock in placeholder keys for epics not yet built; those epics would then need migrations to rename or restructure those placeholders. Each rename/restructure is a coordination cost with `role_permissions` rows + frontend `<RequirePermission>` consumers.
- **`role_permissions` mapping in `migrations/0008` only seeds roles for permissions that exist.** When Epic 3 adds `inf.approvals.approve`, its migration also adds `role_permissions` rows for the roles that should have that permission per the PRD §RBAC Matrix. The matrix itself is the source of truth for the role × permission mapping at every snapshot.
- **`<RequirePermission>` is the consumer pattern.** Frontend pages call `<RequirePermission permission="mdm.products.write">` against the catalog. If the catalog grows incrementally, the frontend stays in lockstep — no orphaned `<RequirePermission>` calls referencing keys not yet seeded.
- **DL-005 mockups-as-visual-spec analogue.** Just as mockups are drawn just-in-time per epic (not pre-mocked), the permissions catalog grows just-in-time per epic. Same discipline, different artifact.

**Cross-references:** FR15a (module × action × scope granularity); PRD §RBAC Matrix (role × permission source of truth); plan `docs/superpowers/plans/2026-05-08-phase-4-epic-2-usr-build.md` §4 Task A4 (the seed catalog content); spec `docs/superpowers/specs/2026-05-08-phase-4-epic-2-usr-design.md` §10.

## DL-033 — 2026-05-08 — DL-029 dev-stub auth replacement is single-commit big-bang at Arc (c) Task C1

**Decision:** Phase 4 Epic 2 Arc (c) Task C1 replaces `apps/web/src/lib/auth.ts` (the DL-029 dev-stub, jose-based HS256 minting in browser) with real `@supabase/supabase-js` integration in **a single commit, no transition period, no parallel-run, no feature flag**. The `useSession()` consumer surface is contractually preserved (return shape `{ session: { accessToken, user: { id, brandId, role } }, status, signIn, signOut }` — `signInDev` becomes `signIn`; `signOut` async; everything else verbatim) so all 7 Epic 1 production pages keep working without source change. The Playwright e2e suite (15/15 tests against real Supabase) is the safety net — it runs BEFORE the C1 commit lands, with hard-stop on any regression.

**Source:** Phase 4 Epic 2 USR kickoff brainstorming (2026-05-08) — default chosen over the alternative (parallel-run dev-stub + real-Supabase with feature flag during a transition window).

**Why this matters:**
- **Mechanical swap.** The contractual surface (`useSession()` return shape) is preserved by design — the swap is mechanical, not architectural. There is no decision in C1 to make wrong. The risk is implementation slippage (e.g., forgetting to map `user_metadata.role` correctly), not architectural divergence.
- **Type system catches divergence at compile time.** The `Session` interface in `apps/web/src/lib/auth.ts` is exported and consumed by all 7 Epic 1 pages. If C1's replacement file emits a different shape, TypeScript fails. If it emits the same shape but the runtime mapping is wrong, Playwright catches it.
- **Transition periods add complexity without protective benefit.** A feature flag would force every consumer to handle two different session sources (dev-stub vs real). The Epic 1 pages don't currently know which source they're consuming — and they shouldn't. Adding a flag for the swap window means re-introducing that knowledge, which has to be removed again at the end of the transition.
- **`apps/api` is unchanged.** The middleware verifies HS256 JWT with `SUPABASE_JWT_SECRET`. The env value's *origin* changes (test secret → real Supabase project's JWT secret) at A1 Step 6 (provisioning); the verification path is identical. So the swap is one-sided — apps/web only.
- **DL-029 deletion is total.** `signInDev`, `mintToken`, `verifyToken`, jose import, `VITE_DEV_JWT_SECRET`, `VITE_AUTO_DEV_SIGNIN`, the dev-mode dev-login button — all removed in C1. No DL-029 vestige remains.

**Cross-references:** DL-029 (the dev-stub carve-out being closed); plan `docs/superpowers/plans/2026-05-08-phase-4-epic-2-usr-build.md` §6 Task C1 (the swap implementation); `apps/api/src/middleware/auth.ts` (unchanged verification path); spec `docs/superpowers/specs/2026-05-08-phase-4-epic-2-usr-design.md` §6 + §10.

## DL-034 — 2026-05-08 — Epic 1 chrome-freeze deferred-gap closed in Epic 2 Arc (a) (categoryService.findSimilarByName)

**Decision:** Phase 4 Epic 2 Arc (a) Task A2 closes the single deferred gap from Epic 1's chrome-freeze review (sign-off at SHA `34f41d4`, 2026-05-07): extends `apps/api/src/services/categoryService.ts` with a `findSimilarByName(brandId, candidateName)` method using `pg_trgm` similarity (threshold 0.4), exactly mirroring `productService.findSimilarByName` from Epic 1. Frontend wiring of the third CC-DUPLICATE-WARN consumer on `apps/web/src/pages/mdm/CategoriesPage.tsx` happens in Arc (c) Task C9. Independent of Task A1 (Supabase provisioning) — A2 can run in parallel while A1 awaits cost authorisation.

**Source:** Phase 4 Epic 2 USR kickoff brainstorming (2026-05-08) — default. Surfaced because the spec §1 reads of the Epic 1 chrome-freeze review at `docs/superpowers/reviews/2026-05-07-epic-1-mdm-chrome-freeze-review.md` flagged this as the only open gap.

**Why this matters:**
- **Closes a known DL chain.** DL-026 ("CC-DUPLICATE-WARN ships in Epic 1; SI-MDM-003 fix-back") committed three consumers in Epic 1: SI-MDM-003 Products (shipped), SI-MDM-005 Vendors (shipped), SI-MDM-006 Categories (deferred because `categoryService.findSimilarByName` didn't exist in Epic 1 Arc (a)). Epic 1 chrome-freeze review documented this as the lone gap. Folding the closure into Epic 2 Arc (a) — the next session that touches service modules — is the natural unblock; deferring further would compound the gap across more arcs.
- **Service module ownership is unambiguous.** `categoryService` belongs to MDM (Epic 1 territory). Even though Arc (a) is for Epic 2 USR, extending an Epic 1 service in this arc is correct because (a) the existing chrome-freeze gap is narrow + scoped to that one method, (b) Arc (a) is already touching service modules across the codebase, (c) the alternative (deferring to Epic 3+) would create a cross-epic fix-back rather than a same-arc closure.
- **Mirrors existing pattern verbatim.** `productService.findSimilarByName` (Epic 1) is the canonical implementation: pg_trgm `similarity()` on the `name` column scoped by `brand_id`, threshold 0.4, ordered DESC, top 5. Task A2 copies this pattern without judgment — it's a mechanical extension, not a design exercise.
- **Frontend wiring is small.** Arc (c) Task C9 is a single-page edit on CategoriesPage to import `useFindSimilarCategories` and render `<CCDuplicateWarn matches={similarMatches} />` per the existing two consumers' shape. ~30 lines.

**Cross-references:** DL-026 (CC-DUPLICATE-WARN three-consumer commitment); Epic 1 chrome-freeze review at `docs/superpowers/reviews/2026-05-07-epic-1-mdm-chrome-freeze-review.md` (the deferred-gap log); plan `docs/superpowers/plans/2026-05-08-phase-4-epic-2-usr-build.md` §4 Task A2 + §6 Task C9; `apps/api/src/services/productService.ts` (the canonical pattern being mirrored).

---

## DL-035 — 2026-05-08 — Epic 3 ships in-app notifications only; email channel deferred until sending domain registered

**Decision:** Phase 4 Epic 3 INF (Shared Infrastructure) ships the Notification Center with **in-app delivery only**. Email transport (Resend per DL-011) is deferred until a sending domain is registered + DNS-verified (DKIM/SPF). Implementation:
- `notification_type_config` rows (seeded in migration 0011) all have `email_mode='none'` in MVP. Every type Epic 3 emits is in-app-only.
- The `notificationCenter.send()` code path looks up `email_mode`, branches accordingly, and never enqueues email jobs in MVP because no row says `'immediate'` or `'digest'`.
- The `notification-digest` pg_cron handler ships as a no-op until any row has `email_mode='digest'`. Same code path activates post-domain-registration without rewrites.
- SI-INF-003 Notification Preferences page renders email-channel toggles **greyed-out with tooltip "Email channel coming when sending domain registered."** The toggle state is preserved (column exists in `notification_preferences`) so user-set preferences survive the eventual flip.
- SI-INF-004 Notification Digest Preview shows the in-app digest only. Header reads "Digest preview (in-app)."

Re-enabling email post-MVP is one-row updates per type in `notification_type_config` (`email_mode='immediate'` or `'digest'`) plus Resend account provisioning + React Email templates + DKIM/SPF DNS records on the registered domain. Estimated post-MVP cost: half a day to a day of focused work — most of the wiring is already in place.

**Source:** Phase 4 Epic 3 INF kickoff brainstorming (2026-05-08) — surfaced when the cost gate for Resend signup hit "no domain registered yet" from the user. Decision: defer email channel rather than block Epic 3 on out-of-band domain registration work.

**Why this matters:**
- **DL-011 (Resend + pg-boss + data-driven dispatch) remains the canonical post-MVP design.** This DL amends the email-mode default from "per-type configurable" to "force `email_mode='none'` in MVP seed" — it does NOT supersede DL-011's choice of provider, queue mechanism, or dispatch model. The activation path stays the data-driven flip described in DL-011.
- **Single-tenant MVP can run on in-app alone.** Per DL-010 channel #2 (`notifications` Realtime), every authenticated user receives in-app notifications instantly when the app is open. The journeys in `_planning/05-screen-inventory.md` (Brand Owner morning triage, Cluster Manager variance investigation) all happen with the user logged in — email is the off-system / escalation channel, not the daily-driver.
- **Domain registration is non-trivial out-of-band work.** Registrar choice (Namecheap / GoDaddy / Cloudflare), domain pick (`fnberp.com` / `wildsugar.com` / other), purchase, DNS configuration to add CNAME + TXT records for Resend verification, and SPF policy reconciliation if the user uses Google Workspace / other senders on the same root domain. None of this is implementation work; blocking Epic 3 on it would stall progress for non-Epic-3 reasons.
- **No code rot risk.** The dispatch model is data-driven from the start. The email-send code path exists and is unit-testable post-domain-registration without any new code being written. The `notification-digest` pg_cron handler ships as a scheduled job that immediately exits when no email mode is active — no idle worker burning resources.
- **Re-enabling is a configuration flip + provider provisioning, not a re-engineering.** Pre-emptive deferral catches the "we'll wire it up later" trap by ensuring the wiring shape is right from day one.

**Cross-references:** DL-011 (Resend + pg-boss + data-driven dispatch — this DL amends the MVP email-mode default but does not supersede the post-MVP design); FR18 (notification channels); FR19 (digest batching + escalation); PRD line 620 ("in-app as MVP priority, email as second priority"); SI-INF-003 + SI-INF-004 inventory entries; spec `docs/superpowers/specs/2026-05-08-phase-4-epic-3-inf-design.md` §4 Task A2 (notification schema seeds) + §6 Task C5 (preferences UI).

---

## DL-036 — 2026-05-08 — SI-INF-002 Approval Chain Configuration ships as full editor in MVP, not seed-via-migration

**Decision:** SI-INF-002 ships as a real CRUD editor with ordered step builder, role assignment per step, value-band selectors, escalation timeout, fallback delegate, draft / active / inactive state. Brand Owner-only via `<RequirePermission permission="inf.approval.configure_chains">`. Default chains seed in migration 0010 for the FR-named entities (PO threshold per FR41, GR shelf-life exception per FR38, recipe default change per FR50, BO self-creation per FR14, inventory adjustment per FR37); seeded chains are immediately editable by Brand Owner via the SI-INF-002 editor.

**Source:** Phase 4 Epic 3 INF kickoff brainstorming (2026-05-08) — user choice "A" on chain-editor scope.

**Why this matters:**
- **Operational flexibility for Brand Owners.** Chain-tuning is a real activity over time: comfort thresholds grow (the BO who initially required approval over ₹50,000 may relax to ₹100,000 after six months of clean operations), new entity types start routing (B2B credit limit changes per FR47b), fallback delegates change (a Cluster Manager leaves the company). Seed-via-migration would require a code-deploy-migration cycle for every such change.
- **Single-tenant MVP still benefits.** Even with one Brand Owner and one brand, threshold tuning is a daily-relevance lever; the BO using the system is the primary user of the chain editor.
- **Editor scope is bounded.** The shell `<CCApprovalChainEditor>` (Arc (b) Task B1) handles the structural complexity once; the SI-INF-002 page consumes it. Per-entity-type chain instances are CRUD-light (most BOs will edit a chain twice per year, not daily).
- **Multi-tenant readiness.** Post-MVP multi-tenant SaaS REQUIRES this editor — every tenant has its own chains. Building it now means multi-tenant migration is the same shape as single-tenant: chains scoped by `brand_id`, RLS-isolated, BO-editable.
- **Seed-via-migration shortcut rejected.** Functional but inflexible; every threshold change becomes a code-deploy-migration cycle. Operating cost compounds across brands and time. Not worth the Arc (c) engineering savings (~1–2 weeks).

**Cross-references:** FR16 (configurable approval chains + threshold-based routing + delegation); SI-INF-002 inventory entry; spec `docs/superpowers/specs/2026-05-08-phase-4-epic-3-inf-design.md` §5 Task B1 (chain editor shell) + §6 Task C4 (chain config page).

---

## DL-037 — 2026-05-08 — Permission overrides remain Brand-Owner-direct writes; not retroactively routed through Approval Engine

**Decision:** Phase 4 Epic 2 USR shipped FR15a permission overrides as direct writes (Brand Owner authors override → audit row → effective; no approval routing). Phase 4 Epic 3 INF does NOT retroactively route permission overrides through the Approval Engine. The Approval Engine routes only the entities the canonical FRs name: PO threshold (FR41), GR shelf-life exception (FR38), recipe default change (FR50), BO self-creation (FR14), inventory adjustment (FR37), B2B customer credit limit changes. Permission overrides are NOT in that list.

**Source:** Phase 4 Epic 3 INF kickoff brainstorming (2026-05-08) — user choice "A" on retroactive routing.

**Why this matters:**
- **FR15a/b/c don't name approval routing.** PRD lines 612–614 describe overrides as Brand-Owner-direct authoring with audit-trail accountability (FR15c via FR20). The override system is intentionally direct-write in MVP per the PRD.
- **Single-tenant MVP has no second approver.** Per DL-024 single-brand bootstrap, the only Brand Owner is the founder using the system; no second Brand Owner exists to route to anyway. A multi-step approval chain with no real second-step approver is dead code.
- **Audit trail is the accountability layer.** Every override writes an audit row (FR15c) with mandatory reason code, modifying user, timestamp, expiry, and (for revocations) the prior state. The "permission overrides expiring soon" widget on the Brand Owner's dashboard surfaces overrides for visibility.
- **Multi-tenant ships post-MVP and revisits.** When multi-tenant lands and there are many Brand Owners per brand or shared-brand structures, the threat model changes (rogue co-Brand-Owner) and approval routing becomes a legitimate question. That's Phase 5+ territory; not Epic 3 territory.
- **Approval routing for high-impact override classes considered + rejected.** Categorising permissions by impact (e.g., `*.delete` grants need a second approver) was considered — rejected because the override system doesn't categorise permissions by impact, and inventing a meta-classification mid-Epic-3 is premature. Single-tenant MVP doesn't need it.

**Cross-references:** FR15a (permission overrides — Brand-Owner-direct authoring); FR15b (effective permissions view); FR15c (audit trail of overrides); DL-024 (single-brand bootstrap — only one BO exists in MVP); Epic 2 chrome-freeze review at `docs/superpowers/reviews/2026-05-08-epic-2-usr-chrome-freeze-review.md`; spec `docs/superpowers/specs/2026-05-08-phase-4-epic-3-inf-design.md` §8 (out of scope).

---

## DL-038 — 2026-05-08 — SI-INF-006 Activity Timeline first production consumer is SI-USR-002 view-mode user mutation history

**Decision:** The `<CCActivityTimeline>` shell ships in Phase 4 Epic 3 Arc (b) (Task B5) and is mounted in Arc (c) Task C7 on `apps/web/src/pages/usr/UserCreateEditPage.tsx` view-mode as a "Mutation history" section. Same task lands the deferred "Active permission overrides" inline summary per the Epic 2 chrome-freeze §9.2 follow-through. Both sections render below the existing form sections; existing form behaviour unchanged.

**Source:** Phase 4 Epic 3 INF kickoff brainstorming (2026-05-08) — user choice "B" on timeline mount scope.

**Why this matters:**
- **Shell-only ship risks late integration gaps.** If `<CCActivityTimeline>` ships in Epic 3 with no production consumer, its first real-data integration is during Epic 4 INV (mounted on Stock Adjustment / GR / Production Order detail surfaces). Bugs surfaced there would be Epic 3 bugs caught in Epic 4 — gaps span an epic boundary.
- **Epic 2 already writes user audit rows.** Every Epic 2 user mutation (create, update, role change, scope change, deactivate) writes an audit_log row per DL-013. Mounting the timeline on USR-002 view-mode validates the shell against real data immediately, in Epic 3.
- **USR-002 was already going to be revisited.** Epic 2 chrome-freeze review §9.2 deferred the "Active permission overrides for this user" inline summary to Epic 3, with rationale that the per-user summary becomes valuable when the cross-cutting Approval Engine is wired in Epic 3. The mutation-history embed is a second deferral that fits the same revisit; landing both sections in one task minimises USR-002 churn.
- **One real consumer is enough.** Mounting on multiple Epic 1+2 surfaces (e.g., Vendor detail, Product detail) was considered — rejected as scope creep. Epic 1 didn't ship dedicated entity-detail routes for Vendor/Product (they ship list + edit-form pairs); adding detail routes mid-Epic-3 would touch Epic 1 territory unnecessarily. Wait until Epic 4+ when transactional entity-detail surfaces ship and mount the timeline there.
- **Pattern is reusable.** The Arc (c) Task C7 implementation is the canonical pattern Epic 4+ epics copy: `<CCActivityTimeline entityType="..." entityRef="..." />` consuming `auditService.getEntityTimeline()`.

**Cross-references:** SI-INF-006 inventory entry; FR21 (activity timeline per entity); DL-013 (audit_log application-layer primary); Epic 2 chrome-freeze review §9.2 (deferred items); spec `docs/superpowers/specs/2026-05-08-phase-4-epic-3-inf-design.md` §5 Task B5 (timeline shell) + §6 Task C7 (USR-002 embed).

---

## DL-039 — 2026-05-08 — Issue Tracker ships full scope in Epic 3 — comments + attachments + Realtime channel #5 — not lite scope

**Decision:** Phase 4 Epic 3 INF ships SI-INF-007 + SI-INF-008 with the complete inventory-described surface: ticket CRUD, status transitions, priority + assignee picker, linked-entity reference (auto-prefilled from `CC-ISSUE-TICKET-LINK`), **comments thread** (Realtime channel #5 per DL-010), **file attachments** (DL-017 per-brand bucket + Express signed-URL flow). Attachments are **first exercised in production** in Epic 3 — not deferred to Epic 4 INV. Comments + attachments are not lite-scoped.

Arc (c) Task C8 splits into three sub-commits to manage context:
- C8a — list + form basics + status transitions + linked-entity wiring.
- C8b — comments thread + Realtime channel #5 wiring.
- C8c — attachments via `<CCFileAttachUploader>` + Express signed-URL flow.

If Arc (c) context tightens past 60–70% during C8b, C8c can defer to a follow-up commit on the same `phase-4/epic-3-inf-arc-c-frontend` branch (not a separate epic).

**Source:** Phase 4 Epic 3 INF kickoff brainstorming (2026-05-08) — user choice "A" on Issue Tracker scope.

**Why this matters:**
- **Comments thread is core to the variance-investigation journey.** Per SI-INF-007 inventory source-journey: "Cluster Manager — issue tracker assignment and resolution within 4 hours (digest line 33)"; "Brand Owner — variance investigation assignment to Cluster Manager via issue tracker (digest line 21)." Without comments, the ticket is just a flag — the workflow loses its "we discussed this and resolved it like this" loop.
- **Attachments belong to the variance-investigation journey too.** POS Staff documenting damaged items, Kitchen Manager attaching a photo of a wastage incident, Cluster Manager attaching a vendor delivery slip to a quality-rejection ticket — these are all real ticket-attachment scenarios per the source journeys.
- **DL-017 first-exerciser placement.** Issue ticket attachments are the cleanest first surface for the per-brand bucket + Express signed-URL flow because (a) the workflow is small and well-defined (single file attached to a ticket; single download URL retrieved on view), (b) integration tests are easy to write, (c) no business-logic dependencies on file content (vs. GR scanning where the OCR/barcode workflow adds complexity). Epic 4 INV inherits a tested signed-URL flow; Epic 3 absorbs the integration cost.
- **Realtime channel #5 already triaged.** DL-010 named `issue_tracker_threads` as channel #5; wiring it in Epic 3 honours the canonical Realtime triage. Two-session live-update test (BO + CM in two browser tabs commenting on the same ticket) validates channel #5 end-to-end.
- **Lite scope considered + rejected.** Q5 brainstorming weighed three options: A (full), B (lite — tickets + comments, no attachments), C (lite-lite — tickets only). User chose A explicitly because variance investigation across multi-store F&B inherently includes photo evidence; deferring attachments would force descriptive text where photos serve better.
- **Scope-blow risk mitigated by C8a/b/c split.** Three sub-commits with explicit context check-in at C8b close means if context tightens, C8c is a small follow-up rather than a re-plan. This pattern matches the Arc (a) explicit cost-gate pattern from Epic 2 (Task A1 at the front; later tasks unblocked by the gate).

**Cross-references:** FR22 (issue tickets — create / assign / track / resolve); DL-010 (5-channel Realtime triage; channel #5 = `issue_tracker_threads`); DL-017 (per-brand Supabase Storage bucket + Express signed-URL access); SI-INF-007 + SI-INF-008 inventory entries; spec `docs/superpowers/specs/2026-05-08-phase-4-epic-3-inf-design.md` §5 Tasks B3 (Issue Tracker pair shells) + §6 Task C8 (frontend implementation).

---

## DL-040 — 2026-05-08 — SI-USR-008 wrapped by Approval Engine via inbox-card-links-out only; SI-USR-008 page UX unchanged

**Decision:** SI-INF-001 Unified Approval Inbox renders Brand Owner Account Approval pending requests as cards. Card click navigates to `/users/approvals?id=<requestId>` (the existing Epic 2 SI-USR-008 page) where Superadmin reviews + decides via the existing UI. The inbox is a discovery affordance only; the existing SI-USR-008 page stays the action surface. **No inline approve/reject in the inbox card for BO approvals.** Other approval types (PO threshold per FR41, GR shelf-life exception per FR38, etc.) WILL have inline action affordances in the inbox card (because no standalone page exists for them); the BO-creation case keeps drill-through to preserve SI-USR-008 unchanged.

**Source:** Phase 4 Epic 3 INF kickoff brainstorming (2026-05-08) — user choice "A" on SI-USR-008 wrapping pattern.

**Why this matters:**
- **Honors the kickoff prompt's "purely additive" constraint.** The kickoff prompt for Epic 3 explicitly said "the wrapping is purely additive (no UX-breaking changes to the SI-USR-008 page already shipped)." Drill-through is the cleanest read of "additive" — SI-USR-008 is untouched; the inbox just gains visibility into pending BO approvals.
- **Avoids forking UI logic.** Inline approve/reject in the inbox would duplicate UI logic across the inbox card and the standalone page. Approval Engine semantics (audit row, notification dispatch, escalation timer) belong in one place — the approvalEngine service. The UI surface that calls the service should also be one place per approval type.
- **DL-030 carve-out preserved.** Epic 2 DL-030 documented SI-USR-008 as route-only / Superadmin-gated / not in nav. Epic 3 wrapping doesn't change any of that. The Superadmin still navigates to `/users/approvals?id=<requestId>` via the inbox click; the page renders as designed.
- **Pattern divergence is acceptable.** Different approval types have different surface shapes in the inbox. PO approval cards have inline approve/reject + amount band. BO Account Approval cards have a "Review approval request" link that drills to the canonical page. The inbox card pattern carries a `variant` or rendering rule per entity type; the discriminator is `entity_type` on the approval_requests row.
- **Future-proofing for multi-tenant.** When multi-tenant ships and there are many BO approvals to triage, the inbox + SI-USR-008 split still works — Superadmin batch-reviews via the inbox, drills into individual approvals via the existing page. No re-architecture needed.

**Cross-references:** DL-030 (SI-USR-008 route-only carve-out from Epic 2); FR14 (Brand Owner account creation requires Superadmin approval); SI-USR-008 + SI-INF-001 inventory entries; spec `docs/superpowers/specs/2026-05-08-phase-4-epic-3-inf-design.md` §6 Task C3 (Approval Inbox page implementation).

## DL-041 — 2026-05-09 — Phase 4 Epic 3 Arc (a) plan deviations adopted as canonical

**Decision:** During Arc (a) implementation (PR #23, merged 2026-05-09), four deviations from the build plan template landed in `main` and are hereby adopted as canonical for the rest of Epic 3 + downstream work:

1. **Storage bucket name format = `brand-<brandUuid>`, not `brand-<slug>`.** The `brands` table has no `slug` column in MVP single-tenant. `apps/api/src/storage/signed-url.ts` documents the choice in its file header. Post-MVP multi-tenant work introduces slugs as a separate migration; bucket renames at that point are a one-time data migration, not a continuous concern. The provisioned bootstrap bucket `brand-98e06998-76e2-4e9f-b2aa-d824cf493685` (private; 10 MB cap; MIME allowlist) is the canonical name format.
2. **`notification_preferences` unique constraint is `(user_id, type)`, not `(brand_id, user_id, type)`.** Spec §4 Task A2 prescribed the three-column shape; migration 0009 + `notificationCenter` service agree internally on the two-column shape. Justification: `users.id` is globally unique within the bootstrap-BO Auth realm and the FK chain `users.brand_id → brands.id` makes `(user_id, type)` already brand-scoped transitively. Multi-tenant post-MVP either re-validates this or migrates to the three-column form; not a forcing concern in single-tenant.
3. **pg-boss v12 (not v9).** v12's batch-handler API is cleaner than v9's polling shape; `apps/api/package.json` has `engines.node >= 22.12.0` to fail loudly if a deploy target downgrades Node below v12's minimum. Consequence: any deploy host running Node < 22.12 will fail npm install with a clear error rather than silently breaking the escalation handler.
4. **Filename `audit.service.ts` (not `auditService.ts`).** Kebab-case is the existing repo convention (Epic 1 shipped `audit-log.service.ts` as the WRITE side; Epic 3 ships `audit.service.ts` as the READ side). The two coexist: `audit-log.service.ts` is the application-layer-primary write path per DL-013; `audit.service.ts` is the read-side query layer for SI-INF-005 + SI-INF-006 timeline embed. Spec §3 file structure listed `auditService.ts` in camelCase; treat as a pre-merger drift, not a binding constraint.

**Source:** Phase 4 Epic 3 INF Arc (b) kickoff (2026-05-09) — author surfaced the deviations from PR #23 review; user explicitly approved capturing them as DL-041 before Arc (b) starts so Arc (c) consumers (and any future epic inheriting DL-017 storage / pg-boss escalation / audit-read patterns) have the canonical reference, not the stale spec text.

**Why this matters:**
- **Arc (c) consumers need the bucket-name truth.** `<CCFileAttachUploader>` (mockup in Arc (b); production wiring in Arc (c) Task C8c) constructs storage paths against the live bucket. Spec text says `brand-<slug>`; live infra says `brand-<uuid>`. Capturing here means the Arc (c) implementer reads the canonical name from this DL, not from the build plan.
- **Future epics inherit DL-017 + pg-boss patterns.** Epic 4 INV (FR39 vendor docs + FR81 production batch photos) will exercise DL-017 signed-URL flow; Epic 5+ will likely use pg-boss for additional async jobs. Both should follow the v12 + uuid-bucket conventions established here, not the v9 + slug-bucket spec text.
- **Notification-preferences unique-key shape is load-bearing.** Arc (b) `<CCNotificationPreferenceMatrix>` mockup is informational only, but Arc (c) `useNotifications` hook + `savePreferences` mutation send `(user_id, type)` keys. If a future migration tries to add `brand_id` to the unique constraint without re-checking the service, it'll silently break upserts.
- **Spec drift documented, not silently ignored.** The four deviations are factual (verified against `main` at bb6e18e) and binding. Recording them here closes the gap between spec text and shipped code; future sessions read this DL before assuming spec text is authoritative on these points.

**Cross-references:** PR #23 (Arc (a) merge — 2026-05-09); spec `docs/superpowers/specs/2026-05-08-phase-4-epic-3-inf-design.md` §3 (file structure) + §4 Task A2 (notification_preferences) + §4 Task A7 (pg-boss); DL-013 (audit-log application-layer-primary write); DL-017 (per-brand Supabase Storage bucket + Express signed-URL access); DL-019 (`@react-pdf/renderer` on pg-boss worker — re-confirmed by v12 upgrade); FR18 (notification preferences) + FR22 (issue tickets) — both load-bearing on the deviations above.

## DL-042 — 2026-06-22 — First production deployment: all-on-Vercel full-stack

**Decision:** The app was deployed to Vercel as a single project after a 30+ day pause, on user request ("deploy this project to Vercel, share link"). Architecture chosen (user-approved): **all-on-Vercel** — Vite SPA + Express backend as a serverless function + the existing Supabase Mumbai project (`rqwlgvozrurftnlhchih`) as the live data database. **Public link: `https://fnb-erp-smoky.vercel.app`.**

Key setup (all on `main`, commits `ce2d78e` + `f8eeb65`):
1. **App/server split.** `apps/api/src/index.ts` is now a pure app factory (`createApp()`, no side effects). The HTTP boot + pg-boss start moved to new `apps/api/src/server.ts` (local `dev` + any traditional host only). Vercel imports the factory; tests unchanged.
2. **Serverless function.** `api/index.ts` (with `api/package.json` `"type":"module"`) re-exports a single self-contained esbuild bundle `apps/api/dist-vercel/server.mjs`, produced by `apps/api/scripts/build-vercel.mjs` (added `esbuild` devDep to apps/api). Bundling was REQUIRED: importing the compiled dist directly crashed at runtime with `ERR_REQUIRE_ESM`, and `@fnberp/shared` ships un-transpiled TS that the file-tracer can't run. The bundle inlines + transpiles everything.
3. **Routing.** `vercel.json`: `buildCommand` builds api (tsc) → esbuild bundle → web (vite); `rewrites` send `/api/(.*)` → the function and everything else → `/index.html` (SPA). Frontend API base URL is same-origin/relative in production (`api-config.ts`).
4. **DB connection = Supabase transaction pooler, port 6543 (IPv4).** Vercel functions are IPv4-only, so the IPv6 direct host is unusable from Vercel — the pooler is mandatory. `db/client.ts` sets `prepare:false` (PgBouncer requirement) + `max:1` in production.
5. **Env (6 vars, Vercel production):** `DATABASE_URL` (pooler, encrypted), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. **The Supabase DB password was reset during this work (the prior value was invalid); the new value lives ONLY in Vercel `DATABASE_URL` — it is intentionally NOT in the repo.**
6. **Cloud DB provisioning.** Epic 1+2 tables pre-existed in Supabase. Applied Epic 3 INF migrations (`0009` schema + RLS), INF permissions (`0010`), notification config (`0011`), default chains (`0012`); inserted the Brand Owner `users` row; **aligned `auth.users.raw_user_meta_data.brand_id` to the cloud brand `98e06998-76e2-4e9f-b2aa-d824cf493685`** (it pointed at a stale local brand UUID, which would have scoped every query to an empty brand). Connection role `postgres` has `rolbypassrls=true`, so the app's explicit brand-scoping (DL-027) works as designed.
7. **Demo login:** `bootstrap-bo@fnberp.local` / `BootstrapBO!2026-Dev` (already the dev defaults in `bootstrap-supabase-bo.ts`).
8. **Public-access toggle.** Vercel "Deployment Protection → Vercel Authentication" had to be disabled (manual dashboard step — no CLI/API path available to the agent) so the link is publicly reachable. The `*-darshan…-projects.vercel.app` domains stay walled; **share the `fnb-erp-smoky.vercel.app` alias.**

**Deferred / known limitations:**
- **pg-boss background jobs do NOT run in serverless** (no `startJobs()`; `getBossInstance()` returns null → escalation timers + notification digests no-op cleanly). Making them run needs a separate persistent host (Render/Railway/Fly) — a future "dedicated backend" task if/when timed automation is needed.
- **Task C10 (audit-link sweep) was finished only enough to make the web build pass** (entityType added to the 3 remaining `<AuditLink>` call sites). Not separately reviewed/tested — treat as provisional.
- Verified end-to-end over the public URL: SPA loads, Supabase login mints a JWT, `/api/v1/ping` returns the correct `brandId`, `/api/v1/users` + `/api/v1/approvals/chains` return brand-scoped data.

**Why this matters:** This is the first time the ERP runs anywhere other than the developer's laptop. Future sessions: pushes to `main` auto-deploy to Vercel production; the serverless constraint (no long-running pg-boss worker) is structural, not a bug; and the data DB is now the Supabase cloud Postgres (via pooler), distinct from local `fnberp_dev` used for dev/tests.

**Cross-references:** DL-007 / DL-029 / DL-033 (Supabase Mumbai + auth swap); DL-027 (brandedDb explicit brand-scoping — why `postgres` bypassing RLS is fine); DL-041 #3 (pg-boss v12 + Node ≥22.12 — same engine now runs as the bundled serverless function, minus the worker); commits `ce2d78e` (deploy config) + `f8eeb65` (serverless ESM-bundle runtime fix).

## DL-043 — 2026-06-23 — Raw-material department-to-department transfers permitted within a cluster

**Decision:** `inventoryService.transferStock` / `transferService` permit **raw-material transfers directly between two departments in the same cluster** — a deliberate deviation from Master Spec §2.2 ("Raw Materials: Downward only … Never lateral"). Founder decision, this session (Epic 4 INV Arc (a) brainstorming), framed operationally: a kitchen department may hand raw materials to another department in its cluster without routing back through a store.

Guardrails that REMAIN enforced at the service layer (`validateTransferFlow`, spec §5):
1. **Same-cluster only** — cross-cluster transfers are rejected (`ClusterBoundaryError`) for ALL product types; cross-cluster movement goes through the paired Brand-Store bundle workflow.
2. **Destination enablement** — the destination department must have the item enabled (`checkEnablement`) → else `EnablementViolationError`.
3. **Never upward into a store** — a `transferStock` destination is always a department, never a store.
4. **Sufficient FEFO stock** at source (enforced inside the locked deduction).

Semi-product (lateral within cluster) and final-product (production→dispatch→POS, no POS↔POS, no backward) rules are unchanged.

**Source:** Epic 4 INV Arc (a) brainstorming, founder answered "Allow it" to the raw-transfer question 2026-06-23.

**Why this matters:** §2.2 is otherwise canonical and enforced in business logic, not just UI. This entry is the formal, auditable record that the raw-material lateral case is an intentional allowance — not an enforcement bug — so a future reviewer doesn't "fix" it back. The cross-cluster and upward-into-store prohibitions still hold.

**Cross-references:** Master Spec §2.2 (three-product-type flow rules); PRD FR28 (service-layer flow enforcement), FR29 (transfers); spec §0 + §5 (`docs/superpowers/specs/2026-06-23-epic-4-inv-arc-a-backend-design.md`); `apps/api/src/services/transfer.service.ts` (`validateTransferFlow`); test `apps/api/tests/integration/stock-transfer.test.ts` case 2 (raw dept→dept within cluster succeeds).

## DL-044 — 2026-06-23 — Epic 4 INV Arc (a) widened to the full inventory backend

**Decision:** Arc (a) of Epic 4 was scoped in the session brief to the three core stock tables + the §8.1 `inventoryService` methods. On founder direction ("build in full, use agent-driven development wherever necessary"), Arc (a) was **widened to the complete Epic 4 inventory backend**: stock engine, goods receipt (yield/QC reject), transfers + paired bundles + suggestions, adjustments, closing inventory + cut-off, PAR levels + below-PAR — schema + service layer + REST routes + integration tests for all 16 SI-INV screens' data needs. UI (Arcs b/c) remains deferred.

Cross-epic touchpoints are built as **minimal stubs/foundations**, completed by their owning epic later:
- Purchase Orders (Epic 5): `goods_receipts.po_id` nullable, FK-less; PO progression a no-op `poProgressionStub`.
- Vendor Credit Notes (Epic 5): GR rejection recorded (`gr_rejection_records.vcn_deferred=true`); VCN auto-draft a `// TODO(Epic 5)` stub.
- Accounting journals (Epic 10): a `journal_events` stub ledger row is written in-tx and its id returned as `journalEntryId` (satisfies the §8.1 contract); real posting deferred.
- Production-order trigger (Epic 7): `deductStock` is built AND tested directly; the In-Progress caller is Epic 7.
- Recipe/POS-driven expected closing counts (Epics 6/9): `getExpectedClosingStock` computes from inventory's own movement ledger; sold/recipe inputs stubbed 0.
- Approval Engine + Notification Center (Epic 3, already built): used for real (transfer/adjustment routing, cut-off alerts).
- `trn_sequences` (architecture §6.2.4) is first minted here since inventory is the first epic to allocate operational TRNs.

Build executed in 5 dependency-ordered waves via subagent-driven-development + TDD, landed via PR (no direct commits to `main`).

**Source:** Founder answer to the Arc-(a) scope question, Epic 4 INV brainstorming 2026-06-23.

**Why this matters:** Records that Arc (a) intentionally exceeds the brief's narrower table list, and pins the exact cross-epic stub boundary so Epics 5/6/7/9/10 know which seams they own. The per-epic 3-arc invariant still holds (Arc a = backend; b = mockups; c = frontend).

**Cross-references:** spec §0 + §2 (`docs/superpowers/specs/2026-06-23-epic-4-inv-arc-a-backend-design.md`); plan `docs/superpowers/plans/2026-06-23-epic-4-inv-arc-a-backend.md`; CLAUDE.md Phase 4 invariants (per-epic 3-arc structure); Master Spec §8.1 (inventoryService contract); DL-045 (migration strategy); DL-043 (raw-transfer allowance).

## DL-045 — 2026-06-23 — Migration 0013: single-file-per-wave strategy for Epic 4 INV

**Decision:** All Wave 1 (W1) core stock engine tables (`trn_sequences`, `journal_events`, `stock_levels`, `stock_batches`, `stock_movements`) land in a single migration file `0013_epic4_inv.sql`, following the pattern of `0009_epic3_inf.sql`. Subsequent waves (W2 Goods Receipt, W3 Transfers, W4 Adjustments + Closing, W5 PAR) each get their own migration (`0014`, `0015`, ...) as they are built. RLS policies are split into a companion file `0013_inv_rls.sql` (Supabase-only, mirrors `0004_inventory_rls.sql` and `0009_inf_rls.sql` pattern).

**Source:** Task 1.2 of Epic 4 INV Arc (a) — migration authoring.

**Why this matters:**
- One migration per build wave is the minimum safe unit: all intra-wave FKs resolve in the same transaction (e.g. `stock_movements → stock_batches → journal_events` are all in 0013 and reference each other).
- Drizzle `db:generate` is used to produce the base DDL; the output is renamed from its auto-generated tag (`0010_worried_marrow`) to the canonical `0013_epic4_inv` and hand-edited to add: unique constraints on `stock_levels (brand_id, product_id, department_id)`, `stock_batches (brand_id, product_id, department_id, batch_number)`, `trn_sequences (brand_id, transaction_type, location_code, year)`; and a partial FEFO index `WHERE quantity_remaining > 0` (replacing the plain composite that Drizzle emits).
- The Drizzle journal `_journal.json` entry is updated (`idx: 13`, `tag: 0013_epic4_inv`) and the snapshot renamed `0013_snapshot.json` so Drizzle's drift-detect stays consistent.
- `0013_inv_rls.sql` is NOT applied to local Postgres (no `auth.uid()`); it is applied to Supabase (production / preview) alongside the main file, same as every prior epic's `_rls.sql` file.

**Cross-references:** `apps/api/src/db/migrations/0013_epic4_inv.sql`; `apps/api/src/db/migrations/0013_inv_rls.sql`; `apps/api/src/db/schema/inventory.ts` (Epic 4 W1 tables); DL-044 (Arc (a) scope widened to full Epic 4 backend); spec §8 (build sequence / wave strategy).

## DL-046 — 2026-06-23 — Closing-inventory cut-off compliance uses server-local time (limitation)

**Decision:** `inventoryService.checkCutOffCompliance` (FR36) compares a closing-inventory submission timestamp against the `cut_off_registry.cut_off_time` (`HH:MM`) using the server process's local clock. There is no per-location timezone yet, so the comparison assumes a single operating timezone. This is recorded as a **known limitation**, not a finished feature.

**Source:** Epic 4 INV Arc (a) Wave 4 code review (finding I2), 2026-06-23.

**Why this matters:** Production runs serverless on Vercel in **UTC** (DL-042), while operations are in **IST (+5:30)** — so a naive local-time comparison can mis-classify on-time vs late around the cut-off boundary. The correct fix needs a per-location IANA timezone (e.g. a `timezone` column on `locations` or `cut_off_registry`) and a TZ-aware comparison. Deferred because no location-timezone data model exists in MVP. The comparison site carries a `// TODO` referencing this entry. Until fixed, cut-off "late/not-submitted" flags are advisory and may be off by the UTC↔IST offset near the boundary.

**Cross-references:** PRD FR36 (cut-off enforcement + Brand Owner alert); `apps/api/src/services/inventory.service.ts` (`checkCutOffCompliance`); DL-042 (Vercel serverless runs UTC); spec §4.3 (closing inventory).

**Update 2026-06-23 — RESOLVED (single-region IST):** Founder direction — the cut-off comparison now reads the submission timestamp's hour/minute in **`Asia/Kolkata` (IST, UTC+05:30)** via `Intl.DateTimeFormat`, independent of the server-process timezone, so it is correct on Vercel's UTC runtime. Implemented as `INVENTORY_OPERATING_TZ` + the `istHourMinute()` helper in `inventory.service.ts`; cut-off `HH:MM` values are IST wall-clock. Regression test `closing-inventory.test.ts` **T9b** pins the IST semantics (22:30 IST → late, 21:30 IST → on_time against a 22:00 cut-off; deterministic regardless of host TZ). Full suite 523 passing / 1 skipped. **Remaining future work (not a limitation for India-only ops):** a multi-region rollout would replace the fixed `INVENTORY_OPERATING_TZ` constant with a per-location IANA timezone column.

## DL-047 — 2026-06-23 — CC-IMPLAUSIBILITY-WARN + CC-VOICE-INPUT first visual treatment (Epic 4 Arc (b) mockups)

**Decision:** Two reusable cross-cutting pattern shells first surface in Epic 4 and receive their first visual design here, as `@/shell` components:
- **`CCImplausibilityWarn` (CC-IMPLAUSIBILITY-WARN, FR114)** renders as an **inline, per-line warn-and-log panel** beneath the offending quantity field — a sibling of the existing `CCDuplicateWarn` (DL-026). It uses the semantic `warning` token with a `border-l-4 border-warning` pip (allow-listed) and the `AlertTriangle` glyph (vs DuplicateWarn's `AlertCircle`). It **never blocks/disables the submit**: the user picks a mandatory reason code and clicks "Override & continue", and the panel collapses to an "Overridden · reason" chip. Consumer screens (SI-INV-005/010/011/013/014/015) gate their own submit until every flagged line is overridden.
- **`CCVoiceInput` (CC-VOICE-INPUT, FR112)** renders as a **trailing mic button inside a quantity field**, scoped to quantity fields only; tapping it shows a compact inline "Listening…" strip with the heard value and accept/cancel. Consumed on SI-INV-005/010/011/014/015 (NOT on adjustments SI-INV-013 — the screen inventory does not cite FR112 there).

**Motion exception:** the only animation introduced in the entire Epic 4 Arc (b) mockup set is the `CCVoiceInput` listening-indicator pulse — `animate-pulse motion-reduce:animate-none`, on the indicator dots only, never on a surrounding table/form/surface. This is interaction feedback on a control, reduced-motion-guarded (DESIGN.md §10.3/§10.5), NOT an entrance animation — so it does not violate the "no entrance animations on inventory/transaction screens" rule.

**Also captured:** `SI-INV-015` (Closing Inventory — Dispatch Daily) added to `TIER_1_IDS` for **deferred Tier-1 acceptance** (the session brief + Phase 4 invariant tag both apply: Tier-1 rigor even though built in Phase 4), mirroring the existing SI-USR/SI-INF deferred-Tier-1 entries. SI-INV-014 was already in the Tier-1 set.

**Source:** Epic 4 INV Arc (b) mockups — brainstorming + AskUserQuestion (founder chose inline-per-line implausibility + mic-on-field voice), 2026-06-23.

**Why this matters:** These patterns recur across Epic 7 (Production output) and other transactional epics; fixing the visual contract once, as reusable shells with token-clean styling, prevents per-screen drift and keeps the Epic-4 chrome-freeze gate (run at Epic 4 close, after Arc c) passable.

**Cross-references:** PRD FR114 (implausibility warn-and-log), FR112 (voice input on quantity fields); DL-026 (`CCDuplicateWarn` sibling); DESIGN.md §6.1 (closed status palette — implausibility uses semantic `warning`, not a new `status_*` token), §10.3/§10.5 (motion + reduced-motion); `docs/superpowers/specs/2026-06-23-epic-4-inv-arc-b-mockups-design.md`; `docs/superpowers/plans/2026-06-23-epic-4-inv-arc-b-mockups.md`.

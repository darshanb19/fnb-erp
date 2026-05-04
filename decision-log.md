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

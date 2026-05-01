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

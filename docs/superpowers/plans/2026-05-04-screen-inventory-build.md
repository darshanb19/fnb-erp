# Phase 2b — Screen Inventory Build Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce `_planning/05-screen-inventory.md` — a single, navigable, validated screen inventory covering all 12 epics of the F&B ERP, using the locked shape contract in `docs/superpowers/specs/2026-05-04-screen-inventory-shape-design.md` and the locked PRD/B2B spec/DESIGN.md inputs.

**Architecture:** A single Markdown file built incrementally, one epic per task, against three persistent reference artefacts already in the repo: (a) the shape spec (the schema and rules), (b) the digest at `_planning/_internal/phase-2b-digest.md` (synthesised journeys, FRs, parking-lot items, B2B surfaces, DESIGN.md tokens), (c) the source PRD/Master Spec/B2B spec/DESIGN.md. Each per-epic task ends with a clean commit. The closing tasks build the four appendices, run the validation harness, append the Phase-2b close note to `prd-review-notes.md`, and open the PR.

**Tech Stack:** Markdown only. Editor: VS Code via Claude Code. No code, no tests in the executable sense — the analogue of "make the failing test pass" is **"every chunk ends with a harness gap closed: every newly-introduced screen ID appears in the per-epic table-of-screens and in the relevant appendix-stub markers; every newly-cited FR moves from `unmapped` to `mapped` in the running FR-coverage tally."**

---

## File structure

| File | Status | Responsibility |
|---|---|---|
| `docs/superpowers/specs/2026-05-04-screen-inventory-shape-design.md` | Existing (committed `ded5afb`) | Locked shape contract — read once at start of every task as the schema reference. Never modified by this plan. |
| `_planning/_internal/phase-2b-digest.md` | Existing (uncommitted; see Task 0) | Stable digest of journeys / FRs / parking-lot / B2B surfaces / DESIGN.md tokens. Read by every per-epic task at its relevant section anchor. Never modified by this plan after Task 0. |
| `_planning/03-prd.md` | Existing | Source of truth for FR text. Read on demand for FR wording disputes. |
| `_planning/02-master-spec.md` | Existing | Source of truth for organisational hierarchy, product flow rules, epic sequencing. Read on demand. |
| `_planning/04-b2b-challan-spec.md` | Existing | Source of truth for B2B challan lifecycle and edge cases. Loaded fully in Task 8. |
| `DESIGN.md` | Existing | Source of truth for tokens and component patterns. Reference token names only (digest §E gives a name-only inventory). |
| `decision-log.md` | Existing | Read for DL-001 in Task 7. |
| `_planning/05-screen-inventory.md` | **Created in Task 0; populated through Task 13; closed in Task 14** | The deliverable. |
| `_planning/prd-review-notes.md` | Modified in Task 15 | Append Phase-2b close note. |

### Per-epic context budget rule

CLAUDE.md mandates: if context approaches 60–70%, STOP — split the story. To stay safe across the long build, **every per-epic task starts from a fresh Claude Code session** loading exactly: this plan, the shape spec, the digest, and the in-progress `_planning/05-screen-inventory.md`. The `Reading at start` block at the top of every per-epic task is the exact load list — do not exceed it without cause. If a fresh session approaches 50% context before screens are written, stop and split the chunk.

### Digest section anchor reference (line numbers)

Per-epic tasks reference these line ranges in `_planning/_internal/phase-2b-digest.md`:

```
SECTION A (Journeys)              line 16
  Journey 1 Brand Owner            18
  Journey 2 Cluster Manager        27
  Journey 3 Kitchen Manager        37
  Journey 4 Finance Manager        47
  Journey 5 Dispatch Staff         58
  Journey 6 Procurement Manager    67
  Journey 7 Store Manager          78
  Journey 8 POS Staff              87

SECTION B (FRs by Epic)            99
  Epic 1 MDM   FR1–FR9            101
  Epic 2 USR   FR10–FR15c         115
  Epic 3 INF   FR16–FR24          129
  Epic 4 INV   FR25–FR39          143
  Epic 5 PUR   FR40–FR47b         163
  Epic 6 REC   FR48–FR56          178
  Epic 7 PRO   FR57–FR70          192
  Epic 8 DSP   FR71–FR82          212
  Epic 9 POS   FR83–FR86          229
  Epic 10 ACC  FR87–FR99          238
  Epic 11 HRM  FR100–FR103        256
  Epic 12 RPT  FR104–FR111        265
  Cross-cutting FR112–FR119       (within §B by epic)

SECTION C (Parking-lot)           293
  P2B-001                         295
  P2B-002                         305
  P2B-003                         317
  P2B-004                         332
  P2B-005                         347
  Implicit FCCC                   (~370)
  Implicit Pending-GR drill       (~382)

SECTION D (B2B UI surfaces)       392
SECTION E (DESIGN.md tokens)      463
SECTION F (Cross-cutting FRs)     572
```

---

## Task 0 — Repo setup, digest commit, inventory skeleton

**Files:**
- Stage: `_planning/_internal/phase-2b-digest.md` (already on disk uncommitted)
- Create: `_planning/_internal/.gitkeep` if needed (not needed — the digest is the keep)
- Create: `_planning/05-screen-inventory.md` (skeleton with §1–§5 populated, §6 12 empty epic sections, §7–§10 empty appendices)

- [ ] **Step 0.1: Confirm branch and clean tree**

```bash
git branch --show-current
git status --short
```

Expected:
```
phase-2b/screen-inventory
?? _planning/_internal/phase-2b-digest.md
?? docs/superpowers/plans/2026-05-04-screen-inventory-build.md
```

- [ ] **Step 0.2: Create the inventory skeleton**

Write `_planning/05-screen-inventory.md` with:

- Document header (matching the spec header conventions in other `_planning/` files)
- §1 Preamble — purpose, scope, validation rules (copy verbatim from shape spec §1 + §9)
- §2 Epic abbreviation key (copy verbatim from shape spec §3)
- §3 Cross-cutting pattern catalogue (copy verbatim from shape spec §4 — all 21 `CC-*` rows; mark as "v1, additive growth allowed")
- §4 Roles & scope conventions — define the 8 role identifiers (Brand Owner, Cluster Manager, Kitchen Manager, Finance Manager, Dispatch Staff, Procurement Manager, Store Manager, POS Staff) and the 4 scope filters (`brand`, `cluster`, `location`, `department`)
- §5 Service-layer-only FRs — table with the 15 FRs from shape spec §5, "enforced in" column populated from PRD + Master Spec §8
- §6 Per-epic screens — twelve `## Epic N: <name>` headers each followed by an `> _Populated in Task N. (~X–Y screens estimated.)_` placeholder line
- §7 Appendix A — Role × Screen matrix (header only + `> _Populated in Task 13._`)
- §8 Appendix B — Journey × Screen traceability (header only + same placeholder)
- §9 Appendix C — FR × Screen traceability (header only + same placeholder)
- §10 Appendix D — Parking-lot honour (header only + same placeholder, with the 7 row-stubs P2B-001 … Implicit Pending-GR drill listed but unpopulated)

The §6 epic headers must use the codes from §2:

```
## Epic 1 — Master Data Management (MDM)
## Epic 2 — User Management & Security (USR)
## Epic 3 — Shared Infrastructure (INF)
## Epic 4 — Inventory Management (INV)
## Epic 5 — Procurement (PUR)
## Epic 6 — Recipe Management (REC)
## Epic 7 — Production Planning (PRO)
## Epic 8 — Dispatch & Distribution (DSP)
## Epic 9 — POS Integration (POS)
## Epic 10 — Accounting & Financial (ACC)
## Epic 11 — HRMS (HRM)
## Epic 12 — Analytics & Reporting (RPT)
```

- [ ] **Step 0.3: Verify §1–§5 are byte-faithful to the shape spec**

```bash
diff <(awk '/^## 3\. Epic abbreviation key/,/^---$/' docs/superpowers/specs/2026-05-04-screen-inventory-shape-design.md) \
     <(awk '/^## 2 Epic abbreviation key/,/^## 3/' _planning/05-screen-inventory.md | head -n -1)
```

(Visually inspect — minor whitespace OK; table content must match.)

- [ ] **Step 0.4: Stage and commit Task 0**

```bash
git add _planning/_internal/phase-2b-digest.md \
        _planning/05-screen-inventory.md \
        docs/superpowers/plans/2026-05-04-screen-inventory-build.md
git status --short
git commit -m "$(cat <<'EOF'
Phase 2b Task 0: digest, build plan, inventory skeleton

- Persist Phase-2b synthesis digest as _planning/_internal/phase-2b-digest.md
  for stable per-epic reference (54k chars, 599 lines, anchored sections A-F).
- Add docs/superpowers/plans/2026-05-04-screen-inventory-build.md per
  Superpowers writing-plans skill.
- Create _planning/05-screen-inventory.md skeleton: preamble, epic key,
  CC-* catalogue v1 (21 patterns), roles+scope, service-only FR table,
  twelve empty epic sections, four empty appendices.

Per-epic build chunks follow in Tasks 1-12; appendices in Task 13;
harness in Task 14; close-note in Task 15; PR in Task 16.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 0.5: Run context check before proceeding**

Open `/context` (or use the IDE indicator). Expected: well below 30%. If higher, end the session here and start Task 1 in a fresh session.

---

## Tasks 1–12 — Per-epic screen drafts (template)

Each per-epic task follows the same pattern. The pattern is given once below in full (Task 1) and abbreviated in Tasks 2–12 with epic-specific specifics.

### Per-epic task template — read once

For **every** per-epic task:

1. **Reading at start (the only files loaded):**
   - This plan (the current task only)
   - `docs/superpowers/specs/2026-05-04-screen-inventory-shape-design.md` (shape contract)
   - `_planning/_internal/phase-2b-digest.md` — read only the relevant Section B epic block + the relevant Section A journey blocks for the roles touching this epic + any P2B-* items the epic must honour
   - `_planning/05-screen-inventory.md` — current state

2. **Process per task:**
   - For each FR in the epic block (digest §B), determine: is it UI-bearing? If yes, which screen(s) cover it? If no, confirm it is already in §5 service-only table.
   - For each journey moment that touches this epic (digest §A), determine: which screen(s) honour it? If none yet, draft one.
   - For each parking-lot item this epic owns, draft the screen(s) and pattern instances that honour it.
   - Apply the granularity rule (shape spec §7): route-level by default; modal becomes its own ID only when ≥3 fields, fires journal/TRN, initiates approval, or paired/bundled action.
   - Apply the mobile/desktop variant rule (shape spec §8): one ID per workflow with `Primary device:`; genuine operational splits become separate IDs.
   - Use the `design:ux-copy` skill mentally for screen names and primary action labels — keep tone aligned with DESIGN.md tone-of-voice.

3. **Output per task:**
   - Replace the `> _Populated in Task N._` placeholder with the populated epic section
   - Open the section with a one-paragraph epic recap (2–4 sentences, plain English, what this epic delivers from the user's perspective)
   - Then a per-epic table of screens (`SI-{EPIC}-### | Screen name | Primary device | Primary roles`) — gives the reader a TOC of the epic
   - Then each screen entry following the §6 schema verbatim
   - Note any new `CC-*` pattern discovered (must be additive — do not rename existing IDs)
   - Note any DESIGN.md token gap discovered (record in screen `Notes:` as Phase-2c gap candidate)
   - Note any product ambiguity discovered (do NOT silently invent — record in `_planning/prd-review-notes.md` Phase-2b ambiguities section in Task 15)

4. **Per-task harness (cheap, runs in-session):**
   - Every FR listed in digest §B for the epic appears in at least one screen's `Source FRs:` line, OR is already in §5
   - Every journey moment listed in digest §A for the relevant roles, scoped to this epic, appears in at least one screen's `Source journey(s):` line
   - Every parking-lot item this epic owns is honoured by at least one screen and/or `CC-*` pattern
   - Every screen ID is unique within the epic and matches the `SI-{EPIC}-###` pattern

5. **Commit at end:**

```bash
git add _planning/05-screen-inventory.md
git commit -m "Phase 2b Task N: Epic <num> <name> (<EPIC>) — N screens"
```

The commit message should also list any new `CC-*` patterns added and any open ambiguities raised.

6. **Context check before declaring task complete:**

Run `/context`. If above 50%, **do not proceed to the next task in the same session**. End the session and resume in a fresh one.

---

### Task 1 — Epic 1 Master Data Management (MDM)

**Estimated screens:** 6–8

**Files:**
- Modify: `_planning/05-screen-inventory.md` (replace Epic 1 placeholder with populated section)

**Reading at start:**
- This plan (Task 1 + the per-epic template above)
- `docs/superpowers/specs/2026-05-04-screen-inventory-shape-design.md`
- `_planning/_internal/phase-2b-digest.md` lines 101–113 (Epic 1 FR table) + the role-relevant journey moments (Procurement Manager line 67, Store Manager line 78, occasional Brand Owner line 18 for company registration / FR9)
- `_planning/05-screen-inventory.md`

**FRs in scope:**
- FR1 Org hierarchy CRUD (Brand → Clusters → Locations → Departments)
- FR2 Department records with type classification
- FR3 Product registration (raw / semi / final + UOM, yield factor, shelf life, category)
- FR4 UOM with multi-level conversion factors
- FR5 Material enablement mapping (raw materials × departments)
- FR6 Vendor master (with scope tag Brand/Cluster/POS — Master Spec §2.7)
- FR7 Categories & sub-categories (M:N)
- FR8 Service-layer enforcement of enablement → already in §5; **no screen**
- FR9 Company registration details

**Journey moments to cover:**
- Procurement Manager — vendor record creation/maintenance (implied background to "vendor price comparison" moment)
- Store Manager — implied background (enablement and category mapping affects requisition processing)
- Brand Owner — company-level registration is a setup task (one-time + occasional edits)
- (No journey moment in digest §A is *primarily* an MDM moment; MDM screens are setup/admin surfaces.)

**Parking-lot items this epic owns:** none directly. (FR116 cross-module data quality detection is implemented in Epic 1 logic but its dashboard surfacing is in Epic 12 — capture in screen `Notes:` only.)

**Steps:**

- [ ] **1.1** Read the shape spec, the digest sections listed, and the current `_planning/05-screen-inventory.md` Epic 1 stub
- [ ] **1.2** Draft the per-epic recap paragraph (2–4 sentences) — answer "what does Master Data deliver to the user, in plain English?"
- [ ] **1.3** Draft the per-epic screens TOC table (one row per screen)
- [ ] **1.4** Draft each screen entry per the §6 schema. Likely candidate set (final IDs assigned during the task):
  - `SI-MDM-001` — Organisational hierarchy view & edit (FR1)
  - `SI-MDM-002` — Department register (FR2)
  - `SI-MDM-003` — Product master CRUD (FR3, FR4)
  - `SI-MDM-004` — UOM & conversion factors (FR4)
  - `SI-MDM-005` — Material enablement matrix (FR5; cross-link FR8 §5 enforcement)
  - `SI-MDM-006` — Vendor master CRUD with scope tag (FR6)
  - `SI-MDM-007` — Category / sub-category management (FR7)
  - `SI-MDM-008` — Company registration & fiscal-year setup (FR9)
- [ ] **1.5** Run the per-task harness (every FR1–FR9 either in a screen or in §5; vendor scope tag visible per Master Spec §2.7)
- [ ] **1.6** Commit:

```bash
git add _planning/05-screen-inventory.md
git commit -m "Phase 2b Task 1: Epic 1 Master Data Management (MDM) — N screens"
```

- [ ] **1.7** Run `/context` check. If above 50%, end session.

---

### Task 2 — Epic 2 User Management & Security (USR)

**Estimated screens:** 7–9

**Reading at start:**
- This plan (Task 2 + per-epic template)
- Shape spec
- Digest lines 115–127 (Epic 2 FR table); 18–25 (Brand Owner journey, for permission override workflows); 317–331 (P2B-003)
- `_planning/05-screen-inventory.md`

**FRs in scope:**
- FR10 User CRUD with role + department mapping
- FR11 Authentication (login + session)
- FR12 RBAC enforcement → §5 only; **no screen**
- FR13 Material enablement as access control → §5 only; **no screen**
- FR14 Brand Owner creates users (Superadmin approval for Brand Owner accounts)
- FR15 Self-service password reset
- FR15a Per-user grant/revoke on top of role (timestamp, reason code, optional expiry)
- FR15b Effective permissions view
- FR15c Audit-trail capture + "expiring soon" widget on Brand Owner dashboard

**Parking-lot items this epic owns:** P2B-003 (Permission Override Management UI — `CC-PERMISSION-OVERRIDE-MGMT`).

**Likely screen candidates:**
- `SI-USR-001` — User list & filter
- `SI-USR-002` — User create / edit (role + department mapping)
- `SI-USR-003` — Login screen
- `SI-USR-004` — Self-service password reset
- `SI-USR-005` — User effective permissions view (FR15b — `CC-PERMISSION-OVERRIDE-MGMT`)
- `SI-USR-006` — Permission grant flow (FR15a — modal becomes its own ID per §7 hybrid rule: ≥3 fields, mandatory reason code, optional expiry, audit-tracked workflow)
- `SI-USR-007` — Permission revoke flow (same rationale as 006)
- `SI-USR-008` — "Overrides expiring soon" surface (FR15c — note: this also has a presence as a tile on Brand Owner dashboard `SI-RPT-002`; clarify which is the source-of-truth screen vs the dashboard tile in `Related screens:`)
- `SI-USR-009` — Brand Owner account creation pending Superadmin approval (FR14 — modal becomes its own ID: initiates approval workflow)

**Steps:** follow the per-epic template (1.1–1.7 pattern). Commit message: `Phase 2b Task 2: Epic 2 User Management & Security (USR) — N screens; honours P2B-003 via CC-PERMISSION-OVERRIDE-MGMT`.

---

### Task 3 — Epic 3 Shared Infrastructure (INF)

**Estimated screens:** 8–10

**Reading at start:**
- Plan + shape spec + digest lines 129–141 (Epic 3 FR table); FR113 background from §F (line 572+); brief journey moments referencing approval inbox (Cluster Manager line 27, Brand Owner line 18)

**FRs in scope:**
- FR16 Approval engine routing
- FR17 Unified approval inbox + bulk approve (`CC-APPROVAL-INBOX-CARD`)
- FR18 Notifications (in-app + email + preferences)
- FR19 Notification batching + escalation
- FR20 Audit trail (read-only views) — `CC-AUDIT-LINK` is *applied everywhere*; this epic owns the *viewer*
- FR21 Activity timeline per entity
- FR22 Issue tracker (CRUD + status + priority — `CC-ISSUE-TICKET-LINK`)
- FR23 Broadcast announcements
- FR24 Audit-trail export (CSV/Excel/PDF — `CC-EXPORT-TRIGGER`)
- FR113 forms-prefill framework — `CC-PREFILL` is owned here; specific applications happen in Epics 4–10
- FR117 reverse/cancel rules — owned here; `CC-REVERSE-CANCEL`

**Parking-lot items this epic owns:** none directly, but this epic *defines* the patterns the others reuse.

**Likely screen candidates:**
- `SI-INF-001` — Unified approval inbox (cross-module, scope-filtered)
- `SI-INF-002` — Approval-chain configuration (FR16 — admin surface)
- `SI-INF-003` — Notification preferences (FR18)
- `SI-INF-004` — Notification digest preview (FR19)
- `SI-INF-005` — Audit-trail viewer (FR20, FR24)
- `SI-INF-006` — Activity timeline component reference (FR21 — note in Notes that this is shown embedded in entity-detail screens via `CC-AUDIT-LINK`; this entry is the canonical reference)
- `SI-INF-007` — Issue ticket list (FR22)
- `SI-INF-008` — Issue ticket create / edit (FR22)
- `SI-INF-009` — Broadcast announcement composer (FR23)
- `SI-INF-010` — Reverse / cancel confirmation pattern reference (FR117 — note in Notes this is `CC-REVERSE-CANCEL` and the actual usage lives on the entity screens)

Steps follow the per-epic template. Commit message includes: `defines CC-APPROVAL-INBOX-CARD, CC-PREFILL, CC-REVERSE-CANCEL, CC-AUDIT-LINK, CC-ISSUE-TICKET-LINK usage anchors`.

---

### Task 4 — Epic 4 Inventory Management (INV)

**Estimated screens:** 14–18 — **the heaviest chunk in the plan**

**⚠ Context budget warning:** This task may need to be split across two sessions. After 8 screens are written, run `/context`. If above 40%, end the session and resume the remaining screens in a fresh session, marking the task as `4a complete, 4b in progress` in the commit.

**Reading at start:**
- Plan + shape spec + digest lines 143–161 (Epic 4 FR table); §A journey moments for Store Manager (78), Kitchen Manager (37, partial), POS Staff (87, closing inventory), Cluster Manager (27, expiry-driven cross-cluster), Brand Owner (18, expiry dashboard); §C P2B-001 (295), P2B-002 (305), P2B-004 (332); §F FR112, FR113, FR114, FR115, FR116, FR117 cross-cutting safeguards

**FRs in scope:**
- FR25 Real-time stock view (any item × any location/department)
- FR26 GR with partial receipts + barcode/QR
- FR27 Yield factor at GR (records usable, wastage, adjusted cost)
- FR28 Three-product-type flow rules → §5 only; **no screen**
- FR29 Stock transfers between locations/departments
- FR30 Expiry tracking + countdown dashboards (24/48/72h bands)
- FR31 FEFO in `inventoryService.deductStock()` → §5 only; **no screen** (but `Notes:` on production order screens reference this)
- FR32 Cross-location transfer suggestions (within-cluster vs paired Brand-Store-routed)
- FR33 PAR levels by item × location (with day-of-week adjustments)
- FR34 Below-PAR flagging + reorder suggestions
- FR35 Closing inventory at POS / Dispatch (mandatory reason codes for variance)
- FR36 Locations-not-submitted-by-cutoff alert
- FR37 Inventory adjustments (mandatory reason + approval)
- FR38 Shelf-life acceptance at GR + exception approval
- FR39 File attachments to GR (photos, documents)
- FR47a (cross-listed from Epic 5) — GR rejection at QC; lives on the GR screen as an action; the resulting vendor CN is owned by Epic 5

**Parking-lot items this epic owns:**
- P2B-001 — `CC-DRAFT-PILL` is *applied here* on every data-entry screen; this epic surfaces it most heavily
- P2B-002 — paired Brand-Store-routed transfer initiation (`CC-PAIRED-TRANSFER-BUNDLE`); owned here
- P2B-004 — expiry dashboard split (single-hop within-cluster vs paired Brand-Store cross-cluster); owned here

**Likely screen candidates (estimates; final IDs assigned in-task):**
- `SI-INV-001` — Real-time stock view (FR25; mobile + desktop both, primary mobile-first for kitchen/store, secondary desktop)
- `SI-INV-002` — Department stock view (FR25 sub-view; usually drilled-down from 001)
- `SI-INV-003` — Below-PAR flag list with reorder suggestions (FR34)
- `SI-INV-004` — PAR level configuration (FR33)
- `SI-INV-005` — PAR drift recommendations (FR111 — note FR111 is Epic 12 by primary, but the *recommendation surface* here references it)
- `SI-INV-006` — Stock transfer create (FR29; honours flow validation; `CC-DRAFT-PILL`)
- `SI-INV-007` — Stock transfer detail / status
- `SI-INV-008` — Expiry countdown dashboard (FR30; visible bands; honours P2B-004 with two-suggestion-type display via `CC-PAIRED-TRANSFER-BUNDLE`)
- `SI-INV-009` — Cross-location transfer suggestions (FR32 — surfaced from 008 or as standalone)
- `SI-INV-010` — Single-hop within-cluster transfer initiation (modal becomes its own ID? Apply granularity rule — likely sub-affordance of 006/009; revisit in-task)
- `SI-INV-011` — Paired Brand-Store-routed cross-cluster transfer initiation (modal/workflow becomes its own ID — paired/bundled action per §7)
- `SI-INV-012` — Goods Receipt entry (PO-driven) (FR26, FR27, FR38, FR39, FR47a as action; full digest sample entry already drafted in shape spec §6)
- `SI-INV-013` — Goods Receipt entry (transfer-driven) (sibling of 012)
- `SI-INV-014` — Goods Receipt rejection at QC (modal/workflow becomes its own ID — initiates vendor CN draft per FR47a/b; cross-link to `SI-PUR-*` vendor CN screen)
- `SI-INV-015` — Inventory adjustment (FR37; modal/workflow if ≥3 fields + approval)
- `SI-INV-016` — Closing inventory entry (POS daily) (FR35 — mobile-first; `CC-VOICE-INPUT`, `CC-PREFILL`, `CC-IMPLAUSIBILITY-WARN`)
- `SI-INV-017` — Closing inventory entry (Dispatch daily) (FR77 — sibling)
- `SI-INV-018` — Closing inventory review (cluster oversight) (FR35/FR36 — desktop-primary; example from shape spec §8)
- `SI-INV-019` — Locations-not-submitted-by-cutoff alert (FR36 — sub-affordance of 018? Or standalone alert dashboard? Apply rule)

Steps follow the per-epic template, with the mid-task `/context` checkpoint after step 4.4-half.

Commit message: `Phase 2b Task 4: Epic 4 Inventory (INV) — N screens; honours P2B-001/002/004 via CC-DRAFT-PILL/CC-PAIRED-TRANSFER-BUNDLE`.

---

### Task 5 — Epic 5 Procurement (PUR)

**Estimated screens:** 8–11

**Reading at start:**
- Plan + shape spec + digest lines 163–177 (Epic 5 FR table); Procurement Manager journey (line 67); Store Manager journey portions touching GR (78); §F FR114, FR115; current `_planning/05-screen-inventory.md` (Tasks 1–4 already populated)

**FRs in scope:**
- FR40 PO creation (all-items / category / vendor) with PAR-based suggestions
- FR41 PO approval routing (threshold-based)
- FR42 PO lifecycle (Draft → Approved → Sent → Partially Received → Fully Received → Closed; also "Closed — GR Rejected")
- FR43 Vendor price comparison + history
- FR44 PO PDF distribution
- FR45 Recurring PO templates
- FR46 Vendor price spike alerts (>10% above 30-day avg)
- FR47 Vendor performance + preferred-vendor flag
- FR47a GR rejection at QC (action lives on `SI-INV-014`; this epic owns the resulting "Closed — GR Rejected" PO state)
- FR47b Vendor Credit Note (`VCN-YYYY-LOC-SEQ`) from rejected GR

**Parking-lot items this epic owns:** none directly.

**Likely screen candidates:**
- `SI-PUR-001` — PO create (with PAR suggestions) (FR40)
- `SI-PUR-002` — PO list & filter (FR42 — by status)
- `SI-PUR-003` — PO detail & lifecycle status (FR42; cross-link `SI-INV-012` for GRs against this PO; show "Closed — GR Rejected" state for FR47a)
- `SI-PUR-004` — PO approval (modal/workflow if ≥3 fields or initiates approval — apply rule; likely separate ID per shape §7)
- `SI-PUR-005` — Vendor price comparison view (FR43)
- `SI-PUR-006` — Vendor price spike alerts (FR46 — mini-dashboard)
- `SI-PUR-007` — Recurring PO template create / edit (FR45)
- `SI-PUR-008` — Vendor performance dashboard (FR47)
- `SI-PUR-009` — Preferred vendor management (FR47 — admin surface)
- `SI-PUR-010` — Vendor Credit Note from rejected GR (FR47b — initiates AP reduction; ≥3 fields, fires journal — separate ID per shape §7)

Commit message: `Phase 2b Task 5: Epic 5 Procurement (PUR) — N screens`.

---

### Task 6 — Epic 6 Recipe Management (REC)

**Estimated screens:** 6–8

**Reading at start:**
- Plan + shape spec + digest lines 178–190 (Epic 6 FR table); Kitchen Manager journey (37, parts on production planning that read recipe state); occasional Procurement Manager (67, FCCC visibility on cost cascade)

**FRs in scope:**
- FR48 Recipe CRUD (ingredients, qty, UOM, prep, yield)
- FR49 Multiple versions per recipe; default; comparison
- FR50 Designate version as default (approval workflow)
- FR51 Calculate recipe costs from current ingredient prices + yield factors; auto-recalc
- FR52 Cascade cost changes (raw → semi → final) → §5 only; **no screen** (but display shows cascaded values)
- FR53 Scale recipes to different batch sizes
- FR54 Sub-recipes referenced as ingredients
- FR55 Recipe categorisation / tagging (dietary, allergen, seasonal, complexity)
- FR56 Cost-impact simulation (before-commit)

**Likely screen candidates:**
- `SI-REC-001` — Recipe list & search (with category/tag filters)
- `SI-REC-002` — Recipe detail (current default version) (FR48, FR51)
- `SI-REC-003` — Recipe edit (with sub-recipe references — FR54)
- `SI-REC-004` — Recipe version comparison (FR49)
- `SI-REC-005` — Designate-as-default approval flow (FR50 — separate ID; initiates approval workflow per shape §7)
- `SI-REC-006` — Recipe scaling preview (FR53)
- `SI-REC-007` — Cost-impact simulation (FR56 — read-only what-if)
- `SI-REC-008` — Recipe categories / tags admin (FR55)

Commit message: `Phase 2b Task 6: Epic 6 Recipe (REC) — N screens`.

---

### Task 7 — Epic 7 Production Planning (PRO)

**Estimated screens:** 10–13

**Reading at start:**
- Plan + shape spec + digest lines 192–211 (Epic 7 FR table); Kitchen Manager journey (37); Cluster Manager journey override-visibility moments (27); Brand Owner journey override-frequency review (18); §C P2B-005 (347); decision-log DL-001 (canonical 5-status PO lifecycle); §F FR112, FR114

**FRs in scope (note Tier 1 carve-out for FR64–FR67/FR67a):**
- FR57 Production order create (recipe-driven, batch size, target dept, schedule)
- FR58 Default to current default recipe version + warning if non-default
- FR59 Availability + enablement check at PO creation (warn-and-log)
- FR60 Partial PO when stock insufficient
- FR61 Ingredient substitution (warn-and-log; mandatory reason; enablement check on substitute; surfaces on override-frequency dashboard)
- FR62 Override enablement / stock warnings with reason codes
- FR63 Enablement requests / emergency overrides
- FR64 Pending GR linkage on POs
- FR65 Override unconfirmed GR situations (warn-and-log)
- FR66 LKP × standard yield as provisional costs (visible Provisional flag — `CC-PROVISIONAL-FLAG`)
- FR67 Retrospective cost adjustment when GR confirmed → §5; **no screen** (display shows updated values)
- FR67a GR rejected at QC closure path (lock at provisional, permanent flag, reclassification journal, notification)
- FR68 Stock deduction at In Progress transition → §5; **no screen** (5-status lifecycle DL-001 is shown on PO detail)
- FR69 Production output recording (actual vs expected; mandatory reason for variance)
- FR70 Brand Owner dashboard pieces — override frequency, provisional cost counts, Pending-GR resolution outcomes (these belong to Epic 12 dashboards but this epic *feeds* them; `CC-OVERRIDE-WIDGET` instances live in `SI-RPT-*`)

**Parking-lot items this epic feeds:** P2B-005 (`CC-OVERRIDE-WIDGET`) data; honoured visually in Epic 12 (`SI-RPT-*`).

**Likely screen candidates:**
- `SI-PRO-001` — Production order list & filter (by status, dept, scheduled date)
- `SI-PRO-002` — Production order create (recipe-driven; availability + enablement check) (FR57, FR58, FR59, FR60)
- `SI-PRO-003` — Production order detail (showing 5-status DL-001 lifecycle pill, provisional flag if FR66, current ingredient list)
- `SI-PRO-004` — Ingredient substitution flow (FR61 — separate ID; warn-and-log workflow per §7)
- `SI-PRO-005` — Enablement / stock override flow (FR62 — separate ID; mandatory reason code)
- `SI-PRO-006` — Enablement request (FR63 — initiates approval per FR16; separate ID)
- `SI-PRO-007` — Pending GR linkage interface (FR64 — workflow tied to GR; separate ID; cross-link `SI-INV-012`)
- `SI-PRO-008` — Pending GR override (FR65 — separate ID; warn-and-log; cross-link Store Manager notification)
- `SI-PRO-009` — Pending GR resolution outcomes detail (drill from `SI-RPT-*` `CC-PENDING-GR-DRILL`; shows rejected GR + linked PO + reclassification journal per FR67a; can also be reached from `SI-PRO-003`)
- `SI-PRO-010` — Production output entry (FR69; `CC-VOICE-INPUT`, `CC-IMPLAUSIBILITY-WARN`, mandatory reason for variance)
- `SI-PRO-011` — In Progress transition confirmation (modal — apply rule; deduction fires here per DL-001; likely separate ID because: fires journal entry per FR89, fires inventory deduction)

Commit message: `Phase 2b Task 7: Epic 7 Production Planning (PRO) — N screens; references DL-001; feeds P2B-005`.

---

### Task 8 — Epic 8 Dispatch & Distribution (DSP)

**Estimated screens:** 10–13

**⚠ Context budget warning:** B2B challan workflows are heavy. After 7 screens are written, run `/context`; if above 40%, end and resume in a fresh session.

**Reading at start:**
- Plan + shape spec + digest lines 212–227 (Epic 8 FR table) + lines 392–462 (B2B UI surfaces); **`_planning/04-b2b-challan-spec.md` in full** (only 372 lines — single read); Dispatch Staff journey (58); Finance Manager journey GST workflow moments (47); §F FR115, FR118, FR119

**FRs in scope:**
- FR71 Internal dispatch challans (production → POS)
- FR72 B2B dispatch challans (external customer)
- FR73 B2B customer master CRUD (incl. GST registration type enum)
- FR74 B2B challan lifecycle (Draft → Dispatched → Delivered → Closed-GST-Invoiced or Closed-No-GST-Invoice; also Cancelled, Closed-Returned)
- FR75 TRN generation (DC at Dispatched; CN at creation)
- FR76 Digital delivery confirmation (receiving staff)
- FR77 Daily closing inventory at Dispatch + POS departments (cross-listed with Epic 4 FR35)
- FR78 GST field fill + IRN paste atomic with `gst_invoice_raised = true` (Finance + Brand Owner only)
- FR79 Credit notes against dispatched challans (full/partial; conditional two-stage reversal)
- FR80 Cumulative CN ≤ source value validation → §5; **no screen**
- FR81 File attachments to dispatch challan
- FR82 Challan PDF generation

**Parking-lot items this epic owns:** none directly (P2B-001 `CC-DRAFT-PILL` is applied here heavily).

**Likely screen candidates:**
- `SI-DSP-001` — Internal dispatch challan create (production → POS) (FR71)
- `SI-DSP-002` — Internal dispatch challan list (by status) (FR71)
- `SI-DSP-003` — Dispatch confirm + delivery digital sign-off (mobile-first) (FR76)
- `SI-DSP-004` — B2B customer master list & CRUD (FR73)
- `SI-DSP-005` — B2B challan create (Draft) (FR72)
- `SI-DSP-006` — B2B challan list (lifecycle filter) (FR74)
- `SI-DSP-007` — B2B challan detail (showing full lifecycle; `CC-TRN-DISPLAY`, `CC-DRAFT-PILL`)
- `SI-DSP-008` — B2B dispatch confirmation (modal — fires Stage 1 journal per FR74 + FR89; separate ID per §7: fires journal/TRN)
- `SI-DSP-009` — B2B GST closure & Stage-2 trigger (FR78 — separate ID; ≥3 fields, atomic IRN+flag, fires Stage 2 journal; `CC-GST-FIELD-VALIDATION`, `CC-UNREGISTERED-CUSTOMER-WARN`)
- `SI-DSP-010` — B2B closure without GST invoice (FR74 — apply rule; modal but maybe sub-affordance of 007)
- `SI-DSP-011` — B2B Credit Note creation (full/partial) (FR79 — separate ID; conditional two-stage reversal; ≥3 fields, fires journal/TRN)
- `SI-DSP-012` — Refused-on-arrival flag + dispute workflow (FR74 UC-7 from B2B spec — apply rule; could be sub-affordance of 003)

Commit message: `Phase 2b Task 8: Epic 8 Dispatch (DSP) — N screens; covers B2B lifecycle from 04-b2b-challan-spec.md`.

---

### Task 9 — Epic 9 POS Integration (POS)

**Estimated screens:** 3–5

**Reading at start:**
- Plan + shape spec + digest lines 229–236 (Epic 9 FR table); POS Staff journey (87)

**FRs in scope:**
- FR83 Menu item ↔ recipe mapping
- FR84 Sales import via REST API → §5; **no screen** (operational view of integration health is in Epic 10 FR98)
- FR85 Inventory impact calculation → §5; **no screen**
- FR86 Menu item availability + pricing within ERP

**Likely screen candidates:**
- `SI-POS-001` — Menu item list (with availability + pricing edit) (FR86)
- `SI-POS-002` — Menu item ↔ recipe mapping (FR83)
- `SI-POS-003` — POS sales import status (slim view; main integration dashboard in `SI-ACC-*`) (FR84 surface)

Commit message: `Phase 2b Task 9: Epic 9 POS (POS) — N screens`.

---

### Task 10 — Epic 10 Accounting & Financial (ACC)

**Estimated screens:** 10–13

**Reading at start:**
- Plan + shape spec + digest lines 238–255 (Epic 10 FR table); Finance Manager journey (47); Procurement Manager journey FCCC moment (67); Master Spec §6 (Accounting full spec); §F FR118; current inventory state

**FRs in scope:**
- FR87 TRN generation → §5; **no screen** (display = `CC-TRN-DISPLAY`)
- FR88 Simplified F&B Chart of Accounts
- FR89 Auto-generate journal entries → §5; **no screen** (configuration screen is FR89 admin; display of journal lives on transaction detail screens)
- FR90 Internal ledger → §5; **no screen** (rendered as Trial Balance / P&L / BS / CF)
- FR91 Trial Balance / P&L / BS / Cash Flow (filterable by period, location, cluster)
- FR92 Two-stage B2B journal model → §5; **no screen** (already covered by Epic 8 challan flow)
- FR93 Daily Sales Report capture (with categories, settlement modes, expenses)
- FR94 Budget create / track + variance
- FR95 FCCC — financial framing (`CC-FCCC-DUAL-SURFACE`; pairs with FR108 in Epic 12)
- FR96 Accountant handoff exports (Tally + Zoho Books + Generic CSV simultaneously) (`CC-EXPORT-TRIGGER`)
- FR97 Compliance placeholder fields editor (role-bound)
- FR98 Integration Status Dashboard
- FR99 Manual journal voucher (FR99 — JV-YYYY-LOC-SEQ)

**Parking-lot items this epic owns/feeds:** Implicit FCCC two-surface (`CC-FCCC-DUAL-SURFACE`) — owns the financial framing surface; operational framing in Epic 12.

**Likely screen candidates:**
- `SI-ACC-001` — Chart of Accounts admin (FR88)
- `SI-ACC-002` — Journal entry mapping rules admin (FR89 admin surface)
- `SI-ACC-003` — Trial Balance (FR91; `CC-EXPORT-TRIGGER`)
- `SI-ACC-004` — Profit & Loss statement (FR91)
- `SI-ACC-005` — Balance Sheet (FR91)
- `SI-ACC-006` — Cash Flow statement (FR91)
- `SI-ACC-007` — Daily Sales Report capture & validation (FR93)
- `SI-ACC-008` — Budget create / edit (FR94)
- `SI-ACC-009` — Budget vs Actual variance (FR94)
- `SI-ACC-010` — FCCC — financial framing (FR95 — half of `CC-FCCC-DUAL-SURFACE`)
- `SI-ACC-011` — Accountant handoff exports (FR96 — multi-format selector; export history)
- `SI-ACC-012` — Compliance placeholder fields editor (FR97 — role-bound; modal becomes its own ID? Apply rule; likely lives inline on transaction screens, with this as the canonical reference)
- `SI-ACC-013` — Integration Status Dashboard (FR98)
- `SI-ACC-014` — Manual Journal Voucher (FR99 — separate ID; fires journal/TRN)

Commit message: `Phase 2b Task 10: Epic 10 Accounting (ACC) — N screens; defines CC-FCCC-DUAL-SURFACE financial half`.

---

### Task 11 — Epic 11 HRMS (HRM)

**Estimated screens:** 3–5

**Reading at start:** Plan + shape spec + digest lines 256–263 (Epic 11 FR table); no specific journey moments (no journey explicitly references HRMS — note this in the per-epic recap)

**FRs in scope:**
- FR100 Employee records
- FR101 Basic attendance (time in/out, absences, leave balance)
- FR102 Shift definitions + assignment by role/location
- FR103 Duty rosters / shift schedule view

**Likely screen candidates:**
- `SI-HRM-001` — Employee list & profile
- `SI-HRM-002` — Employee create / edit
- `SI-HRM-003` — Attendance entry / log (mobile-first for staff self-service if applicable; otherwise admin entry)
- `SI-HRM-004` — Shift definition admin (FR102)
- `SI-HRM-005` — Duty roster view (FR103)

Commit message: `Phase 2b Task 11: Epic 11 HRMS (HRM) — N screens`.

---

### Task 12 — Epic 12 Analytics & Reporting (RPT)

**Estimated screens:** 9–12

**⚠ Context budget warning:** Dashboards are dense. After 6 screens are written, run `/context`; split if needed.

**Reading at start:**
- Plan + shape spec + digest lines 265–292 (Epic 12 FR table); Brand Owner journey (18 — dashboard + drill-downs heavy); Cluster Manager dashboard (27); Procurement Manager FCCC moment (67); §C P2B-005 (347), Implicit FCCC (~370), Implicit Pending-GR drill (~382); §F FR116

**FRs in scope:**
- FR104 Personalised morning briefing (per role, role-specific actionable info)
- FR105 Brand Owner cross-location dashboard (food cost %, stock value, daily sales, variance flags, pending approvals, override frequency FR70, provisional cost counts, Pending-GR resolution outcomes, expiring permission overrides FR15c, unresolved data quality alerts FR116, key operational risks; tile drill ≤2 clicks; persisted scope filter)
- FR106 Standard operational reports (Purchase Register, Inventory Movement, Food Cost, Production-vs-Yield Variance, Wastage by Reason/Item, Closing Inventory Variance, Dispatch Volume, B2B Sales Register, POS Sales by Item/Location/Day-Part, Accounting, HR Roster/Attendance) — **bundle into a "reports library" screen + per-report detail screens, or one screen per report?** Apply rule; likely "reports library" + per-report detail with shared filter chrome
- FR107 Export reports (CSV, Excel, PDF) → `CC-EXPORT-TRIGGER` instances on each report screen
- FR108 FCCC — operational analytics framing (menu engineering matrix, cost-per-serving alerts, product mix, time-series trends, actionable suggestions, drill-down) — second half of `CC-FCCC-DUAL-SURFACE`
- FR109 Drill-down from summary dashboards to transaction detail — applied everywhere as `CC-DASHBOARD-TILE`
- FR110 Rule-based unusual activity detection (wastage spikes, vendor price jumps, yield variance, closing-inventory variance patterns, override frequency anomalies, unresolved provisional-cost aging, sales mix shocks, Pending-GR-then-rejected event spikes)
- FR111 PAR drift detection report (cross-link `SI-INV-005` if used there too)

**Parking-lot items this epic owns:** P2B-005 (`CC-OVERRIDE-WIDGET` instance lives on Brand-Owner dashboard); Implicit FCCC two-surface (operational half); Implicit Pending-GR drill (`CC-PENDING-GR-DRILL` originates here, drills into Epic 7 `SI-PRO-009`).

**Likely screen candidates:**
- `SI-RPT-001` — Personalised morning briefing template (FR104) — *meta-screen*; describe role-specific instances in `Notes:`
- `SI-RPT-002` — Brand Owner cross-location dashboard (FR105; `CC-OVERRIDE-WIDGET`, `CC-DASHBOARD-TILE`, includes "expiring permission overrides" tile cross-linked to `SI-USR-008`, "data quality alerts" via `CC-DATA-QUALITY-ALERT` per FR116)
- `SI-RPT-003` — Cluster Manager dashboard (FR104 cluster-scoped instance)
- `SI-RPT-004` — Reports library (FR106 — index of all standard operational reports)
- `SI-RPT-005` — Report detail / runner (parametrised; one entry standing in for the FR106 list, with `Notes:` enumerating each report)
- `SI-RPT-006` — FCCC — operational framing (FR108 — second half of `CC-FCCC-DUAL-SURFACE`; cross-link `SI-ACC-010`)
- `SI-RPT-007` — Menu engineering matrix detail (sub-view of 006? Or standalone? Apply rule)
- `SI-RPT-008` — Unusual activity feed (FR110)
- `SI-RPT-009` — PAR drift recommendations (FR111 — cross-link `SI-INV-005` if same screen; consolidate)

Commit message: `Phase 2b Task 12: Epic 12 Analytics & Reporting (RPT) — N screens; honours P2B-005 + Implicit FCCC operational half + Implicit Pending-GR drill`.

---

## Task 13 — Build appendices A–D

**Files:**
- Modify: `_planning/05-screen-inventory.md` (replace appendix placeholders with populated tables)

**Reading at start:**
- Plan + shape spec + the now-fully-populated `_planning/05-screen-inventory.md` (all 12 epic sections complete)
- Digest §A and §B for cross-checking

- [ ] **13.1** Build Appendix A — Role × Screen matrix
  - Walk every screen entry; for each, read `Roles & scope:` and emit a row in the matrix
  - Columns: 8 role identifiers (Brand Owner / Cluster Manager / Kitchen Manager / Finance Manager / Dispatch Staff / Procurement Manager / Store Manager / POS Staff)
  - Cells: `R` (read), `W` (write/act), `A` (approve); blank = no access
  - Group rows by epic for readability
- [ ] **13.2** Build Appendix B — Journey × Screen traceability
  - Walk every journey moment in digest §A
  - For each moment, list the `SI-*` IDs whose `Source journey(s):` line cites it
  - Format: per-role sub-section with bulleted moments; each bullet ends `→ SI-*, SI-*, …`
  - Flag any moment with zero screens (these are gaps to resolve in Task 14)
- [ ] **13.3** Build Appendix C — FR × Screen traceability
  - Walk FR1 through FR119 + FR15a/b/c + FR47a/b + FR67a (125 entries)
  - For each FR, list the `SI-*` IDs whose `Source FRs:` line cites it
  - For service-only FRs (the 15 in §5), emit `no screen — see §5`
  - Flag any UI-bearing FR with zero screens (gap)
- [ ] **13.4** Build Appendix D — Parking-lot honour
  - 7 rows: P2B-001, P2B-002, P2B-003, P2B-004, P2B-005, Implicit FCCC, Implicit Pending-GR drill
  - Per row: pattern ID(s) used + screen IDs honouring it + brief commentary
  - Include the harness summary block (filled by Task 14) at the top of the appendix
- [ ] **13.5** Commit:

```bash
git add _planning/05-screen-inventory.md
git commit -m "Phase 2b Task 13: Appendices A-D (Role/Journey/FR/Parking-lot)"
```

---

## Task 14 — Run validation harness; resolve gaps

**Files:**
- Modify: `_planning/05-screen-inventory.md` (fill Appendix D harness summary; add screens for any gap; update appendices)

- [ ] **14.1** Use the `superpowers:verification-before-completion` skill mentally — produce evidence before claiming pass
- [ ] **14.2** Journey traversal check
  - Read Appendix B
  - Tally moments per role; assert every moment has ≥1 screen
  - Note any journey moment unmapped → either add screens (loop back to the relevant epic task; commit separately) or raise as Phase-2b ambiguity
- [ ] **14.3** FR traversal check
  - Read Appendix C
  - Tally UI-bearing FRs vs service-only FRs (15 expected)
  - Total = 125 (FR1–FR119 + 6 sub-FRs)
  - Assert every UI-bearing FR has ≥1 screen
  - Note any unmapped → add screens (commit separately) or raise as Phase-2b ambiguity
- [ ] **14.4** Parking-lot honour check
  - Read Appendix D
  - Assert all 7 items honoured (≥1 screen and/or `CC-*` pattern each)
- [ ] **14.5** Cross-cutting completeness check
  - Every screen with `Primary device: mobile-first` → `CC-VOICE-INPUT`, `CC-PREFILL`, `CC-IMPLAUSIBILITY-WARN`, `CC-DRAFT-PILL` considered
  - Every screen displaying TRN → `CC-TRN-DISPLAY` cited
  - Every screen with confirm-before-permanent action → `CC-REVERSE-CANCEL` cited
  - Every screen displaying audit-able state → `CC-AUDIT-LINK` cited
- [ ] **14.6** Token completeness check
  - Spot-check 5 random screen entries — are all `Tokens (DESIGN.md):` values name-tokens from DESIGN.md (no hex, no hard sizes)?
  - Any deferred-token gap captured in screen `Notes:`?
- [ ] **14.7** Fill Appendix D harness summary block with actual numbers (replacing the `N/N` placeholders)
- [ ] **14.8** Commit:

```bash
git add _planning/05-screen-inventory.md
git commit -m "Phase 2b Task 14: validation harness pass — all journey moments + UI FRs + parking-lot items mapped"
```

If gaps found: add screens to the relevant epic via a separate prior commit (`Phase 2b Task 14a-fix: add SI-XXX-### for unmapped <thing>`), then re-run harness, then commit 14 above.

---

## Task 15 — Append Phase-2b close note to prd-review-notes.md

**Files:**
- Modify: `_planning/prd-review-notes.md`

- [ ] **15.1** Read the current `_planning/prd-review-notes.md` end-of-document section to find the conventional place for a phase close note (likely a "Phase close notes" section near the end)
- [ ] **15.2** Append a Phase-2b close note containing:
  - Date (2026-05-04 or current)
  - Total screens by epic
  - Total CC-* patterns (initial 21 + any added during build)
  - Validation harness final tallies (journey moments, UI FRs, parking-lot items)
  - Any Phase-2b ambiguities surfaced (with a separate `Phase-2b ambiguities` sub-section if needed; each as a new F-NNN-style ID like F2B-001)
  - Any deferred-token gaps surfaced (for Phase-2c review)
- [ ] **15.3** Commit:

```bash
git add _planning/prd-review-notes.md
git commit -m "Phase 2b Task 15: append close note to prd-review-notes.md"
```

---

## Task 16 — Open PR (do NOT merge)

**Files:** none (pure git/gh)

- [ ] **16.1** Push branch and check status

```bash
git push -u origin phase-2b/screen-inventory
git status
gh repo view --json name,owner -q '.owner.login + "/" + .name'
```

- [ ] **16.2** Open the PR

```bash
gh pr create --title "Phase 2b — Screen Inventory" --body "$(cat <<'EOF'
## Summary

Phase 2b deliverable: `_planning/05-screen-inventory.md` — full screen inventory for all 12 epics of the F&B ERP.

**Inventory shape** (locked in `docs/superpowers/specs/2026-05-04-screen-inventory-shape-design.md`):
- Organised by epic (12 sections) + role-index appendix
- Screen IDs `SI-{EPIC}-###` with three-letter epic codes (`PUR` for Procurement, `PRO` for Production — avoids the `PRD`/PRD-doc collision)
- Hybrid granularity: route-level by default; modals get IDs when carrying independent state, validation, or workflow weight
- Dedicated `CC-*` cross-cutting pattern catalogue (initial 21 patterns; additive growth allowed)
- `Primary device:` attribute on each screen; genuine operational mobile-vs-desktop splits get separate IDs

**Screen counts per epic** (fill in actual at PR-open time):
- Epic 1 MDM: N
- Epic 2 USR: N
- Epic 3 INF: N
- Epic 4 INV: N
- Epic 5 PUR: N
- Epic 6 REC: N
- Epic 7 PRO: N
- Epic 8 DSP: N
- Epic 9 POS: N
- Epic 10 ACC: N
- Epic 11 HRM: N
- Epic 12 RPT: N
- **Total: N**

**Roles × screens (high level):** see Appendix A in the inventory document.

**Validation harness results** (from Appendix D / Task 14):
- Journey × Screen — 8 / 8 journeys fully mapped (NN total moments → all mapped)
- FR × Screen — 125 / 125 reviewed (NN UI-bearing FRs all mapped; 15 service-only FRs in §5)
- Parking-lot honour — 7 / 7 items honoured (P2B-001 through P2B-005 + 2 implicit Pass-C items)

**Phase-2b close note:** appended to `_planning/prd-review-notes.md`. Includes any Phase-2b ambiguities surfaced (F2B-NNN) and deferred-token gaps for Phase-2c review.

## Test plan
- [ ] Read `_planning/05-screen-inventory.md` end-to-end; sanity-check the per-epic recap paragraphs
- [ ] Walk Appendix B (Journey × Screen) — confirm a sampling of journey moments resolve to plausible screens
- [ ] Walk Appendix C (FR × Screen) — pick 5 random UI-bearing FRs; confirm screen citations
- [ ] Walk Appendix D — confirm each parking-lot item has a clear screen/pattern owner
- [ ] Open `_planning/_internal/phase-2b-digest.md` and `docs/superpowers/specs/2026-05-04-screen-inventory-shape-design.md` to confirm the supporting artefacts are committed
- [ ] **Do not merge** without explicit approval. Phase 2c (visual mockups) begins from this locked inventory.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **16.3** Surface the PR URL to the user. Do not merge.

---

## Self-review (already run inline)

**Spec coverage:** every section of the shape spec is referenced in this plan (§1 preamble & §9 harness in Task 0.2 + Task 14; §2 outline in Task 0.2 + Tasks 13/14; §3 epic key in Task 0.2; §4 CC-* catalogue in Task 0.2 with additive growth in per-epic tasks; §5 service-only FRs in Task 0.2 with re-ref in §C; §6 schema in every per-epic task; §7 granularity rule in every per-epic task notes; §8 mobile/desktop rule in every per-epic task notes; §10 build sequence is the literal task order; §11 pacing in every per-epic context-check step; §13 skill use is implied per task; §14 done-definition mapped to Tasks 13/14/15/16). No spec gap.

**Placeholder scan:** the only `N/N`, `N`, `…` instances are template placeholders for runtime values (counts and screen IDs assigned during the build) explicitly marked illustrative; no TBD/TODO/"figure out later"/"add error handling" patterns. Per-epic candidate screen lists use `~6–8`, `~14–18` as estimate ranges with a clear note that final counts emerge in-task — appropriate for a documentation build plan, not a placeholder.

**Type consistency:** Pattern IDs (`CC-*`), screen IDs (`SI-{EPIC}-###`), epic codes (MDM/USR/INF/INV/PUR/REC/PRO/DSP/POS/ACC/HRM/RPT), parking-lot IDs (P2B-001 … P2B-005 + 2 implicit), digest section anchors (§A/B/C/D/E/F) are used consistently throughout. Master Spec §8 service contracts (`inventoryService.deductStock`, `approvalEngine`, `notificationCenter`, `accountingService`) are referenced by exact name. PRD FR IDs use the project convention (FR15a/b/c, FR47a/b, FR67a sub-IDs). DL-001 reference matches `decision-log.md`.

---

## Execution handoff

The plan is complete and ready to execute. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task; full per-task harness; review between tasks. Best for this build because each per-epic task is independent (only depends on the locked spec + digest + the running inventory file), so subagents can chain cleanly with predictable per-task context budgets.

2. **Inline Execution** — execute tasks in this session using `superpowers:executing-plans`; batch with checkpoints. Risks crossing the 60–70% context limit during Tasks 4 / 8 / 12.

**Recommendation: Subagent-Driven.** Specifically: one subagent per task; main session reviews the diff after each subagent commits, rolls back if a chunk drifts from the shape spec, then dispatches the next.

---

*End of plan — 2026-05-04*

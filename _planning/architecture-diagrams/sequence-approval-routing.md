# Approval Routing — Unified Approval Engine Sequence

**Phase 3a Architecture diagram (Task 28).** Mermaid `sequenceDiagram` covering the canonical routing of any approval-eligible action through the Unified Approval Engine (Master Spec §7.3 / §8.2; `architecture.md` §6.2.2). The worked example is **PO approval (SI-PUR-004 / PUR-004 per `decision-log.md` DL-016 mechanism #3)** because it is the highest-traffic approval flow in the MVP and the canonical motivator for the status-guarded UPDATE pattern. The same control-flow applies, unchanged, to every other approval-eligible action — recipe default-version change (FR50), GR shelf-life exception (FR38), Brand Owner self-creation (FR14), and the Phase 4 epic-scoped flows that simply add `approval_matrix` rows.

## How to read this diagram

This diagram traces an approval request from creation (initiator submits a PO above the value-band threshold), through the data-driven routing read (`approval_matrix` lookup), the Realtime push to the approver's inbox (DL-010 channel #1), the approve action (status-guarded UPDATE per DL-016 mechanism #3), the post-COMMIT async fan-out (audit log + notification back to the initiator + downstream-watcher fan-out per DL-011), and finally the timeout / escalation branch (the pg-boss `approval_escalate` job from `architecture.md` §9 catalogue).

Two cross-cutting orthogonal concerns are layered onto the main flow:

1. **Idempotency on retry / double-click** — DL-016 mechanism #3 (status-guarded UPDATE). The second click sees zero rows affected and the service returns the current state as a no-op; the UI surfaces "Already approved by X at HH:MM" instead of an error.
2. **Escalation timer** — On `createApprovalRequest`, the engine schedules a pg-boss `approval_escalate` job with the matrix-configured timeout. If the request is still `pending` at the timeout, the worker re-runs the routing read, advances to the next approver per the matrix, and fires an `approval_escalated` notification to both the original approver and the escalation target (per `architecture.md` §11.4 catalogue, FR16 + FR19).

**Cross-flow interactions worth flagging up front:**

- The B2B dispatch flow (`sequence-b2b-challan.md`) does not currently route any state transition through the approval engine — its `Dispatched → Delivered` and `Delivered → Closed — GST Invoiced` transitions are operational/finance acts using DL-016 mechanism #3 directly. If a future Phase 4 configuration adds an approval gate (e.g., dispatch above a value band), the routing inserts cleanly between this diagram's "approval decided" step and the b2b-challan diagram's status transition. The integration point is the `approval_matrix.entity_type = 'b2b_challan'` row.
- The Production Order lifecycle (`sequence-production-order-lifecycle.md`) similarly does not gate `Confirmed → In Progress` through approvals in the MVP baseline. Recipe default-version changes (FR50) and high-value purchase orders that *generate* the production demand are gated upstream and so already flow through this diagram before the production order is ever created. The build plan calls out that Phase 4 epics MAY add per-recipe or per-PO approval gates as `approval_matrix` configuration without any code change to either lifecycle.

**Actor-collapse note.** The single `Approver` actor below represents both the Realtime push moment (Step B, the inbox-receives-row UI surface) and the action-endpoint moment (Step C, the approve/reject UI surface). Master Spec §8.2 treats these as two distinct UI surfaces (the inbox and the action endpoint); this diagram collapses them because they describe the same human at two moments in time, and the sequence-diagram lane reads more cleanly as one actor. Treat the single lane as "the human approver across both UI surfaces," not as a claim that the two surfaces are one component.

**Conventions used below:**

- Solid arrows (`->>`) are synchronous in-process calls inside the Express request lifecycle.
- Dashed arrows (`-->>`) are responses or asynchronous fan-outs.
- `Note over A,B` annotates cross-cutting context (transactional boundaries, brand scoping, decision-log references).
- `rect rgb(...)` blocks group steps that share a single Postgres transaction (atomicity boundary).
- `par` blocks denote async fan-outs scheduled inside the transaction (DL-009 transactional pg-boss enqueue) but *executing* after COMMIT.
- `alt` / `else` / `end` blocks branch on idempotency (double-click) and timeout / escalation paths.

`brand_id` discipline is implicit on every DB call: every API entry point passes through the Express auth + `brandedDb` middleware (DL-012); every query `approvalEngine` issues against `approval_matrix`, `approval_requests`, and `approval_actions` is automatically AND-scoped to the request's `brand_id`. The Approval Engine has no escape hatch for cross-brand routing — by design.

---

## The sequence

```mermaid
sequenceDiagram
    autonumber
    actor Initiator as Initiator (UI)<br/>e.g. PO creator
    actor Approver as Approver (UI)<br/>e.g. Brand Owner
    participant API as Express API<br/>(auth + brandedDb)
    participant Engine as approvalEngine
    participant Matrix as approval_matrix<br/>(DB table)
    participant DB as Postgres<br/>(branded scope)
    participant Audit as auditLog
    participant Notif as notificationCenter
    participant Realtime as Supabase Realtime<br/>(channel #1, DL-010)
    participant Boss as pg-boss<br/>(approval_escalate job)

    Note over API,DB: Every DB call below is brand-scoped via brandedDb (DL-012).<br/>Every approval_matrix / approval_requests / approval_actions row<br/>carries brand_id; cross-brand routing is physically impossible.

    %% =====================================================
    %% Step A — Approval request creation
    %% =====================================================
    Initiator->>API: POST /purchase-orders/:id/submit<br/>(or any approval-eligible action)
    API->>Engine: createApprovalRequest({entity_type:'purchase_order', entity_id, value, ...})

    rect rgb(230, 245, 230)
        Note over Engine,DB: ── Request-creation transaction (atomic) ──<br/>Routing read + INSERT + escalation enqueue + notification enqueue<br/>all share ONE Postgres BEGIN/COMMIT.

        Engine->>Matrix: SELECT * FROM approval_matrix<br/>WHERE entity_type='purchase_order'<br/>AND brand_id=$brand<br/>ORDER BY sort_order
        Matrix-->>Engine: matching rule rows<br/>(conditions + required_roles + escalation_timeout)
        Note right of Engine: Engine evaluates conditions (jsonb)<br/>against entity payload to pick<br/>the first matching rule and resolve<br/>required approver(s) per required_roles.

        Engine->>DB: INSERT approval_requests<br/>(entity_type, entity_id, state='pending',<br/>initiated_by_user_id, brand_id, ...)<br/>RETURNING id
        DB-->>Engine: approval_request_id

        Engine->>Boss: enqueue approval_escalate<br/>(approval_request_id, fire_at = now() + matrix.timeout)<br/>(DL-009 transactional enqueue)
        Boss-->>Engine: job_id

        Engine->>Notif: send({type:'approval_pending',<br/>user_id=approver_id, ref=approval_request_id, ...})<br/>(DL-011 — in-app via Realtime + email per type config)
        Note right of Notif: Same transaction as the INSERT —<br/>notifications row write + pg-boss<br/>email enqueue happen here, not<br/>after COMMIT (DL-009).
    end

    Engine-->>API: {approval_request_id, state:'pending', approver_id}
    API-->>Initiator: 202 Accepted (awaiting approval)

    %% =====================================================
    %% Step B — Realtime push to approver's UI
    %% =====================================================
    Note over DB,Realtime: Postgres logical-replication wire feeds Supabase Realtime;<br/>channel #1 is filtered to approver_id = me (DL-010 channel #1).
    DB-->>Realtime: row event: approval_requests INSERT
    Realtime-->>Approver: push: new approval in inbox<br/>(filter: approver_id=eq.me)

    Note over Approver: Approver's inbox (FR17 unified inbox /<br/>SI-PUR-004 for PO context) updates<br/>without a manual refresh.

    %% =====================================================
    %% Step C — Approver decides → status-guarded UPDATE
    %% =====================================================
    Approver->>API: POST /approvals/:request_id/approve<br/>(or /reject; same shape)
    API->>Engine: decide(request_id, action='approve', actor_user_id, comment?)

    rect rgb(230, 245, 230)
        Note over Engine,DB: ── Decision transaction (atomic) ──<br/>Status-guarded UPDATE + action log insert + downstream notify<br/>all share ONE Postgres BEGIN/COMMIT.

        Engine->>DB: UPDATE approval_requests<br/>SET state='approved',<br/>    decided_at=now(), decided_by=$actor<br/>WHERE id=$req<br/>  AND state='pending'<br/>  AND brand_id=$brand<br/>RETURNING id<br/>(DL-016 mechanism #3 — status-guarded)
        DB-->>Engine: 1 row updated  (or 0 → see alt branch below)

        alt 1 row affected (first decisive click)
            Engine->>DB: INSERT approval_actions<br/>(approval_request_id, actor_user_id,<br/> action='approve', comment, acted_at, brand_id)
            DB-->>Engine: action_id

            Engine->>Audit: record('approval.approved',<br/>{request_id, entity_type, entity_id, actor})<br/>(DL-013 audit trail)
            Audit->>DB: INSERT audit_log
            DB-->>Audit: ok

            Engine->>Notif: send({type:'approval_decided',<br/>user_id=initiator, ref=request_id, decision:'approved'})<br/>+ sendBulk to downstream watchers per matrix
            Note right of Notif: Both notifications enqueued in the<br/>same transaction (DL-009 / DL-011);<br/>email worker runs after COMMIT.

            Engine->>Boss: cancel approval_escalate<br/>(request_id) — request no longer pending
            Boss-->>Engine: ok
        else 0 rows affected (double-click / replay)
            Note over Engine,DB: Status was already 'approved' (or 'rejected') —<br/>guard rejected the UPDATE. No action log,<br/>no audit, no notification. Idempotent no-op.
            Engine->>DB: SELECT current state FROM approval_requests<br/>WHERE id=$req
            DB-->>Engine: {state:'approved', decided_by, decided_at}
        end
    end

    alt first decisive click (1 row updated above)
        Engine-->>API: {state:'approved', decided_at, decided_by}
        API-->>Approver: 200 OK
    else idempotent replay (0 rows updated above)
        Engine-->>API: {state:'approved', decided_at, decided_by,<br/>idempotent:true}
        API-->>Approver: 200 OK<br/>UI: "Already approved by X at HH:MM"
    end

    par Async fan-out (post-COMMIT)
        Notif-)Initiator: in-app push (Realtime channel #2) + email per type config
        Notif-)Approver: confirmation toast (Realtime channel #2)
        Note over Notif: Downstream consumers (e.g., GR can now<br/>be raised, dispatch can now be planned)<br/>react via their own Realtime subscriptions<br/>or polling — not through approvalEngine.
    end

    %% =====================================================
    %% Step D — Timeout / escalation branch (worker-driven)
    %% =====================================================
    Note over Boss,Engine: Parallel timeline: if no decision by fire_at,<br/>pg-boss fires the approval_escalate job<br/>(architecture.md §9 catalogue, FR16 + FR19).

    alt no decision by timeout
        Boss-)Engine: handle approval_escalate(request_id)
        Engine->>DB: SELECT state FROM approval_requests WHERE id=$req
        DB-->>Engine: {state:'pending'}  (still pending → escalate)

        Engine->>Matrix: re-read approval_matrix<br/>(escalation_chain rule for entity_type)
        Matrix-->>Engine: next approver role(s)

        rect rgb(255, 240, 220)
            Note over Engine,DB: ── Escalation transaction (atomic) ──

            Engine->>DB: UPDATE approval_requests<br/>SET approver_id=$next_approver,<br/>    escalated_at=now(), escalation_level=level+1<br/>WHERE id=$req AND state='pending' AND brand_id=$brand<br/>(DL-016 mechanism #3 — guarded on still-pending)
            DB-->>Engine: 1 row updated  (or 0 → already decided, no-op)

            Engine->>Boss: enqueue next approval_escalate<br/>(request_id, fire_at = now() + matrix.timeout)
            Boss-->>Engine: job_id

            Engine->>Notif: sendBulk([<br/>  {type:'approval_escalated', user_id=original_approver},<br/>  {type:'approval_escalated', user_id=escalation_target}])<br/>(architecture.md §11.4 catalogue)
        end

        Note over DB,Realtime: Realtime channel #1 fires for the<br/>new approver_id; the row appears<br/>in the escalation target's inbox.
        DB-->>Realtime: row event: approval_requests UPDATE
        Realtime-->>Approver: push: escalated request<br/>(now visible to escalation target)
    else decision arrived before timeout
        Note over Boss: approval_escalate job was cancelled<br/>at decision time (Step C). Worker<br/>fires no-op even if cancellation lost<br/>the race — guarded UPDATE re-checks<br/>state='pending' and rejects.
    end

    %% =====================================================
    %% Step E — Forward references (out of scope here)
    %% =====================================================
    Note over Engine,Notif: Out of scope here:<br/>• Bulk approval (FR17 unified inbox) — N parallel decide() calls,<br/>  same shape, each row independently guarded.<br/>• Send-back / request-changes path — additional state in approval_requests;<br/>  same DL-016 #3 guard pattern with state='changes_requested'.<br/>• Approval delegation (FR16 "delegation rules for unavailable approvers")<br/>  — resolved during the approval_matrix read; transparent to this flow.
```

---

## Cross-references

**Master Spec:**
- §7.3 — Architectural rules: "always route through the Unified Approval Engine (Epic 3); never per-module."
- §8.2 — `approvalEngine` contracts: `createApprovalRequest`, `getApprovalStatus`, `getPendingApprovals`. The diagram exercises **`createApprovalRequest`** (Step A) from this set; the read-side methods (`getApprovalStatus`, `getPendingApprovals`) are not part of this flow (they back the inbox and status-query screens, not the create-or-decide path traced here). The decision call shown as `decide(request_id, action, actor_user_id, comment?)` in Step C is **not** declared in Master Spec §8.2 and is **not** a TypeScript-level method signature in `architecture.md` §6.2.2 either — §6.2.2's Refinement bullets describe the approve/reject behaviour (status-guarded UPDATE per DL-016 mechanism #3, transactional notification enqueue) without naming the entry point, and §8.1 line 1208 references it informally as `approvalEngine.requestApproval / decide`. The diagram surfaces `decide(...)` as the **action-endpoint contract `approvalEngine` will expose in Phase 4 Epic 3 implementation** — the concrete name and signature are pinned here so this diagram and any future implementation reference the same shape; if Phase 4 Epic 3 picks a different concrete name, this diagram and the §6.2.2 Refinement bullets update together.
- §8.3 — `notificationCenter.send` / `sendBulk` contracts (DL-011 implementation).

**Architecture spec:**
- `_planning/architecture.md` §6.2.2 — `approvalEngine` refinement: data-driven routing matrix, status-guarded UPDATE, transactional notification enqueue.
- `_planning/architecture.md` §8 — concurrency / idempotency patterns (DL-016 mechanisms; this diagram exercises mechanism #3 throughout).
- `_planning/architecture.md` §9 — pg-boss + pg_cron job catalogue; specifically the `approval_escalate` job entry.
- `_planning/architecture.md` §11.4 — Notification Center send pipeline + catalogue (`approval_pending`, `approval_pending_high_priority`, `approval_escalated`, `approval_decided` types).
- `_planning/architecture.md` §17.11 — Express middleware stack: auth + `brandedDb` context attached to every API node above (DL-012).

**Decision log:**
- DL-010 — Realtime channel #1 (`approval_requests` filtered to `approver_id = me`); the push leg of Step B and the escalation visibility leg of Step D.
- DL-011 — Notification Center transport + dispatch model; the `Notif-)` arrows above.
- DL-016 — concurrency / idempotency mechanisms; mechanism #3 (status-guarded UPDATE) is the spine of Steps C and D.
- DL-009 — pg-boss as the application-level job engine; the `approval_escalate` enqueue and worker-driven escalation fire through it.
- DL-012 — `brandedDb` factory; the implicit `brand_id` scoping on every DB call shown.
- DL-013 — `auditLog.record` (Step C "first decisive click" branch).

**PRD:**
- FR16 — Configurable approval chains, threshold-based routing, delegation rules. The `approval_matrix` read in Step A is the implementation surface.
- FR17 — Unified approval inbox + bulk approvals (the inbox surfaced to the approver in Step B; bulk = N parallel decide() calls, noted in the forward-references block).
- FR19 — Notification & Alert Center; specifically the `approval_pending` and `approval_escalated` notification types fired in Steps A and D.
- FR14 — Brand Owner self-creation with Superadmin approval (one of the entity types routed through this flow).
- FR38 — GR shelf-life exception approvals (another entity type; same flow).
- FR50 — Recipe default-version change approvals (another entity type; same flow).

**Sibling diagrams:**
- `_planning/architecture-diagrams/data-model-erd.md` §12 — entity relationships behind `approval_matrix`, `approval_requests`, `approval_actions`. Read this for the table shapes referenced in the steps above.
- `_planning/architecture-diagrams/service-graph.md` — in-process service call graph; `approvalEngine`, `notificationCenter`, `auditLog` edges shown here are explicit nodes there.
- `_planning/architecture-diagrams/sequence-b2b-challan.md` — parallel two-stage journal flow for B2B dispatch challans (uses DL-016 mechanisms #1 + #2 + #3; *currently no approval gate*, but the integration point is the `approval_matrix.entity_type = 'b2b_challan'` row should one be added in Phase 4 configuration).
- `_planning/architecture-diagrams/sequence-production-order-lifecycle.md` — Production Order 5-status state machine (DL-001) with `deductStock` row-lock (DL-016 mechanism #1); shares DL-016 mechanism #3 with this diagram for its non-In-Progress transitions.

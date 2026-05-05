# B2B Challan — Two-Stage Journal Flow

**Phase 3a Architecture diagram (Task 26).** Mermaid `sequenceDiagram` covering the canonical B2B challan two-stage journal flow per `_planning/04-b2b-challan-spec.md`.

## How to read this diagram

This sequence diagram traces a single B2B Delivery Challan from creation in `Draft` through dispatch (Stage 1 journal), customer acknowledgement (status transition), GST invoice confirmation (Stage 2 journal — conditional), and final close. The canonical flow lives in `_planning/04-b2b-challan-spec.md` §3 (lifecycle), §4 (inventory impact), §5 (TRN), and §6 (two-stage accounting model). Where the Phase 3a build-plan outline disagrees with the spec, the spec wins — the most material divergence is captured below.

**Divergence from the plan outline (recorded for auditability):**

The Phase 3a Task-26 outline described Stage 1 as "AR-customer DR, inventory CR" implying inventory is the credit-side of the Stage 1 journal. The canonical spec (`04-b2b-challan-spec.md` §6, Stage 1) is explicit:

> ```
> Debit:  Accounts Receivable     [base value, tax excluded]
> Credit: Revenue — B2B Sales     [base value, tax excluded]
> ```

Inventory movement at Dispatch is a separate concern handled by `inventoryService.deductStock` (spec §4) — it is **not** the Stage 1 journal credit-side. The diagram below follows the spec: Stage 1 journal is `AR DR / Revenue — B2B Sales CR`, and inventory decrement is shown as a separate `inventoryService.deductStock(...)` call inside the same Dispatch transaction.

The plan-outline phrase "customer acknowledges" maps to the spec's `Dispatched → Delivered` status transition (spec §3). It does **not** trigger Stage 2. Stage 2 fires only when Finance sets `gst_invoice_raised = true` and pastes an IRN, transitioning to `Closed — GST Invoiced` (spec §6 Stage 2; spec §3 lifecycle). The diagram makes both transitions distinct and labels which actor drives each.

**Conventions used below:**

- Solid arrows (`->>`) are synchronous in-process calls inside Express request lifecycle.
- Dashed arrows (`-->>`) are responses or asynchronous fan-outs.
- `Note over A,B` annotates cross-cutting context (TRN reference, transaction boundaries, brand-scoping).
- `rect rgb(...)` blocks group steps that share a single Postgres transaction (atomicity boundary).
- `alt` blocks branch on the optional Stage 2 path (`gst_invoice_raised = true` vs `false`).

The TRN (`DC-{YYYY}-{LOC}-{SEQ}`, spec §5) is allocated at the moment of `Draft → Dispatched` and is reused as the Stage 2 journal `trnReference`. Both stages share the same DC TRN so the AR balance per DC is a clean sum (spec §6 "combined AR balance").

Concurrency annotations follow `decision-log.md` DL-016:

- **Stage 1 transaction**: `inventoryService.deductStock` uses Postgres `SELECT ... FOR UPDATE` row locks on stock-batch rows (DL-016 mechanism #1). The TRN allocation, status update, journal entry, and stock deduction all share one transaction — atomic per `_planning/architecture.md` §6.2.4.
- **Status transition `Dispatched → Delivered`** uses status-guarded UPDATE (DL-016 mechanism #3): `UPDATE ... WHERE status = 'dispatched'`. Double-marking by two acknowledgers → second UPDATE affects 0 rows → idempotent no-op.
- **IRN paste / `gst_invoice_raised = true`** uses both DL-016 mechanism #2 (unique constraint on `(brand_id, irn)` — re-paste of same IRN is a no-op) and mechanism #3 (status-guarded UPDATE from `Delivered` to `Closed — GST Invoiced`). The Stage 2 journal write shares this transaction.

---

## The sequence

```mermaid
sequenceDiagram
    autonumber
    actor Dispatch as Dispatch Staff (UI)
    actor Finance as Finance / Brand Owner (UI)
    participant API as Express API<br/>(auth + brandedDb)
    participant Dispatch_Svc as dispatchService
    participant Inventory_Svc as inventoryService
    participant Accounting as accountingService
    participant DB as Postgres<br/>(branded scope)
    participant Notif as notificationCenter
    actor Customer as B2B Customer

    Note over API,DB: brand_id is bound by brandedDb middleware (DL-012);<br/>every query in this diagram is brand-scoped automatically.

    %% =====================================================
    %% Step A — Challan creation (Draft)
    %% =====================================================
    Dispatch->>API: POST /b2b-challans (Draft)
    API->>Dispatch_Svc: createDraft(payload)
    Dispatch_Svc->>DB: INSERT b2b_challans (status='draft')
    DB-->>Dispatch_Svc: challan_id
    Dispatch_Svc-->>API: {challan_id, status:'draft'}
    API-->>Dispatch: 201 Created

    Note over Dispatch_Svc,DB: No TRN yet, no inventory move,<br/>no journal entry (spec §3, §4, §6).

    %% =====================================================
    %% Step B — Dispatch (Stage 1 journal fires)
    %% =====================================================
    Dispatch->>API: POST /b2b-challans/:id/dispatch
    API->>Dispatch_Svc: markDispatched(challanId)

    rect rgb(230, 245, 230)
        Note over Dispatch_Svc,DB: ── Stage 1 transaction (atomic) ──<br/>All steps below share ONE Postgres BEGIN/COMMIT.

        Dispatch_Svc->>Accounting: getTRN('DC', locationCode)
        Accounting->>DB: UPDATE trn_sequence ... RETURNING next_value<br/>(architecture.md §6.2.4)
        DB-->>Accounting: 'DC-2026-BRD-000001'
        Accounting-->>Dispatch_Svc: trn

        Dispatch_Svc->>Inventory_Svc: deductStock(items, trnReference=trn)
        Note over Inventory_Svc,DB: SELECT ... FOR UPDATE on stock_batches<br/>(FEFO order, DL-016 mechanism #1).
        Inventory_Svc->>DB: SELECT FOR UPDATE → UPDATE stock_batches
        DB-->>Inventory_Svc: ok
        Inventory_Svc-->>Dispatch_Svc: deduction recorded

        Dispatch_Svc->>Accounting: createJournalEntry(stage 1)
        Note right of Accounting: Stage 1 (spec §6):<br/>DR Accounts Receivable [base]<br/>CR Revenue — B2B Sales [base]<br/>trnReference = DC-2026-BRD-000001
        Accounting->>DB: validate balanced; INSERT journal_entries
        DB-->>Accounting: journal_id

        Dispatch_Svc->>DB: UPDATE b2b_challans SET status='dispatched',<br/>trn=$trn WHERE id=$id AND status='draft'<br/>(DL-016 mechanism #3)
        DB-->>Dispatch_Svc: 1 row updated
    end

    Dispatch_Svc-->>API: {status:'dispatched', trn}
    API-->>Dispatch: 200 OK + trn

    par Async fan-out
        Dispatch_Svc-)Notif: dispatch.completed (challanId, trn)
        Notif-)Finance: in-app + email (per §11.4)
        Notif-)Customer: optional handoff notice
    end

    Note over Dispatch_Svc,DB: From here on the DC TRN is immutable<br/>(spec §5, Master Spec §7.6) and is the<br/>linkage key for Stage 2 + Credit Notes.

    %% =====================================================
    %% Step C — Customer acknowledges (Dispatched → Delivered)
    %% =====================================================
    Customer-->>Dispatch: physical receipt confirmation
    Dispatch->>API: POST /b2b-challans/:id/deliver
    API->>Dispatch_Svc: markDelivered(challanId)

    Dispatch_Svc->>DB: UPDATE b2b_challans SET status='delivered'<br/>WHERE id=$id AND status='dispatched'<br/>(DL-016 mechanism #3 — status-guarded)
    DB-->>Dispatch_Svc: 1 row updated (or 0 → idempotent no-op)

    Dispatch_Svc-->>API: {status:'delivered'}
    API-->>Dispatch: 200 OK

    Dispatch_Svc-)Notif: delivery.confirmed (challanId, trn)
    Notif-)Finance: in-app

    Note over Dispatch_Svc,DB: NO journal entry on Delivered.<br/>Acknowledgement is operational only<br/>(spec §3 lifecycle).

    %% =====================================================
    %% Step D — Close path (branch on GST invoice)
    %% =====================================================
    alt Closed — GST Invoiced (Stage 2 journal fires)
        Note over Finance,Accounting: Spec §6 Stage 2 + spec UC-2.<br/>Finance has raised the GST invoice<br/>in external software (Tally/Zoho) and pastes the IRN.

        Finance->>API: PATCH /b2b-challans/:id<br/>{gst_invoice_raised:true, irn}
        API->>Dispatch_Svc: confirmGstInvoice(challanId, irn)

        rect rgb(230, 245, 230)
            Note over Dispatch_Svc,DB: ── Stage 2 transaction (atomic) ──

            Dispatch_Svc->>DB: INSERT ... ON CONFLICT (brand_id, irn) DO NOTHING<br/>(DL-016 mechanism #2 — IRN unique constraint)
            DB-->>Dispatch_Svc: ok / already-attached

            Dispatch_Svc->>Accounting: createJournalEntry(stage 2)
            Note right of Accounting: Stage 2 (spec §6):<br/>DR Accounts Receivable [tax only]<br/>CR GST Liability [tax]<br/>trnReference = same DC TRN as Stage 1
            Accounting->>DB: validate balanced; INSERT journal_entries
            DB-->>Accounting: journal_id

            Dispatch_Svc->>DB: UPDATE b2b_challans SET status='closed_gst_invoiced',<br/>gst_invoice_raised=true, irn=$irn, gst_invoice_raised_at=now()<br/>WHERE id=$id AND status='delivered'<br/>(DL-016 mechanism #3)
            DB-->>Dispatch_Svc: 1 row updated
        end

        Dispatch_Svc-->>API: {status:'closed_gst_invoiced'}
        API-->>Finance: 200 OK

        Dispatch_Svc-)Notif: challan.closed.gst_invoiced (challanId, trn, irn)
        Notif-)Finance: in-app + email
    else Closed — No GST Invoice (Stage 1 only)
        Note over Finance,Accounting: Spec §6 "Stage 1 Only" + spec UC-1.<br/>No Stage 2 journal — challan closes with the Stage 1 entry alone.

        Finance->>API: POST /b2b-challans/:id/close-without-gst
        API->>Dispatch_Svc: closeWithoutGst(challanId)

        Dispatch_Svc->>DB: UPDATE b2b_challans SET status='closed_no_gst',<br/>gst_invoice_raised=false WHERE id=$id AND status='delivered'<br/>(DL-016 mechanism #3)
        DB-->>Dispatch_Svc: 1 row updated

        Dispatch_Svc-->>API: {status:'closed_no_gst'}
        API-->>Finance: 200 OK

        Dispatch_Svc-)Notif: challan.closed.no_gst (challanId, trn)
        Notif-)Finance: in-app
    end

    Note over DB,Accounting: Final AR balance per DC TRN (spec §6):<br/>• Closed — GST Invoiced: base + tax<br/>• Closed — No GST Invoice: base only

    %% =====================================================
    %% Step E — Forward references (not in this diagram)
    %% =====================================================
    Note over Dispatch_Svc,Accounting: Out of scope here:<br/>• Credit Note flow (spec §6 reversal entries, UC-3 / UC-4 / UC-7) — separate sequence.<br/>• Cancellation from Draft (spec UC-6) — clean no-op, no entries.<br/>• Refused-delivery dispute path (spec UC-7) — Credit Note territory.
```

---

## Cross-references

**Canonical source (this diagram tracks against):**
- `_planning/04-b2b-challan-spec.md` — entire document; specifically §3 (lifecycle), §4 (inventory impact), §5 (TRN format), §6 (two-stage journal model with worked examples), §8 (use cases).

**Architecture spec:**
- `_planning/architecture.md` §6.2.4 (`accountingService.createJournalEntry` and `getTRN` refinement — atomicity, balance validation, atomic increment).
- `_planning/architecture.md` §8 (concurrency patterns — the three DL-016 mechanisms applied above).
- `_planning/architecture.md` §11.4 (Notification Center send pipeline used by the async fan-outs).
- `_planning/architecture.md` §17.11 (Express middleware stack — auth + brandedDb context for every API node above).

**Decision log:**
- DL-016 — concurrency / idempotency mechanisms (row lock for stock; unique constraint for IRN; status-guarded UPDATE for state transitions). All three are exercised in this flow.
- DL-012 — `brandedDb` factory; the `brand_id` scoping is implicit in every DB call shown.
- DL-011 — Notification Center pipeline (the `Notif-)` arrows above).

**Sibling diagrams:**
- `_planning/architecture-diagrams/data-model-erd.md` — the entity relationships behind `b2b_challans`, `journal_entries`, `stock_batches`, `trn_sequence`.
- `_planning/architecture-diagrams/service-graph.md` — the in-process service call graph (Dispatch / Inventory / Accounting / Notification edges shown here are explicit nodes there).
- `_planning/architecture-diagrams/production-order-lifecycle.md` — *forthcoming*; will cover the parallel state-machine and journal flow for production orders (DL-001 5-status model).
- `_planning/architecture-diagrams/approval-routing.md` — *forthcoming*; will cover the Unified Approval Engine state transitions referenced by Master Spec §8.2.

# Data Model ERD — F&B ERP

**Phase 3a Architecture diagram (Task 24).** Domain-grouped Mermaid `erDiagram` blocks covering every table named in `architecture.md` §5.1 (Schema file organization).

## How to read this diagram

This ERD is the **forward-looking shape** of the persistent layer that Phase 4 epics will author table-by-table. It captures, per domain:

- **Tables** (one Mermaid `erDiagram` block per epic-aligned schema file from `architecture.md` §5.1).
- **Key columns only** — primary key, foreign keys, the canonical `brand_id` scoping column, status / state fields, and a small handful of domain-defining attributes (e.g., `trn`, `irn`, `expiry_date`). It does **not** show every column. Standard columns (`created_at`, `updated_at`, `created_by`, `updated_by` per `architecture.md` §5.3) are omitted from each table to keep diagrams readable.
- **Cardinality** — derived from Master Spec §2 (Domain Model) and the Master Spec §8 Module Interface Contracts. Cardinality glyphs follow Mermaid ER conventions: `||--o{` = one-to-many, `}o--o{` = many-to-many (typically materialized via a junction table that is itself diagrammed), `||--||` = one-to-one.
- **DL-015 invariant** — every brand-scoped table carries `brand_id` as a FK to `brands.id` and shows the relationship explicitly. Tables that are NOT brand-scoped (system tables: `migrations`, `pgboss.*`, `brands` itself) carry no `brand_id` line.

What this diagram does **not** show:

- RLS policies (see `architecture.md` §4 + DL-014).
- Audit-trigger wiring (see `architecture.md` §7 + DL-013).
- Index strategy (see `architecture.md` §5.2 / §5.6 + DL-015).
- TRN sequence tables (see `architecture.md` §5.5).
- Compliance placeholder columns (see `architecture.md` §5.4 + Master Spec §6.5) — these are nullable strings/numerics on transactional tables; their presence is a schema invariant, not a relationship-graph concern.

Cross-references: `architecture.md` §5 (schema file organization, the canonical table list this diagram tracks against), Master Spec §2 (domain model), Master Spec §8 (module interface contracts), `decision-log.md` DL-015 (`brandScopedTable` helper — every brand-scoped table FK to `brands`), DL-012 (`brandedDb` query wrapper — consumer of the brand-scoped marker), DL-014 (RLS template — defence-in-depth pair), DL-013 (audit-trigger opt-in for the four critical tables).

---

## 1. Org core (`org.ts`)

Brand → Cluster → Location → Department is the canonical hierarchy from Master Spec §2.1. `brands` is itself **NOT** brand-scoped — it is the tenant root. Every other org-core table IS brand-scoped (DL-015).

```mermaid
erDiagram
    brands {
        uuid id PK
        text name
        text slug
        text status
    }
    clusters {
        uuid id PK
        uuid brand_id FK
        text name
        text code
        text status
    }
    locations {
        uuid id PK
        uuid brand_id FK
        uuid cluster_id FK
        text name
        text code
        text type
        text status
    }
    departments {
        uuid id PK
        uuid brand_id FK
        uuid location_id FK
        text name
        text type
        text status
    }

    brands ||--o{ clusters : "scopes"
    brands ||--o{ locations : "scopes"
    brands ||--o{ departments : "scopes"
    clusters ||--o{ locations : "contains"
    locations ||--o{ departments : "contains"
```

---

## 2. Auth (`auth.ts`)

Users, roles, role assignments, sessions. `users` is brand-scoped per DL-015 (brand admins manage their own user roster); `roles` is also brand-scoped to allow per-brand role definitions. `user_roles` is the junction table that materializes the many-to-many between users and roles (assignment is also scoped to a `location_id` to allow per-location role grants — see Master Spec §2.1).

```mermaid
erDiagram
    users {
        uuid id PK
        uuid brand_id FK
        text email
        text full_name
        text status
    }
    roles {
        uuid id PK
        uuid brand_id FK
        text name
        text description
    }
    user_roles {
        uuid id PK
        uuid brand_id FK
        uuid user_id FK
        uuid role_id FK
        uuid location_id FK
    }
    sessions {
        uuid id PK
        uuid brand_id FK
        uuid user_id FK
        timestamptz expires_at
        text status
    }
    brands ||--o{ users : "scopes"
    brands ||--o{ roles : "scopes"
    brands ||--o{ user_roles : "scopes"
    brands ||--o{ sessions : "scopes"
    users ||--o{ user_roles : "assigned"
    roles ||--o{ user_roles : "assigned"
    users ||--o{ sessions : "owns"
```

---

## 3. Inventory (`inventory.ts`)

Items, batches (FEFO-tracked per DL-016 part 1), stock levels, and the enablement matrix that gates every stock movement (Master Spec §2.4 / §7.3 — `inventoryService.checkEnablement` invariant). All four are brand-scoped.

```mermaid
erDiagram
    items {
        uuid id PK
        uuid brand_id FK
        text name
        text sku
        text product_type
        text uom
        text status
    }
    batches {
        uuid id PK
        uuid brand_id FK
        uuid item_id FK
        text batch_code
        date received_at
        date expiry_date
        numeric yield_factor
        text status
    }
    stock_levels {
        uuid id PK
        uuid brand_id FK
        uuid item_id FK
        uuid department_id FK
        uuid batch_id FK
        numeric quantity
    }
    enablement_matrix {
        uuid id PK
        uuid brand_id FK
        uuid item_id FK
        uuid department_id FK
        boolean enabled
    }
    departments {
        uuid id PK
    }
    brands ||--o{ items : "scopes"
    brands ||--o{ batches : "scopes"
    brands ||--o{ stock_levels : "scopes"
    brands ||--o{ enablement_matrix : "scopes"
    items ||--o{ batches : "produces"
    items ||--o{ stock_levels : "tracked at"
    items ||--o{ enablement_matrix : "gated for"
    batches ||--o{ stock_levels : "stored as"
    departments ||--o{ stock_levels : "holds"
    departments ||--o{ enablement_matrix : "gated for"
```

---

## 4. Procurement (`procurement.ts`)

Vendors (scope-tagged per Master Spec §2.7), purchase orders + lines, goods receipts + lines. POs and GRs are TRN-bearing transactional tables (Master Spec §6.2 → `architecture.md` §5.5). The `irn` placeholder column on `purchase_orders` carries the IRN-paste idempotency unique constraint per DL-016 part 2.

```mermaid
erDiagram
    vendors {
        uuid id PK
        uuid brand_id FK
        text name
        text scope
        uuid scope_ref_id
        text status
    }
    purchase_orders {
        uuid id PK
        uuid brand_id FK
        text trn
        uuid vendor_id FK
        uuid location_id FK
        text status
        text irn
    }
    purchase_order_lines {
        uuid id PK
        uuid brand_id FK
        uuid purchase_order_id FK
        uuid item_id FK
        numeric quantity_ordered
        numeric unit_price
    }
    goods_receipts {
        uuid id PK
        uuid brand_id FK
        text trn
        uuid purchase_order_id FK
        uuid received_by_location_id FK
        text status
    }
    goods_receipt_lines {
        uuid id PK
        uuid brand_id FK
        uuid goods_receipt_id FK
        uuid purchase_order_line_id FK
        uuid batch_id FK
        numeric quantity_received
        numeric yield_factor_applied
    }
    items {
        uuid id PK
    }
    batches {
        uuid id PK
    }
    locations {
        uuid id PK
    }
    brands ||--o{ vendors : "scopes"
    brands ||--o{ purchase_orders : "scopes"
    brands ||--o{ purchase_order_lines : "scopes"
    brands ||--o{ goods_receipts : "scopes"
    brands ||--o{ goods_receipt_lines : "scopes"
    vendors ||--o{ purchase_orders : "supplies"
    locations ||--o{ purchase_orders : "destined for"
    purchase_orders ||--o{ purchase_order_lines : "contains"
    items ||--o{ purchase_order_lines : "ordered"
    purchase_orders ||--o{ goods_receipts : "fulfilled by"
    goods_receipts ||--o{ goods_receipt_lines : "contains"
    purchase_order_lines ||--o{ goods_receipt_lines : "satisfied by"
    batches ||--o{ goods_receipt_lines : "creates"
```

---

## 5. Recipes (`recipes.ts`)

Recipes are versioned (version snapshot per release per Master Spec §2.5 yield cascade). `recipe_cost_snapshot` is the materialized roll-up table carved out by DL-008 — refreshed event-driven (yield-factor or ingredient-price write) and via nightly backstop cron (`architecture.md` §9.4).

```mermaid
erDiagram
    recipes {
        uuid id PK
        uuid brand_id FK
        text name
        text type
        uuid output_item_id FK
        text status
    }
    recipe_versions {
        uuid id PK
        uuid brand_id FK
        uuid recipe_id FK
        int version_number
        text status
        timestamptz published_at
    }
    recipe_lines {
        uuid id PK
        uuid brand_id FK
        uuid recipe_version_id FK
        uuid ingredient_item_id FK
        numeric quantity
        text uom
    }
    recipe_cost_snapshot {
        uuid id PK
        uuid brand_id FK
        uuid recipe_version_id FK
        numeric computed_cost
        timestamptz last_computed_at
    }
    items {
        uuid id PK
    }
    brands ||--o{ recipes : "scopes"
    brands ||--o{ recipe_versions : "scopes"
    brands ||--o{ recipe_lines : "scopes"
    brands ||--o{ recipe_cost_snapshot : "scopes"
    recipes ||--o{ recipe_versions : "versioned as"
    recipe_versions ||--o{ recipe_lines : "contains"
    recipe_versions ||--|| recipe_cost_snapshot : "rolled up to"
    items ||--o{ recipes : "produced by"
    items ||--o{ recipe_lines : "consumed in"
```

---

## 6. Production (`production.ts`)

Production orders drive the 5-status state machine (DL-001) and trigger `inventoryService.deductStock` at the In Progress transition (DL-016 part 1, `SELECT ... FOR UPDATE` row-lock pattern). Production outputs feed downstream dispatch.

```mermaid
erDiagram
    production_orders {
        uuid id PK
        uuid brand_id FK
        text trn
        uuid recipe_version_id FK
        uuid producing_department_id FK
        numeric planned_quantity
        text status
        timestamptz started_at
        timestamptz completed_at
    }
    production_outputs {
        uuid id PK
        uuid brand_id FK
        uuid production_order_id FK
        uuid output_item_id FK
        uuid output_batch_id FK
        numeric quantity_produced
        text status
    }
    recipe_versions {
        uuid id PK
    }
    departments {
        uuid id PK
    }
    items {
        uuid id PK
    }
    batches {
        uuid id PK
    }
    brands ||--o{ production_orders : "scopes"
    brands ||--o{ production_outputs : "scopes"
    recipe_versions ||--o{ production_orders : "produces from"
    departments ||--o{ production_orders : "performed in"
    production_orders ||--o{ production_outputs : "yields"
    items ||--o{ production_outputs : "produced as"
    batches ||--o{ production_outputs : "tagged as"
```

---

## 7. Dispatch (`dispatch.ts`)

Dispatch challans (TRN-bearing — see Master Spec §6.2 sample form `DC-2026-POS-AA-001234`) move final products from production / dispatch departments to POS counter service. Lines reference batch lots so traceability is preserved end-to-end.

```mermaid
erDiagram
    dispatch_challans {
        uuid id PK
        uuid brand_id FK
        text trn
        uuid origin_department_id FK
        uuid destination_location_id FK
        text status
        timestamptz dispatched_at
        text irn
    }
    dispatch_challan_lines {
        uuid id PK
        uuid brand_id FK
        uuid dispatch_challan_id FK
        uuid item_id FK
        uuid batch_id FK
        numeric quantity_dispatched
    }
    departments {
        uuid id PK
    }
    locations {
        uuid id PK
    }
    items {
        uuid id PK
    }
    batches {
        uuid id PK
    }
    brands ||--o{ dispatch_challans : "scopes"
    brands ||--o{ dispatch_challan_lines : "scopes"
    departments ||--o{ dispatch_challans : "originated by"
    locations ||--o{ dispatch_challans : "destined for"
    dispatch_challans ||--o{ dispatch_challan_lines : "contains"
    items ||--o{ dispatch_challan_lines : "ships"
    batches ||--o{ dispatch_challan_lines : "lot-traced as"
```

---

## 8. POS (`pos.ts`)

POS locations (a typed subset of `locations` — see `pos_locations` join / view), POS sales (one row per ticket), POS imports (provenance for batch-imported sales from external POS systems). Sales TRN bears the per-POS-location segment (Master Spec §6.2 sample `DC-2026-POS-AA-001234` form).

```mermaid
erDiagram
    pos_locations {
        uuid id PK
        uuid brand_id FK
        uuid location_id FK
        text pos_code
        text status
    }
    pos_sales {
        uuid id PK
        uuid brand_id FK
        text trn
        uuid pos_location_id FK
        uuid pos_import_id FK
        timestamptz sold_at
        numeric total_amount
        text status
        text irn
    }
    pos_imports {
        uuid id PK
        uuid brand_id FK
        uuid pos_location_id FK
        text source
        text status
        timestamptz imported_at
    }
    locations {
        uuid id PK
    }
    brands ||--o{ pos_locations : "scopes"
    brands ||--o{ pos_sales : "scopes"
    brands ||--o{ pos_imports : "scopes"
    locations ||--|| pos_locations : "specialises"
    pos_locations ||--o{ pos_sales : "rings up"
    pos_locations ||--o{ pos_imports : "ingested for"
    pos_imports ||--o{ pos_sales : "sourced from"
```

---

## 9. Accounting (`accounting.ts` + `reporting.ts`)

Chart of accounts, journal entries, journal lines (double-entry — debit / credit balance enforced at service layer per Master Spec §6 / §8.4). `chart_of_accounts` is one of the four DL-013 audit-trigger backstop tables. `report_line_config` and `saved_report_definitions` live in `reporting.ts` per `architecture.md` §5.1 and back the §6.3 Trial Balance / P&L / Balance Sheet outputs.

```mermaid
erDiagram
    chart_of_accounts {
        uuid id PK
        uuid brand_id FK
        text account_code
        text name
        text account_type
        uuid parent_account_id FK
        text status
    }
    journal_entries {
        uuid id PK
        uuid brand_id FK
        text trn
        date posting_date
        text reference_type
        uuid reference_id
        text status
    }
    journal_lines {
        uuid id PK
        uuid brand_id FK
        uuid journal_entry_id FK
        uuid account_id FK
        numeric debit
        numeric credit
    }
    report_line_config {
        uuid id PK
        uuid brand_id FK
        text report_type
        uuid account_id FK
        text section
        int sort_order
    }
    saved_report_definitions {
        uuid id PK
        uuid brand_id FK
        text name
        text report_type
        jsonb filters
    }
    brands ||--o{ chart_of_accounts : "scopes"
    brands ||--o{ journal_entries : "scopes"
    brands ||--o{ journal_lines : "scopes"
    brands ||--o{ report_line_config : "scopes"
    brands ||--o{ saved_report_definitions : "scopes"
    chart_of_accounts ||--o{ chart_of_accounts : "parent of"
    journal_entries ||--o{ journal_lines : "contains"
    chart_of_accounts ||--o{ journal_lines : "posted to"
    chart_of_accounts ||--o{ report_line_config : "mapped to"
```

---

## 10. HRM (`hrm.ts`)

Per `architecture.md` §5.1, Epic 11 owns `employees`, `attendance`, `shifts`. Forward-permitted shape — full schema lands with Epic 11.

```mermaid
erDiagram
    employees {
        uuid id PK
        uuid brand_id FK
        uuid user_id FK
        uuid home_location_id FK
        text employee_code
        text status
    }
    attendance {
        uuid id PK
        uuid brand_id FK
        uuid employee_id FK
        date attendance_date
        timestamptz clock_in_at
        timestamptz clock_out_at
        text status
    }
    shifts {
        uuid id PK
        uuid brand_id FK
        uuid location_id FK
        text name
        time start_time
        time end_time
    }
    users {
        uuid id PK
    }
    locations {
        uuid id PK
    }
    brands ||--o{ employees : "scopes"
    brands ||--o{ attendance : "scopes"
    brands ||--o{ shifts : "scopes"
    users ||--|| employees : "linked to"
    locations ||--o{ employees : "based at"
    employees ||--o{ attendance : "logs"
    locations ||--o{ shifts : "scheduled at"
```

---

## 11. Audit & Notifications (`audit.ts`, `notifications.ts`)

`audit_log` schema is reproduced from `architecture.md` §5.6 / DL-013. `notifications` and `notification_type_config` back the Notification Center (Master Spec §7.3, `architecture.md` §11). All three are brand-scoped.

```mermaid
erDiagram
    audit_log {
        uuid id PK
        uuid brand_id FK
        timestamptz occurred_at
        uuid actor_user_id FK
        text table_name
        text row_id
        text action
        jsonb changed_fields
        jsonb before
        jsonb after
        text reason
        text trn_reference
        jsonb context
    }
    notifications {
        uuid id PK
        uuid brand_id FK
        uuid recipient_user_id FK
        text type
        text status
        jsonb payload
        timestamptz delivered_at
    }
    notification_type_config {
        uuid id PK
        uuid brand_id FK
        text type
        text default_channel
        boolean enabled
    }
    users {
        uuid id PK
    }
    brands ||--o{ audit_log : "scopes"
    brands ||--o{ notifications : "scopes"
    brands ||--o{ notification_type_config : "scopes"
    users ||--o{ audit_log : "actor of"
    users ||--o{ notifications : "recipient of"
    notification_type_config ||--o{ notifications : "configures"
```

---

## 12. Approvals (`approvals.ts`)

Unified Approval Engine per Master Spec §7.3 / §8.2. `approval_matrix` is the data-driven routing config (`architecture.md` §6 referenced); `approval_requests` is the request envelope; `approval_actions` is the action log (one row per approve / reject step).

```mermaid
erDiagram
    approval_matrix {
        uuid id PK
        uuid brand_id FK
        text entity_type
        text rule_name
        jsonb conditions
        jsonb required_roles
        int sort_order
    }
    approval_requests {
        uuid id PK
        uuid brand_id FK
        text entity_type
        uuid entity_id
        text state
        uuid initiated_by_user_id FK
        timestamptz initiated_at
    }
    approval_actions {
        uuid id PK
        uuid brand_id FK
        uuid approval_request_id FK
        uuid actor_user_id FK
        text action
        text comment
        timestamptz acted_at
    }
    users {
        uuid id PK
    }
    brands ||--o{ approval_matrix : "scopes"
    brands ||--o{ approval_requests : "scopes"
    brands ||--o{ approval_actions : "scopes"
    approval_matrix ||--o{ approval_requests : "routes"
    approval_requests ||--o{ approval_actions : "logs"
    users ||--o{ approval_requests : "initiated by"
    users ||--o{ approval_actions : "acted by"
```

---

## 13. Files (`files.ts`)

Polymorphic attachment table — entity-attribution is `(entity_type, entity_id)`, paths follow the per-brand bucket layout from DL-017.

```mermaid
erDiagram
    file_attachments {
        uuid id PK
        uuid brand_id FK
        text entity_type
        uuid entity_id
        text storage_path
        text mime_type
        bigint size_bytes
        uuid uploaded_by_user_id FK
        timestamptz uploaded_at
    }
    users {
        uuid id PK
    }
    brands ||--o{ file_attachments : "scopes"
    users ||--o{ file_attachments : "uploaded by"
```

---

## See also (forthcoming in same Phase 3a session)

- `service-graph.md` — Service-layer call graph (Master Spec §8 contracts realized as TypeScript modules per `architecture.md` §6).
- `sequence-b2b-challan.md` — B2B dispatch sequence (challan creation → IRN paste → POS receipt; per `_planning/04-b2b-challan-spec.md`).
- `sequence-production-order-lifecycle.md` — Production Order 5-status state machine (DL-001) with `deductStock` row-lock (DL-016 part 1).
- `sequence-approval-routing.md` — Unified Approval Engine routing (Master Spec §8.2 + DL-016 part 3 status-guarded UPDATE).

# F&B ERP SYSTEM — Master Architecture & Requirements Specification

*Multi-Location Food & Beverage Organisation*
*Comprehensive Blueprint for AI-Assisted Development*

| | |
|---|---|
| **Version** | 1.2 — Framework-agnostic |
| **Date** | April 2026 |
| **Status** | Ready for Architecture Phase |
| **Delivery Model** | Solo developer, AI-assisted (Claude Code + MCP servers) |
| **Previous** | v1.1 — April 2026 |

> **⚠ IMPORTANT:** This document is the single source of truth for all architectural decisions, scope boundaries, and implementation rules. Every developer, every AI agent, and every planning workflow must read this before any implementation begins. Zero assumptions are permitted — if something is not specified here, it must be raised as a question, not guessed.

---

## 1. Project Overview

### 1.1 What We Are Building

A comprehensive Enterprise Resource Planning (ERP) system specifically designed for multi-location Food & Beverage organisations. The system centralises and streamlines inventory management, procurement, production planning, recipe management, distribution, accounting, and HR across all locations from a single platform.

### 1.2 Deployment Strategy

| Dimension | Decision |
|---|---|
| MVP Deployment | Single-tenant — one brand/organisation |
| Architecture Design | Multi-tenant ready from day one (`tenant_id` patterns, RLS-ready schema) |
| Migration Path | Single-tenant → multi-tenant SaaS when product-market fit is validated |
| Development Model | Solo developer, AI-assisted (Claude Code + MCP servers) |
| Implementation Method | Sprint-based, epic-by-epic, story-by-story execution |

### 1.3 MVP Scope Philosophy

> **PRINCIPLE:** "Mile Wide, Inch Deep" — All modules present in MVP at core-workflow depth. Features deepen iteratively post-launch. Do NOT build advanced features during MVP epics — scope is defined per tier in §4.

---

## 2. Domain Model

### 2.1 Organisational Hierarchy

All database tables that are org-scoped carry these foreign keys on every row: `brand_id`, `cluster_id`, `location_id`, `department_id`. This is non-negotiable and applies from Epic 1 onwards.

```
Brand (Tenant)
├── Brand Store              ← central raw material storage (NOT a retail outlet)
└── Clusters (A, B, ...)
    ├── Cluster Store        ← intermediate raw material storage
    ├── Central Kitchen
    │   ├── Production Depts (Pastry, Bakery, Pantry, Brownie, ...)
    │   └── Non-Production Depts (Packaging, Dispatch, QC, Housekeeping, ...)
    └── POS Locations (AA, AB, AC, ...)
        ├── Production Depts (Hot Kitchen, Service Bar)
        └── Non-Production Depts (Counter Service, Housekeeping, ...)
```

### 2.2 Three Product Types — Strict Flow Rules

> **CRITICAL RULE:** Product type determines movement direction. Enforcement is in the business logic layer (Express.js services), NOT only in UI validation. Violations must be blocked at the service level.

| Product Type | Direction | Movement Rule | Enforcement Level |
|---|---|---|---|
| Raw Materials | Downward only | Brand Store → Cluster Store → Department. Never upward. Never lateral between clusters. | Business logic + UI |
| Semi-Products | Lateral within cluster | Can transfer between enabled departments in the same cluster only. Cannot cross cluster boundaries. | Business logic + UI |
| Final Products | Production → Dispatch → POS | Production Dept → Dispatch Dept → POS Counter Service. No lateral movement between POS locations. | Business logic + UI |

### 2.3 Stores Definition

In this system, "Store" means a raw material storage space — not a retail outlet. Stores exist only at Brand level and Cluster level. Stores hold raw materials ONLY. Semi-products and final products never enter a Store.

### 2.4 Material Enablement

> **DOMAIN RULE:** A raw material must be explicitly ENABLED for a department before that department can consume, request, or receive it. Enforcement must occur in the business logic layer. `inventoryService.checkEnablement(itemId, departmentId)` must be called before every stock movement. A missing enablement check is a data integrity bug, not a style issue.

### 2.5 Yield Factors

Yield factors are variable conversion rates applied when goods are received or used in production. Example: 100 kg tomatoes × 0.85 yield = 85 kg usable material. Yield factor changes cascade through the entire recipe hierarchy: raw material yield → semi-product cost → final product cost. Whenever yield factors are updated, all dependent recipe cost roll-ups must be recalculated automatically.

### 2.6 Key Process Flows

| Process | Flow | Notes |
|---|---|---|
| Procurement | Demand → PO → GR → Quality Check → Inventory Update → Invoice Match | GR triggers yield factor application |
| Production | Production Order → Material Requisition → Production → Quality Check → Finished Goods | Material deduction from enabled dept |
| Distribution | Dispatch Order → Internal Challan → POS Receipt → Closing Inventory | Variance calculated at day end |
| Financial | Transaction → Journal Entry (auto) → Ledger → Reports → Export | See §6 for full spec |

### 2.7 Vendor Scope

Vendors are scope-tagged to a level in the organisational hierarchy: **Brand**, **Cluster**, or **POS**. Scope determines which locations may purchase from the vendor. Brand-level vendors are usable across the entire brand. Cluster-level vendors are usable only within their assigned cluster. POS-level vendors are usable only at their specific POS location. Enforcement is at the service layer at PO creation time. See PRD §6 (Vendor Scope sub-section) for the full domain rule including widening / narrowing semantics.

---

## 3. All Architectural Decisions (CLOSED)

The following decisions have been made and are CLOSED. Implementation must not re-debate these. If a circumstance arises that seems to contradict a decision, raise it as a formal change request — do not work around it silently.

### 3.1 Technology Stack

**Frontend**

| Technology | Version | Purpose | Decision |
|---|---|---|---|
| React | 18+ | UI framework | ✅ FINAL |
| TypeScript | 5.x strict mode | Type safety end-to-end | ✅ FINAL — no `any` types |
| Tailwind CSS | 4.x | Utility-first styling | ✅ FINAL — superseded 3.x at Phase 2c-prep, see DL-002 |
| shadcn/ui + Radix | Latest | Component library | ✅ FINAL |
| Inter | — | Font family | ✅ FINAL |
| TanStack Table | Latest | Data grids | ✅ FINAL |
| TanStack Query | Latest | Server state / caching | ✅ FINAL |
| React Hook Form + Zod | Latest | Forms + validation | ✅ FINAL |
| Zustand | Latest | Client state | ✅ FINAL |
| Recharts | Latest | Charts / visualisation | ✅ FINAL |

**Backend**

| Technology | Version | Purpose | Decision |
|---|---|---|---|
| Node.js | 20+ | Runtime | ✅ FINAL |
| Express.js | Latest | API server + business logic | ✅ FINAL |
| TypeScript | 5.x | End-to-end type safety | ✅ FINAL |
| Supabase | Hosted | PostgreSQL + Auth + Realtime + Storage | ✅ FINAL |
| Supabase Auth | — | Email/password (SSO post-MVP) | ✅ FINAL |
| Supabase RLS | — | Defence-in-depth (see §3.2) | ✅ FINAL |
| Supabase Realtime | — | WebSocket subscriptions | ✅ FINAL |
| Drizzle ORM | Latest | Type-safe DB access | ✅ FINAL — chosen over Prisma |

**Infrastructure**

| Technology | Version | Purpose | Decision |
|---|---|---|---|
| Vercel | — | Frontend deployment | ✅ FINAL |
| Railway (Mumbai region) | — | Backend deployment | ✅ FINAL — DL-007 — Railway (Mumbai), see architecture.md §3 |
| GitHub | — | Version control | ✅ FINAL |
| GitHub Actions | — | CI/CD | ✅ FINAL |
| Sentry | — | Error tracking | ✅ FINAL |

### 3.2 Architecture Decisions

| Decision | Detail / Rationale |
|---|---|
| **ORM: Drizzle (not Prisma)** | Drizzle chosen for SQL transparency and control over complex inventory queries (yield cascades, multi-level cost roll-ups, cross-cluster stock movements). Schema defined in TypeScript — no generation step. Note: keep schema files modular (one per domain) to prevent IDE responsiveness degradation on large schemas. |
| **Monorepo** | Shared TypeScript types in `packages/shared`. Frontend in `apps/web`, backend in `apps/api`. Unified deployment. ✅ FINAL — DL-006 — Turborepo on pnpm workspaces, see architecture.md §3. |
| **REST API (not GraphQL)** | REST is more appropriate for this domain. All endpoints follow conventions defined in `architecture.md`. Pattern: `/api/v1/{resource}` for collections, `/api/v1/{resource}/{id}` for items. |
| **Business logic in Express.js only** | Supabase serves as database + auth + realtime layer. Core business logic (enablement checks, stock movement rules, recipe cost roll-ups) lives exclusively in Express.js services. No Supabase Edge Functions for business logic. |
| **RLS = Defence-in-depth, not primary enforcement** | All Express.js API calls use the `service_role` key which bypasses RLS. Express.js business logic IS the primary enforcement layer. A missing `brand_id` filter or enablement check in a service method is a security vulnerability — not a style issue. RLS provides a backstop for direct DB access only. |
| **Single-tenant now, multi-tenant ready** | Every table carries `brand_id` as a foreign key. A `brand_id` index must be created on every major table in the initial migration. RLS policies defined from the start even if not enforced until multi-tenant migration. |
| **Accounting: Export-First Integration** | The ERP is the system of operational record. External accounting software (Tally/Zoho Books) is the system of financial record. No live API adapter in MVP. The ERP builds high-quality structured exports keyed on Universal TRN. The accountant downloads exports and imports into their accounting software. Live adapter is post-MVP. |
| **Financial statements: Internal journal** | Trial Balance, P&L, and Balance Sheet are rendered from the ERP's own internal journal. The structure of these statements is stable. When accounting norms change (e.g., new Schedule III disclosures), only the account grouping configuration changes — no code change required. |
| **Compliance fields: Placeholder strategy** | GST, e-invoicing (IRN), TDS, e-way bill fields exist as optional nullable fields on transactions from MVP. Users with appropriate roles can manually fill these. System never fails on empty. When full compliance features are built in v2, the system writes to the same fields automatically. No duplicate columns ever created. |
| **Development Platform: IDE-First** | All phases — Planning, Architecture, and Implementation — are conducted inside VS Code using Claude Code. This keeps all planning documents and code in a single environment, enables MCP server access (Supabase, Context7, etc.) throughout all phases, and eliminates context transfer friction between tools. |

### 3.3 UI Design Tooling Strategy

> ⚠ **SUPERSEDED.** UI design tooling decision is RESOLVED per DL-004 + `_planning/architecture.md` §18. The Stitch / Imagine / hybrid options below are historical context; do not act on them. The chosen tool is in-repo Vite + React + Tailwind + shadcn/ui.

> **DECISION:** UI design tooling choice is **deferred to the implementation phase**. Two approaches are pre-validated; the team picks one (or uses a hybrid) when frontend work begins. Whichever path is taken, the rules below about `DESIGN.md` as the single source of truth for design tokens are non-negotiable.

#### Option A — Google Stitch (`stitch.withgoogle.com`)

**What it is:** A free AI-powered UI design tool from Google Labs. It takes a natural-language prompt — *"a dark sidebar dashboard showing inventory stock levels by department, card-based layout, teal accent colour"* — and generates a high-fidelity visual design with HTML/CSS code in roughly 90 seconds. Runs on Gemini 2.5 Pro and requires only a Google account.

**Pipeline:**

| Step | Who | What Happens |
|---|---|---|
| 1. Define screen requirements | Designer (product owner) | Writes a screen brief: name, purpose, data displayed, user actions |
| 2. Generate screen in Stitch | Designer | Pastes the screen description as a prompt in Stitch. Iterates with follow-ups until the design looks right (2–5 minutes per screen) |
| 3. Export `DESIGN.md` | Designer | Exports the design system file (colours, fonts, spacing scale). Commits to project root. One-time after the first approved screen. |
| 4. Fetch design in Claude Code | Claude Code via `stitch-mcp` | Calls the screen export tool via the `stitch-mcp` MCP server. Receives HTML/CSS without manual copy-paste. |
| 5. Convert to React component | Claude Code | Converts Stitch HTML/CSS to TypeScript React + Tailwind + shadcn/ui. Applies design tokens from `DESIGN.md`. Wires real data from the API. |
| 6. Review and iterate | Designer | Checks rendered component. Adjusts in Stitch and refetches if needed. |

**One-time setup (run in VS Code terminal during project setup):**

```bash
# Authenticate with Google Cloud
gcloud auth login
gcloud config set project YOUR_GOOGLE_CLOUD_PROJECT_ID
gcloud auth application-default login

# Enable Stitch API
gcloud beta services mcp enable stitch.googleapis.com --project=YOUR_PROJECT_ID

# Install stitch-mcp for Claude Code
claude mcp add -e GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID -s user stitch \
  -- npx -y @_davideast/stitch-mcp proxy
```

> **NOTE:** The `stitch-mcp` proxy uses OAuth (Google Cloud application default credentials), not an API key. Always use `gcloud auth application-default login`.

**Stitch prompt template:**

```
[Screen type: Dashboard / Form / List / Detail / Report]
[Device: Mobile-first / Desktop / Both]
[Theme: Light with teal (#1F6B75) accent, Inter font, card-based layout]

[Screen name]: [Purpose in one sentence]

Data to display:
- [item 1]
- [item 2]

User actions available:
- [action 1]
- [action 2]

Layout notes: [any specific layout preferences]
```

**Strengths:** Fast generation, exportable design system, dedicated MCP integration, opinionated visual quality.
**Tradeoffs:** Requires Google Cloud project setup; output is a starting point that always needs adaptation to project React/TypeScript patterns.

#### Option B — Claude (Imagine / Artifacts)

**What it is:** Use Claude itself — via Artifacts in Claude.ai or via the Imagine feature — to generate visual designs and React component scaffolds directly. Claude can produce HTML, SVG mockups, and React + Tailwind component code from natural-language descriptions.

**Pipeline:**

| Step | Who | What Happens |
|---|---|---|
| 1. Define screen requirements | Designer (product owner) | Writes a screen brief in the same format as Option A |
| 2. Generate component in Claude | Designer or Claude Code | Asks Claude (in Claude.ai Artifacts or in Claude Code) to produce a React component matching the brief. Iterates with follow-ups. |
| 3. Maintain `DESIGN.md` manually | Designer + Claude Code | Document design tokens (colours, typography, spacing) in `DESIGN.md`. Updated whenever new tokens are introduced. |
| 4. Adapt component to project | Claude Code | Reshapes the generated component to use existing design tokens, project shadcn/ui primitives, TanStack Query / React Hook Form patterns, and real API endpoints. |
| 5. Review and iterate | Designer | Checks rendered component in browser. Asks Claude Code to adjust styling, layout, or data flow. |

**Setup:** No additional MCP install. Available out of the box.

**Strengths:** No external tool, no API/OAuth setup, very tight coupling to Claude Code's existing context (e.g., already knows the project's design tokens, components, and conventions). Faster iteration loop for component-level work.
**Tradeoffs:** Less opinionated visual output than a dedicated design tool; the designer must be more explicit about visual style; no exportable cross-tool design system file (DESIGN.md is curated by hand).

#### Hybrid — Use Both Where Each Excels

A reasonable hybrid: use Stitch for full-screen visual exploration and the initial design system, then use Claude (in Claude Code) for component-level iteration once `DESIGN.md` and shadcn/ui primitives are in place. This is the team's expected default if no single tool clearly dominates after the first epic.

#### Non-Negotiable Rules (Apply to Both Options)

- `DESIGN.md` in the project root is the single source of truth for all design tokens. It is committed to git **before any frontend component is built**.
- No hardcoded hex colour values, font sizes, or spacing values are permitted inside component files. All visual values must reference design tokens from `DESIGN.md` or the Tailwind config generated from it.
- Any tool's output is a *starting point*, not the final version. Components must be adapted to match the project's React architecture (TypeScript props, data binding, shadcn/ui primitives, validation patterns).
- Mobile-first designs produce higher quality results in either tool. Design mobile view first, then adapt for desktop.
- If a component needs a colour or spacing value not in `DESIGN.md`, the designer must first add it to `DESIGN.md` and re-export — never hardcode a value directly in a component file.

#### `DESIGN.md` — Design System File

A markdown file (generated by Stitch or curated manually) that documents the complete design system. Once committed to the project root, it must be referenced by every frontend implementation.

| `DESIGN.md` Contains | How It Is Used in Code |
|---|---|
| Colour palette (hex values with semantic names) | Converted to Tailwind CSS custom colour tokens in `tailwind.config.ts` |
| Typography scale (font family, sizes, weights) | Applied as Tailwind typography classes — never as inline styles |
| Spacing scale | Applied as Tailwind spacing classes |
| Component styles (button variants, card styles, input states) | Drives shadcn/ui component customisation in `components.json` |
| Border radius, shadow tokens | Applied as Tailwind utilities |
| Icon style guidance | Governs which Lucide React icons are used and at what sizes |

> **RULE:** `DESIGN.md` must be committed to git at the start of frontend work (before any component is built). If a component needs a token not in `DESIGN.md`, the designer must add it to `DESIGN.md` first — never hardcode a value directly in a component file.

---

## 4. MVP Scope & Module Tiers

| Epic | Module | Tier | Depth |
|---|---|---|---|
| 1 | Master Data Management | Tier 1 — Deep | Full depth. Foundation everything depends on. |
| 2 | User Management & Security | Core | Full RBAC + material enablement + approval engine. |
| 3 | Shared Infrastructure | Core | Approval engine, notifications, audit trail — built before all other epics. |
| 4 | Inventory Management | Tier 1 — Deep | Full material flow, stock tracking, transfers, yield handling, PAR levels. |
| 5 | Procurement | Tier 1 — Deep | POs, GR, vendor management, goods receipt with yield. |
| 6 | Recipe Management | Tier 1 — Deep | CRUD, versioning (2+ versions), costing, sub-recipes, cost roll-ups. |
| 7 | Production Planning | Tier 2 — Lean (with Tier 1 carve-out) | Production orders, material deduction, basic scheduling. No ML forecasting. **Tier 1 carve-out:** Pending GR linkage and provisional costing (PRD FR64–FR67, FR67a) are built at Tier 1 depth — operational reality requires it (kitchens cannot wait for formal GR before starting production). All other Epic 7 features remain at Tier 2. |
| 8 | Dispatch & Distribution | Tier 2 — Lean | Internal challans, dispatch-to-POS, closing inventory, variance. No GPS/routing. |
| 9 | POS Integration | Tier 3 — Minimal | Menu mapping, sales data import via API, inventory impact. Not a POS replacement. |
| 10 | Accounting & Financial | Tier 2 — Lean | See §6 for full revised specification. |
| 11 | HRMS | Tier 3 — Minimal | Employee records, basic attendance, shift management. No payroll. |
| 12 | Analytics & Reporting | Cross-module | Dashboards, Food Cost Control Centre, cross-module reports. |

### 4.1 Deferred Post-MVP (Do Not Build)

> **HARD BOUNDARY:** The following are explicitly deferred. If a story appears to require any of these, STOP and raise a formal change query before proceeding.

Quality Assurance module (full) · Waste Management & Sustainability module · CRM · Equipment Management · Compliance & Documentation module (full) · Native Mobile Apps · ML-based production forecasting · Route optimisation and GPS tracking · Full payroll calculation · Advanced predictive analytics · GST return filing engine · E-invoicing IRN generation · TDS management engine · E-way bill generation engine · Live Tally/Zoho Books API adapter

---

## 5. Epic Implementation Sequence

> **RULE:** Epics must be implemented in this order. A later epic may NOT begin until all its dependencies are complete and tested. The shared infrastructure (Epic 3) must be built before Epics 4–12.

```
Epic 1: Master Data Management
  └─ No dependencies. Foundation for all other epics.

Epic 2: User Management & Security
  └─ Requires: Epic 1 (org hierarchy for RBAC mapping)

Epic 3: Shared Infrastructure          ← BUILD BEFORE EPICS 4–12
  └─ Requires: Epics 1, 2
  └─ Provides: Unified Approval Engine, Notification Center, Audit Trail

Epic 4: Inventory Management
  └─ Requires: Epics 1, 2, 3

Epic 5: Procurement
  └─ Requires: Epic 4 (inventory to receive into)

Epic 6: Recipe Management
  └─ Requires: Epics 4, 5

Epic 7: Production Planning
  └─ Requires: Epics 4, 6

Epic 8: Dispatch & Distribution
  └─ Requires: Epic 7

Epic 9: POS Integration
  └─ Requires: Epic 8

Epic 10: Accounting & Financial
  └─ Requires: Epics 4, 5, 6, 7, 8 (all transaction-producing modules)

Epic 11: HRMS
  └─ Relatively independent. Can run parallel with Epics 9–10.

Epic 12: Analytics & Reporting
  └─ Requires: All preceding epics
```

---

## 6. Epic 10: Accounting & Financial — Full Specification

> **REVISED SCOPE NOTICE:** This module has been redesigned from earlier requirements drafts. This section supersedes any earlier Epic 10 specification.

### 6.1 Core Architectural Principle

| ERP Owns | External Accounting Software Owns |
|---|---|
| All operational transactions (POs, GRs, stock movements, production, dispatch, sales) | Chart of accounts (detailed, statutory) |
| Universal Transaction Reference Numbers (TRN) | Journal entry engine (double-entry bookkeeping) |
| Simplified internal ledger for management reporting | GST return preparation and filing (GSTR-1, GSTR-3B) |
| Financial statements (Trial Balance, P&L, Balance Sheet, Cash Flow) | E-invoicing and IRN generation |
| Budget tracking and food cost analytics | TDS management and certificates |
| Structured exports for accountant handoff (keyed on TRN) | E-way bill generation |
| Compliance placeholder fields (manually editable, nullable) | Statutory audit trail for regulatory purposes |
| Daily Sales Report capture | Tax payment scheduling |

### 6.2 Universal Transaction Reference Number (TRN)

Every financially significant transaction gets a typed, unique, human-readable TRN at the moment of creation. The TRN is immutable, system-generated, and is the single linking key between the ERP and external accounting software.

```
Format: {TYPE}-{YYYY}-{LOCATION_CODE}-{SEQUENCE}

PO-2026-BRD-000123      → Purchase Order (Brand level)
GR-2026-CKA-000456      → Goods Receipt (Central Kitchen A)
ST-2026-CA-000789       → Stock Transfer (Cluster A)
PR-2026-CKA-001011      → Production Order
DC-2026-POS-AA-001234   → Dispatch Challan (POS Location AA)
WO-2026-CKA-001456      → Wastage Write-off
SA-2026-POS-AA-001678   → Sales (POS daily summary)
CN-2026-BRD-001890      → Credit Note (vendor return or B2B return)
JV-2026-BRD-002100      → Manual Journal Voucher
ADJ-2026-CKA-002345     → Inventory Adjustment
```

### 6.3 In-Scope Features (Build in MVP)

| Feature | What It Does | Notes |
|---|---|---|
| Universal TRN | Typed reference on every financially significant transaction | See §6.2 |
| Simplified Chart of Accounts | F&B-focused account structure. Not a statutory CoA. | Pre-seeded. Configurable mapping. |
| Automated Journal Entries | Every confirmed operational transaction auto-generates a journal entry via mapping rules. | Triggered by status change to "confirmed" |
| Internal Ledger | Account-level balance store. Source of truth for all financial reports. | Period-based. Multi-dimensional by location/dept. |
| Trial Balance | All accounts with debit/credit totals and closing balance for a period. | Export: Excel, PDF |
| P&L Statement | Revenue minus expenses. Configurable account grouping into P&L lines. | By period, location, cluster. Export: Excel, PDF |
| Balance Sheet | Assets vs Liabilities + Equity. Configurable account grouping. | As-at date. Export: Excel, PDF |
| Cash Flow Statement | Operating/investing/financing cash flows from journal movements. Indirect method. | Export: Excel, PDF |
| Daily Sales Report | Sales by category, settlement mode, expenses per location per day. | Validated before finalisation |
| Budget vs Actual | Budget entry vs actual ledger figures. Variance report. | By cluster, location, department |
| Food Cost Control Centre | Theoretical vs actual food cost per item. Menu engineering matrix. Vendor price tracking. | Cross-module — bridges recipe, inventory, and sales |
| Accountant Handoff Exports | Structured downloads: Transaction Journal, Purchase Register, Sales Register, Vendor AP Aging, Customer AR Aging, Food Cost. | Excel/CSV. Keyed on TRN. Fixed column names. Multi-format (Tally / Zoho Books / Generic CSV). |
| Compliance Placeholder Fields | Optional editable fields for GST amounts, IRN, e-way bill, TDS on relevant transactions. | Nullable. System never fails if empty. See §6.5. |
| Integration Status Dashboard | Shows which transactions are exported, pending, last export date per type. | Operational view for accountant |

### 6.4 Out of Scope — MVP

> **RULE:** The following must NOT be built in Epic 10. If a story appears to require any of these, do not implement — raise a formal change query.

| Excluded Feature | Reason |
|---|---|
| GST return preparation (GSTR-1, GSTR-3B, GSTR-9) | Compliance-driven. Changes with government notifications. Lives in external accounting software. |
| E-invoicing / IRN generation | Requires IRP API integration. Compliance-driven. Post-MVP. |
| TDS management engine | Compliance-driven. Post-MVP. |
| E-way bill generation | Compliance-driven. Post-MVP. |
| Live API adapter to Tally or Zoho Books | Post-MVP. Build when launch customer confirms their accounting software. |

### 6.5 Compliance Placeholder Fields

These fields exist from day one. Optional, nullable, never cause a validation failure if empty. When full compliance features are built in v2, the system writes to the same fields automatically. Schema convention applies to all placeholder fields:

```
-- All placeholder fields follow this pattern:
field_name TYPE,        -- nullable: true (NEVER NOT NULL)
                        -- [PLACEHOLDER] tag in schema comment
                        -- When feature built: system writes here, manual entry disabled
                        -- DO NOT create a second field when building the feature.
```

**GST Fields (on POs, GRs, Sales, Dispatch Challans)**

| Field | Type | Required? | Notes |
|---|---|---|---|
| `vendor_gstin` | VARCHAR(15) | Conditional | Required when vendor is GST-registered. |
| `buyer_gstin` | VARCHAR(15) | Optional | B2B sales only. Null for B2C. |
| `hsn_code` | VARCHAR(8) | Optional | [PLACEHOLDER] Selected from GSTN official dropdown — not free text. |
| `place_of_supply` | VARCHAR(2) | Optional | Two-digit state code. Determines CGST+SGST vs IGST. |
| `tax_rate_percent` | DECIMAL(5,2) | Optional | Gross GST rate (0, 5, 12, 18, 28). |
| `cgst_amount` | DECIMAL(12,2) | Optional | User-entered or computed from rate. |
| `sgst_amount` | DECIMAL(12,2) | Optional | User-entered or computed from rate. |
| `igst_amount` | DECIMAL(12,2) | Optional | Applicable for inter-state. Null for intra-state. |

**E-Invoicing Fields (on POs and Sales Transactions)**

| Field | Type | Required? | Notes |
|---|---|---|---|
| `irn` | VARCHAR(64) | Optional | [PLACEHOLDER] 64-char hash. User pastes from IRP portal manually in MVP. System-generated in v2. |
| `irn_generated_at` | TIMESTAMPTZ | Optional | [PLACEHOLDER] Null until e-invoicing feature built. |
| `qr_code_data` | TEXT | Optional | [PLACEHOLDER] Signed QR payload from IRP. |
| `irn_cancelled` | BOOLEAN | Optional | [PLACEHOLDER] Flag for cancelled IRNs. |

**TDS Fields (on Vendor Payments)**

| Field | Type | Required? | Notes |
|---|---|---|---|
| `tds_applicable` | BOOLEAN | Optional | [PLACEHOLDER] Default false. |
| `tds_section` | VARCHAR(10) | Optional | [PLACEHOLDER] 194C, 194J, 194H, etc. Dropdown. |
| `tds_rate_percent` | DECIMAL(5,2) | Optional | [PLACEHOLDER] Editable by Finance role. |
| `tds_amount` | DECIMAL(12,2) | Optional | [PLACEHOLDER] Computed from rate or manually entered. |
| `tds_certificate_number` | VARCHAR(20) | Optional | [PLACEHOLDER] User fills after certificate received. |

**E-Way Bill Fields (on Stock Transfers and Dispatch Challans)**

| Field | Type | Required? | Notes |
|---|---|---|---|
| `eway_bill_number` | VARCHAR(12) | Optional | [PLACEHOLDER] 12-digit. User pastes from NIC portal. |
| `eway_bill_validity_date` | DATE | Optional | [PLACEHOLDER] Expiry date. Alert if goods not received before expiry. |
| `transporter_id` | VARCHAR(15) | Optional | [PLACEHOLDER] Transporter GSTIN or enrolment ID. |
| `vehicle_number` | VARCHAR(15) | Optional | [PLACEHOLDER] Vehicle registration number. |
| `eway_generated_at` | TIMESTAMPTZ | Optional | [PLACEHOLDER] Null until e-way bill feature built. |

### 6.6 Post-MVP Upgrade Path

| MVP (Built Now) | Post-MVP (One Sprint, When Customer Confirms Software) |
|---|---|
| Accountant downloads Transaction Journal Export CSV | System pushes journal entries to Tally/Zoho Books API automatically |
| User manually pastes IRN field after generating from IRP portal | System generates IRN via IRP API, writes to `irn` field automatically |
| User manually fills e-way bill number | System generates e-way bill via NIC portal API |
| TRN links records across both systems | TRN unchanged — designed for this from day one |

---

## 7. Critical Implementation Rules

> **FOR DEVELOPERS AND AI AGENTS:** Every rule in this section is non-negotiable. If a story or instruction conflicts with any rule below, the rule takes precedence. Raise the conflict — do not silently deviate.

### 7.1 TypeScript Rules

- Strict mode is ON. Zero `any` types in non-test files. Hookify rules block this if installed.
- Use `interface` for public API shapes and DTOs. Use `type` for unions and intersections.
- Import all shared types from `packages/shared` — never duplicate type definitions.
- Fix type errors immediately. Never suppress with `@ts-ignore`.

### 7.2 Database Rules

- Every query touching org-scoped data MUST include a `brand_id` filter. A missing `brand_id` filter is a security vulnerability.
- Every major table MUST have a `brand_id` index created in its initial migration.
- Use Drizzle ORM for all queries. No raw SQL string interpolation.
- All placeholder compliance fields are nullable. Never add `NOT NULL` to a placeholder field.
- Never create a duplicate field when building a compliance feature. The placeholder field IS the permanent field.
- Enable RLS on every table from creation.

### 7.3 Business Logic Rules

- **Enablement checks:** always call `inventoryService.checkEnablement(itemId, departmentId)` before any stock movement.
- **Stock movements:** always use `inventoryService` methods. Never query inventory tables directly.
- **Approval workflows:** always route through the Unified Approval Engine (Epic 3). Never build per-module approval logic.
- **Notifications:** always route through the Notification & Alert Center (Epic 3). Never build per-module notification logic.
- **Recipe cost roll-ups:** changes to yield factors or ingredient prices must cascade through all dependent semi-products and final products automatically.

### 7.4 Frontend / Design Rules

- No hardcoded hex colour values, font sizes, or spacing values in component files. All values must reference `DESIGN.md` tokens or Tailwind config generated from it.
- When implementing a UI screen using a design tool (Stitch, Claude Imagine, etc.), always treat the tool's output as a starting point — adapt to TypeScript props, data binding, and shadcn/ui primitives.
- `DESIGN.md` must be committed to git before any frontend component is built.
- If a required design token is missing from `DESIGN.md`, alert the product owner — do not invent a value.

### 7.5 API Rules

- All endpoints follow REST conventions in `architecture.md`. Pattern: `/api/v1/{resource}` and `/api/v1/{resource}/{id}`.
- Standard error response: `{ code: string, message: string, details?: object, timestamp: string }`
- Error categories: `validation` | `authorization` | `not_found` | `business_rule_violation` | `system`
- Never put business logic in Supabase Edge Functions. Express.js only.

### 7.6 Accounting Rules

- Every financially significant transaction generates a TRN at creation time. TRN is immutable.
- Every confirmed transaction auto-generates a journal entry. Triggered by status change to "confirmed".
- Financial reports are rendered from the internal journal. Do not pull live data from external accounting software in MVP.
- Compliance placeholder fields are always nullable. System proceeds whether filled or not.
- Export column names are fixed. Do not rename without a `decision-log.md` entry.

### 7.7 Scope Rules

- Do not build post-MVP features during MVP epics. If a story requires a post-MVP feature, raise a formal change query.
- If instructions are vague or ambiguous, push back and ask clarifying questions. Do not assume and proceed.
- Check `codebase-inventory.md` before creating new files or patterns.
- Check `decision-log.md` before making any pattern-setting implementation decision.

### 7.8 Context Management (Claude Code)

- Monitor context with `/context` during long story implementations.
- If context approaches 60–70%, STOP. Commit progress, start a fresh chat, or split the story. Do NOT use `/compact` during story implementation.
- High context usage is a story-sizing problem, not a context-management problem.

### 7.9 What Never To Do

| NEVER DO THIS | DO THIS INSTEAD |
|---|---|
| Use `any` TypeScript type | Define proper interfaces in `packages/shared` |
| Query inventory tables directly | Use `inventoryService.getAvailableStock` / `deductStock` / `checkEnablement` |
| Write raw SQL strings | Use Drizzle ORM query builder |
| Query org-scoped data without `brand_id` filter | Always include `brand_id` in every org-scoped query |
| Build per-module approval or notification logic | Route through the Unified Approval Engine and Notification Center (Epic 3) |
| Hardcode hex colours or spacing in component files | Reference design tokens from `DESIGN.md` / `tailwind.config.ts` |
| Invent visual values when a token is missing | Add the token to `DESIGN.md` first, then use it |
| Create a new compliance field when building v2 features | Write to the existing placeholder field created in MVP |
| Build GST filing, IRN, TDS, or e-way bill engine in MVP | Use placeholder fields + export approach. Post-MVP only. |
| Proceed on vague or ambiguous instructions | Push back and ask a clarifying question before writing any code |
| Guess at database schema | Check `architecture.md` and query Supabase via the Supabase MCP/plugin |
| Invent a new pattern during a story | Check `decision-log.md` first. Add an entry if truly new. |

---

## 8. Module Interface Contracts

These are the stable public APIs that cross-module code calls. Internal implementation may change — the contract must not. Before implementing any module that calls another module's functions, verify these contracts in the codebase and use them exactly as specified.

### 8.1 Inventory Service

```typescript
inventoryService.getAvailableStock(itemId: string, departmentId: string)
  → Promise<StockLevel>
  → Returns: { itemId, departmentId, quantity, unit, lastUpdatedAt }

inventoryService.deductStock(
  itemId: string,
  departmentId: string,
  quantity: number,
  reason: StockDeductionReason,
  trnReference: string
)
  → Promise<DeductionResult>
  → Returns: { success, newBalance, journalEntryId }
  → Throws:  InsufficientStockError | EnablementViolationError
  → Ordering: Applies FEFO (First Expiry, First Out) batch selection per
              PRD FR31 — caller does not pick batches; service selects
              earliest-expiry batches first within the named department.

inventoryService.checkEnablement(itemId: string, departmentId: string)
  → Promise<boolean>
  → Must be called before any stock movement operation

inventoryService.transferStock(
  fromDeptId: string,
  toDeptId: string,
  itemId: string,
  quantity: number,
  trnReference: string
)
  → Promise<TransferResult>
  → Enforces: product type flow rules + enablement + cluster boundary rules
```

### 8.2 Approval Engine (Epic 3)

```typescript
approvalEngine.createApprovalRequest(entity: ApprovalEntity) → Promise<ApprovalRequest>
approvalEngine.getApprovalStatus(referenceId: string)        → Promise<ApprovalStatus>
approvalEngine.getPendingApprovals(approverId: string)       → Promise<ApprovalRequest[]>
```

### 8.3 Notification Center (Epic 3)

```typescript
notificationCenter.send(notification: NotificationPayload)         → Promise<void>
notificationCenter.sendBulk(notifications: NotificationPayload[])  → Promise<void>
```

### 8.4 Accounting Service (Epic 10)

```typescript
accountingService.createJournalEntry(entry: JournalEntryInput) → Promise<JournalEntry>
// entry: { trnReference, date, lines: [{accountCode, debit?, credit?, narration}] }
// Validates: debits === credits (balanced entry)

accountingService.getTRN(transactionType: TRNType, locationCode: string) → Promise<string>
// Generates next sequential TRN. Immediately reserved (atomic increment).
```

---

## 9. Key Reference Files

| File / Location | Purpose & When to Read |
|---|---|
| `_planning/project-context.md` | READ FIRST before implementing any story. Updated after every epic retrospective. |
| `_planning/architecture.md` | READ before creating or modifying database tables or API endpoints. |
| `CLAUDE.md` (project root) | READ at the start of every Claude Code session. |
| `DESIGN.md` (project root) | READ before implementing any frontend component. Source of truth for all visual tokens. |
| `decision-log.md` (project root) | CHECK before any pattern-setting decision. APPEND after any micro-decision. |
| `codebase-inventory.md` (project root) | CHECK to locate relevant code before creating new files. Updated after each epic. |
| `_planning/sprint-status.yaml` | CHECK current epic and story status before picking up work. |
| This Document | The authoritative reference for all scope, decisions, and rules. |

> Note: The exact folder name (`_planning/`, `_artifacts/`, `_docs/`, etc.) is a project-setup decision. The names above are illustrative. Whatever folder name is chosen, every reference here and across the planning docs must use the same name consistently.

---

## 10. Project Process Plan

| Phase | Actions & Status |
|---|---|
| **Phase 1: Discovery & Analysis** ✅ | Brainstorming complete. Master specification complete (this document, v1.2). Supplementary specs (B2B Challan) complete. |
| **Phase 2a: PRD** | Run a fresh Claude Code session focused on PRD creation. Input: this document + brainstorming summary + B2B challan spec. Output: `prd.md`. |
| **Phase 2b: UX / Screen Inventory** | Produce a screen inventory document — for each screen: name, purpose, data displayed, user actions. Visual styling is deferred to the design tooling step. |
| **Phase 2c: Visual Design** | Use the chosen UI design tool (Google Stitch, Claude Imagine/Artifacts, or hybrid — see §3.3) to generate screens from the screen inventory. Export `DESIGN.md` to project root. |
| **Phase 3a: Architecture** | Create `architecture.md`. Brief covers Supabase schema, Drizzle modular schema files, REST API conventions, the chosen UI design tool integration, and resolution of the 9 still-open questions in §11 (OQ10 already resolved at PRD level — FR96). |
| **Phase 3b: Epics & Stories** | Decompose each epic into stories with Given/When/Then acceptance criteria. One epic at a time, confirm before proceeding. |
| **Phase 3c: Readiness Check** | Validate story-architecture-PRD cohesion. Must PASS before any code is written. |
| **Phase 4: Implementation** | Sprint-based. Story creation → implementation (fetching design via chosen tool) → code review → QA. Fresh Claude Code chat per workflow to manage context. |

> **Methodology note:** The phase plan above is the canonical ordering. The team may layer any AI-assisted development methodology on top (e.g., Superpowers, BMAD, custom workflow) provided the phase ordering, gating rules, and reference-file conventions in this document are honoured.

---

## 11. Open Questions for Architecture Phase

| # | Question | Context |
|---|---|---|
| 1 | Monorepo tooling | Turborepo vs Nx vs pnpm workspaces. ✅ RESOLVED — DL-006, architecture.md §3 — Turborepo on pnpm workspaces. |
| 2 | Backend deployment target | Railway vs Render vs Fly.io. ✅ RESOLVED — DL-007, architecture.md §3 — Railway (Mumbai region). |
| 3 | Real-time strategy | Which specific events need WebSocket updates vs polling vs optimistic UI? Not everything should be real-time. **Constrained by §3.1 Supabase Realtime FINAL — OQ3 scope is event-triage (which specific events use Realtime subscriptions vs polling vs optimistic UI), NOT vendor selection.** ✅ RESOLVED — DL-010, architecture.md §10 — 5-channel triaged subscription list. |
| 4 | Offline capability depth | Core for MVP or deferred? If core, which workflows (closing inventory, goods receipt scanning) need offline support? ✅ RESOLVED — DL-020, architecture.md §16 — deferred post-MVP; MVP resilience via TanStack retry + LocalStorage drafts. |
| 5 | PDF generation library | For challans, invoices, POs, and financial report exports. Options: react-pdf, puppeteer, @react-pdf/renderer. ✅ RESOLVED — DL-019, architecture.md §15 — @react-pdf/renderer on pg-boss worker. |
| 6 | Full-text search strategy | PostgreSQL built-in tsvector vs dedicated search (Meilisearch, Typesense). ✅ RESOLVED — DL-018, architecture.md §14 — Postgres tsvector + pg_trgm. |
| 7 | Background job engine | For batch operations and notification digests. Options: BullMQ, Inngest, pg_cron via Supabase. ✅ RESOLVED — DL-009, architecture.md §9 — pg-boss + pg_cron. |
| 8 | Caching layer | Redis for PAR levels, active recipes, org hierarchy vs TanStack Query client-side caching only. **Constrained by §3.1 TanStack Query FINAL — OQ8 scope is "Redis additionally for hot paths?", not binary cache choice.** ✅ RESOLVED — DL-008, architecture.md §12 — no Redis in MVP; TanStack Query + Postgres only; recipe-cost-snapshot carve-out. |
| 9 | UI design tool selection | ✅ RESOLVED at Phase 2c-prep (2026-05-05) — DL-004, architecture.md §18 (formal capture in Phase 3a). Decision: in-repo Vite + React + Tailwind + shadcn/ui (NOT Stitch, NOT Claude Artifacts). Rationale: shadcn/ui is FINAL per §3.1; in-repo workflow gives mechanical token enforcement (typo = build error), shared component reuse, and engineer handoff fidelity vs sandboxed alternatives. See DL-004 + Phase 2c-prep tooling review thread + commits `d8333db`, `da1c35f`. Original options (Stitch / Imagine / hybrid) superseded. |
| 10 | Accountant export format mapping | ✅ RESOLVED at PRD level (see PRD §FR96). Dual Tally + Zoho Books + Generic CSV supported simultaneously from MVP via a format-agnostic data layer with pluggable renderers. Architecture-phase deliverable: column-name mapping specification — see `_planning/architecture-oq10-export-mappings.md`. |
| 11 | Multi-tenant query pattern enforcement | Express middleware? Drizzle wrapper? `withBrand` query builder? §3.1/§3.2 don't preclude any of these (REST is the chosen API surface); the in-process query pattern that guarantees `brand_id` filtering on every org-scoped query is the open question. ✅ RESOLVED — DL-012, architecture.md §4 — `brandedDb` factory. |
| 12 | Audit trail mechanism | Trigger-based (Postgres triggers writing to `audit_log` table) vs application-layer (service-method wrapper / Drizzle middleware). Affects FR20/21 + CC-AUDIT-LINK reliability. ✅ RESOLVED — DL-013, architecture.md §7 — application-layer primary, trigger backstop on critical tables. |
| 13 | File storage layout pattern | Per-brand bucket vs per-entity bucket; signed-URL access vs direct upload. Affects FR39 (vendor docs), FR81 (production batch photos), and any attachment workflows. ✅ RESOLVED — DL-017, architecture.md §13 — per-brand bucket + Express signed-URL. |
| 14 | RLS policy authoring strategy | When are RLS policies authored (Phase 3a vs per-epic), by whom, and from what template? §3.2 says RLS = defence-in-depth — but the authoring discipline is open. ✅ RESOLVED — DL-014, architecture.md §4 + §20 — per-epic from canonical 2-policy template, with CI lint. |
| 15 | brand_id index migration template | Every major table per §3.2 must carry a `brand_id` index in its initial migration. Open: canonical migration template / Drizzle helper that makes this mechanical, not per-table memory. ✅ RESOLVED — DL-015, architecture.md §4 + §5 — `brandScopedTable` Drizzle helper. |
| 16 | Notification Center transport + dispatch model | Supabase Realtime in-app channel + email transport (Resend? Postmark? other?) + dispatch model (queue / direct / batched per FR19). Affects Notification Center §10 spec entirely. ✅ RESOLVED — DL-011, architecture.md §11 — Resend + pg-boss + data-driven dispatch. |
| 17 | Concurrency / idempotency | Advisory locks vs optimistic-with-version for `inventoryService.deductStock` atomicity (DL-001 commits to fire-at-In-Progress but mechanism is open); idempotency keys for IRN paste in DSP-010 + PO approval in PUR-004. ✅ RESOLVED — DL-016, architecture.md §8 — per-mechanism (row-lock / unique constraint / status-guarded UPDATE). |

> Architecture phase complete. All §11 OQs RESOLVED per `_planning/architecture.md` + `decision-log.md` DL-001 → DL-020. Phase 4 epic implementation may proceed once Phase 2c-scoped (mockup foundation) closes.

> **Non-exhaustive note:** This list is non-exhaustive. Phase 3a may surface additional architecture decisions; capture as DL-NNN entries with explicit rationale that §11 was non-exhaustive at scoping time.

---

## 12. Seed Data Requirements

All development and testing must use this consistent dataset. Stories are tested against this data.

| Entity | Minimum Seed Requirement |
|---|---|
| Brand | 1 brand — "Demo F&B Pvt Ltd" |
| Clusters | 2 — Cluster A (Central), Cluster B (North) |
| Central Kitchens | 2 — Central Kitchen A, Central Kitchen B |
| POS Locations | 4 — POS-AA, POS-AB (Cluster A), POS-BA, POS-BB (Cluster B) |
| Brand Store | 1 — Brand Central Store |
| Cluster Stores | 2 — Cluster Store A, Cluster Store B |
| Departments | Full set per location matching domain model in §2.1 |
| Users | 1 Brand Owner, 2 Cluster Managers, 4 Kitchen Managers, 4 POS Staff, 1 Finance Manager, 2 Procurement Managers, 2 Store Managers, 2 Dispatch Staff |
| Raw Materials | Minimum 20: flour, sugar, butter, eggs, milk, tomatoes, chicken, salt, oil, cocoa powder, yeast, cream, cheese, onions, garlic, rice, dal, spices, packaging material, cleaning supplies |
| Semi-Products | Minimum 5: dough, pastry cream, tomato sauce, marinated chicken, bread dough |
| Final Products | Minimum 8: chocolate cake, croissant, bread loaf, pasta, pizza, sandwich, coffee, juice |
| Vendors | Minimum 5 vendors with price lists, GSTIN, credit terms |
| Recipes | Minimum 5 recipes with: sub-recipes, yield factors, 2+ versions each, default version designated |
| Enablement Mappings | Full enablement map: flour enabled for Pastry/Bakery, not for Housekeeping/Counter Service, etc. |
| Chart of Accounts | Pre-seeded F&B chart of accounts matching §6.3 simplified structure |
| Report Line Config | Pre-seeded mapping table for Trial Balance, P&L, Balance Sheet groupings |
| Design System Source | A `DESIGN.md` in the project root reflecting the approved visual design (from Stitch export, Claude-curated, or hybrid). If using Stitch, also document the Stitch project ID in `project-context.md`. |

---

*End of Document · F&B ERP Master Architecture & Requirements · v1.2 · April 2026*

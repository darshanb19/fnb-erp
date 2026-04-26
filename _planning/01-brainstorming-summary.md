# Brainstorming Summary: F&B ERP System

**Date:** February 24, 2026
**Participants:** Product Owner (Solo Developer) + AI Assistant
**Status:** Ready for Product Requirements Phase

---

## 1. Project Overview

### What We're Building

A comprehensive Enterprise Resource Planning (ERP) system specifically designed for multi-location Food & Beverage organizations. The system centralizes and streamlines critical operational processes including inventory management, procurement, production planning, recipe management, distribution, accounting, and HR across all locations.

### Core Domain Model

The system is built around a hierarchical organizational structure:

```
Brand (Tenant)
├── Brand Store (central raw material storage)
├── Cluster A
│   ├── Cluster Store A (intermediate raw material storage)
│   ├── Central Kitchen A
│   │   ├── Production Departments (Pastry, Bakery, Pantry, etc.)
│   │   └── Non-Production Departments (Dispatch, Packaging, QC, etc.)
│   └── POS Locations (AA, AB, AC)
│       ├── Production Departments (Hot Kitchen, Service Bar)
│       └── Non-Production Departments (Counter Service, Housekeeping)
└── Cluster B
    ├── Cluster Store B
    ├── Central Kitchen B
    └── POS Locations (BA, BB)
```

### Key Domain Concepts

- **Stores** = Raw material storage spaces (not retail outlets). Exist at Brand and Cluster levels only.
- **Material Enablement** = Raw materials must be "enabled" for a department before they can be used there. This is a domain-specific access control layer on top of RBAC.
- **Three Product Types** with distinct flow rules:
  - **Raw Materials**: Flow downward (Brand Store → Cluster Store → Department)
  - **Semi-Products**: Can transfer laterally within a cluster between enabled departments
  - **Final Products**: Flow from Production → Dispatch → POS Counter Service
- **Yield Factors**: Variable conversion rates (e.g., 100kg tomatoes at 0.85 yield = 85kg usable) that cascade through recipe costing.

---

## 2. Strategic Decisions

### Deployment Strategy

- **MVP**: Single-tenant (one brand/organization)
- **Architecture**: Designed for multi-tenant migration from day one (`tenant_id` patterns, RLS-ready schema)
- **Migration Path**: Single-tenant → multi-tenant SaaS when product-market fit is validated

### Development Context

- **Solo developer, AI-assisted** (Claude Code + MCP servers)
- **Implementation**: Sprint-based, epic-by-epic execution

### MVP Scope Philosophy: "Mile Wide, Inch Deep"

All modules present in MVP but at core-workflow depth. Features deepen iteratively post-launch.

#### Tier 1 — Deep Build (Competitive Advantage)

- **Master Data Management** — Foundation everything depends on. Hierarchical structure, material enablement, UOM conversions, product registration must be solid.
- **Inventory & Procurement** — Core material flow, stock tracking, POs, goods receipt, transfer management, yield factor handling, PAR levels.
- **Recipe Management** — Recipe CRUD, ingredients, costing, versioning (2+ versions with default), scaling, sub-recipes with cost roll-ups.

#### Tier 2 — Functional but Lean

- **Production Planning** — Production orders driven by recipes, raw material deduction, basic scheduling. No ML forecasting or weather modeling.
- **Dispatch & Distribution** — Internal challans, dispatch-to-POS workflow, delivery confirmation, closing inventory with variance calculation. No route optimization or GPS.
- **Accounting & Financial** — Automated journal entries from operational transactions, basic ledger views, daily sales report capture, integration hooks for external accounting software. Not a full double-entry system with GAAP compliance.

#### Tier 3 — Minimal Viable

- **HRMS** — Employee records, basic attendance, shift creation and assignment. No payroll calculation or performance management.
- **POS Integration** — Menu item mapping to recipes, sales data import via API, inventory impact from sales. Integration layer, not a POS replacement.

#### Deferred Post-MVP

- Quality Assurance module (full), Waste Management & Sustainability, CRM, Equipment Management, Compliance & Documentation, dedicated Mobile Apps

---

## 3. Feature Enhancements (All Incorporated)

These features were identified during brainstorming as additions to the original requirements document. All are scoped for inclusion, with depth following the mile-wide-inch-deep philosophy.

### Shared Infrastructure (Build Early)

#### 3.1 Unified Approval Engine

Centralized approval system used by all modules instead of per-module approval logic.

- Configurable approval chains with threshold-based routing
- Delegation rules for unavailable approvers
- Unified approval inbox across all modules
- Bulk approval capabilities
- Mobile-first approval flow (push notification → review → approve)

#### 3.2 Notification & Alert Center

Centralized notification architecture replacing per-module notification logic.

- User-configurable notification preferences (channels: in-app, email, SMS, WhatsApp, push)
- Smart notification batching (daily digests for non-urgent items)
- Escalation chains with timeout-based escalation
- Rules engine for custom alert conditions
- Quiet hours / do-not-disturb scheduling

#### 3.3 Audit Trail & Activity Log

Comprehensive, tamper-evident logging as a first-class feature.

- Who changed what, when, and why — across all entities
- Before/after snapshots for every change
- Activity timeline per entity (chronological history view)
- Compliance-ready exports
- Tamper-evident logging for financial transactions

### Intelligence & Analytics Features

#### 3.4 Expiry & Shelf-Life Intelligence

- Expiry countdown dashboards (24h/48h/72h urgency bands)
- Auto-prioritization in production (prefer ingredients closer to expiry — FEFO at production level)
- Expiry-based cross-location transfer suggestions
- Shelf-life acceptance rules at goods receipt
- Expiry write-off automation with approval workflow

#### 3.5 Inter-Module Smart Suggestions

Rule-based (not ML) intelligent suggestions:

- Proactive purchase order suggestions based on production plans and inventory
- Recipe cost alerts when food cost exceeds category target
- Unusual activity detection (wastage spikes, vendor price jumps)
- Seasonal preparation suggestions from historical data
- PAR level drift detection and update recommendations

#### 3.6 Food Cost Control Center

Dedicated analytical feature set:

- Theoretical vs. actual food cost per item sold
- Menu engineering matrix (Stars, Puzzles, Plowhorses, Dogs classification)
- Price sensitivity modeling
- Vendor price tracking over time with spike alerts
- Real-time cost per serving tracker as ingredient prices change

### UX & Workflow Enhancements

#### 3.7 Dashboard Personalization

- Widget-based customizable dashboards (drag and drop)
- Role-based default dashboard configurations
- Pinned quick actions per role
- Morning briefing view ("What do I need to know right now?")

#### 3.8 Quick Entry Modes

Critical for user adoption — F&B staff are busy:

- Barcode/QR scan-first workflows (context-aware: scan → detect workflow → present right form)
- Voice-to-entry for kitchen environments
- Batch data entry screens (e.g., closing inventory: all items in scrollable list)
- Smart defaults (pre-fill from yesterday's values or PAR levels)
- Offline queue with sync-on-reconnect

#### 3.9 Communication Hub

- Location-to-location messaging
- Contextual messaging attached to POs, production orders, transfers
- Broadcast announcements (Brand → all locations)
- Digital shift handover notes

#### 3.10 Document & SOP Management

- SOPs linked to workflows (tap "View SOP" during goods receipt)
- Version-controlled documents with acknowledgment tracking
- Templated checklists (opening, closing, cleaning, pre-use) with photo evidence

### Financial & Vendor Enhancements

#### 3.11 Multi-Currency & India-Specific Tax

- GST compliance: CGST, SGST, IGST calculation
- HSN code mapping with automatic tax rate derivation
- GST return data preparation (GSTR-1, GSTR-3B)
- TDS management for vendor payments
- E-invoicing and e-way bill generation

#### 3.12 Vendor Comparison & Market Intelligence

- Side-by-side vendor comparison per item
- Historical price trends by vendor
- Auto-suggest best vendor (price + quality + reliability + terms)
- Rate contract management with expiry alerts

### Safety & Data Integrity

#### 3.13 Data Validation & Error Prevention

- Impossible quantity detection
- Duplicate entry prevention
- Cross-module consistency checks (deactivated raw material in active recipe → flag)
- Undo/reverse capabilities for accidental entries
- Mandatory reason codes for adjustments, variances, exceptions

#### 3.14 Backup & Data Recovery

- Point-in-time inventory state recovery
- Transaction replay for reconciliation
- Full data export (CSV, JSON) for portability

---

## 4. Tech Stack (Finalized)

### Frontend

| Technology | Purpose |
|---|---|
| **React 18+ (TypeScript)** | UI framework |
| **Tailwind CSS** | Utility-first styling |
| **shadcn/ui + Radix** | Component library (accessible primitives, full ownership) |
| **Inter** | Font family |
| **TanStack Table** | Data grids and complex tables |
| **TanStack Query** | Server state management and caching |
| **React Hook Form + Zod** | Form management and validation |
| **Zustand** | Client state management |
| **Recharts or Nivo** | Charts and data visualization |

### Backend

| Technology | Purpose |
|---|---|
| **Node.js + Express.js (TypeScript)** | API server and business logic orchestration |
| **Supabase (PostgreSQL)** | Database (hosted, managed) |
| **Supabase Auth** | Authentication (email/password, SSO later) |
| **Supabase RLS** | Row-level security for future multi-tenant isolation |
| **Supabase Realtime** | Real-time subscriptions (inventory updates, notifications) |
| **Supabase Storage** | File storage (documents, images) |
| **Drizzle ORM** | Type-safe database access (chosen over Prisma) |

### Architecture Principles

- **TypeScript end-to-end** — shared types between frontend and backend
- **Supabase as database + auth + realtime layer** — Express.js handles business logic, not edge functions
- **REST API design** — for this domain, REST is more appropriate than GraphQL
- **Single-tenant now, multi-tenant ready** — `brand_id`, `cluster_id`, `location_id`, `department_id` as foreign keys throughout; RLS policies prepared for multi-tenant switch
- **Monorepo** — shared types, unified deployment, simplified dependency management

### Infrastructure

| Technology | Purpose |
|---|---|
| **Vercel** | Frontend deployment |
| **Railway / Render / Fly.io** | Backend deployment (TBD in architecture phase) |
| **Supabase** | Managed PostgreSQL + services |
| **GitHub** | Version control |
| **GitHub Actions** | CI/CD (linting, type-checking, tests) |

### Development Tooling

| Tool | Purpose |
|---|---|
| **Claude Code** | AI-assisted development IDE |
| **Context7 MCP / plugin** | Library documentation access |
| **Supabase MCP / plugin** | Database management from IDE |
| **Playwright MCP / plugin** | E2E testing automation |
| **Sentry** | Error tracking and monitoring |
| **Chrome MCP** | Browser testing/debugging |

### UI Design Tooling — Decision Deferred

The UI design tool will be selected at the start of frontend work (Phase 2c). Two pre-validated options:

| Option | Description |
|---|---|
| **Google Stitch** | AI-powered UI design tool from Google Labs (Gemini 2.5 Pro). Generates high-fidelity screen designs from natural-language prompts and exports a `DESIGN.md` plus HTML/CSS. Connects to Claude Code via the `stitch-mcp` MCP server (OAuth via Google Cloud). Strong for full-screen visual exploration. |
| **Claude (Imagine / Artifacts)** | Use Claude itself — via Artifacts in Claude.ai or directly inside Claude Code — to generate React components and visual layouts. No external tool, no API setup. Strong for component-level iteration once `DESIGN.md` and the shadcn/ui base are in place. |

A **hybrid approach** is the expected default: Stitch for the initial design system and full-screen explorations, then Claude for component-level work. The design tokens live in `DESIGN.md` regardless of which tool generated them — this is non-negotiable.

---

## 5. Module Dependency & Implementation Sequence

```
Epic 1: Master Data Management (foundation)
    ↓
Epic 2: User Management & Security (RBAC + hierarchy + approval engine)
    ↓
Epic 3: Shared Infrastructure (notifications, audit trail)
    ↓
Epic 4: Inventory Management (needs master data for items, locations, departments)
    ↓
Epic 5: Procurement (needs inventory to receive into)
    ↓
Epic 6: Recipe Management (needs raw materials from inventory)
    ↓
Epic 7: Production Planning (needs recipes + inventory)
    ↓
Epic 8: Dispatch & Distribution (needs production output)
    ↓
Epic 9: POS Integration (needs dispatch to receive from)
    ↓
Epic 10: Accounting & Financial (hooks into all transaction-producing modules)
    ↓
Epic 11: HRMS (relatively independent, can parallel with later epics)
    ↓
Epic 12: Analytics & Reporting (cross-module dashboards, food cost control center)
```

Note: The shared infrastructure (approval engine, notifications, audit trail) should be built as a dedicated early epic so all subsequent modules can use it.

---

## 6. Project Process Plan

### Phase 1: Discovery & Analysis ✅

- Brainstorming: **Complete** (this document)
- Master specification: **Complete**
- Supplementary specs (B2B Challan): **Complete**

### Phase 2: Planning

- PRD creation using master specification + this brainstorming summary as input
- Screen inventory for core workflows (inventory receipt, recipe creation, production order, dispatch flow, dashboard)
- Visual design generation via the chosen UI tool (Stitch / Claude / hybrid) — produces `DESIGN.md`

### Phase 3: Solutioning

- Architecture document (database schema patterns, API design, hierarchical data model, material enablement system, module communication)
- Epics and Stories (estimated 10–12 epics, each with 10–30 stories)
- Implementation Readiness Check

### Phase 4: Implementation

- Sprint-based execution, one epic at a time
- Each story: created → implemented → code-reviewed → QA'd
- MCP servers active throughout for development acceleration

> **Methodology layer:** Whatever AI-assisted development methodology is chosen for execution (Superpowers, BMAD, custom workflow, or none) sits *on top* of this phase plan. The phase ordering, gating rules, and reference-file conventions in this document are the canonical ground truth.

---

## 7. Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Scope overwhelming for solo developer | Mile-wide-inch-deep approach; strict epic sequencing; defer non-essential modules |
| Complex business logic in recipes/inventory | Build Tier 1 modules first with thorough testing; recipe cost roll-ups and yield cascading get dedicated attention |
| Multi-tenant migration later causes rework | Design schema with tenant isolation patterns from day one; RLS policies defined early even if not enforced |
| User adoption resistance (F&B staff unfamiliar with ERP) | Quick entry modes, smart defaults, barcode scanning, mobile-first approval — reduce friction at every touch point |
| Data integrity across material movements | Enforce enablement rules and stock movement rules in business logic layer, not just UI validation |
| India-specific tax complexity (GST, TDS, e-invoicing) | Build accounting hooks early; integrate with established GST libraries rather than building from scratch |

---

## 8. Open Questions for Architecture Phase

1. **ORM Choice**: ✅ RESOLVED — Drizzle. (Drizzle offers more SQL control, important for complex inventory queries.)
2. **Monorepo Tooling**: Turborepo vs Nx vs pnpm workspaces — affects project structure setup.
3. **Real-time Strategy**: Which events need WebSocket real-time updates vs. polling vs. optimistic UI? Not everything needs to be real-time.
4. **Offline Capability Depth**: Core for MVP or deferred? If core, which specific workflows need offline support?
5. **File/Report Generation**: PDF generation for challans, invoices, POs — library choice (e.g., react-pdf, puppeteer, server-side rendering).
6. **Search Strategy**: Full-text search across entities — PostgreSQL built-in vs. dedicated search (Meilisearch, Typesense)?
7. **Background Jobs**: For batch operations, report generation, notification processing — BullMQ, Inngest, or Supabase Edge Functions with `pg_cron`?
8. **Caching Layer**: Redis for frequently accessed data (PAR levels, active recipes, org hierarchy) or rely on TanStack Query client-side caching?
9. **UI Design Tool**: Google Stitch vs Claude Imagine/Artifacts vs hybrid (see §4). Decision can be made at the start of Phase 2c.

---

## 9. Conflict Prevention & Development Discipline

A comprehensive strategy for preventing AI-agent conflicts, assumption-based errors, and context drift across the entire SDLC. This is critical for a solo developer running multiple AI agents across months of work on a 10–12 epic project.

### 9.1 Multi-Layer Context Management

Each layer ensures AI agents have the right information at the right scope:

| Layer | File / Tool | Purpose | Updated When |
|---|---|---|---|
| **Session-level** | `CLAUDE.md` | Claude Code reads this every session — critical rules, file structure pointers, "never do X" rules | Anytime a new global rule is discovered; use `#` command in Claude Code for quick additions |
| **Workflow-level** | `project-context.md` | Loaded during every implementation workflow — tech stack, patterns, conventions | After every epic (during retrospective); after significant architecture changes |
| **Architecture-level** | `architecture.md` + ADRs | Cross-epic technical decisions, full database schema, API contracts, naming conventions | During architecture phase; via formal change-request process when changes are needed |
| **Story-level** | Detailed Given/When/Then acceptance criteria | Reduces micro-decision ambiguity per story | During story creation |
| **Epic-level** | Retrospective artifacts + `project-context.md` updates | Captures emergent patterns after each epic | After each epic |
| **Tool-level** | MCP servers (Supabase, Context7) | Agents access real project state (live schema, library docs), not assumptions | Configured during project setup; maintained throughout |
| **Recovery** | Git commits per story + formal change-request workflow | Clean rollback points and formal plan-update process | After every story (commit); when plan changes are needed |
| **Reference** | `codebase-inventory.md` | Plain-English map of every folder and file — agents consult this instead of scanning the full codebase | After each epic; maintained manually or by a documenting agent |
| **Decisions** | `decision-log.md` | Append-only log of micro-decisions during implementation that aren't big enough for ADRs | During implementation, whenever a pattern-setting decision is made |
| **Enforcement** | Hookify rules | Automated hooks that block or warn on violations of project rules (e.g., no `any` types, no raw SQL, require `brand_id` filtering). Unlike text-based rules, these fire automatically and physically prevent violations. | After architecture phase; new rules added as patterns emerge |

### 9.2 `CLAUDE.md` — Claude Code Global Brain

This file is read by Claude Code at the start of every session. It serves as the absolute authority for Claude Code behavior on this project.

Recommended structure:

```markdown
# Project: F&B ERP System

## Critical Rules
- Always read _planning/project-context.md before implementing anything
- Always read the relevant story file completely before starting work
- Never modify database schema without checking architecture.md
- Use existing patterns from the codebase — check similar modules before creating new patterns
- All API endpoints follow REST conventions defined in architecture.md
- TypeScript strict mode — no `any` types
- Every database query must include proper tenant isolation (brand_id filtering)
- If instructions are vague or ambiguous, push back and ask clarifying questions before proceeding
- When uncertain about an approach, check decision-log.md before inventing a new pattern

## Context Management
- Monitor context usage with /context during long story implementations
- If approaching 60-70% context usage, STOP — the story is too big. Commit progress, start fresh chat or split the story.
- Do NOT use /compact during story implementation — it loses nuanced context and causes conflicting edits
- Use /rewind to checkpoint-revert when code is functionally correct but structurally flawed

## File Structure
[populated during architecture phase]

## Key Reference Files
- Architecture: _planning/architecture.md
- Project Context: _planning/project-context.md
- Sprint Status: _planning/sprint-status.yaml
- Codebase Inventory: codebase-inventory.md
- Decision Log: decision-log.md
- Design System: DESIGN.md

## Tooling Notes
- Hookify rules are active — they automatically block/warn on violations. Do not try to bypass them.
- typescript-lsp provides real-time type checking — fix type errors immediately, don't suppress them.
- security-guidance hook will warn about potential vulnerabilities — always address these warnings.
- Use the Supabase plugin for database operations — never guess at schema, query the actual database.
```

### 9.3 Identified Risks and Specific Mitigations

#### Agent Context Drift

When each implementation workflow runs in a fresh chat, the agent implementing Story 47 has no memory of decisions made during Story 12.

- `project-context.md` is loaded at the start of every implementation workflow — keep it current.
- ADRs in the architecture document capture all significant technical decisions with rationale.
- Code review after every story catches pattern violations before they compound.
- `decision-log.md` captures micro-decisions that fall below ADR threshold.

#### Schema & API Divergence Across Epics

Multiple epics reference the same database tables and API endpoints. Without locked-down contracts, each epic may make incompatible assumptions.

- The architecture phase must define the **full database schema** across ALL modules — at least core tables, relationships, and naming conventions.
- API contract documentation — endpoint patterns, request/response shapes, error handling conventions defined once.
- Shared TypeScript types in a monorepo `packages/shared` directory — agents import types, never reinvent.
- **Module Interface Contracts** — before implementing any module, define its "public API" (functions/endpoints other modules will call).

#### Story Ambiguity Leading to Assumptions

Every unspecified detail in a story is a decision the agent makes on its own, which may conflict with another story.

- Stories must have very specific Given/When/Then acceptance criteria.
- Business rules document within architecture explicitly covers domain rules (e.g., "A GR can reference multiple POs. A PO can have multiple GRs.")
- An implementation-readiness check validates story–architecture–PRD cohesion before implementation begins.

#### Incremental Decisions Not Captured

During implementation, decisions emerge that aren't in any planning document. If uncaptured, future stories may implement differently.

- Update `project-context.md` after every epic.
- Run an epic retrospective after each epic to capture lessons learned.
- Use a formal change-request workflow for mid-implementation discoveries that require plan changes — don't just code around it.

---

## 10. Claude Code Best Practices

A small set of practices that improve quality and prevent common failure modes when using Claude Code as the primary development tool.

### 10.1 Global Brain — `CLAUDE.md` with `#` Command

Use the `#` command in Claude Code to instantly append rules to `CLAUDE.md` during development sessions. When you discover a pattern mid-implementation:

```
# Always use the inventoryService for stock movements, never direct DB queries
```

### 10.2 Checkpoint Reverts with `/rewind`

Use `/rewind` to roll back to a prior checkpoint when the AI produces code that is functionally correct but structurally flawed or unscalable. This is the quick-recovery mechanism for within-session mistakes. Combined with git commits per story for cross-session recovery.

**Rule of thumb:** If you're about to say "that works but I don't like how it's structured" — revert and re-prompt with clearer structural guidance rather than asking the agent to refactor in-place.

### 10.3 Context Monitoring with `/context`

Monitor context usage with `/context` during long story implementations. If approaching 60–70% usage, **this means the story is too large** — do NOT compact.

Instead: commit current progress, then either start a fresh chat pointing at the story file and committed code, or split the remaining work into a new story.

`/compact` loses nuanced implementation context (exact changes, reasoning, file relationships) and can cause the agent to make conflicting edits post-compaction. Avoid during story implementation.

**The rule: High context usage is a story-sizing problem, not a context-management problem.**

### 10.4 Codebase Inventory

As the codebase grows across 10+ epics, maintaining a `codebase-inventory.md` that maps the project structure in plain English saves significant time. Agents consult this for navigation instead of scanning millions of lines.

- Generate an initial inventory after Epic 1.
- Update during each epic's retrospective.
- Store at project root for universal accessibility.
- Add to `CLAUDE.md`'s key reference files.

### 10.5 MCP & Plugin Configuration

Most external tools are now handled via Claude Code plugins rather than manual MCP configuration (see §11). For services without plugins, define them in `.mcp.json`:

```json
{
  "mcpServers": {
    "chrome-mcp": { ... },
    "sentry": { ... }
  }
}
```

**Rule:** If a service is available as both a plugin and an MCP server, use the plugin. Never configure both — it creates duplicate tool registrations.

### 10.6 Pushback Rule

Add an explicit pushback rule to `CLAUDE.md`:

```
If instructions are vague or ambiguous, push back and ask clarifying questions before proceeding.
```

This prevents the AI from silently filling in gaps with assumptions.

---

## 11. Additional Development Practices

Practices essential for a project of this scale and complexity.

### 11.1 Module Interface Contracts

Before implementing any module, define its "public API" — the functions and endpoints that other modules will call. Even if internal implementation changes, the contract stays stable.

Example for Inventory Module:

```typescript
// Other modules call these — contract is stable
inventoryService.getAvailableStock(itemId, departmentId): Promise<StockLevel>
inventoryService.deductStock(itemId, departmentId, quantity, reason): Promise<DeductionResult>
inventoryService.checkEnablement(itemId, departmentId): Promise<boolean>
```

This prevents the scenario where Epic 7 (Production) calls an inventory function that Epic 4 implemented, but a later story in Epic 4 refactors the function signature.

### 11.2 Seed Data Strategy

Define test/seed data early that covers the full organizational hierarchy with realistic F&B scenarios:

- At least 1 Brand, 2 Clusters, 2 Central Kitchens, 4 POS locations
- Departments per location matching the requirements document
- Sample raw materials, semi-products, and final products with enablement mappings
- Sample recipes with sub-recipes, yield factors, and multiple versions
- Sample vendors with price lists

Every story's developer tests against this consistent dataset. This prevents "works in isolation, breaks in integration" problems.

### 11.3 Error Handling Convention

Define once during architecture, use everywhere:

- Standard error response format (error code, message, details, timestamp)
- Error categorization (validation, authorization, not-found, business-rule-violation, system)
- Logging structure (what to log, at what level, with what context)
- Client-side error display patterns

This prevents each module from inventing its own error approach.

### 11.4 Decision Log

A simple append-only markdown file (`decision-log.md`) for micro-decisions during implementation:

```markdown
## 2026-03-15 | Epic 4, Story 4.3 | Stock Movement Validation

**Decision:** Use database triggers (not application middleware) for audit logging of stock movements.
**Reason:** Ensures audit trail even for direct DB operations or future bulk imports.
**Alternatives considered:** Application-level middleware — rejected because it can be bypassed.
**Affects:** All future modules that produce auditable transactions should follow this pattern.
```

These are decisions too small for ADRs but important enough that a future story's agent needs to know about them.

### 11.5 Post-Epic Checklist

After completing each epic, before moving to the next:

1. Run an epic retrospective.
2. Update `project-context.md` with new patterns and conventions.
3. Update `codebase-inventory.md` with new files and modules.
4. Review and update `decision-log.md` for completeness.
5. Verify all module interface contracts are still accurate.
6. Review hookify rules — add new rules for patterns discovered during the epic, disable any that are no longer relevant.
7. Run full test suite to confirm no cross-module regressions.
8. Git tag the epic completion point (e.g., `epic-4-inventory-complete`).

---

## 12. Claude Code Plugins & MCP Tooling Plan

### 12.1 Plugins vs MCPs — How They Relate

Plugins and MCPs are **complementary, not competing**. A plugin is a container format that can include slash commands, agents, hooks, skills, AND MCP servers. An MCP server is specifically a tool integration protocol. Some plugins wrap MCP servers (e.g., the Supabase plugin includes the Supabase MCP), others don't use MCP at all (e.g., hookify is pure hooks).

**Critical rule:** Never configure the same MCP server both via a plugin AND via manual `.mcp.json` — that creates duplicate tool registrations. Pick one path per service.

### 12.2 Plugin Sources

Two official sources exist:

| Source | Repository | Contents |
|---|---|---|
| **Demo/Bundled Plugins** | `anthropics/claude-code` (plugins directory) | Plugins built by Anthropic — workflow tools, hooks, skills |
| **Official Marketplace** | `anthropics/claude-plugins-official` | LSP integrations, external service connectors |

Install demo plugins: `/plugin install {name}@anthropics/claude-code`
Browse marketplace: `/plugin > Discover`

### 12.3 Plugins to Install

#### Essential — Install During Project Setup

| Plugin | Source | Purpose |
|---|---|---|
| **Superpowers** | Official Marketplace ([claude.com/plugins/superpowers](https://claude.com/plugins/superpowers)) | Methodology framework — TDD, systematic debugging, brainstorming, subagent-driven development with bundled code-reviewer agent, skill authoring. Slash commands: `/brainstorming`, `/execute-plan`, etc. The development methodology layer for this project. |
| **typescript-lsp** | Official Marketplace | Real-time type checking against actual project types. Claude sees type errors immediately and self-corrects. Critical for a TypeScript monorepo with shared types. |
| **security-guidance** | Demo | PreToolUse hook that warns about security issues (SQL injection, XSS, hardcoded credentials) as Claude writes code. Essential for an ERP handling financial data. |
| **hookify** | Demo | Create custom hooks via natural language without editing JSON. Enables automated enforcement of project rules. |
| **frontend-design** | Demo | Auto-activating skill for frontend work. Provides guidance on design quality, typography, animations. Helps produce higher-quality UI with shadcn/ui + Tailwind. |
| **commit-commands** | Demo | Git workflow commands with conventional commit message generation. Clean commit messages after each story. |
| **Context7** | Official Marketplace | Current documentation for React, Supabase, Drizzle, shadcn/ui, Tailwind. **Replaces manual Context7 MCP config.** |
| **GitHub** | Official Marketplace | Direct PR management, issue creation, branch management from Claude Code. |

#### Install After Specific Milestones

| Plugin | Source | Install When | Purpose | Replaces MCP? |
|---|---|---|---|---|
| **Supabase** | Official Marketplace | After DB schema created (architecture phase) | Live database schema access, query testing, migration verification. | **Yes — use plugin instead of manual Supabase MCP** |
| **Playwright** | Official Marketplace | After first frontend epic | Browser automation, screenshots, E2E testing. | **Yes — use plugin instead of manual Playwright MCP** |

#### Install If Choosing Google Stitch for UI Design

| Plugin / MCP | Install When | Purpose |
|---|---|---|
| **stitch-mcp** (manual MCP) | Phase 2c, if Stitch is chosen as the UI design tool | Fetch screen designs from Stitch into Claude Code without manual copy-paste. Setup requires Google Cloud OAuth (`gcloud auth application-default login`). |

If using Claude Imagine / Artifacts as the UI design path, no additional plugin is needed — Claude generates components directly inside Claude Code or Claude.ai.

#### MCP-Only (No Plugin Available)

| MCP Server | Configure When | Purpose |
|---|---|---|
| **Chrome MCP** | After first frontend epic | Visual UI auditing — agent opens localhost and verifies rendering |
| **Sentry** | During project setup | Error tracking and performance monitoring from day one |

### 12.4 Plugins Not Needed (Just Irrelevant)

| Plugin | Reason to Skip |
|---|---|
| **plugin-dev** | For building custom plugins. We're building an ERP, not plugins. |
| **agent-sdk-dev** | For building Agent SDK applications. Not relevant. |
| **pyright-lsp, rust-analyzer-lsp, gopls-lsp, etc.** | Wrong languages. TypeScript LSP only. |
| **Firebase** | We use Supabase, not Firebase. |
| **Stripe** | No payment processing in MVP. |
| **Laravel Boost** | Wrong framework. |
| **Slack** | Solo developer, no team Slack. |
| **GitLab** | We use GitHub. |
| **Linear / Asana** | Sprint status tracked in `sprint-status.yaml`. Unnecessary unless an external PM tool is adopted. |

> **Note on multi-agent code-review plugins (e.g., `code-review`, `pr-review-toolkit`):** These deploy multiple parallel review agents at the PR level. Superpowers already bundles a code-reviewer agent that operates at the story/plan level via `/execute-plan` checkpoints — adding a second PR-level reviewer plugin is likely redundant for this project. Evaluate post-MVP only if PR-level review proves insufficient.

### 12.5 Conditional — Evaluate Later

| Plugin | Evaluate When | Purpose |
|---|---|---|
| **Greptile** | Post-Epic 5 (large codebase) | Natural language codebase search. May be redundant if `codebase-inventory.md` is sufficient. |
| **Serena** | After 3+ modules implemented | Semantic code analysis for cross-module impact analysis. |

### 12.6 Custom Hookify Rules

After installing hookify, create these project-specific enforcement rules:

```bash
# TypeScript quality
/hookify Block usage of TypeScript 'any' type in non-test files
/hookify Warn when console.log is found in non-test TypeScript files

# Database & security
/hookify Warn when database query doesn't include brand_id filter
/hookify Block raw SQL queries — use the ORM
/hookify Block hardcoded API keys, secrets, or credentials in source files

# Architecture compliance
/hookify Warn when a new API endpoint doesn't follow REST naming convention from architecture.md
/hookify Warn when a new file doesn't follow the established directory structure
```

These hookify rules serve as **automated enforcement** of `CLAUDE.md` and `project-context.md` rules. Unlike text-based rules that rely on the agent *remembering* them, hooks fire automatically before or after tool use and physically block or warn on violations.

### 12.7 Complete Tooling Setup Sequence

| Step | Timing | Actions |
|---|---|---|
| **1** | Project setup | Install plugins: `Superpowers`, `typescript-lsp`, `security-guidance`, `hookify`, `frontend-design`, `commit-commands`, `Context7`, `GitHub` |
| **2** | Project setup | Configure MCPs: `Sentry`, `Chrome MCP` |
| **3** | After architecture | Install plugin: `Supabase` (after DB schema is defined) |
| **4** | After architecture | Create custom hookify rules (once coding conventions are established) |
| **5** | Phase 2c (UI design) | If using Google Stitch: install `stitch-mcp` and authenticate via Google Cloud. If using Claude Imagine: no setup needed. |
| **6** | After first frontend epic | Install plugin: `Playwright`. Configure MCP: `Chrome MCP` |
| **7** | Ongoing | Add new hookify rules as patterns emerge during implementation |
| **8** | Post-Epic 5+ | Evaluate: `Greptile`, `Serena` based on codebase size and complexity |

---

*This document serves as the primary input for the PRD and architecture phases. All decisions, feature enhancements, conflict-prevention strategies, plugin evaluations, and development practices recorded here have been agreed upon by the product owner. The phase plan and rules are methodology-agnostic — any AI-assisted development methodology (Superpowers, BMAD, custom workflow, or none) can be layered on top.*

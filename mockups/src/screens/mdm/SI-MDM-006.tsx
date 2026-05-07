import { Card, CardContent, CardHeader, CardTitle } from '@/shell'

/**
 * SI-MDM-006 — Category & Sub-Category Management.
 *
 * Index-only stub per DL-025. Phase 4 Epic 1 Arc (b).
 *
 * Why a stub: the two-level category hierarchy (category -> sub-category) is
 * generic, and the per-product assignment surface is already shipped at
 * SI-MDM-003 (Product Master) where products map many-to-many to categories
 * via the `product_categories` join (FR7). DL-025 (decision-log.md lines
 * 664-687) tags SI-MDM-006 as Index-only — render the inventory entry's
 * schema fields verbatim with no interactive surface. The full CRUD UI is
 * deferred; the primary surface for managing category-product mapping is
 * SI-MDM-003's inline assignment.
 *
 * Tier: Index-only (NOT Tier 2). No filters, no tables, no buttons, no
 * useState, no Popovers. Pure layout — a single Card holding a definition
 * list of the 12 inventory schema fields verbatim from
 * `_planning/05-screen-inventory.md` lines 507-551.
 *
 * Source FRs:
 *   - FR7 — categories and sub-categories with M:N mappings to products.
 *
 * Cross-cutting:
 *   - CC-AUDIT-LINK / CC-DRAFT-PILL: declared on the inventory entry but
 *     deliberately NOT rendered here. Index-only stubs avoid all interactive
 *     chrome; those cross-cuts attach to the real CRUD surface when it ships.
 *
 * Animation — NONE. Static text-only page.
 */
export default function SiMdm006() {
  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1024px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">
        {/* Page header strip */}
        <header>
          <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Master data · Categories · index-only stub
          </p>
          <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
            Category &amp; Sub-Category Management (SI-MDM-006)
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-on-surface-variant">
            Full mockup deferred; primary surface is SI-MDM-003 inline category
            assignment (DL-025).
          </p>
        </header>

        {/* Inventory schema panel — the page body */}
        <Card className="mt-6 p-0">
          <CardHeader className="p-4 tablet:p-6">
            <CardTitle className="text-base text-on-surface">
              Inventory schema
            </CardTitle>
            <p className="mt-1 text-xs text-on-surface-variant">
              The 12 canonical schema fields surfaced for SI-MDM-006 per
              _planning/05-screen-inventory.md lines 507-551 (Index-only tier,
              DL-025).
            </p>
          </CardHeader>
          <CardContent className="p-4 tablet:p-6 pt-0 tablet:pt-0">
            <dl className="grid grid-cols-1 tablet:grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  1 · Primary epic
                </dt>
                <dd className="mt-1 text-sm text-on-surface">
                  Epic 1 — Master Data Management
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  2 · Primary device
                </dt>
                <dd className="mt-1 text-sm text-on-surface">
                  responsive-equal
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  3 · Roles &amp; scope
                </dt>
                <dd className="mt-1 text-sm text-on-surface">
                  Brand Owner (scope: brand)
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  4 · Purpose
                </dt>
                <dd className="mt-1 text-sm text-on-surface">
                  Define and manage product categories and sub-categories;
                  assign many-to-many mappings between products and categories;
                  manage category metadata (description, ordering, active
                  status).
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  5 · Data displayed
                </dt>
                <dd className="mt-1 text-sm text-on-surface">
                  Category name, code (system-generated or user-assigned),
                  description, active status; sub-categories
                  (indented/nested list or separate rows linking to parent):
                  sub-category name, code, description, active status; product
                  count per category/sub-category; creation date, last modified
                  date; row action menu: edit, deactivate, view products in
                  category.
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  6 · User actions
                </dt>
                <dd className="mt-1 text-sm text-on-surface">
                  List all categories and sub-categories (tree or flat table);
                  create new category (form with name, code, description,
                  active flag); create sub-category under category (form with
                  name, code, parent-category selector, description); edit
                  category/sub-category metadata; deactivate
                  category/sub-category (soft-delete; blocks assignment to new
                  products); view all products in category (drill-down to
                  SI-MDM-003 filtered by category); reorder categories
                  (drag-and-drop or explicit order-number field) for display
                  priority.
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  7 · Cross-cutting
                </dt>
                <dd className="mt-1 text-sm text-on-surface">
                  CC-AUDIT-LINK, CC-DRAFT-PILL (if bulk editing).
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  8 · Tokens (DESIGN.md)
                </dt>
                <dd className="mt-1 text-sm text-on-surface">
                  surface, surface_container_lowest, on_surface,
                  on_surface_variant, status_confirmed, status_inactive
                  (deactivated category/sub-category pill), outline_variant.
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  9 · Source FRs
                </dt>
                <dd className="mt-1 text-sm text-on-surface">
                  FR7 (categories and sub-categories with M:N mappings to
                  products).
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  10 · Source journey(s)
                </dt>
                <dd className="mt-1 text-sm text-on-surface">
                  Store Manager — category-based requisition browsing; Kitchen
                  Manager — recipe categorisation (background master-data
                  dependency).
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  11 · Related screens
                </dt>
                <dd className="mt-1 text-sm text-on-surface">
                  sibling: SI-MDM-003 (product master; categories assigned
                  there), drill-down: SI-MDM-003 (products in category).
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                  12 · Notes
                </dt>
                <dd className="mt-1 text-sm text-on-surface">
                  Category and sub-category are two-level hierarchy; no deeper
                  nesting. Many-to-many mapping stored in `product_categories`
                  join table, managed from product-master form (SI-MDM-003).
                  Categories are brand-scoped (brand_id primary key). Category
                  names used in filter dropdowns across inventory, requisition,
                  and procurement screens. Soft-delete deactivates category
                  without deleting product mappings (orphaned products remain
                  but category hidden from UI).
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <p className="mt-6 text-xs text-on-surface-variant">
          This stub renders the inventory entry's schema fields verbatim per
          DL-025 (Index-only tier). The full UI implementation lives at
          SI-MDM-003 inline category assignment, where products are mapped
          many-to-many to categories via the `product_categories` join (FR7).
        </p>
      </div>
    </div>
  )
}

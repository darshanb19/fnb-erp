import { Routes, Route, Link } from 'react-router-dom'
import {
  Boxes,
  TriangleAlert,
  CalendarClock,
  PackagePlus,
  Inbox,
  ScrollText,
  type LucideIcon,
} from 'lucide-react'
import ComponentsIndex from '@/dev/ComponentsIndex'
import RequireAuth from '@/lib/RequireAuth'
import { AppShell } from '@/components/shell/AppShell'
import HierarchyPage from '@/pages/mdm/HierarchyPage'
import DepartmentsPage from '@/pages/mdm/DepartmentsPage'
import ProductsPage from '@/pages/mdm/ProductsPage'
import ProductsForm from '@/pages/mdm/ProductsForm'
import EnablementMatrixPage from '@/pages/mdm/EnablementMatrixPage'
import VendorsPage from '@/pages/mdm/VendorsPage'
import VendorsForm from '@/pages/mdm/VendorsForm'
import CategoriesPage from '@/pages/mdm/CategoriesPage'
import CompanyPage from '@/pages/mdm/CompanyPage'
import LoginPage from '@/pages/usr/LoginPage'
import PasswordResetPage from '@/pages/usr/PasswordResetPage'
import UsersPage from '@/pages/usr/UsersPage'
import UserCreateEditPage from '@/pages/usr/UserCreateEditPage'
import EffectivePermissionsPage from '@/pages/usr/EffectivePermissionsPage'
import PermissionOverridePage from '@/pages/usr/PermissionOverridePage'
import OverridesExpiringPage from '@/pages/usr/OverridesExpiringPage'
import AccountApprovalPage from '@/pages/usr/AccountApprovalPage'
import BroadcastsPage from '@/pages/inf/BroadcastsPage'
import BelowParPage from '@/pages/inv/BelowParPage'
import DepartmentStockDetailPage from '@/pages/inv/DepartmentStockDetailPage'
import ExpiryCountdownPage from '@/pages/inv/ExpiryCountdownPage'
import StockViewPage from '@/pages/inv/StockViewPage'
import TransferSuggestionsPage from '@/pages/inv/TransferSuggestionsPage'
import ClosingClusterReviewPage from '@/pages/inv/ClosingClusterReviewPage'
import ParLevelConfigPage from '@/pages/inv/ParLevelConfigPage'
import StockTransferCreatePage from '@/pages/inv/StockTransferCreatePage'
import InventoryAdjustmentPage from '@/pages/inv/InventoryAdjustmentPage'
import StockTransferDetailPage from '@/pages/inv/StockTransferDetailPage'
import PairedTransferPage from '@/pages/inv/PairedTransferPage'
import GoodsReceiptEntryPage from '@/pages/inv/GoodsReceiptEntryPage'
import GoodsReceiptTransferPage from '@/pages/inv/GoodsReceiptTransferPage'
import GoodsReceiptRejectPage from '@/pages/inv/GoodsReceiptRejectPage'
import ClosingCountPage from '@/pages/inv/ClosingCountPage'
import IssueTicketsListPage from '@/pages/inf/IssueTicketsListPage'
import IssueTicketFormPage from '@/pages/inf/IssueTicketFormPage'
import ApprovalInboxPage from '@/pages/inf/ApprovalInboxPage'
import ApprovalChainConfigPage from '@/pages/inf/ApprovalChainConfigPage'
import NotificationPreferencesPage from '@/pages/inf/NotificationPreferencesPage'
import NotificationDigestPage from '@/pages/inf/NotificationDigestPage'
import AuditTrailViewerPage from '@/pages/inf/AuditTrailViewerPage'
import RequirePermission from '@/lib/RequirePermission'
import { useSession } from '@/lib/auth'

/**
 * App — top-level router for the F&B ERP production web app.
 *
 * Structure:
 *   - Public (pre-auth) surfaces sit at the top level: /login, /reset-password,
 *     and the auth-free /_dev/components parity page.
 *   - Every authenticated screen is a CHILD of a single layout route that wraps
 *     <RequireAuth> around <AppShell>. AppShell renders the DESIGN.md §5.1.5
 *     cockpit (dark-teal sidebar + §5.4 top bar) and an <Outlet/> for the active
 *     screen — so the app chrome surrounds every page exactly once.
 *   - Per-screen <RequirePermission> guards (INF screens) are preserved.
 *
 * RBAC reminder: RequireAuth (authentication) is hoisted to the layout route;
 * RequirePermission (authorization) stays per-route where the original screen
 * required it.
 */
export default function App() {
  return (
    <Routes>
      {/* ---- Public / pre-auth surfaces ---- */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<PasswordResetPage />} />
      <Route path="/reset-password/:token" element={<PasswordResetPage />} />
      <Route path="/_dev/components" element={<ComponentsIndex />} />

      {/* ---- Authenticated app — wrapped once in RequireAuth + the cockpit shell ---- */}
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<HomePage />} />

        {/* MDM — Master Data */}
        <Route path="/mdm/hierarchy" element={<HierarchyPage />} />
        <Route path="/mdm/departments" element={<DepartmentsPage />} />
        {/* SI-MDM-003 Product Master */}
        <Route path="/mdm/products" element={<ProductsPage />} />
        <Route path="/mdm/products/new" element={<ProductsForm />} />
        <Route path="/mdm/products/:id/edit" element={<ProductsForm />} />
        {/* SI-MDM-004 Material Enablement Matrix */}
        <Route path="/mdm/enablement" element={<EnablementMatrixPage />} />
        {/* SI-MDM-005 Vendor Master */}
        <Route path="/mdm/vendors" element={<VendorsPage />} />
        <Route path="/mdm/vendors/new" element={<VendorsForm />} />
        <Route path="/mdm/vendors/:id/edit" element={<VendorsForm />} />
        {/* SI-MDM-006 Category & Sub-Category Management */}
        <Route path="/mdm/categories" element={<CategoriesPage />} />
        {/* SI-MDM-007 Company Registration & Fiscal Year */}
        <Route path="/mdm/company" element={<CompanyPage />} />

        {/* USR — Users & Auth */}
        {/* SI-USR-001 User List + SI-USR-002 User Create/Edit (Tier 1 hero on USR-002) */}
        <Route path="/users" element={<UsersPage />} />
        <Route path="/users/new" element={<UserCreateEditPage />} />
        <Route path="/users/:id/edit" element={<UserCreateEditPage />} />
        {/* SI-USR-005 Effective Permissions + SI-USR-006 Override mutate (Tier 1 hero on USR-006) */}
        <Route
          path="/users/:userId/effective-permissions"
          element={<EffectivePermissionsPage />}
        />
        <Route path="/users/:userId/overrides/grant" element={<PermissionOverridePage />} />
        <Route path="/users/:userId/overrides/revoke" element={<PermissionOverridePage />} />
        <Route
          path="/users/:userId/overrides/edit/:overrideId"
          element={<PermissionOverridePage />}
        />
        {/* SI-USR-007 Overrides Expiring Soon (Tier 2) */}
        <Route path="/users/overrides/expiring" element={<OverridesExpiringPage />} />
        {/* SI-USR-008 Brand Owner Account Approval (Tier 2, DL-030 route-only).
            RequireRole("superadmin") is wired inside the page; non-superadmin users see a 403 panel. */}
        <Route path="/users/approvals" element={<AccountApprovalPage />} />

        {/* INF — Infrastructure */}
        {/* SI-INF-007 Issue Ticket List + SI-INF-008 Issue Ticket Form */}
        <Route
          path="/issues"
          element={
            <RequirePermission
              permission="inf.issue.read"
              fallback={
                <div className="bg-surface min-h-full p-8">
                  <p className="text-sm text-on-surface">
                    You don&apos;t have permission to view this page.
                  </p>
                </div>
              }
            >
              <IssueTicketsListPage />
            </RequirePermission>
          }
        />
        <Route
          path="/issues/new"
          element={
            <RequirePermission
              permission="inf.issue.write"
              fallback={
                <div className="bg-surface min-h-full p-8">
                  <p className="text-sm text-on-surface">
                    You don&apos;t have permission to create tickets.
                  </p>
                </div>
              }
            >
              <IssueTicketFormPage />
            </RequirePermission>
          }
        />
        <Route
          path="/issues/:id"
          element={
            <RequirePermission
              permission="inf.issue.read"
              fallback={
                <div className="bg-surface min-h-full p-8">
                  <p className="text-sm text-on-surface">
                    You don&apos;t have permission to view this page.
                  </p>
                </div>
              }
            >
              <IssueTicketFormPage />
            </RequirePermission>
          }
        />
        {/* SI-INF-001 Approval Inbox (Tier 1 hero; DL-040 BO drill-through) */}
        <Route
          path="/approvals/inbox"
          element={
            <RequirePermission
              permission="inf.approval.read"
              fallback={
                <div className="bg-surface min-h-full p-8">
                  <p className="text-sm text-on-surface">
                    You don&apos;t have permission to view this page.
                  </p>
                </div>
              }
            >
              <ApprovalInboxPage />
            </RequirePermission>
          }
        />
        {/* SI-INF-002 Approval Chain Configuration (Tier 1 hero; DL-036 reason-code audit; BO-only) */}
        <Route
          path="/approvals/chains"
          element={
            <RequirePermission
              permission="inf.approval.configure_chains"
              fallback={
                <div className="bg-surface min-h-full p-8">
                  <p className="text-sm text-on-surface">
                    You don&apos;t have permission to view this page.
                  </p>
                </div>
              }
            >
              <ApprovalChainConfigPage />
            </RequirePermission>
          }
        />
        {/* SI-INF-003 Notification Preferences (Tier 2; DL-035 email greyed) */}
        <Route
          path="/notifications/preferences"
          element={
            <RequirePermission
              permission="inf.notification.read"
              fallback={
                <div className="bg-surface min-h-full p-8">
                  <p className="text-sm text-on-surface">
                    You don&apos;t have permission to view this page.
                  </p>
                </div>
              }
            >
              <NotificationPreferencesPage />
            </RequirePermission>
          }
        />
        {/* SI-INF-004 Notification Digest Preview (Tier 2; empty in MVP per DL-035) */}
        <Route
          path="/notifications/digest"
          element={
            <RequirePermission
              permission="inf.notification.read"
              fallback={
                <div className="bg-surface min-h-full p-8">
                  <p className="text-sm text-on-surface">
                    You don&apos;t have permission to view this page.
                  </p>
                </div>
              }
            >
              <NotificationDigestPage />
            </RequirePermission>
          }
        />
        {/* SI-INF-005 Audit Trail Viewer (Tier 1 hero; FR20 + FR24) */}
        <Route
          path="/audit"
          element={
            <RequirePermission
              permission="inf.audit.read"
              fallback={
                <div className="bg-surface min-h-full p-8">
                  <p className="text-sm text-on-surface">
                    You don&apos;t have permission to view this page.
                  </p>
                </div>
              }
            >
              <AuditTrailViewerPage />
            </RequirePermission>
          }
        />
        {/* SI-INF-009 Broadcasts (Tier 2; BO composer + history + BroadcastBanner) */}
        <Route
          path="/broadcasts"
          element={
            <RequirePermission
              permission="inf.broadcast.read"
              fallback={
                <div className="bg-surface min-h-full p-8">
                  <p className="text-sm text-on-surface">
                    You don&apos;t have permission to view broadcasts.
                  </p>
                </div>
              }
            >
              <BroadcastsPage />
            </RequirePermission>
          }
        />

        {/* INV — Inventory */}
        {/* SI-INV-001 Real-Time Stock View (Tier 1) */}
        <Route path="/inventory/stock" element={<StockViewPage />} />
        {/* SI-INV-002 Department Stock Detail (Tier 2; drill-through from SI-INV-001/003) */}
        <Route path="/inventory/stock/detail" element={<DepartmentStockDetailPage />} />
        {/* SI-INV-003 Below-PAR Flag List (Tier 1) */}
        <Route path="/inventory/below-par" element={<BelowParPage />} />
        {/* SI-INV-008 Expiry Countdown Dashboard (Tier 1) */}
        <Route path="/inventory/expiry" element={<ExpiryCountdownPage />} />
        {/* SI-INV-009 Cross-Location Transfer Suggestions */}
        <Route path="/inventory/suggestions" element={<TransferSuggestionsPage />} />
        {/* SI-INV-016 Closing Inventory Cluster Review */}
        <Route path="/inventory/closing/review" element={<ClosingClusterReviewPage />} />
        {/* SI-INV-004 PAR Level Configuration */}
        <Route path="/inventory/par-levels" element={<ParLevelConfigPage />} />
        {/* SI-INV-010 Goods Receipt Entry (manual, no PO) — Tier 1 hero.
            Static segments registered BEFORE potential /:id routes (same pattern as transfers). */}
        <Route path="/inventory/goods-receipts/new" element={<GoodsReceiptEntryPage />} />
        {/* SI-INV-011 Goods Receipt Entry — Transfer-Driven (Tier 2) */}
        <Route path="/inventory/goods-receipts/transfer" element={<GoodsReceiptTransferPage />} />
        {/* SI-INV-012 Goods Receipt Rejection at QC (Tier 1 hero) */}
        <Route path="/inventory/goods-receipts/reject" element={<GoodsReceiptRejectPage />} />
        {/* SI-INV-005 Stock Transfer Create. /new BEFORE /:id so the static segment wins. */}
        <Route path="/inventory/transfers/new" element={<StockTransferCreatePage />} />
        {/* SI-INV-007 Paired Cross-Cluster Transfer (Tier 1). Registered BEFORE /:id. */}
        <Route path="/inventory/transfers/paired" element={<PairedTransferPage />} />
        {/* SI-INV-013 Inventory Adjustment (Tier 1) */}
        <Route path="/inventory/adjustments/new" element={<InventoryAdjustmentPage />} />
        {/* SI-INV-014 Closing Inventory Entry — POS Daily (Tier 1 hero) */}
        <Route path="/inventory/closing/pos" element={<ClosingCountPage context="pos" />} />
        {/* SI-INV-015 Closing Inventory Entry — Dispatch Daily (Tier 1 hero).
            Reuses shared ClosingCountPage with context="dispatch". */}
        <Route path="/inventory/closing/dispatch" element={<ClosingCountPage context="dispatch" />} />
        {/* SI-INV-006 Stock Transfer Detail & Status. Parameterless entry = recent-transfers picker. */}
        <Route path="/inventory/transfers" element={<StockTransferDetailPage />} />
        {/* Param route AFTER /new and /paired. */}
        <Route path="/inventory/transfers/:id" element={<StockTransferDetailPage />} />
      </Route>
    </Routes>
  )
}

// ---------------------------------------------------------------------------
// Home page — clean, on-brand welcome rendered inside the cockpit shell.
// Auth is handled by the layout RequireAuth, so this only renders for an
// authenticated session.
// ---------------------------------------------------------------------------

interface QuickLink {
  to: string
  label: string
  desc: string
  icon: LucideIcon
}

const QUICK_LINKS: ReadonlyArray<QuickLink> = [
  { to: '/inventory/stock', label: 'Real-time stock', desc: 'Live on-hand by department', icon: Boxes },
  { to: '/inventory/below-par', label: 'Below-PAR items', desc: 'Items under their reorder level', icon: TriangleAlert },
  { to: '/inventory/expiry', label: 'Expiry countdown', desc: 'Batches nearing their use-by date', icon: CalendarClock },
  { to: '/inventory/goods-receipts/new', label: 'Record goods receipt', desc: 'Log incoming stock', icon: PackagePlus },
  { to: '/approvals/inbox', label: 'Approval inbox', desc: 'Items awaiting your decision', icon: Inbox },
  { to: '/audit', label: 'Audit trail', desc: 'Every recorded action', icon: ScrollText },
]

function formatRole(role: string): string {
  return role
    .split('_')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

function HomePage() {
  const { session } = useSession()
  const role = session?.user.role ?? 'User'

  return (
    <div className="max-w-5xl p-6 md:p-8">
      <header className="space-y-1">
        <p className="text-sm text-on-surface-variant">Welcome back</p>
        <h1 className="text-2xl font-semibold text-on-surface">F&amp;B ERP</h1>
        <p className="text-sm text-on-surface-variant">
          Signed in as{' '}
          <span className="font-medium text-on-surface">{formatRole(role)}</span>
        </p>
      </header>

      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Quick actions
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map(({ to, label, desc, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group rounded-xl bg-surface-container-lowest p-4 transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-on-surface">{label}</p>
                  <p className="mt-0.5 text-xs text-on-surface-variant">{desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <p className="mt-8 text-xs text-on-surface-variant">
        Use the sidebar to reach any screen. More modules arrive with each release.
      </p>
    </div>
  )
}

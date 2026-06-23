import { Routes, Route, Link, Navigate } from 'react-router-dom'
import ComponentsIndex from '@/dev/ComponentsIndex'
import RequireAuth from '@/lib/RequireAuth'
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
 * Auth flow (C3 — SI-USR-003 + SI-USR-004 production frontend):
 *   /                          → HomePage (auth state aware — redirects to /login when unauthenticated)
 *   /login                     → SI-USR-003 LoginPage (Tier 1 hero)
 *   /reset-password            → SI-USR-004 PasswordResetPage — request step
 *   /reset-password/:token     → SI-USR-004 PasswordResetPage — confirm step
 *   /_dev/components           → ComponentsIndex — auth-free (parity check; no API calls)
 *
 * Auth is provided by main.tsx AuthProvider (real Supabase Auth, Mumbai project).
 * RequireAuth wraps any route that requires a valid session; the three /login
 * + /reset-password routes are explicitly public (pre-auth surfaces).
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/reset-password" element={<PasswordResetPage />} />
      <Route path="/reset-password/:token" element={<PasswordResetPage />} />
      <Route path="/_dev/components" element={<ComponentsIndex />} />
      {/* MDM pages — auth-gated */}
      <Route
        path="/mdm/hierarchy"
        element={
          <RequireAuth>
            <HierarchyPage />
          </RequireAuth>
        }
      />
      <Route
        path="/mdm/departments"
        element={
          <RequireAuth>
            <DepartmentsPage />
          </RequireAuth>
        }
      />
      {/* SI-MDM-003 Product Master — Task C5 */}
      <Route
        path="/mdm/products"
        element={
          <RequireAuth>
            <ProductsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/mdm/products/new"
        element={
          <RequireAuth>
            <ProductsForm />
          </RequireAuth>
        }
      />
      <Route
        path="/mdm/products/:id/edit"
        element={
          <RequireAuth>
            <ProductsForm />
          </RequireAuth>
        }
      />
      {/* SI-MDM-004 Material Enablement Matrix — Task C6 */}
      <Route
        path="/mdm/enablement"
        element={
          <RequireAuth>
            <EnablementMatrixPage />
          </RequireAuth>
        }
      />
      {/* SI-MDM-005 Vendor Master — Task C7 */}
      <Route
        path="/mdm/vendors"
        element={
          <RequireAuth>
            <VendorsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/mdm/vendors/new"
        element={
          <RequireAuth>
            <VendorsForm />
          </RequireAuth>
        }
      />
      <Route
        path="/mdm/vendors/:id/edit"
        element={
          <RequireAuth>
            <VendorsForm />
          </RequireAuth>
        }
      />
      {/* SI-MDM-006 Category & Sub-Category Management — Task C8 */}
      <Route
        path="/mdm/categories"
        element={
          <RequireAuth>
            <CategoriesPage />
          </RequireAuth>
        }
      />
      {/* SI-MDM-007 Company Registration & Fiscal Year — Task C9 */}
      <Route
        path="/mdm/company"
        element={
          <RequireAuth>
            <CompanyPage />
          </RequireAuth>
        }
      />
      {/* SI-USR-001 User List + SI-USR-002 User Create/Edit — Task C4 (Tier 1 hero on USR-002) */}
      <Route
        path="/users"
        element={
          <RequireAuth>
            <UsersPage />
          </RequireAuth>
        }
      />
      <Route
        path="/users/new"
        element={
          <RequireAuth>
            <UserCreateEditPage />
          </RequireAuth>
        }
      />
      <Route
        path="/users/:id/edit"
        element={
          <RequireAuth>
            <UserCreateEditPage />
          </RequireAuth>
        }
      />
      {/* SI-USR-005 Effective Permissions + SI-USR-006 Override mutate (Tier 1 hero on USR-006) — Task C5 */}
      <Route
        path="/users/:userId/effective-permissions"
        element={
          <RequireAuth>
            <EffectivePermissionsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/users/:userId/overrides/grant"
        element={
          <RequireAuth>
            <PermissionOverridePage />
          </RequireAuth>
        }
      />
      <Route
        path="/users/:userId/overrides/revoke"
        element={
          <RequireAuth>
            <PermissionOverridePage />
          </RequireAuth>
        }
      />
      <Route
        path="/users/:userId/overrides/edit/:overrideId"
        element={
          <RequireAuth>
            <PermissionOverridePage />
          </RequireAuth>
        }
      />
      {/* SI-USR-007 Overrides Expiring Soon — Task C6 (Tier 2) */}
      <Route
        path="/users/overrides/expiring"
        element={
          <RequireAuth>
            <OverridesExpiringPage />
          </RequireAuth>
        }
      />
      {/* SI-USR-008 Brand Owner Account Approval — Task C7 (Tier 2, DL-030 route-only).
          NOT linked from sidebar nav. RequireRole("superadmin") is wired inside the page;
          all non-superadmin users see a 403 panel. */}
      <Route
        path="/users/approvals"
        element={
          <RequireAuth>
            <AccountApprovalPage />
          </RequireAuth>
        }
      />
      {/* SI-INF-007 Issue Ticket List + SI-INF-008 Issue Ticket Form — Task C8a */}
      <Route
        path="/issues"
        element={
          <RequireAuth>
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
          </RequireAuth>
        }
      />
      <Route
        path="/issues/new"
        element={
          <RequireAuth>
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
          </RequireAuth>
        }
      />
      <Route
        path="/issues/:id"
        element={
          <RequireAuth>
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
          </RequireAuth>
        }
      />
      {/* SI-INF-001 Approval Inbox — Task C3 (Tier 1 hero; DL-040 BO drill-through) */}
      <Route
        path="/approvals/inbox"
        element={
          <RequireAuth>
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
          </RequireAuth>
        }
      />
      {/* SI-INF-002 Approval Chain Configuration — Task C4 (Tier 1 hero; DL-036 reason-code audit; BO-only) */}
      <Route
        path="/approvals/chains"
        element={
          <RequireAuth>
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
          </RequireAuth>
        }
      />
      {/* SI-INF-003 Notification Preferences — Task C5 (Tier 2; DL-035 email greyed) */}
      <Route
        path="/notifications/preferences"
        element={
          <RequireAuth>
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
          </RequireAuth>
        }
      />
      {/* SI-INF-004 Notification Digest Preview — Task C5 (Tier 2; empty in MVP per DL-035) */}
      <Route
        path="/notifications/digest"
        element={
          <RequireAuth>
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
          </RequireAuth>
        }
      />
      {/* SI-INF-005 Audit Trail Viewer — Task C6 (Tier 1 hero; FR20 + FR24) */}
      <Route
        path="/audit"
        element={
          <RequireAuth>
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
          </RequireAuth>
        }
      />
      {/* SI-INF-009 Broadcasts — Task C9 (Tier 2; BO composer + history + BroadcastBanner) */}
      <Route
        path="/broadcasts"
        element={
          <RequireAuth>
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
          </RequireAuth>
        }
      />
      {/* SI-INV-001 Real-Time Stock View — Wave 1 (Tier 1) */}
      <Route
        path="/inventory/stock"
        element={
          <RequireAuth>
            <StockViewPage />
          </RequireAuth>
        }
      />
      {/* SI-INV-002 Department Stock Detail — Wave 1 (Tier 2; reached by drill-through from SI-INV-001/003) */}
      <Route
        path="/inventory/stock/detail"
        element={
          <RequireAuth>
            <DepartmentStockDetailPage />
          </RequireAuth>
        }
      />
      {/* SI-INV-003 Below-PAR Flag List — Wave 1 (Tier 1) */}
      <Route
        path="/inventory/below-par"
        element={
          <RequireAuth>
            <BelowParPage />
          </RequireAuth>
        }
      />
      {/* SI-INV-008 Expiry Countdown Dashboard — Wave 1 (Tier 1) */}
      <Route
        path="/inventory/expiry"
        element={
          <RequireAuth>
            <ExpiryCountdownPage />
          </RequireAuth>
        }
      />
      {/* SI-INV-009 Cross-Location Transfer Suggestions — Wave 1 */}
      <Route
        path="/inventory/suggestions"
        element={
          <RequireAuth>
            <TransferSuggestionsPage />
          </RequireAuth>
        }
      />
      {/* SI-INV-016 Closing Inventory Cluster Review — Wave 1 */}
      <Route
        path="/inventory/closing/review"
        element={
          <RequireAuth>
            <ClosingClusterReviewPage />
          </RequireAuth>
        }
      />
      {/* SI-INV-004 PAR Level Configuration — Wave 2 */}
      <Route
        path="/inventory/par-levels"
        element={
          <RequireAuth>
            <ParLevelConfigPage />
          </RequireAuth>
        }
      />
    </Routes>
  )
}

// ---------------------------------------------------------------------------
// Home page — minimal, just enough to navigate
// ---------------------------------------------------------------------------

function HomePage() {
  const { session, status, signOut } = useSession()

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-surface p-8">
        <h1 className="text-xl font-semibold text-on-surface">F&amp;B ERP — MDM</h1>
        <p className="mt-4 text-sm text-on-surface-variant">Loading session…</p>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-surface p-8">
      <h1 className="text-xl font-semibold text-on-surface">F&amp;B ERP — MDM</h1>

      {session && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-on-surface-variant">
            Signed in as <span className="font-medium text-on-surface">{session.user.role}</span>
            {' '}(brand <span className="font-mono text-xs">{session.user.brandId}</span>)
          </p>

          <nav className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              MDM Screens
            </p>
            {[
              { href: '/mdm/hierarchy', label: 'Org Hierarchy (SI-MDM-001)' },
              { href: '/mdm/departments', label: 'Department Register (SI-MDM-002)' },
              { href: '/mdm/products', label: 'Product Master (SI-MDM-003)' },
              { href: '/mdm/enablement', label: 'Material Enablement Matrix (SI-MDM-004)' },
              { href: '/mdm/vendors', label: 'Vendor Master (SI-MDM-005)' },
              { href: '/mdm/categories', label: 'Categories (SI-MDM-006)' },
              { href: '/mdm/company', label: 'Company & Fiscal Year (SI-MDM-007)' },
              { href: '/users', label: 'Users (SI-USR-001)' },
              { href: '/users/overrides/expiring', label: 'Overrides expiring soon (SI-USR-007)' },
              { href: '/approvals/inbox', label: 'Approval inbox (SI-INF-001)' },
              { href: '/approvals/chains', label: 'Approval chains (SI-INF-002)' },
              { href: '/notifications/preferences', label: 'Notification preferences (SI-INF-003)' },
              { href: '/notifications/digest', label: 'Digest preview (SI-INF-004)' },
              { href: '/audit', label: 'Audit trail (SI-INF-005)' },
              { href: '/issues', label: 'Issue tickets (SI-INF-007)' },
              { href: '/broadcasts', label: 'Broadcasts (SI-INF-009)' },
              { href: '/inventory/stock', label: 'Real-time stock (SI-INV-001)' },
              { href: '/inventory/stock/detail', label: 'Dept stock detail (SI-INV-002) — drill-through only' },
              { href: '/inventory/below-par', label: 'Below-PAR list (SI-INV-003)' },
              { href: '/inventory/expiry', label: 'Expiry countdown (SI-INV-008)' },
              { href: '/inventory/suggestions', label: 'Transfer suggestions (SI-INV-009)' },
              { href: '/inventory/closing/review', label: 'Closing cluster review (SI-INV-016)' },
              { href: '/inventory/par-levels', label: 'PAR configuration (SI-INV-004)' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                to={href}
                className="block text-sm text-on-surface underline-offset-2 hover:underline"
              >
                {label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            className="mt-2 text-sm text-on-surface-variant underline-offset-2 hover:underline"
            onClick={() => { void signOut() }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}


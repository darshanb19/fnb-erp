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


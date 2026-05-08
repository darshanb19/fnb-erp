/**
 * RequireAuth — route guard that enforces authentication.
 *
 * Lives in lib/ (not components/shell/) so the token-lint pre-commit hook
 * covers it — there is no design-token surface here anyway (no hex literals,
 * no colour classes beyond semantic on-surface tokens).
 *
 * Usage:
 *   <Route path="/mdm/hierarchy" element={<RequireAuth><HierarchyPage /></RequireAuth>} />
 *
 * Behaviour:
 *   - status === 'loading'          → full-page spinner
 *   - status === 'unauthenticated'  → redirect to /login
 *   - status === 'authenticated'    → render children
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSession } from '@/lib/auth';

interface RequireAuthProps {
  children: React.ReactNode;
}

export default function RequireAuth({ children }: RequireAuthProps): React.ReactElement {
  const { status } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-l-4 border-primary" />
          <p className="text-sm text-on-surface-variant">Loading…</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

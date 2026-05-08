/**
 * RequireRole — gate children behind a role check.
 *
 * Use for role-based gates that don't have a clean permission-key analogue
 * — primarily SI-USR-008 Account Approval (superadmin-only per DL-030).
 * Prefer <RequirePermission> for everything else.
 */

import React from 'react';
import { useSession } from '@/lib/auth';
import type { UserRole } from '@/lib/user-roles';

interface RequireRoleProps {
  role: UserRole | UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function RequireRole({
  role,
  children,
  fallback = null,
}: RequireRoleProps): React.ReactElement | null {
  const { session } = useSession();
  if (!session) return <>{fallback}</>;
  const ok = Array.isArray(role) ? role.includes(session.user.role) : session.user.role === role;
  return <>{ok ? children : fallback}</>;
}

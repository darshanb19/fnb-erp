/**
 * RequirePermission — gate children behind an effective-permission check.
 *
 * Renders children only if the current user's effective permissions include
 * the named key. While loading effective permissions, returns null (caller
 * decides skeleton placement). On miss, renders `fallback` (default null).
 *
 * Usage:
 *   <RequirePermission permission="mdm.products.write">
 *     <Button onClick={openCreateModal}>New Product</Button>
 *   </RequirePermission>
 *
 * For Brand-Owner-only affordances pre-RBAC-audit (Task C8), this component
 * is the canonical replacement for ad-hoc role === 'brand_owner' checks.
 */

import React from 'react';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { useSession } from '@/lib/auth';

interface RequirePermissionProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function RequirePermission({
  permission,
  children,
  fallback = null,
}: RequirePermissionProps): React.ReactElement | null {
  const { session } = useSession();
  const { data, isLoading } = useEffectivePermissions(session?.user.id);
  if (isLoading) return null;
  // data is string[] — a bare array of permission key strings from the API
  const allowed = data?.includes(permission) ?? false;
  return <>{allowed ? children : fallback}</>;
}

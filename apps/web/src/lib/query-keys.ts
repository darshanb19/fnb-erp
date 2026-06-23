/**
 * query-keys — TanStack Query key factory.
 *
 * Hierarchical shape enables targeted invalidation:
 *   queryClient.invalidateQueries({ queryKey: qk.clusters.all })
 *   → invalidates every clusters query (list + byId)
 *
 *   queryClient.invalidateQueries({ queryKey: qk.clusters.list() })
 *   → invalidates only the list query
 *
 * Constants only — no logic, no async, no imports.
 * Covers all 10 MDM resources from Arc (a): clusters, locations, departments,
 * products, vendors, uoms, productUoms, categories, enablements, company.
 */

export const qk = {
  clusters: {
    all: ['clusters'] as const,
    list: () => ['clusters', 'list'] as const,
    byId: (id: string) => ['clusters', 'byId', id] as const,
  },
  locations: {
    all: ['locations'] as const,
    list: (filter?: { clusterId?: string }) => ['locations', 'list', filter ?? null] as const,
    byId: (id: string) => ['locations', 'byId', id] as const,
  },
  departments: {
    all: ['departments'] as const,
    list: (filter?: { locationId?: string; type?: string }) =>
      ['departments', 'list', filter ?? null] as const,
    byId: (id: string) => ['departments', 'byId', id] as const,
  },
  products: {
    all: ['products'] as const,
    list: (filter?: { type?: string; categoryId?: string; activeOnly?: boolean; q?: string }) =>
      ['products', 'list', filter ?? null] as const,
    byId: (id: string) => ['products', 'byId', id] as const,
    findSimilar: (name: string) => ['products', 'findSimilar', name] as const,
  },
  vendors: {
    all: ['vendors'] as const,
    list: (filter?: { activeOnly?: boolean; q?: string }) =>
      ['vendors', 'list', filter ?? null] as const,
    byId: (id: string) => ['vendors', 'byId', id] as const,
    findSimilar: (name: string) => ['vendors', 'findSimilar', name] as const,
  },
  uoms: {
    all: ['uoms'] as const,
    list: () => ['uoms', 'list'] as const,
  },
  productUoms: {
    byProduct: (productId: string) => ['productUoms', 'byProduct', productId] as const,
  },
  categories: {
    all: ['categories'] as const,
    list: () => ['categories', 'list'] as const,
    byId: (id: string) => ['categories', 'byId', id] as const,
    findSimilar: (name: string) => ['categories', 'findSimilar', name] as const,
  },
  enablements: {
    byLocation: (locationId: string, filter?: { categoryId?: string }) =>
      ['enablements', 'byLocation', locationId, filter ?? null] as const,
    check: (productId: string, departmentId: string) =>
      ['enablements', 'check', productId, departmentId] as const,
  },
  company: {
    read: () => ['company', 'read'] as const,
  },
  users: {
    all: ['users'] as const,
    list: (filter?: { role?: string; status?: string; q?: string }) =>
      ['users', 'list', filter ?? null] as const,
    byId: (id: string) => ['users', 'byId', id] as const,
    pendingApproval: () => ['users', 'pendingApproval'] as const,
    effectivePermissions: (userId: string) =>
      ['users', 'effectivePermissions', userId] as const,
    overrides: (userId: string) => ['users', 'overrides', userId] as const,
  },
  permissions: {
    all: ['permissions'] as const,
    list: () => ['permissions', 'list'] as const,
  },
  permissionOverrides: {
    all: ['permissionOverrides'] as const,
    expiring: (days: number) => ['permissionOverrides', 'expiring', days] as const,
  },
  roles: {
    all: ['roles'] as const,
    list: () => ['roles', 'list'] as const,
  },
  inf: {
    approvals: {
      all: ['inf', 'approvals'] as const,
      inbox: () => ['inf', 'approvals', 'inbox'] as const,
      request: (id: string) => ['inf', 'approvals', 'request', id] as const,
    },
    approvalChains: {
      all: ['inf', 'approvalChains'] as const,
      list: () => ['inf', 'approvalChains', 'list'] as const,
      byId: (id: string) => ['inf', 'approvalChains', 'byId', id] as const,
    },
    notifications: {
      all: ['inf', 'notifications'] as const,
      list: () => ['inf', 'notifications', 'list'] as const,
      preferences: () => ['inf', 'notifications', 'preferences'] as const,
      digest: () => ['inf', 'notifications', 'digest'] as const,
    },
    audit: {
      events: (filters: object) => ['inf', 'audit', 'events', filters] as const,
      entityTimeline: (entityType: string, entityRef: string) =>
        ['inf', 'audit', 'entityTimeline', entityType, entityRef] as const,
      exportJob: (jobId: string) => ['inf', 'audit', 'export', jobId] as const,
    },
    issues: {
      all: ['inf', 'issues'] as const,
      list: (filter?: object) => ['inf', 'issues', 'list', filter ?? null] as const,
      detail: (id: string) => ['inf', 'issues', 'detail', id] as const,
    },
    broadcasts: {
      all: ['inf', 'broadcasts'] as const,
      list: () => ['inf', 'broadcasts', 'list'] as const,
      sent: () => ['inf', 'broadcasts', 'sent'] as const,
      detail: (id: string) => ['inf', 'broadcasts', 'detail', id] as const,
      acks: (id: string) => ['inf', 'broadcasts', 'acks', id] as const,
    },
  },
  inv: {
    stock: {
      department: (departmentId: string) => ['inv', 'stock', 'department', departmentId] as const,
      expiring: (scope: object) => ['inv', 'stock', 'expiring', scope] as const,
      movements: (productId: string | undefined, departmentId: string | undefined) =>
        ['inv', 'stock', 'movements', productId ?? null, departmentId ?? null] as const,
    },
    belowPar: (filter: object) => ['inv', 'belowPar', filter] as const,
    suggestions: (src: string, dest: string) => ['inv', 'suggestions', src, dest] as const,
    closing: {
      summary: (businessDate: string, scope: object) =>
        ['inv', 'closing', 'summary', businessDate, scope] as const,
      cutOff: (businessDate: string, scope: object) =>
        ['inv', 'closing', 'cutOff', businessDate, scope] as const,
    },
    productNames: () => ['inv', 'productNames'] as const,
    departments: () => ['inv', 'departments', 'minimal'] as const,
    locations: () => ['inv', 'locations', 'minimal'] as const,
  },
} as const;

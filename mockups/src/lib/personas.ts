/**
 * Persona switcher fixtures — Wild Sugar tenant.
 *
 * Sourced from Phase 2c plan §16 (Phase 2c sessions, Wild Sugar persona switcher)
 * and `_planning/05-screen-inventory.md` §4 / `_planning/02-master-spec.md` role list.
 *
 * Each persona ships a default landing route — the screen most representative
 * of their daily-driver view. Personas with `scope: 'location'` carry a single
 * Wild Sugar location label; brand / cluster scopes get the appropriate banner.
 *
 * The eight personas cover the full role surface needed for hero-screen
 * mockups in Phase 2c Sessions 3 & 4 plus the deferred Tier 1 heroes that
 * land during Phase 4. Mockup chrome reads `personas[i].scopeLabel` to drive
 * the top-bar scope badge.
 */
export type PersonaScope = 'brand' | 'cluster' | 'location'

export interface Persona {
  readonly id: string
  readonly name: string
  readonly role: string
  readonly defaultRoute: string
  readonly scope: PersonaScope
  readonly scopeLabel: string
}

export const personas: ReadonlyArray<Persona> = [
  {
    id: 'brand-owner',
    name: 'Aanya Khanna',
    role: 'Brand Owner',
    defaultRoute: '/SI-RPT-002',
    scope: 'brand',
    scopeLabel: 'Wild Sugar — Brand-wide',
  },
  {
    id: 'cluster-mgr',
    name: 'Rohan Mehta',
    role: 'Cluster Manager',
    defaultRoute: '/SI-RPT-003',
    scope: 'cluster',
    scopeLabel: 'Bandra-West Cluster',
  },
  {
    id: 'finance-mgr',
    name: 'Priya Iyer',
    role: 'Finance Manager',
    defaultRoute: '/SI-ACC-013',
    scope: 'brand',
    scopeLabel: 'Wild Sugar — Finance',
  },
  {
    id: 'procurement-mgr',
    name: 'Vikram Singh',
    role: 'Procurement Manager',
    defaultRoute: '/SI-PUR-003',
    scope: 'brand',
    scopeLabel: 'Wild Sugar — Procurement',
  },
  {
    id: 'kitchen-mgr',
    name: 'Nadia Khan',
    role: 'Kitchen Manager',
    defaultRoute: '/SI-REC-003',
    scope: 'location',
    scopeLabel: 'Wild Sugar Bandra',
  },
  {
    id: 'store-mgr',
    name: 'Arjun Reddy',
    role: 'Store Manager',
    defaultRoute: '/SI-INV-001',
    scope: 'location',
    scopeLabel: 'Wild Sugar Bandra',
  },
  {
    id: 'pos-staff',
    name: 'Meera Pillai',
    role: 'POS Staff',
    defaultRoute: '/SI-INV-014',
    scope: 'location',
    scopeLabel: 'Wild Sugar Bandra',
  },
  {
    id: 'dispatch-staff',
    name: 'Karthik Naidu',
    role: 'Dispatch Staff',
    defaultRoute: '/SI-DSP-003',
    scope: 'location',
    scopeLabel: 'Wild Sugar CK Powai',
  },
] as const

export const defaultPersona: Persona = personas[0]

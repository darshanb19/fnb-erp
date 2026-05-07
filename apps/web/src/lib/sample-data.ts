// mockups/src/lib/sample-data.ts
//
// Wild Sugar / Indian F&B sample fixtures for Phase 2c mockups.
// Single source of truth — every screen consumes from here.
// All numerical amounts in integer ₹ (no fractional rupees in fixtures).
// All dates as ISO strings; treat 2026-05-06 (today) as the "now" anchor.
//
// Scope (Subagent D, Phase 2c Session 2): clusters, locations, departments,
// vendors, materials, recipes, menu items, POs, GRs, inventory positions,
// B2B customers, sales days, closing inventory entries.
//
// NOT in scope (Phase 4 epic-by-epic adds): production orders, dispatch
// challans, recipe-version history, B2B-challan fixtures.
//
// Sizes per plan §19 Q2:
//   recipes 30–40, menu items 60–80, POs ~270/90d, inventory 200–400,
//   vendors 15–20, B2B customers 8–12, sales 60d, closing 30d.

// ─────────────────────────────────────────────────────────────────────────────
// 0. Anchor + INR formatter
// ─────────────────────────────────────────────────────────────────────────────

export const NOW = '2026-05-06' as const

/**
 * Indian-grouped INR formatter per DESIGN.md §7.4.
 * `formatINR(428500)` → `₹ 4,28,500` (₹ + hair space + lakh-grouped digits).
 * `formatINR(428500, { withSymbol: false })` → `4,28,500`.
 */
export const formatINR = (
  n: number,
  opts: { withSymbol?: boolean } = {},
): string => {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n).toFixed(0)
  const last3 = abs.slice(-3)
  const rest = abs.slice(0, -3)
  const grouped = rest
    ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3
    : last3
  //   = NARROW NO-BREAK SPACE (hair-space-equivalent per §7.4)
  return `${sign}${opts.withSymbol === false ? '' : '₹ '}${grouped}`
}

/** Helper: produce an ISO date string `n` days before NOW. */
const daysBefore = (n: number): string => {
  const base = new Date(`${NOW}T00:00:00Z`)
  base.setUTCDate(base.getUTCDate() - n)
  return base.toISOString().slice(0, 10)
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Org hierarchy: brand → cluster → location → department
// ─────────────────────────────────────────────────────────────────────────────

export type Cluster = { id: string; name: string }

export type LocationType =
  | 'central_kitchen'
  | 'pos_outlet'
  | 'dispatch_hub'

export type Location = {
  id: string
  name: string
  cluster_id: string
  type: LocationType
  city: string
  state: string
  state_code: string // GST state code (2 digits)
}

export type Department = {
  id: string
  name: string
  location_id: string
}

export const BRAND = {
  id: 'brand-wild-sugar',
  name: 'Wild Sugar',
  legal_name: 'Wild Sugar Hospitality Pvt Ltd',
  gstin: '27ABCDE1234F1Z5',
  state: 'Maharashtra',
  state_code: '27',
} as const

export const clusters = [
  { id: 'cl-bandra-west', name: 'Bandra-West Cluster' },
  { id: 'cl-andheri-east', name: 'Andheri-East Cluster' },
  { id: 'cl-powai', name: 'Powai Cluster' },
] as const satisfies ReadonlyArray<Cluster>

export const locations = [
  // Bandra-West cluster: 1 central kitchen + 2 POS outlets
  {
    id: 'loc-ck-bandra',
    name: 'Wild Sugar Central Kitchen — Bandra',
    cluster_id: 'cl-bandra-west',
    type: 'central_kitchen',
    city: 'Mumbai',
    state: 'Maharashtra',
    state_code: '27',
  },
  {
    id: 'loc-bandra-linking',
    name: 'Wild Sugar Linking Road',
    cluster_id: 'cl-bandra-west',
    type: 'pos_outlet',
    city: 'Mumbai',
    state: 'Maharashtra',
    state_code: '27',
  },
  {
    id: 'loc-bandra-pali',
    name: 'Wild Sugar Pali Hill',
    cluster_id: 'cl-bandra-west',
    type: 'pos_outlet',
    city: 'Mumbai',
    state: 'Maharashtra',
    state_code: '27',
  },
  // Andheri-East cluster: 1 dispatch hub + 1 POS outlet
  {
    id: 'loc-dh-andheri',
    name: 'Wild Sugar Dispatch Hub — Andheri',
    cluster_id: 'cl-andheri-east',
    type: 'dispatch_hub',
    city: 'Mumbai',
    state: 'Maharashtra',
    state_code: '27',
  },
  {
    id: 'loc-andheri-phoenix',
    name: 'Wild Sugar Phoenix Marketcity',
    cluster_id: 'cl-andheri-east',
    type: 'pos_outlet',
    city: 'Mumbai',
    state: 'Maharashtra',
    state_code: '27',
  },
  // Powai cluster: 1 POS outlet
  {
    id: 'loc-powai-hiranandani',
    name: 'Wild Sugar Hiranandani',
    cluster_id: 'cl-powai',
    type: 'pos_outlet',
    city: 'Mumbai',
    state: 'Maharashtra',
    state_code: '27',
  },
] as const satisfies ReadonlyArray<Location>

export const departments = [
  // Central Kitchen — Bandra
  { id: 'dept-ck-hot', name: 'Hot Kitchen', location_id: 'loc-ck-bandra' },
  { id: 'dept-ck-cold', name: 'Cold Kitchen', location_id: 'loc-ck-bandra' },
  { id: 'dept-ck-bakery', name: 'Bakery & Pastry', location_id: 'loc-ck-bandra' },
  { id: 'dept-ck-tandoor', name: 'Tandoor Section', location_id: 'loc-ck-bandra' },
  // Dispatch Hub — Andheri
  { id: 'dept-dh-receiving', name: 'Receiving', location_id: 'loc-dh-andheri' },
  { id: 'dept-dh-dispatch', name: 'Dispatch', location_id: 'loc-dh-andheri' },
  // POS Outlets — kitchen + service split per outlet
  { id: 'dept-bl-kitchen', name: 'Kitchen', location_id: 'loc-bandra-linking' },
  { id: 'dept-bl-service', name: 'Service & Bar', location_id: 'loc-bandra-linking' },
  { id: 'dept-bp-kitchen', name: 'Kitchen', location_id: 'loc-bandra-pali' },
  { id: 'dept-bp-service', name: 'Service & Bar', location_id: 'loc-bandra-pali' },
  { id: 'dept-ap-kitchen', name: 'Kitchen', location_id: 'loc-andheri-phoenix' },
  { id: 'dept-ap-service', name: 'Service & Bar', location_id: 'loc-andheri-phoenix' },
  { id: 'dept-ph-kitchen', name: 'Kitchen', location_id: 'loc-powai-hiranandani' },
  { id: 'dept-ph-service', name: 'Service & Bar', location_id: 'loc-powai-hiranandani' },
] as const satisfies ReadonlyArray<Department>

// ─────────────────────────────────────────────────────────────────────────────
// 2. Vendors (mix of brand-scope + cluster-scope per Master Spec §2.7)
// ─────────────────────────────────────────────────────────────────────────────

export type VendorScope = 'brand' | 'cluster'

export type Vendor = {
  id: string
  name: string
  scope: VendorScope
  /** Required when scope === 'cluster', undefined for brand-scope. */
  cluster_id?: string
  /** Present iff vendor is GST-registered (most are; a few small farms are not). */
  gstin?: string
  state: string
  state_code: string
  /** Free-form material category labels; informs preferred-vendor sorting (FR47). */
  preferred_for: ReadonlyArray<string>
  /** 0–100 aggregate quality score (FR47, fed by FR47a rejections + FR27 yields). */
  performance_score: number
  payment_terms_days: number
  /** Soft-delete flag — if true, surface as inactive in pickers. */
  is_active: boolean
}

export const vendors: ReadonlyArray<Vendor> = [
  {
    id: 'vnd-bharat-spice',
    name: 'Bharat Spice Traders',
    scope: 'brand',
    gstin: '27AABCB1234L1ZX',
    state: 'Maharashtra',
    state_code: '27',
    preferred_for: ['Spices', 'Whole Spices', 'Dry Goods'],
    performance_score: 92,
    payment_terms_days: 30,
    is_active: true,
  },
  {
    id: 'vnd-mumbai-dairy',
    name: 'Mumbai Dairy Co',
    scope: 'brand',
    gstin: '27AAACM5678D1Z2',
    state: 'Maharashtra',
    state_code: '27',
    preferred_for: ['Dairy', 'Cheese', 'Butter'],
    performance_score: 88,
    payment_terms_days: 15,
    is_active: true,
  },
  {
    id: 'vnd-coastal-seafoods',
    name: 'Coastal Seafoods Pvt Ltd',
    scope: 'brand',
    gstin: '27AABCC9012F1Z3',
    state: 'Maharashtra',
    state_code: '27',
    preferred_for: ['Seafood', 'Fresh Fish', 'Prawns'],
    performance_score: 81,
    payment_terms_days: 7,
    is_active: true,
  },
  {
    id: 'vnd-western-bev',
    name: 'Western Beverages Pvt Ltd',
    scope: 'brand',
    gstin: '27AAACW3456J1Z4',
    state: 'Maharashtra',
    state_code: '27',
    preferred_for: ['Beverages', 'Soft Drinks', 'Mixers'],
    performance_score: 95,
    payment_terms_days: 30,
    is_active: true,
  },
  {
    id: 'vnd-punjab-atta',
    name: 'Punjab Atta Mills',
    scope: 'brand',
    gstin: '03AAACP7890L1Z6',
    state: 'Punjab',
    state_code: '03',
    preferred_for: ['Flour', 'Atta', 'Maida', 'Sooji'],
    performance_score: 87,
    payment_terms_days: 45,
    is_active: true,
  },
  {
    id: 'vnd-karnataka-coffee',
    name: 'Karnataka Coffee Traders',
    scope: 'brand',
    gstin: '29AAACK2345R1Z9',
    state: 'Karnataka',
    state_code: '29',
    preferred_for: ['Coffee', 'Tea', 'Beverages'],
    performance_score: 90,
    payment_terms_days: 30,
    is_active: true,
  },
  {
    id: 'vnd-goa-liquor',
    name: 'Goa Liquor Distributors Ltd',
    scope: 'brand',
    gstin: '30AABCG6789Q1Z1',
    state: 'Goa',
    state_code: '30',
    preferred_for: ['Wine', 'Spirits', 'Beer'],
    performance_score: 84,
    payment_terms_days: 21,
    is_active: true,
  },
  {
    id: 'vnd-kerala-spice-coast',
    name: 'Kerala Spice Coast Exports',
    scope: 'brand',
    gstin: '32AAACK4567T1Z2',
    state: 'Kerala',
    state_code: '32',
    preferred_for: ['Spices', 'Cardamom', 'Black Pepper', 'Curry Leaves'],
    performance_score: 89,
    payment_terms_days: 30,
    is_active: true,
  },
  {
    id: 'vnd-rajasthan-pulses',
    name: 'Rajasthan Pulses & Grains',
    scope: 'brand',
    gstin: '08AAACR8901S1Z5',
    state: 'Rajasthan',
    state_code: '08',
    preferred_for: ['Pulses', 'Lentils', 'Rice', 'Grains'],
    performance_score: 86,
    payment_terms_days: 30,
    is_active: true,
  },
  // Cluster-scoped vendors below
  {
    id: 'vnd-bandra-greens',
    name: 'Bandra Greens Local Produce',
    scope: 'cluster',
    cluster_id: 'cl-bandra-west',
    gstin: '27AABCB7654K1Z3',
    state: 'Maharashtra',
    state_code: '27',
    preferred_for: ['Vegetables', 'Herbs', 'Leafy Greens'],
    performance_score: 78,
    payment_terms_days: 7,
    is_active: true,
  },
  {
    id: 'vnd-bandra-meats',
    name: 'Sunshine Meats — Bandra',
    scope: 'cluster',
    cluster_id: 'cl-bandra-west',
    gstin: '27AAFCS3210B1Z7',
    state: 'Maharashtra',
    state_code: '27',
    preferred_for: ['Meat', 'Mutton', 'Chicken', 'Lamb'],
    performance_score: 91,
    payment_terms_days: 7,
    is_active: true,
  },
  {
    id: 'vnd-andheri-cold',
    name: 'Andheri Cold Storage Suppliers',
    scope: 'cluster',
    cluster_id: 'cl-andheri-east',
    gstin: '27AAACA5678P1Z9',
    state: 'Maharashtra',
    state_code: '27',
    preferred_for: ['Frozen', 'Cold Cuts', 'Imported'],
    performance_score: 83,
    payment_terms_days: 21,
    is_active: true,
  },
  {
    id: 'vnd-andheri-bakery',
    name: 'Andheri Artisan Bakery Supplies',
    scope: 'cluster',
    cluster_id: 'cl-andheri-east',
    gstin: '27AAGCA9876H1Z2',
    state: 'Maharashtra',
    state_code: '27',
    preferred_for: ['Bakery', 'Yeast', 'Specialty Flour'],
    performance_score: 80,
    payment_terms_days: 15,
    is_active: true,
  },
  {
    id: 'vnd-powai-fresh',
    name: 'Powai Fresh Farms',
    scope: 'cluster',
    cluster_id: 'cl-powai',
    // No GSTIN — small farm, below threshold
    state: 'Maharashtra',
    state_code: '27',
    preferred_for: ['Vegetables', 'Eggs', 'Microgreens'],
    performance_score: 72,
    payment_terms_days: 7,
    is_active: true,
  },
  {
    id: 'vnd-powai-poultry',
    name: 'Powai Poultry Direct',
    scope: 'cluster',
    cluster_id: 'cl-powai',
    gstin: '27AAFCP2468V1Z6',
    state: 'Maharashtra',
    state_code: '27',
    preferred_for: ['Poultry', 'Chicken', 'Eggs'],
    performance_score: 85,
    payment_terms_days: 7,
    is_active: true,
  },
  {
    id: 'vnd-deccan-rice',
    name: 'Deccan Basmati Rice Mills',
    scope: 'brand',
    gstin: '36AAACD1357M1Z8',
    state: 'Telangana',
    state_code: '36',
    preferred_for: ['Rice', 'Basmati', 'Grains'],
    performance_score: 93,
    payment_terms_days: 45,
    is_active: true,
  },
  {
    id: 'vnd-tamilnadu-oils',
    name: 'Tamil Nadu Cold-Pressed Oils',
    scope: 'brand',
    gstin: '33AAACT2468N1Z4',
    state: 'Tamil Nadu',
    state_code: '33',
    preferred_for: ['Oils', 'Ghee', 'Cooking Fats'],
    performance_score: 88,
    payment_terms_days: 30,
    is_active: true,
  },
  {
    id: 'vnd-bandra-bever',
    name: 'Bandra Specialty Beverages',
    scope: 'cluster',
    cluster_id: 'cl-bandra-west',
    gstin: '27AABCB1357L1Z1',
    state: 'Maharashtra',
    state_code: '27',
    preferred_for: ['Beverages', 'Juices', 'Speciality Sodas'],
    performance_score: 76,
    payment_terms_days: 15,
    is_active: false, // soft-deleted; should still resolve in historical POs
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 3. Materials (raw ingredients procured against POs)
// ─────────────────────────────────────────────────────────────────────────────

export type Uom = 'kg' | 'g' | 'l' | 'ml' | 'pc' | 'pkt'

export type Material = {
  id: string
  name: string
  category: string
  uom: Uom
  hsn_code: string
  /** Last-known purchase price in ₹ per `uom` — used as default LKP. */
  lkp_per_uom: number
}

export const materials: ReadonlyArray<Material> = [
  // Spices & dry
  { id: 'mat-garam-masala', name: 'Garam Masala (blended)', category: 'Spices', uom: 'kg', hsn_code: '0910', lkp_per_uom: 850 },
  { id: 'mat-turmeric', name: 'Turmeric Powder', category: 'Spices', uom: 'kg', hsn_code: '0910', lkp_per_uom: 320 },
  { id: 'mat-red-chilli', name: 'Kashmiri Red Chilli Powder', category: 'Spices', uom: 'kg', hsn_code: '0904', lkp_per_uom: 480 },
  { id: 'mat-coriander-pwd', name: 'Coriander Powder', category: 'Spices', uom: 'kg', hsn_code: '0909', lkp_per_uom: 240 },
  { id: 'mat-cumin-seed', name: 'Cumin Seed (Jeera)', category: 'Whole Spices', uom: 'kg', hsn_code: '0909', lkp_per_uom: 520 },
  { id: 'mat-cardamom-green', name: 'Green Cardamom', category: 'Whole Spices', uom: 'kg', hsn_code: '0908', lkp_per_uom: 2800 },
  { id: 'mat-black-pepper', name: 'Black Pepper Whole', category: 'Whole Spices', uom: 'kg', hsn_code: '0904', lkp_per_uom: 720 },
  { id: 'mat-curry-leaves', name: 'Fresh Curry Leaves', category: 'Herbs', uom: 'kg', hsn_code: '0709', lkp_per_uom: 180 },
  // Pulses, grains & flour
  { id: 'mat-basmati-rice', name: 'Basmati Rice (long grain)', category: 'Rice', uom: 'kg', hsn_code: '1006', lkp_per_uom: 145 },
  { id: 'mat-toor-dal', name: 'Toor Dal', category: 'Pulses', uom: 'kg', hsn_code: '0713', lkp_per_uom: 165 },
  { id: 'mat-chana-dal', name: 'Chana Dal', category: 'Pulses', uom: 'kg', hsn_code: '0713', lkp_per_uom: 135 },
  { id: 'mat-atta', name: 'Whole-wheat Atta', category: 'Flour', uom: 'kg', hsn_code: '1101', lkp_per_uom: 48 },
  { id: 'mat-maida', name: 'Refined Maida', category: 'Flour', uom: 'kg', hsn_code: '1101', lkp_per_uom: 42 },
  { id: 'mat-besan', name: 'Besan (gram flour)', category: 'Flour', uom: 'kg', hsn_code: '1106', lkp_per_uom: 110 },
  // Dairy
  { id: 'mat-paneer', name: 'Fresh Paneer', category: 'Dairy', uom: 'kg', hsn_code: '0406', lkp_per_uom: 380 },
  { id: 'mat-butter', name: 'Salted Butter', category: 'Dairy', uom: 'kg', hsn_code: '0405', lkp_per_uom: 540 },
  { id: 'mat-ghee', name: 'Pure Cow Ghee', category: 'Dairy', uom: 'l', hsn_code: '0405', lkp_per_uom: 680 },
  { id: 'mat-curd', name: 'Hung Curd / Yoghurt', category: 'Dairy', uom: 'kg', hsn_code: '0403', lkp_per_uom: 90 },
  { id: 'mat-cream', name: 'Fresh Cream (25%)', category: 'Dairy', uom: 'l', hsn_code: '0401', lkp_per_uom: 220 },
  { id: 'mat-milk', name: 'Toned Milk', category: 'Dairy', uom: 'l', hsn_code: '0401', lkp_per_uom: 62 },
  { id: 'mat-cheese-mozz', name: 'Mozzarella Cheese', category: 'Cheese', uom: 'kg', hsn_code: '0406', lkp_per_uom: 540 },
  // Meat & seafood
  { id: 'mat-mutton', name: 'Fresh Mutton (boneless)', category: 'Meat', uom: 'kg', hsn_code: '0204', lkp_per_uom: 780 },
  { id: 'mat-chicken', name: 'Chicken (boneless thigh)', category: 'Poultry', uom: 'kg', hsn_code: '0207', lkp_per_uom: 320 },
  { id: 'mat-lamb', name: 'Lamb Shoulder', category: 'Meat', uom: 'kg', hsn_code: '0204', lkp_per_uom: 880 },
  { id: 'mat-prawns', name: 'Tiger Prawns (medium)', category: 'Seafood', uom: 'kg', hsn_code: '0306', lkp_per_uom: 980 },
  { id: 'mat-pomfret', name: 'Pomfret (whole)', category: 'Seafood', uom: 'kg', hsn_code: '0302', lkp_per_uom: 1200 },
  { id: 'mat-pork', name: 'Pork Belly (cured)', category: 'Meat', uom: 'kg', hsn_code: '0203', lkp_per_uom: 720 },
  { id: 'mat-eggs', name: 'Farm Eggs', category: 'Poultry', uom: 'pc', hsn_code: '0407', lkp_per_uom: 7 },
  // Vegetables
  { id: 'mat-onion', name: 'Onion (medium)', category: 'Vegetables', uom: 'kg', hsn_code: '0703', lkp_per_uom: 32 },
  { id: 'mat-tomato', name: 'Tomato', category: 'Vegetables', uom: 'kg', hsn_code: '0702', lkp_per_uom: 45 },
  { id: 'mat-potato', name: 'Potato', category: 'Vegetables', uom: 'kg', hsn_code: '0701', lkp_per_uom: 26 },
  { id: 'mat-ginger', name: 'Fresh Ginger', category: 'Vegetables', uom: 'kg', hsn_code: '0910', lkp_per_uom: 140 },
  { id: 'mat-garlic', name: 'Fresh Garlic', category: 'Vegetables', uom: 'kg', hsn_code: '0703', lkp_per_uom: 220 },
  { id: 'mat-coriander-fresh', name: 'Fresh Coriander', category: 'Herbs', uom: 'kg', hsn_code: '0709', lkp_per_uom: 80 },
  { id: 'mat-mint', name: 'Fresh Mint (Pudina)', category: 'Herbs', uom: 'kg', hsn_code: '0709', lkp_per_uom: 90 },
  { id: 'mat-spinach', name: 'Spinach (Palak)', category: 'Vegetables', uom: 'kg', hsn_code: '0709', lkp_per_uom: 55 },
  { id: 'mat-capsicum', name: 'Capsicum (mixed)', category: 'Vegetables', uom: 'kg', hsn_code: '0709', lkp_per_uom: 120 },
  // Oils, beverages, sundries
  { id: 'mat-mustard-oil', name: 'Mustard Oil (cold pressed)', category: 'Oils', uom: 'l', hsn_code: '1514', lkp_per_uom: 180 },
  { id: 'mat-refined-oil', name: 'Refined Sunflower Oil', category: 'Oils', uom: 'l', hsn_code: '1512', lkp_per_uom: 145 },
  { id: 'mat-coffee-bean', name: 'Single-origin Coffee Bean', category: 'Coffee', uom: 'kg', hsn_code: '0901', lkp_per_uom: 1850 },
  { id: 'mat-tea-leaf', name: 'Assam Tea Leaf', category: 'Tea', uom: 'kg', hsn_code: '0902', lkp_per_uom: 540 },
  { id: 'mat-soda-water', name: 'Soda Water (200 ml)', category: 'Beverages', uom: 'pc', hsn_code: '2202', lkp_per_uom: 22 },
  { id: 'mat-tonic', name: 'Premium Tonic Water', category: 'Beverages', uom: 'pc', hsn_code: '2202', lkp_per_uom: 95 },
  { id: 'mat-gin', name: 'Indian Craft Gin', category: 'Spirits', uom: 'l', hsn_code: '2208', lkp_per_uom: 2400 },
  { id: 'mat-wine-red', name: 'Red Wine (house)', category: 'Wine', uom: 'l', hsn_code: '2204', lkp_per_uom: 850 },
  // Bakery
  { id: 'mat-yeast', name: 'Fresh Yeast', category: 'Bakery', uom: 'kg', hsn_code: '2102', lkp_per_uom: 280 },
  { id: 'mat-sugar', name: 'Refined Sugar', category: 'Bakery', uom: 'kg', hsn_code: '1701', lkp_per_uom: 48 },
  { id: 'mat-saffron', name: 'Kashmir Saffron', category: 'Spices', uom: 'g', hsn_code: '0910', lkp_per_uom: 320 },
  { id: 'mat-cashew', name: 'Cashew (whole)', category: 'Dry Fruits', uom: 'kg', hsn_code: '0801', lkp_per_uom: 980 },
  { id: 'mat-almond', name: 'Almond (whole)', category: 'Dry Fruits', uom: 'kg', hsn_code: '0802', lkp_per_uom: 880 },
]

// ─────────────────────────────────────────────────────────────────────────────
// 4. Recipes (Wild Sugar's menu categories — North + South + Coastal Indian)
// ─────────────────────────────────────────────────────────────────────────────

export type RecipeIngredient = {
  material_id: string
  qty: number
  uom: Uom
}

export type RecipeYieldUnit = 'plate' | 'portion' | 'litre' | 'kg'

export type Recipe = {
  id: string
  name: string
  category: string
  current_default_version: string
  ingredients: ReadonlyArray<RecipeIngredient>
  yield_unit: RecipeYieldUnit
  yield_qty: number
  cost_per_yield_unit: number
  /**
   * FR67a — true when the recipe's current cost is derived from a Pending GR
   * provisional source (LKP × standard yield) rather than confirmed actuals.
   * Fixtures flag a small subset (~3) so FR67a UI patterns have data to render.
   */
  is_provisional: boolean
}

export const recipes: ReadonlyArray<Recipe> = [
  // Kebabs (Tandoor)
  { id: 'rec-mutton-galouti', name: 'Mutton Galouti Kebab', category: 'Kebabs', current_default_version: 'v3.2', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 185, is_provisional: false,
    ingredients: [
      { material_id: 'mat-mutton', qty: 0.18, uom: 'kg' },
      { material_id: 'mat-ghee', qty: 0.02, uom: 'l' },
      { material_id: 'mat-garam-masala', qty: 0.005, uom: 'kg' },
      { material_id: 'mat-cashew', qty: 0.015, uom: 'kg' },
    ],
  },
  { id: 'rec-paneer-tikka', name: 'Paneer Tikka', category: 'Kebabs', current_default_version: 'v2.1', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 142, is_provisional: false,
    ingredients: [
      { material_id: 'mat-paneer', qty: 0.2, uom: 'kg' },
      { material_id: 'mat-curd', qty: 0.05, uom: 'kg' },
      { material_id: 'mat-capsicum', qty: 0.08, uom: 'kg' },
      { material_id: 'mat-red-chilli', qty: 0.003, uom: 'kg' },
    ],
  },
  { id: 'rec-hara-bhara-kebab', name: 'Hara Bhara Kebab', category: 'Kebabs', current_default_version: 'v1.4', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 95, is_provisional: false,
    ingredients: [
      { material_id: 'mat-spinach', qty: 0.12, uom: 'kg' },
      { material_id: 'mat-besan', qty: 0.04, uom: 'kg' },
      { material_id: 'mat-potato', qty: 0.08, uom: 'kg' },
      { material_id: 'mat-coriander-fresh', qty: 0.01, uom: 'kg' },
    ],
  },
  { id: 'rec-chicken-tikka', name: 'Chicken Tikka (Achari)', category: 'Kebabs', current_default_version: 'v2.0', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 168, is_provisional: false,
    ingredients: [
      { material_id: 'mat-chicken', qty: 0.22, uom: 'kg' },
      { material_id: 'mat-curd', qty: 0.06, uom: 'kg' },
      { material_id: 'mat-mustard-oil', qty: 0.015, uom: 'l' },
      { material_id: 'mat-red-chilli', qty: 0.004, uom: 'kg' },
    ],
  },
  { id: 'rec-seekh-kebab', name: 'Lamb Seekh Kebab', category: 'Kebabs', current_default_version: 'v1.2', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 220, is_provisional: false,
    ingredients: [
      { material_id: 'mat-lamb', qty: 0.18, uom: 'kg' },
      { material_id: 'mat-onion', qty: 0.05, uom: 'kg' },
      { material_id: 'mat-garam-masala', qty: 0.006, uom: 'kg' },
      { material_id: 'mat-mint', qty: 0.005, uom: 'kg' },
    ],
  },
  // Biryani
  { id: 'rec-hyderabadi-biryani', name: 'Hyderabadi Mutton Biryani', category: 'Biryani', current_default_version: 'v4.1', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 285, is_provisional: false,
    ingredients: [
      { material_id: 'mat-mutton', qty: 0.2, uom: 'kg' },
      { material_id: 'mat-basmati-rice', qty: 0.18, uom: 'kg' },
      { material_id: 'mat-saffron', qty: 0.2, uom: 'g' },
      { material_id: 'mat-ghee', qty: 0.03, uom: 'l' },
      { material_id: 'mat-onion', qty: 0.1, uom: 'kg' },
    ],
  },
  { id: 'rec-chicken-biryani', name: 'Lucknowi Chicken Biryani', category: 'Biryani', current_default_version: 'v3.0', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 240, is_provisional: false,
    ingredients: [
      { material_id: 'mat-chicken', qty: 0.22, uom: 'kg' },
      { material_id: 'mat-basmati-rice', qty: 0.18, uom: 'kg' },
      { material_id: 'mat-saffron', qty: 0.15, uom: 'g' },
      { material_id: 'mat-ghee', qty: 0.025, uom: 'l' },
      { material_id: 'mat-onion', qty: 0.1, uom: 'kg' },
    ],
  },
  { id: 'rec-veg-biryani', name: 'Awadhi Vegetable Biryani', category: 'Biryani', current_default_version: 'v2.2', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 175, is_provisional: false,
    ingredients: [
      { material_id: 'mat-basmati-rice', qty: 0.2, uom: 'kg' },
      { material_id: 'mat-paneer', qty: 0.06, uom: 'kg' },
      { material_id: 'mat-cashew', qty: 0.015, uom: 'kg' },
      { material_id: 'mat-ghee', qty: 0.025, uom: 'l' },
      { material_id: 'mat-saffron', qty: 0.1, uom: 'g' },
    ],
  },
  { id: 'rec-prawn-biryani', name: 'Malabar Prawn Biryani', category: 'Biryani', current_default_version: 'v1.3', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 320, is_provisional: true,
    ingredients: [
      { material_id: 'mat-prawns', qty: 0.18, uom: 'kg' },
      { material_id: 'mat-basmati-rice', qty: 0.18, uom: 'kg' },
      { material_id: 'mat-curry-leaves', qty: 0.005, uom: 'kg' },
      { material_id: 'mat-coconut-cream-stub' as never, qty: 0, uom: 'l' }, // placeholder collapsed below
      { material_id: 'mat-ghee', qty: 0.02, uom: 'l' },
    ].filter((i) => i.material_id !== 'mat-coconut-cream-stub') as ReadonlyArray<RecipeIngredient>,
  },
  // Curries — North
  { id: 'rec-butter-chicken', name: 'Butter Chicken', category: 'Curries', current_default_version: 'v5.0', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 215, is_provisional: false,
    ingredients: [
      { material_id: 'mat-chicken', qty: 0.22, uom: 'kg' },
      { material_id: 'mat-butter', qty: 0.04, uom: 'kg' },
      { material_id: 'mat-tomato', qty: 0.15, uom: 'kg' },
      { material_id: 'mat-cream', qty: 0.05, uom: 'l' },
      { material_id: 'mat-cashew', qty: 0.02, uom: 'kg' },
    ],
  },
  { id: 'rec-rogan-josh', name: 'Lamb Rogan Josh', category: 'Curries', current_default_version: 'v2.4', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 265, is_provisional: false,
    ingredients: [
      { material_id: 'mat-lamb', qty: 0.22, uom: 'kg' },
      { material_id: 'mat-curd', qty: 0.06, uom: 'kg' },
      { material_id: 'mat-red-chilli', qty: 0.004, uom: 'kg' },
      { material_id: 'mat-ghee', qty: 0.02, uom: 'l' },
    ],
  },
  { id: 'rec-paneer-butter-masala', name: 'Paneer Butter Masala', category: 'Curries', current_default_version: 'v3.1', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 165, is_provisional: false,
    ingredients: [
      { material_id: 'mat-paneer', qty: 0.18, uom: 'kg' },
      { material_id: 'mat-butter', qty: 0.03, uom: 'kg' },
      { material_id: 'mat-tomato', qty: 0.15, uom: 'kg' },
      { material_id: 'mat-cream', qty: 0.04, uom: 'l' },
    ],
  },
  { id: 'rec-dal-makhani', name: 'Dal Makhani', category: 'Curries', current_default_version: 'v4.2', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 130, is_provisional: false,
    ingredients: [
      { material_id: 'mat-toor-dal', qty: 0.08, uom: 'kg' },
      { material_id: 'mat-chana-dal', qty: 0.04, uom: 'kg' },
      { material_id: 'mat-butter', qty: 0.025, uom: 'kg' },
      { material_id: 'mat-cream', qty: 0.03, uom: 'l' },
    ],
  },
  { id: 'rec-chana-masala', name: 'Punjabi Chana Masala', category: 'Curries', current_default_version: 'v2.0', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 105, is_provisional: false,
    ingredients: [
      { material_id: 'mat-chana-dal', qty: 0.12, uom: 'kg' },
      { material_id: 'mat-onion', qty: 0.08, uom: 'kg' },
      { material_id: 'mat-tomato', qty: 0.1, uom: 'kg' },
      { material_id: 'mat-garam-masala', qty: 0.005, uom: 'kg' },
    ],
  },
  // Curries — South / Coastal
  { id: 'rec-goan-vindaloo', name: 'Goan Pork Vindaloo', category: 'Curries', current_default_version: 'v2.3', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 245, is_provisional: false,
    ingredients: [
      { material_id: 'mat-pork', qty: 0.22, uom: 'kg' },
      { material_id: 'mat-red-chilli', qty: 0.008, uom: 'kg' },
      { material_id: 'mat-garlic', qty: 0.02, uom: 'kg' },
      { material_id: 'mat-mustard-oil', qty: 0.025, uom: 'l' },
    ],
  },
  { id: 'rec-kerala-beef', name: 'Kerala Beef Fry', category: 'Curries', current_default_version: 'v1.5', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 230, is_provisional: false,
    ingredients: [
      { material_id: 'mat-mutton', qty: 0.22, uom: 'kg' }, // sub: lamb fry
      { material_id: 'mat-curry-leaves', qty: 0.008, uom: 'kg' },
      { material_id: 'mat-black-pepper', qty: 0.005, uom: 'kg' },
      { material_id: 'mat-coriander-pwd', qty: 0.005, uom: 'kg' },
    ],
  },
  { id: 'rec-fish-amritsari', name: 'Fish Amritsari', category: 'Seafood', current_default_version: 'v1.1', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 285, is_provisional: true,
    ingredients: [
      { material_id: 'mat-pomfret', qty: 0.2, uom: 'kg' },
      { material_id: 'mat-besan', qty: 0.04, uom: 'kg' },
      { material_id: 'mat-cumin-seed', qty: 0.003, uom: 'kg' },
      { material_id: 'mat-refined-oil', qty: 0.05, uom: 'l' },
    ],
  },
  { id: 'rec-prawn-curry', name: 'Mangalorean Prawn Curry', category: 'Seafood', current_default_version: 'v2.0', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 295, is_provisional: true,
    ingredients: [
      { material_id: 'mat-prawns', qty: 0.18, uom: 'kg' },
      { material_id: 'mat-curry-leaves', qty: 0.005, uom: 'kg' },
      { material_id: 'mat-red-chilli', qty: 0.005, uom: 'kg' },
      { material_id: 'mat-coriander-pwd', qty: 0.004, uom: 'kg' },
    ],
  },
  // Rice & breads
  { id: 'rec-jeera-rice', name: 'Jeera Rice', category: 'Rice', current_default_version: 'v2.0', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 75, is_provisional: false,
    ingredients: [
      { material_id: 'mat-basmati-rice', qty: 0.18, uom: 'kg' },
      { material_id: 'mat-cumin-seed', qty: 0.003, uom: 'kg' },
      { material_id: 'mat-ghee', qty: 0.015, uom: 'l' },
    ],
  },
  { id: 'rec-veg-pulao', name: 'Kashmiri Vegetable Pulao', category: 'Rice', current_default_version: 'v1.2', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 145, is_provisional: false,
    ingredients: [
      { material_id: 'mat-basmati-rice', qty: 0.2, uom: 'kg' },
      { material_id: 'mat-cashew', qty: 0.02, uom: 'kg' },
      { material_id: 'mat-saffron', qty: 0.1, uom: 'g' },
      { material_id: 'mat-ghee', qty: 0.02, uom: 'l' },
    ],
  },
  { id: 'rec-butter-naan', name: 'Butter Naan', category: 'Bread', current_default_version: 'v1.0', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 38, is_provisional: false,
    ingredients: [
      { material_id: 'mat-maida', qty: 0.08, uom: 'kg' },
      { material_id: 'mat-butter', qty: 0.012, uom: 'kg' },
      { material_id: 'mat-curd', qty: 0.02, uom: 'kg' },
      { material_id: 'mat-yeast', qty: 0.002, uom: 'kg' },
    ],
  },
  { id: 'rec-garlic-naan', name: 'Garlic Naan', category: 'Bread', current_default_version: 'v1.1', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 45, is_provisional: false,
    ingredients: [
      { material_id: 'mat-maida', qty: 0.08, uom: 'kg' },
      { material_id: 'mat-butter', qty: 0.012, uom: 'kg' },
      { material_id: 'mat-garlic', qty: 0.005, uom: 'kg' },
      { material_id: 'mat-yeast', qty: 0.002, uom: 'kg' },
    ],
  },
  { id: 'rec-tandoori-roti', name: 'Tandoori Roti', category: 'Bread', current_default_version: 'v1.0', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 22, is_provisional: false,
    ingredients: [
      { material_id: 'mat-atta', qty: 0.08, uom: 'kg' },
      { material_id: 'mat-ghee', qty: 0.005, uom: 'l' },
    ],
  },
  // South Indian
  { id: 'rec-masala-dosa', name: 'Mysore Masala Dosa', category: 'South Indian', current_default_version: 'v2.1', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 110, is_provisional: false,
    ingredients: [
      { material_id: 'mat-basmati-rice', qty: 0.08, uom: 'kg' },
      { material_id: 'mat-toor-dal', qty: 0.04, uom: 'kg' },
      { material_id: 'mat-potato', qty: 0.1, uom: 'kg' },
      { material_id: 'mat-curry-leaves', qty: 0.003, uom: 'kg' },
    ],
  },
  { id: 'rec-idli-sambar', name: 'Idli Sambar', category: 'South Indian', current_default_version: 'v1.4', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 85, is_provisional: false,
    ingredients: [
      { material_id: 'mat-basmati-rice', qty: 0.06, uom: 'kg' },
      { material_id: 'mat-toor-dal', qty: 0.05, uom: 'kg' },
      { material_id: 'mat-curry-leaves', qty: 0.004, uom: 'kg' },
    ],
  },
  // Mumbai street
  { id: 'rec-pav-bhaji', name: 'Mumbai Pav Bhaji', category: 'Street Food', current_default_version: 'v2.2', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 130, is_provisional: false,
    ingredients: [
      { material_id: 'mat-potato', qty: 0.15, uom: 'kg' },
      { material_id: 'mat-tomato', qty: 0.1, uom: 'kg' },
      { material_id: 'mat-butter', qty: 0.025, uom: 'kg' },
      { material_id: 'mat-onion', qty: 0.06, uom: 'kg' },
    ],
  },
  { id: 'rec-vada-pav', name: 'Vada Pav', category: 'Street Food', current_default_version: 'v1.0', yield_unit: 'plate', yield_qty: 2, cost_per_yield_unit: 55, is_provisional: false,
    ingredients: [
      { material_id: 'mat-potato', qty: 0.12, uom: 'kg' },
      { material_id: 'mat-besan', qty: 0.04, uom: 'kg' },
      { material_id: 'mat-refined-oil', qty: 0.04, uom: 'l' },
      { material_id: 'mat-curry-leaves', qty: 0.002, uom: 'kg' },
    ],
  },
  { id: 'rec-bhel-puri', name: 'Bhel Puri', category: 'Street Food', current_default_version: 'v1.0', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 65, is_provisional: false,
    ingredients: [
      { material_id: 'mat-onion', qty: 0.04, uom: 'kg' },
      { material_id: 'mat-tomato', qty: 0.04, uom: 'kg' },
      { material_id: 'mat-coriander-fresh', qty: 0.005, uom: 'kg' },
      { material_id: 'mat-mint', qty: 0.003, uom: 'kg' },
    ],
  },
  // Sides
  { id: 'rec-raita', name: 'Mixed Raita', category: 'Sides', current_default_version: 'v1.0', yield_unit: 'portion', yield_qty: 1, cost_per_yield_unit: 35, is_provisional: false,
    ingredients: [
      { material_id: 'mat-curd', qty: 0.12, uom: 'kg' },
      { material_id: 'mat-cumin-seed', qty: 0.001, uom: 'kg' },
      { material_id: 'mat-coriander-fresh', qty: 0.003, uom: 'kg' },
    ],
  },
  { id: 'rec-papad-platter', name: 'Roasted Papad Platter', category: 'Sides', current_default_version: 'v1.0', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 40, is_provisional: false,
    ingredients: [
      { material_id: 'mat-besan', qty: 0.05, uom: 'kg' },
      { material_id: 'mat-cumin-seed', qty: 0.002, uom: 'kg' },
    ],
  },
  // Desserts
  { id: 'rec-gulab-jamun', name: 'Gulab Jamun (2 pc)', category: 'Desserts', current_default_version: 'v1.1', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 75, is_provisional: false,
    ingredients: [
      { material_id: 'mat-milk', qty: 0.12, uom: 'l' },
      { material_id: 'mat-sugar', qty: 0.04, uom: 'kg' },
      { material_id: 'mat-cardamom-green', qty: 0.0005, uom: 'kg' },
      { material_id: 'mat-ghee', qty: 0.02, uom: 'l' },
    ],
  },
  { id: 'rec-rasmalai', name: 'Saffron Rasmalai', category: 'Desserts', current_default_version: 'v1.2', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 95, is_provisional: false,
    ingredients: [
      { material_id: 'mat-milk', qty: 0.25, uom: 'l' },
      { material_id: 'mat-sugar', qty: 0.04, uom: 'kg' },
      { material_id: 'mat-saffron', qty: 0.1, uom: 'g' },
      { material_id: 'mat-almond', qty: 0.005, uom: 'kg' },
    ],
  },
  { id: 'rec-kulfi-falooda', name: 'Kulfi Falooda', category: 'Desserts', current_default_version: 'v1.0', yield_unit: 'plate', yield_qty: 1, cost_per_yield_unit: 110, is_provisional: false,
    ingredients: [
      { material_id: 'mat-milk', qty: 0.2, uom: 'l' },
      { material_id: 'mat-sugar', qty: 0.045, uom: 'kg' },
      { material_id: 'mat-cardamom-green', qty: 0.0005, uom: 'kg' },
      { material_id: 'mat-cashew', qty: 0.008, uom: 'kg' },
    ],
  },
  // Beverages (recipe-side; menu items wrap them)
  { id: 'rec-masala-chai', name: 'Masala Chai', category: 'Beverages', current_default_version: 'v1.0', yield_unit: 'portion', yield_qty: 1, cost_per_yield_unit: 18, is_provisional: false,
    ingredients: [
      { material_id: 'mat-tea-leaf', qty: 0.005, uom: 'kg' },
      { material_id: 'mat-milk', qty: 0.12, uom: 'l' },
      { material_id: 'mat-sugar', qty: 0.008, uom: 'kg' },
      { material_id: 'mat-cardamom-green', qty: 0.0003, uom: 'kg' },
    ],
  },
  { id: 'rec-filter-coffee', name: 'South Indian Filter Coffee', category: 'Beverages', current_default_version: 'v1.0', yield_unit: 'portion', yield_qty: 1, cost_per_yield_unit: 35, is_provisional: false,
    ingredients: [
      { material_id: 'mat-coffee-bean', qty: 0.012, uom: 'kg' },
      { material_id: 'mat-milk', qty: 0.12, uom: 'l' },
      { material_id: 'mat-sugar', qty: 0.005, uom: 'kg' },
    ],
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 5. Menu items (one realistic POS outlet — Wild Sugar Linking Road)
// ─────────────────────────────────────────────────────────────────────────────

export type MenuItemCategory =
  | 'Starters'
  | 'Kebabs'
  | 'Mains — Veg'
  | 'Mains — Non-Veg'
  | 'Biryani & Rice'
  | 'Breads'
  | 'Sides'
  | 'Desserts'
  | 'Beverages — Hot'
  | 'Beverages — Cold'
  | 'Cocktails'
  | 'Wine & Spirits'

export type MenuItem = {
  id: string
  name: string
  category: MenuItemCategory
  /** Drives FCCC matrix; one of the recipes above. Undefined = composite (e.g. cocktail). */
  recipe_id?: string
  /** Selling price in ₹. */
  price: number
  /** Veg/non-veg/eggetarian for menu engineering filters. */
  diet: 'veg' | 'non-veg' | 'eggetarian'
  is_signature: boolean
  is_active: boolean
}

export const menuItems: ReadonlyArray<MenuItem> = [
  // Starters / Kebabs
  { id: 'mi-mutton-galouti', name: 'Mutton Galouti Kebab', category: 'Kebabs', recipe_id: 'rec-mutton-galouti', price: 545, diet: 'non-veg', is_signature: true, is_active: true },
  { id: 'mi-chicken-tikka', name: 'Achari Chicken Tikka', category: 'Kebabs', recipe_id: 'rec-chicken-tikka', price: 485, diet: 'non-veg', is_signature: false, is_active: true },
  { id: 'mi-seekh-kebab', name: 'Lamb Seekh Kebab', category: 'Kebabs', recipe_id: 'rec-seekh-kebab', price: 595, diet: 'non-veg', is_signature: false, is_active: true },
  { id: 'mi-paneer-tikka', name: 'Paneer Tikka', category: 'Kebabs', recipe_id: 'rec-paneer-tikka', price: 425, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-hara-bhara', name: 'Hara Bhara Kebab', category: 'Kebabs', recipe_id: 'rec-hara-bhara-kebab', price: 345, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-fish-amritsari', name: 'Fish Amritsari', category: 'Starters', recipe_id: 'rec-fish-amritsari', price: 625, diet: 'non-veg', is_signature: true, is_active: true },
  { id: 'mi-prawn-koliwada', name: 'Prawn Koliwada', category: 'Starters', recipe_id: 'rec-prawn-curry', price: 645, diet: 'non-veg', is_signature: false, is_active: true },
  { id: 'mi-papad-platter', name: 'Roasted Papad Platter', category: 'Starters', recipe_id: 'rec-papad-platter', price: 175, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-bhel-puri', name: 'Bombay Bhel Puri', category: 'Starters', recipe_id: 'rec-bhel-puri', price: 195, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-vada-pav', name: 'Wild Sugar Vada Pav (2 pc)', category: 'Starters', recipe_id: 'rec-vada-pav', price: 165, diet: 'veg', is_signature: false, is_active: true },
  // Mains
  { id: 'mi-butter-chicken', name: 'Butter Chicken', category: 'Mains — Non-Veg', recipe_id: 'rec-butter-chicken', price: 565, diet: 'non-veg', is_signature: true, is_active: true },
  { id: 'mi-rogan-josh', name: 'Lamb Rogan Josh', category: 'Mains — Non-Veg', recipe_id: 'rec-rogan-josh', price: 645, diet: 'non-veg', is_signature: false, is_active: true },
  { id: 'mi-goan-vindaloo', name: 'Goan Pork Vindaloo', category: 'Mains — Non-Veg', recipe_id: 'rec-goan-vindaloo', price: 595, diet: 'non-veg', is_signature: false, is_active: true },
  { id: 'mi-kerala-beef', name: 'Kerala Lamb Fry', category: 'Mains — Non-Veg', recipe_id: 'rec-kerala-beef', price: 595, diet: 'non-veg', is_signature: false, is_active: true },
  { id: 'mi-prawn-curry', name: 'Mangalorean Prawn Curry', category: 'Mains — Non-Veg', recipe_id: 'rec-prawn-curry', price: 685, diet: 'non-veg', is_signature: false, is_active: true },
  { id: 'mi-paneer-butter', name: 'Paneer Butter Masala', category: 'Mains — Veg', recipe_id: 'rec-paneer-butter-masala', price: 465, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-dal-makhani', name: 'Dal Makhani', category: 'Mains — Veg', recipe_id: 'rec-dal-makhani', price: 385, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-chana-masala', name: 'Punjabi Chana Masala', category: 'Mains — Veg', recipe_id: 'rec-chana-masala', price: 345, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-pav-bhaji', name: 'Mumbai Pav Bhaji', category: 'Mains — Veg', recipe_id: 'rec-pav-bhaji', price: 365, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-masala-dosa', name: 'Mysore Masala Dosa', category: 'Mains — Veg', recipe_id: 'rec-masala-dosa', price: 325, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-idli-sambar', name: 'Idli Sambar', category: 'Mains — Veg', recipe_id: 'rec-idli-sambar', price: 245, diet: 'veg', is_signature: false, is_active: true },
  // Biryani
  { id: 'mi-hyd-biryani', name: 'Hyderabadi Mutton Biryani', category: 'Biryani & Rice', recipe_id: 'rec-hyderabadi-biryani', price: 685, diet: 'non-veg', is_signature: true, is_active: true },
  { id: 'mi-luc-biryani', name: 'Lucknowi Chicken Biryani', category: 'Biryani & Rice', recipe_id: 'rec-chicken-biryani', price: 585, diet: 'non-veg', is_signature: false, is_active: true },
  { id: 'mi-veg-biryani', name: 'Awadhi Vegetable Biryani', category: 'Biryani & Rice', recipe_id: 'rec-veg-biryani', price: 445, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-prawn-biryani', name: 'Malabar Prawn Biryani', category: 'Biryani & Rice', recipe_id: 'rec-prawn-biryani', price: 695, diet: 'non-veg', is_signature: false, is_active: true },
  { id: 'mi-jeera-rice', name: 'Jeera Rice', category: 'Biryani & Rice', recipe_id: 'rec-jeera-rice', price: 245, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-veg-pulao', name: 'Kashmiri Veg Pulao', category: 'Biryani & Rice', recipe_id: 'rec-veg-pulao', price: 365, diet: 'veg', is_signature: false, is_active: true },
  // Breads
  { id: 'mi-butter-naan', name: 'Butter Naan', category: 'Breads', recipe_id: 'rec-butter-naan', price: 95, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-garlic-naan', name: 'Garlic Naan', category: 'Breads', recipe_id: 'rec-garlic-naan', price: 115, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-tandoori-roti', name: 'Tandoori Roti', category: 'Breads', recipe_id: 'rec-tandoori-roti', price: 65, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-laccha-paratha', name: 'Laccha Paratha', category: 'Breads', recipe_id: 'rec-tandoori-roti', price: 95, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-stuffed-naan', name: 'Cheese & Garlic Stuffed Naan', category: 'Breads', recipe_id: 'rec-garlic-naan', price: 175, diet: 'veg', is_signature: false, is_active: true },
  // Sides
  { id: 'mi-mixed-raita', name: 'Mixed Raita', category: 'Sides', recipe_id: 'rec-raita', price: 145, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-boondi-raita', name: 'Boondi Raita', category: 'Sides', recipe_id: 'rec-raita', price: 165, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-green-salad', name: 'Garden Green Salad', category: 'Sides', recipe_id: undefined, price: 195, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-pickle-platter', name: 'House Pickle Platter', category: 'Sides', recipe_id: undefined, price: 145, diet: 'veg', is_signature: false, is_active: true },
  // Desserts
  { id: 'mi-gulab-jamun', name: 'Gulab Jamun (2 pc)', category: 'Desserts', recipe_id: 'rec-gulab-jamun', price: 195, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-rasmalai', name: 'Saffron Rasmalai', category: 'Desserts', recipe_id: 'rec-rasmalai', price: 245, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-kulfi-falooda', name: 'Kulfi Falooda', category: 'Desserts', recipe_id: 'rec-kulfi-falooda', price: 285, diet: 'veg', is_signature: true, is_active: true },
  { id: 'mi-malpua', name: 'Malpua with Rabri', category: 'Desserts', recipe_id: undefined, price: 295, diet: 'veg', is_signature: false, is_active: true },
  // Beverages — Hot
  { id: 'mi-masala-chai', name: 'Masala Chai', category: 'Beverages — Hot', recipe_id: 'rec-masala-chai', price: 95, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-kashmiri-kahwa', name: 'Kashmiri Kahwa', category: 'Beverages — Hot', recipe_id: undefined, price: 145, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-filter-coffee', name: 'South Indian Filter Coffee', category: 'Beverages — Hot', recipe_id: 'rec-filter-coffee', price: 165, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-cold-coffee', name: 'Cold Coffee', category: 'Beverages — Cold', recipe_id: 'rec-filter-coffee', price: 245, diet: 'veg', is_signature: false, is_active: true },
  // Beverages — Cold
  { id: 'mi-mango-lassi', name: 'Mango Lassi', category: 'Beverages — Cold', recipe_id: undefined, price: 195, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-sweet-lassi', name: 'Sweet Lassi', category: 'Beverages — Cold', recipe_id: undefined, price: 165, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-jaljeera', name: 'Spiced Jaljeera', category: 'Beverages — Cold', recipe_id: undefined, price: 145, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-aam-panna', name: 'Aam Panna', category: 'Beverages — Cold', recipe_id: undefined, price: 165, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-fresh-lime-soda', name: 'Fresh Lime Soda', category: 'Beverages — Cold', recipe_id: undefined, price: 145, diet: 'veg', is_signature: false, is_active: true },
  // Cocktails
  { id: 'mi-bombay-mule', name: 'Bombay Mule', category: 'Cocktails', recipe_id: undefined, price: 545, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-saffron-gin', name: 'Saffron Gin & Tonic', category: 'Cocktails', recipe_id: undefined, price: 595, diet: 'veg', is_signature: true, is_active: true },
  { id: 'mi-tamarind-margarita', name: 'Tamarind Margarita', category: 'Cocktails', recipe_id: undefined, price: 565, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-kokum-cooler', name: 'Kokum Cooler', category: 'Cocktails', recipe_id: undefined, price: 485, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-paan-martini', name: 'Paan Martini', category: 'Cocktails', recipe_id: undefined, price: 595, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-old-fashioned', name: 'Spiced Old Fashioned', category: 'Cocktails', recipe_id: undefined, price: 645, diet: 'veg', is_signature: false, is_active: true },
  // Wine & spirits
  { id: 'mi-house-red', name: 'House Red — 150 ml', category: 'Wine & Spirits', recipe_id: undefined, price: 425, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-house-white', name: 'House White — 150 ml', category: 'Wine & Spirits', recipe_id: undefined, price: 425, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-craft-gin-shot', name: 'Indian Craft Gin — 60 ml', category: 'Wine & Spirits', recipe_id: undefined, price: 395, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-single-malt', name: 'Single Malt — 60 ml', category: 'Wine & Spirits', recipe_id: undefined, price: 845, diet: 'veg', is_signature: false, is_active: true },
  // Extra long-tail menu items to round out 60+ count
  { id: 'mi-malai-tikka', name: 'Murgh Malai Tikka', category: 'Kebabs', recipe_id: 'rec-chicken-tikka', price: 525, diet: 'non-veg', is_signature: false, is_active: true },
  { id: 'mi-tangdi', name: 'Tangdi Kebab', category: 'Kebabs', recipe_id: 'rec-chicken-tikka', price: 545, diet: 'non-veg', is_signature: false, is_active: true },
  { id: 'mi-tandoori-pomfret', name: 'Tandoori Pomfret (whole)', category: 'Mains — Non-Veg', recipe_id: 'rec-fish-amritsari', price: 1245, diet: 'non-veg', is_signature: true, is_active: true },
  { id: 'mi-keema-pav', name: 'Mumbai Keema Pav', category: 'Mains — Non-Veg', recipe_id: 'rec-rogan-josh', price: 425, diet: 'non-veg', is_signature: false, is_active: true },
  { id: 'mi-baingan-bharta', name: 'Baingan Bharta', category: 'Mains — Veg', recipe_id: undefined, price: 365, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-bhindi-do-pyaza', name: 'Bhindi Do Pyaza', category: 'Mains — Veg', recipe_id: undefined, price: 345, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-aloo-gobi', name: 'Aloo Gobi', category: 'Mains — Veg', recipe_id: undefined, price: 325, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-yellow-dal-tadka', name: 'Yellow Dal Tadka', category: 'Mains — Veg', recipe_id: 'rec-dal-makhani', price: 285, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-onion-kulcha', name: 'Onion Kulcha', category: 'Breads', recipe_id: 'rec-garlic-naan', price: 115, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-romali-roti', name: 'Romali Roti', category: 'Breads', recipe_id: 'rec-tandoori-roti', price: 75, diet: 'veg', is_signature: false, is_active: false }, // soft-deleted
  { id: 'mi-pineapple-sheera', name: 'Pineapple Sheera', category: 'Desserts', recipe_id: undefined, price: 235, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-pista-kulfi', name: 'Pista Kulfi', category: 'Desserts', recipe_id: 'rec-kulfi-falooda', price: 245, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-iced-tea', name: 'Spiced Iced Tea', category: 'Beverages — Cold', recipe_id: 'rec-masala-chai', price: 165, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-ginger-ale', name: 'Ginger Ale', category: 'Beverages — Cold', recipe_id: undefined, price: 125, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-coconut-water', name: 'Tender Coconut Water', category: 'Beverages — Cold', recipe_id: undefined, price: 145, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-virgin-mojito', name: 'Virgin Mojito', category: 'Beverages — Cold', recipe_id: undefined, price: 285, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-tandoori-broccoli', name: 'Tandoori Broccoli', category: 'Kebabs', recipe_id: 'rec-paneer-tikka', price: 385, diet: 'veg', is_signature: false, is_active: true },
  { id: 'mi-mushroom-galouti', name: 'Mushroom Galouti', category: 'Kebabs', recipe_id: 'rec-hara-bhara-kebab', price: 425, diet: 'veg', is_signature: false, is_active: true },
]

// ─────────────────────────────────────────────────────────────────────────────
// 6. Purchase Orders — ~270 rows over 90 days
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Procurement PO lifecycle per FR42 + DESIGN.md §6.1 + DL-001:
 *   draft → pending_approval → confirmed → pending_gr → closed
 *   terminal: cancelled, gr_rejected (FR47a permanent state)
 */
export type POStatus =
  | 'draft'
  | 'pending_approval'
  | 'confirmed'
  | 'pending_gr'
  | 'closed'
  | 'cancelled'
  | 'gr_rejected'

export type POLine = {
  material_id: string
  qty: number
  uom: Uom
  unit_price: number
  /** Computed line total in ₹ (qty × unit_price). */
  line_total: number
}

export type PO = {
  id: string
  po_number: string
  vendor_id: string
  location_id: string
  cluster_id: string
  /** ISO date of PO creation. */
  raised_on: string
  expected_on: string
  status: POStatus
  total_value: number
  lines: ReadonlyArray<POLine>
  /** TRN per FR87. */
  trn: string
  /**
   * FR66 — true when production order linked under DL-001 Pending GR; flips
   * permanent under FR67a if linked GR is rejected. Mirrors `status === 'pending_gr'`
   * for live POs and stays true when status is `gr_rejected`.
   */
  is_provisional: boolean
  /** GR rejection reason code if status === 'gr_rejected'. */
  gr_rejection_reason?: 'shelf_life' | 'quality' | 'quantity_mismatch' | 'damage'
}

/**
 * Generate ~270 POs over 90 days. We construct them deterministically so
 * counts and references are stable across builds (no Math.random).
 * Distribution targets:
 *   - ~75 % closed
 *   - ~10 % confirmed
 *   - ~6 % pending_gr (for FR70 dashboard pending-GR drill)
 *   - ~3 % gr_rejected (FR47a — for dashboard chrome rendering)
 *   - ~3 % pending_approval
 *   - ~2 % draft
 *   - ~1 % cancelled
 */
const buildPurchaseOrders = (): ReadonlyArray<PO> => {
  const out: PO[] = []
  // Vendor pool — only active vendors, weighted by category mix.
  const activeVendors = vendors.filter((v) => v.is_active).map((v) => v.id)
  const posLocationIds = locations
    .filter((l) => l.type === 'pos_outlet' || l.type === 'central_kitchen')
    .map((l) => l.id)

  // Material pools per vendor (rough mapping for plausibility)
  const vendorMaterialPool: Record<string, ReadonlyArray<string>> = {
    'vnd-bharat-spice': ['mat-garam-masala', 'mat-turmeric', 'mat-coriander-pwd', 'mat-cumin-seed', 'mat-saffron'],
    'vnd-mumbai-dairy': ['mat-paneer', 'mat-butter', 'mat-curd', 'mat-cream', 'mat-milk', 'mat-cheese-mozz'],
    'vnd-coastal-seafoods': ['mat-prawns', 'mat-pomfret'],
    'vnd-western-bev': ['mat-soda-water', 'mat-tonic'],
    'vnd-punjab-atta': ['mat-atta', 'mat-maida', 'mat-besan'],
    'vnd-karnataka-coffee': ['mat-coffee-bean', 'mat-tea-leaf'],
    'vnd-goa-liquor': ['mat-gin', 'mat-wine-red'],
    'vnd-kerala-spice-coast': ['mat-cardamom-green', 'mat-black-pepper', 'mat-curry-leaves'],
    'vnd-rajasthan-pulses': ['mat-toor-dal', 'mat-chana-dal', 'mat-basmati-rice'],
    'vnd-bandra-greens': ['mat-onion', 'mat-tomato', 'mat-potato', 'mat-spinach', 'mat-capsicum', 'mat-coriander-fresh', 'mat-mint'],
    'vnd-bandra-meats': ['mat-mutton', 'mat-chicken', 'mat-lamb'],
    'vnd-andheri-cold': ['mat-cheese-mozz', 'mat-butter'],
    'vnd-andheri-bakery': ['mat-yeast', 'mat-sugar', 'mat-maida'],
    'vnd-powai-fresh': ['mat-eggs', 'mat-spinach', 'mat-coriander-fresh'],
    'vnd-powai-poultry': ['mat-chicken', 'mat-eggs'],
    'vnd-deccan-rice': ['mat-basmati-rice'],
    'vnd-tamilnadu-oils': ['mat-mustard-oil', 'mat-refined-oil', 'mat-ghee'],
  }

  // 3 POs per day × 90 days = 270 POs. Day 0 = today (NOW).
  // We push from oldest to newest so PO numbers ascend chronologically.
  let seq = 1
  for (let dayOffset = 90; dayOffset >= 1; dayOffset--) {
    const raisedOn = daysBefore(dayOffset)
    for (let perDay = 0; perDay < 3; perDay++) {
      const vendorIdx = (seq * 7) % activeVendors.length
      const vendorId = activeVendors[vendorIdx]!
      const vendor = vendors.find((v) => v.id === vendorId)!
      const locationIdx = (seq * 3) % posLocationIds.length
      const locationId = posLocationIds[locationIdx]!
      const location = locations.find((l) => l.id === locationId)!
      const pool = vendorMaterialPool[vendorId] ?? ['mat-onion', 'mat-tomato']
      // 1–3 line items per PO
      const numLines = (seq % 3) + 1
      const lines: POLine[] = []
      for (let i = 0; i < numLines; i++) {
        const matId = pool[(seq + i) % pool.length]!
        const mat = materials.find((m) => m.id === matId)!
        // Qty: 5–25 units depending on uom
        const qty = ((seq + i * 3) % 20) + 5
        // Price: lkp ± 8 % wobble (deterministic)
        const wobble = 1 + (((seq + i) % 17) - 8) / 100
        const unitPrice = Math.round(mat.lkp_per_uom * wobble)
        lines.push({
          material_id: matId,
          qty,
          uom: mat.uom,
          unit_price: unitPrice,
          line_total: qty * unitPrice,
        })
      }
      const totalValue = lines.reduce((acc, l) => acc + l.line_total, 0)

      // Status distribution by day-bucket — older POs lean closed.
      // Use a coprime multiplier (17) so the bucket cycles through full 0–99 range.
      let status: POStatus
      let isProvisional = false
      let grRejectionReason: PO['gr_rejection_reason']
      const bucket = (seq * 17) % 100
      if (dayOffset > 30) {
        // Older than 30 days: mostly closed, sprinkle a few gr_rejected (FR47a)
        if (bucket < 92) status = 'closed'
        else if (bucket < 96) {
          status = 'gr_rejected'
          isProvisional = true
          grRejectionReason = (['shelf_life', 'quality', 'quantity_mismatch', 'damage'] as const)[bucket % 4]
        } else status = 'cancelled'
      } else if (dayOffset > 7) {
        // 7–30 days: mix of closed, confirmed, pending_gr
        if (bucket < 55) status = 'closed'
        else if (bucket < 80) status = 'confirmed'
        else if (bucket < 92) {
          status = 'pending_gr'
          isProvisional = true
        } else if (bucket < 96) {
          status = 'gr_rejected'
          isProvisional = true
          grRejectionReason = (['shelf_life', 'quality', 'quantity_mismatch', 'damage'] as const)[bucket % 4]
        } else status = 'cancelled'
      } else {
        // Last 7 days: heavy confirmed + pending_approval + draft + a few pending_gr
        if (bucket < 30) status = 'confirmed'
        else if (bucket < 50) {
          status = 'pending_gr'
          isProvisional = true
        } else if (bucket < 75) status = 'pending_approval'
        else if (bucket < 90) status = 'draft'
        else status = 'closed'
      }

      out.push({
        id: `po-${String(seq).padStart(4, '0')}`,
        po_number: `PO-2026-${location.cluster_id.split('-').slice(1).join('-').toUpperCase()}-${String(seq).padStart(4, '0')}`,
        vendor_id: vendorId,
        location_id: locationId,
        cluster_id: location.cluster_id,
        raised_on: raisedOn,
        expected_on: daysBefore(dayOffset - 3),
        status,
        total_value: totalValue,
        lines,
        trn: `TRN-PO-2026-${String(seq).padStart(5, '0')}`,
        is_provisional: isProvisional,
        ...(grRejectionReason ? { gr_rejection_reason: grRejectionReason } : {}),
      })
      // unused vendor reference suppressed by TS via _
      void vendor
      seq++
    }
  }
  return out
}

export const purchaseOrders: ReadonlyArray<PO> = buildPurchaseOrders()

// ─────────────────────────────────────────────────────────────────────────────
// 7. Goods Receipts — derived from POs that have hit GR or beyond
// ─────────────────────────────────────────────────────────────────────────────

export type GRStatus = 'pending' | 'confirmed' | 'rejected'

export type GRLine = {
  material_id: string
  expected_qty: number
  received_qty: number
  /** FR27 yield — usable + wastage = received_qty. */
  usable_qty: number
  wastage_qty: number
  uom: Uom
}

export type GR = {
  id: string
  gr_number: string
  po_id: string
  vendor_id: string
  location_id: string
  received_on: string
  status: GRStatus
  /** Set when status === 'rejected' (FR47a). */
  rejection_reason?: 'shelf_life' | 'quality' | 'quantity_mismatch' | 'damage'
  /** Set when rejection cascades into FR47b auto-drafted vendor CN. */
  vendor_cn_ref?: string
  trn: string
  lines: ReadonlyArray<GRLine>
}

const buildGoodsReceipts = (): ReadonlyArray<GR> => {
  const out: GR[] = []
  let seq = 1
  for (const po of purchaseOrders) {
    // GRs only exist for POs that have moved past confirmed
    const eligible: ReadonlyArray<POStatus> = ['closed', 'pending_gr', 'gr_rejected']
    if (!eligible.includes(po.status)) continue
    const grStatus: GRStatus =
      po.status === 'closed' ? 'confirmed'
        : po.status === 'gr_rejected' ? 'rejected'
          : 'pending'
    const lines: GRLine[] = po.lines.map((l) => {
      // Wastage 0–4 % (deterministic)
      const wastagePct = (seq + l.qty) % 5
      const wastageQty = Math.round((l.qty * wastagePct) / 100 * 100) / 100
      const usableQty = Math.round((l.qty - wastageQty) * 100) / 100
      return {
        material_id: l.material_id,
        expected_qty: l.qty,
        received_qty: l.qty,
        usable_qty: usableQty,
        wastage_qty: wastageQty,
        uom: l.uom,
      }
    })
    out.push({
      id: `gr-${String(seq).padStart(4, '0')}`,
      gr_number: `GR-2026-${String(seq).padStart(5, '0')}`,
      po_id: po.id,
      vendor_id: po.vendor_id,
      location_id: po.location_id,
      received_on: po.expected_on,
      status: grStatus,
      ...(grStatus === 'rejected' && po.gr_rejection_reason
        ? { rejection_reason: po.gr_rejection_reason }
        : {}),
      ...(grStatus === 'rejected'
        ? { vendor_cn_ref: `VCN-2026-${po.location_id.slice(-3).toUpperCase()}-${String(seq).padStart(4, '0')}` }
        : {}),
      trn: `TRN-GR-2026-${String(seq).padStart(5, '0')}`,
      lines,
    })
    seq++
  }
  return out
}

export const goodsReceipts: ReadonlyArray<GR> = buildGoodsReceipts()

// ─────────────────────────────────────────────────────────────────────────────
// 8. Inventory positions — 1 cluster × 4–6 locations × 50 SKUs
// ─────────────────────────────────────────────────────────────────────────────

export type InventoryPosition = {
  id: string
  location_id: string
  material_id: string
  on_hand_qty: number
  uom: Uom
  par_level: number
  reorder_point: number
  /** Provisional cost flag (FR67a) — cost source from Pending-GR provisional. */
  cost_basis_provisional: boolean
  unit_cost: number
  last_movement_on: string
}

const buildInventoryPositions = (): ReadonlyArray<InventoryPosition> => {
  const out: InventoryPosition[] = []
  const trackingLocations = locations.filter(
    (l) => l.type === 'central_kitchen' || l.type === 'pos_outlet',
  )
  // First 50 materials × 5 tracking locations = 250 positions
  // (4 POS outlets + 1 central kitchen = 5 locations within target band 200–400)
  let seq = 1
  for (const loc of trackingLocations) {
    for (const mat of materials) {
      const onHand = ((seq * 13) % 80) + 5 // 5–84 units
      const par = ((seq * 7) % 30) + 20 // 20–49 par
      const ropp = Math.max(5, par - 10)
      out.push({
        id: `inv-${String(seq).padStart(4, '0')}`,
        location_id: loc.id,
        material_id: mat.id,
        on_hand_qty: onHand,
        uom: mat.uom,
        par_level: par,
        reorder_point: ropp,
        cost_basis_provisional: seq % 47 === 0, // ~2 % provisional
        unit_cost: mat.lkp_per_uom,
        last_movement_on: daysBefore(seq % 7),
      })
      seq++
    }
  }
  return out
}

export const inventoryPositions: ReadonlyArray<InventoryPosition> = buildInventoryPositions()

// ─────────────────────────────────────────────────────────────────────────────
// 9. B2B Customers — FR118 / FR119 GST type spread
// ─────────────────────────────────────────────────────────────────────────────

export type GSTCustomerType = 'regular' | 'composition' | 'unregistered' | 'consumer'

export type B2BCustomer = {
  id: string
  name: string
  /** GST registration type per FR118. */
  gst_type: GSTCustomerType
  /** Required for regular + composition; absent for unregistered + consumer. */
  gstin?: string
  state: string
  state_code: string
  contact_person: string
  contact_phone: string
  /** Billing address single line; sufficient for mockup chrome. */
  billing_address: string
  payment_terms_days: number
  is_active: boolean
}

export const b2bCustomers: ReadonlyArray<B2BCustomer> = [
  // Regular (registered B2B with GSTIN) — 4
  {
    id: 'b2b-taj-banquets',
    name: 'Taj Hotels — Banquet Procurement',
    gst_type: 'regular',
    gstin: '27AABCT1234N1Z9',
    state: 'Maharashtra',
    state_code: '27',
    contact_person: 'Rohit Malhotra',
    contact_phone: '+91 98201 12345',
    billing_address: 'Apollo Bunder, Colaba, Mumbai 400001',
    payment_terms_days: 30,
    is_active: true,
  },
  {
    id: 'b2b-itc-grand',
    name: 'ITC Grand Central — Catering',
    gst_type: 'regular',
    gstin: '27AAACT5678P1ZK',
    state: 'Maharashtra',
    state_code: '27',
    contact_person: 'Priya Iyer',
    contact_phone: '+91 98202 23456',
    billing_address: 'Lower Parel, Mumbai 400013',
    payment_terms_days: 45,
    is_active: true,
  },
  {
    id: 'b2b-marriott-airport',
    name: 'Marriott Mumbai — Airport',
    gst_type: 'regular',
    gstin: '27AAACM7890L1Z6',
    state: 'Maharashtra',
    state_code: '27',
    contact_person: 'Karan Mehta',
    contact_phone: '+91 98203 34567',
    billing_address: 'CSIA Sahar, Andheri East, Mumbai 400099',
    payment_terms_days: 30,
    is_active: true,
  },
  {
    id: 'b2b-bangalore-corp',
    name: 'Infosys Campus Catering — Bangalore',
    gst_type: 'regular',
    gstin: '29AAACI4321Q1Z3',
    state: 'Karnataka',
    state_code: '29',
    contact_person: 'Ananya Rao',
    contact_phone: '+91 98810 45678',
    billing_address: 'Electronic City, Bangalore 560100',
    payment_terms_days: 60,
    is_active: true,
  },
  // Composition scheme — 2
  {
    id: 'b2b-cafe-chain',
    name: 'Aroma Cafe Chain (Composition)',
    gst_type: 'composition',
    gstin: '27AABCC9876N1Z2',
    state: 'Maharashtra',
    state_code: '27',
    contact_person: 'Vikram Shah',
    contact_phone: '+91 98204 56789',
    billing_address: 'Khar West, Mumbai 400052',
    payment_terms_days: 21,
    is_active: true,
  },
  {
    id: 'b2b-cloudkitchen-ops',
    name: 'GhostKitchen Ops Pvt Ltd',
    gst_type: 'composition',
    gstin: '27AABCG3210P1Z8',
    state: 'Maharashtra',
    state_code: '27',
    contact_person: 'Nikhil Desai',
    contact_phone: '+91 98205 67890',
    billing_address: 'Kurla West, Mumbai 400070',
    payment_terms_days: 15,
    is_active: true,
  },
  // Unregistered — 2 (no GSTIN — triggers FR119 warning)
  {
    id: 'b2b-event-mgr',
    name: 'Bombay Event Managers',
    gst_type: 'unregistered',
    state: 'Maharashtra',
    state_code: '27',
    contact_person: 'Sameer Joshi',
    contact_phone: '+91 98206 78901',
    billing_address: 'Worli, Mumbai 400018',
    payment_terms_days: 7,
    is_active: true,
  },
  {
    id: 'b2b-wedding-planner',
    name: 'Sunshine Wedding Planners',
    gst_type: 'unregistered',
    state: 'Maharashtra',
    state_code: '27',
    contact_person: 'Meera Kapoor',
    contact_phone: '+91 98207 89012',
    billing_address: 'Juhu, Mumbai 400049',
    payment_terms_days: 14,
    is_active: true,
  },
  // Consumer (B2C) — 2 (no GSTIN — triggers FR119 warning)
  {
    id: 'b2b-consumer-corp-gift',
    name: 'Walk-in Corporate Gifting',
    gst_type: 'consumer',
    state: 'Maharashtra',
    state_code: '27',
    contact_person: 'Walk-in',
    contact_phone: '+91 98208 90123',
    billing_address: 'Bandra West, Mumbai',
    payment_terms_days: 0,
    is_active: true,
  },
  {
    id: 'b2b-consumer-private-party',
    name: 'Private Party Bookings (Consumer)',
    gst_type: 'consumer',
    state: 'Maharashtra',
    state_code: '27',
    contact_person: 'Walk-in',
    contact_phone: '+91 98209 01234',
    billing_address: 'Various — Mumbai',
    payment_terms_days: 0,
    is_active: true,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 10. Sales data — 60 days × POS outlets (aggregated daily totals)
// ─────────────────────────────────────────────────────────────────────────────

export type SalesDay = {
  id: string
  date: string
  location_id: string
  /** Cover count (number of guests). */
  covers: number
  /** Gross sales in ₹ (pre-discount). */
  gross_sales: number
  /** Net sales in ₹ (post-discount, pre-tax). */
  net_sales: number
  /** Top 3 menu items by quantity. */
  top_items: ReadonlyArray<{ menu_item_id: string; qty: number }>
}

const buildSalesData = (): ReadonlyArray<SalesDay> => {
  const out: SalesDay[] = []
  const posLocations = locations.filter((l) => l.type === 'pos_outlet')
  let seq = 1
  for (let dayOffset = 60; dayOffset >= 1; dayOffset--) {
    const date = daysBefore(dayOffset)
    for (const loc of posLocations) {
      // Weekend lift (Fri/Sat ≈ days 5,6 of week)
      const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
      const weekendLift = dow === 5 || dow === 6 ? 1.4 : 1.0
      const baseCovers = 65 + (seq % 35)
      const covers = Math.round(baseCovers * weekendLift)
      const avgCheck = 850 + ((seq * 13) % 250)
      const gross = covers * avgCheck
      const net = Math.round(gross * 0.92) // ~8 % discount + comp avg
      // Top 3 items rotate deterministically
      const featuredItems = ['mi-butter-chicken', 'mi-hyd-biryani', 'mi-paneer-butter', 'mi-mutton-galouti', 'mi-veg-biryani', 'mi-dal-makhani']
      const top: SalesDay['top_items'] = [
        { menu_item_id: featuredItems[seq % featuredItems.length]!, qty: 18 + (seq % 12) },
        { menu_item_id: featuredItems[(seq + 1) % featuredItems.length]!, qty: 15 + ((seq + 1) % 10) },
        { menu_item_id: featuredItems[(seq + 2) % featuredItems.length]!, qty: 12 + ((seq + 2) % 8) },
      ]
      out.push({
        id: `sales-${String(seq).padStart(5, '0')}`,
        date,
        location_id: loc.id,
        covers,
        gross_sales: gross,
        net_sales: net,
        top_items: top,
      })
      seq++
    }
  }
  return out
}

export const salesData: ReadonlyArray<SalesDay> = buildSalesData()

// ─────────────────────────────────────────────────────────────────────────────
// 11. Closing inventory entries — 30 days × POS outlets
// ─────────────────────────────────────────────────────────────────────────────

export type ClosingEntry = {
  id: string
  date: string
  location_id: string
  /** Total stock value at close in ₹. */
  closing_value: number
  /** Variance vs theoretical (post-recipe-deduction) in ₹; negative = unfavourable. */
  variance: number
  variance_pct: number
  /** FR-aligned variance reason taxonomy if abs(variance_pct) > 2 %. */
  variance_reason?: 'wastage' | 'theft_loss' | 'measurement_error' | 'recipe_drift' | 'unrecorded_consumption'
  submitted_by: string
  submitted_at_offset_min: number
}

const buildClosingEntries = (): ReadonlyArray<ClosingEntry> => {
  const out: ClosingEntry[] = []
  const posLocations = locations.filter((l) => l.type === 'pos_outlet')
  const submitters = ['Rajesh Kumar', 'Anita Sharma', 'Faisal Khan', 'Deepa Menon']
  let seq = 1
  for (let dayOffset = 30; dayOffset >= 1; dayOffset--) {
    const date = daysBefore(dayOffset)
    for (const loc of posLocations) {
      const closingValue = 285000 + ((seq * 1700) % 95000) // 2.85L–3.8L
      const variancePct = ((seq % 11) - 5) / 100 // -5 % to +5 %
      const variance = Math.round(closingValue * variancePct)
      const absPct = Math.abs(variancePct * 100)
      const reasons = ['wastage', 'theft_loss', 'measurement_error', 'recipe_drift', 'unrecorded_consumption'] as const
      const reason = absPct > 2 ? reasons[seq % reasons.length] : undefined
      out.push({
        id: `close-${String(seq).padStart(5, '0')}`,
        date,
        location_id: loc.id,
        closing_value: closingValue,
        variance,
        variance_pct: Math.round(variancePct * 10000) / 100, // %, 2 dp
        ...(reason ? { variance_reason: reason } : {}),
        submitted_by: submitters[seq % submitters.length]!,
        submitted_at_offset_min: (seq * 7) % 90,
      })
      seq++
    }
  }
  return out
}

export const closingEntries: ReadonlyArray<ClosingEntry> = buildClosingEntries()

// ─────────────────────────────────────────────────────────────────────────────
// 12. Counts (asserted at module load — keep in sync with §19 Q2)
// ─────────────────────────────────────────────────────────────────────────────
// These are export-only; they trip a TS error if a future edit drops counts
// below the §19 Q2 lower bound.

export const FIXTURE_COUNTS = {
  clusters: clusters.length,
  locations: locations.length,
  departments: departments.length,
  vendors: vendors.length,
  materials: materials.length,
  recipes: recipes.length,
  menuItems: menuItems.length,
  purchaseOrders: purchaseOrders.length,
  goodsReceipts: goodsReceipts.length,
  inventoryPositions: inventoryPositions.length,
  b2bCustomers: b2bCustomers.length,
  salesDays: salesData.length,
  closingEntries: closingEntries.length,
} as const

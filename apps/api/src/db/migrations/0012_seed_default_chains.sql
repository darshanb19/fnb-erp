-- =============================================================================
-- 0012_seed_default_chains.sql — Phase 4 Epic 3 INF Arc (a) Task A5
-- Seed 5 default approval chains for FR-named entities (DL-036).
--
-- Hand-authored sidecar — NOT registered in meta/_journal.json. Apply via psql
-- to fnberp_dev (bootstrap BO present); via Supabase MCP to fnberp-prod.
--
-- The CTE-driven INSERT pattern is no-op-safe: if the bootstrap BO is absent
-- (fnberp_test, fresh dev DBs without bootstrap script run), the SELECT
-- returns 0 rows and INSERT writes 0 chains. Tests author their own chains
-- via approvalEngine.configureChain() for fixture brands.
--
-- Brand Owner can edit thresholds + step structure post-seed via SI-INF-002
-- (per DL-036). The chains seed with status='active' so they take effect
-- immediately upon migration.
-- =============================================================================

-- 1. po_threshold — PO ≥ ₹50,000 routes to Brand Owner (FR41).
WITH bootstrap_bo AS (
  SELECT u.id AS user_id, u.brand_id
  FROM users u
  WHERE u.role = 'brand_owner' AND u.email = 'bootstrap-bo@fnberp.local'
  LIMIT 1
)
INSERT INTO approval_chains (id, brand_id, entity_type, name, description, steps, status, created_by, last_modified_by, last_modified_at)
SELECT
  gen_random_uuid(),
  bo.brand_id,
  'po_threshold',
  'Default PO Threshold Chain',
  'PO ≥ ₹50,000 routes to Brand Owner; below threshold no chain fires.',
  jsonb_build_array(jsonb_build_object(
    'stepIndex', 0,
    'role', 'brand_owner',
    'valueBandMin', 50000,
    'escalationTimeoutMinutes', 1440,
    'fallbackDelegateUserId', null
  )),
  'active',
  bo.user_id,
  bo.user_id,
  now()
FROM bootstrap_bo bo;

-- 2. gr_shelf_life_exception — Cluster Manager step 0 → Brand Owner step 1; 4-hour escalation (FR38).
WITH bootstrap_bo AS (
  SELECT u.id AS user_id, u.brand_id
  FROM users u
  WHERE u.role = 'brand_owner' AND u.email = 'bootstrap-bo@fnberp.local'
  LIMIT 1
)
INSERT INTO approval_chains (id, brand_id, entity_type, name, description, steps, status, created_by, last_modified_by, last_modified_at)
SELECT
  gen_random_uuid(),
  bo.brand_id,
  'gr_shelf_life_exception',
  'Default GR Shelf-Life Exception Chain',
  'GR shelf-life exception → Cluster Manager (cluster-scoped) → Brand Owner; 4-hour escalation per step.',
  jsonb_build_array(
    jsonb_build_object(
      'stepIndex', 0,
      'role', 'cluster_manager',
      'escalationTimeoutMinutes', 240,
      'fallbackDelegateUserId', null
    ),
    jsonb_build_object(
      'stepIndex', 1,
      'role', 'brand_owner',
      'escalationTimeoutMinutes', 240,
      'fallbackDelegateUserId', null
    )
  ),
  'active',
  bo.user_id,
  bo.user_id,
  now()
FROM bootstrap_bo bo;

-- 3. recipe_default_change — Brand Owner step 0; 24-hour escalation (FR50).
WITH bootstrap_bo AS (
  SELECT u.id AS user_id, u.brand_id
  FROM users u
  WHERE u.role = 'brand_owner' AND u.email = 'bootstrap-bo@fnberp.local'
  LIMIT 1
)
INSERT INTO approval_chains (id, brand_id, entity_type, name, description, steps, status, created_by, last_modified_by, last_modified_at)
SELECT
  gen_random_uuid(),
  bo.brand_id,
  'recipe_default_change',
  'Default Recipe Change Chain',
  'Recipe default change routes to Brand Owner; 24-hour escalation.',
  jsonb_build_array(jsonb_build_object(
    'stepIndex', 0,
    'role', 'brand_owner',
    'escalationTimeoutMinutes', 1440,
    'fallbackDelegateUserId', null
  )),
  'active',
  bo.user_id,
  bo.user_id,
  now()
FROM bootstrap_bo bo;

-- 4. bo_self_creation — Superadmin step 0; 7-day escalation; no fallback (FR14).
WITH bootstrap_bo AS (
  SELECT u.id AS user_id, u.brand_id
  FROM users u
  WHERE u.role = 'brand_owner' AND u.email = 'bootstrap-bo@fnberp.local'
  LIMIT 1
)
INSERT INTO approval_chains (id, brand_id, entity_type, name, description, steps, status, created_by, last_modified_by, last_modified_at)
SELECT
  gen_random_uuid(),
  bo.brand_id,
  'bo_self_creation',
  'Default BO Self-Creation Chain',
  'New Brand Owner account routes to Superadmin for approval; 7-day escalation.',
  jsonb_build_array(jsonb_build_object(
    'stepIndex', 0,
    'role', 'superadmin',
    'escalationTimeoutMinutes', 10080,
    'fallbackDelegateUserId', null
  )),
  'active',
  bo.user_id,
  bo.user_id,
  now()
FROM bootstrap_bo bo;

-- 5. inventory_adjustment — Cluster Manager step 0 → Brand Owner step 1 if value ≥ ₹10,000 (FR37).
WITH bootstrap_bo AS (
  SELECT u.id AS user_id, u.brand_id
  FROM users u
  WHERE u.role = 'brand_owner' AND u.email = 'bootstrap-bo@fnberp.local'
  LIMIT 1
)
INSERT INTO approval_chains (id, brand_id, entity_type, name, description, steps, status, created_by, last_modified_by, last_modified_at)
SELECT
  gen_random_uuid(),
  bo.brand_id,
  'inventory_adjustment',
  'Default Inventory Adjustment Chain',
  'Inventory adjustment → Cluster Manager (always) → Brand Owner (if value ≥ ₹10,000); 24-hour escalation per step.',
  jsonb_build_array(
    jsonb_build_object(
      'stepIndex', 0,
      'role', 'cluster_manager',
      'escalationTimeoutMinutes', 1440,
      'fallbackDelegateUserId', null
    ),
    jsonb_build_object(
      'stepIndex', 1,
      'role', 'brand_owner',
      'valueBandMin', 10000,
      'escalationTimeoutMinutes', 1440,
      'fallbackDelegateUserId', null
    )
  ),
  'active',
  bo.user_id,
  bo.user_id,
  now()
FROM bootstrap_bo bo;

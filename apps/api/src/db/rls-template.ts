/**
 * RLS canonical 2-policy template — DL-014.
 *
 * These functions emit the SQL strings that accompany Drizzle-Kit generated
 * migrations. They are consumed by the migration-augmentation step in Task A3.
 *
 * Org-scoped tables (declared via brandScopedTable) get two policies:
 *   1. brand_isolation — row-level filter for authenticated users.
 *   2. service_role_bypass — unrestricted access for the service role.
 *
 * System tables (plain pgTable, e.g. `brands`) get one policy:
 *   1. service_role_only — only the service role may access.
 */

/**
 * Returns the canonical 2-policy RLS block for an org-scoped table.
 *
 * @param tableName  SQL table name (e.g. 'purchase_orders').
 */
export function brandScopedRlsBlock(tableName: string): string {
  return `
ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;

CREATE POLICY ${tableName}_brand_isolation ON ${tableName}
  FOR ALL
  USING (brand_id = (SELECT brand_id FROM users WHERE id = auth.uid()));

CREATE POLICY ${tableName}_service_role_bypass ON ${tableName}
  FOR ALL TO service_role
  USING (true);
`.trim();
}

/**
 * Returns the 1-policy RLS block for a system table (no brand_id column).
 *
 * @param tableName  SQL table name (e.g. 'brands').
 */
export function systemTableRlsBlock(tableName: string): string {
  return `
ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;

CREATE POLICY ${tableName}_service_role_only ON ${tableName}
  FOR ALL TO service_role
  USING (true);
`.trim();
}

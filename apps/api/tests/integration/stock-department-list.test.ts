import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { sql } from 'drizzle-orm'
import {
  setupIntegration,
  teardownIntegration,
  truncateTestTables,
  getTestBrandedDb,
} from './setup.js'
import { unscopedDb } from '../../src/db/client.js'
import { clusters, locations, departments } from '../../src/db/schema/org.js'
import { uoms, products, stockLevels } from '../../src/db/schema/inventory.js'
import { inventoryService } from '../../src/services/inventory.service.js'

beforeAll(async () => {
  await setupIntegration()
  await truncateTestTables()
})
afterAll(async () => {
  await teardownIntegration()
})
afterEach(async () => {
  await truncateTestTables()
  const raw = unscopedDb()
  await raw.execute(sql`
    TRUNCATE TABLE stock_movements, stock_levels, stock_batches, journal_events, trn_sequences
    RESTART IDENTITY CASCADE
  `)
})

async function seed() {
  const { testBrandId } = getTestBrandedDb()
  const raw = unscopedDb()
  const [cluster] = await raw.insert(clusters)
    .values({ brandId: testBrandId, name: 'C', active: true }).returning({ id: clusters.id })
  const [location] = await raw.insert(locations)
    .values({ brandId: testBrandId, clusterId: cluster!.id, name: 'L', type: 'central_kitchen', active: true })
    .returning({ id: locations.id })
  const [dept] = await raw.insert(departments)
    .values({ brandId: testBrandId, locationId: location!.id, name: 'D', type: 'production', active: true })
    .returning({ id: departments.id })
  const [uom] = await raw.insert(uoms)
    .values({ brandId: testBrandId, code: 'kg', displayName: 'Kilograms', base: 'mass', conversionToBaseFactor: '1.000000000', active: true })
    .returning({ id: uoms.id })
  const [pA] = await raw.insert(products)
    .values({ brandId: testBrandId, sku: 'A-1', name: 'Aaa Flour', type: 'raw', defaultUomId: uom!.id, active: true })
    .returning({ id: products.id })
  const [pB] = await raw.insert(products)
    .values({ brandId: testBrandId, sku: 'B-1', name: 'Bbb Sugar', type: 'raw', defaultUomId: uom!.id, active: true })
    .returning({ id: products.id })
  await raw.insert(stockLevels).values([
    { brandId: testBrandId, productId: pA!.id, departmentId: dept!.id, quantity: '12.5000', uomId: uom!.id, lastUpdatedAt: new Date() },
    { brandId: testBrandId, productId: pB!.id, departmentId: dept!.id, quantity: '3.0000', uomId: uom!.id, lastUpdatedAt: new Date() },
  ])
  return { departmentId: dept!.id, productAId: pA!.id, productBId: pB!.id }
}

describe('inventoryService.listDepartmentStock', () => {
  it('lists all stock rows in a department with product name + unit, ordered by name', async () => {
    const { db } = getTestBrandedDb()
    const { departmentId } = await seed()
    const result = await inventoryService.listDepartmentStock(db, departmentId)
    expect(result.departmentId).toBe(departmentId)
    expect(result.items).toHaveLength(2)
    expect(result.items[0]!.productName).toBe('Aaa Flour')
    expect(result.items[0]!.quantity).toBe(12.5)
    expect(result.items[0]!.unit).toBe('kg')
    expect(result.items[1]!.productName).toBe('Bbb Sugar')
  })

  it('returns an empty items array for a department with no stock', async () => {
    const { db } = getTestBrandedDb()
    const { departmentId, productAId } = await seed()
    // delete the seeded levels to simulate an empty department
    const raw = unscopedDb()
    await raw.execute(sql`DELETE FROM stock_levels`)
    void productAId
    const result = await inventoryService.listDepartmentStock(db, departmentId)
    expect(result.items).toEqual([])
  })
})

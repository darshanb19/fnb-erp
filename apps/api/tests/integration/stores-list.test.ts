import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import {
  setupIntegration,
  teardownIntegration,
  truncateTestTables,
  getTestBrandedDb,
} from './setup.js'
import { unscopedDb } from '../../src/db/client.js'
import { clusters, stores } from '../../src/db/schema/org.js'
import { brands } from '../../src/db/schema/brand.js'
import { orgService } from '../../src/services/org.service.js'

beforeAll(async () => {
  await setupIntegration()
  await truncateTestTables()
})
afterAll(async () => {
  await teardownIntegration()
})
afterEach(async () => {
  await truncateTestTables()
})

describe('orgService.listStores', () => {
  it('lists brand + cluster level stores for the brand, scoped', async () => {
    const { db, testBrandId } = getTestBrandedDb()
    const raw = unscopedDb()
    const [cluster] = await raw.insert(clusters)
      .values({ brandId: testBrandId, name: 'C1', active: true })
      .returning({ id: clusters.id })
    await raw.insert(stores).values([
      { brandId: testBrandId, level: 'brand', clusterId: null, name: 'Brand Store', active: true },
      { brandId: testBrandId, level: 'cluster', clusterId: cluster!.id, name: 'C1 Store', active: true },
    ])
    const result = await orgService.listStores(db)
    expect(result).toHaveLength(2)
    const byName = Object.fromEntries(result.map((s) => [s.name, s]))
    expect(byName['Brand Store']!.level).toBe('brand')
    expect(byName['Brand Store']!.clusterId).toBeNull()
    expect(byName['C1 Store']!.level).toBe('cluster')
    expect(byName['C1 Store']!.clusterId).toBe(cluster!.id)
  })

  it('does not return another brand\'s stores', async () => {
    const { db, testBrandId } = getTestBrandedDb()
    const raw = unscopedDb()
    // Insert a second brand so the FK constraint is satisfied
    const [otherBrand] = await raw.insert(brands)
      .values({ legalName: 'Other Brand', country: 'IN' })
      .returning({ id: brands.id })
    // seed a store under the test brand and one under the other brand
    await raw.insert(stores).values([
      { brandId: testBrandId, level: 'brand', clusterId: null, name: 'Mine', active: true },
      { brandId: otherBrand!.id, level: 'brand', clusterId: null, name: 'Theirs', active: true },
    ])
    const result = await orgService.listStores(db)
    expect(result.map((s) => s.name)).toEqual(['Mine'])
  })
})

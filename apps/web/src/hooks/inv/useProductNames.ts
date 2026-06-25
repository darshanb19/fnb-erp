import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { useApiClient } from '@/hooks/use-api-client'
import { useSession } from '@/lib/auth'
import { qk } from '@/lib/query-keys'
import { productNameListSchema, inventoryDepartmentListSchema, type InventoryDepartment, productCatalogListSchema, type ProductCatalogItem } from './schemas'

export function useInventoryProductNames(): {
  nameOf: (productId: string) => string
  list: ReadonlyArray<{ id: string; name: string }>
  isLoading: boolean
} {
  const client = useApiClient()
  const { session } = useSession()
  const query = useQuery({
    queryKey: qk.inv.productNames(),
    queryFn: ({ signal }) =>
      client.get({
        path: '/api/v1/products',
        schema: productNameListSchema,
        signal,
      }),
    enabled: Boolean(session),
    staleTime: 5 * 60_000,
  })
  const list = query.data ?? []
  const map = new Map(list.map((p) => [p.id, p.name]))
  return {
    nameOf: (productId: string) => map.get(productId) ?? productId,
    list,
    isLoading: query.isLoading,
  }
}

/**
 * Department list for department selectors.
 * GET /api/v1/departments returns a BARE array (no envelope wrapper).
 * Widened in Wave 2 to include code, locationId, type (endpoint already returns these fields).
 */
export function useInventoryDepartments(): {
  data: ReadonlyArray<InventoryDepartment> | undefined
  isLoading: boolean
} {
  const client = useApiClient()
  const { session } = useSession()
  const query = useQuery({
    queryKey: qk.inv.departments(),
    queryFn: ({ signal }) =>
      client.get({
        path: '/api/v1/departments',
        schema: inventoryDepartmentListSchema,
        signal,
      }),
    enabled: Boolean(session),
    staleTime: 5 * 60_000,
  })
  return {
    data: query.data,
    isLoading: query.isLoading,
  }
}

/**
 * Minimal location list for cluster-review and similar surfaces.
 * GET /api/v1/locations returns a BARE array (no envelope wrapper).
 */
const locationListSchema = z.array(
  z.object({ id: z.string().uuid(), name: z.string() }),
)

export function useInventoryLocations(): {
  data: ReadonlyArray<{ id: string; name: string }> | undefined
  isLoading: boolean
} {
  const client = useApiClient()
  const { session } = useSession()
  const query = useQuery({
    queryKey: qk.inv.locations(),
    queryFn: ({ signal }) =>
      client.get({
        path: '/api/v1/locations',
        schema: locationListSchema,
        signal,
      }),
    enabled: Boolean(session),
    staleTime: 5 * 60_000,
  })
  return {
    data: query.data,
    isLoading: query.isLoading,
  }
}

/**
 * Widened product catalog for the "record" screens (GR / adjustment / closing).
 * GET /api/v1/products returns BARE full Product rows (id, name, sku, type,
 * defaultUomId, standardYieldFactor, …). Distinct query key from
 * useInventoryProductNames so neither hook re-shapes the other's cache.
 */
export function useInventoryProductCatalog(): {
  list: ReadonlyArray<ProductCatalogItem>
  byId: (id: string) => ProductCatalogItem | undefined
  nameOf: (id: string) => string
  defaultUomOf: (id: string) => string | undefined
  yieldOf: (id: string) => number
  isLoading: boolean
} {
  const client = useApiClient()
  const { session } = useSession()
  const query = useQuery({
    queryKey: qk.inv.productCatalog(),
    queryFn: ({ signal }) =>
      client.get({ path: '/api/v1/products', schema: productCatalogListSchema, signal }),
    enabled: Boolean(session),
    staleTime: 5 * 60_000,
  })
  const list = query.data ?? []
  const map = new Map(list.map((p) => [p.id, p]))
  return {
    list,
    byId: (id) => map.get(id),
    nameOf: (id) => map.get(id)?.name ?? id,
    defaultUomOf: (id) => map.get(id)?.defaultUomId,
    yieldOf: (id) => map.get(id)?.standardYieldFactor ?? 1,
    isLoading: query.isLoading,
  }
}

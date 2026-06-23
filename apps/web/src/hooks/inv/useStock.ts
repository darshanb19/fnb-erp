import { useQuery } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/use-api-client'
import { useSession } from '@/lib/auth'
import { qk } from '@/lib/query-keys'
import {
  envelope,
  departmentStockResultSchema,
  expiringBatchesResultSchema,
  stockMovementsListSchema,
} from './schemas'

export function useDepartmentStock(departmentId: string | undefined) {
  const client = useApiClient()
  const { session } = useSession()
  return useQuery({
    queryKey: departmentId
      ? qk.inv.stock.department(departmentId)
      : ['inv', 'stock', 'department', null],
    queryFn: ({ signal }) => {
      if (!departmentId) throw new Error('useDepartmentStock called without departmentId')
      return client
        .get({
          path: `/api/v1/stock/department/${departmentId}`,
          schema: envelope(departmentStockResultSchema),
          signal,
        })
        .then((r) => r.data)
    },
    enabled: Boolean(session) && Boolean(departmentId),
  })
}

export interface ExpiringScope {
  departmentId?: string
  locationId?: string
  clusterId?: string
}

/**
 * useStockMovements — 30-day movement history for a product × department.
 *
 * Calls GET /api/v1/stock/movements?productId=&departmentId=
 * The endpoint returns { data: StockMovementRow[] } where each row is the raw
 * SELECT * result (snake_case column names, numeric fields as strings from Postgres).
 *
 * enabled only when both productId and departmentId are provided.
 */
export function useStockMovements(
  productId: string | undefined,
  departmentId: string | undefined,
) {
  const client = useApiClient()
  const { session } = useSession()
  const ready = Boolean(productId) && Boolean(departmentId)
  return useQuery({
    queryKey: qk.inv.stock.movements(productId, departmentId),
    queryFn: ({ signal }) => {
      if (!productId || !departmentId) {
        throw new Error('useStockMovements requires productId and departmentId')
      }
      const qs = new URLSearchParams({ productId, departmentId }).toString()
      return client
        .get({
          path: `/api/v1/stock/movements?${qs}`,
          schema: envelope(stockMovementsListSchema),
          signal,
        })
        .then((r) => r.data)
    },
    enabled: Boolean(session) && ready,
  })
}

export function useExpiringBatches(scope: ExpiringScope) {
  const client = useApiClient()
  const { session } = useSession()
  const params = new URLSearchParams()
  if (scope.departmentId) params.set('departmentId', scope.departmentId)
  if (scope.locationId) params.set('locationId', scope.locationId)
  if (scope.clusterId) params.set('clusterId', scope.clusterId)
  const qs = params.toString()
  return useQuery({
    queryKey: qk.inv.stock.expiring(scope),
    queryFn: ({ signal }) =>
      client
        .get({
          path: `/api/v1/stock/expiring${qs ? `?${qs}` : ''}`,
          schema: envelope(expiringBatchesResultSchema),
          signal,
        })
        .then((r) => r.data),
    enabled: Boolean(session),
  })
}

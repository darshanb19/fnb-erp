import { useQuery } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/use-api-client'
import { useSession } from '@/lib/auth'
import { qk } from '@/lib/query-keys'
import { envelope, departmentStockResultSchema, expiringBatchesResultSchema } from './schemas'

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

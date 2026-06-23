import { useQuery } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/use-api-client'
import { useSession } from '@/lib/auth'
import { qk } from '@/lib/query-keys'
import { envelope, closingInventorySummarySchema, cutOffComplianceResultSchema } from './schemas'

export interface ClosingScope {
  locationId?: string
  departmentId?: string
}

function scopeParams(businessDate: string, scope: ClosingScope): string {
  const params = new URLSearchParams({ businessDate })
  if (scope.locationId) params.set('locationId', scope.locationId)
  if (scope.departmentId) params.set('departmentId', scope.departmentId)
  return params.toString()
}

export function useClosingSummary(businessDate: string, scope: ClosingScope) {
  const client = useApiClient()
  const { session } = useSession()
  return useQuery({
    queryKey: qk.inv.closing.summary(businessDate, scope),
    queryFn: ({ signal }) =>
      client
        .get({
          path: `/api/v1/closing-inventory/summary?${scopeParams(businessDate, scope)}`,
          schema: envelope(closingInventorySummarySchema),
          signal,
        })
        .then((r) => r.data),
    enabled: Boolean(session) && Boolean(businessDate),
  })
}

export function useCutOffCompliance(businessDate: string, scope: ClosingScope) {
  const client = useApiClient()
  const { session } = useSession()
  return useQuery({
    queryKey: qk.inv.closing.cutOff(businessDate, scope),
    queryFn: ({ signal }) =>
      client
        .get({
          path: `/api/v1/closing-inventory/cut-off-compliance?${scopeParams(businessDate, scope)}`,
          schema: envelope(cutOffComplianceResultSchema),
          signal,
        })
        .then((r) => r.data),
    enabled: Boolean(session) && Boolean(businessDate),
  })
}

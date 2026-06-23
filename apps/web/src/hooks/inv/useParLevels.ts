import { useQuery } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/use-api-client'
import { useSession } from '@/lib/auth'
import { qk } from '@/lib/query-keys'
import { envelope, belowParListSchema } from './schemas'

export interface BelowParFilter {
  locationId?: string
  businessDate?: string
}

export function useBelowPar(filter: BelowParFilter) {
  const client = useApiClient()
  const { session } = useSession()
  const params = new URLSearchParams()
  if (filter.locationId) params.set('locationId', filter.locationId)
  if (filter.businessDate) params.set('businessDate', filter.businessDate)
  const qs = params.toString()
  return useQuery({
    queryKey: qk.inv.belowPar(filter),
    queryFn: ({ signal }) =>
      client
        .get({
          path: `/api/v1/par-levels/below${qs ? `?${qs}` : ''}`,
          schema: envelope(belowParListSchema),
          signal,
        })
        .then((r) => r.data),
    enabled: Boolean(session),
  })
}

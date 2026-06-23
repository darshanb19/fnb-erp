import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/use-api-client'
import { useSession } from '@/lib/auth'
import { qk } from '@/lib/query-keys'
import {
  envelope,
  belowParListSchema,
  parLevelListSchema,
  parLevelRowSchema,
  bulkParResultSchema,
  type ParLevelRow,
} from './schemas'

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

export interface SetParLevelInput {
  productId: string
  locationId?: string | null
  departmentId?: string | null
  basePar: number
  dayOfWeekOverrides?: Record<string, number> | null
}

export function useParLevelsList(filter: { locationId?: string } = {}) {
  const client = useApiClient()
  const { session } = useSession()
  const params = new URLSearchParams()
  if (filter.locationId) params.set('locationId', filter.locationId)
  const qs = params.toString()
  return useQuery<ParLevelRow[]>({
    queryKey: qk.inv.parList(filter),
    queryFn: ({ signal }) =>
      client
        .get({
          path: `/api/v1/par-levels${qs ? `?${qs}` : ''}`,
          schema: envelope(parLevelListSchema),
          signal,
        })
        .then((r) => r.data),
    enabled: Boolean(session),
  })
}

export function useSetParLevel() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<ParLevelRow, Error, SetParLevelInput>({
    mutationFn: (input) =>
      client
        .post({ path: '/api/v1/par-levels', body: input, schema: envelope(parLevelRowSchema) })
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inv', 'parList'] })
      void queryClient.invalidateQueries({ queryKey: ['inv', 'belowPar'] })
    },
  })
}

export function useBulkSetParLevel() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<{ count: number }, Error, SetParLevelInput[]>({
    mutationFn: (rows) =>
      client
        .post({ path: '/api/v1/par-levels/bulk', body: { rows }, schema: envelope(bulkParResultSchema) })
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inv', 'parList'] })
      void queryClient.invalidateQueries({ queryKey: ['inv', 'belowPar'] })
    },
  })
}

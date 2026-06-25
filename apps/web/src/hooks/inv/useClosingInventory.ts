import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/use-api-client'
import { useSession } from '@/lib/auth'
import { qk } from '@/lib/query-keys'
import {
  envelope,
  metaEnvelope,
  closingInventorySummarySchema,
  cutOffComplianceResultSchema,
  closingListSchema,
  closingDetailSchema,
  recordClosingResultSchema,
  closingWarningsMetaSchema,
  closingStatusResultSchema,
  markVarianceOkResultSchema,
  type ClosingListItem,
  type ClosingDetail,
  type ClosingStatus,
} from './schemas'

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

export interface RecordClosingLineInput {
  itemId: string
  countedQty: number
  reasonCode?: string
  notes?: string | null
}
export interface RecordClosingInput {
  locationId: string
  departmentId: string
  businessDate: string
  locationCode: string
  notes?: string | null
  lines: RecordClosingLineInput[]
}

export function useClosingList(filter: { status?: ClosingStatus; businessDate?: string } = {}) {
  const client = useApiClient()
  const { session } = useSession()
  const params = new URLSearchParams()
  if (filter.status) params.set('status', filter.status)
  if (filter.businessDate) params.set('businessDate', filter.businessDate)
  const qs = params.toString()
  return useQuery<ClosingListItem[]>({
    queryKey: qk.inv.closing.list(filter),
    queryFn: ({ signal }) =>
      client
        .get({ path: `/api/v1/closing-inventory${qs ? `?${qs}` : ''}`, schema: envelope(closingListSchema), signal })
        .then((r) => r.data),
    enabled: Boolean(session),
  })
}

export function useClosingDetail(id: string | undefined) {
  const client = useApiClient()
  const { session } = useSession()
  return useQuery<ClosingDetail>({
    queryKey: id ? qk.inv.closing.detail(id) : ['inv', 'closing', 'detail', null],
    queryFn: ({ signal }) => {
      if (!id) throw new Error('useClosingDetail called without id')
      return client
        .get({ path: `/api/v1/closing-inventory/${id}`, schema: envelope(closingDetailSchema), signal })
        .then((r) => r.data)
    },
    enabled: Boolean(session) && Boolean(id),
  })
}

export function useRecordClosing() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<{ closingId: string; ciTrn: string; warnings: string[] }, Error, RecordClosingInput>({
    mutationFn: (input) =>
      client
        .post({ path: '/api/v1/closing-inventory', body: input, schema: metaEnvelope(recordClosingResultSchema, closingWarningsMetaSchema) })
        .then((r) => ({ ...r.data, warnings: r.meta?.warnings ?? [] })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inv', 'closing', 'list'] })
      void queryClient.invalidateQueries({ queryKey: ['inv', 'closing', 'summary'] })
    },
  })
}

export function useConfirmClosing() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<{ status: string }, Error, string>({
    mutationFn: (closingId) =>
      client
        .post({ path: `/api/v1/closing-inventory/${closingId}/confirm`, body: {}, schema: envelope(closingStatusResultSchema) })
        .then((r) => r.data),
    onSuccess: (_res, closingId) => {
      void queryClient.invalidateQueries({ queryKey: qk.inv.closing.detail(closingId) })
      void queryClient.invalidateQueries({ queryKey: ['inv', 'closing', 'list'] })
    },
  })
}

export function useMarkVarianceOk() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<{ varianceAcceptable: boolean }, Error, string>({
    mutationFn: (closingId) =>
      client
        .post({ path: `/api/v1/closing-inventory/${closingId}/mark-variance-ok`, body: {}, schema: envelope(markVarianceOkResultSchema) })
        .then((r) => r.data),
    onSuccess: (_res, closingId) => {
      void queryClient.invalidateQueries({ queryKey: qk.inv.closing.detail(closingId) })
      void queryClient.invalidateQueries({ queryKey: ['inv', 'closing', 'list'] })
    },
  })
}

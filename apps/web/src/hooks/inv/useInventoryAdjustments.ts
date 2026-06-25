import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/use-api-client'
import { useSession } from '@/lib/auth'
import { qk } from '@/lib/query-keys'
import {
  envelope,
  metaEnvelope,
  adjustmentListSchema,
  adjustmentDetailSchema,
  recordAdjResultSchema,
  adjApprovalMetaSchema,
  adjStatusResultSchema,
  type AdjustmentListItem,
  type AdjustmentDetail,
  type AdjStatus,
} from './schemas'

export interface RecordAdjustmentLineInput {
  productId: string
  delta: number
  reasonCode: string
  currentOnHand?: number
  costPerUnit?: number
}
export interface RecordAdjustmentInput {
  departmentId: string
  locationCode: string
  notes?: string | null
  lines: RecordAdjustmentLineInput[]
}

export function useInventoryAdjustments(filter: { status?: AdjStatus } = {}) {
  const client = useApiClient()
  const { session } = useSession()
  const params = new URLSearchParams()
  if (filter.status) params.set('status', filter.status)
  const qs = params.toString()
  return useQuery<AdjustmentListItem[]>({
    queryKey: qk.inv.adjustments.list(filter),
    queryFn: ({ signal }) =>
      client
        .get({ path: `/api/v1/inventory-adjustments${qs ? `?${qs}` : ''}`, schema: envelope(adjustmentListSchema), signal })
        .then((r) => r.data),
    enabled: Boolean(session),
  })
}

export function useAdjustmentDetail(id: string | undefined) {
  const client = useApiClient()
  const { session } = useSession()
  return useQuery<AdjustmentDetail>({
    queryKey: id ? qk.inv.adjustments.detail(id) : ['inv', 'adjustments', 'detail', null],
    queryFn: ({ signal }) => {
      if (!id) throw new Error('useAdjustmentDetail called without id')
      return client
        .get({ path: `/api/v1/inventory-adjustments/${id}`, schema: envelope(adjustmentDetailSchema), signal })
        .then((r) => r.data)
    },
    enabled: Boolean(session) && Boolean(id),
  })
}

export function useRecordAdjustment() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<
    { adjustmentId: string; adjTrn: string; status: string; approvalRequestId?: string },
    Error,
    RecordAdjustmentInput
  >({
    mutationFn: (input) =>
      client
        .post({ path: '/api/v1/inventory-adjustments', body: input, schema: metaEnvelope(recordAdjResultSchema, adjApprovalMetaSchema) })
        .then((r) => ({ ...r.data, approvalRequestId: r.meta?.approvalRequestId })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inv', 'adjustments', 'list'] })
    },
  })
}

function useAdjustmentLifecycleAction(action: 'confirm' | 'cancel') {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<{ status: string }, Error, string>({
    mutationFn: (adjustmentId) =>
      client
        .post({ path: `/api/v1/inventory-adjustments/${adjustmentId}/${action}`, body: {}, schema: envelope(adjStatusResultSchema) })
        .then((r) => r.data),
    onSuccess: (_res, adjustmentId) => {
      void queryClient.invalidateQueries({ queryKey: qk.inv.adjustments.detail(adjustmentId) })
      void queryClient.invalidateQueries({ queryKey: ['inv', 'adjustments', 'list'] })
    },
  })
}
export const useConfirmAdjustment = () => useAdjustmentLifecycleAction('confirm')
export const useCancelAdjustment = () => useAdjustmentLifecycleAction('cancel')

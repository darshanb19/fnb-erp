import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/use-api-client'
import { useSession } from '@/lib/auth'
import { qk } from '@/lib/query-keys'
import {
  envelope,
  transferDetailSchema,
  transferListSchema,
  transferSuggestionsResultSchema,
  createTransferResultSchema,
  transferStatusResultSchema,
  createBundleResultSchema,
  approveBundleResultSchema,
  type TransferDetail,
  type TransferListItem,
  type CreateTransferResult,
  type CreateBundleResult,
  type TransferStatus,
} from './schemas'

export interface CreateTransferInput {
  sourceDepartmentId: string
  destinationDepartmentId: string
  locationCode: string
  reasonCode?: string
  lines: Array<{ productId: string; requestedQty: number; reasonCode?: string }>
}

export interface CreateBundleInput {
  originatingClusterId: string
  destinationClusterId: string
  locationCode: string
  productId: string
  qty: number
  uomId: string
  fromStoreId: string
  toStoreId: string
  brandStoreId: string
  reasonCode?: string
}

export function useTransferSuggestions(
  sourceDepartmentId: string | undefined,
  destinationDepartmentId: string | undefined,
) {
  const client = useApiClient()
  const { session } = useSession()
  const ready = Boolean(sourceDepartmentId) && Boolean(destinationDepartmentId)
  return useQuery({
    queryKey: qk.inv.suggestions(sourceDepartmentId ?? '', destinationDepartmentId ?? ''),
    queryFn: ({ signal }) => {
      if (!sourceDepartmentId || !destinationDepartmentId)
        throw new Error('useTransferSuggestions requires both department ids')
      const qs = new URLSearchParams({ sourceDepartmentId, destinationDepartmentId }).toString()
      // body is { data: { suggestions: [...] } }
      return client
        .get({
          path: `/api/v1/stock-transfers/suggestions?${qs}`,
          schema: envelope(transferSuggestionsResultSchema),
          signal,
        })
        .then((r) => r.data.suggestions)
    },
    enabled: Boolean(session) && ready,
  })
}

export function useTransferDetail(id: string | undefined) {
  const client = useApiClient()
  const { session } = useSession()
  return useQuery<TransferDetail>({
    queryKey: id ? qk.inv.transfers.detail(id) : ['inv', 'transfers', 'detail', null],
    queryFn: ({ signal }) => {
      if (!id) throw new Error('useTransferDetail called without id')
      return client
        .get({ path: `/api/v1/stock-transfers/${id}`, schema: envelope(transferDetailSchema), signal })
        .then((r) => r.data)
    },
    enabled: Boolean(session) && Boolean(id),
  })
}

export function useTransferList(filter: { status?: TransferStatus } = {}) {
  const client = useApiClient()
  const { session } = useSession()
  const params = new URLSearchParams()
  if (filter.status) params.set('status', filter.status)
  const qs = params.toString()
  return useQuery<TransferListItem[]>({
    queryKey: qk.inv.transfers.list(filter),
    queryFn: ({ signal }) =>
      client
        .get({
          path: `/api/v1/stock-transfers${qs ? `?${qs}` : ''}`,
          schema: envelope(transferListSchema),
          signal,
        })
        .then((r) => r.data),
    enabled: Boolean(session),
  })
}

export function useCreateTransfer() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<CreateTransferResult, Error, CreateTransferInput>({
    mutationFn: (input) =>
      client
        .post({ path: '/api/v1/stock-transfers', body: input, schema: envelope(createTransferResultSchema) })
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inv', 'transfers', 'list'] })
    },
  })
}

function useTransferLifecycleAction(action: 'submit' | 'approve' | 'dispatch' | 'cancel') {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<{ status: string }, Error, string>({
    mutationFn: (transferId) =>
      client
        .post({ path: `/api/v1/stock-transfers/${transferId}/${action}`, body: {}, schema: envelope(transferStatusResultSchema) })
        .then((r) => r.data),
    onSuccess: (_res, transferId) => {
      void queryClient.invalidateQueries({ queryKey: qk.inv.transfers.detail(transferId) })
      void queryClient.invalidateQueries({ queryKey: ['inv', 'transfers', 'list'] })
    },
  })
}
export const useSubmitTransfer = () => useTransferLifecycleAction('submit')
export const useApproveTransfer = () => useTransferLifecycleAction('approve')
export const useDispatchTransfer = () => useTransferLifecycleAction('dispatch')
export const useCancelTransfer = () => useTransferLifecycleAction('cancel')

export function useConfirmReceipt() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<
    { status: string },
    Error,
    { transferId: string; quantities?: Record<string, number>; varianceReasons?: Record<string, string> }
  >({
    mutationFn: ({ transferId, quantities, varianceReasons }) =>
      client
        .post({
          path: `/api/v1/stock-transfers/${transferId}/confirm-receipt`,
          body: { quantities, varianceReasons },
          schema: envelope(transferStatusResultSchema),
        })
        .then((r) => r.data),
    onSuccess: (_res, { transferId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.inv.transfers.detail(transferId) })
      void queryClient.invalidateQueries({ queryKey: ['inv', 'transfers', 'list'] })
    },
  })
}

export function useCreateBundle() {
  const client = useApiClient()
  return useMutation<CreateBundleResult, Error, CreateBundleInput>({
    mutationFn: (input) =>
      client
        .post({ path: '/api/v1/stock-transfers/bundles', body: input, schema: envelope(createBundleResultSchema) })
        .then((r) => r.data),
  })
}

export function useApproveBundle() {
  const client = useApiClient()
  return useMutation<{ transferIds: string[] }, Error, string>({
    mutationFn: (bundleId) =>
      client
        .post({ path: `/api/v1/stock-transfers/bundles/${bundleId}/approve`, body: {}, schema: envelope(approveBundleResultSchema) })
        .then((r) => r.data),
  })
}

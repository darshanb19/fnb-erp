import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/use-api-client'
import { useSession } from '@/lib/auth'
import { qk } from '@/lib/query-keys'
import {
  envelope,
  metaEnvelope,
  goodsReceiptListSchema,
  goodsReceiptDetailSchema,
  recordGrResultSchema,
  grWarningsMetaSchema,
  grStatusResultSchema,
  type GoodsReceiptListItem,
  type GoodsReceiptDetail,
  type GrStatus,
} from './schemas'

export interface RecordGrLineInput {
  productId: string
  receivedQty: number
  uomId: string
  yieldFactor?: number
  unitCost?: number
  batchNumber?: string
  expiryDate?: string | null
  orderedQty?: number
}
export interface RecordGrInput {
  destinationDepartmentId: string
  locationCode: string
  poId?: string | null
  transferId?: string | null
  receivedAt?: string | null
  lines: RecordGrLineInput[]
}

export function useGoodsReceipts(filter: { status?: GrStatus } = {}) {
  const client = useApiClient()
  const { session } = useSession()
  const params = new URLSearchParams()
  if (filter.status) params.set('status', filter.status)
  const qs = params.toString()
  return useQuery<GoodsReceiptListItem[]>({
    queryKey: qk.inv.goodsReceipts.list(filter),
    queryFn: ({ signal }) =>
      client
        .get({ path: `/api/v1/goods-receipts${qs ? `?${qs}` : ''}`, schema: envelope(goodsReceiptListSchema), signal })
        .then((r) => r.data),
    enabled: Boolean(session),
  })
}

export function useGoodsReceiptDetail(id: string | undefined) {
  const client = useApiClient()
  const { session } = useSession()
  return useQuery<GoodsReceiptDetail>({
    queryKey: id ? qk.inv.goodsReceipts.detail(id) : ['inv', 'goodsReceipts', 'detail', null],
    queryFn: ({ signal }) => {
      if (!id) throw new Error('useGoodsReceiptDetail called without id')
      return client
        .get({ path: `/api/v1/goods-receipts/${id}`, schema: envelope(goodsReceiptDetailSchema), signal })
        .then((r) => r.data)
    },
    enabled: Boolean(session) && Boolean(id),
  })
}

export function useRecordGoodsReceipt() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<{ goodsReceiptId: string; grTrn: string; warnings: string[] }, Error, RecordGrInput>({
    mutationFn: (input) =>
      client
        .post({ path: '/api/v1/goods-receipts', body: input, schema: metaEnvelope(recordGrResultSchema, grWarningsMetaSchema) })
        .then((r) => ({ ...r.data, warnings: r.meta?.warnings ?? [] })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inv', 'goodsReceipts', 'list'] })
    },
  })
}

export function useConfirmGoodsReceipt() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<{ status: string }, Error, { grId: string; reasonCode?: string }>({
    mutationFn: ({ grId, reasonCode }) =>
      client
        .post({ path: `/api/v1/goods-receipts/${grId}/confirm`, body: reasonCode ? { reasonCode } : {}, schema: envelope(grStatusResultSchema) })
        .then((r) => r.data),
    onSuccess: (_res, { grId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.inv.goodsReceipts.detail(grId) })
      void queryClient.invalidateQueries({ queryKey: ['inv', 'goodsReceipts', 'list'] })
    },
  })
}

export function useRejectGoodsReceipt() {
  const client = useApiClient()
  const queryClient = useQueryClient()
  return useMutation<{ status: string }, Error, { grId: string; reasons: string[]; evidence?: string | null }>({
    mutationFn: ({ grId, reasons, evidence }) =>
      client
        .post({ path: `/api/v1/goods-receipts/${grId}/reject`, body: { reasons, evidence: evidence ?? null }, schema: envelope(grStatusResultSchema) })
        .then((r) => r.data),
    onSuccess: (_res, { grId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.inv.goodsReceipts.detail(grId) })
      void queryClient.invalidateQueries({ queryKey: ['inv', 'goodsReceipts', 'list'] })
    },
  })
}

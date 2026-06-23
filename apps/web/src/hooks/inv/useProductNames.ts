import { useQuery } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/use-api-client'
import { useSession } from '@/lib/auth'
import { qk } from '@/lib/query-keys'
import { productNameListSchema } from './schemas'

export function useInventoryProductNames(): {
  nameOf: (productId: string) => string
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
  const map = new Map((query.data ?? []).map((p) => [p.id, p.name]))
  return {
    nameOf: (productId: string) => map.get(productId) ?? productId,
    isLoading: query.isLoading,
  }
}

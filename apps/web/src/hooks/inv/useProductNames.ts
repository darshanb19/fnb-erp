import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
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

/**
 * Minimal department list for the department selector on SI-INV-001.
 * GET /api/v1/departments returns a BARE array (no envelope wrapper).
 */
const departmentListSchema = z.array(
  z.object({ id: z.string().uuid(), name: z.string() }),
)

export function useInventoryDepartments(): {
  data: ReadonlyArray<{ id: string; name: string }> | undefined
  isLoading: boolean
} {
  const client = useApiClient()
  const { session } = useSession()
  const query = useQuery({
    queryKey: qk.inv.departments(),
    queryFn: ({ signal }) =>
      client.get({
        path: '/api/v1/departments',
        schema: departmentListSchema,
        signal,
      }),
    enabled: Boolean(session),
    staleTime: 5 * 60_000,
  })
  return {
    data: query.data,
    isLoading: query.isLoading,
  }
}

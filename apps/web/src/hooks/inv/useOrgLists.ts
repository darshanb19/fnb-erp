import { useQuery } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/use-api-client'
import { useSession } from '@/lib/auth'
import { qk } from '@/lib/query-keys'
import {
  clusterListSchema,
  uomListSchema,
  storeListSchema,
  type Store,
} from './schemas'

export function useInventoryClusters() {
  const client = useApiClient()
  const { session } = useSession()
  return useQuery<{ id: string; name: string }[]>({
    queryKey: qk.inv.clusters(),
    queryFn: ({ signal }) => client.get({ path: '/api/v1/clusters', schema: clusterListSchema, signal }),
    enabled: Boolean(session),
    staleTime: 5 * 60_000,
  })
}

export function useInventoryUoms() {
  const client = useApiClient()
  const { session } = useSession()
  return useQuery<{ id: string; code: string; displayName: string }[]>({
    queryKey: qk.inv.uoms(),
    queryFn: ({ signal }) => client.get({ path: '/api/v1/uoms', schema: uomListSchema, signal }),
    enabled: Boolean(session),
    staleTime: 5 * 60_000,
  })
}

export function useInventoryStores() {
  const client = useApiClient()
  const { session } = useSession()
  return useQuery<Store[]>({
    queryKey: qk.inv.stores(),
    queryFn: ({ signal }) => client.get({ path: '/api/v1/stores', schema: storeListSchema, signal }),
    enabled: Boolean(session),
    staleTime: 5 * 60_000,
  })
}

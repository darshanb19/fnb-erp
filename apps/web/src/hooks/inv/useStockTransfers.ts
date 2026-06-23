import { useQuery } from '@tanstack/react-query'
import { useApiClient } from '@/hooks/use-api-client'
import { useSession } from '@/lib/auth'
import { qk } from '@/lib/query-keys'
import { envelope, transferSuggestionsResultSchema } from './schemas'

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

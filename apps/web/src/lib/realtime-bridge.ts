import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

export type RealtimeChannelName =
  | 'approval_requests'
  | 'notifications'
  | 'issue_tracker_threads'

export interface ApprovalRequestPayload {
  requestId: string
  approverId: string
  brandId: string
  entityType: string
}

export interface NotificationPayload {
  notificationId: string
  userId: string
  brandId: string
  type: string
}

export interface IssueTicketPayload {
  ticketId: string
  eventType: 'comment' | 'status' | 'assignment' | 'attachment'
  brandId: string
}

export type RealtimePayloadFor<C extends RealtimeChannelName> =
  C extends 'approval_requests' ? ApprovalRequestPayload :
  C extends 'notifications' ? NotificationPayload :
  C extends 'issue_tracker_threads' ? IssueTicketPayload :
  never

const EVENT_FOR_CHANNEL: Record<RealtimeChannelName, string> = {
  approval_requests: 'approval_request_change',
  notifications: 'notification_change',
  issue_tracker_threads: 'issue_ticket_change',
}

export interface RealtimeBridgeConfig<C extends RealtimeChannelName> {
  channelName: C
  filter: (payload: RealtimePayloadFor<C>) => boolean
  invalidateKeys: ReadonlyArray<ReadonlyArray<unknown>>
}

export function useRealtimeChannel<C extends RealtimeChannelName>(
  config: RealtimeBridgeConfig<C>,
): void {
  const queryClient = useQueryClient()

  // Only channelName + queryClient in deps — filter and invalidateKeys are typically
  // inline lambdas/arrays that change identity every render; including them would
  // teardown and re-subscribe on every render cycle.
  useEffect(() => {
    const event = EVENT_FOR_CHANNEL[config.channelName]
    const channel = supabase
      .channel(config.channelName)
      .on('broadcast', { event }, ({ payload }: { payload: unknown }) => {
        const typed = payload as RealtimePayloadFor<C>
        if (config.filter(typed)) {
          for (const key of config.invalidateKeys) {
            queryClient.invalidateQueries({ queryKey: key as ReadonlyArray<unknown> })
          }
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.channelName, queryClient])
}

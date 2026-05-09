import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useApiClient } from '@/hooks/use-api-client';
import { useSession } from '@/lib/auth';
import { useRealtimeChannel } from '@/lib/realtime-bridge';
import { qk } from '@/lib/query-keys';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const notificationSchema = z.object({
  id: z.string().uuid(),
  brandId: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.string(),
  payload: z.unknown(),
  inAppSeenAt: z.string().nullable(),
  digestEligible: z.boolean(),
  escalationEligible: z.boolean(),
  escalatedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
});

export type NotificationRow = z.infer<typeof notificationSchema>;

const notificationsListResultSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: z.string().nullable(),
});

export type NotificationsListResult = z.infer<typeof notificationsListResultSchema>;

const preferenceRowSchema = z.object({
  type: z.string(),
  inApp: z.boolean(),
  emailMode: z.enum(['none', 'immediate', 'digest']),
  digestWindow: z.enum(['daily']).nullable(),
  inAppOverride: z.boolean().nullable(),
  emailOverride: z.boolean().nullable(),
  digestBatchOverride: z.boolean().nullable(),
  quietHoursStart: z.string().nullable(),
  quietHoursEnd: z.string().nullable(),
});

export type PreferenceRow = z.infer<typeof preferenceRowSchema>;

const preferencesListSchema = z.array(preferenceRowSchema);

const notificationPreferenceSchema = z.object({
  id: z.string().uuid(),
  brandId: z.string().uuid(),
  userId: z.string().uuid(),
  type: z.string(),
  inAppOverride: z.boolean().nullable(),
  emailOverride: z.boolean().nullable(),
  digestBatchOverride: z.boolean().nullable(),
  quietHoursStart: z.string().nullable(),
  quietHoursEnd: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
});

export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;

const digestPreviewItemSchema = z.object({
  type: z.string(),
  count: z.number().int(),
  sample: z.record(z.unknown()),
});

const digestPreviewSchema = z.object({
  startedAt: z.string().nullable(),
  items: z.array(digestPreviewItemSchema),
});

export type DigestPreview = z.infer<typeof digestPreviewSchema>;

const markAllSeenResponseSchema = z.object({ updated: z.number().int() });

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface NotificationsFilter {
  unseenOnly?: boolean;
  limit?: number;
  cursor?: string;
}

export interface UpdatePreferenceInput {
  type: string;
  inAppOverride?: boolean | null;
  emailOverride?: boolean | null;
  digestBatchOverride?: boolean | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useNotifications(filter?: NotificationsFilter) {
  const client = useApiClient();
  const { session } = useSession();

  useRealtimeChannel({
    channelName: 'notifications',
    filter: (payload) => payload.userId === (session?.user.id ?? ''),
    invalidateKeys: [qk.inf.notifications.list()],
  });

  const params = new URLSearchParams();
  if (filter?.unseenOnly !== undefined) params.set('unseenOnly', String(filter.unseenOnly));
  if (filter?.limit !== undefined) params.set('limit', String(filter.limit));
  if (filter?.cursor) params.set('cursor', filter.cursor);
  const qs = params.toString();

  return useQuery({
    queryKey: qk.inf.notifications.list(),
    queryFn: ({ signal }) =>
      client.get({
        path: `/api/v1/notifications${qs ? `?${qs}` : ''}`,
        schema: notificationsListResultSchema,
        signal,
      }),
    enabled: Boolean(session),
  });
}

export function useNotificationPreferences() {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.inf.notifications.preferences(),
    queryFn: ({ signal }) =>
      client.get({
        path: '/api/v1/notifications/preferences',
        schema: preferencesListSchema,
        signal,
      }),
  });
}

export function useNotificationDigestPreview() {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.inf.notifications.digest(),
    queryFn: ({ signal }) =>
      client.get({
        path: '/api/v1/notifications/digest/preview',
        schema: digestPreviewSchema,
        signal,
      }),
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useUpdateNotificationPreference() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<NotificationPreference, Error, UpdatePreferenceInput>({
    mutationFn: ({ type, ...body }) =>
      client.patch({
        path: `/api/v1/notifications/preferences/${type}`,
        body,
        schema: notificationPreferenceSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.inf.notifications.preferences() });
    },
  });
}

export function useMarkNotificationSeen() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<void, Error, { notificationId: string }>({
    mutationFn: ({ notificationId }) =>
      client.post({
        path: `/api/v1/notifications/${notificationId}/seen`,
        body: {},
        schema: z.void(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.inf.notifications.list() });
    },
  });
}

export function useMarkAllNotificationsSeen() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<{ updated: number }, Error, void>({
    mutationFn: () =>
      client.post({
        path: '/api/v1/notifications/seen-all',
        body: {},
        schema: markAllSeenResponseSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.inf.notifications.list() });
    },
  });
}

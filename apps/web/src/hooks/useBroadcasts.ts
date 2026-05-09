import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useApiClient } from '@/hooks/use-api-client';
import { qk } from '@/lib/query-keys';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const broadcastUrgencyValues = ['info', 'important', 'critical'] as const;
const broadcastStatusValues = ['draft', 'scheduled', 'sent', 'cancelled'] as const;

export type BroadcastUrgency = (typeof broadcastUrgencyValues)[number];
export type BroadcastStatus = (typeof broadcastStatusValues)[number];

const targetScopeSchema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('brand') }),
  z.object({ scope: z.literal('cluster_ids'), values: z.array(z.string().uuid()) }),
  z.object({ scope: z.literal('location_ids'), values: z.array(z.string().uuid()) }),
  z.object({ scope: z.literal('role_keys'), values: z.array(z.string()) }),
]);

export type BroadcastTargetScope = z.infer<typeof targetScopeSchema>;

const broadcastAnnouncementSchema = z.object({
  id: z.string().uuid(),
  brandId: z.string().uuid(),
  title: z.string(),
  body: z.string(),
  urgency: z.enum(broadcastUrgencyValues),
  targetScope: targetScopeSchema,
  scheduledFor: z.string().nullable(),
  sentAt: z.string().nullable(),
  ackRequired: z.boolean(),
  status: z.enum(broadcastStatusValues),
  createdByUserId: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
});

export type BroadcastAnnouncement = z.infer<typeof broadcastAnnouncementSchema>;

const broadcastAcknowledgementSchema = z.object({
  id: z.string().uuid(),
  brandId: z.string().uuid(),
  broadcastId: z.string().uuid(),
  userId: z.string().uuid(),
  acknowledgedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
});

export type BroadcastAcknowledgement = z.infer<typeof broadcastAcknowledgementSchema>;

const listSentResultSchema = z.object({
  items: z.array(broadcastAnnouncementSchema),
  nextCursor: z.string().nullable(),
});

export type ListSentResult = z.infer<typeof listSentResultSchema>;

const listAcksResultSchema = z.object({
  ackCount: z.number().int(),
  pendingCount: z.number().int(),
  acks: z.array(
    z.object({
      userId: z.string().uuid(),
      acknowledgedAt: z.string(),
    }),
  ),
});

export type ListAcksResult = z.infer<typeof listAcksResultSchema>;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface ComposeBroadcastInput {
  title: string;
  body: string;
  urgency?: BroadcastUrgency;
  targetScope: BroadcastTargetScope;
  scheduledFor?: string | null;
  ackRequired?: boolean;
}

export interface UpdateBroadcastInput {
  broadcastId: string;
  title?: string;
  body?: string;
  urgency?: BroadcastUrgency;
  targetScope?: BroadcastTargetScope;
  scheduledFor?: string | null;
  ackRequired?: boolean;
  reasonCode?: string;
}

export interface CancelBroadcastInput {
  broadcastId: string;
  reasonCode: string;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useTargetedBroadcasts() {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.inf.broadcasts.list(),
    queryFn: ({ signal }) =>
      client.get({
        path: '/api/v1/broadcasts',
        schema: z.array(broadcastAnnouncementSchema),
        signal,
      }),
  });
}

export function useSentBroadcasts() {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.inf.broadcasts.sent(),
    queryFn: ({ signal }) =>
      client.get({
        path: '/api/v1/broadcasts/sent',
        schema: listSentResultSchema,
        signal,
      }),
  });
}

export function useBroadcast(broadcastId: string | undefined) {
  const client = useApiClient();

  return useQuery({
    queryKey: broadcastId
      ? qk.inf.broadcasts.detail(broadcastId)
      : ['inf', 'broadcasts', 'detail', null],
    queryFn: ({ signal }) => {
      if (!broadcastId) throw new Error('useBroadcast called without broadcastId');
      return client.get({
        path: `/api/v1/broadcasts/${broadcastId}`,
        schema: broadcastAnnouncementSchema,
        signal,
      });
    },
    enabled: Boolean(broadcastId),
  });
}

export function useBroadcastAcks(broadcastId: string | undefined) {
  const client = useApiClient();

  return useQuery({
    queryKey: broadcastId
      ? qk.inf.broadcasts.acks(broadcastId)
      : ['inf', 'broadcasts', 'acks', null],
    queryFn: ({ signal }) => {
      if (!broadcastId) throw new Error('useBroadcastAcks called without broadcastId');
      return client.get({
        path: `/api/v1/broadcasts/${broadcastId}/acks`,
        schema: listAcksResultSchema,
        signal,
      });
    },
    enabled: Boolean(broadcastId),
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useComposeBroadcast() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<BroadcastAnnouncement, Error, ComposeBroadcastInput>({
    mutationFn: (input) =>
      client.post({
        path: '/api/v1/broadcasts',
        body: input,
        schema: broadcastAnnouncementSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.inf.broadcasts.all });
    },
  });
}

export function useUpdateBroadcast() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<BroadcastAnnouncement, Error, UpdateBroadcastInput>({
    mutationFn: ({ broadcastId, ...body }) =>
      client.patch({
        path: `/api/v1/broadcasts/${broadcastId}`,
        body,
        schema: broadcastAnnouncementSchema,
      }),
    onSuccess: (_data, { broadcastId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.inf.broadcasts.all });
      void queryClient.invalidateQueries({ queryKey: qk.inf.broadcasts.detail(broadcastId) });
    },
  });
}

export function useSendBroadcast() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<BroadcastAnnouncement, Error, { broadcastId: string }>({
    mutationFn: ({ broadcastId }) =>
      client.post({
        path: `/api/v1/broadcasts/${broadcastId}/send`,
        body: {},
        schema: broadcastAnnouncementSchema,
      }),
    onSuccess: (_data, { broadcastId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.inf.broadcasts.all });
      void queryClient.invalidateQueries({ queryKey: qk.inf.broadcasts.detail(broadcastId) });
    },
  });
}

export function useCancelBroadcast() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<BroadcastAnnouncement, Error, CancelBroadcastInput>({
    mutationFn: ({ broadcastId, reasonCode }) =>
      client.post({
        path: `/api/v1/broadcasts/${broadcastId}/cancel`,
        body: { reasonCode },
        schema: broadcastAnnouncementSchema,
      }),
    onSuccess: (_data, { broadcastId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.inf.broadcasts.all });
      void queryClient.invalidateQueries({ queryKey: qk.inf.broadcasts.detail(broadcastId) });
    },
  });
}

export function useAcknowledgeBroadcast() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<BroadcastAcknowledgement, Error, { broadcastId: string }>({
    mutationFn: ({ broadcastId }) =>
      client.post({
        path: `/api/v1/broadcasts/${broadcastId}/acknowledge`,
        body: {},
        schema: broadcastAcknowledgementSchema,
      }),
    onSuccess: (_data, { broadcastId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.inf.broadcasts.list() });
      void queryClient.invalidateQueries({ queryKey: qk.inf.broadcasts.acks(broadcastId) });
    },
  });
}

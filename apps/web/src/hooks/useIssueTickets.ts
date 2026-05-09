import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useApiClient } from '@/hooks/use-api-client';
import { useRealtimeChannel } from '@/lib/realtime-bridge';
import { qk } from '@/lib/query-keys';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const issuePriorityValues = ['low', 'medium', 'high', 'critical'] as const;
const issueStatusValues = ['open', 'in_progress', 'pending_info', 'resolved', 'closed'] as const;

export type IssuePriority = (typeof issuePriorityValues)[number];
export type IssueStatus = (typeof issueStatusValues)[number];

const issueTicketSchema = z.object({
  id: z.string().uuid(),
  brandId: z.string().uuid(),
  reference: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(issuePriorityValues),
  status: z.enum(issueStatusValues),
  assigneeUserId: z.string().uuid().nullable(),
  originatorUserId: z.string().uuid(),
  linkedEntityType: z.string().nullable(),
  linkedEntityRef: z.string().nullable(),
  resolvedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
});

export type IssueTicket = z.infer<typeof issueTicketSchema>;

const issueTicketCommentSchema = z.object({
  id: z.string().uuid(),
  brandId: z.string().uuid(),
  ticketId: z.string().uuid(),
  authorUserId: z.string().uuid(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
});

export type IssueTicketComment = z.infer<typeof issueTicketCommentSchema>;

const issueTicketAttachmentSchema = z.object({
  id: z.string().uuid(),
  brandId: z.string().uuid(),
  ticketId: z.string().uuid(),
  storagePath: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int(),
  uploadedByUserId: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
});

export type IssueTicketAttachment = z.infer<typeof issueTicketAttachmentSchema>;

const ticketListResultSchema = z.object({
  items: z.array(issueTicketSchema),
  nextCursor: z.string().nullable(),
});

export type TicketListResult = z.infer<typeof ticketListResultSchema>;

const ticketDetailSchema = z.object({
  ticket: issueTicketSchema,
  comments: z.array(issueTicketCommentSchema),
  attachments: z.array(issueTicketAttachmentSchema),
});

export type TicketDetail = z.infer<typeof ticketDetailSchema>;

const requestAttachmentUploadResultSchema = z.object({
  uploadUrl: z.string(),
  storagePath: z.string(),
  expiresAt: z.string(),
});

export type RequestAttachmentUploadResult = z.infer<typeof requestAttachmentUploadResultSchema>;

const downloadAttachmentResultSchema = z.object({
  url: z.string(),
  expiresAt: z.string(),
  filename: z.string(),
  mimeType: z.string(),
});

export type DownloadAttachmentResult = z.infer<typeof downloadAttachmentResultSchema>;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface IssueTicketsFilter {
  status?: IssueStatus;
  priority?: IssuePriority;
  assigneeUserId?: string;
  limit?: number;
  cursor?: string;
}

export interface CreateIssueTicketInput {
  title: string;
  description: string;
  priority?: IssuePriority;
  assigneeUserId?: string;
  linkedEntityType?: string;
  linkedEntityRef?: string;
}

export interface UpdateIssueTicketInput {
  ticketId: string;
  title?: string;
  description?: string;
  priority?: IssuePriority;
  status?: IssueStatus;
  assigneeUserId?: string | null;
  linkedEntityType?: string | null;
  linkedEntityRef?: string | null;
  reasonCode?: string;
}

export interface AddCommentInput {
  ticketId: string;
  body: string;
}

export interface RequestAttachmentUploadInput {
  ticketId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ConfirmAttachmentUploadInput {
  ticketId: string;
  attId: string;
  storagePath: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface DownloadAttachmentInput {
  ticketId: string;
  attId: string;
}

export interface CloseReopenInput {
  ticketId: string;
  reasonCode?: string;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useIssueTickets(filter?: IssueTicketsFilter) {
  const client = useApiClient();

  const params = new URLSearchParams();
  if (filter?.status) params.set('status', filter.status);
  if (filter?.priority) params.set('priority', filter.priority);
  if (filter?.assigneeUserId) params.set('assigneeUserId', filter.assigneeUserId);
  if (filter?.limit !== undefined) params.set('limit', String(filter.limit));
  if (filter?.cursor) params.set('cursor', filter.cursor);
  const qs = params.toString();

  return useQuery({
    queryKey: qk.inf.issues.list(filter),
    queryFn: ({ signal }) =>
      client.get({
        path: `/api/v1/issues${qs ? `?${qs}` : ''}`,
        schema: ticketListResultSchema,
        signal,
      }),
  });
}

export function useIssueTicket(ticketId: string | undefined) {
  const client = useApiClient();

  useRealtimeChannel({
    channelName: 'issue_tracker_threads',
    filter: (payload) => payload.ticketId === (ticketId ?? ''),
    invalidateKeys: ticketId ? [qk.inf.issues.detail(ticketId)] : [],
  });

  return useQuery({
    queryKey: ticketId ? qk.inf.issues.detail(ticketId) : ['inf', 'issues', 'detail', null],
    queryFn: ({ signal }) => {
      if (!ticketId) throw new Error('useIssueTicket called without ticketId');
      return client.get({
        path: `/api/v1/issues/${ticketId}`,
        schema: ticketDetailSchema,
        signal,
      });
    },
    enabled: Boolean(ticketId),
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateIssueTicket() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<IssueTicket, Error, CreateIssueTicketInput>({
    mutationFn: (input) =>
      client.post({
        path: '/api/v1/issues',
        body: input,
        schema: issueTicketSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.inf.issues.all });
    },
  });
}

export function useUpdateIssueTicket() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<IssueTicket, Error, UpdateIssueTicketInput>({
    mutationFn: ({ ticketId, ...body }) =>
      client.patch({
        path: `/api/v1/issues/${ticketId}`,
        body,
        schema: issueTicketSchema,
      }),
    onSuccess: (_data, { ticketId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.inf.issues.all });
      void queryClient.invalidateQueries({ queryKey: qk.inf.issues.detail(ticketId) });
    },
  });
}

export function useAddIssueTicketComment() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<IssueTicketComment, Error, AddCommentInput>({
    mutationFn: ({ ticketId, body }) =>
      client.post({
        path: `/api/v1/issues/${ticketId}/comments`,
        body: { body },
        schema: issueTicketCommentSchema,
      }),
    onSuccess: (_data, { ticketId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.inf.issues.detail(ticketId) });
    },
  });
}

export function useRequestAttachmentUpload() {
  const client = useApiClient();

  return useMutation<RequestAttachmentUploadResult, Error, RequestAttachmentUploadInput>({
    mutationFn: ({ ticketId, filename, mimeType, sizeBytes }) =>
      client.post({
        path: `/api/v1/issues/${ticketId}/attachments`,
        body: { filename, mimeType, sizeBytes },
        schema: requestAttachmentUploadResultSchema,
      }),
  });
}

export function useConfirmAttachmentUpload() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<IssueTicketAttachment, Error, ConfirmAttachmentUploadInput>({
    mutationFn: ({ ticketId, attId, storagePath, filename, mimeType, sizeBytes }) =>
      client.patch({
        path: `/api/v1/issues/${ticketId}/attachments/${attId}/confirm`,
        body: { storagePath, filename, mimeType, sizeBytes },
        schema: issueTicketAttachmentSchema,
      }),
    onSuccess: (_data, { ticketId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.inf.issues.detail(ticketId) });
    },
  });
}

export function useDownloadAttachment() {
  const client = useApiClient();

  return useMutation<DownloadAttachmentResult, Error, DownloadAttachmentInput>({
    mutationFn: ({ ticketId, attId }) =>
      client.get({
        path: `/api/v1/issues/${ticketId}/attachments/${attId}/download`,
        schema: downloadAttachmentResultSchema,
      }),
  });
}

export function useCloseIssueTicket() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<IssueTicket, Error, CloseReopenInput>({
    mutationFn: ({ ticketId, reasonCode }) =>
      client.post({
        path: `/api/v1/issues/${ticketId}/close`,
        body: { reasonCode },
        schema: issueTicketSchema,
      }),
    onSuccess: (_data, { ticketId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.inf.issues.all });
      void queryClient.invalidateQueries({ queryKey: qk.inf.issues.detail(ticketId) });
    },
  });
}

export function useReopenIssueTicket() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<IssueTicket, Error, CloseReopenInput>({
    mutationFn: ({ ticketId, reasonCode }) =>
      client.post({
        path: `/api/v1/issues/${ticketId}/reopen`,
        body: { reasonCode },
        schema: issueTicketSchema,
      }),
    onSuccess: (_data, { ticketId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.inf.issues.all });
      void queryClient.invalidateQueries({ queryKey: qk.inf.issues.detail(ticketId) });
    },
  });
}

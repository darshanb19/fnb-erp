import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useApiClient } from '@/hooks/use-api-client';
import { useSession } from '@/lib/auth';
import { useRealtimeChannel } from '@/lib/realtime-bridge';
import { qk } from '@/lib/query-keys';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const approvalRequestStatusValues = [
  'pending',
  'approved',
  'rejected',
  'cancelled',
  'delegated',
] as const;

const approvalStepDecisionValues = ['pending', 'approved', 'rejected', 'delegated'] as const;

const approvalRequestSchema = z.object({
  id: z.string().uuid(),
  brandId: z.string().uuid(),
  entityType: z.string(),
  entityRef: z.string(),
  entityValue: z.string().nullable(),
  requestingUserId: z.string().uuid(),
  chainId: z.string().uuid(),
  currentStep: z.number().int(),
  status: z.enum(approvalRequestStatusValues),
  routingReason: z.string(),
  payload: z.unknown().nullable(),
  decidedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
});

export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;

const approvalRequestStepSchema = z.object({
  id: z.string().uuid(),
  brandId: z.string().uuid(),
  requestId: z.string().uuid(),
  stepIndex: z.number().int(),
  approverUserId: z.string().uuid(),
  decision: z.enum(approvalStepDecisionValues),
  decidedAt: z.string().nullable(),
  comment: z.string().nullable(),
  escalatedAt: z.string().nullable(),
  escalationTargetUserId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
});

export type ApprovalRequestStep = z.infer<typeof approvalRequestStepSchema>;

const pendingApprovalRowSchema = z.object({
  step: approvalRequestStepSchema,
  request: approvalRequestSchema,
});

export type PendingApprovalRow = z.infer<typeof pendingApprovalRowSchema>;

const approvalInboxSchema = z.array(pendingApprovalRowSchema);

const approvalStatusViewSchema = z.object({
  request: approvalRequestSchema,
  steps: z.array(approvalRequestStepSchema),
});

export type ApprovalStatusView = z.infer<typeof approvalStatusViewSchema>;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface DecideApprovalInput {
  requestId: string;
  decision: 'approved' | 'rejected';
  comment?: string | null;
  reasonCode?: string | null;
}

export interface DelegateApprovalInput {
  requestId: string;
  targetUserId: string;
  reasonCode: string;
  comment?: string | null;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useApprovalInbox() {
  const client = useApiClient();
  const { session } = useSession();

  useRealtimeChannel({
    channelName: 'approval_requests',
    filter: (payload) => payload.approverId === (session?.user.id ?? ''),
    invalidateKeys: [qk.inf.approvals.inbox()],
  });

  return useQuery({
    queryKey: qk.inf.approvals.inbox(),
    queryFn: ({ signal }) =>
      client.get({
        path: '/api/v1/approvals/inbox',
        schema: approvalInboxSchema,
        signal,
      }),
    enabled: Boolean(session),
  });
}

export function useApprovalRequest(requestId: string | undefined) {
  const client = useApiClient();

  return useQuery({
    queryKey: requestId
      ? qk.inf.approvals.request(requestId)
      : ['inf', 'approvals', 'request', null],
    queryFn: ({ signal }) => {
      if (!requestId) throw new Error('useApprovalRequest called without requestId');
      return client.get({
        path: `/api/v1/approvals/${requestId}`,
        schema: approvalStatusViewSchema,
        signal,
      });
    },
    enabled: Boolean(requestId),
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useDecideApproval() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<ApprovalRequest, Error, DecideApprovalInput>({
    mutationFn: ({ requestId, decision, comment, reasonCode }) =>
      client.post({
        path: `/api/v1/approvals/${requestId}/decide`,
        body: { decision, comment, reasonCode },
        schema: approvalRequestSchema,
      }),
    onSuccess: (_data, { requestId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.inf.approvals.inbox() });
      void queryClient.invalidateQueries({ queryKey: qk.inf.approvals.request(requestId) });
    },
  });
}

export function useDelegateApproval() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<ApprovalRequestStep, Error, DelegateApprovalInput>({
    mutationFn: ({ requestId, targetUserId, reasonCode, comment }) =>
      client.post({
        path: `/api/v1/approvals/${requestId}/delegate`,
        body: { targetUserId, reasonCode, comment },
        schema: approvalRequestStepSchema,
      }),
    onSuccess: (_data, { requestId }) => {
      void queryClient.invalidateQueries({ queryKey: qk.inf.approvals.inbox() });
      void queryClient.invalidateQueries({ queryKey: qk.inf.approvals.request(requestId) });
    },
  });
}

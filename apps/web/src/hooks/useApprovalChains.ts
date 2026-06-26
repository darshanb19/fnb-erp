import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useApiClient } from '@/hooks/use-api-client';
import { qk } from '@/lib/query-keys';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const chainEntityTypeValues = [
  'po_threshold',
  'gr_shelf_life_exception',
  'recipe_default_change',
  'bo_self_creation',
  'inventory_adjustment',
  'b2b_credit_limit_change',
] as const;

const chainStatusValues = ['draft', 'active', 'inactive'] as const;

const chainStepSchema = z.object({
  role: z.string(),
  // The API serialises a step's optional fields as `null` (not omitted), so
  // these must be `.nullish()` (null | undefined | value) — a bare `.optional()`
  // rejects `null` and made the whole chains response fail Zod validation
  // ("Response did not match expected schema").
  stepIndex: z.number().int().nullish(),
  valueBandMin: z.number().nullish(),
  valueBandMax: z.number().nullish(),
  escalationTimeoutMinutes: z.number().int(),
  fallbackDelegateUserId: z.string().uuid().nullish(),
});

export type ApprovalChainStep = z.infer<typeof chainStepSchema>;

const approvalChainSchema = z.object({
  id: z.string().uuid(),
  brandId: z.string().uuid(),
  entityType: z.enum(chainEntityTypeValues),
  name: z.string(),
  description: z.string().nullable(),
  steps: z.array(chainStepSchema),
  status: z.enum(chainStatusValues),
  createdBy: z.string().uuid().nullable(),
  lastModifiedBy: z.string().uuid().nullable(),
  lastModifiedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  updatedBy: z.string().uuid().nullable(),
});

export type ApprovalChain = z.infer<typeof approvalChainSchema>;

const approvalChainsListSchema = z.array(approvalChainSchema);

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface ChainFilter {
  entityType?: (typeof chainEntityTypeValues)[number];
  status?: (typeof chainStatusValues)[number];
}

export interface ChainCreateInput {
  entityType: (typeof chainEntityTypeValues)[number];
  name: string;
  description?: string | null;
  steps: ApprovalChainStep[];
  status?: (typeof chainStatusValues)[number];
  reasonCode?: string | null;
}

export type ChainUpdateInput = ChainCreateInput;

export interface ChainActivateInput extends ChainUpdateInput {
  chainId: string;
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useApprovalChains(_filter?: ChainFilter) {
  const client = useApiClient();

  return useQuery({
    queryKey: qk.inf.approvalChains.list(),
    queryFn: ({ signal }) =>
      client.get({
        path: '/api/v1/approvals/chains',
        schema: approvalChainsListSchema,
        signal,
      }),
  });
}

export function useApprovalChain(chainId: string | undefined) {
  const chains = useApprovalChains();
  return {
    ...chains,
    data: chains.data?.find((c) => c.id === chainId),
  };
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateChain() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<ApprovalChain, Error, ChainCreateInput>({
    mutationFn: (input) =>
      client.post({
        path: '/api/v1/approvals/chains',
        body: input,
        schema: approvalChainSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.inf.approvalChains.all });
    },
  });
}

export function useUpdateChain() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<ApprovalChain, Error, { chainId: string } & ChainUpdateInput>({
    mutationFn: ({ chainId, ...body }) =>
      client.patch({
        path: `/api/v1/approvals/chains/${chainId}`,
        body,
        schema: approvalChainSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.inf.approvalChains.all });
    },
  });
}

export function useActivateChain() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<ApprovalChain, Error, ChainActivateInput>({
    mutationFn: ({ chainId, ...body }) =>
      client.post({
        path: `/api/v1/approvals/chains/${chainId}/activate`,
        body,
        schema: approvalChainSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.inf.approvalChains.all });
    },
  });
}

export function useDeactivateChain() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<ApprovalChain, Error, ChainActivateInput>({
    mutationFn: ({ chainId, ...body }) =>
      client.post({
        path: `/api/v1/approvals/chains/${chainId}/deactivate`,
        body,
        schema: approvalChainSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.inf.approvalChains.all });
    },
  });
}

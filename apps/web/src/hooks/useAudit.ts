import { useQuery, useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { useApiClient } from '@/hooks/use-api-client';
import { qk } from '@/lib/query-keys';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const auditLogRowSchema = z.object({
  id: z.string().uuid(),
  brandId: z.string().uuid(),
  occurredAt: z.string(),
  actorUserId: z.string().uuid().nullable(),
  tableName: z.string(),
  rowId: z.string(),
  action: z.string(),
  changedFields: z.unknown().nullable(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  reason: z.string().nullable(),
  trnReference: z.string().nullable(),
  context: z.unknown().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().uuid().nullable(),
  updatedBy: z.string().uuid().nullable(),
});

export type AuditLogRow = z.infer<typeof auditLogRowSchema>;

const listEventsResultSchema = z.object({
  items: z.array(auditLogRowSchema),
  nextCursor: z.string().nullable(),
});

export type ListEventsResult = z.infer<typeof listEventsResultSchema>;

const entityTimelineSchema = z.array(auditLogRowSchema);

const exportResultCsvSchema = z.object({
  format: z.enum(['csv', 'excel']),
  data: z.string(),
});

const exportResultPdfSchema = z.object({
  format: z.literal('pdf'),
  jobId: z.string(),
});

const exportResultSchema = z.union([exportResultCsvSchema, exportResultPdfSchema]);

export type ExportResult = z.infer<typeof exportResultSchema>;

const exportJobStatusSchema = z.object({
  jobId: z.string(),
  status: z.string(),
  message: z.string().optional(),
});

export type ExportJobStatus = z.infer<typeof exportJobStatusSchema>;

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface AuditEventsFilter {
  entityType?: string;
  entityRef?: string;
  actorUserId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  cursor?: string;
  limit?: number;
}

export interface EnqueueAuditExportInput {
  format: 'csv' | 'excel' | 'pdf';
  filters?: {
    entityType?: string;
    entityRef?: string;
    actorUserId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  };
}

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useAuditEvents(filters: AuditEventsFilter = {}) {
  const client = useApiClient();

  const params = new URLSearchParams();
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.entityRef) params.set('entityRef', filters.entityRef);
  if (filters.actorUserId) params.set('actorUserId', filters.actorUserId);
  if (filters.action) params.set('action', filters.action);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.cursor) params.set('cursor', filters.cursor);
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  const qs = params.toString();

  return useQuery({
    queryKey: qk.inf.audit.events(filters),
    queryFn: ({ signal }) =>
      client.get({
        path: `/api/v1/audit/events${qs ? `?${qs}` : ''}`,
        schema: listEventsResultSchema,
        signal,
      }),
  });
}

export function useEntityTimeline(entityType: string | undefined, entityRef: string | undefined) {
  const client = useApiClient();

  return useQuery({
    queryKey:
      entityType && entityRef
        ? qk.inf.audit.entityTimeline(entityType, entityRef)
        : ['inf', 'audit', 'entityTimeline', null, null],
    queryFn: ({ signal }) => {
      if (!entityType || !entityRef)
        throw new Error('useEntityTimeline called without entityType or entityRef');
      return client.get({
        path: `/api/v1/audit/entities/${entityType}/${entityRef}/timeline`,
        schema: entityTimelineSchema,
        signal,
      });
    },
    enabled: Boolean(entityType && entityRef),
  });
}

export function useAuditExportStatus(jobId: string | undefined) {
  const client = useApiClient();

  return useQuery({
    queryKey: jobId ? qk.inf.audit.exportJob(jobId) : ['inf', 'audit', 'export', null],
    queryFn: ({ signal }) => {
      if (!jobId) throw new Error('useAuditExportStatus called without jobId');
      return client.get({
        path: `/api/v1/audit/exports/${jobId}`,
        schema: exportJobStatusSchema,
        signal,
      });
    },
    enabled: Boolean(jobId),
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useEnqueueAuditExport() {
  const client = useApiClient();

  return useMutation<ExportResult, Error, EnqueueAuditExportInput>({
    mutationFn: (input) =>
      client.post({
        path: '/api/v1/audit/export',
        body: input,
        schema: exportResultSchema,
      }),
  });
}

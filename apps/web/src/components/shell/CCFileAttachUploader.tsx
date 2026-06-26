import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Image as ImageIcon,
  Paperclip,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from './Button'

/**
 * CCFileAttachUploader — first DL-017 mockup for the signed-URL upload
 * pattern.
 *
 * Phase 4 Epic 3 INF Arc (b) Task B3 — first appearance of the per-brand
 * Storage attachment surface in the mockup library. Consumed by SI-INF-008
 * (Issue Ticket form) in this task; future consumers across Epics 4–12 will
 * import the same shell.
 *
 * DL-017 (per-brand storage bucket; signed PUT URL): the mockup does NOT
 * construct paths or perform uploads. Production wiring (Arc (c) Task C8c)
 * lands the Express signed-URL provisioning endpoint and the browser-side
 * direct PUT — the shell merely renders the resulting attachment cards by
 * state (`idle` / `uploading` / `uploaded` / `error`) and emits callbacks
 * for the picker / remove / retry affordances. Each upload writes a row to
 * `issue_ticket_attachments` (brand-scoped, append-only on insert; DELETE
 * permitted by spec but UI-gated to originator + uploader).
 *
 * DL-041: storage bucket name is `brand-<uuid>`, NOT `brand-<slug>`. Files
 * land under `${brandUuid}/${entityType}/${entityId}/${filename}` — see
 * `apps/api/src/db/schema/issue-tickets.ts` for the canonical
 * `storagePath` format.
 *
 * Tokens (DESIGN.md §6.1, §6.4): surface_container_lowest,
 * surface_container_low, surface_container, surface_container_high,
 * on_surface, on_surface_variant, primary, error, on_error_container,
 * status_in_progress (uploading), status_confirmed (uploaded),
 * outline_variant.
 *
 * Borders: only `border-l-4` on the error-state attachment card (the
 * §6.1 status-pip pattern; always allowed) plus `focus-visible:` rings.
 * No sectioning borders.
 *
 * Animation: NONE per CLAUDE.md (data forms). Tailwind transitions only —
 * the upload progress bar is a width transition, no spinner.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AttachmentState = 'idle' | 'uploading' | 'uploaded' | 'error'

export interface IssueAttachment {
  readonly id: string
  readonly filename: string
  readonly mimeType: string
  readonly sizeBytes: number
  /** ISO-8601 timestamp. */
  readonly uploadedAt: string
  /** Resolved display name of the uploader. */
  readonly uploadedByLabel: string
  readonly state: AttachmentState
  /** 0–100; only meaningful when `state === 'uploading'`. */
  readonly uploadProgressPct?: number
  /** Only when `state === 'error'`. */
  readonly errorMessage?: string
  /** Signed GET URL — mockup uses '#'. */
  readonly downloadUrl?: string
}

export interface CCFileAttachUploaderProps {
  readonly attachments: ReadonlyArray<IssueAttachment>
  /** MIME allowlist — surfaced in the helper line. Mockup does not validate. */
  readonly acceptedMimeTypes: ReadonlyArray<string>
  /** Max file size in bytes — surfaced in the helper line. */
  readonly maxSizeBytes: number
  /** Opens the browser file picker. Mockup just emits the callback. */
  readonly onPickFile: () => void
  readonly onRemove: (id: string) => void
  /** Shown only when an attachment is in `error` state. */
  readonly onRetry: (id: string) => void
  readonly liveIndicator?: boolean
  readonly className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const RELATIVE_FALLBACK = '2026-05-08T11:14:00+05:30'

function relativeTime(iso: string, nowIso = RELATIVE_FALLBACK): string {
  const diffMs = new Date(nowIso).getTime() - new Date(iso).getTime()
  if (Number.isNaN(diffMs)) return iso
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} h ago`
  const days = Math.round(hrs / 24)
  if (days < 7) return `${days} d ago`
  return new Date(iso).toISOString().slice(0, 10)
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function iconForMime(mime: string) {
  if (mime.startsWith('image/')) return ImageIcon
  return FileText
}

function shortMimeLabel(mime: string): string {
  // e.g. "image/png" → "PNG"; "application/pdf" → "PDF"
  const parts = mime.split('/')
  const last = parts[parts.length - 1] ?? mime
  return last.toUpperCase()
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component — single attachment card.
// ─────────────────────────────────────────────────────────────────────────────

interface AttachmentCardProps {
  readonly attachment: IssueAttachment
  readonly onRemove: (id: string) => void
  readonly onRetry: (id: string) => void
}

function AttachmentCard({ attachment, onRemove, onRetry }: AttachmentCardProps) {
  const Icon = iconForMime(attachment.mimeType)
  const isError = attachment.state === 'error'
  const isUploading = attachment.state === 'uploading'
  const isUploaded =
    attachment.state === 'uploaded' || attachment.state === 'idle'

  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-sm p-3',
        isError
          ? 'bg-error-container text-on-error-container border-l-4 border-error'
          : 'bg-surface-container-low text-on-surface',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            aria-hidden
            className={cn(
              'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm',
              isError
                ? 'bg-error text-on-error'
                : 'bg-surface-container-high text-on-surface',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex flex-col">
            <span className="text-sm font-medium truncate" title={attachment.filename}>
              {attachment.filename}
            </span>
            <span className="text-[11px] text-on-surface-variant">
              {shortMimeLabel(attachment.mimeType)} ·{' '}
              {formatBytes(attachment.sizeBytes)} · {attachment.uploadedByLabel} ·{' '}
              {relativeTime(attachment.uploadedAt)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isUploaded && attachment.downloadUrl ? (
            <Button asChild variant="ghost" size="sm" aria-label="Download attachment">
              <a href={attachment.downloadUrl}>
                <Download className="h-3.5 w-3.5" aria-hidden />
                <span className="text-xs">Download</span>
              </a>
            </Button>
          ) : null}
          {isError ? (
            <Button
              type="button"
              variant="tonal"
              size="sm"
              onClick={() => onRetry(attachment.id)}
              aria-label="Retry upload"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              <span className="text-xs">Retry</span>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(attachment.id)}
            aria-label={`Remove ${attachment.filename}`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      </div>

      {isUploading ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-on-surface-variant">
            <Upload className="h-3 w-3" aria-hidden />
            Uploading
          </span>
          <div
            role="progressbar"
            aria-valuenow={attachment.uploadProgressPct ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 flex-1 overflow-hidden rounded-pill bg-surface-container"
          >
            <div
              className="h-full rounded-pill bg-primary transition-[width]"
              style={{ width: `${attachment.uploadProgressPct ?? 0}%` }}
            />
          </div>
          <span className="text-[11px] tabular-nums text-on-surface-variant">
            {attachment.uploadProgressPct ?? 0}%
          </span>
        </div>
      ) : null}

      {isError && attachment.errorMessage ? (
        <p className="flex items-start gap-1.5 text-[11px] font-medium">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
          <span>{attachment.errorMessage}</span>
        </p>
      ) : null}

      {attachment.state === 'uploaded' ? (
        <p className="inline-flex items-center gap-1.5 text-[11px] text-on-surface-variant">
          <CheckCircle2 className="h-3 w-3" aria-hidden />
          Stored to per-brand bucket.
        </p>
      ) : null}
    </li>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function CCFileAttachUploader({
  attachments,
  acceptedMimeTypes,
  maxSizeBytes,
  onPickFile,
  onRemove,
  onRetry,
  liveIndicator = false,
  className,
}: CCFileAttachUploaderProps) {
  const acceptedShort = acceptedMimeTypes.map(shortMimeLabel).join(' · ')
  const maxLabel = formatBytes(maxSizeBytes)
  const uploadingCount = attachments.filter((a) => a.state === 'uploading').length

  return (
    <div
      className={cn(
        'flex flex-col rounded-md bg-surface-container-lowest',
        className,
      )}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Paperclip
            className="h-4 w-4 text-on-surface-variant"
            aria-hidden
          />
          <h3 className="text-sm font-semibold text-on-surface">
            Attachments
            <span className="ml-2 text-xs font-normal text-on-surface-variant tabular-nums">
              {attachments.length}
            </span>
          </h3>
        </div>
        {liveIndicator ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-pill bg-surface-container px-2 py-0.5 text-[11px] font-medium text-on-surface"
            aria-label="Realtime live"
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-pill bg-tertiary" />
            Live
          </span>
        ) : null}
      </header>

      {/* Picker strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3">
        <div className="flex flex-col gap-1">
          <Button
            type="button"
            variant="tonal"
            size="default"
            onClick={onPickFile}
            aria-label="Pick a file to attach"
          >
            <Upload className="h-4 w-4" aria-hidden />
            Attach a file
          </Button>
          <span className="text-[11px] text-on-surface-variant">
            Allowed: {acceptedShort || 'any'} · Max {maxLabel} per file. Files
            land in the per-brand bucket.
          </span>
        </div>
        {uploadingCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface-container-high px-2 py-1 text-[11px] font-medium text-on-surface">
            <Upload className="h-3 w-3" aria-hidden />
            {uploadingCount} uploading
          </span>
        ) : null}
      </div>

      {/* Attachment list */}
      <div className="px-4 pb-4">
        {attachments.length === 0 ? (
          <div className="rounded-sm bg-surface-container-low p-6 text-center">
            <Paperclip
              className="mx-auto h-6 w-6 text-on-surface-variant"
              aria-hidden
            />
            <p className="mt-2 text-sm font-medium text-on-surface">
              No attachments yet
            </p>
            <p className="mt-1 text-xs text-on-surface-variant">
              Pick a file above. Photos, PDFs, and plain-text logs are
              accepted by default.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {attachments.map((a) => (
              <AttachmentCard
                key={a.id}
                attachment={a}
                onRemove={onRemove}
                onRetry={onRetry}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

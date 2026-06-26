import { useId, useState } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import {
  AlertTriangle,
  ChevronDown,
  FileWarning,
  Info,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from './Button'
import { SectionShift } from './SectionShift'
import { StatusPill, type StatusToken } from './StatusPill'

/**
 * CCReverseCancelDialog — CC-REVERSE-CANCEL canonical (SI-INF-010 pattern).
 *
 * Phase 4 Epic 3 INF Arc (b) Task B6. Pattern-shell only — SI-INF-010 is a
 * pattern-reference per `_planning/05-screen-inventory.md` lines 1453–1497, not
 * a standalone screen route. The reverse / cancel affordance lives on each
 * transactional entity-detail screen across Epics 4–12; clicking it opens this
 * confirmation flow as a modal.
 *
 * Two paths driven by `mode` per FR117 (transaction-immutability rule):
 *
 *   - `'pre-confirmed'` — entity has not been confirmed (Draft, Pending GR,
 *     Pending Approval). Confirm cleanly cancels: status moves to
 *     `status_cancelled`, no compensating documents needed because the
 *     transaction has not affected stock or finances yet.
 *   - `'post-confirmed'` — entity is Confirmed and affects stock or finances.
 *     The original is immutable; confirm creates a compensating document
 *     (Credit Note / Adjustment / Reversal Journal) with its own TRN and the
 *     consumer typically routes to the new draft for further edit.
 *
 * Reason code is mandatory per FR117 + FR15a; the reason-code catalog is
 * consumer-owned (the canonical 7-code list lives in
 * `apps/web/src/lib/reason-codes.ts` for Epic 2 USR; Epic 4 INV may extend
 * with cancel/reverse-flavoured codes — pass whichever catalog applies as
 * `reasonCodeOptions`). The shell renders codes verbatim, never invents.
 *
 * First production consumer: Epic 4 INV — PO cancel (pre-confirmed clean
 * path) and inventory adjustment reverse (post-confirmed compensating
 * adjustment). Mockup permutations exercise both paths against PO + B2B
 * challan fixtures so reviewers can eyeball the resolved tonal mappings.
 *
 * Source FRs:
 *   - FR117 — reverse / cancel transactions before confirmed status; once
 *     confirmed, correction path is always a compensating document with its
 *     own TRN. No direct edit or delete on confirmed transactions.
 *   - FR20 — append-only audit trail; reverse/cancel writes a row.
 *   - FR15a — mandatory reason code on every override-shaped mutation.
 *
 * Tokens (DESIGN.md §6.1, §6.4):
 *   - `surface_container_lowest` — body background (popover slot)
 *   - `surface_container_low` — entity-summary card
 *   - `surface_container_high` — info / explanation strip
 *   - `warning` + `on_warning` — post-confirmed compensating-doc band
 *     (irrecoverable-ish: original is immutable, the doc is a workaround)
 *   - `error_container` + `on_error_container` — pre-confirmed cancel CTA
 *     tone (destructive-ish: cancellation removes the entity from active
 *     pipelines)
 *   - `status_cancelled` — pre-confirmed cancel preview pill
 *   - `status_returned` — post-confirmed reversal preview pill
 *   - No `tenant_brand_accent` — DESIGN.md §3 lists the four allowed accent
 *     surfaces; transactional confirmation dialogs are not among them.
 *
 * Borders: NONE. The Radix dialog content sits on a tonal background; the
 * footer is a `<SectionShift>` strip rather than a `border-t`. Focus rings
 * (`focus-visible:ring-2`) on the close affordance + footer CTAs are
 * allowed by CLAUDE.md §"No sectioning borders" allow-list.
 *
 * Animation: Tailwind transitions only (Radix dialog open/close fade-zoom is
 * inherited from the global animation policy via `data-[state=open]:` —
 * standard motion, not entrance animation on a data table).
 *
 * Cross-references:
 *   - SI-INF-005 (Audit Log) — every confirm writes an audit event via
 *     CC-AUDIT-LINK; consumer wires the `reasonCode` + `notes` payload
 *     through to `auditLog.write()`.
 *   - CC-TRN-DISPLAY — post-confirmed compensating-doc preview shows the
 *     pre-allocated TRN (or a `(will assign on submit)` placeholder).
 *
 * Action-type literal naming convention (per Task B5 lesson learned): the
 * `mode` union uses kebab-case literals (`'pre-confirmed'` /
 * `'post-confirmed'`) to keep the pre-commit hook's `status_*` substring
 * checks from false-positiving on `pre_confirmed`-style snake_case.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ReverseCancelMode = 'pre-confirmed' | 'post-confirmed'

export interface EntitySummary {
  /** Human-readable type label, e.g. "Purchase Order", "B2B Challan",
   *  "Inventory Adjustment". */
  typeLabel: string
  /** Reference / TRN of the entity, e.g. "PO-2026-001". */
  reference: string
  /** Current status display label, e.g. "Confirmed". The dialog uses this
   *  when no `currentStatusToken` is supplied; consumers that want a fully
   *  styled `<StatusPill>` should supply both. */
  statusLabel: string
  /** Optional canonical status token to render as a `<StatusPill>` —
   *  e.g. `'status_draft'` for a pre-confirmed PO,
   *  `'status_confirmed'` for a confirmed B2B challan. When omitted the
   *  dialog falls back to a neutral label-only chip. */
  currentStatusToken?: StatusToken
  /** Optional summary line (vendor + amount; customer + amount). */
  detailLine?: string
}

export interface CompensatingDocPreview {
  /** Pretty type label of the compensating document, e.g. "Vendor Credit
   *  Note", "Reverse Challan", "Adjustment Reversal". */
  typeLabel: string
  /** Pre-allocated TRN of the compensating doc, or omit for the dialog to
   *  render a `(will assign on submit)` placeholder. */
  reference?: string
  /** Brief description of what gets compensated. */
  summary: string
}

export interface ReasonCodeOption {
  readonly value: string
  readonly label: string
}

export interface CCReverseCancelDialogProps {
  open: boolean
  mode: ReverseCancelMode
  /** Entity being acted upon. */
  entity: EntitySummary
  /** Required when `mode='post-confirmed'`; the compensating document
   *  preview surfaced in the body. Ignored for pre-confirmed mode. */
  compensatingDoc?: CompensatingDocPreview
  /** Reason code catalog — closed list of allowed values (FR117 mandatory
   *  reason). Consumer-owned. */
  reasonCodeOptions: ReadonlyArray<ReasonCodeOption>
  /** Initial reason code value (pre-fill on open). Defaults to `''`. */
  initialReasonCode?: string
  /** Initial notes value (pre-fill on open). Defaults to `''`. */
  initialNotes?: string
  /** Notes textarea placeholder. Sensible default per mode. */
  notesPlaceholder?: string
  onConfirm(input: { reasonCode: string; notes?: string }): void
  onCancel(): void
}

// ─────────────────────────────────────────────────────────────────────────────
// <CCReverseCancelDialog>
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Modal-style confirmation dialog for the reverse / cancel pattern.
 *
 * UX:
 *   - Header title varies by mode:
 *     - `pre-confirmed`: "Cancel <typeLabel> <reference>"
 *     - `post-confirmed`: "Reverse <typeLabel> <reference>"
 *   - Body:
 *     1. Entity summary card (read-only) — type + ref + status pill + detail.
 *     2. "What this does" tonal strip — explanation differs by mode.
 *     3. (post-confirmed only) Compensating-document preview.
 *     4. Reason — required reason-code select + optional notes textarea.
 *   - Footer:
 *     - Secondary CTA invokes `onCancel()`.
 *     - Primary CTA invokes `onConfirm({ reasonCode, notes })` and is
 *       disabled until a reason code is selected.
 *   - ESC + overlay click + close affordance all invoke `onCancel()`.
 */
export function CCReverseCancelDialog({
  open,
  mode,
  entity,
  compensatingDoc,
  reasonCodeOptions,
  initialReasonCode = '',
  initialNotes = '',
  notesPlaceholder,
  onConfirm,
  onCancel,
}: CCReverseCancelDialogProps) {
  const reactId = useId()
  const codeId = `${reactId}-reason-code`
  const notesId = `${reactId}-reason-notes`

  const [reasonCode, setReasonCode] = useState(initialReasonCode)
  const [notes, setNotes] = useState(initialNotes)

  const isPre = mode === 'pre-confirmed'

  const titleText = isPre
    ? `Cancel ${entity.typeLabel} ${entity.reference}`
    : `Reverse ${entity.typeLabel} ${entity.reference}`

  const primaryCtaText = isPre
    ? `Cancel ${entity.typeLabel}`
    : compensatingDoc
      ? `Create compensating ${compensatingDoc.typeLabel}`
      : `Reverse ${entity.typeLabel}`

  const secondaryCtaText = isPre
    ? `Keep ${entity.typeLabel}`
    : `Don't reverse`

  const explanationText = isPre
    ? `This ${entity.typeLabel} has not been confirmed. Cancelling moves it to status_cancelled. No compensating documents are needed because the transaction has not affected stock or finances yet.`
    : compensatingDoc
      ? `This ${entity.typeLabel} has already been confirmed and affects stock and finances. To preserve the audit trail, a compensating ${compensatingDoc.typeLabel} will be created instead of editing the original. The original stays as-is; the compensating doc reverses its effects.`
      : `This ${entity.typeLabel} has already been confirmed and affects stock and finances. To preserve the audit trail, a compensating document will be created instead of editing the original. The original stays as-is; the compensating doc reverses its effects.`

  const explanationTone = isPre
    ? 'bg-surface-container-high text-on-surface'
    : 'bg-warning text-on-warning'

  const ExplanationIcon = isPre ? Info : AlertTriangle

  const previewToken: StatusToken = isPre
    ? 'status_cancelled'
    : 'status_returned'
  const previewLabel = isPre ? 'Will move to' : 'Compensates as'

  const defaultNotesPlaceholder = isPre
    ? 'Optional — additional context for the audit trail (e.g. data-entry mistake details).'
    : 'Optional — describe what changed and why the compensating document is required.'

  const canConfirm = reasonCode.trim().length > 0

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) onCancel()
  }

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm({
      reasonCode,
      notes: notes.trim().length > 0 ? notes : undefined,
    })
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-slot="reverse-cancel-overlay"
          className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        />
        <DialogPrimitive.Content
          data-slot="reverse-cancel-content"
          data-mode={mode}
          aria-describedby={undefined}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2',
            'sm:max-w-lg overflow-hidden rounded-lg bg-surface-container-lowest text-on-surface outline-none',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
            <div className="flex flex-col gap-0.5 min-w-0">
              <DialogPrimitive.Title
                data-slot="reverse-cancel-title"
                className="text-base font-medium text-on-surface"
              >
                {titleText}
              </DialogPrimitive.Title>
              <p className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                {isPre ? 'Pre-confirmed cancel' : 'Post-confirmed reverse'}
              </p>
            </div>
            <DialogPrimitive.Close asChild>
              <button
                type="button"
                aria-label="Close dialog"
                className={cn(
                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-on-surface-variant',
                  'hover:bg-surface-container-high hover:text-on-surface transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                )}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </DialogPrimitive.Close>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-4 px-5 pb-4">
            {/* 1. Entity summary card */}
            <div
              data-slot="reverse-cancel-entity-summary"
              className="rounded-md bg-surface-container-low p-4 flex flex-col gap-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                    {entity.typeLabel}
                  </span>
                  <span className="font-mono text-sm text-on-surface">
                    {entity.reference}
                  </span>
                </div>
                {entity.currentStatusToken ? (
                  <StatusPill
                    status={entity.currentStatusToken}
                    label={entity.statusLabel}
                    size="sm"
                  />
                ) : (
                  <span className="inline-flex items-center rounded-pill bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-on-surface">
                    {entity.statusLabel}
                  </span>
                )}
              </div>
              {entity.detailLine ? (
                <p className="text-xs text-on-surface-variant">
                  {entity.detailLine}
                </p>
              ) : null}
            </div>

            {/* 2. What this does — tonal strip */}
            <div
              data-slot="reverse-cancel-explanation"
              className={cn(
                'rounded-md p-3 flex items-start gap-2.5',
                explanationTone,
              )}
            >
              <ExplanationIcon
                className="h-4 w-4 shrink-0 mt-0.5"
                aria-hidden
              />
              <p className="text-xs leading-relaxed">{explanationText}</p>
            </div>

            {/* 3. Compensating-document preview (post-confirmed only) */}
            {!isPre && compensatingDoc ? (
              <>
                <SectionShift tone="low" />
                <div
                  data-slot="reverse-cancel-compensating-preview"
                  className="rounded-md bg-surface-container-low p-4 flex flex-col gap-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileWarning
                        className="h-4 w-4 shrink-0 text-on-surface-variant"
                        aria-hidden
                      />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                          {previewLabel}
                        </span>
                        <span className="text-sm font-medium text-on-surface">
                          {compensatingDoc.typeLabel}
                        </span>
                      </div>
                    </div>
                    <StatusPill
                      status={previewToken}
                      size="sm"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] uppercase tracking-wider text-on-surface-variant">
                      Reference
                    </span>
                    <span className="font-mono text-xs text-on-surface">
                      {compensatingDoc.reference ?? '(will assign on submit)'}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    {compensatingDoc.summary}
                  </p>
                </div>
              </>
            ) : null}

            <SectionShift tone="low" />

            {/* 4. Reason — required */}
            <div
              data-slot="reverse-cancel-reason"
              className="grid grid-cols-1 gap-3"
            >
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={codeId}
                  className="text-xs font-medium text-on-surface"
                >
                  Reason code
                  <span className="text-error ml-0.5" aria-hidden>
                    *
                  </span>
                </label>
                <div className="relative">
                  <select
                    id={codeId}
                    aria-required="true"
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value)}
                    className={cn(
                      'h-11 w-full appearance-none rounded-sm bg-surface-container-highest pl-3 pr-9 text-sm text-on-surface',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    )}
                  >
                    <option value="" disabled>
                      Pick a reason code
                    </option>
                    {reasonCodeOptions.map((rc) => (
                      <option key={rc.value} value={rc.value}>
                        {rc.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant"
                    aria-hidden
                  />
                </div>
                <span className="text-[11px] text-on-surface-variant">
                  Required — the audit row pivots on this value.
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={notesId}
                  className="text-xs font-medium text-on-surface"
                >
                  Notes
                  <span className="text-on-surface-variant ml-1 font-normal">
                    (optional)
                  </span>
                </label>
                <textarea
                  id={notesId}
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={notesPlaceholder ?? defaultNotesPlaceholder}
                  className={cn(
                    'rounded-sm bg-surface-container-highest p-3 text-sm text-on-surface',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  )}
                />
              </div>
            </div>
          </div>

          {/* Footer — tonal strip via SectionShift instead of border-t */}
          <SectionShift tone="high" />
          <div
            data-slot="reverse-cancel-footer"
            className="flex flex-col-reverse gap-2 bg-surface-container-low px-5 py-3 sm:flex-row sm:items-center sm:justify-end"
          >
            <Button
              variant="outline"
              onClick={onCancel}
              type="button"
            >
              {secondaryCtaText}
            </Button>
            <Button
              variant="default"
              type="button"
              disabled={!canConfirm}
              onClick={handleConfirm}
              className={cn(
                isPre
                  ? 'bg-error-container text-on-error-container hover:bg-error-container/90'
                  : '',
              )}
            >
              {primaryCtaText}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

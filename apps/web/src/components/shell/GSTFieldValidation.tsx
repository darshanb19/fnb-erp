import { CheckCircle2, CircleHelp, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * GSTFieldValidation — CC-GST-FIELD-VALIDATION canonical (FR118).
 *
 * Live validation panel for the intra-state vs inter-state tax-field
 * combination on a B2B GST closure form (SI-DSP-010 hero). Per
 * `_planning/04-b2b-challan-spec.md` §7 + E-4:
 *
 *   - Intra-state (place_of_supply state == dispatching state):
 *       CGST + SGST required, IGST must be NULL.
 *   - Inter-state (place_of_supply state != dispatching state):
 *       IGST required, CGST + SGST must be NULL.
 *
 * Three states are surfaced visually + via the `useGSTValidation` hook:
 *
 *   - `'empty'`  — sparsely filled fields, neutral panel "fill the
 *      GST fields above to validate".
 *   - `'valid'`  — combination matches the rule, success panel.
 *   - `'invalid'` — combination violates the rule, `error_container`
 *      panel with `role="alert"` + a specific `blockedReason` so the
 *      parent screen can keep the save button disabled.
 *
 * No animation — DESIGN.md §10.3 forbids motion on data-validation
 * surfaces. Status colour is paired with an icon + a text label so it is
 * never the only signal (WCAG 2.1 AA — DESIGN.md §10.4).
 */

export type GSTValidationStatus = 'empty' | 'valid' | 'invalid'

export interface GSTValidationInput {
  /** Two-digit place-of-supply state code (e.g. `"27"`); `null` if not yet picked. */
  placeOfSupplyStateCode: string | null
  /** Two-digit dispatching location state code (always known). */
  dispatchingStateCode: string
  /** CGST amount in paise/rupees; `null` if blank. */
  cgstAmount: number | null
  /** SGST amount; `null` if blank. */
  sgstAmount: number | null
  /** IGST amount; `null` if blank. */
  igstAmount: number | null
}

export interface GSTValidationResult {
  status: GSTValidationStatus
  message: string
  blockedReason?: string
  /** `true` when the combination corresponds to an intra-state sale. Undefined if status is `empty`. */
  isIntraState?: boolean
}

const isFilled = (n: number | null): boolean => n !== null && !Number.isNaN(n)

/**
 * Pure validation hook — no React state. Compute synchronously each render
 * so parent screens can read the gating state on the same render they
 * decide whether to enable the save button.
 */
export function useGSTValidation(input: GSTValidationInput): GSTValidationResult {
  const {
    placeOfSupplyStateCode,
    dispatchingStateCode,
    cgstAmount,
    sgstAmount,
    igstAmount,
  } = input

  const cgstFilled = isFilled(cgstAmount)
  const sgstFilled = isFilled(sgstAmount)
  const igstFilled = isFilled(igstAmount)
  const noAmounts = !cgstFilled && !sgstFilled && !igstFilled

  if (placeOfSupplyStateCode == null && noAmounts) {
    return {
      status: 'empty',
      message: 'Fill the GST fields above to validate.',
    }
  }

  if (placeOfSupplyStateCode == null) {
    return {
      status: 'invalid',
      message: 'Place of supply not selected — required for tax validation.',
      blockedReason: 'Pick the place-of-supply state code.',
    }
  }

  const intraState = placeOfSupplyStateCode === dispatchingStateCode

  if (intraState) {
    if (igstFilled) {
      return {
        status: 'invalid',
        message: 'Intra-state requires CGST + SGST. Remove IGST.',
        blockedReason: 'Intra-state sale — IGST must be empty.',
        isIntraState: true,
      }
    }
    if (!cgstFilled || !sgstFilled) {
      return {
        status: 'invalid',
        message: 'Intra-state requires CGST + SGST. Both amounts must be filled.',
        blockedReason: 'Intra-state sale — CGST and SGST both required.',
        isIntraState: true,
      }
    }
    return {
      status: 'valid',
      message: 'Tax fields valid · intra-state · CGST + SGST',
      isIntraState: true,
    }
  }

  // inter-state
  if (cgstFilled || sgstFilled) {
    return {
      status: 'invalid',
      message: 'Inter-state requires IGST. Remove CGST and SGST.',
      blockedReason: 'Inter-state sale — CGST and SGST must be empty.',
      isIntraState: false,
    }
  }
  if (!igstFilled) {
    return {
      status: 'invalid',
      message: 'Inter-state requires IGST. The IGST amount must be filled.',
      blockedReason: 'Inter-state sale — IGST is required.',
      isIntraState: false,
    }
  }
  return {
    status: 'valid',
    message: 'Tax fields valid · inter-state · IGST',
    isIntraState: false,
  }
}

export interface GSTFieldValidationProps extends GSTValidationInput {
  /** Optional human-readable label for the dispatching state (e.g. "Maharashtra"). */
  dispatchingStateLabel?: string
  /** Optional human-readable label for the place-of-supply state (e.g. "Karnataka"). */
  placeOfSupplyStateLabel?: string
  className?: string
}

export function GSTFieldValidation({
  placeOfSupplyStateCode,
  dispatchingStateCode,
  cgstAmount,
  sgstAmount,
  igstAmount,
  dispatchingStateLabel,
  placeOfSupplyStateLabel,
  className,
}: GSTFieldValidationProps) {
  const result = useGSTValidation({
    placeOfSupplyStateCode,
    dispatchingStateCode,
    cgstAmount,
    sgstAmount,
    igstAmount,
  })

  // Compose a more descriptive valid-state message when both labels exist.
  let detail = result.message
  if (
    result.status === 'valid' &&
    placeOfSupplyStateLabel &&
    dispatchingStateLabel
  ) {
    if (result.isIntraState) {
      detail = `Tax fields valid · intra-state ${dispatchingStateLabel} · CGST + SGST`
    } else {
      detail = `Tax fields valid · inter-state from ${dispatchingStateLabel} to ${placeOfSupplyStateLabel} · IGST`
    }
  }

  if (result.status === 'empty') {
    return (
      <div
        data-slot="gst-field-validation"
        data-status="empty"
        aria-live="polite"
        className={cn(
          'rounded-md bg-surface-container-low px-4 py-3',
          'flex items-start gap-3',
          className,
        )}
      >
        <CircleHelp
          className="h-4 w-4 shrink-0 mt-0.5 text-on-surface-variant"
          aria-hidden
        />
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            GST validation · waiting for input
          </span>
          <p className="text-sm text-on-surface-variant">{detail}</p>
        </div>
      </div>
    )
  }

  if (result.status === 'valid') {
    return (
      <div
        data-slot="gst-field-validation"
        data-status="valid"
        aria-live="polite"
        className={cn(
          'rounded-md bg-surface-container-lowest px-4 py-3',
          'flex items-start gap-3',
          className,
        )}
      >
        <CheckCircle2
          className="h-4 w-4 shrink-0 mt-0.5 text-success"
          aria-hidden
        />
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[11px] font-medium uppercase tracking-wider text-success">
            GST validation · valid
          </span>
          <p className="text-sm text-on-surface">{detail}</p>
          <p className="text-[11px] text-on-surface-variant">
            {result.isIntraState ? 'CGST + SGST mutually exclusive with IGST per E-4' : 'IGST mutually exclusive with CGST + SGST per E-4'}
          </p>
        </div>
      </div>
    )
  }

  // invalid
  return (
    <div
      data-slot="gst-field-validation"
      data-status="invalid"
      role="alert"
      className={cn(
        'rounded-md bg-error-container px-4 py-3 text-on-error-container',
        'flex items-start gap-3',
        className,
      )}
    >
      <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[11px] font-medium uppercase tracking-wider">
          GST validation · invalid combination
        </span>
        <p className="text-sm font-medium">{detail}</p>
        <p className="text-[11px] opacity-90">
          Save blocked until corrected
        </p>
      </div>
    </div>
  )
}

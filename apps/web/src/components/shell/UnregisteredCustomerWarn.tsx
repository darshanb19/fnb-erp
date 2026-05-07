import { TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * UnregisteredCustomerWarn — CC-UNREGISTERED-CUSTOMER-WARN canonical (FR119).
 *
 * When a B2B customer's GST registration type is `unregistered` or
 * `consumer`, raising a GST invoice may not be legally valid. This panel
 * surfaces the FR119 warning text + a mandatory reason-code dropdown that
 * gates the parent screen's save action. For `regular` and `composition`
 * types the panel renders nothing (silent — no GST gating risk).
 *
 * Visual contract:
 *   - `surface_container_high` panel with a `warning`-toned icon + label
 *     strip on the left so colour is never the only signal (DESIGN.md §10.4).
 *   - `role="alert"` on the panel so screen readers announce on render.
 *   - Reason-code `<select>` is `aria-required="true"` and styled like
 *     the rest of the project's form fills (`surface_container_highest`).
 *
 * Hook `useUnregisteredWarn(gstType, reasonCode)` returns gating info for
 * the parent's save-button disabled state.
 *
 * Closed-enum reason options per inventory line 4317 — adding a new option
 * requires a spec amendment (do NOT silently extend).
 */

export type GSTCustomerType = 'regular' | 'composition' | 'unregistered' | 'consumer'

export const UNREGISTERED_REASON_CODES = [
  {
    value: 'customer_request_internal',
    label: 'Customer requested invoice for internal record-keeping',
  },
  {
    value: 'customer_will_register',
    label: 'Customer plans to register and will provide GSTIN later',
  },
  {
    value: 'sample_dispatch',
    label: 'Sample dispatch with notional invoice',
  },
  {
    value: 'other_free_text',
    label: 'Other (free-text follows in audit log)',
  },
] as const

export type UnregisteredReasonCode = typeof UNREGISTERED_REASON_CODES[number]['value']

export interface UnregisteredWarnResult {
  /** Whether the warning panel should render at all. */
  shown: boolean
  /** Whether the parent screen's save action MUST be blocked because
   *  reason-code is required and not yet picked. */
  gating: boolean
  blockedReason?: string
}

export function useUnregisteredWarn(
  gstType: GSTCustomerType,
  reasonCode: string | null,
): UnregisteredWarnResult {
  const requires = gstType === 'unregistered' || gstType === 'consumer'
  if (!requires) {
    return { shown: false, gating: false }
  }
  if (reasonCode == null || reasonCode === '') {
    return {
      shown: true,
      gating: true,
      blockedReason: 'Reason code required for unregistered / consumer customer.',
    }
  }
  return { shown: true, gating: false }
}

export interface UnregisteredCustomerWarnProps {
  gstType: GSTCustomerType
  reasonCode: string | null
  onReasonCodeChange: (code: string) => void
  className?: string
  /** ID for the underlying select; defaults to `unreg-reason-code`. */
  selectId?: string
}

export function UnregisteredCustomerWarn({
  gstType,
  reasonCode,
  onReasonCodeChange,
  className,
  selectId = 'unreg-reason-code',
}: UnregisteredCustomerWarnProps) {
  const { shown } = useUnregisteredWarn(gstType, reasonCode)
  if (!shown) return null

  return (
    <div
      data-slot="unregistered-customer-warn"
      data-gst-type={gstType}
      role="alert"
      className={cn(
        'rounded-md bg-surface-container-high p-4',
        'flex flex-col gap-3',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-warning text-on-warning"
        >
          <TriangleAlert className="h-4 w-4" />
        </span>
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-warning">
            Customer not GST-registered · FR119
          </span>
          <p className="text-sm font-medium text-on-surface">
            This customer is not GST-registered. Raising a GST invoice may
            not be legally valid.
          </p>
          <p className="text-[11px] text-on-surface-variant">
            Customer type:{' '}
            <span className="font-medium uppercase tracking-wider">
              {gstType}
            </span>{' '}
            · choose a reason below to proceed. Override is logged on the
            Brand Owner dashboard.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={selectId}
          className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant"
        >
          Why are you raising a GST invoice for an unregistered customer?
          <span aria-hidden className="ml-1 text-error">*</span>
        </label>
        <select
          id={selectId}
          aria-required="true"
          aria-invalid={reasonCode == null || reasonCode === '' ? 'true' : undefined}
          value={reasonCode ?? ''}
          onChange={(ev) => onReasonCodeChange(ev.target.value)}
          className={cn(
            'h-11 rounded-sm bg-surface-container-highest text-on-surface px-3',
            'text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            'aria-invalid:ring-2 aria-invalid:ring-error',
          )}
        >
          <option value="" disabled>
            Select a reason…
          </option>
          {UNREGISTERED_REASON_CODES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

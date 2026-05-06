import { Link } from 'react-router-dom'
import { ArrowRight, Info, OctagonAlert, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { tokens } from '@/tokens'

/**
 * DataQualityAlert — CC-DATA-QUALITY-ALERT canonical pane.
 *
 * Realises FR116 — cross-module inconsistency alerts surface here. Each row
 * uses the §12.5 margin-accent pattern: 4-px vertical pip on the far left
 * coloured by severity (`error` critical · `tertiary` warning · `primary`
 * info), row body in `surface_container_lowest`, drill-link to the
 * offending master-data record.
 *
 * Common alert shapes:
 *   - "Deactivated material still referenced in published recipe"
 *   - "Deactivated vendor with open POs"
 *   - "Department deactivated while children remain enabled"
 */
export type DataQualitySeverity = 'critical' | 'warning' | 'info'

export interface DataQualityAlert {
  id: string
  kind: 'deactivated_material_in_recipe' | 'deactivated_vendor_open_po' | 'enabled_material_orphan_dept' | 'expired_template_active' | 'other'
  severity: DataQualitySeverity
  message: string
  /** Drill destination — usually the offending master-data record. */
  link: string
  /** Optional brief context line shown beneath the message. */
  context?: string
}

const SEVERITY_PIP: Record<DataQualitySeverity, string> = {
  critical: tokens.error,
  warning: tokens.tertiary,
  info: tokens.primary,
}

const SEVERITY_ICON_COLOUR: Record<DataQualitySeverity, string> = {
  critical: 'text-error',
  warning: 'text-tertiary',
  info: 'text-primary',
}

const SEVERITY_LABEL: Record<DataQualitySeverity, string> = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
}

const SEVERITY_ICON: Record<DataQualitySeverity, typeof TriangleAlert> = {
  critical: OctagonAlert,
  warning: TriangleAlert,
  info: Info,
}

export interface DataQualityAlertProps {
  alerts: ReadonlyArray<DataQualityAlert>
  className?: string
}

export function DataQualityAlertPane({ alerts, className }: DataQualityAlertProps) {
  return (
    <section
      className={cn(
        'rounded-md bg-surface-container-lowest p-5 text-on-surface',
        className,
      )}
      aria-label="Cross-module data-quality alerts"
    >
      <header>
        <h3 className="text-base font-semibold text-on-surface">
          Data-quality alerts
        </h3>
        <p className="mt-1 text-xs text-on-surface-variant">
          Cross-module inconsistencies detected by Epic 1 rules (FR116).
        </p>
      </header>

      {alerts.length === 0 ? (
        <p className="mt-4 text-sm text-on-surface-variant">
          No alerts — master data is consistent across modules.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {alerts.map((alert) => {
            const Icon = SEVERITY_ICON[alert.severity]
            return (
              <li key={alert.id}>
                <Link
                  to={alert.link}
                  className="group flex items-stretch overflow-hidden rounded-sm bg-surface-container-low hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span
                    aria-hidden
                    className="w-1 shrink-0"
                    style={{ backgroundColor: SEVERITY_PIP[alert.severity] }}
                  />
                  <div className="flex w-full items-start gap-3 px-3 py-3 min-h-[52px]">
                    <Icon
                      className={cn('mt-0.5 h-4 w-4 shrink-0', SEVERITY_ICON_COLOUR[alert.severity])}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span
                          className={cn(
                            'text-[11px] font-medium uppercase tracking-wider',
                            SEVERITY_ICON_COLOUR[alert.severity],
                          )}
                        >
                          {SEVERITY_LABEL[alert.severity]}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-on-surface">{alert.message}</p>
                      {alert.context ? (
                        <p className="mt-0.5 text-xs text-on-surface-variant">
                          {alert.context}
                        </p>
                      ) : null}
                    </div>
                    <ArrowRight
                      className="mt-1 h-4 w-4 shrink-0 text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-hidden
                    />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

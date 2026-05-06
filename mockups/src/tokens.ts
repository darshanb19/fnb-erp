/**
 * F&B ERP — TypeScript token mirror of DESIGN.md §5–§6.
 *
 * Use this module ONLY where Tailwind utility classes can't reach:
 *   - SVG `fill` / `stroke` attributes
 *   - Recharts series colours
 *   - Inline `style={{ backgroundColor: tokens.error }}` for dynamic values
 *
 * Static styling MUST go through Tailwind utilities (`bg-primary`,
 * `text-status-draft-fg`, …). The pre-commit hook in Subagent E will
 * eventually forbid hex literals in JSX className/style values — write clean
 * from the start.
 *
 * Source of truth: DESIGN.md §5.1.x (M3 palette), §6.1 (status), §6.4
 * (semantic functional). This file mirrors the hex values in `./globals.css`
 * `:root`. If globals.css changes, this file MUST change in lockstep.
 *
 * Lucide icon name nuances (lucide-react v0.460):
 *   - `truck-loading` does NOT exist; substituted with `truck` (closest match;
 *     surfaces dispatch / Pending GR semantics).
 *   - `x-circle`, `x-octagon`, `alert-triangle`, `help-circle` were renamed
 *     in newer Lucide releases; we use the current canonical names
 *     (`circle-x`, `octagon-x`, `triangle-alert`, `circle-help`).
 *   - All names are kebab-case — Lucide's `dynamicIconImports` uses kebab keys.
 *     The matching React component is PascalCase (`PencilLine`, etc.); kebab
 *     keys are the runtime identifier.
 */

/** Row-pattern status token — full row coloured. */
export interface StatusRowToken {
  readonly bg: string
  readonly fg: string
  readonly icon: string
}

/**
 * Pip-pattern status token — DESIGN.md §6.1 "margin-accent" pattern.
 * Row background stays `surface_container_lowest` (#ffffff); the 4 px left
 * pip carries the colour. No `bg` field — that would contradict the spec.
 */
export interface StatusPipToken {
  readonly pip: string
  readonly fg: string
  readonly icon: string
}

export const tokens = {
  // ==========================================================================
  // §5.1.1 Primary & brand
  // ==========================================================================
  primary: '#00525b',
  primary_container: '#1f6b75',
  on_primary: '#ffffff',
  on_primary_container: '#a4e9f4',
  primary_fixed: '#a9eef9',
  primary_fixed_dim: '#8dd1dd',
  on_primary_fixed: '#001f24',
  on_primary_fixed_variant: '#004f57',
  surface_tint: '#1a6872',

  // ==========================================================================
  // §5.1.2 Secondary & tertiary
  // ==========================================================================
  secondary: '#4a6267',
  secondary_container: '#cae4e9',
  on_secondary: '#ffffff',
  on_secondary_container: '#4e676b',
  tertiary: '#6f3d19',
  tertiary_container: '#8b542e',
  on_tertiary: '#ffffff',
  on_tertiary_container: '#ffd5bc',
  tertiary_fixed: '#ffdbc7',
  tertiary_fixed_dim: '#ffb789',

  // ==========================================================================
  // §5.1.3 Surface hierarchy
  // ==========================================================================
  background: '#f8f9fa',
  surface: '#f8f9fa',
  surface_bright: '#f8f9fa',
  surface_dim: '#d9dadb',
  surface_container_lowest: '#ffffff',
  surface_container_low: '#f3f4f5',
  surface_container: '#edeeef',
  surface_container_high: '#e7e8e9',
  surface_container_highest: '#e1e3e4',
  surface_variant: '#e1e3e4',

  // ==========================================================================
  // §5.1.4 Text & outline
  // ==========================================================================
  on_surface: '#191c1d',
  on_surface_variant: '#3f484a',
  on_background: '#191c1d',
  outline: '#6f797a',
  outline_variant: '#bfc8ca',

  // ==========================================================================
  // §5.1.5 Sidebar chrome
  // ==========================================================================
  sidebar: '#001f24',
  sidebar_hover: '#003940',
  sidebar_active: '#00525b',
  on_sidebar: 'rgba(255, 255, 255, 0.78)',
  on_sidebar_active: '#8dd1dd',
  on_sidebar_muted: 'rgba(255, 255, 255, 0.5)',

  // ==========================================================================
  // §5.1.6 Inverse / overlays
  // ==========================================================================
  inverse_surface: '#2e3132',
  inverse_on_surface: '#f0f1f2',
  inverse_primary: '#8dd1dd',

  // ==========================================================================
  // §6.4 Semantic functional
  // ==========================================================================
  success: '#2E7D32',
  on_success: '#ffffff',
  warning: '#F9A825',
  on_warning: '#191c1d', // §6.4 — never #ffffff on warning (luminance gap)
  error: '#ba1a1a',
  on_error: '#ffffff',
  error_container: '#ffdad6',
  on_error_container: '#93000a',

  // ==========================================================================
  // §3.2 Tenant accent slot (Wild Sugar default)
  // ==========================================================================
  tenant_brand_accent: '#F5B17A',

  // ==========================================================================
  // §6.1 Lifecycle status tokens (20 tokens)
  //
  // 17 row-pattern tokens (StatusRowToken) + 3 pip-pattern tokens
  // (StatusPipToken). Lucide icon names are kebab-case runtime keys.
  // ==========================================================================
  status_draft: {
    bg: '#e7e8e9',
    fg: '#3f484a',
    icon: 'pencil-line',
  } satisfies StatusRowToken,

  status_pending_approval: {
    bg: '#8b542e',
    fg: '#ffffff',
    icon: 'clock',
  } satisfies StatusRowToken,

  status_pending_gr: {
    // Lucide substitution: spec cites `truck-loading` (not in lucide-react
    // v0.460); using `truck` as closest semantic match. Documented here.
    //
    // Foreground spec contradiction: DESIGN.md §6.1 cell reads
    // "on_tertiary_container rich-brown", but the literal value of
    // `on_tertiary_container` is #ffd5bc (light peach), which would be
    // unreadable on the #ffdbc7 (light peach) background. The textual
    // descriptor "rich-brown" matches `tertiary` (#6f3d19). We honour the
    // descriptor for legibility. Surfaced as DESIGN.md interpretation call.
    bg: '#ffdbc7',
    fg: '#6f3d19',
    icon: 'truck',
  } satisfies StatusRowToken,

  status_provisional: {
    pip: '#6f3d19',
    fg: '#191c1d',
    icon: 'flask-conical',
  } satisfies StatusPipToken,

  status_confirmed: {
    bg: '#00525b',
    fg: '#ffffff',
    icon: 'check',
  } satisfies StatusRowToken,

  status_in_progress: {
    bg: '#1a6872',
    fg: '#ffffff',
    icon: 'play',
  } satisfies StatusRowToken,

  status_completed: {
    bg: '#2E7D32',
    fg: '#ffffff',
    icon: 'check-check',
  } satisfies StatusRowToken,

  status_closed: {
    bg: '#4a6267',
    fg: '#ffffff',
    icon: 'archive',
  } satisfies StatusRowToken,

  status_inactive: {
    bg: '#e7e8e9',
    fg: '#3f484a',
    icon: 'circle-off',
  } satisfies StatusRowToken,

  status_archived: {
    bg: '#edeeef',
    fg: '#3f484a',
    icon: 'archive',
  } satisfies StatusRowToken,

  status_version_published: {
    bg: '#cae4e9',
    fg: '#4e676b',
    icon: 'book-marked',
  } satisfies StatusRowToken,

  status_cancelled: {
    // Strikethrough text styling applied at component level, not token.
    bg: '#e7e8e9',
    fg: '#3f484a',
    // Lucide substitution: spec cites `x-circle` (renamed in current Lucide);
    // using current canonical name `circle-x`. Same glyph.
    icon: 'circle-x',
  } satisfies StatusRowToken,

  status_gr_rejected: {
    bg: '#ffdad6',
    fg: '#93000a',
    icon: 'package-x',
  } satisfies StatusRowToken,

  status_rejected: {
    bg: '#ffdad6',
    fg: '#93000a',
    // Lucide substitution: spec cites `x-octagon` (renamed); using current
    // canonical name `octagon-x`. Same glyph.
    icon: 'octagon-x',
  } satisfies StatusRowToken,

  status_returned: {
    bg: '#8b542e',
    fg: '#ffffff',
    icon: 'corner-up-left',
  } satisfies StatusRowToken,

  status_template_active: {
    bg: '#cae4e9',
    fg: '#4e676b',
    icon: 'repeat',
  } satisfies StatusRowToken,

  status_template_expired: {
    bg: '#e7e8e9',
    fg: '#3f484a',
    icon: 'calendar-x',
  } satisfies StatusRowToken,

  status_waiting_info: {
    // Same fg-readability fix as status_pending_gr — see note above.
    bg: '#ffdbc7',
    fg: '#6f3d19',
    // Lucide substitution: spec cites `help-circle` (renamed); using current
    // canonical name `circle-help`. Same glyph.
    icon: 'circle-help',
  } satisfies StatusRowToken,

  status_overridden: {
    pip: '#6f3d19',
    fg: '#191c1d',
    // Lucide substitution: spec cites `alert-triangle` (renamed); using
    // current canonical name `triangle-alert`. Same glyph.
    icon: 'triangle-alert',
  } satisfies StatusPipToken,

  status_variance_flagged: {
    pip: '#ba1a1a',
    fg: '#191c1d',
    icon: 'triangle-alert',
  } satisfies StatusPipToken,
} as const

export type Tokens = typeof tokens

/** Keys whose values are status descriptors (row or pip). */
export type StatusKey = Extract<keyof Tokens, `status_${string}`>

/**
 * Compile-time check: every status key resolves to a row OR pip token.
 * Exported so `noUnusedLocals` doesn't flag the assertion; importing it is
 * not required.
 */
export type StatusShapeAssertion = {
  [K in StatusKey]: Tokens[K] extends StatusRowToken | StatusPipToken
    ? true
    : never
}

/** Type guard — distinguishes the two status token shapes at runtime. */
export function isStatusPipToken(
  token: StatusRowToken | StatusPipToken,
): token is StatusPipToken {
  return 'pip' in token
}

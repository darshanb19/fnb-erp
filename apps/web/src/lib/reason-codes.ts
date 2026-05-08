/**
 * reason-codes — canonical FR15a reason-code catalog for permission overrides.
 *
 * Owned by the consumer (per CC-PERMISSION-OVERRIDE-MGMT shell docstring) —
 * `<OverrideReasonInput reasonCodes={REASON_CODES_CATALOG} />`.
 *
 * Two surfaces consume this list:
 *   - SI-USR-005 EffectivePermissionsPage — looks up `REASON_CODE_LABEL[code]`
 *     when rendering the reason column for an override row.
 *   - SI-USR-006 PermissionOverridePage   — drives the `<OverrideReasonInput>`
 *     dropdown and the live preview pill.
 *
 * Two readers crosses the ≥2 promotion threshold; placing this in `@/lib`
 * rather than inlining keeps both pages source-of-truth-aligned. The catalog
 * mirrors the 7-code list called out in the C5 task spec and the SI-USR-005
 * mockup REASON_CODE_LABEL map (Phase 4 Epic 2 Arc (b)).
 *
 * Adding a new code: extend `REASON_CODES_CATALOG` here in one place. The
 * dropdown order matches the array order — most-common first, "Other" last.
 */

export interface ReasonCode {
  readonly value: string;
  readonly label: string;
}

export const REASON_CODES_CATALOG: ReadonlyArray<ReasonCode> = [
  { value: 'temp_coverage', label: 'Temporary coverage / leave' },
  { value: 'project_access', label: 'Project-specific access' },
  { value: 'role_transition', label: 'Role transition / handover' },
  { value: 'audit_review', label: 'Audit / compliance review' },
  { value: 'security_incident', label: 'Security incident response' },
  { value: 'training', label: 'Training / onboarding' },
  { value: 'other', label: 'Other (see notes)' },
] as const;

/** Lookup map for resolving a code → human label. */
export const REASON_CODE_LABEL: Readonly<Record<string, string>> =
  Object.fromEntries(REASON_CODES_CATALOG.map((rc) => [rc.value, rc.label]));

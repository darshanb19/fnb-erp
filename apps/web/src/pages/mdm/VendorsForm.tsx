/**
 * VendorsForm — SI-MDM-005 Vendor Master create/edit form.
 *
 * Tier 2 acceptance applies (lighter chrome bar than Tier 1 hero screens).
 *
 * Form sections (4):
 *   1. Identity — name (CC-DUPLICATE-WARN below), legal name alias, GSTIN, PAN,
 *                 contact person, email, phone; code field (read-only in edit mode)
 *   2. Scope    — 3-state inline picker (Brand / Cluster / POS) + cluster/POS
 *                 cascading dropdowns. Save scope button opens Popover-as-dialog
 *                 with mandatory reason ≥ 10 chars. Widening/narrowing/lateral
 *                 narrative shown in the panel (§2.7). Lateral → immediate toast.
 *   3. Address  — street, city, state, pincode
 *   4. Status   — active/inactive toggle; deactivation with mandatory reason
 *
 * DL-026: CC-DUPLICATE-WARN below name input, debounced 300 ms, gate ≥ 3 chars,
 * consumes real /api/v1/vendors/find-similar endpoint.
 *
 * Token discipline:
 *   No hex literals. No <Separator>. No banned border classes.
 *   status_confirmed = Active; status_inactive = Deactivated.
 *   border-l-4 pip allowlisted per §5.2.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { z } from 'zod';
import {
  AlertTriangle,
  ChevronRight,
  Loader2,
  Truck,
} from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
  DraftPill,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionShift,
  StatusPill,
} from '@/components/shell';
import { CCDuplicateWarn } from '@/components/shell/CCDuplicateWarn';

import { ApiError } from '@/lib/api-client';
import {
  useVendor,
  useCreateVendor,
  useUpdateVendor,
  useDeactivateVendor,
  useFindSimilarVendors,
  useMutateVendorScope,
} from '@/hooks/mdm/useVendors';
import { useClustersList } from '@/hooks/mdm/useClusters';
import { useLocationsList } from '@/hooks/mdm/useLocations';
import type { VendorScope, VendorPaymentMode } from '@/hooks/mdm/schemas';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// GSTIN: 15-char format — 2 digit state, 10 char PAN, 1 entity, Z, checksum
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
// PAN: 10-char format — AAAAA9999A
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const SCOPE_OPTIONS: ReadonlyArray<{ value: VendorScope; label: string; description: string }> = [
  {
    value: 'brand',
    label: 'Brand',
    description: 'Vendor can supply to any location under this brand.',
  },
  {
    value: 'cluster',
    label: 'Cluster',
    description: 'Vendor is restricted to a specific cluster of locations.',
  },
  {
    value: 'pos',
    label: 'POS',
    description: 'Vendor is restricted to a single point-of-sale location.',
  },
];

const PAYMENT_MODE_OPTIONS: ReadonlyArray<{ value: VendorPaymentMode; label: string }> = [
  { value: 'cash',          label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque',        label: 'Cheque' },
];

// Scope rank: lower index = wider scope
const SCOPE_RANK: Record<VendorScope, number> = { brand: 0, cluster: 1, pos: 2 };

type ScopeTransition = 'widening' | 'narrowing' | 'lateral' | 'no_change';

function classifyTransition(
  fromScope: VendorScope,
  toScope: VendorScope,
  fromClusterId: string | null,
  fromLocationId: string | null,
  toClusterId: string | null,
  toLocationId: string | null,
): ScopeTransition {
  if (fromScope === toScope) {
    // Same tier — check if the binding changed
    if (toScope === 'brand') return 'no_change';
    if (toScope === 'cluster' && fromClusterId === toClusterId) return 'no_change';
    if (toScope === 'pos' && fromLocationId === toLocationId) return 'no_change';
    return 'lateral';
  }
  const fromRank = SCOPE_RANK[fromScope];
  const toRank = SCOPE_RANK[toScope];
  if (toRank < fromRank) return 'widening';
  return 'narrowing';
}

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const vendorFormSchema = z.object({
  name: z.string().min(1, 'Vendor name is required').max(200),
  code: z.string().min(1, 'Code is required').max(40),
  gstin: z
    .string()
    .regex(GSTIN_REGEX, 'GSTIN must be 15 characters in format: 22AAAAA0000A1Z5')
    .optional()
    .or(z.literal('')),
  pan: z
    .string()
    .regex(PAN_REGEX, 'PAN must be 10 characters in format: AAAAA9999A')
    .optional()
    .or(z.literal('')),
  contactPerson: z.string().max(200).optional().or(z.literal('')),
  contactEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  contactPhone: z.string().max(50).optional().or(z.literal('')),
  street: z.string().max(500).optional().or(z.literal('')),
  city: z.string().max(200).optional().or(z.literal('')),
  state: z.string().max(100).optional().or(z.literal('')),
  postalCode: z.string().max(20).optional().or(z.literal('')),
  creditTermsDays: z
    .string()
    .regex(/^\d+$/, 'Must be a positive whole number')
    .optional()
    .or(z.literal('')),
  paymentMode: z.enum(['cash', 'bank_transfer', 'cheque'] as const).optional().or(z.literal('')),
  preferred: z.boolean(),
  qualityRating: z
    .string()
    .regex(/^[1-5](\.\d{0,2})?$/, 'Rating must be between 1 and 5')
    .optional()
    .or(z.literal('')),
});

type VendorFormValues = z.infer<typeof vendorFormSchema>;

// ---------------------------------------------------------------------------
// Debounce hook (internal)
// ---------------------------------------------------------------------------

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FieldError({ message }: { readonly message?: string }) {
  if (!message) return null;
  return (
    <p className="text-xs text-error mt-1" role="alert">
      {message}
    </p>
  );
}

function FormSectionHeader({
  title,
  subtitle,
}: {
  readonly title: string;
  readonly subtitle?: string;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
        {title}
      </p>
      {subtitle ? (
        <p className="mt-0.5 text-xs text-on-surface-variant">{subtitle}</p>
      ) : null}
    </div>
  );
}

function FormSkeleton() {
  return (
    <div role="status" aria-label="Loading vendor…" className="flex flex-col gap-6 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-md bg-surface-container-low p-4 flex flex-col gap-3">
          <div className="h-3 w-32 rounded bg-surface-container-high" />
          <div className="h-10 w-full rounded bg-surface-container-high" />
          <div className="h-10 w-full rounded bg-surface-container-high" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scope picker section
// ---------------------------------------------------------------------------

interface ScopePickerProps {
  readonly currentScope: VendorScope;
  readonly currentClusterId: string | null;
  readonly currentLocationId: string | null;
  readonly vendorId: string | undefined;
  readonly isEditMode: boolean;
  readonly onScopeUpdated: () => void;
}

function ScopePickerSection({
  currentScope,
  currentClusterId,
  currentLocationId,
  vendorId,
  isEditMode,
  onScopeUpdated,
}: ScopePickerProps) {
  const [selectedScope, setSelectedScope] = useState<VendorScope>(currentScope);
  const [selectedClusterId, setSelectedClusterId] = useState<string>(currentClusterId ?? '');
  const [selectedLocationId, setSelectedLocationId] = useState<string>(currentLocationId ?? '');
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const clustersQuery = useClustersList();
  const locationsQuery = useLocationsList();
  const mutateScope = useMutateVendorScope();

  const clusters = useMemo(
    () => (clustersQuery.data ?? []).filter((c) => c.active),
    [clustersQuery.data],
  );

  const locations = useMemo(
    () => (locationsQuery.data ?? []).filter((l) => l.active),
    [locationsQuery.data],
  );

  // Reset to current values when parent vendor changes
  useEffect(() => {
    setSelectedScope(currentScope);
    setSelectedClusterId(currentClusterId ?? '');
    setSelectedLocationId(currentLocationId ?? '');
  }, [currentScope, currentClusterId, currentLocationId]);

  const transition = useMemo(
    () =>
      classifyTransition(
        currentScope,
        selectedScope,
        currentClusterId,
        currentLocationId,
        selectedScope === 'cluster' ? selectedClusterId || null : null,
        selectedScope === 'pos' ? selectedLocationId || null : null,
      ),
    [currentScope, selectedScope, currentClusterId, currentLocationId, selectedClusterId, selectedLocationId],
  );

  const isDirty = transition !== 'no_change';
  const isLateral = transition === 'lateral';
  const canSubmitReason = reason.trim().length >= 10;

  function handleScopeSaveClick() {
    if (!isDirty) return;
    if (isLateral) {
      setToastMessage(
        'Lateral scope changes (same tier, different binding) are not supported. ' +
        'To reassign, deactivate this vendor and create a new one with the desired scope.',
      );
      return;
    }
    setReasonOpen(true);
  }

  async function handleReasonSubmit() {
    if (!canSubmitReason || !vendorId) return;
    const scopeInput = {
      id: vendorId,
      scope: selectedScope,
      clusterId: selectedScope === 'cluster' ? selectedClusterId || undefined : undefined,
      locationId: selectedScope === 'pos' ? selectedLocationId || undefined : undefined,
      reason: reason.trim(),
    };
    try {
      await mutateScope.mutateAsync(scopeInput);
      setReasonOpen(false);
      setReason('');
      onScopeUpdated();
    } catch (err) {
      // Error displayed inline — do not close modal
    }
  }

  const narrativeTitle =
    transition === 'widening'
      ? 'Widening scope — free'
      : transition === 'narrowing'
      ? 'Narrowing scope — review open transactions'
      : null;

  const narrativeBody =
    transition === 'widening'
      ? 'Widening gives this vendor access to more locations. No transaction check is required. Provide a reason and confirm.'
      : transition === 'narrowing'
      ? 'Narrowing restricts this vendor to fewer locations. The API will block this change if any open transactions (purchase orders) still reference the vendor at locations that would be excluded. Resolve open transactions first if needed.'
      : null;

  const currentScopeLabel =
    currentScope === 'brand'
      ? 'Brand (all locations)'
      : currentScope === 'cluster'
      ? (() => {
          const cl = clusters.find((c) => c.id === currentClusterId);
          return cl ? `Cluster · ${cl.name}` : 'Cluster';
        })()
      : (() => {
          const loc = locations.find((l) => l.id === currentLocationId);
          return loc ? `POS · ${loc.name}` : 'POS';
        })();

  return (
    <div className="flex flex-col gap-4">
      {/* Toast for lateral rejection */}
      {toastMessage ? (
        <div
          role="alert"
          className="rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
        >
          {toastMessage}
          <button
            type="button"
            className="ml-3 underline text-xs"
            onClick={() => setToastMessage(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {/* Current scope read-only display (edit mode) */}
      {isEditMode ? (
        <div className="rounded-md bg-surface-container-lowest p-3 flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Current scope
            </p>
            <p className="text-sm font-medium text-on-surface">{currentScopeLabel}</p>
          </div>
          {isDirty ? (
            <span className="text-[11px] text-on-surface-variant">
              {transition === 'lateral' ? 'Lateral — blocked' : `→ ${selectedScope.toUpperCase()}`}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Scope picker radio group */}
      <div>
        <p className="text-xs font-medium text-on-surface mb-2">
          {isEditMode ? 'New scope' : 'Scope'}{' '}
          <span className="text-error ml-0.5" aria-hidden>*</span>
        </p>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Vendor scope">
          {SCOPE_OPTIONS.map((opt) => {
            const isSelected = selectedScope === opt.value;
            return (
              <label
                key={opt.value}
                className={[
                  'flex items-start gap-3 rounded-md p-3 cursor-pointer',
                  'hover:bg-surface-container-low transition-colors',
                  'focus-within:ring-2 focus-within:ring-primary',
                  isSelected ? 'bg-surface-container' : 'bg-surface-container-lowest',
                ].join(' ')}
              >
                <input
                  type="radio"
                  name="vendor-scope"
                  value={opt.value}
                  checked={isSelected}
                  onChange={() => {
                    setSelectedScope(opt.value);
                    if (opt.value !== 'cluster') setSelectedClusterId('');
                    if (opt.value !== 'pos') setSelectedLocationId('');
                  }}
                  className="mt-0.5 shrink-0 accent-primary"
                />
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-on-surface">{opt.label}</span>
                  <span className="text-[11px] text-on-surface-variant">{opt.description}</span>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Cluster dropdown (when scope = cluster) */}
      {selectedScope === 'cluster' ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="scope-cluster" className="text-xs font-medium text-on-surface">
            Cluster <span className="text-error ml-0.5" aria-hidden>*</span>
          </label>
          {clustersQuery.isLoading ? (
            <div className="h-10 rounded-md bg-surface-container-high animate-pulse" />
          ) : (
            <select
              id="scope-cluster"
              aria-required="true"
              value={selectedClusterId}
              onChange={(e) => setSelectedClusterId(e.target.value)}
              className="h-10 w-full rounded-md px-3 text-sm text-on-surface bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">Select cluster…</option>
              {clusters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : null}

      {/* Location dropdown (when scope = pos) */}
      {selectedScope === 'pos' ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="scope-location" className="text-xs font-medium text-on-surface">
            POS Location <span className="text-error ml-0.5" aria-hidden>*</span>
          </label>
          {locationsQuery.isLoading ? (
            <div className="h-10 rounded-md bg-surface-container-high animate-pulse" />
          ) : (
            <select
              id="scope-location"
              aria-required="true"
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              className="h-10 w-full rounded-md px-3 text-sm text-on-surface bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="">Select location…</option>
              {locations
                .filter((l) => l.type === 'pos_outlet' || l.type === 'brand_store' || l.type === 'cluster_store')
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
            </select>
          )}
        </div>
      ) : null}

      {/* §2.7 scope mutation CTA (edit mode only) */}
      {isEditMode ? (
        <div className="flex items-center gap-3">
          <Popover open={reasonOpen} onOpenChange={setReasonOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant={isDirty && !isLateral ? 'tonal' : 'ghost'}
                size="sm"
                disabled={!isDirty}
                onClick={handleScopeSaveClick}
                aria-label="Save scope change"
              >
                {isLateral ? 'Lateral — blocked' : isDirty ? 'Save scope change' : 'No scope change'}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-96 p-4 flex flex-col gap-4"
              role="dialog"
              aria-label="Confirm scope mutation"
              aria-modal="true"
            >
              {/* Narrative */}
              {narrativeTitle && narrativeBody ? (
                <div
                  className={[
                    'rounded-md p-3 flex flex-col gap-1',
                    transition === 'widening'
                      ? 'bg-surface-container-low'
                      : 'bg-surface-container',
                  ].join(' ')}
                >
                  <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
                    {narrativeTitle}
                  </p>
                  <p className="text-sm text-on-surface-variant">{narrativeBody}</p>
                </div>
              ) : null}

              {/* Reason textarea */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="scope-reason" className="text-xs font-medium text-on-surface">
                  Reason <span className="text-error ml-0.5" aria-hidden>*</span>
                  <span className="ml-1 text-on-surface-variant font-normal">(min. 10 characters)</span>
                </label>
                <textarea
                  id="scope-reason"
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe why you are changing the vendor scope"
                  className={[
                    'w-full rounded-md px-3 py-2 text-sm text-on-surface bg-surface-container-low',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    'resize-none',
                  ].join(' ')}
                  aria-describedby="scope-reason-hint"
                />
                <p id="scope-reason-hint" className="text-[11px] text-on-surface-variant">
                  {reason.trim().length}/10 minimum
                </p>
              </div>

              {/* Mutation error */}
              {mutateScope.isError ? (
                <div role="alert" className="rounded-md bg-error-container px-3 py-2 text-sm text-on-error-container">
                  {mutateScope.error instanceof ApiError
                    ? `${mutateScope.error.code}: ${mutateScope.error.message}`
                    : 'Scope mutation failed — please try again.'}
                </div>
              ) : null}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setReasonOpen(false); setReason(''); mutateScope.reset(); }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!canSubmitReason || mutateScope.isPending}
                  onClick={() => { void handleReasonSubmit(); }}
                >
                  {mutateScope.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" aria-hidden />
                      Mutating…
                    </>
                  ) : (
                    'Mutate scope'
                  )}
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {isDirty && !isLateral ? (
            <p className="text-[11px] text-on-surface-variant">
              {transition === 'widening' ? 'Widening — unconditional' : 'Narrowing — may be blocked by open POs'}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deactivate dialog
// ---------------------------------------------------------------------------

interface DeactivateDialogProps {
  readonly vendorName: string;
  readonly vendorId: string;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
}

function DeactivateDialog({ vendorName, vendorId, onClose, onSuccess }: DeactivateDialogProps) {
  const [reason, setReason] = useState('');
  const deactivate = useDeactivateVendor();
  const canSubmit = reason.trim().length >= 10;

  async function handleConfirm() {
    if (!canSubmit) return;
    await deactivate.mutateAsync({ id: vendorId, reason: reason.trim() });
    onSuccess();
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-status-caution-pip mt-0.5" aria-hidden />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Deactivate vendor
          </p>
          <p className="mt-1 text-sm text-on-surface">
            You are about to deactivate{' '}
            <span className="font-medium">{vendorName}</span>. This is a soft-delete — the vendor
            can be reactivated later. Existing purchase orders referencing this vendor are preserved.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="deactivate-vendor-reason" className="text-xs font-medium text-on-surface">
          Reason <span className="text-error ml-0.5" aria-hidden>*</span>
          <span className="ml-1 text-on-surface-variant font-normal">(min. 10 characters)</span>
        </label>
        <Input
          id="deactivate-vendor-reason"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Describe why you are deactivating this vendor"
          aria-describedby="deactivate-vendor-reason-hint"
        />
        <p id="deactivate-vendor-reason-hint" className="text-[11px] text-on-surface-variant">
          {reason.trim().length}/10 minimum
        </p>
      </div>
      {deactivate.isError ? (
        <p className="text-xs text-error" role="alert">
          {deactivate.error instanceof ApiError
            ? deactivate.error.message
            : 'Deactivation failed — please try again.'}
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canSubmit || deactivate.isPending}
          onClick={() => { void handleConfirm(); }}
          className="bg-error text-on-error hover:bg-error/90"
        >
          {deactivate.isPending ? 'Deactivating…' : 'Deactivate vendor'}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main form component
// ---------------------------------------------------------------------------

export default function VendorsForm() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const vendorQuery = useVendor(id ?? '');
  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();

  // ── Form state ────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
    reset,
  } = useForm<VendorFormValues>({
    resolver: zodResolver(vendorFormSchema),
    defaultValues: {
      name: '',
      code: '',
      gstin: '',
      pan: '',
      contactPerson: '',
      contactEmail: '',
      contactPhone: '',
      street: '',
      city: '',
      state: '',
      postalCode: '',
      creditTermsDays: '',
      paymentMode: '',
      preferred: false,
      qualityRating: '',
    },
  });

  // ── Deactivate dialog ─────────────────────────────────────────────────────
  const [showDeactivate, setShowDeactivate] = useState(false);

  // ── Scope state (managed outside RHF for the scope-mutation surface) ───────
  const [currentScope, setCurrentScope] = useState<VendorScope>('brand');
  const [currentClusterId, setCurrentClusterId] = useState<string | null>(null);
  const [currentLocationId, setCurrentLocationId] = useState<string | null>(null);
  // For create mode, we need a controlled scope value
  const [createScopeValue, setCreateScopeValue] = useState<VendorScope>('brand');
  const [createClusterId, setCreateClusterId] = useState('');
  const [createLocationId, setCreateLocationId] = useState('');

  // ── CC-DUPLICATE-WARN ─────────────────────────────────────────────────────
  const [proceedAnyway, setProceedAnyway] = useState(false);
  const nameValue = watch('name');
  const debouncedName = useDebounce(nameValue, 300);
  const similarQuery = useFindSimilarVendors(debouncedName, { excludeId: id });
  const showDuplicateWarn =
    !proceedAnyway &&
    debouncedName.length >= 3 &&
    (similarQuery.data?.length ?? 0) > 0;

  // Reset proceedAnyway when name changes substantially
  useEffect(() => {
    setProceedAnyway(false);
  }, [debouncedName]);

  // ── Pre-fill form when editing ────────────────────────────────────────────
  useEffect(() => {
    if (!vendorQuery.data) return;
    const v = vendorQuery.data;

    reset({
      name: v.name,
      code: v.code,
      gstin: v.gstin ?? '',
      pan: v.pan ?? '',
      contactPerson: v.contactPerson ?? '',
      contactEmail: v.contactEmail ?? '',
      contactPhone: v.contactPhone ?? '',
      street: v.street ?? '',
      city: v.city ?? '',
      state: v.state ?? '',
      postalCode: v.postalCode ?? '',
      creditTermsDays: v.creditTermsDays != null ? String(v.creditTermsDays) : '',
      paymentMode: v.paymentMode ?? '',
      preferred: v.preferred,
      qualityRating: v.qualityRating ?? '',
    });

    setCurrentScope(v.scope);
    setCurrentClusterId(v.scopeClusterId);
    setCurrentLocationId(v.scopeLocationId);
  }, [vendorQuery.data, reset]);

  // ── Clusters + locations for create mode ─────────────────────────────────
  const clustersQuery = useClustersList();
  const locationsQuery = useLocationsList();

  const clusters = useMemo(
    () => (clustersQuery.data ?? []).filter((c) => c.active),
    [clustersQuery.data],
  );

  const locations = useMemo(
    () => (locationsQuery.data ?? []).filter((l) => l.active),
    [locationsQuery.data],
  );

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit: SubmitHandler<VendorFormValues> = useCallback(
    async (values) => {
      const gstinVal = values.gstin?.trim() || null;
      const panVal = values.pan?.trim() || null;
      const contactPersonVal = values.contactPerson?.trim() || null;
      const contactEmailVal = values.contactEmail?.trim() || null;
      const contactPhoneVal = values.contactPhone?.trim() || null;
      const streetVal = values.street?.trim() || null;
      const cityVal = values.city?.trim() || null;
      const stateVal = values.state?.trim() || null;
      const postalCodeVal = values.postalCode?.trim() || null;
      const creditTermsDaysVal = values.creditTermsDays
        ? parseInt(values.creditTermsDays, 10)
        : null;
      const paymentModeVal = (values.paymentMode as VendorPaymentMode) || null;
      const qualityRatingVal = values.qualityRating?.trim() || null;

      if (isEditMode && id) {
        await updateVendor.mutateAsync({
          id,
          name: values.name,
          gstin: gstinVal,
          pan: panVal,
          contactPerson: contactPersonVal,
          contactEmail: contactEmailVal,
          contactPhone: contactPhoneVal,
          street: streetVal,
          city: cityVal,
          state: stateVal,
          postalCode: postalCodeVal,
          creditTermsDays: creditTermsDaysVal,
          paymentMode: paymentModeVal,
          preferred: values.preferred,
          qualityRating: qualityRatingVal,
          reason: 'Updated via Vendor Master form',
        });
        navigate('/mdm/vendors');
      } else {
        // Validate scope selection in create mode
        if (createScopeValue === 'cluster' && !createClusterId) {
          return; // User must select a cluster
        }
        if (createScopeValue === 'pos' && !createLocationId) {
          return; // User must select a location
        }

        await createVendor.mutateAsync({
          code: values.code.trim(),
          name: values.name,
          scope: createScopeValue,
          scopeClusterId: createScopeValue === 'cluster' ? createClusterId : null,
          scopeLocationId: createScopeValue === 'pos' ? createLocationId : null,
          gstin: gstinVal,
          pan: panVal,
          contactPerson: contactPersonVal,
          contactEmail: contactEmailVal,
          contactPhone: contactPhoneVal,
          street: streetVal,
          city: cityVal,
          state: stateVal,
          postalCode: postalCodeVal,
          creditTermsDays: creditTermsDaysVal,
          paymentMode: paymentModeVal,
          preferred: values.preferred,
          qualityRating: qualityRatingVal,
        });
        navigate('/mdm/vendors');
      }
    },
    [id, isEditMode, createScopeValue, createClusterId, createLocationId, createVendor, updateVendor, navigate],
  );

  // ── Loading / error states ────────────────────────────────────────────────
  if (isEditMode && vendorQuery.isLoading) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
          <FormSkeleton />
        </div>
      </div>
    );
  }

  if (isEditMode && vendorQuery.isError) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
          <div role="alert" className="rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container">
            {vendorQuery.error instanceof ApiError
              ? `Error loading vendor: ${vendorQuery.error.message}`
              : 'Failed to load vendor. Please refresh.'}
          </div>
          <Button type="button" variant="ghost" className="mt-4" onClick={() => navigate('/mdm/vendors')}>
            Back to vendor list
          </Button>
        </div>
      </div>
    );
  }

  const mutationError = createVendor.error ?? updateVendor.error;
  const isPending = createVendor.isPending || updateVendor.isPending;

  const vendor = vendorQuery.data;
  const isActive = vendor?.active ?? true;

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-on-surface-variant">
              <a
                href="/mdm/vendors"
                className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
              >
                Vendor Master
              </a>
              <ChevronRight className="h-3 w-3" aria-hidden />
              <span aria-current="page">
                {isEditMode ? 'Edit vendor' : 'New vendor'}
              </span>
            </nav>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-on-surface flex items-center gap-2">
              <Truck className="h-6 w-6 text-on-surface-variant" aria-hidden />
              {isEditMode ? vendor?.name ?? 'Edit vendor' : 'New vendor'}
            </h1>
            {isEditMode && vendor ? (
              <p className="mt-1 text-sm text-on-surface-variant font-mono">
                Code: {vendor.code}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <DraftPill isDraft={isDirty} />
            {isEditMode && vendor ? (
              <StatusPill
                status={isActive ? 'status_confirmed' : 'status_inactive'}
                size="sm"
                label={isActive ? 'Active' : 'Deactivated'}
              />
            ) : null}
          </div>
        </header>

        {/* ── Global mutation error ─────────────────────────────────────────── */}
        {mutationError ? (
          <div role="alert" className="mb-4 rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container">
            {mutationError instanceof ApiError
              ? mutationError.message
              : 'Save failed — please try again.'}
          </div>
        ) : null}

        {/* ── Deactivate dialog overlay ─────────────────────────────────────── */}
        {showDeactivate && vendor ? (
          <Card className="mb-4 p-0 max-w-md">
            <DeactivateDialog
              vendorName={vendor.name}
              vendorId={vendor.id}
              onClose={() => setShowDeactivate(false)}
              onSuccess={() => { setShowDeactivate(false); navigate('/mdm/vendors'); }}
            />
          </Card>
        ) : null}

        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} noValidate>

          {/* ── Section 1: Identity ─────────────────────────────────────────── */}
          <Card className="p-0 mb-4">
            <div className="p-4 sm:p-6">
              <FormSectionHeader
                title="1 · Identity"
                subtitle="Vendor name, code, GSTIN, PAN, and contact information."
              />
            </div>
            <SectionShift tone="low" aria-hidden />
            <CardContent className="p-4 sm:p-6 flex flex-col gap-4">

              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="vendor-name" className="text-xs font-medium text-on-surface">
                  Vendor name <span className="text-error ml-0.5" aria-hidden>*</span>
                </label>
                <Input
                  id="vendor-name"
                  required
                  aria-required="true"
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? 'vendor-name-error' : undefined}
                  placeholder="e.g. Fresh Farm Suppliers Pvt Ltd"
                  {...register('name')}
                />
                <FieldError message={errors.name?.message} />

                {/* CC-DUPLICATE-WARN — DL-026 */}
                {similarQuery.isFetching && debouncedName.length >= 3 ? (
                  <div
                    className="flex items-center gap-2 text-xs text-on-surface-variant"
                    aria-live="polite"
                  >
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Checking for duplicates…
                  </div>
                ) : null}
                {showDuplicateWarn ? (
                  <CCDuplicateWarn
                    matches={(similarQuery.data ?? []).map((m) => ({
                      id: m.id,
                      name: m.name,
                      subtitle: m.gstin ? `GSTIN: ${m.gstin}` : undefined,
                      status: m.active === false ? 'inactive' : 'active',
                    }))}
                    onEditExisting={(matchId) => {
                      navigate(`/mdm/vendors/${matchId}/edit`);
                    }}
                    onProceedAnyway={() => setProceedAnyway(true)}
                  />
                ) : null}
              </div>

              {/* Code */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="vendor-code" className="text-xs font-medium text-on-surface">
                  Vendor code <span className="text-error ml-0.5" aria-hidden>*</span>
                </label>
                <Input
                  id="vendor-code"
                  required
                  aria-required="true"
                  aria-invalid={Boolean(errors.code)}
                  placeholder="e.g. VEND-001"
                  disabled={isEditMode}
                  {...register('code')}
                />
                {isEditMode ? (
                  <p className="text-[11px] text-on-surface-variant">
                    Vendor code is immutable after creation.
                  </p>
                ) : null}
                <FieldError message={errors.code?.message} />
              </div>

              {/* GSTIN + PAN (side by side on larger screens) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="vendor-gstin" className="text-xs font-medium text-on-surface">
                    GSTIN
                    <span className="ml-1 font-normal text-on-surface-variant">(15 chars)</span>
                  </label>
                  <Input
                    id="vendor-gstin"
                    aria-invalid={Boolean(errors.gstin)}
                    placeholder="22AAAAA0000A1Z5"
                    className="font-mono"
                    {...register('gstin')}
                  />
                  <FieldError message={errors.gstin?.message} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="vendor-pan" className="text-xs font-medium text-on-surface">
                    PAN
                    <span className="ml-1 font-normal text-on-surface-variant">(10 chars)</span>
                  </label>
                  <Input
                    id="vendor-pan"
                    aria-invalid={Boolean(errors.pan)}
                    placeholder="AAAAA9999A"
                    className="font-mono"
                    {...register('pan')}
                  />
                  <FieldError message={errors.pan?.message} />
                </div>
              </div>

              {/* Contact person */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="vendor-contact-person" className="text-xs font-medium text-on-surface">
                  Contact person
                </label>
                <Input
                  id="vendor-contact-person"
                  placeholder="e.g. Ramesh Kumar"
                  {...register('contactPerson')}
                />
              </div>

              {/* Email + Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="vendor-email" className="text-xs font-medium text-on-surface">
                    Contact email
                  </label>
                  <Input
                    id="vendor-email"
                    type="email"
                    inputMode="email"
                    aria-invalid={Boolean(errors.contactEmail)}
                    placeholder="procurement@vendor.in"
                    {...register('contactEmail')}
                  />
                  <FieldError message={errors.contactEmail?.message} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="vendor-phone" className="text-xs font-medium text-on-surface">
                    Contact phone
                  </label>
                  <Input
                    id="vendor-phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="+91 9876543210"
                    {...register('contactPhone')}
                  />
                </div>
              </div>

            </CardContent>
          </Card>

          {/* ── Section 2: Scope (§2.7) ─────────────────────────────────────── */}
          <Card className="p-0 mb-4">
            <div className="p-4 sm:p-6">
              <FormSectionHeader
                title="2 · Scope"
                subtitle="Vendor access tier. Widening is free; narrowing may be blocked by open purchase orders; lateral changes (same tier, different entity) are rejected."
              />
            </div>
            <SectionShift tone="low" aria-hidden />
            <CardContent className="p-4 sm:p-6">
              {isEditMode ? (
                <ScopePickerSection
                  currentScope={currentScope}
                  currentClusterId={currentClusterId}
                  currentLocationId={currentLocationId}
                  vendorId={id}
                  isEditMode={true}
                  onScopeUpdated={() => {
                    // Refetch vendor to get updated scope
                    void vendorQuery.refetch();
                  }}
                />
              ) : (
                // Create mode — scope is part of initial creation, not mutation
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2" role="radiogroup" aria-label="Vendor scope">
                    {SCOPE_OPTIONS.map((opt) => {
                      const isSelected = createScopeValue === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className={[
                            'flex items-start gap-3 rounded-md p-3 cursor-pointer',
                            'hover:bg-surface-container-low transition-colors',
                            'focus-within:ring-2 focus-within:ring-primary',
                            isSelected ? 'bg-surface-container' : 'bg-surface-container-lowest',
                          ].join(' ')}
                        >
                          <input
                            type="radio"
                            name="create-vendor-scope"
                            value={opt.value}
                            checked={isSelected}
                            onChange={() => {
                              setCreateScopeValue(opt.value);
                              if (opt.value !== 'cluster') setCreateClusterId('');
                              if (opt.value !== 'pos') setCreateLocationId('');
                            }}
                            className="mt-0.5 shrink-0 accent-primary"
                          />
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium text-on-surface">{opt.label}</span>
                            <span className="text-[11px] text-on-surface-variant">{opt.description}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {createScopeValue === 'cluster' ? (
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="create-scope-cluster" className="text-xs font-medium text-on-surface">
                        Cluster <span className="text-error ml-0.5" aria-hidden>*</span>
                      </label>
                      {clustersQuery.isLoading ? (
                        <div className="h-10 rounded-md bg-surface-container-high animate-pulse" />
                      ) : (
                        <select
                          id="create-scope-cluster"
                          aria-required="true"
                          value={createClusterId}
                          onChange={(e) => setCreateClusterId(e.target.value)}
                          className="h-10 w-full rounded-md px-3 text-sm text-on-surface bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <option value="">Select cluster…</option>
                          {clusters.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ) : null}

                  {createScopeValue === 'pos' ? (
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="create-scope-location" className="text-xs font-medium text-on-surface">
                        POS Location <span className="text-error ml-0.5" aria-hidden>*</span>
                      </label>
                      {locationsQuery.isLoading ? (
                        <div className="h-10 rounded-md bg-surface-container-high animate-pulse" />
                      ) : (
                        <select
                          id="create-scope-location"
                          aria-required="true"
                          value={createLocationId}
                          onChange={(e) => setCreateLocationId(e.target.value)}
                          className="h-10 w-full rounded-md px-3 text-sm text-on-surface bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          <option value="">Select location…</option>
                          {locations
                            .filter((l) => l.type === 'pos_outlet' || l.type === 'brand_store' || l.type === 'cluster_store')
                            .map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Section 3: Address ──────────────────────────────────────────── */}
          <Card className="p-0 mb-4">
            <div className="p-4 sm:p-6">
              <FormSectionHeader
                title="3 · Address"
                subtitle="Vendor's registered or primary address."
              />
            </div>
            <SectionShift tone="low" aria-hidden />
            <CardContent className="p-4 sm:p-6 flex flex-col gap-4">

              <div className="flex flex-col gap-1.5">
                <label htmlFor="vendor-street" className="text-xs font-medium text-on-surface">
                  Street / Address line 1
                </label>
                <Input
                  id="vendor-street"
                  placeholder="e.g. Plot 14, MIDC Industrial Estate"
                  {...register('street')}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="vendor-city" className="text-xs font-medium text-on-surface">
                    City
                  </label>
                  <Input id="vendor-city" placeholder="e.g. Mumbai" {...register('city')} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="vendor-state" className="text-xs font-medium text-on-surface">
                    State
                  </label>
                  <Input
                    id="vendor-state"
                    placeholder="e.g. Maharashtra"
                    {...register('state')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="vendor-pincode" className="text-xs font-medium text-on-surface">
                    Pincode
                  </label>
                  <Input
                    id="vendor-pincode"
                    inputMode="numeric"
                    placeholder="e.g. 400001"
                    {...register('postalCode')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="vendor-credit-terms" className="text-xs font-medium text-on-surface">
                    Credit terms (days)
                  </label>
                  <Input
                    id="vendor-credit-terms"
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 30"
                    aria-describedby="credit-terms-hint"
                    {...register('creditTermsDays')}
                  />
                  <p id="credit-terms-hint" className="text-[11px] text-on-surface-variant">
                    Payment due days after invoice. Leave blank if not applicable.
                  </p>
                  <FieldError message={errors.creditTermsDays?.message} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="vendor-payment-mode" className="text-xs font-medium text-on-surface">
                    Payment mode
                  </label>
                  <select
                    id="vendor-payment-mode"
                    className="h-10 w-full rounded-md px-3 text-sm text-on-surface bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    {...register('paymentMode')}
                  >
                    <option value="">Select payment mode…</option>
                    {PAYMENT_MODE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="vendor-quality-rating" className="text-xs font-medium text-on-surface">
                    Quality rating
                    <span className="ml-1 font-normal text-on-surface-variant">(1–5)</span>
                  </label>
                  <Input
                    id="vendor-quality-rating"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g. 4.50"
                    aria-describedby="quality-rating-hint"
                    {...register('qualityRating')}
                  />
                  <p id="quality-rating-hint" className="text-[11px] text-on-surface-variant">
                    Decimal between 1 and 5.
                  </p>
                  <FieldError message={errors.qualityRating?.message} />
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-md bg-surface-container-lowest p-3">
                <input
                  type="checkbox"
                  id="vendor-preferred"
                  className="accent-primary h-4 w-4"
                  {...register('preferred')}
                />
                <label htmlFor="vendor-preferred" className="flex flex-col gap-0.5 cursor-pointer">
                  <span className="text-sm font-medium text-on-surface">Preferred vendor</span>
                  <span className="text-[11px] text-on-surface-variant">
                    Mark as preferred to surface this vendor first in procurement dropdowns.
                  </span>
                </label>
              </div>

            </CardContent>
          </Card>

          {/* ── Section 4: Status ────────────────────────────────────────────── */}
          {isEditMode && vendor ? (
            <Card className="p-0 mb-6">
              <div className="p-4 sm:p-6">
                <FormSectionHeader
                  title="4 · Status"
                  subtitle="Deactivate this vendor to prevent use in new purchase orders."
                />
              </div>
              <SectionShift tone="low" aria-hidden />
              <CardContent className="p-4 sm:p-6 flex flex-col gap-4">

                <div className="flex items-center justify-between gap-4 rounded-md bg-surface-container-lowest p-3">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium text-on-surface">
                      Current status
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Deactivating removes this vendor from dropdowns and prevents new purchase orders.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusPill
                      status={isActive ? 'status_confirmed' : 'status_inactive'}
                      size="sm"
                      label={isActive ? 'Active' : 'Deactivated'}
                    />
                    {isActive ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-error"
                        onClick={() => setShowDeactivate(true)}
                      >
                        Deactivate
                      </Button>
                    ) : null}
                  </div>
                </div>

              </CardContent>
            </Card>
          ) : null}

          {/* ── Form actions ─────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/mdm/vendors')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              id="vendor-submit"
              disabled={isPending}
              aria-label={isPending ? 'Saving vendor…' : isEditMode ? 'Save changes' : 'Create vendor'}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />
                  Saving…
                </>
              ) : isEditMode ? (
                'Save changes'
              ) : (
                'Create vendor'
              )}
            </Button>
          </div>

        </form>

      </div>
    </div>
  );
}

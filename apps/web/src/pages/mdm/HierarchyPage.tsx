/**
 * HierarchyPage — SI-MDM-001 Organisational Hierarchy production page.
 *
 * Consuming real apps/api endpoints via TanStack Query hooks.
 * Mirrors the Arc (b) mockup chrome (mockups/src/screens/mdm/SI-MDM-001.tsx)
 * with live data, loading skeletons, error surfaces, and a11y.
 *
 * Source FRs:
 *   FR1 — organisation hierarchy CRUD (brand → cluster → location → department)
 *   FR2 — department type classification visible in the tree
 *
 * DL-022 surface (parent-lock at UI):
 *   Action menus list Rename / Edit address & contact / Add child / Deactivate ONLY.
 *   "Move to other cluster" / "Change parent" / drag-and-drop re-parenting are
 *   intentionally ABSENT. A DL-022 helper-text strip below the tree surfaces the
 *   constraint for operators and future engineers alike.
 *
 * Dialog architecture:
 *   A single top-level inline dialog panel (NOT embedded inside the tree loop)
 *   is conditionally rendered below the page header. This prevents DOM detachment
 *   issues that occur when forms mount inside re-rendering tree rows. The action
 *   menus set a `dialog` state object; the top-level panel responds.
 *
 * Token discipline:
 *   No hex literals. status_confirmed = Active; status_inactive = Deactivated.
 *   No <Separator> — <SectionShift> used for tonal breaks.
 *   border-l-4 pip pattern is allowlisted per §5.2.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Info,
  Layers,
  MapPin,
  MoreHorizontal,
  Plus,
  Workflow,
} from 'lucide-react';

import {
  AuditLink,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DraftPill,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionShift,
  StatusPill,
} from '@/components/shell';

import { useSession } from '@/lib/auth';
import { ApiError } from '@/lib/api-client';

import { useClustersList, useCreateCluster, useUpdateCluster, useDeactivateCluster } from '@/hooks/mdm/useClusters';
import { useLocationsList, useCreateLocation, useUpdateLocation, useDeactivateLocation } from '@/hooks/mdm/useLocations';
import { useDepartmentsList, useCreateDepartment, useUpdateDepartment, useDeactivateDepartment } from '@/hooks/mdm/useDepartments';
import type { ClusterRow, LocationRow, LocationType, DepartmentRow, DepartmentType } from '@/hooks/mdm/schemas';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LOCATION_TYPE_LABEL: Record<LocationType, string> = {
  central_kitchen: 'Central Kitchen',
  pos_outlet: 'POS Outlet',
  brand_store: 'Brand Store',
  cluster_store: 'Cluster Store',
};

const DEPT_TYPE_LABEL: Record<DepartmentType, string> = {
  production: 'Production',
  non_production: 'Non-Production',
  dispatch: 'Dispatch',
  store: 'Store',
};

// ---------------------------------------------------------------------------
// Skeleton helpers
// ---------------------------------------------------------------------------

function TreeSkeleton() {
  return (
    <div className="flex flex-col gap-0.5 py-2 min-w-[640px]" role="status" aria-label="Loading hierarchy…">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2 px-4 py-2 min-h-[44px]">
            <div className="h-5 w-5 rounded bg-surface-container-high animate-pulse" />
            <div className="h-4 w-40 rounded bg-surface-container-high animate-pulse" />
            <div className="h-5 w-16 rounded-pill bg-surface-container-high animate-pulse" />
          </div>
          {[1, 2].map((j) => (
            <div key={j} className="flex items-center gap-2 px-4 pl-8 py-2 min-h-[44px]">
              <div className="h-5 w-5 rounded bg-surface-container-high animate-pulse" />
              <div className="h-4 w-32 rounded bg-surface-container-high animate-pulse" />
              <div className="h-5 w-20 rounded-pill bg-surface-container-high animate-pulse" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error banner
// ---------------------------------------------------------------------------

interface ErrorBannerProps {
  error: Error;
  onRetry?: () => void;
}

function ErrorBanner({ error, onRetry }: ErrorBannerProps) {
  const isApi = error instanceof ApiError;
  const code = isApi ? error.code : 'unknown';
  const isServerError = isApi && (error.httpStatus ?? 0) >= 500;

  if (isServerError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-sm text-on-surface-variant">
          Server error ({code}): {error.message}
        </p>
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-3 rounded-sm bg-surface-container-low flex items-start gap-2">
      <Info className="h-4 w-4 mt-0.5 shrink-0 text-on-surface-variant" aria-hidden />
      <p className="text-sm text-on-surface-variant">
        {error.message}
        {code !== 'unknown' && <span className="ml-1 text-xs opacity-70">({code})</span>}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status pills
// ---------------------------------------------------------------------------

function ActiveStatusPill({ active }: { active: boolean }) {
  return active ? (
    <StatusPill status="status_confirmed" size="sm" label="Active" />
  ) : (
    <StatusPill status="status_inactive" size="sm" label="Deactivated" />
  );
}

interface TypePillProps {
  label: string;
  tone?: 'plain' | 'tonal';
}

function TypePill({ label, tone = 'plain' }: TypePillProps) {
  const cls =
    tone === 'tonal'
      ? 'bg-secondary-container text-on-secondary-container'
      : 'bg-surface-container-high text-on-surface-variant';
  return (
    <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Action menu (DL-022: NO move/re-parent affordance)
// ---------------------------------------------------------------------------

interface NodeActionMenuProps {
  nodeKind: 'cluster' | 'location' | 'department';
  nodeName: string;
  active: boolean;
  onRename: () => void;
  onEditContact?: () => void;
  onAddChild?: () => void;
  addChildLabel?: string;
  onDeactivate?: () => void;
}

/**
 * Per-node action menu.
 *
 * DL-022 surface: this list intentionally NEVER includes "Move to other cluster",
 * "Change parent", or any re-parenting affordance. The constraint note at the
 * bottom of the popover makes the omission explicit.
 */
function NodeActionMenu({
  nodeKind,
  nodeName,
  active,
  onRename,
  onEditContact,
  onAddChild,
  addChildLabel,
  onDeactivate,
}: NodeActionMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label={`Actions for ${nodeName}`}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1">
        <ul className="flex flex-col" role="menu">
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => { onRename(); setOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-sm text-sm text-on-surface min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Rename
            </button>
          </li>
          {onEditContact && (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => { onEditContact(); setOpen(false); }}
                className="w-full text-left px-3 py-2 rounded-sm text-sm text-on-surface min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Edit address &amp; contact
              </button>
            </li>
          )}
          {onAddChild && addChildLabel && (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => { onAddChild(); setOpen(false); }}
                className="w-full text-left px-3 py-2 rounded-sm text-sm text-on-surface min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {addChildLabel}
              </button>
            </li>
          )}
          {onDeactivate && (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => { onDeactivate(); setOpen(false); }}
                disabled={!active}
                className="w-full text-left px-3 py-2 rounded-sm text-sm text-error min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:pointer-events-none"
              >
                Deactivate {nodeKind}
              </button>
            </li>
          )}
        </ul>
        {/* DL-022 note: parent reassignment omitted deliberately */}
        <div className="px-3 py-2 bg-surface-container-low rounded-sm mt-1">
          <p className="text-[10px] text-on-surface-variant leading-snug">
            Per DL-022, parent reassignment is not available. Restructure by
            deactivating then recreating under the new parent.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Dialog state type
// ---------------------------------------------------------------------------

type DialogState =
  | null
  | { kind: 'create-cluster' }
  | { kind: 'rename-cluster'; cluster: ClusterRow }
  | { kind: 'deactivate-cluster'; cluster: ClusterRow }
  | { kind: 'create-location'; clusterId: string }
  | { kind: 'rename-location'; location: LocationRow }
  | { kind: 'deactivate-location'; location: LocationRow }
  | { kind: 'create-department'; locationId: string }
  | { kind: 'rename-department'; department: DepartmentRow }
  | { kind: 'deactivate-department'; department: DepartmentRow };

// ---------------------------------------------------------------------------
// Dialog panel — top-level, outside the tree loop (stable against re-renders)
// ---------------------------------------------------------------------------

interface DialogPanelProps {
  dialog: DialogState;
  onClose: () => void;
}

function DialogPanel({ dialog, onClose }: DialogPanelProps) {
  if (!dialog) return null;

  return (
    <div
      className="mt-4 rounded-sm bg-surface-container-lowest shadow-lg max-w-sm"
      role="dialog"
      aria-modal="false"
    >
      <DialogPanelContent dialog={dialog} onClose={onClose} />
    </div>
  );
}

interface DialogPanelContentProps {
  dialog: NonNullable<DialogState>;
  onClose: () => void;
}

function DialogPanelContent({ dialog, onClose }: DialogPanelContentProps) {
  switch (dialog.kind) {
    case 'create-cluster':
      return <CreateClusterForm onClose={onClose} />;
    case 'rename-cluster':
      return <RenameClusterForm cluster={dialog.cluster} onClose={onClose} />;
    case 'deactivate-cluster':
      return <DeactivateClusterForm cluster={dialog.cluster} onClose={onClose} />;
    case 'create-location':
      return <CreateLocationForm clusterId={dialog.clusterId} onClose={onClose} />;
    case 'rename-location':
      return <RenameLocationForm location={dialog.location} onClose={onClose} />;
    case 'deactivate-location':
      return <DeactivateLocationForm location={dialog.location} onClose={onClose} />;
    case 'create-department':
      return <CreateDepartmentForm locationId={dialog.locationId} onClose={onClose} />;
    case 'rename-department':
      return <RenameDepartmentForm department={dialog.department} onClose={onClose} />;
    case 'deactivate-department':
      return <DeactivateDepartmentForm department={dialog.department} onClose={onClose} />;
  }
}

// ---------------------------------------------------------------------------
// Create / rename / contact forms
// ---------------------------------------------------------------------------

interface CreateClusterFormProps {
  onClose: () => void;
}

function CreateClusterForm({ onClose }: CreateClusterFormProps) {
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [address, setAddress] = useState('');
  const createCluster = useCreateCluster();
  const isDirty = name.trim().length > 0;

  async function handleSubmit() {
    if (!isDirty) return;
    await createCluster.mutateAsync({
      name: name.trim(),
      contactPerson: contactPerson.trim() || undefined,
      address: address.trim() || undefined,
    });
    onClose();
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          New cluster
        </p>
        <DraftPill isDraft={isDirty} />
      </div>
      {createCluster.error && (
        <p className="text-xs text-error">{createCluster.error.message}</p>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cluster-name" className="text-xs font-medium text-on-surface">
          Cluster name
          <span className="text-error ml-0.5" aria-hidden>*</span>
        </label>
        <Input
          id="cluster-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Lower Parel Cluster"
          aria-required="true"
        />
        {/* DL-022: Cluster cannot be reassigned after creation */}
        <p className="text-[10px] text-on-surface-variant leading-snug">
          Cluster cannot be reassigned after creation. Deactivate and create a new one if reorganisation is needed.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cluster-contact" className="text-xs font-medium text-on-surface">
          Contact person
        </label>
        <Input
          id="cluster-contact"
          value={contactPerson}
          onChange={(e) => setContactPerson(e.target.value)}
          placeholder="Cluster contact name"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cluster-address" className="text-xs font-medium text-on-surface">
          Address
        </label>
        <Input
          id="cluster-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Operational hub for this cluster"
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={createCluster.isPending}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => { void handleSubmit(); }}
          disabled={!isDirty || createCluster.isPending}
        >
          {createCluster.isPending ? 'Creating…' : 'Create cluster'}
        </Button>
      </div>
    </div>
  );
}

interface CreateLocationFormProps {
  clusterId: string;
  onClose: () => void;
}

function CreateLocationForm({ clusterId, onClose }: CreateLocationFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<LocationType>('pos_outlet');
  const [address, setAddress] = useState('');
  const createLocation = useCreateLocation();
  const isDirty = name.trim().length > 0;

  async function handleSubmit() {
    if (!isDirty) return;
    await createLocation.mutateAsync({
      clusterId,
      name: name.trim(),
      type,
      address: address.trim() || undefined,
    });
    onClose();
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          New location
        </p>
        <DraftPill isDraft={isDirty} />
      </div>
      {createLocation.error && (
        <p className="text-xs text-error">{createLocation.error.message}</p>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="location-name" className="text-xs font-medium text-on-surface">
          Location name
          <span className="text-error ml-0.5" aria-hidden>*</span>
        </label>
        <Input
          id="location-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Bandra West Outlet"
          aria-required="true"
        />
        {/* DL-022: cluster is locked */}
        <p className="text-[10px] text-on-surface-variant leading-snug">
          Location cannot be reassigned to another cluster after creation.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="location-type" className="text-xs font-medium text-on-surface">
          Type
          <span className="text-error ml-0.5" aria-hidden>*</span>
        </label>
        <select
          id="location-type"
          value={type}
          onChange={(e) => setType(e.target.value as LocationType)}
          className="rounded-sm bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {Object.entries(LOCATION_TYPE_LABEL).map(([val, lbl]) => (
            <option key={val} value={val}>{lbl}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="location-address" className="text-xs font-medium text-on-surface">
          Address
        </label>
        <Input
          id="location-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Street address"
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={createLocation.isPending}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => { void handleSubmit(); }}
          disabled={!isDirty || createLocation.isPending}
        >
          {createLocation.isPending ? 'Creating…' : 'Create location'}
        </Button>
      </div>
    </div>
  );
}

interface CreateDepartmentFormProps {
  locationId: string;
  onClose: () => void;
}

function CreateDepartmentForm({ locationId, onClose }: CreateDepartmentFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<DepartmentType>('non_production');
  const createDepartment = useCreateDepartment();
  const isDirty = name.trim().length > 0;

  async function handleSubmit() {
    if (!isDirty) return;
    await createDepartment.mutateAsync({ locationId, name: name.trim(), type });
    onClose();
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          New department
        </p>
        <DraftPill isDraft={isDirty} />
      </div>
      {createDepartment.error && (
        <p className="text-xs text-error">{createDepartment.error.message}</p>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="dept-name" className="text-xs font-medium text-on-surface">
          Department name
          <span className="text-error ml-0.5" aria-hidden>*</span>
        </label>
        <Input
          id="dept-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Production Kitchen"
          aria-required="true"
        />
        {/* DL-022: location is locked */}
        <p className="text-[10px] text-on-surface-variant leading-snug">
          Department cannot be reassigned to another location after creation.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="dept-type" className="text-xs font-medium text-on-surface">
          Type
          <span className="text-error ml-0.5" aria-hidden>*</span>
        </label>
        <select
          id="dept-type"
          value={type}
          onChange={(e) => setType(e.target.value as DepartmentType)}
          className="rounded-sm bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {Object.entries(DEPT_TYPE_LABEL).map(([val, lbl]) => (
            <option key={val} value={val}>{lbl}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={createDepartment.isPending}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => { void handleSubmit(); }}
          disabled={!isDirty || createDepartment.isPending}
        >
          {createDepartment.isPending ? 'Creating…' : 'Create department'}
        </Button>
      </div>
    </div>
  );
}

interface RenameClusterFormProps {
  cluster: ClusterRow;
  onClose: () => void;
}

function RenameClusterForm({ cluster, onClose }: RenameClusterFormProps) {
  const [name, setName] = useState(cluster.name);
  const updateCluster = useUpdateCluster();
  const isDirty = name.trim() !== cluster.name.trim() && name.trim().length > 0;

  async function handleSubmit() {
    if (!isDirty) return;
    await updateCluster.mutateAsync({ id: cluster.id, name: name.trim(), reason: 'Rename via UI' });
    onClose();
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Rename cluster
        </p>
        <DraftPill isDraft={isDirty} />
      </div>
      {updateCluster.error && (
        <p className="text-xs text-error">{updateCluster.error.message}</p>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="rename-cluster" className="text-xs font-medium text-on-surface">
          Name
          <span className="text-error ml-0.5" aria-hidden>*</span>
        </label>
        <Input
          id="rename-cluster"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={updateCluster.isPending}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => { void handleSubmit(); }}
          disabled={!isDirty || updateCluster.isPending}
        >
          {updateCluster.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

interface RenameLocationFormProps {
  location: LocationRow;
  onClose: () => void;
}

function RenameLocationForm({ location, onClose }: RenameLocationFormProps) {
  const [name, setName] = useState(location.name);
  const updateLocation = useUpdateLocation();
  const isDirty = name.trim() !== location.name.trim() && name.trim().length > 0;

  async function handleSubmit() {
    if (!isDirty) return;
    await updateLocation.mutateAsync({ id: location.id, name: name.trim(), reason: 'Rename via UI' });
    onClose();
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Rename location
        </p>
        <DraftPill isDraft={isDirty} />
      </div>
      {updateLocation.error && (
        <p className="text-xs text-error">{updateLocation.error.message}</p>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="rename-location" className="text-xs font-medium text-on-surface">
          Name
          <span className="text-error ml-0.5" aria-hidden>*</span>
        </label>
        <Input
          id="rename-location"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={updateLocation.isPending}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => { void handleSubmit(); }}
          disabled={!isDirty || updateLocation.isPending}
        >
          {updateLocation.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

interface RenameDepartmentFormProps {
  department: DepartmentRow;
  onClose: () => void;
}

function RenameDepartmentForm({ department, onClose }: RenameDepartmentFormProps) {
  const [name, setName] = useState(department.name);
  const updateDepartment = useUpdateDepartment();
  const isDirty = name.trim() !== department.name.trim() && name.trim().length > 0;

  async function handleSubmit() {
    if (!isDirty) return;
    await updateDepartment.mutateAsync({ id: department.id, name: name.trim(), reason: 'Rename via UI' });
    onClose();
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
          Rename department
        </p>
        <DraftPill isDraft={isDirty} />
      </div>
      {updateDepartment.error && (
        <p className="text-xs text-error">{updateDepartment.error.message}</p>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="rename-dept" className="text-xs font-medium text-on-surface">
          Name
          <span className="text-error ml-0.5" aria-hidden>*</span>
        </label>
        <Input
          id="rename-dept"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={updateDepartment.isPending}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => { void handleSubmit(); }}
          disabled={!isDirty || updateDepartment.isPending}
        >
          {updateDepartment.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deactivate confirm forms
// ---------------------------------------------------------------------------

interface DeactivateClusterFormProps {
  cluster: ClusterRow;
  onClose: () => void;
}

function DeactivateClusterForm({ cluster, onClose }: DeactivateClusterFormProps) {
  const deactivate = useDeactivateCluster();

  async function handleConfirm() {
    await deactivate.mutateAsync({ id: cluster.id, reason: 'Deactivated via UI' });
    onClose();
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
        Deactivate cluster
      </p>
      <p className="text-sm text-on-surface">
        Deactivate <span className="font-semibold">{cluster.name}</span>? This will also deactivate all child locations and departments.
      </p>
      {deactivate.error && (
        <p className="text-xs text-error">{deactivate.error.message}</p>
      )}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={deactivate.isPending}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => { void handleConfirm(); }}
          disabled={deactivate.isPending}
        >
          {deactivate.isPending ? 'Deactivating…' : 'Deactivate'}
        </Button>
      </div>
    </div>
  );
}

interface DeactivateLocationFormProps {
  location: LocationRow;
  onClose: () => void;
}

function DeactivateLocationForm({ location, onClose }: DeactivateLocationFormProps) {
  const deactivate = useDeactivateLocation();

  async function handleConfirm() {
    await deactivate.mutateAsync({ id: location.id, reason: 'Deactivated via UI' });
    onClose();
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
        Deactivate location
      </p>
      <p className="text-sm text-on-surface">
        Deactivate <span className="font-semibold">{location.name}</span>?
      </p>
      {deactivate.error && (
        <p className="text-xs text-error">{deactivate.error.message}</p>
      )}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={deactivate.isPending}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => { void handleConfirm(); }}
          disabled={deactivate.isPending}
        >
          {deactivate.isPending ? 'Deactivating…' : 'Deactivate'}
        </Button>
      </div>
    </div>
  );
}

interface DeactivateDepartmentFormProps {
  department: DepartmentRow;
  onClose: () => void;
}

function DeactivateDepartmentForm({ department, onClose }: DeactivateDepartmentFormProps) {
  const deactivate = useDeactivateDepartment();

  async function handleConfirm() {
    await deactivate.mutateAsync({ id: department.id, reason: 'Deactivated via UI' });
    onClose();
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
        Deactivate department
      </p>
      <p className="text-sm text-on-surface">
        Deactivate <span className="font-semibold">{department.name}</span>?
      </p>
      {deactivate.error && (
        <p className="text-xs text-error">{deactivate.error.message}</p>
      )}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={deactivate.isPending}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => { void handleConfirm(); }}
          disabled={deactivate.isPending}
        >
          {deactivate.isPending ? 'Deactivating…' : 'Deactivate'}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HierarchyPage (main export)
// ---------------------------------------------------------------------------

export default function HierarchyPage() {
  const { session } = useSession();
  const brandId = session?.user.brandId ?? '';

  // Fetch all three resource lists
  const clustersQuery = useClustersList();
  const locationsQuery = useLocationsList();
  const departmentsQuery = useDepartmentsList();

  // Expansion state — start collapsed for production page
  const [expandedClusters, setExpandedClusters] = useState<Set<string>>(new Set());
  const [expandedLocations, setExpandedLocations] = useState<Set<string>>(new Set());

  // Top-level dialog state machine (one dialog at a time)
  // The dialog panel renders OUTSIDE the tree loop for DOM stability.
  const [dialog, setDialog] = useState<DialogState>(null);

  // Schema footer state
  const [schemaOpen, setSchemaOpen] = useState(false);

  // "New cluster" header popover — separate from the node-action dialog state
  const [newClusterOpen, setNewClusterOpen] = useState(false);

  const clusters = clustersQuery.data ?? [];
  const locations = locationsQuery.data ?? [];
  const departments = departmentsQuery.data ?? [];

  const isLoading = clustersQuery.isLoading || locationsQuery.isLoading || departmentsQuery.isLoading;
  const loadError = clustersQuery.error ?? locationsQuery.error ?? departmentsQuery.error;

  const toggleCluster = useCallback((id: string) => {
    setExpandedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleLocation = useCallback((id: string) => {
    setExpandedLocations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Stats
  const stats = useMemo(() => ({
    clusterCount: clusters.length,
    locationCount: locations.length,
    departmentCount: departments.length,
  }), [clusters, locations, departments]);

  const closeDialog = useCallback(() => setDialog(null), []);

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1280px] px-4 py-6 tablet:px-6 tablet:py-8 desktop:px-10 desktop:py-10">

        {/* Page header */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Master data · Organisation
            </p>
            <h1 className="mt-1 text-2xl tablet:text-[2rem] leading-tight font-bold tracking-tight text-on-surface">
              Organisational hierarchy
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              Maintain your brand's structure from brand down to department.
              Expand a cluster or location to view its children. Edit
              affordances are scoped to the focused node — parent
              reassignment is not supported in MVP per DL-022.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AuditLink entityRef={brandId || 'brand'} compact />
            <Popover open={newClusterOpen} onOpenChange={setNewClusterOpen}>
              <PopoverTrigger asChild>
                <Button aria-label="Create new cluster">
                  <Plus className="h-4 w-4" aria-hidden />
                  New cluster
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                {newClusterOpen && (
                  <CreateClusterForm onClose={() => setNewClusterOpen(false)} />
                )}
              </PopoverContent>
            </Popover>
          </div>
        </header>

        {/* Stats bar */}
        <div className="mt-4 rounded-sm bg-surface-container-low px-3 py-2">
          <p className="text-xs text-on-surface-variant">
            {stats.clusterCount} {stats.clusterCount === 1 ? 'cluster' : 'clusters'} ·{' '}
            {stats.locationCount} {stats.locationCount === 1 ? 'location' : 'locations'} ·{' '}
            {stats.departmentCount} {stats.departmentCount === 1 ? 'department' : 'departments'}
          </p>
        </div>

        {/* Top-level dialog panel — rendered outside the tree for DOM stability */}
        {dialog && (
          <DialogPanel dialog={dialog} onClose={closeDialog} />
        )}

        {/* Error banner */}
        {loadError && (
          <div className="mt-4">
            <ErrorBanner
              error={loadError}
              onRetry={() => {
                void clustersQuery.refetch();
                void locationsQuery.refetch();
                void departmentsQuery.refetch();
              }}
            />
          </div>
        )}

        {/* Tree card */}
        <Card className="mt-6 p-0">
          <CardHeader className="p-4 tablet:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg tablet:text-xl text-on-surface">
                  Hierarchy tree
                </CardTitle>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Brand → Cluster → Location → Department
                </p>
              </div>
              <ActiveStatusPill active />
            </div>
          </CardHeader>

          <SectionShift tone="low" aria-hidden />

          <div className="overflow-x-auto">
            {isLoading ? (
              <TreeSkeleton />
            ) : (
              <ul
                role="tree"
                aria-label="Organisational hierarchy"
                className="flex flex-col py-2 min-w-[640px]"
              >
                {clusters.length === 0 ? (
                  <li className="px-4 py-6 text-sm text-on-surface-variant">
                    No clusters yet. Add your first cluster using the button above.
                  </li>
                ) : (
                  clusters.map((cluster) => {
                    const clusterExpanded = expandedClusters.has(cluster.id);
                    const clusterLocations = locations.filter((l) => l.clusterId === cluster.id);
                    const clusterDeptCount = departments.filter((d) =>
                      clusterLocations.some((l) => l.id === d.locationId)
                    ).length;

                    return (
                      <li
                        key={cluster.id}
                        role="treeitem"
                        aria-level={2}
                        aria-expanded={clusterExpanded}
                      >
                        <div className="flex items-center gap-2 px-4 py-2 min-h-[44px] hover:bg-surface-container-low">
                          <button
                            type="button"
                            onClick={() => toggleCluster(cluster.id)}
                            aria-label={clusterExpanded ? `Collapse ${cluster.name}` : `Expand ${cluster.name}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-sm hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            {clusterExpanded ? (
                              <ChevronDown className="h-4 w-4 text-on-surface-variant" aria-hidden />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-on-surface-variant" aria-hidden />
                            )}
                          </button>
                          <Layers className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
                          <span className="font-medium text-on-surface">{cluster.name}</span>
                          <TypePill label="Cluster" />
                          <ActiveStatusPill active={cluster.active} />
                          <span className="text-[11px] text-on-surface-variant tabular-nums">
                            ({clusterLocations.length} {clusterLocations.length === 1 ? 'location' : 'locations'} · {clusterDeptCount} {clusterDeptCount === 1 ? 'department' : 'departments'})
                          </span>
                          <NodeActionMenu
                            nodeKind="cluster"
                            nodeName={cluster.name}
                            active={cluster.active}
                            onRename={() => setDialog({ kind: 'rename-cluster', cluster })}
                            onEditContact={() => setDialog({ kind: 'rename-cluster', cluster })}
                            onAddChild={() => setDialog({ kind: 'create-location', clusterId: cluster.id })}
                            addChildLabel="Add location"
                            onDeactivate={() => setDialog({ kind: 'deactivate-cluster', cluster })}
                          />
                        </div>

                        {/* Child locations */}
                        {clusterExpanded && (
                          <ul role="group" className="flex flex-col">
                            {clusterLocations.length === 0 ? (
                              <li className="pl-12 tablet:pl-20 py-2 text-xs text-on-surface-variant">
                                No locations in this cluster yet.
                              </li>
                            ) : (
                              clusterLocations.map((location) => {
                                const locExpanded = expandedLocations.has(location.id);
                                const locDepts = departments.filter((d) => d.locationId === location.id);

                                return (
                                  <li
                                    key={location.id}
                                    role="treeitem"
                                    aria-level={3}
                                    aria-expanded={locExpanded}
                                  >
                                    <div className="flex items-center gap-2 px-4 pl-8 py-2 min-h-[44px] tablet:pl-16 hover:bg-surface-container-low">
                                      <button
                                        type="button"
                                        onClick={() => toggleLocation(location.id)}
                                        aria-label={locExpanded ? `Collapse ${location.name}` : `Expand ${location.name}`}
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-sm hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                      >
                                        {locExpanded ? (
                                          <ChevronDown className="h-4 w-4 text-on-surface-variant" aria-hidden />
                                        ) : (
                                          <ChevronRight className="h-4 w-4 text-on-surface-variant" aria-hidden />
                                        )}
                                      </button>
                                      <MapPin className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
                                      <span className="font-medium text-on-surface">{location.name}</span>
                                      <TypePill label={LOCATION_TYPE_LABEL[location.type]} />
                                      <ActiveStatusPill active={location.active} />
                                      <span className="text-[11px] text-on-surface-variant tabular-nums">
                                        ({locDepts.length} {locDepts.length === 1 ? 'department' : 'departments'})
                                      </span>
                                      <NodeActionMenu
                                        nodeKind="location"
                                        nodeName={location.name}
                                        active={location.active}
                                        onRename={() => setDialog({ kind: 'rename-location', location })}
                                        onEditContact={() => setDialog({ kind: 'rename-location', location })}
                                        onAddChild={() => setDialog({ kind: 'create-department', locationId: location.id })}
                                        addChildLabel="Add department"
                                        onDeactivate={() => setDialog({ kind: 'deactivate-location', location })}
                                      />
                                    </div>

                                    {/* Child departments */}
                                    {locExpanded && (
                                      <ul role="group" className="flex flex-col">
                                        {locDepts.length === 0 ? (
                                          <li className="pl-12 tablet:pl-24 py-2 text-xs text-on-surface-variant">
                                            No departments at this location.
                                          </li>
                                        ) : (
                                          locDepts.map((dept) => (
                                            <li
                                              key={dept.id}
                                              role="treeitem"
                                              aria-level={4}
                                            >
                                              <div className="flex items-center gap-2 px-4 pl-12 py-2 min-h-[44px] tablet:pl-24 hover:bg-surface-container-low">
                                                <Workflow className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
                                                <span className={dept.active ? 'font-medium text-on-surface' : 'font-medium text-on-surface-variant line-through'}>
                                                  {dept.name}
                                                </span>
                                                <TypePill
                                                  label={DEPT_TYPE_LABEL[dept.type]}
                                                  tone={dept.type === 'production' || dept.type === 'dispatch' ? 'tonal' : 'plain'}
                                                />
                                                <ActiveStatusPill active={dept.active} />
                                                <NodeActionMenu
                                                  nodeKind="department"
                                                  nodeName={dept.name}
                                                  active={dept.active}
                                                  onRename={() => setDialog({ kind: 'rename-department', department: dept })}
                                                  onDeactivate={() => setDialog({ kind: 'deactivate-department', department: dept })}
                                                />
                                              </div>
                                            </li>
                                          ))
                                        )}
                                      </ul>
                                    )}
                                  </li>
                                );
                              })
                            )}
                          </ul>
                        )}
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>
        </Card>

        {/* DL-022 helper-text strip — surfaces the constraint deliberately */}
        <div className="mt-4 flex items-start gap-2 px-3 py-2 rounded-sm bg-surface-container-low">
          <Info className="h-3.5 w-3.5 mt-0.5 text-on-surface-variant shrink-0" aria-hidden />
          <p className="text-xs text-on-surface-variant">
            Restructuring requires deactivate + recreate. Locations and
            departments cannot be moved between parents in MVP (DL-022 — no
            re-parenting).
          </p>
        </div>

        <SectionShift tone="lowest" className="mt-8" aria-hidden />

        {/* Inventory schema footer panel — 12 canonical fields */}
        <Card className="mt-8 p-0">
          <button
            type="button"
            onClick={() => setSchemaOpen((o) => !o)}
            aria-expanded={schemaOpen}
            aria-controls="inventory-schema-panel"
            className="flex w-full items-center justify-between gap-2 p-4 tablet:p-6 text-left min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          >
            <div>
              <CardTitle className="text-base text-on-surface">
                Inventory schema
              </CardTitle>
              <p className="mt-1 text-xs text-on-surface-variant">
                The 12 canonical schema fields for SI-MDM-001 per _planning/05-screen-inventory.md (Tier 2 acceptance, DL-025).
              </p>
            </div>
            {schemaOpen ? (
              <ChevronDown className="h-5 w-5 text-on-surface-variant shrink-0" aria-hidden />
            ) : (
              <ChevronRight className="h-5 w-5 text-on-surface-variant shrink-0" aria-hidden />
            )}
          </button>
          {schemaOpen && (
            <>
              <SectionShift tone="low" aria-hidden />
              <CardContent id="inventory-schema-panel" className="p-4 tablet:p-6">
                <dl className="grid grid-cols-1 tablet:grid-cols-2 gap-x-6 gap-y-4">
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">1 · Primary epic</dt>
                    <dd className="mt-1 text-sm text-on-surface">Epic 1 — Master Data Management</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">2 · Primary device</dt>
                    <dd className="mt-1 text-sm text-on-surface">desktop-primary</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">3 · Roles &amp; scope</dt>
                    <dd className="mt-1 text-sm text-on-surface">Brand Owner (scope: brand)</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">4 · Purpose</dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Maintain the brand's organisational hierarchy from brand down to department using a visual tree.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">5 · Data displayed</dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Brand name + ID; clusters (name, location count, active status); locations per cluster
                      (name, type, active status, department count); departments per location (name, type, active status).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">6 · User actions</dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Expand / collapse; create cluster; edit cluster (name, address, contact); deactivate cluster;
                      create location; edit / deactivate location; create department; edit / deactivate department.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">7 · Cross-cutting</dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      CC-AUDIT-LINK (header strip); CC-DRAFT-PILL (on each create / edit dialog before confirm).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">8 · Tokens (DESIGN.md)</dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      surface, surface_container_lowest, on_surface, on_surface_variant, primary, outline_variant.
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">9 · Source FRs</dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      FR1 (organisation hierarchy CRUD); FR2 (department type classification visible in tree).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">10 · Source journey(s)</dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Brand Owner — initial brand &amp; cluster setup (one-time + occasional restructuring; admin / setup surface).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">11 · Related screens</dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      drill-down: SI-MDM-004 (material enablement matrix per location); sibling: SI-MDM-002 (department register).
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">12 · Notes</dt>
                    <dd className="mt-1 text-sm text-on-surface">
                      Tree view with collapsible nodes; each node carries status pill. Edit affordances are in-place popovers.
                      Soft-delete (deactivation) prevents deletion with active stock or linked operational records.
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </>
          )}
        </Card>

        <SectionShift tone="high" className="mt-10" aria-hidden />
        <footer className="pt-4 text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
          <Workflow className="h-3 w-3" aria-hidden />
          <span>
            Production page · DL-022 surfaced (no re-parenting).
          </span>
          <span className="ml-auto">
            SI-MDM-001 · Phase 4 Epic 1 Arc (c)
          </span>
        </footer>
      </div>
    </div>
  );
}

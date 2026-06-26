/**
 * CategoriesPage — SI-MDM-006 Category & Sub-Category Management.
 *
 * Tier 2 acceptance applies (lighter chrome bar than Tier 1 hero screens).
 *
 * Source FRs:
 *   FR7 — two-level category hierarchy (Category → Sub-Category).
 *          Sub-categories cannot have sub-sub-categories (depth = 2).
 *          M:N product–category mapping is managed from SI-MDM-003 (ProductsForm).
 *
 * DL-025: SI-MDM-006 was an Index-only stub in Arc (b). This is the first
 *          interactive production page for categories (Task C8).
 *
 * Soft-delete: deactivating a category sets active=false; product_categories
 *   rows are preserved (service contract). Deactivated categories are shown
 *   with status_inactive pill and struck-through name.
 *
 * Token discipline:
 *   No hex literals. No <Separator>. No banned border classes.
 *   status_confirmed = Active; status_inactive = Deactivated.
 *   border-l-4 pip allowlisted per §5.2.
 */

import { useState, useMemo, useCallback, useId, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FolderTree,
  Loader2,
  MoreHorizontal,
  Plus,
  Tag,
} from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

import {
  AuditLink,
  Button,
  Card,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SectionShift,
  StatusPill,
} from '@/components/shell';

import { ApiError } from '@/lib/api-client';
import RequirePermission from '@/lib/RequirePermission';
import { CCDuplicateWarn } from '@/components/shell/CCDuplicateWarn';
import {
  useCategoriesList,
  useCreateCategory,
  useUpdateCategory,
  useDeactivateCategory,
  useFindSimilarCategories,
} from '@/hooks/mdm/useCategories';
import type { CategoryRow } from '@/hooks/mdm/schemas';

// ---------------------------------------------------------------------------
// Debounce hook (internal — mirrors ProductsForm/VendorsForm pattern)
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
// Types
// ---------------------------------------------------------------------------

interface TreeNode {
  readonly category: CategoryRow;
  readonly children: ReadonlyArray<CategoryRow>;
}

// ---------------------------------------------------------------------------
// Dialog state
// ---------------------------------------------------------------------------

type DialogMode =
  | { type: 'create-top' }
  | { type: 'create-sub'; parentId: string; parentName: string }
  | { type: 'edit'; category: CategoryRow };

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface CategoryFormValues {
  name: string;
  description: string;
  active: boolean;
  reason: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActiveStatusPill({ active }: { readonly active: boolean }) {
  return active ? (
    <StatusPill status="status_confirmed" size="sm" label="Active" />
  ) : (
    <StatusPill status="status_inactive" size="sm" label="Deactivated" />
  );
}

function TreeSkeleton() {
  return (
    <div role="status" aria-label="Loading categories…" className="flex flex-col gap-2 p-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 py-2">
            <div className="h-4 w-4 rounded bg-surface-container-high animate-pulse shrink-0" />
            <div className="h-4 w-40 rounded bg-surface-container-high animate-pulse" />
            <div className="h-5 w-16 rounded-pill bg-surface-container-high animate-pulse ml-auto" />
          </div>
          <div className="ml-6 flex items-center gap-2 py-2">
            <div className="h-3 w-3 rounded bg-surface-container-high animate-pulse shrink-0" />
            <div className="h-3 w-28 rounded bg-surface-container-high animate-pulse" />
            <div className="h-4 w-14 rounded-pill bg-surface-container-high animate-pulse ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface RowActionMenuProps {
  readonly category: CategoryRow;
  readonly isTopLevel: boolean;
  readonly onEdit: () => void;
  readonly onAddSub: () => void;
}

function RowActionMenu({ category, isTopLevel, onEdit, onAddSub }: RowActionMenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`Row actions for ${category.name}`}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1">
        <ul className="flex flex-col" role="menu">
          <li role="none">
            <button
              type="button"
              role="menuitem"
              onClick={() => { onEdit(); setOpen(false); }}
              className="w-full text-left px-3 py-2 rounded-sm text-sm text-on-surface min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Edit {isTopLevel ? 'category' : 'sub-category'}
            </button>
          </li>
          {isTopLevel ? (
            <li role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => { onAddSub(); setOpen(false); }}
                className="w-full text-left px-3 py-2 rounded-sm text-sm text-on-surface min-h-[44px] hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Add sub-category
              </button>
            </li>
          ) : null}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Category dialog (create + edit)
// ---------------------------------------------------------------------------

interface CategoryDialogProps {
  readonly mode: DialogMode;
  readonly open: boolean;
  readonly onClose: () => void;
  /** Called when user clicks "Edit existing" in the duplicate-warn panel (create mode only). */
  readonly onEditExisting?: (categoryId: string) => void;
}

function CategoryDialog({ mode, open, onClose, onEditExisting }: CategoryDialogProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const descId = useId();
  const reasonId = useId();
  const activeId = useId();

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deactivateCategory = useDeactivateCategory();

  const isCreate = mode.type === 'create-top' || mode.type === 'create-sub';
  const isEdit = mode.type === 'edit';
  const editCategory = isEdit ? mode.category : null;

  const dialogTitle =
    mode.type === 'create-top'
      ? 'Add category'
      : mode.type === 'create-sub'
      ? `Add sub-category under "${mode.parentName}"`
      : `Edit ${editCategory?.parentId ? 'sub-category' : 'category'}`;

  const [values, setValues] = useState<CategoryFormValues>({
    name: '',
    description: '',
    active: true,
    reason: '',
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  // ── CC-DUPLICATE-WARN (DL-026 / Task C9) ─────────────────────────────────
  // Only active on create paths; edit mode already knows the record exists.
  const [proceedAnyway, setProceedAnyway] = useState(false);
  const debouncedName = useDebounce(values.name, 300);
  const similarQuery = useFindSimilarCategories(
    isCreate ? debouncedName : '',
    { excludeId: editCategory?.id },
  );
  const showDuplicateWarn =
    isCreate &&
    !proceedAnyway &&
    debouncedName.length >= 3 &&
    (similarQuery.data?.length ?? 0) > 0;

  // Reset proceedAnyway when name changes substantially
  useEffect(() => {
    setProceedAnyway(false);
  }, [debouncedName]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSubmitError(null);
      setDeactivateOpen(false);
      setDeactivateReason('');
      setDeactivateError(null);
      setProceedAnyway(false);
      if (isEdit && editCategory) {
        setValues({
          name: editCategory.name,
          description: editCategory.description ?? '',
          active: editCategory.active,
          reason: '',
        });
      } else {
        setValues({ name: '', description: '', active: true, reason: '' });
      }
      // Focus name input after dialog renders
      setTimeout(() => nameInputRef.current?.focus(), 80);
    }
  }, [open, isEdit, editCategory]);

  const isPending =
    createCategory.isPending || updateCategory.isPending || deactivateCategory.isPending;

  const nameError =
    values.name.trim().length === 0 && submitError
      ? 'Name is required'
      : null;

  const reasonError =
    isEdit && values.reason.trim().length < 3 && submitError
      ? 'Reason must be at least 3 characters'
      : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (values.name.trim().length === 0) {
      setSubmitError('Name is required.');
      return;
    }
    if (isEdit && values.reason.trim().length < 3) {
      setSubmitError('Reason must be at least 3 characters.');
      return;
    }

    try {
      if (isCreate) {
        const parentId =
          mode.type === 'create-sub' ? mode.parentId : undefined;
        await createCategory.mutateAsync({
          name: values.name.trim(),
          parentId: parentId ?? null,
          active: values.active,
        });
      } else if (isEdit && editCategory) {
        await updateCategory.mutateAsync({
          id: editCategory.id,
          name: values.name.trim(),
          active: values.active,
          reason: values.reason.trim(),
        });
      }
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Unexpected error. Please try again.';
      setSubmitError(msg);
    }
  }

  async function handleDeactivate() {
    if (!editCategory) return;
    setDeactivateError(null);
    if (deactivateReason.trim().length < 3) {
      setDeactivateError('Reason must be at least 3 characters.');
      return;
    }
    try {
      await deactivateCategory.mutateAsync({ id: editCategory.id, reason: deactivateReason.trim() });
      onClose();
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
          ? err.message
          : 'Unexpected error. Please try again.';
      setDeactivateError(msg);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/20 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          aria-labelledby="category-dialog-title"
          aria-describedby="category-dialog-desc"
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface p-0 shadow-lg duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 focus:outline-none"
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-4">
            <DialogPrimitive.Title
              id="category-dialog-title"
              className="text-base font-semibold text-on-surface"
            >
              {dialogTitle}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description
              id="category-dialog-desc"
              className="mt-1 text-xs text-on-surface-variant"
            >
              {mode.type === 'create-top' && 'Create a new top-level category.'}
              {mode.type === 'create-sub' && 'Sub-categories are depth-2 only; no deeper nesting.'}
              {mode.type === 'edit' && 'Changes require a reason for the audit log.'}
            </DialogPrimitive.Description>
          </div>

          <SectionShift tone="low" aria-hidden />

          {/* Form */}
          <form onSubmit={(e) => void handleSubmit(e)} noValidate>
            <div className="flex flex-col gap-4 px-5 py-4">

              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor={nameId} className="text-xs font-medium text-on-surface">
                  Name <span aria-hidden className="text-error">*</span>
                </label>
                <Input
                  id={nameId}
                  ref={nameInputRef}
                  value={values.name}
                  onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
                  placeholder={
                    mode.type === 'create-sub' ? 'e.g. Vegetables' : 'e.g. Raw Materials'
                  }
                  aria-required="true"
                  aria-invalid={nameError ? 'true' : undefined}
                  aria-describedby={nameError ? `${nameId}-err` : undefined}
                  maxLength={120}
                  className={nameError ? 'aria-invalid:ring-error' : undefined}
                />
                {nameError ? (
                  <p id={`${nameId}-err`} role="alert" className="text-xs text-error">
                    {nameError}
                  </p>
                ) : null}

                {/* CC-DUPLICATE-WARN — DL-026 / Task C9 (create paths only) */}
                {isCreate && similarQuery.isFetching && debouncedName.length >= 3 ? (
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant" aria-live="polite">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Checking for duplicates…
                  </div>
                ) : null}
                {showDuplicateWarn ? (
                  <CCDuplicateWarn
                    matches={(similarQuery.data ?? []).map((m) => ({
                      id: m.id,
                      name: m.name,
                      subtitle: m.parentId ? 'Sub-category' : 'Top-level category',
                      status: m.active === false ? 'inactive' : 'active',
                    }))}
                    onEditExisting={(matchId) => {
                      onClose();
                      onEditExisting?.(matchId);
                    }}
                    onProceedAnyway={() => setProceedAnyway(true)}
                  />
                ) : null}
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor={descId} className="text-xs font-medium text-on-surface">
                  Description <span className="text-on-surface-variant font-normal">(optional)</span>
                </label>
                <textarea
                  id={descId}
                  value={values.description}
                  onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
                  placeholder="Brief description of this category…"
                  rows={2}
                  className="w-full rounded-md bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>

              {/* Active toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id={activeId}
                  checked={values.active}
                  onChange={(e) => setValues((v) => ({ ...v, active: e.target.checked }))}
                  className="h-4 w-4 rounded accent-primary"
                />
                <label htmlFor={activeId} className="text-sm text-on-surface select-none">
                  Active
                </label>
                <span className="ml-auto">
                  <ActiveStatusPill active={values.active} />
                </span>
              </div>

              {/* Reason (edit only) */}
              {isEdit ? (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={reasonId} className="text-xs font-medium text-on-surface">
                    Reason for change <span aria-hidden className="text-error">*</span>
                  </label>
                  <Input
                    id={reasonId}
                    value={values.reason}
                    onChange={(e) => setValues((v) => ({ ...v, reason: e.target.value }))}
                    placeholder="Brief reason (≥ 3 chars)"
                    aria-required="true"
                    aria-invalid={reasonError ? 'true' : undefined}
                    aria-describedby={reasonError ? `${reasonId}-err` : undefined}
                    maxLength={255}
                  />
                  {reasonError ? (
                    <p id={`${reasonId}-err`} role="alert" className="text-xs text-error">
                      {reasonError}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Submit error */}
              {submitError ? (
                <div role="alert" className="rounded-md bg-error-container px-3 py-2 text-xs text-on-error-container">
                  {submitError}
                </div>
              ) : null}
            </div>

            <SectionShift tone="low" aria-hidden />

            {/* Footer */}
            <div className="flex items-center gap-2 px-5 py-4">
              {/* Deactivate affordance (edit of active only) */}
              {isEdit && editCategory?.active ? (
                <Popover open={deactivateOpen} onOpenChange={setDeactivateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-error hover:bg-error-container hover:text-on-error-container"
                    >
                      Deactivate
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 p-4">
                    <p className="text-sm font-semibold text-on-surface">
                      Deactivate {editCategory.parentId ? 'sub-category' : 'category'}?
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Product assignments are preserved (soft-delete). Provide a reason.
                    </p>
                    <div className="mt-3 flex flex-col gap-2">
                      <Input
                        aria-label="Deactivation reason"
                        value={deactivateReason}
                        onChange={(e) => setDeactivateReason(e.target.value)}
                        placeholder="Reason (≥ 3 chars)"
                        maxLength={255}
                      />
                      {deactivateError ? (
                        <p role="alert" className="text-xs text-error">{deactivateError}</p>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        className="bg-error text-on-error hover:bg-error/90"
                        disabled={deactivateCategory.isPending}
                        onClick={() => void handleDeactivate()}
                      >
                        {deactivateCategory.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : null}
                        Confirm deactivate
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              ) : null}

              <div className="ml-auto flex items-center gap-2">
                <DialogPrimitive.Close asChild>
                  <Button type="button" variant="ghost" size="sm">
                    Cancel
                  </Button>
                </DialogPrimitive.Close>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending}
                  aria-label={isCreate ? 'Create category' : 'Save changes'}
                >
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : null}
                  {isCreate ? 'Create' : 'Save changes'}
                </Button>
              </div>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ---------------------------------------------------------------------------
// Tree node row
// ---------------------------------------------------------------------------

interface CategoryNodeProps {
  readonly node: TreeNode;
  readonly onEdit: (category: CategoryRow) => void;
  readonly onAddSub: (parentId: string, parentName: string) => void;
}

function CategoryNode({ node, onEdit, onAddSub }: CategoryNodeProps) {
  const { category, children } = node;
  const [expanded, setExpanded] = useState(true);
  const hasChildren = children.length > 0;

  return (
    <li
      role="treeitem"
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected="false"
      className="list-none"
    >
      {/* Top-level category row */}
      <div className="group flex items-center gap-2 px-3 py-2.5 rounded-md hover:bg-surface-container-low transition-colors min-h-[48px]">
        {/* Expand/collapse toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={
            hasChildren
              ? expanded
                ? `Collapse ${category.name}`
                : `Expand ${category.name}`
              : undefined
          }
          className={`inline-flex h-7 w-7 items-center justify-center rounded-sm shrink-0 ${
            hasChildren
              ? 'hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
              : 'cursor-default'
          }`}
          tabIndex={hasChildren ? 0 : -1}
          disabled={!hasChildren}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-4 w-4 text-on-surface-variant" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4 text-on-surface-variant" aria-hidden />
            )
          ) : (
            <span className="h-4 w-4" aria-hidden />
          )}
        </button>

        {/* Icon */}
        {hasChildren ? (
          <FolderOpen className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
        ) : (
          <FolderTree className="h-4 w-4 text-on-surface-variant shrink-0" aria-hidden />
        )}

        {/* Name — clicking opens edit dialog (write-gated) */}
        <RequirePermission
          permission="mdm.categories.write"
          fallback={
            <span className={`flex-1 text-left text-sm font-medium min-h-[36px] flex items-center px-1 ${
              category.active
                ? 'text-on-surface'
                : 'text-on-surface-variant line-through'
            }`}>
              {category.name}
              {category.code ? (
                <span className="ml-2 font-mono text-[11px] text-on-surface-variant font-normal">
                  {category.code}
                </span>
              ) : null}
            </span>
          }
        >
          <button
            type="button"
            onClick={() => onEdit(category)}
            aria-label={`Edit category ${category.name}`}
            className={`flex-1 text-left text-sm font-medium min-h-[36px] flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm px-1 ${
              category.active
                ? 'text-on-surface'
                : 'text-on-surface-variant line-through'
            }`}
          >
            {category.name}
            {category.code ? (
              <span className="ml-2 font-mono text-[11px] text-on-surface-variant font-normal">
                {category.code}
              </span>
            ) : null}
          </button>
        </RequirePermission>

        {/* Sub-category count badge */}
        {hasChildren ? (
          <span className="text-[11px] text-on-surface-variant tabular-nums">
            {children.length} sub
          </span>
        ) : null}

        {/* Status pill */}
        <ActiveStatusPill active={category.active} />

        {/* Action menu */}
        <span className="shrink-0">
          <RequirePermission permission="mdm.categories.write">
            <RowActionMenu
              category={category}
              isTopLevel
              onEdit={() => onEdit(category)}
              onAddSub={() => onAddSub(category.id, category.name)}
            />
          </RequirePermission>
        </span>
      </div>

      {/* Sub-categories — always render the group block for top-level categories
           so the "Add sub-category" affordance is accessible even for leaf categories */}
      {(!hasChildren || expanded) ? (
        <ul role="group" className="ml-7 flex flex-col">
          {hasChildren ? children.map((sub) => (
            <li key={sub.id} role="treeitem" aria-selected="false" className="list-none">
              <div className="group flex items-center gap-2 px-3 py-2 rounded-md hover:bg-surface-container-low transition-colors min-h-[44px]">
                {/* Indent spacer */}
                <span className="inline-flex h-6 w-6 items-center justify-center shrink-0" aria-hidden>
                  <Tag className="h-3.5 w-3.5 text-on-surface-variant" />
                </span>

                {/* Name — clicking opens edit dialog (write-gated) */}
                <RequirePermission
                  permission="mdm.categories.write"
                  fallback={
                    <span className={`flex-1 text-left text-sm min-h-[36px] flex items-center px-1 ${
                      sub.active
                        ? 'text-on-surface'
                        : 'text-on-surface-variant line-through'
                    }`}>
                      {sub.name}
                      {sub.code ? (
                        <span className="ml-2 font-mono text-[11px] text-on-surface-variant font-normal">
                          {sub.code}
                        </span>
                      ) : null}
                    </span>
                  }
                >
                  <button
                    type="button"
                    onClick={() => onEdit(sub)}
                    aria-label={`Edit sub-category ${sub.name}`}
                    className={`flex-1 text-left text-sm min-h-[36px] flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm px-1 ${
                      sub.active
                        ? 'text-on-surface'
                        : 'text-on-surface-variant line-through'
                    }`}
                  >
                    {sub.name}
                    {sub.code ? (
                      <span className="ml-2 font-mono text-[11px] text-on-surface-variant font-normal">
                        {sub.code}
                      </span>
                    ) : null}
                  </button>
                </RequirePermission>

                {/* Status pill */}
                <ActiveStatusPill active={sub.active} />

                {/* Action menu */}
                <span className="shrink-0">
                  <RequirePermission permission="mdm.categories.write">
                    <RowActionMenu
                      category={sub}
                      isTopLevel={false}
                      onEdit={() => onEdit(sub)}
                      onAddSub={() => {}}
                    />
                  </RequirePermission>
                </span>
              </div>
            </li>
          )) : null}
          {/* Add sub-category affordance — visible for top-level categories (write-gated) */}
          <RequirePermission permission="mdm.categories.write">
            <li role="none" className="list-none">
              <button
                type="button"
                onClick={() => onAddSub(category.id, category.name)}
                aria-label={`Add sub-category under ${category.name}`}
                className="flex items-center gap-1.5 px-3 py-2 text-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-md min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary w-full text-left"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add sub-category
              </button>
            </li>
          </RequirePermission>
        </ul>
      ) : null}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onAdd }: { readonly onAdd: () => void }) {
  return (
    <div className="px-6 py-12 text-center">
      <FolderTree className="h-10 w-10 text-on-surface-variant mx-auto mb-3" aria-hidden />
      <p className="text-sm font-semibold text-on-surface">No categories yet</p>
      <p className="mt-1 text-xs text-on-surface-variant max-w-xs mx-auto">
        Categories organise your product catalogue into a two-level hierarchy.
        Start by adding a top-level category.
      </p>
      <RequirePermission permission="mdm.categories.write">
        <Button size="sm" className="mt-4 gap-1.5" onClick={onAdd}>
          <Plus className="h-4 w-4" aria-hidden />
          Add category
        </Button>
      </RequirePermission>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CategoriesPage() {
  const categoriesQuery = useCategoriesList();

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [dialogState, setDialogState] = useState<{ open: boolean; mode: DialogMode }>({
    open: false,
    mode: { type: 'create-top' },
  });

  // ── Filter: active only ──────────────────────────────────────────────────
  const [showInactive, setShowInactive] = useState(true);

  // ── Build tree structure ──────────────────────────────────────────────────
  const tree = useMemo<TreeNode[]>(() => {
    const all = categoriesQuery.data ?? [];
    const filtered = showInactive ? all : all.filter((c) => c.active);
    const topLevel = filtered.filter((c) => c.parentId === null);
    const childrenByParent = new Map<string, CategoryRow[]>();
    all.forEach((c) => {
      if (c.parentId !== null) {
        const existing = childrenByParent.get(c.parentId) ?? [];
        existing.push(c);
        childrenByParent.set(c.parentId, existing);
      }
    });
    return topLevel
      .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name))
      .map((cat) => ({
        category: cat,
        children: (childrenByParent.get(cat.id) ?? [])
          .filter((c) => showInactive || c.active)
          .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name)),
      }));
  }, [categoriesQuery.data, showInactive]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalCategories = (categoriesQuery.data ?? []).filter((c) => c.parentId === null).length;
  const totalSubCategories = (categoriesQuery.data ?? []).filter((c) => c.parentId !== null).length;
  const inactiveCount = (categoriesQuery.data ?? []).filter((c) => !c.active).length;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openCreateTop = useCallback(() => {
    setDialogState({ open: true, mode: { type: 'create-top' } });
  }, []);

  const openCreateSub = useCallback((parentId: string, parentName: string) => {
    setDialogState({ open: true, mode: { type: 'create-sub', parentId, parentName } });
  }, []);

  const openEdit = useCallback((category: CategoryRow) => {
    setDialogState({ open: true, mode: { type: 'edit', category } });
  }, []);

  const closeDialog = useCallback(() => {
    setDialogState((s) => ({ ...s, open: false }));
  }, []);

  // Handler for CC-DUPLICATE-WARN "Edit existing" — receives only id, looks up full row.
  const openEditById = useCallback((id: string) => {
    const cat = (categoriesQuery.data ?? []).find((c) => c.id === id);
    if (cat) openEdit(cat);
  }, [categoriesQuery.data, openEdit]);

  const fetchError = categoriesQuery.error;
  const isLoading = categoriesQuery.isLoading;

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-[1024px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">

        {/* ── Page header ────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
              Master data · Categories
            </p>
            <h1 className="mt-1 text-2xl sm:text-[2rem] leading-tight font-bold tracking-tight text-on-surface flex items-center gap-2">
              <FolderTree className="h-6 w-6 text-on-surface-variant" aria-hidden />
              Category &amp; Sub-Category Management
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-on-surface-variant">
              {isLoading ? 'Loading…' : (
                <>
                  {totalCategories} categor{totalCategories !== 1 ? 'ies' : 'y'} ·{' '}
                  {totalSubCategories} sub-categor{totalSubCategories !== 1 ? 'ies' : 'y'}
                  {inactiveCount > 0 ? ` · ${inactiveCount} deactivated` : ''}.{' '}
                  Two-level hierarchy.
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AuditLink entityType="categories" compact />
            <RequirePermission permission="mdm.categories.write">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={openCreateTop}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add category
            </Button>
            </RequirePermission>
          </div>
        </header>

        {/* ── Error banner ───────────────────────────────────────────────── */}
        {fetchError ? (
          <div
            role="alert"
            className="mt-4 rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container"
          >
            {fetchError instanceof ApiError
              ? `Error loading categories: ${fetchError.message}`
              : 'Failed to load categories. Please refresh the page.'}
          </div>
        ) : null}

        {/* ── Filter strip ────────────────────────────────────────────────── */}
        <div className="mt-4 rounded-md bg-surface-container-low px-3 py-2.5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-on-surface-variant">Show:</span>
          <Button
            variant={showInactive ? 'ghost' : 'tonal'}
            size="sm"
            className="h-8 px-3 gap-1.5 rounded-pill"
            onClick={() => setShowInactive((v) => !v)}
            aria-pressed={!showInactive}
            aria-label={showInactive ? 'Showing all — click to show active only' : 'Showing active only — click to show all'}
          >
            <span className="text-xs font-medium">{showInactive ? 'All' : 'Active only'}</span>
          </Button>
          <span className="ml-auto text-xs text-on-surface-variant tabular-nums">
            {isLoading ? '…' : `${tree.length} top-level shown`}
          </span>
        </div>

        {/* ── Tree panel ──────────────────────────────────────────────────── */}
        <Card className="mt-4 p-0">
          <div className="px-4 py-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-on-surface">Category tree</h2>
            <span className="text-xs text-on-surface-variant tabular-nums">
              {isLoading ? '…' : `${totalCategories} + ${totalSubCategories}`}
            </span>
          </div>
          <SectionShift tone="low" aria-hidden />

          {isLoading ? (
            <TreeSkeleton />
          ) : fetchError ? null : tree.length === 0 ? (
            <EmptyState onAdd={openCreateTop} />
          ) : (
            <ul
              role="tree"
              aria-label="Category hierarchy"
              className="flex flex-col gap-0.5 p-2"
            >
              {tree.map((node) => (
                <CategoryNode
                  key={node.category.id}
                  node={node}
                  onEdit={openEdit}
                  onAddSub={openCreateSub}
                />
              ))}
            </ul>
          )}
        </Card>

        {/* ── Quick links ───────────────────────────────────────────────────── */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Link
            to="/mdm/products"
            className="inline-flex items-center gap-1.5 rounded-sm bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Product Master
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
          <Link
            to="/mdm/vendors"
            className="inline-flex items-center gap-1.5 rounded-sm bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface min-h-[44px] sm:min-h-[36px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Vendor Master
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

      </div>

      {/* ── Category dialog ──────────────────────────────────────────────── */}
      <CategoryDialog
        mode={dialogState.mode}
        open={dialogState.open}
        onClose={closeDialog}
        onEditExisting={openEditById}
      />
    </div>
  );
}

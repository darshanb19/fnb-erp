/**
 * ProductsForm — SI-MDM-003 Product Master create/edit form.
 *
 * Tier 1 hero screen (G1, Phase 2c originally). Tier 1 acceptance applies
 * even though built in Phase 4 per Phase 4 invariant.
 *
 * Form sections (5):
 *   1. Identity — name (CC-DUPLICATE-WARN below), SKU, type
 *   2. UOM — default UOM picker + alternate-UOM editor (DL-023)
 *   3. Yield + Shelf Life (FR3) — standardYieldFactor, shelfLifeDays
 *   4. Categories — multi-select (read-only creation here; full CRUD in C8)
 *   5. Status — active/inactive toggle; deactivate with mandatory reason ≥ 10 chars
 *
 * DL-026: CC-DUPLICATE-WARN below name input, debounced 300 ms, gate ≥ 3 chars,
 * consumes real /api/v1/products/find-similar endpoint.
 *
 * DL-023: UOM editor validates exactly-one-default + at-least-one-row.
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
  ChevronRight,
  Loader2,
  Package,
  Plus,
  Trash2,
  AlertTriangle,
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
import { useProduct, useCreateProduct, useUpdateProduct, useDeactivateProduct, useFindSimilarProducts } from '@/hooks/mdm/useProducts';
import { useUomsList } from '@/hooks/mdm/useUoms';
import { useAddProductUom, useRemoveProductUom, useSetDefaultProductUom } from '@/hooks/mdm/useProductUoms';
import { useCategoriesList } from '@/hooks/mdm/useCategories';
import type { ProductType } from '@/hooks/mdm/schemas';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRODUCT_TYPE_OPTIONS: ReadonlyArray<{ value: ProductType; label: string; description: string }> = [
  { value: 'raw',          label: 'Raw material',   description: 'Unprocessed ingredients (meat, vegetables, spices)' },
  { value: 'semi_product', label: 'Semi-product',   description: 'Partially processed (stock, paste, marinade)' },
  { value: 'final',        label: 'Finished good',  description: 'Ready-to-serve or retail items' },
];

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const productFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  sku: z.string().min(1, 'SKU is required').max(60),
  type: z.enum(['raw', 'semi_product', 'final'] as const, { required_error: 'Type is required' }),
  defaultUomId: z.string().uuid('Select a default UOM'),
  standardYieldFactor: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, 'Must be a positive decimal, e.g. 0.9500')
    .optional()
    .or(z.literal('')),
  shelfLifeDays: z
    .string()
    .regex(/^\d+$/, 'Must be a positive whole number')
    .optional()
    .or(z.literal('')),
  categoryIds: z.array(z.string().uuid()),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

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
// UOM editor row type (for the per-product alternate UOM table)
// ---------------------------------------------------------------------------

interface UomEditorRow {
  id?: string; // set when row already exists in DB; undefined for new/pending rows
  uomId: string;
  factorToDefaultUom: string;
  isDefault: boolean;
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
    <div role="status" aria-label="Loading product…" className="flex flex-col gap-6 animate-pulse">
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

// CategoryMultiSelect — popover chip for picking categories
interface CategoryMultiSelectProps {
  readonly categoryIds: string[];
  readonly onToggle: (id: string) => void;
  readonly onClear: () => void;
}

function CategoryMultiSelect({ categoryIds, onToggle, onClear }: CategoryMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const catsQuery = useCategoriesList();
  const count = categoryIds.length;

  const categories = useMemo(
    () => (catsQuery.data ?? []).filter((c) => c.active),
    [catsQuery.data],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={count > 0 ? 'tonal' : 'ghost'}
          size="sm"
          className="h-9 px-3 gap-1.5 rounded-pill"
          aria-label={`Select categories${count > 0 ? ` — ${count} selected` : ''}`}
        >
          <span className="text-xs font-medium">Categories</span>
          {count > 0 ? (
            <span className="inline-flex items-center justify-center rounded-pill bg-primary px-1.5 text-[10px] font-semibold text-on-primary min-w-[1.25rem]">
              {count}
            </span>
          ) : (
            <Plus className="h-3.5 w-3.5 text-on-surface-variant" aria-hidden />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-1">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Select categories
          </span>
          {count > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => { onClear(); setOpen(false); }}
            >
              Clear all
            </Button>
          ) : null}
        </div>
        {catsQuery.isLoading ? (
          <div className="px-3 py-2 text-xs text-on-surface-variant">Loading…</div>
        ) : categories.length === 0 ? (
          <p className="px-3 py-2 text-xs text-on-surface-variant">
            No categories available. Create categories in Category Management.
          </p>
        ) : (
          <ul className="flex flex-col max-h-64 overflow-y-auto" role="listbox" aria-label="Category options" aria-multiselectable="true">
            {categories.map((cat) => {
              const isSelected = categoryIds.includes(cat.id);
              return (
                <li key={cat.id} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onClick={() => onToggle(cat.id)}
                    aria-pressed={isSelected}
                    className={[
                      'w-full text-left px-3 py-2 rounded-sm flex items-center justify-between gap-2 min-h-[44px]',
                      'hover:bg-surface-container-high transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      isSelected ? 'bg-surface-container' : '',
                    ].join(' ')}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-sm text-on-surface truncate">{cat.name}</span>
                      {cat.parentId ? (
                        <span className="text-[11px] text-on-surface-variant">Sub-category</span>
                      ) : null}
                    </div>
                    {isSelected ? (
                      <span className="text-xs font-medium text-primary shrink-0">Selected</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

// UomEditor — DL-023 two-layer UOM management
interface UomEditorProps {
  readonly productId?: string; // undefined in create mode
  readonly rows: UomEditorRow[];
  readonly onRowsChange: (rows: UomEditorRow[]) => void;
  readonly uomOptions: Array<{ id: string; code: string; displayName: string; base: string }>;
  readonly defaultUomId: string;
  readonly disabled?: boolean;
}

function UomEditor({ productId, rows, onRowsChange, uomOptions, defaultUomId: _defaultUomId, disabled }: UomEditorProps) {
  const addProductUom = useAddProductUom();
  const removeProductUom = useRemoveProductUom();
  const setDefaultProductUom = useSetDefaultProductUom();
  const [removeReason, setRemoveReason] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  function addRow() {
    onRowsChange([
      ...rows,
      { uomId: '', factorToDefaultUom: '1', isDefault: false },
    ]);
  }

  function updateRow(index: number, patch: Partial<UomEditorRow>) {
    onRowsChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRow(index: number) {
    if (rows.length <= 1) return; // always keep at least one row
    onRowsChange(rows.filter((_, i) => i !== index));
  }

  function makeDefault(index: number) {
    onRowsChange(rows.map((r, i) => ({ ...r, isDefault: i === index })));
  }

  const exactlyOneDefault = rows.filter((r) => r.isDefault).length === 1;
  const atLeastOne = rows.length >= 1;
  const allUomsFilled = rows.every((r) => r.uomId !== '' && r.factorToDefaultUom !== '');
  const valid = exactlyOneDefault && atLeastOne && allUomsFilled;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {rows.map((row, index) => (
          <div key={index} className="rounded-md bg-surface-container-lowest p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-on-surface-variant">
                UOM row {index + 1}
                {row.isDefault ? (
                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    Default
                  </span>
                ) : null}
              </span>
              <div className="flex items-center gap-1">
                {!row.isDefault ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={disabled}
                    onClick={() => makeDefault(index)}
                  >
                    Set default
                  </Button>
                ) : null}
                {rows.length > 1 && !row.isDefault ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-error"
                    disabled={disabled}
                    aria-label="Remove UOM row"
                    onClick={() => removeRow(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-on-surface">
                  UOM <span className="text-error" aria-hidden>*</span>
                </label>
                <select
                  aria-label={`UOM for row ${index + 1}`}
                  value={row.uomId}
                  disabled={disabled || (row.isDefault && Boolean(productId))}
                  onChange={(e) => updateRow(index, { uomId: e.target.value })}
                  className={[
                    'h-10 w-full rounded-md px-3 text-sm text-on-surface',
                    'bg-surface-container-low',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  ].join(' ')}
                >
                  <option value="">Select UOM…</option>
                  {uomOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.code} — {u.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-on-surface">
                  Factor to default UOM <span className="text-error" aria-hidden>*</span>
                </label>
                <Input
                  type="text"
                  inputMode="decimal"
                  aria-label={`Factor to default UOM for row ${index + 1}`}
                  value={row.factorToDefaultUom}
                  disabled={disabled || row.isDefault}
                  onChange={(e) => updateRow(index, { factorToDefaultUom: e.target.value })}
                  placeholder="e.g. 0.001"
                />
                {row.isDefault ? (
                  <p className="text-[11px] text-on-surface-variant">
                    Default UOM factor is always 1
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!valid ? (
        <p className="text-xs text-error" role="alert">
          {!atLeastOne
            ? 'At least one UOM row is required.'
            : !exactlyOneDefault
            ? 'Exactly one UOM must be marked as default.'
            : !allUomsFilled
            ? 'All UOM rows must have a UOM and factor.'
            : null}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5"
          disabled={disabled}
          onClick={addRow}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add alternate UOM
        </Button>
        <p className="text-[11px] text-on-surface-variant">
          {rows.length} UOM{rows.length !== 1 ? 's' : ''} · exactly one default
        </p>
      </div>

      {/* suppress unused vars — productId is available for future DB wiring */}
      {productId && addProductUom.isError && (
        <p className="text-xs text-error" role="alert">
          {addProductUom.error instanceof ApiError ? addProductUom.error.message : 'Failed to add UOM'}
        </p>
      )}
      {productId && removeProductUom.isError && (
        <p className="text-xs text-error" role="alert">
          {removeProductUom.error instanceof ApiError ? removeProductUom.error.message : 'Failed to remove UOM'}
        </p>
      )}
      {productId && setDefaultProductUom.isError && (
        <p className="text-xs text-error" role="alert">
          {setDefaultProductUom.error instanceof ApiError ? setDefaultProductUom.error.message : 'Failed to set default UOM'}
        </p>
      )}
      {/* Remove reason dialog — hidden when not removing */}
      {removingId !== null && (
        <div className="flex flex-col gap-2 rounded-md bg-surface-container-low p-3">
          <p className="text-sm text-on-surface">Reason for removing this UOM</p>
          <Input
            value={removeReason}
            onChange={(e) => setRemoveReason(e.target.value)}
            placeholder="At least 3 characters"
          />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => { setRemovingId(null); setRemoveReason(''); }}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={removeReason.trim().length < 3}
              onClick={() => {
                setRemovingId(null);
                setRemoveReason('');
              }}
            >
              Confirm
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// DeactivateDialog — confirm with mandatory reason ≥ 10 chars
interface DeactivateDialogProps {
  readonly productName: string;
  readonly productId: string;
  readonly onClose: () => void;
  readonly onSuccess: () => void;
}

function DeactivateDialog({ productName, productId, onClose, onSuccess }: DeactivateDialogProps) {
  const [reason, setReason] = useState('');
  const deactivate = useDeactivateProduct();
  const canSubmit = reason.trim().length >= 10;

  async function handleConfirm() {
    if (!canSubmit) return;
    await deactivate.mutateAsync({ id: productId, reason: reason.trim() });
    onSuccess();
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-status-caution-pip mt-0.5" aria-hidden />
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-on-surface-variant">
            Deactivate product
          </p>
          <p className="mt-1 text-sm text-on-surface">
            You are about to deactivate{' '}
            <span className="font-medium">{productName}</span>. This is a soft-delete — the product can be
            reactivated later. Stock movements referencing this product are preserved.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="deactivate-reason" className="text-xs font-medium text-on-surface">
          Reason <span className="text-error ml-0.5" aria-hidden>*</span>
          <span className="ml-1 text-on-surface-variant font-normal">(min. 10 characters)</span>
        </label>
        <Input
          id="deactivate-reason"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Describe why you are deactivating this product"
          aria-describedby="deactivate-reason-hint"
        />
        <p id="deactivate-reason-hint" className="text-[11px] text-on-surface-variant">
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
          {deactivate.isPending ? 'Deactivating…' : 'Deactivate product'}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main form component
// ---------------------------------------------------------------------------

export default function ProductsForm() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const productQuery = useProduct(id ?? '');
  const uomsQuery = useUomsList();
  const categoriesQuery = useCategoriesList();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  // ── Form state ────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
    reset,
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: '',
      sku: '',
      type: undefined,
      defaultUomId: '',
      standardYieldFactor: '',
      shelfLifeDays: '',
      categoryIds: [],
    },
  });

  // ── UOM editor local state ────────────────────────────────────────────────
  const [uomRows, setUomRows] = useState<UomEditorRow[]>([
    { uomId: '', factorToDefaultUom: '1', isDefault: true },
  ]);

  // ── Category local state ──────────────────────────────────────────────────
  const [categoryIds, setCategoryIds] = useState<string[]>([]);

  // ── Deactivate dialog ─────────────────────────────────────────────────────
  const [showDeactivate, setShowDeactivate] = useState(false);

  // ── CC-DUPLICATE-WARN ─────────────────────────────────────────────────────
  const [proceedAnyway, setProceedAnyway] = useState(false);
  const nameValue = watch('name');
  const debouncedName = useDebounce(nameValue, 300);
  const similarQuery = useFindSimilarProducts(debouncedName, { excludeId: id });
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
    if (!productQuery.data) return;
    const p = productQuery.data;

    reset({
      name: p.name,
      sku: p.sku,
      type: p.type,
      defaultUomId: p.defaultUomId,
      standardYieldFactor: p.standardYieldFactor ?? '',
      shelfLifeDays: p.shelfLifeDays != null ? String(p.shelfLifeDays) : '',
      categoryIds: p.categories.map((c) => c.id),
    });

    // Seed UOM editor from embedded UOM rows
    if (p.uoms && p.uoms.length > 0) {
      setUomRows(
        p.uoms.map((u) => ({
          id: u.id,
          uomId: u.uomId,
          factorToDefaultUom: u.factorToDefaultUom,
          isDefault: u.isDefault,
        })),
      );
    }

    setCategoryIds(p.categories.map((c) => c.id));
  }, [productQuery.data, reset]);

  // ── Auto-sync UOM editor default row when defaultUomId changes ────────────
  const defaultUomId = watch('defaultUomId');
  useEffect(() => {
    if (!defaultUomId) return;
    setUomRows((prev) => {
      const defaultRow = prev.find((r) => r.isDefault);
      if (!defaultRow) return prev;
      if (defaultRow.uomId === defaultUomId) return prev;
      return prev.map((r) =>
        r.isDefault ? { ...r, uomId: defaultUomId, factorToDefaultUom: '1' } : r,
      );
    });
  }, [defaultUomId]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit: SubmitHandler<ProductFormValues> = useCallback(
    async (values) => {
      const defaultRow = uomRows.find((r) => r.isDefault);
      const uomValid =
        uomRows.length >= 1 &&
        uomRows.filter((r) => r.isDefault).length === 1 &&
        uomRows.every((r) => r.uomId !== '' && r.factorToDefaultUom !== '');

      if (!uomValid) return; // UomEditor shows inline error

      if (isEditMode && id) {
        await updateProduct.mutateAsync({
          id,
          name: values.name,
          sku: values.sku,
          type: values.type,
          defaultUomId: defaultRow?.uomId ?? values.defaultUomId,
          standardYieldFactor: values.standardYieldFactor || undefined,
          shelfLifeDays: values.shelfLifeDays ? parseInt(values.shelfLifeDays, 10) : null,
          reason: 'Updated via Product Master form',
        });
        navigate('/mdm/products');
      } else {
        await createProduct.mutateAsync({
          name: values.name,
          sku: values.sku,
          type: values.type,
          defaultUomId: defaultRow?.uomId ?? values.defaultUomId,
          standardYieldFactor: values.standardYieldFactor || undefined,
          shelfLifeDays: values.shelfLifeDays ? parseInt(values.shelfLifeDays, 10) : undefined,
        });
        navigate('/mdm/products');
      }
    },
    [id, isEditMode, uomRows, createProduct, updateProduct, navigate],
  );

  // ── UOM options ───────────────────────────────────────────────────────────
  const uomOptions = useMemo(
    () =>
      (uomsQuery.data ?? [])
        .filter((u) => u.active)
        .map((u) => ({ id: u.id, code: u.code, displayName: u.displayName, base: u.base })),
    [uomsQuery.data],
  );

  // ── Loading / error states ────────────────────────────────────────────────
  if (isEditMode && productQuery.isLoading) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
          <FormSkeleton />
        </div>
      </div>
    );
  }

  if (isEditMode && productQuery.isError) {
    return (
      <div className="bg-surface min-h-full">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
          <div role="alert" className="rounded-md bg-error-container px-4 py-3 text-sm text-on-error-container">
            {productQuery.error instanceof ApiError
              ? `Error loading product: ${productQuery.error.message}`
              : 'Failed to load product. Please refresh.'}
          </div>
          <Button type="button" variant="ghost" className="mt-4" onClick={() => navigate('/mdm/products')}>
            Back to product list
          </Button>
        </div>
      </div>
    );
  }

  const mutationError = createProduct.error ?? updateProduct.error;
  const isPending = createProduct.isPending || updateProduct.isPending;

  // ── Category toggle ───────────────────────────────────────────────────────
  function toggleCategory(catId: string) {
    setCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId],
    );
  }

  // ── Product detail for status ─────────────────────────────────────────────
  const product = productQuery.data;
  const isActive = product?.active ?? true;

  return (
    <div className="bg-surface min-h-full">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">

        {/* ── Page header ──────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-xs text-on-surface-variant">
              <a href="/mdm/products" className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm">
                Product Master
              </a>
              <ChevronRight className="h-3 w-3" aria-hidden />
              <span aria-current="page">
                {isEditMode ? 'Edit product' : 'New product'}
              </span>
            </nav>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-on-surface flex items-center gap-2">
              <Package className="h-6 w-6 text-on-surface-variant" aria-hidden />
              {isEditMode ? product?.name ?? 'Edit product' : 'New product'}
            </h1>
            {isEditMode && product ? (
              <p className="mt-1 text-sm text-on-surface-variant font-mono">
                SKU: {product.sku}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <DraftPill isDraft={isDirty} />
            {isEditMode && product ? (
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
        {showDeactivate && product ? (
          <Card className="mb-4 p-0 max-w-md">
            <DeactivateDialog
              productName={product.name}
              productId={product.id}
              onClose={() => setShowDeactivate(false)}
              onSuccess={() => { setShowDeactivate(false); navigate('/mdm/products'); }}
            />
          </Card>
        ) : null}

        <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }} noValidate>

          {/* ── Section 1: Identity ─────────────────────────────────────────── */}
          <Card className="p-0 mb-4">
            <div className="p-4 sm:p-6">
              <FormSectionHeader
                title="1 · Identity"
                subtitle="Product name, SKU, and classification type."
              />
            </div>
            <SectionShift tone="low" aria-hidden />
            <CardContent className="p-4 sm:p-6 flex flex-col gap-4">

              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="product-name" className="text-xs font-medium text-on-surface">
                  Product name <span className="text-error ml-0.5" aria-hidden>*</span>
                </label>
                <Input
                  id="product-name"
                  required
                  aria-required="true"
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? 'product-name-error' : undefined}
                  placeholder="e.g. Tomato Red"
                  {...register('name')}
                />
                <FieldError message={errors.name?.message} />

                {/* CC-DUPLICATE-WARN — DL-026 */}
                {similarQuery.isFetching && debouncedName.length >= 3 && (
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant" aria-live="polite">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Checking for duplicates…
                  </div>
                )}
                {showDuplicateWarn ? (
                  <CCDuplicateWarn
                    matches={(similarQuery.data ?? []).map((m) => ({
                      id: m.id,
                      name: m.name,
                      subtitle: m.sku ? `SKU: ${m.sku}` : undefined,
                      status: m.active === false ? 'inactive' : 'active',
                    }))}
                    onEditExisting={(matchId) => {
                      navigate(`/mdm/products/${matchId}/edit`);
                    }}
                    onProceedAnyway={() => setProceedAnyway(true)}
                  />
                ) : null}
              </div>

              {/* SKU */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="product-sku" className="text-xs font-medium text-on-surface">
                  SKU <span className="text-error ml-0.5" aria-hidden>*</span>
                </label>
                <Input
                  id="product-sku"
                  required
                  aria-required="true"
                  aria-invalid={Boolean(errors.sku)}
                  placeholder="e.g. VEG-TOM-RED-001"
                  {...register('sku')}
                />
                <FieldError message={errors.sku?.message} />
              </div>

              {/* Type */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="product-type" className="text-xs font-medium text-on-surface">
                  Type <span className="text-error ml-0.5" aria-hidden>*</span>
                </label>
                <div className="flex flex-col gap-2" role="radiogroup" aria-required="true" aria-labelledby="product-type-label">
                  <span id="product-type-label" className="sr-only">Product type</span>
                  {PRODUCT_TYPE_OPTIONS.map((opt) => {
                    const isSelected = watch('type') === opt.value;
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
                          value={opt.value}
                          aria-describedby={`type-desc-${opt.value}`}
                          className="mt-0.5 shrink-0 accent-primary"
                          {...register('type')}
                        />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium text-on-surface">{opt.label}</span>
                          <span id={`type-desc-${opt.value}`} className="text-[11px] text-on-surface-variant">
                            {opt.description}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <FieldError message={errors.type?.message} />
              </div>

            </CardContent>
          </Card>

          {/* ── Section 2: UOM (DL-023) ─────────────────────────────────────── */}
          <Card className="p-0 mb-4">
            <div className="p-4 sm:p-6">
              <FormSectionHeader
                title="2 · Units of Measure"
                subtitle="Default UOM and optional alternates. Exactly one row must be marked default."
              />
            </div>
            <SectionShift tone="low" aria-hidden />
            <CardContent className="p-4 sm:p-6 flex flex-col gap-4">

              {/* Default UOM picker */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="default-uom" className="text-xs font-medium text-on-surface">
                  Default UOM <span className="text-error ml-0.5" aria-hidden>*</span>
                </label>
                {uomsQuery.isLoading ? (
                  <div className="h-10 rounded-md bg-surface-container-high animate-pulse" />
                ) : (
                  <select
                    id="default-uom"
                    aria-required="true"
                    aria-invalid={Boolean(errors.defaultUomId)}
                    className={[
                      'h-10 w-full rounded-md px-3 text-sm text-on-surface',
                      'bg-surface-container-low',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      errors.defaultUomId ? 'aria-invalid:ring-2 aria-invalid:ring-error' : '',
                    ].join(' ')}
                    {...register('defaultUomId')}
                  >
                    <option value="">Select default UOM…</option>
                    {uomOptions.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.code} — {u.displayName} ({u.base})
                      </option>
                    ))}
                  </select>
                )}
                <FieldError message={errors.defaultUomId?.message} />
              </div>

              {/* Alternate UOM editor */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-on-surface">
                  Alternate UOM conversions
                </p>
                <UomEditor
                  productId={id}
                  rows={uomRows}
                  onRowsChange={setUomRows}
                  uomOptions={uomOptions}
                  defaultUomId={defaultUomId}
                  disabled={uomsQuery.isLoading}
                />
              </div>

            </CardContent>
          </Card>

          {/* ── Section 3: Yield + Shelf Life (FR3) ─────────────────────────── */}
          <Card className="p-0 mb-4">
            <div className="p-4 sm:p-6">
              <FormSectionHeader
                title="3 · Yield &amp; Shelf Life"
                subtitle="Standard yield factor (0.0000–1.9999) and shelf life in days."
              />
            </div>
            <SectionShift tone="low" aria-hidden />
            <CardContent className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">

              <div className="flex flex-col gap-1.5">
                <label htmlFor="yield-factor" className="text-xs font-medium text-on-surface">
                  Standard yield factor
                </label>
                <Input
                  id="yield-factor"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 0.9500"
                  aria-describedby="yield-factor-hint"
                  {...register('standardYieldFactor')}
                />
                <p id="yield-factor-hint" className="text-[11px] text-on-surface-variant">
                  Decimal between 0 and 1.9999. Defaults to 1.0000.
                </p>
                <FieldError message={errors.standardYieldFactor?.message} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="shelf-life" className="text-xs font-medium text-on-surface">
                  Shelf life (days)
                </label>
                <Input
                  id="shelf-life"
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 7"
                  aria-describedby="shelf-life-hint"
                  {...register('shelfLifeDays')}
                />
                <p id="shelf-life-hint" className="text-[11px] text-on-surface-variant">
                  Whole positive number. Leave blank if not applicable.
                </p>
                <FieldError message={errors.shelfLifeDays?.message} />
              </div>

            </CardContent>
          </Card>

          {/* ── Section 4: Categories ────────────────────────────────────────── */}
          <Card className="p-0 mb-4">
            <div className="p-4 sm:p-6">
              <FormSectionHeader
                title="4 · Categories"
                subtitle="Assign this product to one or more categories. Create or manage categories in Category Management."
              />
            </div>
            <SectionShift tone="low" aria-hidden />
            <CardContent className="p-4 sm:p-6 flex flex-col gap-3">

              <CategoryMultiSelect
                categoryIds={categoryIds}
                onToggle={toggleCategory}
                onClear={() => setCategoryIds([])}
              />

              {categoryIds.length > 0 ? (
                <div className="flex flex-wrap gap-1.5" aria-label="Selected categories">
                  {categoryIds.map((catId) => {
                    const cat = (categoriesQuery.data ?? []).find((c) => c.id === catId);
                    return (
                      <span
                        key={catId}
                        className="inline-flex items-center gap-1.5 rounded-pill bg-secondary-container px-2 py-0.5 text-[11px] font-medium text-on-secondary-container"
                      >
                        {cat?.name ?? catId.slice(0, 8) + '…'}
                        <button
                          type="button"
                          onClick={() => toggleCategory(catId)}
                          aria-label={`Remove category ${cat?.name ?? catId}`}
                          className="text-on-surface-variant hover:text-error focus-visible:outline-none"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant">
                  No categories selected — product will appear uncategorized.
                </p>
              )}

            </CardContent>
          </Card>

          {/* ── Section 5: Status ────────────────────────────────────────────── */}
          {isEditMode && product ? (
            <Card className="p-0 mb-6">
              <div className="p-4 sm:p-6">
                <FormSectionHeader
                  title="5 · Status"
                  subtitle="Deactivate this product to prevent it from being used in new transactions."
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
                      Deactivating removes this product from dropdowns and prevents new stock movements.
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
              onClick={() => navigate('/mdm/products')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              id="product-submit"
              disabled={isPending}
              aria-label={isPending ? 'Saving product…' : isEditMode ? 'Save changes' : 'Create product'}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden />
                  Saving…
                </>
              ) : isEditMode ? (
                'Save changes'
              ) : (
                'Create product'
              )}
            </Button>
          </div>

        </form>

      </div>
    </div>
  );
}

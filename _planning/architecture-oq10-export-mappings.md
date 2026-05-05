# OQ10 — Accountant Export Column-Mapping Specification

**Status:** RESOLVED (Phase 3a deliverable)
**Closes:** Master Spec §11 OQ10
**Implements:** PRD FR96 (Tally + Zoho Books + Generic CSV exports from MVP)
**Consumed by:** `exportService.generateExport(format, dateRange, type)` — see `architecture.md` §6.3 (service catalogue) and §17.10 (idempotency on the export-request endpoint).
**Phase 4 binding:** Epic 10 (Accounting & Financial). Renderers built per §6 below.

---

## 1. Purpose

PRD FR96 mandates that Finance Managers can generate six structured accountant-handoff exports — Transaction Journal, Purchase Register, Sales Register, Vendor AP Aging, Customer AR Aging, Food Cost — in three target formats simultaneously: Tally, Zoho Books, and Generic CSV. The format is selectable per export, defaults to a brand-level configured preference, and the choice is recorded in the export history log.

This document is the **column-name mapping specification** for those eighteen (3 formats × 6 export types) renderer outputs. It is the exact contract that:

- `exportService.generateExport` (`architecture.md` §6.3) reads from when emitting CSV / XML rows for each (format, type) pair on the pg-boss worker.
- The accountant on the receiving end imports against — once per format — and trusts that subsequent exports of the same format never silently change a column name without a `decision-log.md` entry and accountant notification (PRD FR96 contract).
- The Phase 4 Epic 10 implementation builds renderers from. The service architecture (§6.3) is format-agnostic: each format is a pluggable renderer over a single internal `ExportRow` domain object (defined in §2 below). Adding a fourth format post-MVP (e.g. QuickBooks, Xero) means adding a new renderer file — not changing the data layer.

This document does NOT specify:

- The Drizzle schema for `accounting_export_history` or `accounting_export_log` (Epic 10 deliverable, references the format chosen via the column constants below).
- The pg-boss worker wiring for `exportService.generateExport` (architecture.md §9.3 catalogue plus Epic 10 implementation).
- The signed-URL delivery flow (architecture.md §13 file storage; the export file lands in Supabase Storage and surfaces via signed URL when complete).

### 1.1 Source-research notes

- **Tally column / element names** below are based on TallyPrime's standard XML voucher import structure (`ENVELOPE > BODY > IMPORTDATA > REQUESTDATA > TALLYMESSAGE > VOUCHER` with child elements `DATE`, `VOUCHERTYPENAME`, `VOUCHERNUMBER`, `PARTYLEDGERNAME`, `NARRATION`, `AMOUNT`, `LEDGERENTRIES.LIST > LEDGERNAME / ISDEEMEDPOSITIVE / AMOUNT`, `COSTCENTREALLOCATIONS.LIST > COSTCENTRENAME / AMOUNT`) confirmed via Context7 (`/websites/help_tallysolutions_developer-reference`). The CSV column variants below mirror those XML element names with the standard `"Voucher Date"`, `"Voucher Type"`, `"Voucher Number"`, `"Particulars"`, `"Debit"`, `"Credit"`, `"Narration"`, `"Cost Centre"`, `"Place of Supply"` headers used by TallyPrime's Excel-import templates documented at help.tallysolutions.com. Where Context7 was thin on CSV-template specifics, columns reflect the Excel-import header conventions in TallyPrime's published import-template spreadsheets.
- **Zoho Books column names** below are based on Zoho Books' journal-import CSV template documented under the Journals module of the v3 API (`/websites/zoho_books_api_v3`) and the Zoho Books help-centre journal-import CSV template. Standard headers: `Journal Date`, `Journal Entry Number`, `Reference Number`, `Notes`, `Account`, `Description`, `Contact Name`, `Debit`, `Credit`, `Currency`, `Tax Name`, `Tax Percentage`. Zoho Books' API exposes Journals at `/books/v3/journals` with parallel field names; we target the import-CSV column names (the human-readable ones) since FR96 is a download-and-import pattern, not a live-API push (live API is a post-MVP renderer per Master Spec §6.6).
- **Generic CSV** columns are designed as opinionated, human-readable headers that any accounting tool's CSV mapper can target. They are the union of the most useful Tally + Zoho columns plus our own TRN as the primary key.
- This document does NOT attempt to be a comprehensive Tally / Zoho import reference — it is a mapping spec from our internal `ExportRow` shape to the columns each format expects. Where the target tool expects a column we cannot populate at MVP (e.g. Tally's `COSTCENTRENAME` requires a cost-centre master that depends on Epic 11 HRMS), we mark the column as "deferred" with the activation condition stated.

---

## 2. Data layer (format-agnostic)

The `exportService` worker assembles a stream of internal `ExportRow` objects per export type, then passes the stream to the format renderer. The renderer never queries Postgres directly — it consumes `ExportRow` and writes its target format's columns.

```typescript
// packages/shared/src/types/export.ts (Phase 4 Epic 10)
//
// Internal export domain model. Every renderer (Tally, Zoho Books, Generic CSV,
// future QuickBooks, future live-API push) consumes this shape and emits its
// target format. The shape is brand-scoped — every ExportRow stream is
// produced by an exportService call already bound to a brandedDb (DL-012,
// architecture.md §6.1) so the brand_id is implicit on every row.

interface ExportRow {
  // === Primary key ===
  trn: string;                          // e.g. "PO-2026-BRD-000123"; immutable per Master Spec §6.2
  trnType: TransactionType;             // 'PO' | 'GR' | 'ST' | 'PR' | 'DC' | 'WO' | 'SA' | 'CN' | 'JV' | 'ADJ'

  // === Header ===
  date: string;                         // ISO 8601 'YYYY-MM-DD'; the transaction's economic date
  postingDate: string;                  // ISO 8601 'YYYY-MM-DD'; the journal-entry posting date (often === date)
  narration: string;                    // free-text description; max 500 chars

  // === Org-scoped location context ===
  // brand_id is implicit (the entire export is brand-scoped — exportService is
  // invoked through a brandedDb, architecture.md §4.2 / DL-012). brand metadata
  // surfaces via the brand.name column emitted on every row for accountant
  // attribution when one accountant handles multiple brands.
  brand:    { id: string; name: string; gstin: string | null; };
  location: { code: string; name: string; cluster: string | null; department: string | null; };

  // === Counter-party (one of) ===
  parties: {
    vendor?:   { id: string; name: string; gstin: string | null; ledgerCode: string | null; };
    customer?: { id: string; name: string; gstin: string | null; ledgerCode: string | null; };
    employee?: { id: string; name: string; };  // wastage-write-off / adjustment author
  };

  // === Lines (for line-itemized exports — PR / SR / Food Cost) ===
  lines: ExportLine[];

  // === Compliance placeholders (Master Spec §6.5; nullable; never block export) ===
  compliance: {
    gst?: {
      placeOfSupply: string | null;     // 2-digit state code; null for B2C / non-GST
      hsnCode: string | null;
      taxRatePercent: number | null;    // 0 | 5 | 12 | 18 | 28
      cgstAmount: number | null;
      sgstAmount: number | null;
      igstAmount: number | null;
    };
    irn?:  { number: string | null; generatedAt: string | null; cancelled: boolean; };
    eway?: { number: string | null; validityDate: string | null; vehicleNumber: string | null; };
    tds?:  { applicable: boolean; section: string | null; ratePercent: number | null; amount: number | null; };
  };

  // === Money totals (always populated; in INR — Master Spec §6.1 baseline) ===
  totals: {
    subtotal: number;                   // pre-tax amount in INR (2dp)
    taxes: number;                      // CGST + SGST + IGST in INR (2dp); 0 if no GST
    total: number;                      // subtotal + taxes
    currency: 'INR';                    // post-MVP: extend to multi-currency (see §7.5)
  };

  // === Provenance ===
  metadata: {
    createdBy:   { userId: string; userName: string; };
    createdAt:   string;                // ISO 8601 timestamptz
    lastUpdated: string;                // ISO 8601 timestamptz; per `audit_log` (architecture.md §7)
    sourceUrl:   string;                // deep link back to ERP screen, e.g. "/purchase-orders/PO-2026-BRD-000123"
  };
}

interface ExportLine {
  lineNumber: number;                   // 1-based
  itemCode: string;                     // SKU / item master code
  itemName: string;
  itemCategoryLedger: string | null;    // mapped CoA expense ledger (e.g. "Raw Material — Vegetables")
  quantity: number;
  unit: string;                         // 'kg' | 'L' | 'pcs' | etc.
  unitPrice: number;                    // INR (2dp)
  lineSubtotal: number;                 // quantity × unitPrice
  lineTax: number;                      // CGST+SGST+IGST allocated to this line
  lineTotal: number;                    // lineSubtotal + lineTax
}

type TransactionType =
  | 'PO' | 'GR' | 'ST' | 'PR' | 'DC' | 'WO' | 'SA' | 'CN' | 'JV' | 'ADJ';
```

Notes on the model:

- **`brand_id` is implicit** in every `ExportRow` because the entire export job is a brandedDb-scoped invocation (architecture.md §4.2 / DL-012). The renderer emits `brand.name` and `brand.gstin` as visible columns for the accountant; it does not emit a raw `brand_id` UUID.
- The `compliance.*` blocks are all optional. Per Master Spec §6.5, every placeholder field is nullable and the system never fails if empty. Renderers MUST emit blank cells (not the literal string `null`) when the field is null.
- `totals.currency` is hard-coded `'INR'` for MVP. The field exists to absorb multi-currency post-MVP without a schema change (§7.5).
- `metadata.sourceUrl` is a deep link the accountant can click in the ERP web UI when an export row needs investigation. Generic CSV renders it as a column; Tally and Zoho Books renderers omit it (target tools do not display arbitrary hyperlink columns) but log it to the export-history record for debug.

---

## 3. Tally format

Tally accepts both XML (via TallyPrime's HTTP gateway, port 9000) and Excel/CSV import templates. PRD FR96 specifies "Tally-compatible XML or CSV with column names and field mappings matching TallyPrime import specifications." For MVP we render **CSV** for all six exports (the import-template format Tally accountants use day-to-day). The XML variant is a post-MVP renderer for the live-API push path (Master Spec §6.6).

The CSV columns below mirror TallyPrime's standard import-template headers. Each table maps `Tally column name → ExportRow path → format / transformation rule`.

Common Tally conventions that hold across all six tables:

- **Date format:** `DD-MMM-YYYY` (e.g. `15-Mar-2026`). Tally rejects ISO `YYYY-MM-DD`.
- **Voucher Type** values are pre-seeded into the brand's TallyPrime company. Mapping: `PO → "Purchase"`, `GR → "Receipt Note"`, `SA → "Sales"`, `CN → "Credit Note"`, `JV → "Journal"`, `ADJ → "Stock Journal"`, `PR → "Manufacturing Journal"`, `DC → "Delivery Note"`, `ST → "Stock Journal"`, `WO → "Stock Journal"`.
- **Particulars** is Tally's term for "the ledger this debit / credit posts to." For each ExportRow we emit one or more rows in the CSV — one for the party ledger and one (or many) for the contra ledgers. See §7.1 for the multi-line resolution.
- **Place of Supply** uses Tally's two-digit state-code convention (same as the GST portal: `27` = Maharashtra, `29` = Karnataka, etc.).
- **Cost Centre** column is reserved across all tables. Populated post-MVP from `location.department.cost_center` once Epic 11 HRMS adds cost-centre to the department master. For MVP, the column is emitted as a blank cell — Tally accepts blank Cost Centre and routes the entry to the default unallocated bucket.

### 3.1 Tally — Transaction Journal export

The most general export — every confirmed financial transaction in the date range, one row per ledger leg. Used for full ERP-to-Tally journal synchronization. Multi-line journals expand into multiple rows (one per debit / credit leg) sharing a Voucher Number — see §7.1.

| Tally CSV column | ExportRow path | Format / transformation rule |
|---|---|---|
| `Voucher Date` | `date` | ISO `YYYY-MM-DD` → `DD-MMM-YYYY` (e.g. `15-Mar-2026`). |
| `Voucher Type` | `trnType` | Mapped per the Common-conventions table above (`PO → "Purchase"`, `SA → "Sales"`, etc.). |
| `Voucher Number` | `trn` | Emitted verbatim; Tally accepts our TRN string as the voucher number (immutable per Master Spec §6.2). |
| `Reference Number` | `trn` | Same value as Voucher Number; Tally uses Reference for cross-document linking. |
| `Particulars` | derived from `parties.{vendor,customer,employee}.ledgerCode` for the party leg, and `lines[].itemCategoryLedger` (or a single mapped ledger from accountingService's chart-of-accounts mapping table) for each contra leg. | One CSV row per ledger leg. See §7.1. |
| `Debit` | derived | Decimal; populated when this leg is a debit. Empty when credit. Decimal precision: 2. |
| `Credit` | derived | Decimal; populated when this leg is a credit. Empty when debit. Decimal precision: 2. |
| `Narration` | `narration` | Truncated to 500 chars; quote-escape internal commas / quotes per CSV. |
| `Cost Centre` | `location.department` | **Deferred** — populate from `location.department.cost_center` once Epic 11 HRMS adds cost-centre to dept master. MVP emits blank. |
| `Place of Supply` | `compliance.gst.placeOfSupply` | Two-digit state code; blank for non-GST or B2C transactions. |
| `GSTIN/UIN` | for vendor leg → `parties.vendor.gstin`; for customer leg → `parties.customer.gstin` | Blank when null. |
| `Brand Name` | `brand.name` | Constant per export run; emitted on every row for accountant attribution. |
| `Location Code` | `location.code` | Free-text code (the brand's chosen location identifier). |

### 3.2 Tally — Purchase Register export

One row per purchase-document line (PO + GR pair, line-itemized). Used by the accountant to reconcile vendor invoices and post AP journal entries.

| Tally CSV column | ExportRow path | Format / transformation rule |
|---|---|---|
| `Voucher Date` | `date` | `DD-MMM-YYYY`. |
| `Voucher Type` | `trnType` | `"Purchase"` for `PO`/`GR`; `"Credit Note"` for `CN` of vendor type. |
| `Voucher Number` | `trn` | Verbatim ERP TRN. |
| `Supplier Invoice Number` | `metadata.sourceUrl`-extracted vendor-invoice-number field via Epic 7 GR fields | Deferred to Epic 7; in MVP emitted as the GR's TRN. |
| `Supplier Invoice Date` | `date` | `DD-MMM-YYYY`. |
| `Party's A/c Name` | `parties.vendor.name` | Verbatim; vendor-master-canonical name. |
| `GSTIN/UIN of Party` | `parties.vendor.gstin` | Blank when null. |
| `Place of Supply` | `compliance.gst.placeOfSupply` | Two-digit state code. |
| `Item Name` | `lines[].itemName` | One row per line. |
| `HSN/SAC` | `compliance.gst.hsnCode` | Placeholder per Master Spec §6.5; blank if unset. |
| `Quantity` | `lines[].quantity` | Decimal; precision per item's UoM. |
| `Unit` | `lines[].unit` | Free text (e.g. `kg`). |
| `Rate` | `lines[].unitPrice` | Decimal precision 2. |
| `Amount` (taxable value) | `lines[].lineSubtotal` | Decimal precision 2. |
| `CGST Amount` | `compliance.gst.cgstAmount` × line proportion | See §7.1 for line-proportion allocation. |
| `SGST Amount` | `compliance.gst.sgstAmount` × line proportion | Same. |
| `IGST Amount` | `compliance.gst.igstAmount` × line proportion | Blank if intra-state. |
| `Tax Rate` | `compliance.gst.taxRatePercent` | Integer / decimal. |
| `Total` | `lines[].lineTotal` | `lineSubtotal + lineTax`. |
| `Narration` | `narration` | 500-char limit. |
| `Cost Centre` | deferred | Same as §3.1 — Epic 11 dependency. |

### 3.3 Tally — Sales Register export

One row per sales-document line. Covers POS daily-summary aggregations (`SA-...`) and B2B Dispatch Challan invoices (`DC-...`). Mirrors Purchase Register column structure with the party flipped to customer.

| Tally CSV column | ExportRow path | Format / transformation rule |
|---|---|---|
| `Voucher Date` | `date` | `DD-MMM-YYYY`. |
| `Voucher Type` | `trnType` | `"Sales"` for `SA`/`DC`; `"Credit Note"` for customer-side `CN`. |
| `Voucher Number` | `trn` | Verbatim. |
| `Reference Number` | `trn` | Same as Voucher Number. |
| `Buyer's Name` | `parties.customer.name` | For `SA-` POS daily summaries customer is `"Walk-in B2C"` constant. |
| `Buyer's GSTIN/UIN` | `parties.customer.gstin` | Blank for B2C. |
| `Place of Supply` | `compliance.gst.placeOfSupply` | Two-digit state code; blank for B2C intra-state pure-cash. |
| `Item Name` | `lines[].itemName` | One row per line. |
| `HSN/SAC` | `compliance.gst.hsnCode` | Placeholder per Master Spec §6.5; blank if unset. |
| `Quantity` | `lines[].quantity` | Decimal. |
| `Unit` | `lines[].unit` | Free text. |
| `Rate` | `lines[].unitPrice` | Decimal precision 2. |
| `Amount` (taxable value) | `lines[].lineSubtotal` | Decimal precision 2. |
| `CGST Amount` | line-proportion of `compliance.gst.cgstAmount` | See §7.1. |
| `SGST Amount` | line-proportion of `compliance.gst.sgstAmount` | Same. |
| `IGST Amount` | line-proportion of `compliance.gst.igstAmount` | Blank if intra-state. |
| `Tax Rate` | `compliance.gst.taxRatePercent` | Integer / decimal. |
| `Invoice Total` | `totals.total` | Header total; emitted on first line, blank on subsequent lines per Tally Sales-template convention. |
| `IRN` | `compliance.irn.number` | Placeholder per Master Spec §6.5; 64-char hash; blank if unset. |
| `Narration` | `narration` | 500-char limit. |
| `Cost Centre` | deferred | Epic 11. |

### 3.4 Tally — Vendor AP Aging export

Vendor-wise outstanding payables with aging buckets. Per FR96: keyed on TRN of the originating PO/GR. **Not a journal-import file** — this is an analytical report Tally accountants use to validate AP reconciliation against their own books. Renders as CSV (no XML push variant since aging is reporting, not posting).

| Tally CSV column | ExportRow path / aggregation | Format / transformation rule |
|---|---|---|
| `Vendor Name` | `parties.vendor.name` | One row per outstanding (TRN, vendor) pair. |
| `Vendor GSTIN` | `parties.vendor.gstin` | Blank when null. |
| `Vendor Ledger Code` | `parties.vendor.ledgerCode` | Mapped from vendor master's `tally_ledger_code` field; blank if unmapped (warn on validation §8). |
| `Bill Number` (TRN) | `trn` | The originating PO or GR TRN. |
| `Bill Date` | `date` | `DD-MMM-YYYY`. |
| `Due Date` | derived from `date + vendor.payment_terms_days` | `DD-MMM-YYYY`; computed at export time. |
| `Bill Amount` | `totals.total` | Decimal precision 2. |
| `Paid Amount` | aggregated from `vendor_payments` table by TRN | Decimal precision 2; 0 if unpaid. |
| `Outstanding` | `totals.total − paidAmount` | Decimal precision 2. |
| `Days Outstanding` | `today − date` | Integer. |
| `0–30 Days` | bucket | Outstanding amount if `daysOutstanding ≤ 30`, else 0. |
| `31–60 Days` | bucket | Outstanding amount if `31 ≤ daysOutstanding ≤ 60`, else 0. |
| `61–90 Days` | bucket | Outstanding amount if `61 ≤ daysOutstanding ≤ 90`, else 0. |
| `90+ Days` | bucket | Outstanding amount if `daysOutstanding > 90`, else 0. |
| `Place of Supply` | `compliance.gst.placeOfSupply` | Two-digit state code. |
| `Brand Name` | `brand.name` | Constant per export. |

### 3.5 Tally — Customer AR Aging export

B2B customer-wise outstanding receivables. Keyed on Dispatch Challan TRN per FR96. Mirrors AP Aging column structure with the party flipped to customer.

| Tally CSV column | ExportRow path / aggregation | Format / transformation rule |
|---|---|---|
| `Customer Name` | `parties.customer.name` | One row per outstanding (DC TRN, customer) pair. |
| `Customer GSTIN` | `parties.customer.gstin` | Blank for non-GST B2B (rare). |
| `Customer Ledger Code` | `parties.customer.ledgerCode` | Mapped from customer master's `tally_ledger_code`; blank if unmapped. |
| `Invoice Number` (DC TRN) | `trn` | Dispatch Challan TRN. |
| `Invoice Date` | `date` | `DD-MMM-YYYY`. |
| `Due Date` | derived from `date + customer.credit_terms_days` | `DD-MMM-YYYY`. |
| `Invoice Amount` | `totals.total` | Decimal precision 2. |
| `Received Amount` | aggregated from B2B receipts by DC TRN | 0 if unpaid. |
| `Outstanding` | `totals.total − receivedAmount` | Decimal precision 2. |
| `Days Outstanding` | `today − date` | Integer. |
| `0–30 Days` | bucket | Outstanding if ≤ 30 days, else 0. |
| `31–60 Days` | bucket | Outstanding if 31–60 days, else 0. |
| `61–90 Days` | bucket | Outstanding if 61–90 days, else 0. |
| `90+ Days` | bucket | Outstanding if > 90 days, else 0. |
| `Place of Supply` | `compliance.gst.placeOfSupply` | Two-digit state code. |
| `Brand Name` | `brand.name` | Constant. |

### 3.6 Tally — Food Cost export

Theoretical-vs-actual food cost per item (Master Spec §6.3 "Food Cost Control Centre"). Cross-module — bridges recipe, inventory, and sales. Tally has no native "food cost" voucher type; this export is consumed as a cost-analysis adjunct, not imported as journal entries. The CSV header set is opinionated for accountants who paste into TallyPrime's "Stock Item" or "Cost Centre" analysis screens.

| Tally CSV column | ExportRow path / aggregation | Format / transformation rule |
|---|---|---|
| `Period Start` | export's date-range start | `DD-MMM-YYYY`. |
| `Period End` | export's date-range end | `DD-MMM-YYYY`. |
| `Stock Item Name` | `lines[].itemName` | One row per (period, item) pair. |
| `Stock Item Code` | `lines[].itemCode` | SKU code. |
| `Theoretical Cost` | computed from `recipe_cost_snapshot` × sales quantity | Decimal precision 2. Snapshot populated per architecture.md §6.3 / DL-008 carve-out. |
| `Actual Cost` | computed from FIFO/FEFO-deducted batches at deduction-time price | Decimal precision 2. |
| `Variance` | `actualCost − theoreticalCost` | Decimal precision 2; sign-preserved. |
| `Variance %` | `variance / theoreticalCost × 100` | Decimal precision 2; 0 if theoreticalCost is 0. |
| `Quantity Sold` | aggregated from `SA-` summaries | Decimal. |
| `Unit` | `lines[].unit` | Free text. |
| `Cost Centre` | `location.department` | Deferred — Epic 11 dependency. |
| `Brand Name` | `brand.name` | Constant. |
| `Location Code` | `location.code` | Free text. |

---

## 4. Zoho Books format

Zoho Books accepts journal entries via either the v3 REST API (`POST /books/v3/journals`) or a CSV journal-import template. Per the Master Spec §6.6 post-MVP upgrade path, **MVP renders CSV**; live REST API push is the post-MVP renderer that swaps in once the launch customer confirms Zoho Books and we ship the OAuth + API integration. The CSV columns below mirror Zoho Books' published journal-import template headers (Journals module, Zoho Books help-centre — confirmed in Context7's `/websites/zoho_books_api_v3` for the API field-name parallel).

Common Zoho Books conventions that hold across all six tables:

- **Date format:** ISO `YYYY-MM-DD`. Zoho Books accepts ISO directly — no transformation needed from `ExportRow.date`.
- **Account** column is Zoho Books' equivalent of Tally's "Particulars" / "Ledger Name". The accountant pre-creates accounts in Zoho Books matching our chart-of-accounts ledger codes; the renderer emits the mapped account name (not the internal account ID — the CSV import resolves names to IDs).
- **Currency** column is required by Zoho Books even for INR-only books; emit `"INR"` constant.
- **Tax Name** / **Tax Percentage** populate when GST is applicable. For zero-tax / B2C-without-GST rows, both columns are blank.
- **Notes** is Zoho Books' freeform field — equivalent to Tally's `Narration`. Same 500-char truncation policy.
- **Reference Number** is the cross-document identifier — we always emit our TRN here so the accountant can search Zoho Books by TRN and find the originating ERP document.

### 4.1 Zoho Books — Transaction Journal export

Multi-line journal entries — Zoho Books' import expects one row per debit/credit leg with a shared `Journal Entry Number`. Behaves more like Tally's expansion than the line-itemized Sales/Purchase registers. See §7.1.

| Zoho Books CSV column | ExportRow path | Format / transformation rule |
|---|---|---|
| `Journal Date` | `date` | ISO `YYYY-MM-DD`. |
| `Journal Entry Number` | `trn` | Verbatim ERP TRN — Zoho Books accepts string entry numbers. |
| `Reference Number` | `trn` | Same as Journal Entry Number. |
| `Notes` | `narration` | 500-char limit. |
| `Account` | for party leg → mapped from `parties.{vendor,customer}.ledgerCode`; for contra legs → from `lines[].itemCategoryLedger` or accountingService chart-of-accounts mapping table | One row per leg. See §7.1. |
| `Description` | `lines[].itemName` for line legs; party name for the party leg | Per-row freeform; truncate to 250. |
| `Contact Name` | `parties.vendor.name` ?? `parties.customer.name` ?? `parties.employee.name` ?? blank | Single value per export row; Zoho's "contact" lookup. |
| `Debit` | derived | Decimal precision 2; empty when credit. |
| `Credit` | derived | Decimal precision 2; empty when debit. |
| `Currency` | `totals.currency` | Constant `"INR"` for MVP. |
| `Tax Name` | mapped from `compliance.gst.taxRatePercent` | E.g. `"GST 18%"`; blank if GST not applicable. |
| `Tax Percentage` | `compliance.gst.taxRatePercent` | Blank if not applicable. |
| `Place of Supply` | `compliance.gst.placeOfSupply` | Two-digit state code; blank if non-GST. |
| `Branch Name` | `location.name` | Maps to Zoho Books' Branch feature; blank if branches not enabled in target Zoho org. |

### 4.2 Zoho Books — Purchase Register export

Imports as Bills via Zoho Books' Bill-import CSV template (a sibling of the journal-import). One row per bill line.

| Zoho Books CSV column | ExportRow path | Format / transformation rule |
|---|---|---|
| `Bill Date` | `date` | ISO `YYYY-MM-DD`. |
| `Bill Number` | `trn` | Verbatim. |
| `Vendor Name` | `parties.vendor.name` | Vendor master canonical name. |
| `Vendor GSTIN` | `parties.vendor.gstin` | Blank when null. |
| `Reference Number` | `trn` | Same. |
| `Place of Supply` | `compliance.gst.placeOfSupply` | Two-digit state code. |
| `Item Name` | `lines[].itemName` | One row per line. |
| `HSN/SAC` | `compliance.gst.hsnCode` | Placeholder per Master Spec §6.5; blank if unset. |
| `Quantity` | `lines[].quantity` | Decimal. |
| `Unit` | `lines[].unit` | Free text. |
| `Rate` | `lines[].unitPrice` | Decimal precision 2. |
| `Item Total` | `lines[].lineSubtotal` | Decimal precision 2. |
| `Tax Name` | mapped from `compliance.gst.taxRatePercent` | E.g. `"GST 18%"`. |
| `Tax Percentage` | `compliance.gst.taxRatePercent` | Decimal. |
| `Tax Amount` | `lines[].lineTax` | Decimal precision 2. |
| `Currency` | `totals.currency` | `"INR"`. |
| `Notes` | `narration` | 500-char limit. |
| `Branch Name` | `location.name` | Branch feature; blank if not enabled. |

### 4.3 Zoho Books — Sales Register export

Imports as Invoices via Zoho Books' Invoice-import CSV template. Mirrors the Bill-import column structure with party flipped.

| Zoho Books CSV column | ExportRow path | Format / transformation rule |
|---|---|---|
| `Invoice Date` | `date` | ISO `YYYY-MM-DD`. |
| `Invoice Number` | `trn` | Verbatim — DC TRN for B2B; SA TRN for POS daily summary. |
| `Customer Name` | `parties.customer.name` | For B2C POS summaries → `"Walk-in B2C"` constant. |
| `Customer GSTIN` | `parties.customer.gstin` | Blank for B2C. |
| `Reference Number` | `trn` | Same. |
| `Place of Supply` | `compliance.gst.placeOfSupply` | Two-digit state code; blank if non-GST. |
| `Item Name` | `lines[].itemName` | One row per line. |
| `HSN/SAC` | `compliance.gst.hsnCode` | Placeholder per Master Spec §6.5. |
| `Quantity` | `lines[].quantity` | Decimal. |
| `Unit` | `lines[].unit` | Free text. |
| `Rate` | `lines[].unitPrice` | Decimal precision 2. |
| `Item Total` | `lines[].lineSubtotal` | Decimal precision 2. |
| `Tax Name` | derived from `compliance.gst.taxRatePercent` | `"GST 18%"`, etc. |
| `Tax Percentage` | `compliance.gst.taxRatePercent` | Decimal. |
| `Tax Amount` | `lines[].lineTax` | Decimal precision 2. |
| `IRN` | `compliance.irn.number` | Placeholder per Master Spec §6.5; blank if unset. Zoho Books has a custom field for IRN; the column header MUST be the exact custom-field name configured in target Zoho org (default: `IRN`). |
| `Currency` | `totals.currency` | `"INR"`. |
| `Notes` | `narration` | 500-char limit. |
| `Branch Name` | `location.name` | Branch feature. |

### 4.4 Zoho Books — Vendor AP Aging export

Zoho Books exposes its own AP aging report internally, so an *imported* Aging file is unusual. This export is therefore a CSV the accountant uses to **reconcile** Zoho Books' own report against the ERP source-of-truth — not a CSV they import. Column header set is opinionated for that reconciliation use-case.

| Zoho Books CSV column | ExportRow path / aggregation | Format / transformation rule |
|---|---|---|
| `Vendor Name` | `parties.vendor.name` | One row per outstanding (TRN, vendor) pair. |
| `Vendor GSTIN` | `parties.vendor.gstin` | Blank when null. |
| `Vendor Account Code` | `parties.vendor.ledgerCode` | Mapped from vendor master's `zoho_account_code` field (mirror of Tally's `tally_ledger_code`); blank if unmapped (warn on validation §8). |
| `Bill Number` | `trn` | Originating PO/GR TRN. |
| `Bill Date` | `date` | ISO `YYYY-MM-DD`. |
| `Due Date` | derived from `date + vendor.payment_terms_days` | ISO `YYYY-MM-DD`. |
| `Bill Amount` | `totals.total` | Decimal precision 2. |
| `Paid Amount` | aggregated from `vendor_payments` by TRN | 0 if unpaid. |
| `Outstanding Amount` | `totals.total − paidAmount` | Decimal precision 2. |
| `Days Outstanding` | `today − date` | Integer. |
| `0–30 Days` | bucket | Outstanding if ≤ 30, else 0. |
| `31–60 Days` | bucket | Outstanding if 31–60, else 0. |
| `61–90 Days` | bucket | Outstanding if 61–90, else 0. |
| `90+ Days` | bucket | Outstanding if > 90, else 0. |
| `Currency` | `totals.currency` | `"INR"`. |
| `Branch Name` | `location.name` | Optional. |

### 4.5 Zoho Books — Customer AR Aging export

Mirror of §4.4 with the party flipped to customer. Same reconciliation use-case.

| Zoho Books CSV column | ExportRow path / aggregation | Format / transformation rule |
|---|---|---|
| `Customer Name` | `parties.customer.name` | One row per (DC TRN, customer) outstanding pair. |
| `Customer GSTIN` | `parties.customer.gstin` | Blank if non-GST. |
| `Customer Account Code` | `parties.customer.ledgerCode` | Mapped from customer master's `zoho_account_code`; blank if unmapped. |
| `Invoice Number` | `trn` | DC TRN. |
| `Invoice Date` | `date` | ISO. |
| `Due Date` | derived from `date + customer.credit_terms_days` | ISO. |
| `Invoice Amount` | `totals.total` | Decimal precision 2. |
| `Received Amount` | aggregated from B2B receipts by DC TRN | 0 if unpaid. |
| `Outstanding Amount` | `totals.total − receivedAmount` | Decimal precision 2. |
| `Days Outstanding` | `today − date` | Integer. |
| `0–30 Days` | bucket | Outstanding if ≤ 30. |
| `31–60 Days` | bucket | Outstanding if 31–60. |
| `61–90 Days` | bucket | Outstanding if 61–90. |
| `90+ Days` | bucket | Outstanding if > 90. |
| `Currency` | `totals.currency` | `"INR"`. |
| `Branch Name` | `location.name` | Optional. |

### 4.6 Zoho Books — Food Cost export

Zoho Books has no native Food Cost voucher / report type, so this is an analytical CSV — same use-case as §3.6. Column set is opinionated.

| Zoho Books CSV column | ExportRow path / aggregation | Format / transformation rule |
|---|---|---|
| `Period Start` | export date-range start | ISO `YYYY-MM-DD`. |
| `Period End` | export date-range end | ISO `YYYY-MM-DD`. |
| `Item Name` | `lines[].itemName` | One row per (period, item) pair. |
| `Item Code` | `lines[].itemCode` | SKU code. |
| `Theoretical Cost` | computed from `recipe_cost_snapshot` × quantity sold | Decimal precision 2. |
| `Actual Cost` | computed from FEFO-deducted batches at deduction-time price | Decimal precision 2. |
| `Variance` | `actualCost − theoreticalCost` | Decimal precision 2; sign-preserved. |
| `Variance %` | `variance / theoreticalCost × 100` | Decimal precision 2; 0 if denom is 0. |
| `Quantity Sold` | aggregated `SA-` summaries | Decimal. |
| `Unit` | `lines[].unit` | Free text. |
| `Branch Name` | `location.name` | Optional. |
| `Currency` | `totals.currency` | `"INR"`. |

---

## 5. Generic CSV format

The Generic CSV format is an opinionated, human-readable column set designed to be importable by any accounting tool with a CSV mapper (QuickBooks, Xero, Marg, BUSY, etc.) and also useful for ad-hoc analysis in Excel / Google Sheets. Column names are full English phrases (no Tally / Zoho-specific shorthand).

Common Generic CSV conventions:

- **Date format:** ISO `YYYY-MM-DD`. The most portable choice.
- **TRN** is the leftmost column on every export — the primary key the accountant searches by.
- **Currency** column is always present; constant `"INR"` for MVP.
- Numeric precision: 2 decimal places for INR amounts; integer for `days_outstanding`; original precision (matching the item's unit) for `quantity`.
- All amount columns are positive numbers; sign convention is conveyed by separate `transaction_type` and `entry_side` columns rather than negative numbers (see §7.4 for refunds).
- Unlike Tally and Zoho Books, the Generic CSV emits the deep-link `Source URL` column directly — the user can paste the file into a spreadsheet and click through to the originating ERP screen.

### 5.1 Generic CSV — Transaction Journal export

| Generic CSV column | ExportRow path | Format / transformation rule |
|---|---|---|
| `TRN` | `trn` | Verbatim. |
| `Transaction Type` | `trnType` | Long form: `"Purchase Order"`, `"Goods Receipt"`, `"Sales"`, etc. (full English, not the 2-letter prefix). |
| `Date` | `date` | ISO `YYYY-MM-DD`. |
| `Posting Date` | `postingDate` | ISO `YYYY-MM-DD`. |
| `Brand` | `brand.name` | Verbatim. |
| `Brand GSTIN` | `brand.gstin` | Blank when null. |
| `Location Code` | `location.code` | Free text. |
| `Location Name` | `location.name` | Verbatim. |
| `Cluster` | `location.cluster` | Blank if not in a cluster. |
| `Department` | `location.department` | Blank if not department-scoped. |
| `Counter-party Type` | derived | One of `"Vendor"`, `"Customer"`, `"Employee"`, `"Internal"`. |
| `Counter-party Name` | `parties.vendor.name` ?? `parties.customer.name` ?? `parties.employee.name` ?? `"Internal"` | Blank only on internal-only entries (e.g. ADJ). |
| `Counter-party GSTIN` | `parties.vendor.gstin` ?? `parties.customer.gstin` ?? blank | Blank when null. |
| `Subtotal (INR)` | `totals.subtotal` | Decimal precision 2. |
| `Tax (INR)` | `totals.taxes` | Decimal precision 2. |
| `Total (INR)` | `totals.total` | Decimal precision 2. |
| `Currency` | `totals.currency` | `"INR"`. |
| `GST Place of Supply` | `compliance.gst.placeOfSupply` | Two-digit state code; blank if non-GST. |
| `IRN` | `compliance.irn.number` | Placeholder per Master Spec §6.5; blank if unset. |
| `E-Way Bill Number` | `compliance.eway.number` | Placeholder per Master Spec §6.5; blank if unset. |
| `Narration` | `narration` | 500-char limit. |
| `Created By` | `metadata.createdBy.userName` | Verbatim. |
| `Created At` | `metadata.createdAt` | ISO 8601 timestamptz. |
| `Source URL` | `metadata.sourceUrl` | Deep link back to ERP screen. |

### 5.2 Generic CSV — Purchase Register export

| Generic CSV column | ExportRow path | Format / transformation rule |
|---|---|---|
| `TRN` | `trn` | Verbatim. |
| `Date` | `date` | ISO. |
| `Vendor Name` | `parties.vendor.name` | Verbatim. |
| `Vendor GSTIN` | `parties.vendor.gstin` | Blank when null. |
| `Vendor Ledger Code` | `parties.vendor.ledgerCode` | Blank if unmapped. |
| `Brand` | `brand.name` | Constant per export. |
| `Location Code` | `location.code` | Free text. |
| `Line Number` | `lines[].lineNumber` | 1-based; one row per line. |
| `Item Code` | `lines[].itemCode` | SKU. |
| `Item Name` | `lines[].itemName` | Verbatim. |
| `Item Category Ledger` | `lines[].itemCategoryLedger` | Mapped CoA expense ledger. |
| `HSN/SAC` | `compliance.gst.hsnCode` | Placeholder per Master Spec §6.5; blank if unset. |
| `Quantity` | `lines[].quantity` | Decimal per UoM. |
| `Unit` | `lines[].unit` | Free text. |
| `Unit Price (INR)` | `lines[].unitPrice` | Decimal precision 2. |
| `Line Subtotal (INR)` | `lines[].lineSubtotal` | Decimal precision 2. |
| `Tax Rate %` | `compliance.gst.taxRatePercent` | Integer / decimal. |
| `CGST (INR)` | line-proportion of `compliance.gst.cgstAmount` | Per §7.1 allocation. |
| `SGST (INR)` | line-proportion of `compliance.gst.sgstAmount` | Same. |
| `IGST (INR)` | line-proportion of `compliance.gst.igstAmount` | Blank if intra-state. |
| `Line Total (INR)` | `lines[].lineTotal` | Decimal precision 2. |
| `Place of Supply` | `compliance.gst.placeOfSupply` | Two-digit state code. |
| `Source URL` | `metadata.sourceUrl` | Deep link. |
| `Narration` | `narration` | 500-char limit. |

### 5.3 Generic CSV — Sales Register export

Mirror of §5.2 with party flipped to customer.

| Generic CSV column | ExportRow path | Format / transformation rule |
|---|---|---|
| `TRN` | `trn` | Verbatim — DC for B2B / SA for POS daily summary. |
| `Date` | `date` | ISO. |
| `Customer Name` | `parties.customer.name` | `"Walk-in B2C"` constant for POS summaries. |
| `Customer GSTIN` | `parties.customer.gstin` | Blank for B2C. |
| `Customer Ledger Code` | `parties.customer.ledgerCode` | Blank if unmapped. |
| `Brand` | `brand.name` | Constant. |
| `Location Code` | `location.code` | Free text. |
| `Line Number` | `lines[].lineNumber` | 1-based. |
| `Item Code` | `lines[].itemCode` | SKU. |
| `Item Name` | `lines[].itemName` | Verbatim. |
| `Item Category Ledger` | `lines[].itemCategoryLedger` | CoA revenue ledger. |
| `HSN/SAC` | `compliance.gst.hsnCode` | Placeholder per Master Spec §6.5. |
| `Quantity` | `lines[].quantity` | Decimal. |
| `Unit` | `lines[].unit` | Free text. |
| `Unit Price (INR)` | `lines[].unitPrice` | Decimal precision 2. |
| `Line Subtotal (INR)` | `lines[].lineSubtotal` | Decimal precision 2. |
| `Tax Rate %` | `compliance.gst.taxRatePercent` | Integer / decimal. |
| `CGST (INR)` | line-proportion | Per §7.1. |
| `SGST (INR)` | line-proportion | Same. |
| `IGST (INR)` | line-proportion | Blank if intra-state. |
| `Line Total (INR)` | `lines[].lineTotal` | Decimal precision 2. |
| `Place of Supply` | `compliance.gst.placeOfSupply` | Two-digit state code; blank if B2C. |
| `IRN` | `compliance.irn.number` | Placeholder per Master Spec §6.5. |
| `E-Way Bill Number` | `compliance.eway.number` | Placeholder per Master Spec §6.5. |
| `Source URL` | `metadata.sourceUrl` | Deep link. |
| `Narration` | `narration` | 500-char limit. |

### 5.4 Generic CSV — Vendor AP Aging export

| Generic CSV column | ExportRow path / aggregation | Format / transformation rule |
|---|---|---|
| `Vendor Name` | `parties.vendor.name` | One row per outstanding (TRN, vendor) pair. |
| `Vendor GSTIN` | `parties.vendor.gstin` | Blank when null. |
| `Vendor Ledger Code` | `parties.vendor.ledgerCode` | Blank if unmapped. |
| `TRN` | `trn` | Originating PO/GR TRN. |
| `Bill Date` | `date` | ISO. |
| `Due Date` | `date + vendor.payment_terms_days` | ISO; computed at export time. |
| `Bill Amount (INR)` | `totals.total` | Decimal precision 2. |
| `Paid Amount (INR)` | aggregated from `vendor_payments` | 0 if unpaid. |
| `Outstanding (INR)` | `totals.total − paidAmount` | Decimal precision 2. |
| `Days Outstanding` | `today − date` | Integer. |
| `Bucket 0-30` | `outstanding if ≤ 30` else 0 | Decimal precision 2. |
| `Bucket 31-60` | `outstanding if 31..60` else 0 | Decimal precision 2. |
| `Bucket 61-90` | `outstanding if 61..90` else 0 | Decimal precision 2. |
| `Bucket 90+` | `outstanding if > 90` else 0 | Decimal precision 2. |
| `Place of Supply` | `compliance.gst.placeOfSupply` | Two-digit state code. |
| `Brand` | `brand.name` | Constant. |
| `Source URL` | `metadata.sourceUrl` | Deep link. |

### 5.5 Generic CSV — Customer AR Aging export

| Generic CSV column | ExportRow path / aggregation | Format / transformation rule |
|---|---|---|
| `Customer Name` | `parties.customer.name` | One row per outstanding (DC TRN, customer) pair. |
| `Customer GSTIN` | `parties.customer.gstin` | Blank if non-GST. |
| `Customer Ledger Code` | `parties.customer.ledgerCode` | Blank if unmapped. |
| `TRN` | `trn` | DC TRN. |
| `Invoice Date` | `date` | ISO. |
| `Due Date` | `date + customer.credit_terms_days` | ISO. |
| `Invoice Amount (INR)` | `totals.total` | Decimal precision 2. |
| `Received Amount (INR)` | aggregated from B2B receipts | 0 if unpaid. |
| `Outstanding (INR)` | `totals.total − receivedAmount` | Decimal precision 2. |
| `Days Outstanding` | `today − date` | Integer. |
| `Bucket 0-30` | `outstanding if ≤ 30` else 0 | Decimal precision 2. |
| `Bucket 31-60` | `outstanding if 31..60` else 0 | Decimal precision 2. |
| `Bucket 61-90` | `outstanding if 61..90` else 0 | Decimal precision 2. |
| `Bucket 90+` | `outstanding if > 90` else 0 | Decimal precision 2. |
| `Place of Supply` | `compliance.gst.placeOfSupply` | Two-digit state code. |
| `Brand` | `brand.name` | Constant. |
| `Source URL` | `metadata.sourceUrl` | Deep link. |

### 5.6 Generic CSV — Food Cost export

| Generic CSV column | ExportRow path / aggregation | Format / transformation rule |
|---|---|---|
| `Period Start` | export date-range start | ISO. |
| `Period End` | export date-range end | ISO. |
| `Brand` | `brand.name` | Constant. |
| `Location Code` | `location.code` | Free text. |
| `Location Name` | `location.name` | Verbatim. |
| `Department` | `location.department` | Blank if not department-scoped. |
| `Item Code` | `lines[].itemCode` | SKU. |
| `Item Name` | `lines[].itemName` | Verbatim. |
| `Quantity Sold` | aggregated `SA-` summaries | Decimal. |
| `Unit` | `lines[].unit` | Free text. |
| `Theoretical Unit Cost (INR)` | from `recipe_cost_snapshot` | Decimal precision 2. |
| `Actual Unit Cost (INR)` | from FEFO-deducted batches at deduction-time price | Decimal precision 2. |
| `Theoretical Cost (INR)` | `theoreticalUnitCost × quantitySold` | Decimal precision 2. |
| `Actual Cost (INR)` | `actualUnitCost × quantitySold` | Decimal precision 2. |
| `Variance (INR)` | `actualCost − theoreticalCost` | Sign-preserved. |
| `Variance %` | `variance / theoreticalCost × 100` | 0 if denom is 0. |
| `Currency` | `totals.currency` | `"INR"`. |
| `Source URL` | `metadata.sourceUrl` | Deep link. |

---

## 6. Format-selection logic

`exportService.generateExport` (architecture.md §6.3) accepts a `format` parameter and resolves the renderer:

```typescript
// Pseudocode — actual implementation lands in Phase 4 Epic 10
//
// Caller passes a brandedDb (DL-012) so brand context is implicit.
// Format selection is a pure dispatch — no DB lookup inside the renderer
// dispatch table itself; only the upstream override-resolution reads brand prefs.

type ExportFormat = 'tally' | 'zoho' | 'generic';
type ExportType   =
  | 'transaction_journal'
  | 'purchase_register'
  | 'sales_register'
  | 'vendor_ap_aging'
  | 'customer_ar_aging'
  | 'food_cost';

interface GenerateExportArgs {
  format?: ExportFormat;     // optional override; absent → use brand default
  dateRange: { startDate: string; endDate: string };
  type: ExportType;
}

exportService.generateExport(db: BrandedDb, args: GenerateExportArgs)
  → Promise<{ jobId: string }>
```

**Override resolution (in order):**

1. If `args.format` is provided, use it.
2. Else load `brand.preferred_export_format` from the brand-settings table (column type `ExportFormat`, NOT NULL, default `'generic'` at brand-bootstrap per Master Spec §6.1's accountant-handoff first-class principle).
3. The selected format is recorded on the `accounting_export_history` row alongside `requested_by_user_id`, `requested_at`, `date_range_start`, `date_range_end`, `type`, `format`, `output_storage_path`. (Per FR96 — "the selected format is recorded in the export history log alongside who exported and when.")

**Brand-settings field shape** (Phase 4 Epic 10 schema):

```sql
-- Added to the brand_settings table (or equivalent — name finalized in Epic 10)
preferred_export_format   text NOT NULL DEFAULT 'generic'
                          CHECK (preferred_export_format IN ('tally', 'zoho', 'generic'))
-- brand_id PK already present per brandScopedTable convention (DL-015 / architecture.md §4.4)
```

**Per-export override path:** the export-request screen surfaces a format dropdown pre-selected to the brand default. Power users (Finance Manager) can change it for a single export — that selection lands in `args.format` and never mutates the brand default. This separation is required by FR96 ("Individual export sessions can override the default. The selected format is recorded in the export history log alongside who exported and when.").

**Renderer dispatch table:**

| `format` × `type` | Renderer module |
|---|---|
| `tally` × any | `apps/api/src/services/exporters/tally.exporter.ts` |
| `zoho` × any | `apps/api/src/services/exporters/zoho.exporter.ts` |
| `generic` × any | `apps/api/src/services/exporters/generic.exporter.ts` |

Each renderer module exports six functions (one per `ExportType`) with a uniform signature `(db: BrandedDb, dateRange) => AsyncIterable<string>` — a stream of CSV-row strings the worker pipes into Supabase Storage. The streaming shape avoids buffering large date-range exports in memory (a one-year Sales Register at a busy 10-outlet brand can be tens of thousands of rows).

**Adding a fourth format post-MVP** (e.g. QuickBooks): write `quickbooks.exporter.ts` with the same six-function interface, register `'quickbooks'` in the `ExportFormat` union and the `CHECK` constraint, add a renderer-dispatch row, write column-mapping tables in a new section of this doc. No changes to the `ExportRow` data layer — that is the pluggable-renderer guarantee from PRD FR96.

---

## 7. Edge cases

### 7.1 Multi-line transactions (one row per line vs one row per transaction with subtotals)

The six exports split into two patterns:

**Line-itemized exports** (Purchase Register, Sales Register, Food Cost) — emit one CSV row per `ExportLine`. The header fields (TRN, date, vendor name, etc.) repeat on every line row. This is what every accounting tool's import templates expect for line-itemized documents.

- **CGST / SGST / IGST allocation across lines:** the document-level tax amounts in `compliance.gst.{cgstAmount, sgstAmount, igstAmount}` are allocated across lines proportional to `line.lineSubtotal / sum(lines[].lineSubtotal)`. Rounding: round each line's allocated tax to 2dp; absorb the residual rounding error into the largest-subtotal line so the column sums match the document total exactly.

**Journal-style exports** (Transaction Journal) — Tally and Zoho Books expect one CSV row per *journal leg* (debit or credit), with all rows sharing a `Voucher Number` / `Journal Entry Number`. So a 2-line PO + GST entry expands to 4 rows in Transaction Journal: (1) DR Inventory subtotal, (2) DR GST Input Credit, (3) CR Vendor AP, (4) sometimes a rounding-adjustment leg. The renderer iterates the journal entries from `journal_entries / journal_entry_lines` (the tables `accountingService.createJournalEntry` writes per Master Spec §7.6) — it does NOT re-derive legs from the source transaction. **Source of legs = the journal-entry table, not the source-document table.**

**Aging exports** (Vendor AP, Customer AR) — emit one row per outstanding (TRN, party) pair. Aging buckets are columns on the same row, not separate rows. No multi-line expansion.

**Generic CSV** follows the line-itemized pattern across the board because Generic is read by Excel / spreadsheet users, where one-row-per-line is overwhelmingly the cleaner shape. (Tally and Zoho's journal-leg pattern is required by their specific journal importers; Generic CSV has no such constraint.)

### 7.2 GST fields when not applicable

Per Master Spec §6.5, GST fields are placeholders — nullable, never required. When a transaction has no GST applied (e.g. intra-state B2C cash sale with composition-scheme vendor; or a stock-transfer between own departments with no tax event):

- `compliance.gst.placeOfSupply`, `taxRatePercent`, `cgstAmount`, `sgstAmount`, `igstAmount` are all `null`.
- All renderers MUST emit blank cells for these columns — never the literal string `null`, never `0` (zero is meaningful — "tax was applicable but at 0% rate"; blank means "tax was not applicable").
- `Tax Name` (Zoho) and `Tax Rate` (Tally) are blank.
- `HSN/SAC` is blank.

For a transaction where GST applies but only intra-state (CGST + SGST), `igstAmount` is `null` (blank cell); for inter-state (IGST only), `cgstAmount` and `sgstAmount` are `null` (blank cells). Renderers MUST NOT emit `0` for the inapplicable axis — that triggers spurious balance failures in Tally.

### 7.3 IRN field when not generated

`compliance.irn.number` is a placeholder field per Master Spec §6.5. In MVP, the user pastes the IRN manually after generating it on the IRP portal. Until pasted, the value is `null`.

- All renderers emit a blank cell for `IRN` when null.
- The Sales Register and Transaction Journal exports surface IRN columns explicitly. Purchase Register, AP/AR Aging, Food Cost do NOT surface IRN columns (IRN applies to outbound sales, not inbound purchases).
- Validation §8 surfaces a *warning* (not error) on Sales Register exports where IRN is null on B2B-customer rows whose `totals.total` exceeds the IRN-mandatory threshold of ₹5 crore aggregate turnover (the threshold is brand-config not transaction-config — surfaced as a per-brand toggle in Epic 10 settings, not in this doc). MVP renders the export anyway with blank IRN; the accountant fills in IRN before pushing to GST portal.

### 7.4 Refunds / credit notes — sign convention per format

`CN-` (Credit Note) TRNs cover both vendor returns (DR vendor / CR purchases) and B2B customer returns (DR sales / CR customer). Sign convention differs by format:

**Tally:** Credit Notes have their own Voucher Type (`"Credit Note"`). The CSV emits positive amounts in the `Debit` / `Credit` columns just like other vouchers — the *direction* is encoded by Voucher Type and ledger leg, not by sign. Renderers MUST emit positive amounts.

**Zoho Books:** Credit Notes have their own importer (`Zoho Books Credit Notes` module). The CSV column structure parallels Sales Register / Purchase Register but with `Credit Note Number` instead of `Invoice Number` / `Bill Number`. Amounts are positive. Zoho Books resolves the sign on import based on the Credit Note voucher type.

**Generic CSV:** The `Transaction Type` column carries the long-form name (`"Credit Note — Vendor Return"` or `"Credit Note — Customer Return"`). Amounts in `Subtotal (INR)` / `Tax (INR)` / `Total (INR)` are positive. A spreadsheet user computing "net purchases" subtracts vendor-return Credit Note totals from Purchase Order totals using an aggregation formula — the column-level positive convention keeps the data tidy.

In NO format do renderers emit negative amounts. The negative-vs-positive question is resolved at the document-type level upstream of the renderer.

### 7.5 Foreign-currency transactions (post-MVP placeholder)

`ExportRow.totals.currency` is hard-coded `'INR'` for MVP. The field exists today (not deferred) so post-MVP multi-currency does not require a schema change to the export domain model. When multi-currency lands:

- All amount columns in all eighteen tables continue to carry the source-currency amount (a USD purchase emits `Subtotal (USD)` with USD numbers).
- A new `Currency` column already exists on every export (Generic CSV §5.x; Zoho Books §4.x). Tally renderers gain a new column header `Currency` (today the column does not exist on Tally tables because INR is implicit).
- Conversion-to-INR is the accountant's responsibility on the receiving side — the ERP does not double-emit converted columns. (Reconsider trigger: if a launch customer onboards with significant FX exposure, build "Subtotal in Reporting Currency" derived columns into the renderer per a follow-up Phase 4 sprint.)

This is a **post-MVP placeholder** — the column reservation exists; the renderer logic for non-INR currencies is not built in MVP and is explicitly out-of-scope.

### 7.6 Empty exports (no rows in the date range)

If a date range produces zero export rows (e.g. an outlet that was closed for the period):

- Renderer emits a CSV with the header row only and an empty body.
- `accounting_export_history` records `row_count: 0` and `output_size_bytes: <header-only size>`.
- The Notification Center notification (per architecture.md §6.2.3 / §11) carries a `metadata.row_count: 0` field so the user-visible notification can read "Export completed — 0 rows" rather than implying success-with-data.
- Validation §8 surfaces an info-level (not warning) message: "No transactions in the selected date range." The user is not blocked from downloading the empty file — the empty file is itself meaningful (proof that no transactions existed).

---

## 8. Validation pre-export

`exportService.generateExport` runs a pre-flight validation pass before the renderer streams the first row. Validation failures surface to the user via the same Notification Center pipeline (architecture.md §11) the worker uses for the success path — the notification carries a `validation_errors: ValidationError[]` field that the export-history-detail screen renders as a row-level remediation list.

Severity tiers (consistent with the `ValidationError` typed-error model in architecture.md §6.5):

- **Error** — blocks export. The renderer aborts, the export-history row is marked `status: 'failed'`, no file is uploaded, the notification carries the error list.
- **Warning** — non-blocking. Export proceeds; warnings appear in the export-history detail view; user can re-export after fixing if desired.
- **Info** — informational. No remediation needed.

### 8.1 Validation checklist (run before any rendering)

| Check | Severity | Remediation guidance shown to user |
|---|---|---|
| **All transactions in date range have a non-null TRN.** Per Master Spec §6.2 every confirmed transaction has a TRN; a null TRN indicates data corruption. | Error | "Transaction `<source_table_name>.<row_id>` is missing a TRN. Contact engineering — this should not occur in normal operation." |
| **Required-for-format fields populated.** Tally and Zoho Books require `compliance.gst.placeOfSupply` on B2B-GST rows; missing it triggers a Tally / Zoho import rejection. (Generic CSV does not require it — emits blank.) | Error (Tally/Zoho); Warning (Generic) | "Row `<TRN>` (vendor `<vendor_name>`): Place of Supply is missing but required for Tally / Zoho Books export. Edit the document and set Place of Supply, then re-run the export." |
| **GSTIN format valid.** `vendor.gstin` and `customer.gstin` if non-null match the 15-character GSTIN regex `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$`. | Error (Tally/Zoho); Warning (Generic) | "Row `<TRN>`: GSTIN `<value>` is not a valid 15-character GSTIN. Edit the vendor/customer master and correct the GSTIN, or clear it if the party is not GST-registered." |
| **IRN length when present.** When `compliance.irn.number` is non-null, it MUST be exactly 64 characters per Master Spec §6.5. | Error (Tally/Zoho); Warning (Generic) | "Row `<TRN>`: IRN `<value>` is `<length>` characters; expected 64. Re-paste the IRN from the IRP portal." |
| **Vendor / customer ledger-code mapping populated.** For Tally and Zoho exports, every party referenced in the date range has a non-null `tally_ledger_code` / `zoho_account_code` in the master. | Warning | "Vendor `<vendor_name>` (`<gstin>`): No Tally ledger code mapped. The accountant will need to manually pick the ledger on import. Configure the mapping in Vendor Master to avoid this." |
| **Date range is non-empty and not in the future.** `dateRange.startDate ≤ dateRange.endDate`; `dateRange.endDate ≤ today`. | Error | "Date range is invalid. End date must be on or before today, and on or after start date." |
| **Date range does not span more than 366 days.** Single-export upper bound (per FR96 export-history file-size implications). | Warning | "Date range spans `<N>` days. Exports over 366 days produce very large files; consider splitting into yearly exports." |
| **Brand has a non-null `preferred_export_format`.** Defensive check — DEFAULT `'generic'` should always populate it, but if a migration-bootstrap edge case left it null. | Error | "Brand setup is incomplete: preferred export format is not set. Brand Owner must set it in System Settings → Accounting." |
| **All journal entries balance.** For Transaction Journal exports — defence-in-depth check that `sum(debits) === sum(credits)` per journal_entry_id over the date range. (`accountingService.createJournalEntry` enforces this at write per architecture.md §6.2.4 — but the export validation re-checks because a journal-entry corruption that bypassed the service is a financial-integrity hazard the export must surface.) | Error | "Journal entry `<journal_entry_id>` (TRN `<trn>`) is unbalanced: debits=`<X>`, credits=`<Y>`. This indicates data corruption. Contact engineering before exporting." |
| **No transactions in date range.** Empty-result detection per §7.6. | Info | "No transactions in the selected date range. The export will contain only the header row." |

The validation pass runs as a single SQL aggregation query (one round-trip to Postgres) per date-range scope — not per-row. Surfacing N row-level errors requires only one query that returns a stream of `(severity, trn, field, message)` rows. This keeps pre-flight validation O(1) round trips even on a one-year date range with tens of thousands of transactions.

### 8.2 Validation-error rendering on the user side

The export-history detail screen (Epic 10 mockup deliverable, deferred to Phase 4 Epic 10c per architecture.md §19) renders the `ValidationError[]` list as:

- A status pill at the top: green `Ready` (no errors / warnings), yellow `Ready with warnings`, red `Failed validation`.
- A grouped list grouped by `severity`, each error linking to the source document via `metadata.sourceUrl` so the user can click through to fix.
- A `Re-run export` button that re-invokes `exportService.generateExport` with the same `dateRange` + `type` + `format` (the underlying transactions may have been edited to fix errors).
- A `Download anyway` button that surfaces only if all validation issues are warnings (severity ≠ Error). Hidden when any error blocks.

DESIGN.md status-pill colours are referenced from `DESIGN.md` §3 token system (per `DESIGN.md` design-tokens layer). The export-history detail screen is a Tier 1 Acceptance-tag deferred hero (per CLAUDE.md "Phase 4 invariants" — Tier 1 acceptance applies even though built in Phase 4).

---

## Appendix A — Cross-reference index

| Concept | Source |
|---|---|
| FR96 (dual Tally + Zoho Books + Generic CSV from MVP) | `_planning/03-prd.md` line 729 |
| In-scope export catalogue (six exports) | `_planning/02-master-spec.md` §6.3 |
| Compliance placeholder fields (GST, IRN, e-way, TDS) | `_planning/02-master-spec.md` §6.5 |
| TRN format (immutable, system-generated, primary export key) | `_planning/02-master-spec.md` §6.2 |
| MVP / post-MVP boundary for live API push | `_planning/02-master-spec.md` §6.6 |
| `exportService.generateExport` service catalogue entry | `_planning/architecture.md` §6.3 |
| `accountingService.createJournalEntry` (source of journal legs in Transaction Journal export) | `_planning/architecture.md` §6.2.4 |
| `accountingService.getTRN` (TRN allocation) | `_planning/architecture.md` §6.2.4 |
| Idempotency on `POST /api/v1/accounting-exports` | `_planning/architecture.md` §17.10 |
| `recipe_cost_snapshot` (theoretical cost source for Food Cost export) | `_planning/architecture.md` §6.3 service catalogue / §12.3 |
| `brandedDb` factory (every export is brand-scoped) | `_planning/architecture.md` §4.2 / DL-012 |
| `brandScopedTable` helper (export-history table convention) | `_planning/architecture.md` §4.4 / DL-015 |
| pg-boss worker for long-running export jobs | `_planning/architecture.md` §9 / DL-009 |
| Notification Center (export-ready notifications) | `_planning/architecture.md` §11 / DL-011 |
| Supabase Storage delivery (signed-URL output path) | `_planning/architecture.md` §13 / DL-017 |
| Status-guarded UPDATE pattern (export job lifecycle) | `_planning/architecture.md` §8.3 / DL-016 |
| Reason field on export-history (per `audit_log`) | `_planning/architecture.md` §7.5 |

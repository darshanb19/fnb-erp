# B2B Challan — Complete Flow, Use Cases & Edge Cases

**Document Type:** Supplementary Specification
**Scope:** Epic 8 (Dispatch & Distribution) + Epic 10 (Accounting & Financial)
**Status:** Final — input for PRD and architecture work
**Supersedes:** Any partial or ambiguous references to B2B distribution in the Master Specification or earlier requirements drafts.

---

## 1. What a B2B Challan Is

A B2B Challan is an internal dispatch document that records the movement of goods from a Brand/Cluster location to an external business customer (not a POS location). It is distinct from an internal dispatch challan (Central Kitchen → POS) in that:

- The recipient is an external party, not an internal department
- It creates an Accounts Receivable entry (customer owes money)
- It may or may not result in a GST invoice depending on the customer and transaction type
- It requires a B2B customer master record

A B2B Challan is **not** a GST invoice. It is an operational dispatch document. The GST invoice is a separate commercial document raised selectively against challans, handled via external accounting software in MVP.

---

## 2. B2B Customer Master

A minimal customer master record is required before a B2B challan can be created.

**Required fields:**
- Customer code (system-generated, format: `CUST-{SEQUENCE}`)
- Customer name
- Registered address
- GSTIN (optional — nullable, required only for GST invoice customers)
- GST registration type (Regular / Composition / Unregistered / Consumer)
- Credit terms (number of days — e.g. 30, 45, 60)
- Contact person name and phone
- Status (Active / Inactive)

**Rules:**
- A challan cannot be created without a customer record
- GSTIN is optional at customer master level but required at challan level if a GST invoice will be raised
- Credit terms are informational in MVP — no automatic order blocking on credit limit breach (post-MVP)

---

## 3. Challan Lifecycle — Status Flow

```
Draft
  ↓
Dispatched          ← goods leave premises, Stage 1 journal entry fires
  ↓
Delivered           ← customer acknowledges receipt
  ↓
    ┌──────────────────────────┬─────────────────────────┐
    ↓                          ↓
GST Invoice Raised         No GST Invoice
(Stage 2 journal fires)    (Finance explicitly confirms)
    ↓                          ↓
  Closed                     Closed
```

**Status definitions:**

| Status | Who Sets It | What Happens |
|---|---|---|
| Draft | Finance / Dispatch staff | Challan created, no inventory movement yet |
| Dispatched | Dispatch staff | Inventory decremented, Stage 1 journal entry fires, TRN generated |
| Delivered | Dispatch staff or Finance | Delivery confirmed by customer or internally |
| Closed — GST Invoiced | Finance / Brand Owner | `gst_invoice_raised = true`, IRN pasted, Stage 2 journal entry fires |
| Closed — No GST Invoice | Finance / Brand Owner | `gst_invoice_raised = false`, challan closed with Stage 1 entry only |
| Cancelled | Finance / Brand Owner | Valid from Draft only — clean no-op, no inventory or accounting impact |
| Closed — Returned | Finance / Brand Owner | Full credit note raised after dispute, stock reinstated, all journal entries reversed, net impact zero |

**Rules:**
- Only Dispatched status triggers inventory decrement — never Draft
- A challan cannot be moved back from Dispatched to Draft (immutable once dispatched)
- Both closing paths (GST Invoiced and No GST Invoice) are valid and permanent
- A closed challan cannot be edited — amendments require a new challan or credit note

---

## 4. Inventory Impact

**On status change to Dispatched:**
- Stock is decremented from the dispatching location/department
- The decrement uses the same `inventoryService.deductStock()` method as all other stock movements
- Material enablement rules apply — the dispatching department must have the items enabled
- The DC TRN is passed as the `trnReference` parameter

**Returns handling:**
- If goods are returned by the customer, a Credit Note is created (separate document, own TRN: `CN-YYYY-LOC-SEQUENCE`)
- The Credit Note increments stock back into the originating location
- The Credit Note creates reversal journal entries (see §6 below)
- Partial returns are supported — Credit Note covers only the returned items and quantities

---

## 5. Transaction Reference Numbers

| Document | TRN Format | Example |
|---|---|---|
| B2B Delivery Challan | `DC-{YYYY}-{LOC}-{SEQ}` | DC-2026-BRD-000001 |
| B2B Credit Note | `CN-{YYYY}-{LOC}-{SEQ}` | CN-2026-BRD-000001 |

- DC TRN is generated at Dispatched status — not at Draft
- CN TRN is generated at Credit Note creation
- Both TRNs appear on all related documents and accounting entries
- The CN TRN references the original DC TRN it is reversing

---

## 6. Accounting Entries — Full Two-Stage Model

### Stage 1 — On Challan Dispatch (always fires)

Fires when status changes from Draft → Dispatched.

```
Debit:   Accounts Receivable     [base value, tax excluded]
Credit:  Revenue — B2B Sales     [base value, tax excluded]
TRN:     DC-2026-BRD-000001
```

**Example:** Challan for ₹10,000 worth of goods (before GST)

```
Debit:   Accounts Receivable     ₹10,000
Credit:  Revenue — B2B Sales     ₹10,000
```

### Stage 2 — On GST Invoice Confirmation (fires only when `gst_invoice_raised = true`)

Fires when Finance sets status to Closed — GST Invoiced.

```
Debit:   Accounts Receivable     [tax amount only — incremental]
Credit:  GST Liability           [tax amount]
TRN:     DC-2026-BRD-000001      [same TRN as Stage 1]
```

**Example:** GST at 18% on ₹10,000 base

```
Debit:   Accounts Receivable     ₹1,800
Credit:  GST Liability           ₹1,800
```

**Combined AR balance after both stages:**

```
Accounts Receivable for DC-2026-BRD-000001 = ₹11,800
  (₹10,000 base + ₹1,800 GST)
```

### Stage 1 Only — On Close Without GST Invoice (`gst_invoice_raised = false`)

No additional journal entry. Challan closes with only the Stage 1 entry.

**AR balance:**

```
Accounts Receivable for DC-2026-BRD-000001 = ₹10,000
  (base value only, no tax collected)
```

### Credit Note Reversal Entries

When a Credit Note is created for a full or partial return:

**Full return:**

```
Debit:   Revenue — B2B Sales     [base value reversed]
Credit:  Accounts Receivable     [base value reversed]
TRN:     CN-2026-BRD-000001

If GST invoice had been raised:
Debit:   GST Liability           [tax amount reversed]
Credit:  Accounts Receivable     [tax amount reversed]
TRN:     CN-2026-BRD-000001
```

**Partial return:**
Same entries but for the value of returned items only, not the full challan value.

---

## 7. GST Invoice Fields on Challan

These fields follow the placeholder field strategy defined in §6.5 of the Master Specification. All are optional and nullable. System never fails if empty.

| Field | Type | Notes |
|---|---|---|
| `buyer_gstin` | VARCHAR(15) | Required if GST invoice will be raised |
| `hsn_code` | VARCHAR(8) | Per line item. Selected from GSTN dropdown — not free text |
| `place_of_supply` | VARCHAR(2) | Two-digit state code. Determines CGST+SGST vs IGST |
| `tax_rate_percent` | DECIMAL(5,2) | 0, 5, 12, 18, or 28 |
| `cgst_amount` | DECIMAL(12,2) | Intra-state only |
| `sgst_amount` | DECIMAL(12,2) | Intra-state only |
| `igst_amount` | DECIMAL(12,2) | Inter-state only |
| `gst_invoice_raised` | BOOLEAN | Default false. Set to true when GST invoice raised in external software |
| `gst_invoice_raised_at` | TIMESTAMPTZ | Nullable. Set when `gst_invoice_raised` is set to true |
| `irn` | VARCHAR(64) | [PLACEHOLDER] Pasted from IRP portal in MVP. System-generated in v2 |
| `irn_generated_at` | TIMESTAMPTZ | [PLACEHOLDER] Null until e-invoicing feature built |

**Rules:**
- `gst_invoice_raised` and `irn` are always set together — if IRN is pasted, the flag must be true
- `cgst_amount` and `sgst_amount` are mutually exclusive with `igst_amount` — intra-state uses CGST+SGST, inter-state uses IGST
- HSN code is per line item on the challan, not at the header level
- Only Finance Manager and Brand Owner roles can set `gst_invoice_raised = true`

---

## 8. Use Cases

### UC-1: Standard B2B Dispatch, No GST Invoice Required
**Scenario:** Goods sent to an unregistered customer or internal transfer treated as B2B.

1. Finance creates challan in Draft status
2. Dispatch staff confirms dispatch → status moves to Dispatched
3. Stage 1 journal entry fires (base value AR + Revenue)
4. Customer acknowledges → status moves to Delivered
5. Finance closes challan with `gst_invoice_raised = false` → status: Closed — No GST Invoice
6. AR balance = base value only

---

### UC-2: B2B Dispatch with GST Invoice
**Scenario:** Goods sent to a GST-registered business customer who requires a tax invoice.

1. Finance creates challan in Draft, fills GST fields (buyer GSTIN, HSN, tax rate, amounts)
2. Dispatch staff confirms dispatch → status moves to Dispatched
3. Stage 1 journal entry fires (base value AR + Revenue)
4. Customer acknowledges → status moves to Delivered
5. Accountant downloads Sales Register export, raises GST invoice in Tally/Zoho Books against DC TRN
6. Finance pastes IRN into ERP challan record, sets `gst_invoice_raised = true` → status: Closed — GST Invoiced
7. Stage 2 journal entry fires (tax amount AR + GST Liability)
8. AR balance = base value + tax amount

---

### UC-3: Partial Return After Dispatch
**Scenario:** Customer returns some items after delivery.

1. Challan already in Delivered or Closed status
2. Finance creates Credit Note referencing the original DC TRN
3. Credit Note covers only the returned items and quantities
4. Stock incremented back into originating location
5. Reversal journal entries fire for returned value only
6. If original challan had GST invoice, GST reversal entries also fire
7. Original challan remains Closed — Credit Note is the correcting document

---

### UC-4: Full Return After Dispatch
**Scenario:** Customer returns all items.

1. Same as UC-3 but Credit Note covers full challan value
2. Full reversal of all journal entries (both Stage 1 and Stage 2 if applicable)
3. Full stock reinstatement
4. Net AR balance = zero for that DC TRN

---

### UC-5: GST Invoice Raised for Some Challans, Not All
**Scenario:** Monthly batch where some challans get GST invoices and others do not.

1. Each challan is independent — GST invoice decision is per challan
2. Finance downloads Sales Register export at month end
3. Finance selects which challans in the export need GST invoices
4. Raises invoices in external accounting software for selected challans only
5. Pastes IRN back into each applicable challan in ERP
6. Sets `gst_invoice_raised = true` on those challans → Stage 2 fires per challan
7. Closes remaining challans with `gst_invoice_raised = false`
8. AR report shows correct balance for each challan independently

---

### UC-6: Challan Created in Draft, Never Dispatched
**Scenario:** Order was prepared but dispatch was cancelled.

1. Challan in Draft status
2. No inventory movement has occurred (inventory only moves at Dispatched)
3. No journal entries have fired
4. Challan is cancelled — status: Cancelled
5. No accounting or inventory impact — Draft cancellation is a clean no-op

---

### UC-7: Dispute — Customer Refuses Delivery
**Scenario:** Customer refuses to accept goods on arrival.

1. Challan already in Dispatched status (inventory already decremented, Stage 1 already fired)
2. Dispatch staff marks delivery as refused — status moves to Delivered with a dispute flag
3. Finance creates a full Credit Note for the returned goods
4. Stock reinstated, Stage 1 reversal fires
5. Challan status updated to Closed — Returned
6. Net inventory and accounting impact = zero

---

## 9. Edge Cases

### E-1: GST fields not filled before dispatch
- System allows dispatch without GST fields (all nullable)
- Finance can fill GST fields after dispatch, before closing
- GST fields can be edited on challans in Dispatched or Delivered status
- GST fields become locked once challan is Closed

### E-2: Wrong tax amount entered
- GST amounts are editable until challan is Closed
- If discovered after closing, a Credit Note and fresh challan is the correction path
- No direct edit on a closed challan — this is an immutability rule consistent with all other closed transactions in the system

### E-3: IRN pasted but `gst_invoice_raised` not set (or vice versa)
- Validation rule: `irn` cannot be saved without `gst_invoice_raised = true`
- `gst_invoice_raised` cannot be set to true without an `irn` value
- Both fields are set together in a single save operation — atomic

### E-4: Intra-state vs inter-state tax split error
- If `place_of_supply` matches the dispatching location's state → CGST + SGST applies, IGST must be null
- If `place_of_supply` differs → IGST applies, CGST and SGST must be null
- System validates this on save and shows an error if the wrong combination is entered

### E-5: Credit Note raised after GST invoice confirmed
- Credit Note must reverse both Stage 1 and Stage 2 entries
- System checks `gst_invoice_raised` on the source challan
- If true → Credit Note reversal includes both base value reversal and tax reversal
- If false → Credit Note reversal includes base value reversal only

### E-6: Multiple partial returns against same challan
- Each partial return creates its own Credit Note with its own CN TRN
- Each CN TRN references the original DC TRN
- The sum of all Credit Note values must not exceed the original challan value
- System validates this on Credit Note creation and blocks if cumulative returns would exceed original value

### E-7: Customer has no GSTIN but requests tax invoice
- If customer GST registration type is Unregistered or Consumer → GST invoice cannot be raised
- System shows a warning if Finance attempts to set `gst_invoice_raised = true` on a challan for an unregistered customer
- Finance can override the warning if needed (with a mandatory reason entry)

---

## 10. Exports Covering B2B Challans

The following accountant handoff exports (defined in §6.3 of the Master Specification) cover B2B challans:

| Export | What It Includes for B2B Challans |
|---|---|
| Sales Register | All dispatched challans with DC TRN, customer name, GSTIN, base value, CGST, SGST, IGST, HSN code, `gst_invoice_raised` flag |
| Transaction Journal Export | All DC and CN journal entries with TRN, date, account, debit, credit |
| Customer AR Aging | Customer aging — outstanding AR by customer, challan-wise, with DC TRN |

The Sales Register export is the primary document the accountant uses to raise selective GST invoices in external software.

---

## 11. Permissions

| Action | Roles Permitted |
|---|---|
| Create / edit Draft challan | Finance Manager, Brand Owner, Cluster Manager |
| Move to Dispatched | Dispatch Staff, Finance Manager, Brand Owner |
| Mark as Delivered | Dispatch Staff, Finance Manager, Brand Owner |
| Fill / edit GST fields | Finance Manager, Brand Owner |
| Set `gst_invoice_raised = true`, paste IRN | Finance Manager, Brand Owner only |
| Close without GST invoice | Finance Manager, Brand Owner |
| Create Credit Note | Finance Manager, Brand Owner |
| Cancel Draft challan | Finance Manager, Brand Owner |

---

*This document is a supplementary specification for the F&B ERP. It is to be read alongside the Master Architecture & Requirements Specification, the Brainstorming Summary, and the PRD. In case of conflict, this document takes precedence for all matters relating to B2B Challans.*

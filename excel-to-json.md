# Excel Processing Spec (Local Processor)

Goal: reliably ingest a single .xlsx file that may contain up to ~20 sheets, extract rows (Khmer supported),
normalize them, optionally use GPT to translate/clean, and sync results to Railway via HTTP API.

This document defines WHAT the Excel Processor must do.
It is NOT the GPT translator prompt. (Translator prompt lives in excel-to-json.md.)

---

## 0) Non-Negotiable Principles

1) Excel is not the system of record.
   - Excel is an INPUT source only.

2) Railway is the system of record.
   - Railway stores events + derived AR state.

3) Never "guess" missing dates/amounts.
   - If parsing fails: set field to null + log error + skip sync for that row.

4) Processing must be idempotent.
   - Re-processing the same file should not create duplicate ARs or inconsistent state.

---

## 1) Sheet Processing Policy (Multi-Sheet)

### Default behavior (MVP)
- Process ALL sheets in the workbook (up to configured max, e.g. 20).
- Skip empty sheets automatically.

### Config options
Use env var: SHEETS_MODE

- SHEETS_MODE=all (default)
  - Process every sheet.

- SHEETS_MODE=first
  - Only process workbook.worksheets[0] (for debugging).

- SHEETS_MODE=allowlist
  - Process only sheet names listed in SHEETS_ALLOWLIST (comma-separated).
  - Example: SHEETS_ALLOWLIST=Theary,OF,Sros

- SHEETS_MODE=denylist
  - Process all sheets except those in SHEETS_DENYLIST.
  - Example: SHEETS_DENYLIST=JR,Summary

### Requirements
- Log which sheets are processed and which are skipped (and why).
- Include sheet_name in every extracted row.

---

## 2) Header Detection (Critical)

Excel files are visually formatted and may have:
- title rows
- merged cells
- inconsistent row offsets

Therefore: DO NOT hardcode column indices (e.g., “F is amount”).

### Header row detection algorithm
For each sheet:
1) Scan the first N rows (N=25 recommended).
2) Find the first row that contains >= K expected headers (K=3–4).
3) Treat that row as the header row.

### Header-based mapping
Build a map: header_text -> column_index
Use the map to extract fields.

### Expected headers (Khmer)
At minimum, we need:
- customer_id / house code: "លេខ ផ្ទះ" (or close match)
- customer_name: "ឈ្មោះអតិថិជន"
- phone: "លេខទូរសព្ទអតិថិជន"
- due_date: "ថ្ងៃបង់ប្រាក់"
- amount: "ប្រាក់ត្រូវបង់"
Optional:
- installment: "លើកទី"
- notes/description: "បរិយាយ"
- checked_by: "ពិនិត្យដោយ"

Matching must be tolerant (trim, normalize spaces).

---

## 3) Excel-Native Type Handling (Stop the common failures)

Excel cells may already be typed:
- dates can be Date/DateTime objects
- amounts can be numbers (int/float)

### due_date normalization
Accept:
- Date/DateTime -> convert to ISO YYYY-MM-DD
- Strings like "12/10/2025" -> parse and convert to ISO

If parsing fails:
- due_date = null
- add validation error "Invalid due date"

### amount normalization
Accept:
- int/float -> use directly
- strings like "$178.00" -> strip currency symbols/commas -> parse float

If parsing fails:
- amount.value = null (or 0 ONLY if your schema requires, but null preferred)
- add validation error "Invalid amount"

IMPORTANT:
- Never default due_date to "now".
- Never pull amount from "លើកទី" by accident.

(We have seen failures where amount/due_date became current timestamp or wrong column values.)

---

## 4) Row Extraction Rules

After detecting header row:
- Start reading data rows from header_row + 1 until:
  - X consecutive blank rows (X=3), OR
  - end of sheet

A row is considered "blank" if customer_id AND customer_name are empty.

Always emit:
- sheet_name
- row_index (Excel row number or 0-based index, but be consistent)
- raw row object (for debugging / audit)

---

## 5) Normalized Row Shape (Before GPT)

Before any GPT call, create a normalized row object:

{
  "source": { "file": "...", "sheet": "...", "row_index": 12 },
  "customer_id": "H225",
  "customer_name": "រិន រដ្ឋា",
  "phones_raw": "090... / 097...",
  "due_date_raw": <date|string>,
  "amount_raw": <number|string>,
  "installment_raw": <string|number|null>,
  "notes_raw": <string|null>
}

Then:
- normalize phones into array
- normalize due_date into ISO
- normalize amount into number
- attach validation_errors[] and warnings[]

If validation_errors includes amount/due_date issues:
- DO NOT send to GPT
- DO NOT sync to Railway
- log as failed row with raw_data included

---

## 6) GPT Translation Step (Optional but recommended)

GPT is used ONLY to translate/clean text fields and output strict JSON.
GPT must not read Excel; it receives normalized row objects.

Reference: excel-to-json.md for the translator constraints (JSON-only, no business logic).

Batching:
- Send rows in batches (default 10–25)
- Reduce batch size if notes are long.

Hard rules:
- GPT never decides duplicates
- GPT never decides payment status
- GPT never updates MongoDB directly

---

## 7) Idempotency (No duplicates, safe re-runs)

Compute a fingerprint for each normalized row:
fingerprint = hash(sheet_name + customer_id + due_date_iso + amount_value)

Store fingerprints per import_id in local import log.

On re-run:
- if fingerprint already processed successfully -> SKIP
- if fingerprint was failed -> retry allowed (configurable)

---

## 8) Sync to Railway (API Calls)

Only after a row passes validation (and GPT step if enabled):
- POST /api/ar (create AR)
- POST /api/ar/:id/change-due-date (ONLY if you already have explicit update policy)
- POST /api/excel-imports (save import log)

If Railway returns 500:
- mark row as failed with error_type=PROCESSING_ERROR
- store request payload in debug log (redact secrets)

---

## 9) Import Logs (Local + Railway)

Each file processing run produces:
- import_id (uuid)
- file_name
- started_at / completed_at
- per-sheet counts
- total_rows / successful / updated / duplicate / failed
- errors[] (each includes row_index, sheet_name, error_message, raw_data)

Save:
- locally as JSON
- to Railway via /api/excel-imports

---

## 10) Acceptance Criteria (What “done” means)

A) Multi-sheet support:
- By default, processes all sheets, not only the first.

B) Header-based mapping:
- Works even if columns are resized, styled, or shifted.

C) Correct type handling:
- Numeric amount + datetime due_date succeed without “Invalid format” errors.

D) Safety:
- No “fallback to now” due_date.
- No amount accidentally taken from installment column.

E) Observability:
- Logs show exactly which sheet/row failed and why.

# Implementation Plan: Multi-Sheet Excel Processing with Dynamic Header Detection

## Overview
Implement full specification from [excel-to-json.md](excel-to-json.md) to process ALL sheets in Excel files with dynamic header detection instead of hardcoded column indices.

## Current Issues
1. ❌ Only processes first sheet (`workbook.SheetNames[0]`)
2. ❌ Uses hardcoded column indices (brittle, breaks on different layouts)
3. ❌ No sheet_name tracking
4. ❌ No SHEETS_MODE configuration
5. ❌ Header row position assumed at row 1

## Implementation Steps

### Step 1: Update Data Models
**File**: `excel-processor-local/src/models/excel-import.ts`

Add to `ExcelRowData`:
```typescript
export interface ExcelRowData {
  // Add new fields
  sheet_name: string;           // Which sheet this row came from
  source: {
    file: string;
    sheet: string;
    row_index: number;
  };

  // Keep existing fields
  row_index: number;
  customer_name: string;
  amount_raw: string;
  date_raw: string;
  notes?: string;
  raw_data: any;
}
```

Add sheet-level summary to import log:
```typescript
export interface ExcelImportLog {
  // ... existing fields
  sheets_processed: Array<{
    sheet_name: string;
    rows_found: number;
    rows_successful: number;
    rows_failed: number;
    header_row_index: number;
  }>;
}
```

### Step 2: Add Configuration Support
**File**: `excel-processor-local/src/config.ts`

Add environment variables:
```typescript
export const config = {
  // ... existing config
  excel: {
    sheetsMode: process.env.SHEETS_MODE || 'all',        // all|first|allowlist|denylist
    sheetsAllowlist: process.env.SHEETS_ALLOWLIST?.split(',').map(s => s.trim()) || [],
    sheetsDenylist: process.env.SHEETS_DENYLIST?.split(',').map(s => s.trim()) || [],
    maxSheetsPerFile: parseInt(process.env.MAX_SHEETS_PER_FILE || '20'),
    headerScanRows: parseInt(process.env.HEADER_SCAN_ROWS || '25'),
    minHeadersRequired: parseInt(process.env.MIN_HEADERS_REQUIRED || '3'),
  }
};
```

### Step 3: Implement Header Detection Utility
**File**: `excel-processor-local/src/utils/header-detector.ts` (new file)

Create utility to:
1. Define Khmer header mappings
2. Normalize header text (trim, lowercase, remove extra spaces)
3. Fuzzy match headers
4. Scan first N rows to find header row
5. Build column map: `{ customer_name: 2, amount: 6, ... }`

```typescript
export interface HeaderMapping {
  customer_id?: number;      // Column index for "លេខ ផ្ទះ"
  customer_name?: number;    // Column index for "ឈ្មោះអតិថិជន"
  phone?: number;            // Column index for "លេខទូរសព្ទអតិថិជន"
  due_date?: number;         // Column index for "ថ្ងៃបង់ប្រាក់"
  amount?: number;           // Column index for "ប្រាក់ត្រូវបង់"
  installment?: number;      // Column index for "លើកទី"
  notes?: number;            // Column index for "បរិយាយ"
}

export function detectHeaders(
  rows: any[][],
  maxScanRows: number = 25
): { headerRowIndex: number; mapping: HeaderMapping } | null {
  // Implementation details in step 4
}
```

**Expected header variations**:
```typescript
const HEADER_PATTERNS = {
  customer_id: ['លេខ ផ្ទះ', 'លេខផ្ទះ', 'house code'],
  customer_name: ['ឈ្មោះអតិថិជន', 'customer name'],
  phone: ['លេខទូរសព្ទអតិថិជន', 'លេខទូរសព្ទ', 'phone'],
  due_date: ['ថ្ងៃបង់ប្រាក់', 'payment date', 'due date'],
  amount: ['ប្រាក់ត្រូវបង់', 'amount', 'ចំនួនទឹកប្រាក់'],
  installment: ['លើកទី', 'installment'],
  notes: ['បរិយាយ', 'notes', 'ផ្សេងៗ'],
};
```

### Step 4: Rewrite Excel Parser for Multi-Sheet
**File**: `excel-processor-local/src/services/excel-parser.service.ts`

**Current approach (❌)**:
```typescript
const sheetName = workbook.SheetNames[0];  // Only first sheet
const customer_name = String(row[2] || '').trim();  // Hardcoded index
```

**New approach (✅)**:
```typescript
async parseFile(filePath: string): Promise<ExcelRowData[]> {
  const workbook = XLSX.readFile(filePath, { cellDates: true, codepage: 65001 });

  // 1. Determine which sheets to process
  const sheetsToProcess = this.filterSheets(workbook.SheetNames);

  const allRows: ExcelRowData[] = [];

  // 2. Loop through each sheet
  for (const sheetName of sheetsToProcess) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: false
    }) as any[][];

    // 3. Detect headers dynamically
    const headerInfo = detectHeaders(jsonData, config.excel.headerScanRows);
    if (!headerInfo) {
      console.warn(`[Excel Parser] No headers found in sheet "${sheetName}", skipping`);
      continue;
    }

    const { headerRowIndex, mapping } = headerInfo;

    // 4. Extract data rows using dynamic mapping
    const sheetRows = this.extractRows(
      jsonData,
      headerRowIndex,
      mapping,
      sheetName,
      filePath
    );

    allRows.push(...sheetRows);
  }

  return allRows;
}

private filterSheets(allSheetNames: string[]): string[] {
  const { sheetsMode, sheetsAllowlist, sheetsDenylist, maxSheetsPerFile } = config.excel;

  let filtered = allSheetNames;

  switch (sheetsMode) {
    case 'first':
      filtered = [allSheetNames[0]];
      break;
    case 'allowlist':
      filtered = allSheetNames.filter(name => sheetsAllowlist.includes(name));
      break;
    case 'denylist':
      filtered = allSheetNames.filter(name => !sheetsDenylist.includes(name));
      break;
    case 'all':
    default:
      filtered = allSheetNames;
  }

  return filtered.slice(0, maxSheetsPerFile);
}

private extractRows(
  jsonData: any[][],
  headerRowIndex: number,
  mapping: HeaderMapping,
  sheetName: string,
  filePath: string
): ExcelRowData[] {
  const rows: ExcelRowData[] = [];
  let consecutiveBlankRows = 0;

  // Start from row after header
  for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
    const row = jsonData[i];

    // Extract using dynamic mapping
    const customer_id = mapping.customer_id !== undefined
      ? String(row[mapping.customer_id] || '').trim()
      : '';
    const customer_name = mapping.customer_name !== undefined
      ? String(row[mapping.customer_name] || '').trim()
      : '';
    const amount_raw = mapping.amount !== undefined
      ? String(row[mapping.amount] || '').trim()
      : '';
    const due_date_raw = mapping.due_date !== undefined
      ? String(row[mapping.due_date] || '').trim()
      : '';
    const phone = mapping.phone !== undefined
      ? String(row[mapping.phone] || '').trim()
      : '';
    const notes = mapping.notes !== undefined
      ? String(row[mapping.notes] || '').trim()
      : '';

    // Check if row is blank (both customer_id AND customer_name empty)
    if (!customer_id && !customer_name) {
      consecutiveBlankRows++;
      if (consecutiveBlankRows >= 3) {
        break; // Stop processing this sheet
      }
      continue;
    }

    consecutiveBlankRows = 0;

    // Skip rows without minimum required data
    if (!customer_name || !amount_raw) {
      continue;
    }

    rows.push({
      sheet_name: sheetName,
      source: {
        file: filePath,
        sheet: sheetName,
        row_index: i + 1  // 1-indexed Excel row
      },
      row_index: i + 1,
      customer_name,
      amount_raw,
      date_raw: due_date_raw,
      notes: notes || undefined,
      raw_data: {
        customer_code: customer_id,
        customer_name,
        phone,
        due_date: due_date_raw,
        amount: amount_raw,
        notes,
        sheet_name: sheetName
      }
    });
  }

  console.log(`[Excel Parser] Sheet "${sheetName}": Found ${rows.length} rows`);
  return rows;
}
```

### Step 5: Update Import Logging
**File**: `excel-processor-local/src/workers/excel-processor.ts`

Track per-sheet statistics:
```typescript
const sheetStats = new Map<string, {
  rows_found: number;
  rows_successful: number;
  rows_failed: number;
}>();

// During processing
for (const row of rows) {
  const sheetName = row.sheet_name;
  if (!sheetStats.has(sheetName)) {
    sheetStats.set(sheetName, { rows_found: 0, rows_successful: 0, rows_failed: 0 });
  }
  const stats = sheetStats.get(sheetName)!;
  stats.rows_found++;

  // ... process row ...

  if (success) {
    stats.rows_successful++;
  } else {
    stats.rows_failed++;
  }
}

// Add to import log
importLog.sheets_processed = Array.from(sheetStats.entries()).map(([sheet_name, stats]) => ({
  sheet_name,
  ...stats,
  header_row_index: 1  // TODO: Get from parser
}));
```

### Step 6: Update GPT Processing
**File**: `excel-processor-local/src/services/gpt-processing.service.ts`

Ensure sheet_name is preserved through GPT processing:
- Input to GPT includes sheet_name
- Output from GPT preserves sheet_name
- Validation errors reference sheet_name + row_index

### Step 7: Testing Plan

1. **Unit Tests** (create new test file):
   - Header detection with various Khmer layouts
   - Fuzzy header matching
   - Sheet filtering (all/first/allowlist/denylist)
   - Column mapping extraction

2. **Integration Tests**:
   - Test with actual 20-sheet Excel file
   - Test with sheets in different orders
   - Test with varying column layouts per sheet
   - Test with empty sheets (should skip)
   - Test with missing headers (should skip with warning)

3. **Validation**:
   - Verify all 20 sheets processed (not just first)
   - Verify total_rows = sum of all sheets
   - Verify sheet_name included in every row
   - Verify import log shows per-sheet breakdown
   - Verify Railway API receives correct data with sheet context

## Expected Outcomes

### Before (Current State)
```json
{
  "total_rows": 2,
  "successful_rows": 0,
  "failed_rows": 2,
  "errors": [...]
}
```
Only processes first sheet, ~2 rows found.

### After (Target State)
```json
{
  "total_rows": 234,
  "successful_rows": 226,
  "failed_rows": 8,
  "sheets_processed": [
    { "sheet_name": "Theary", "rows_found": 45, "rows_successful": 44, "rows_failed": 1 },
    { "sheet_name": "OF", "rows_found": 38, "rows_successful": 38, "rows_failed": 0 },
    { "sheet_name": "Sros", "rows_found": 52, "rows_successful": 50, "rows_failed": 2 },
    { "sheet_name": "Bery", "rows_found": 41, "rows_successful": 39, "rows_failed": 2 },
    { "sheet_name": "Seyi", "rows_found": 33, "rows_successful": 32, "rows_failed": 1 },
    ...
  ],
  "errors": [
    {
      "sheet_name": "Theary",
      "row_index": 12,
      "error_message": "Invalid amount format",
      ...
    }
  ]
}
```

## Critical Files to Modify

1. ✏️ `excel-processor-local/src/services/excel-parser.service.ts` - **Main rewrite**
2. ✏️ `excel-processor-local/src/models/excel-import.ts` - Add sheet_name fields
3. ✏️ `excel-processor-local/src/config.ts` - Add SHEETS_MODE config
4. ➕ `excel-processor-local/src/utils/header-detector.ts` - **New file**
5. ✏️ `excel-processor-local/src/workers/excel-processor.ts` - Track per-sheet stats
6. ✏️ `excel-processor-local/src/services/gpt-processing.service.ts` - Preserve sheet_name

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Header detection fails on some sheets | Log warnings, skip sheet, continue processing others |
| Different Khmer spellings not matched | Expand HEADER_PATTERNS with more variations |
| Performance with 20 sheets | Process sheets sequentially, add progress logging |
| Breaking existing functionality | Keep SHEETS_MODE=first as fallback option |

## Success Criteria

- ✅ All 20 sheets in Excel file processed (not just first)
- ✅ Each sheet's header row detected dynamically
- ✅ Column mapping works even if layout varies between sheets
- ✅ sheet_name included in all row data and logs
- ✅ SHEETS_MODE configuration works (all/first/allowlist/denylist)
- ✅ Import log shows per-sheet breakdown
- ✅ No hardcoded column indices remaining
- ✅ Handles empty sheets gracefully (skip with log)
- ✅ Processing 200+ rows succeeds with proper Railway sync

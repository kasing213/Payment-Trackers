/**
 * Excel Import Models
 *
 * Models for Excel file processing with GPT-4o-mini normalization
 */

// Raw Excel row data (before GPT processing)
export interface ExcelRowData {
  row_index: number;
  sheet_name: string;         // NEW: Which sheet this row came from
  customer_name: string;
  amount_raw: string;        // e.g., "150,000 KHR" or "$5,000"
  date_raw: string;           // e.g., "31/12/2025"
  notes?: string;
  raw_data: Record<string, any>;
  source: {                  // NEW: Full source tracking
    file: string;
    sheet: string;
    row_index: number;
    header_row_index?: number;
  };
}

// Normalized data (after GPT processing)
export interface NormalizedRowData {
  row_index: number;
  sheet_name?: string;        // NEW: Preserve sheet name through processing
  customer_id: string;
  customer_name: string;
  amount: { value: number; currency: string };
  invoice_date: Date;
  due_date: Date;
  notes?: string;
  validation_status: 'VALID' | 'WARNING' | 'ERROR';
  warnings: string[];
  errors: string[];
  source?: {                  // NEW: Source tracking
    file: string;
    sheet: string;
    row_index: number;
  };
}

// Import processing log
export interface ExcelImportLog {
  import_id: string;
  file_name: string;
  started_at: Date;
  completed_at?: Date;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  total_rows: number;
  successful_rows: number;    // New ARs created
  updated_rows: number;       // Existing ARs updated (data changed)
  duplicate_rows: number;     // Exact duplicates skipped
  failed_rows: number;

  // NEW: Per-sheet tracking
  sheets_processed?: Array<{
    sheet_name: string;
    rows_found: number;
    rows_successful: number;
    rows_failed: number;
    header_row_index: number;
  }>;

  sheets_skipped?: Array<{
    sheet_name: string;
    reason: string;  // e.g., "no headers found", "in denylist", etc.
  }>;

  errors: Array<{
    sheet_name?: string;      // NEW: Track which sheet had errors
    row_index: number;
    error_type: string;
    error_message: string;
    raw_data?: any;
  }>;
}

// GPT processing request/response types
export interface GPTProcessingRequest {
  rows: ExcelRowData[];
}

export interface GPTProcessingResponse {
  normalized_rows: Array<{
    row_index: number;
    customer_id: string;
    customer_name: string;
    amount: { value: number; currency: string };
    invoice_date: string;  // YYYY-MM-DD format
    due_date: string;      // YYYY-MM-DD format
    notes?: string;
    validation_status: 'VALID' | 'WARNING' | 'ERROR';
    warnings: string[];
    errors: string[];
  }>;
  errors: string[];
}

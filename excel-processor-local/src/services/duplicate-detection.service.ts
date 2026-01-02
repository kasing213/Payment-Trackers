import { NormalizedRowData } from '../models/excel-import';
import { RailwayAPIService } from './railway-api.service';

// Simplified ARState interface for local processor
interface ARState {
  ar_id: string;
  home_id: string;        // House/meter ID (e.g., "B101")
  zone: string;           // Zone/area (e.g., "Sros")
  customer_name: string;
  amount: { value: number; currency: string };
  invoice_date: Date;
  due_date: Date;
}

/**
 * Duplicate Detection Service (Local Processor)
 *
 * Detects duplicate ARs via Railway API and compares data to determine if updates are needed
 */
export class DuplicateDetectionService {
  constructor(private railwayApi: RailwayAPIService) {}

  /**
   * Detect if a normalized row matches an existing AR
   *
   * Match criteria: home_id + invoice_date (same home, same invoice period)
   *
   * @param row - Normalized row data from Excel
   * @returns Existing AR if duplicate found, null if new
   */
  async detectDuplicate(row: NormalizedRowData): Promise<ARState | null> {
    // Find ARs for this home via Railway API
    const homeARs = await this.railwayApi.getARsByHome(row.customer_id);  // customer_id field contains home_id

    if (homeARs.length === 0) {
      return null; // No existing ARs for this home
    }

    // Check for exact match by invoice_date
    // Match if invoice dates are within the same month
    const rowInvoiceMonth = this.getYearMonth(row.invoice_date);

    for (const ar of homeARs) {
      const arInvoiceMonth = this.getYearMonth(ar.invoice_date);

      if (rowInvoiceMonth === arInvoiceMonth) {
        // Found a match: same home + same invoice month
        return ar;
      }
    }

    // Fuzzy matching: check if amount + date within 7 days
    for (const ar of homeARs) {
      const daysDiff = Math.abs(
        (row.invoice_date.getTime() - ar.invoice_date.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (
        ar.amount.value === row.amount.value &&
        ar.amount.currency === row.amount.currency &&
        daysDiff <= 7
      ) {
        // Fuzzy match: same amount + date within 7 days
        console.warn(
          `Fuzzy match detected for home ${row.customer_id}: ` +
          `AR ${ar.ar_id} (${ar.invoice_date}) vs Excel row ${row.row_index} (${row.invoice_date})`
        );
        return ar;
      }
    }

    return null; // No duplicate found
  }

  /**
   * Compare AR data to detect if changes occurred
   *
   * @param existing - Existing AR state
   * @param newData - New normalized data from Excel
   * @returns True if data has changed, false if exact duplicate
   */
  compareARData(existing: ARState, newData: NormalizedRowData): boolean {
    // Compare amount
    if (
      existing.amount.value !== newData.amount.value ||
      existing.amount.currency !== newData.amount.currency
    ) {
      return true; // Amount changed
    }

    // Compare due_date (as timestamps)
    if (existing.due_date.getTime() !== newData.due_date.getTime()) {
      return true; // Due date changed
    }

    // Compare customer_name (in case of typo corrections)
    if (existing.customer_name !== newData.customer_name) {
      return true; // Customer name changed
    }

    // All critical fields match - exact duplicate
    return false;
  }

  /**
   * Get changes between existing AR and new data
   *
   * @param existing - Existing AR state
   * @param newData - New normalized data from Excel
   * @returns Object with changed fields
   */
  getChanges(existing: ARState, newData: NormalizedRowData): {
    amount_changed: boolean;
    due_date_changed: boolean;
    customer_name_changed: boolean;
    changes: string[];
  } {
    const changes: string[] = [];
    let amount_changed = false;
    let due_date_changed = false;
    let customer_name_changed = false;

    // Check amount change
    if (
      existing.amount.value !== newData.amount.value ||
      existing.amount.currency !== newData.amount.currency
    ) {
      amount_changed = true;
      changes.push(
        `Amount: ${existing.amount.value} ${existing.amount.currency} → ` +
        `${newData.amount.value} ${newData.amount.currency}`
      );
    }

    // Check due date change
    if (existing.due_date.getTime() !== newData.due_date.getTime()) {
      due_date_changed = true;
      changes.push(
        `Due Date: ${existing.due_date.toISOString().split('T')[0]} → ` +
        `${newData.due_date.toISOString().split('T')[0]}`
      );
    }

    // Check customer name change
    if (existing.customer_name !== newData.customer_name) {
      customer_name_changed = true;
      changes.push(
        `Customer Name: ${existing.customer_name} → ${newData.customer_name}`
      );
    }

    return {
      amount_changed,
      due_date_changed,
      customer_name_changed,
      changes
    };
  }

  /**
   * Get year-month string for date comparison
   * @param date - Date to extract year-month from
   * @returns YYYY-MM string
   */
  private getYearMonth(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}

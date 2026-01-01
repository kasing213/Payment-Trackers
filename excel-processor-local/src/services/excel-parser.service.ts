import * as XLSX from 'xlsx';
import { ExcelRowData } from '../models/excel-import';

/**
 * Excel Parser Service
 *
 * Parses Excel files (.xlsx) with Khmer Unicode support
 */
export class ExcelParserService {
  /**
   * Parse an Excel file and extract rows
   *
   * @param filePath - Path to the Excel file
   * @returns Array of raw Excel row data
   */
  async parseFile(filePath: string): Promise<ExcelRowData[]> {
    try {
      // Read the Excel file (supports Khmer Unicode)
      const workbook = XLSX.readFile(filePath, {
        type: 'file',
        cellDates: true,
        cellNF: false,
        cellText: false,
        // Preserve Unicode characters (including Khmer)
        codepage: 65001
      });

      // Get the first sheet
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error('Excel file has no sheets');
      }

      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error(`Sheet "${sheetName}" not found in workbook`);
      }

      // Convert sheet to JSON (array of objects)
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,  // Use numeric column headers
        defval: '', // Default value for empty cells
        blankrows: false, // Skip blank rows
        raw: false  // Format values as strings
      }) as any[][];

      // Skip the first 2 rows (title row and headers) and extract data
      const rows: ExcelRowData[] = [];

      for (let i = 2; i < jsonData.length; i++) {
        const row = jsonData[i];

        // Skip empty rows
        if (!row || row.length === 0 || !row[1]) {
          continue;
        }

        // Extract data from columns based on actual Excel structure:
        // A (index 0): Order number
        // B (index 1): Customer ID
        // C (index 2): Customer Name
        // D (index 3): Phone 1
        // E (index 4): Phone 2
        // F (index 5): Payment Date
        // G (index 6): Amount
        // H (index 7): Notes/Status
        const customer_code = String(row[1] || '').trim();      // Column B: Customer ID
        const customer_name = String(row[2] || '').trim();      // Column C: Customer Name
        const phone_1 = String(row[3] || '').trim();            // Column D: Phone 1
        const phone_2 = String(row[4] || '').trim();            // Column E: Phone 2
        const payment_date_raw = String(row[5] || '').trim();   // Column F: Payment Date
        const amount_raw = String(row[6] || '').trim();         // Column G: Amount
        const notes = String(row[7] || '').trim();              // Column H: Notes

        // Skip rows without minimum required data
        if (!customer_name || !amount_raw) {
          continue;
        }

        // Combine phone numbers
        const phone = [phone_1, phone_2].filter(p => p).join(' / ');

        rows.push({
          row_index: i + 1, // 1-indexed row number
          customer_name,
          amount_raw,
          date_raw: payment_date_raw,
          notes: notes || undefined,
          raw_data: {
            customer_code,
            customer_name,
            phone,
            due_date: payment_date_raw,
            amount: amount_raw,
            notes
          }
        });
      }

      if (rows.length === 0) {
        throw new Error('No valid data rows found in Excel file');
      }

      return rows;

    } catch (error: any) {
      throw new Error(`Excel parsing failed: ${error.message}`);
    }
  }

  /**
   * Validate Excel file structure
   *
   * @param filePath - Path to the Excel file
   * @returns True if file is valid, throws error otherwise
   */
  async validateFile(filePath: string): Promise<boolean> {
    try {
      const workbook = XLSX.readFile(filePath);

      if (workbook.SheetNames.length === 0) {
        throw new Error('Excel file has no sheets');
      }

      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error('Excel file has no sheets');
      }

      const worksheet = workbook.Sheets[firstSheetName];
      if (!worksheet) {
        throw new Error(`Sheet "${firstSheetName}" not found in workbook`);
      }

      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

      // Check if file has at least 2 rows (header + 1 data row)
      if (range.e.r < 1) {
        throw new Error('Excel file must have at least one data row');
      }

      // Check if file has at least 2 columns (customer name + amount)
      if (range.e.c < 1) {
        throw new Error('Excel file must have at least 2 columns (customer name and amount)');
      }

      return true;

    } catch (error: any) {
      throw new Error(`Excel validation failed: ${error.message}`);
    }
  }
}

import * as XLSX from 'xlsx';
import { ExcelRowData } from '../models/excel-import';
import { getConfig } from '../config';
import { detectHeaders, HeaderDetectionResult } from '../utils/header-detector';

/**
 * Excel Parser Service
 *
 * Parses Excel files (.xlsx) with Khmer Unicode support
 * Features:
 * - Multi-sheet processing (configurable via SHEETS_MODE)
 * - Dynamic header detection (no hardcoded column indices)
 * - Local amount/date parsing before GPT
 * - Per-sheet tracking
 */
export class ExcelParserService {
  /**
   * Parse an Excel file and extract rows from all configured sheets
   *
   * @param filePath - Path to the Excel file
   * @param fileName - Original file name (for tracking)
   * @returns Array of raw Excel row data from all sheets
   */
  async parseFile(filePath: string, fileName: string): Promise<ExcelRowData[]> {
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

      console.log(`[Excel Parser] File: ${fileName}`);
      console.log(`[Excel Parser] Total sheets in workbook: ${workbook.SheetNames.length}`);
      console.log(`[Excel Parser] Sheet names: ${workbook.SheetNames.join(', ')}`);

      // Determine which sheets to process based on SHEETS_MODE
      const sheetsToProcess = this.selectSheets(workbook.SheetNames);

      if (sheetsToProcess.length === 0) {
        throw new Error('No sheets selected for processing. Check SHEETS_MODE configuration.');
      }

      console.log(`[Excel Parser] Processing ${sheetsToProcess.length} sheets: ${sheetsToProcess.join(', ')}`);

      // Process each sheet
      const allRows: ExcelRowData[] = [];
      const sheetsSkipped: Array<{ sheet_name: string; reason: string }> = [];

      for (const sheetName of sheetsToProcess) {
        try {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) {
            throw new Error(`Sheet "${sheetName}" not found in workbook`);
          }

          const sheetRows = await this.processSheet(
            worksheet,
            sheetName,
            fileName,
            filePath
          );

          allRows.push(...sheetRows);
          console.log(`[Excel Parser] ✓ Sheet "${sheetName}": ${sheetRows.length} rows extracted`);

        } catch (sheetError: any) {
          console.warn(`[Excel Parser] ✗ Sheet "${sheetName}" skipped: ${sheetError.message}`);
          sheetsSkipped.push({
            sheet_name: sheetName,
            reason: sheetError.message
          });
          // Continue processing other sheets
        }
      }

      if (allRows.length === 0) {
        throw new Error(
          `No valid data rows found across all sheets.\n` +
          `Sheets skipped: ${sheetsSkipped.map(s => `${s.sheet_name} (${s.reason})`).join(', ')}`
        );
      }

      console.log(`[Excel Parser] Total rows extracted: ${allRows.length} from ${sheetsToProcess.length - sheetsSkipped.length} sheets`);

      return allRows;

    } catch (error: any) {
      throw new Error(`Excel parsing failed: ${error.message}`);
    }
  }

  /**
   * Select which sheets to process based on SHEETS_MODE configuration
   */
  private selectSheets(allSheetNames: string[]): string[] {
    const config = getConfig();
    let selected: string[] = [];

    switch (config.sheetsMode) {
      case 'first':
        selected = allSheetNames.slice(0, 1);
        console.log(`[Excel Parser] Mode: first - Processing only first sheet`);
        break;

      case 'allowlist':
        selected = allSheetNames.filter(name =>
          config.sheetsAllowlist.some(allowed =>
            name.toLowerCase().includes(allowed.toLowerCase())
          )
        );
        console.log(`[Excel Parser] Mode: allowlist - Allowed: ${config.sheetsAllowlist.join(', ')}`);
        break;

      case 'denylist':
        selected = allSheetNames.filter(name =>
          !config.sheetsDenylist.some(denied =>
            name.toLowerCase().includes(denied.toLowerCase())
          )
        );
        console.log(`[Excel Parser] Mode: denylist - Denied: ${config.sheetsDenylist.join(', ')}`);
        break;

      case 'all':
      default:
        selected = allSheetNames;
        console.log(`[Excel Parser] Mode: all - Processing all sheets`);
        break;
    }

    // Apply max sheets limit
    if (selected.length > config.maxSheetsPerFile) {
      console.warn(
        `[Excel Parser] Limiting from ${selected.length} to ${config.maxSheetsPerFile} sheets (MAX_SHEETS_PER_FILE)`
      );
      selected = selected.slice(0, config.maxSheetsPerFile);
    }

    return selected;
  }

  /**
   * Process a single sheet with dynamic header detection
   */
  private async processSheet(
    worksheet: XLSX.WorkSheet,
    sheetName: string,
    fileName: string,
    filePath: string
  ): Promise<ExcelRowData[]> {
    const config = getConfig();

    // Convert sheet to 2D array
    const sheetData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
      raw: false
    }) as any[][];

    if (sheetData.length === 0) {
      throw new Error('Sheet is empty');
    }

    // Detect headers dynamically
    const headerResult = detectHeaders(sheetData, {
      maxRowsToScan: config.headerScanRows,
      minRequiredHeaders: config.minRequiredHeaders
    });

    if (!headerResult) {
      throw new Error(
        `No valid header row found in first ${config.headerScanRows} rows. ` +
        `Expected Khmer headers like "ឈ្មោះអតិថិជន", "ប្រាក់ត្រូវបង់", etc.`
      );
    }

    console.log(
      `[Excel Parser] Sheet "${sheetName}" - Headers detected at row ${headerResult.headerRowIndex + 1} ` +
      `(confidence: ${headerResult.confidence.toFixed(0)}%)`
    );
    console.log(`[Excel Parser] Matched headers: ${headerResult.matchedHeaders.join(', ')}`);

    if (headerResult.unmatchedExpected.length > 0) {
      console.warn(`[Excel Parser] Missing headers: ${headerResult.unmatchedExpected.join(', ')}`);
    }

    // Extract data rows using dynamic column mapping
    const rows = this.extractRows(
      sheetData,
      sheetName,
      fileName,
      filePath,
      headerResult
    );

    return rows;
  }

  /**
   * Extract data rows from sheet using dynamic column mapping
   */
  private extractRows(
    sheetData: any[][],
    sheetName: string,
    fileName: string,
    _filePath: string,
    headerResult: HeaderDetectionResult
  ): ExcelRowData[] {
    const rows: ExcelRowData[] = [];
    const dataStartRow = headerResult.headerRowIndex + 1;
    const mapping = headerResult.mapping;

    let consecutiveBlankRows = 0;
    let validRowsFound = 0;
    const MIN_VALID_ROWS_BEFORE_STOPPING = 5;
    const MAX_BLANK_ROWS = 3;

    for (let i = dataStartRow; i < sheetData.length; i++) {
      const row = sheetData[i] || [];

      // Extract fields using detected column indices
      const home_id = this.getCellValue(row, mapping.home_id);
      const customer_name = this.getCellValue(row, mapping.customer_name);
      const phone = this.getCellValue(row, mapping.phone);
      const due_date_raw = this.getCellValue(row, mapping.due_date);
      const amount_raw = this.getCellValue(row, mapping.amount);
      const installment = this.getCellValue(row, mapping.installment);
      const notes = this.getCellValue(row, mapping.notes);

      // Check if row is blank (no customer ID and no customer name)
      if (!home_id && !customer_name) {
        consecutiveBlankRows++;
        // Only stop after finding some valid rows (don't break too early)
        if (consecutiveBlankRows >= MAX_BLANK_ROWS && validRowsFound >= MIN_VALID_ROWS_BEFORE_STOPPING) {
          console.log(
            `[Excel Parser] Sheet "${sheetName}" - Stopping at row ${i + 1} ` +
            `(${MAX_BLANK_ROWS} consecutive blank rows after ${validRowsFound} valid rows)`
          );
          break;
        }
        continue;
      }

      consecutiveBlankRows = 0;

      // Skip rows without minimum required fields
      if (!customer_name || !amount_raw) {
        console.warn(
          `[Excel Parser] Sheet "${sheetName}", Row ${i + 1} - Missing required fields (customer_name or amount), skipping`
        );
        continue;
      }

      validRowsFound++;

      // LOCAL PARSING FIRST (before GPT)
      // Parse amount: strip "៛", "KHR", "$", commas
      const amount_parsed = this.parseAmount(amount_raw);

      // Parse date: handle Excel serial dates, DD/MM/YYYY, etc.
      const due_date_parsed = this.parseDate(due_date_raw);

      // Ensure we always have string values for amount and date
      const finalAmountRaw = (amount_parsed.success && amount_parsed.value
        ? amount_parsed.value.toString()
        : (amount_raw || '')) as string;

      const finalDateRaw = (due_date_parsed.success && due_date_parsed.value
        ? this.formatDate(due_date_parsed.value)
        : (due_date_raw || '')) as string;

      rows.push({
        row_index: i + 1,  // 1-indexed Excel row number
        sheet_name: sheetName,
        home_id,
        customer_name,
        amount_raw: finalAmountRaw,
        date_raw: finalDateRaw,
        notes: notes || undefined,
        raw_data: {
          home_id,
          customer_name,
          phone,
          due_date: due_date_raw,
          amount: amount_raw,
          installment,
          notes
        },
        source: {
          file: fileName,
          sheet: sheetName,
          row_index: i + 1,
          header_row_index: headerResult.headerRowIndex + 1
        }
      });
    }

    return rows;
  }

  /**
   * Get cell value from row by column index (handles undefined indices)
   */
  private getCellValue(row: any[], colIndex: number | undefined): string {
    if (colIndex === undefined) return '';
    const value = row[colIndex];
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  /**
   * Local amount parser (USD only, no Riel conversion)
   * Strips currency symbols before returning numeric value
   */
  private parseAmount(raw: string): { success: boolean; value?: number } {
    try {
      if (!raw) return { success: false };

      // Strip currency symbols: "៛", "KHR", "$", "USD"
      const cleaned = raw
        .replace(/[៛$]/g, '')
        .replace(/KHR|USD/gi, '')
        .replace(/,/g, '')
        .trim();

      const parsed = parseFloat(cleaned);

      if (isNaN(parsed) || parsed <= 0) {
        return { success: false };
      }

      return { success: true, value: parsed };

    } catch {
      return { success: false };
    }
  }

  /**
   * Local date parser (handle Excel serial dates and string formats)
   */
  private parseDate(raw: string | number): { success: boolean; value?: Date } {
    try {
      if (!raw) return { success: false };

      // If already a number (Excel serial date)
      if (typeof raw === 'number') {
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + raw * 86400000);

        if (!isNaN(date.getTime())) {
          return { success: true, value: date };
        }
      }

      // Try parsing string formats
      const parsed = new Date(raw);

      if (!isNaN(parsed.getTime())) {
        return { success: true, value: parsed };
      }

      return { success: false };

    } catch {
      return { success: false };
    }
  }

  /**
   * Format date as YYYY-MM-DD using local date parts (no timezone shift)
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

      // Check at least one sheet has data
      let hasData = false;
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) continue;

        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

        // Check if sheet has at least 2 rows (header + 1 data row)
        if (range.e.r >= 1) {
          hasData = true;
          break;
        }
      }

      if (!hasData) {
        throw new Error('Excel file has no sheets with data');
      }

      return true;

    } catch (error: any) {
      throw new Error(`Excel validation failed: ${error.message}`);
    }
  }
}

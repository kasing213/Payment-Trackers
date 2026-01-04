import OpenAI from 'openai';
import { ExcelRowData, NormalizedRowData } from '../models/excel-import';
import { addMonths } from '../utils/date-helpers';

/**
 * GPT Processing Service
 *
 * Uses OpenAI GPT-4o-mini to normalize and validate Excel data
 */
export class GPTProcessingService {
  private openai: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    this.openai = new OpenAI({ apiKey });
    this.model = model;
  }

  /**
   * Process a batch of Excel rows using GPT-4o-mini
   *
   * @param rows - Array of raw Excel row data
   * @returns Array of normalized row data
   */
  async processBatch(rows: ExcelRowData[]): Promise<NormalizedRowData[]> {
    if (rows.length === 0) {
      return [];
    }

    // Create mapping of row_index to sheet_name BEFORE GPT processing
    // This preserves metadata that GPT doesn't need to process
    const sheetNameMap = new Map<number, string>();
    const excelDateMap = new Map<string, Date>();
    rows.forEach(row => {
      sheetNameMap.set(row.row_index, row.sheet_name);
      const parsedExcelDate = this.parseExcelDate(row.date_raw);
      if (parsedExcelDate) {
        const key = this.buildRowKey(row.row_index, row.home_id, row.customer_name);
        if (key) {
          excelDateMap.set(key, parsedExcelDate);
        }
      }
    });

    try {
      const response = await this.callGPT(rows);
      const normalized = this.parseGPTResponse(response);

      // Map sheet_name back to normalized rows using row_index
      // Set invoice_date to processing date and due_date from Excel + 1 month
      return normalized.map(row => {
        const excelDate = this.getExcelDate(row, excelDateMap);
        const invoiceDate = new Date();
        const adjustedDueDate = excelDate ? addMonths(excelDate, 1) : new Date();
        const errors = excelDate
          ? row.errors
          : [...row.errors, 'Invalid due date from Excel'];
        const validation_status = excelDate ? row.validation_status : 'ERROR';

        return {
          ...row,
          sheet_name: sheetNameMap.get(row.row_index),
          invoice_date: invoiceDate,
          due_date: adjustedDueDate,
          validation_status,
          errors
        };
      });

    } catch (error: any) {
      // Retry logic with exponential backoff
      console.error('GPT API call failed, retrying...', error.message);
      await this.sleep(1000);

      try {
        const response = await this.callGPT(rows);
        const normalized = this.parseGPTResponse(response);

        // Map sheet_name back (retry path)
        // Set invoice_date to processing date and due_date from Excel + 1 month
        return normalized.map(row => {
          const excelDate = this.getExcelDate(row, excelDateMap);
          const invoiceDate = new Date();
          const adjustedDueDate = excelDate ? addMonths(excelDate, 1) : new Date();
          const errors = excelDate
            ? row.errors
            : [...row.errors, 'Invalid due date from Excel'];
          const validation_status = excelDate ? row.validation_status : 'ERROR';

          return {
            ...row,
            sheet_name: sheetNameMap.get(row.row_index),
            invoice_date: invoiceDate,
            due_date: adjustedDueDate,
            validation_status,
            errors
          };
        });

      } catch (retryError: any) {
        console.error('GPT API retry failed:', retryError.message);

        // Return rows with error status
        return rows.map(row => ({
          row_index: row.row_index,
          sheet_name: row.sheet_name,  // Preserve sheet_name in error path
          home_id: row.home_id || this.generateHomeId(row.customer_name),
          customer_name: row.customer_name,
          amount: { value: 0, currency: 'USD' },
          invoice_date: new Date(),
          due_date: addMonths(this.parseExcelDate(row.date_raw) || new Date(), 1),
          notes: row.notes,
          validation_status: 'ERROR' as const,
          warnings: [],
          errors: [
            `GPT processing failed: ${retryError.message}`,
            ...(this.parseExcelDate(row.date_raw) ? [] : ['Invalid due date from Excel'])
          ]
        }));
      }
    }
  }

  /**
   * Call GPT-4o-mini API with system prompt
   */
  private async callGPT(rows: ExcelRowData[]): Promise<string> {
    const systemPrompt = this.getSystemPrompt();

    // Format input according to excel-to-json.md documentation
    const formattedRows = rows.map(row => ({
      row_index: row.row_index,
      data: row.raw_data
    }));

    const userPrompt = JSON.stringify(formattedRows, null, 2);

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1, // Low temperature for consistent outputs
      max_tokens: 4000
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('GPT API returned no content');
    }

    return content;
  }

  /**
   * Parse GPT response into normalized row data
   */
  private parseGPTResponse(response: string): NormalizedRowData[] {
    try {
      // Extract JSON array from response (in case GPT includes markdown code blocks)
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No JSON array found in GPT response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(parsed)) {
        throw new Error('GPT response is not an array');
      }

      // Transform GPT output format to NormalizedRowData format
      return parsed.map(item => {
        const home_id = item.customer?.home_id
          || item.customer?.customer_ref
          || this.generateHomeId(item.customer?.name || '');
        const customer_name = item.customer?.name || '';
        const amount = {
          value: item.ar?.amount || 0,
          currency: item.ar?.currency || 'USD'
        };
        const due_date_str = item.ar?.due_date;
        const due_date = due_date_str ? new Date(due_date_str) : new Date();

        return {
          row_index: item.row_index,
          home_id,
          customer_name,
          amount,
          invoice_date: new Date(), // Will be overwritten in processBatch()
          due_date,
          notes: item.notes || undefined,
          validation_status: item.validation_status || 'VALID',
          warnings: item.warnings || [],
          errors: item.errors || []
        };
      });

    } catch (error: any) {
      throw new Error(`Failed to parse GPT response: ${error.message}`);
    }
  }

  /**
   * Get the system prompt for GPT-4o-mini
   * Based on excel-to-json.md documentation
   */
  private getSystemPrompt(): string {
    return `You are an Excel → JSON translator. You convert messy Excel row data into clean JSON.

STRICT RULES:
- Output JSON only (no explanations)
- Preserve Khmer text exactly
- Convert dates to YYYY-MM-DD format
- Remove currency symbols from amounts ($ or ៛)
- Convert amounts to numbers
- Split phone numbers into arrays
- If value is missing → use null
- Do NOT invent missing data
- Do NOT make business decisions
- Detect currency from symbols: $ = USD, ៛ = KHR, default = USD

You are a translator, not a judge.

INPUT FORMAT (array of objects):
[
  {
    "row_index": number,
    "data": {
      "home_id": "string (house/meter ID)",
      "customer_name": "string",
      "phone": "phone1 / phone2",
      "due_date": "date string",
      "amount": "amount with currency",
      "notes": "string"
    }
  }
]

OUTPUT FORMAT (array of objects):
[
  {
    "row_index": number,
    "customer": {
      "home_id": "home_id from input (do not invent unless missing)",
      "name": "customer_name (preserve Khmer exactly)",
      "phones": ["phone1", "phone2"]
    },
    "ar": {
      "amount": number (without currency symbols),
      "currency": "USD|KHR",
      "due_date": "YYYY-MM-DD"
    },
    "notes": "string or null",
    "validation_status": "VALID|WARNING|ERROR",
    "warnings": ["array of warnings"],
    "errors": ["array of errors"]
  }
]

EXAMPLES:
Input: [{"row_index": 4, "data": {"home_id": "B101", "customer_name": "សុក ពិសី", "phone": "010 683020 / 069 705019", "due_date": "12/30/2025", "amount": "$136.00", "notes": "បង់គ្រប់"}}]

Output: [{"row_index": 4, "customer": {"home_id": "B101", "name": "សុក ពិសី", "phones": ["010683020", "069705019"]}, "ar": {"amount": 136, "currency": "USD", "due_date": "2025-12-30"}, "notes": "បង់គ្រប់", "validation_status": "VALID", "warnings": [], "errors": []}]`;
  }

  /**
   * Parse date from Excel raw value
   */
  private parseExcelDate(raw: unknown): Date | null {
    if (!raw) return null;

    if (raw instanceof Date) {
      return isNaN(raw.getTime()) ? null : this.toUtcDate(raw);
    }

    if (typeof raw === 'number') {
      const excelEpoch = Date.UTC(1899, 11, 30);
      const date = new Date(excelEpoch + raw * 86400000);
      return isNaN(date.getTime()) ? null : date;
    }

    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (!trimmed) return null;

      const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
      if (isoMatch) {
        const [, yearStr, monthStr, dayStr] = isoMatch;
        if (!yearStr || !monthStr || !dayStr) return null;
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const day = parseInt(dayStr, 10);
        return this.buildUtcDate(year, month, day);
      }

      const slashMatch = trimmed.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
      if (slashMatch) {
        const [, partAStr, partBStr, yearStr] = slashMatch;
        if (!partAStr || !partBStr || !yearStr) return null;
        const partA = parseInt(partAStr, 10);
        const partB = parseInt(partBStr, 10);
        let year = parseInt(yearStr, 10);
        if (year < 100) {
          year += 2000;
        }

        let month = partA;
        let day = partB;

        if (partA > 12 && partB <= 12) {
          day = partA;
          month = partB;
        }

        return this.buildUtcDate(year, month, day);
      }

      const parsed = new Date(trimmed);
      return isNaN(parsed.getTime()) ? null : this.toUtcDate(parsed);
    }

    return null;
  }

  /**
   * Resolve Excel date for a normalized row
   */
  private getExcelDate(row: NormalizedRowData, excelDateMap: Map<string, Date>): Date | null {
    const key = this.buildRowKey(row.row_index, row.home_id, row.customer_name);
    if (!key) return null;
    return excelDateMap.get(key) || null;
  }

  /**
   * Convert a date to UTC midnight using local date parts
   */
  private toUtcDate(date: Date): Date {
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  }

  /**
   * Build a UTC date from parts (1-based month)
   */
  private buildUtcDate(year: number, month: number, day: number): Date | null {
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Build a stable key for row lookups
   */
  private buildRowKey(row_index: number, home_id?: string, customer_name?: string): string | null {
    const base = (home_id && home_id.trim())
      ? home_id.trim()
      : (customer_name || '').trim();

    if (!base) {
      return null;
    }

    return `${row_index}|${base}`;
  }

  /**
   * Generate home ID from customer name
   */
  private generateHomeId(name: string): string {
    // Sanitize name: remove special chars, convert to uppercase
    const sanitized = name
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .toUpperCase();

    return `HOME_${sanitized}`;
  }

  /**
   * Sleep utility for retry logic
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

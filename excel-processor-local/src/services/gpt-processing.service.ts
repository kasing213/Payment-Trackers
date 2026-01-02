import OpenAI from 'openai';
import { ExcelRowData, NormalizedRowData } from '../models/excel-import';

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
    rows.forEach(row => {
      sheetNameMap.set(row.row_index, row.sheet_name);
    });

    try {
      const response = await this.callGPT(rows);
      const normalized = this.parseGPTResponse(response);

      // Map sheet_name back to normalized rows using row_index
      return normalized.map(row => ({
        ...row,
        sheet_name: sheetNameMap.get(row.row_index)
      }));

    } catch (error: any) {
      // Retry logic with exponential backoff
      console.error('GPT API call failed, retrying...', error.message);
      await this.sleep(1000);

      try {
        const response = await this.callGPT(rows);
        const normalized = this.parseGPTResponse(response);

        // Map sheet_name back (retry path)
        return normalized.map(row => ({
          ...row,
          sheet_name: sheetNameMap.get(row.row_index)
        }));

      } catch (retryError: any) {
        console.error('GPT API retry failed:', retryError.message);

        // Return rows with error status
        return rows.map(row => ({
          row_index: row.row_index,
          sheet_name: row.sheet_name,  // Preserve sheet_name in error path
          customer_id: this.generateCustomerId(row.customer_name),
          customer_name: row.customer_name,
          amount: { value: 0, currency: 'USD' },
          invoice_date: new Date(),
          due_date: new Date(),
          notes: row.notes,
          validation_status: 'ERROR' as const,
          warnings: [],
          errors: [`GPT processing failed: ${retryError.message}`]
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
        const customer_id = item.customer?.customer_ref || this.generateCustomerId(item.customer?.name || '');
        const customer_name = item.customer?.name || '';
        const amount = {
          value: item.ar?.amount || 0,
          currency: item.ar?.currency || 'USD'
        };
        const due_date_str = item.ar?.due_date;
        const due_date = due_date_str ? new Date(due_date_str) : new Date();

        return {
          row_index: item.row_index,
          customer_id,
          customer_name,
          amount,
          invoice_date: due_date, // Use same date for invoice and due date for now
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
      "customer_code": "string",
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
      "customer_ref": "customer_code from input",
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
Input: [{"row_index": 4, "data": {"customer_code": "B101", "customer_name": "សុក ពិសី", "phone": "010 683020 / 069 705019", "due_date": "12/30/2025", "amount": "$136.00", "notes": "បង់គ្រប់"}}]

Output: [{"row_index": 4, "customer": {"customer_ref": "B101", "name": "សុក ពិសី", "phones": ["010683020", "069705019"]}, "ar": {"amount": 136, "currency": "USD", "due_date": "2025-12-30"}, "notes": "បង់គ្រប់", "validation_status": "VALID", "warnings": [], "errors": []}]`;
  }

  /**
   * Generate customer ID from customer name
   */
  private generateCustomerId(name: string): string {
    // Sanitize name: remove special chars, convert to uppercase
    const sanitized = name
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .toUpperCase();

    return `CUST_${sanitized}`;
  }

  /**
   * Sleep utility for retry logic
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

import OpenAI from 'openai';
import { ExcelRowData, NormalizedRowData, GPTProcessingResponse } from '../models/excel-import';

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

    try {
      const response = await this.callGPT(rows);
      return this.parseGPTResponse(response);

    } catch (error: any) {
      // Retry logic with exponential backoff
      console.error('GPT API call failed, retrying...', error.message);
      await this.sleep(1000);

      try {
        const response = await this.callGPT(rows);
        return this.parseGPTResponse(response);

      } catch (retryError: any) {
        console.error('GPT API retry failed:', retryError.message);

        // Return rows with error status
        return rows.map(row => ({
          row_index: row.row_index,
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
    const userPrompt = JSON.stringify({ rows }, null, 2);

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
      // Extract JSON from response (in case GPT includes markdown code blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in GPT response');
      }

      const parsed: GPTProcessingResponse = JSON.parse(jsonMatch[0]);

      if (!parsed.normalized_rows || !Array.isArray(parsed.normalized_rows)) {
        throw new Error('Invalid GPT response structure');
      }

      // Convert GPT response to NormalizedRowData
      return parsed.normalized_rows.map(row => ({
        row_index: row.row_index,
        customer_id: row.customer_id,
        customer_name: row.customer_name,
        amount: row.amount,
        invoice_date: new Date(row.invoice_date),
        due_date: new Date(row.due_date),
        notes: row.notes,
        validation_status: row.validation_status,
        warnings: row.warnings || [],
        errors: row.errors || []
      }));

    } catch (error: any) {
      throw new Error(`Failed to parse GPT response: ${error.message}`);
    }
  }

  /**
   * Get the system prompt for GPT-4o-mini
   */
  private getSystemPrompt(): string {
    return `You are a data normalization assistant for an Accounts Receivable system.

INPUT: Excel row data with potentially messy formats
OUTPUT: Structured JSON with validated, normalized data

CRITICAL RULES:
1. Output JSON only (no explanations)
2. Don't invent missing required data
3. Preserve Khmer text exactly as provided
4. Normalize dates to YYYY-MM-DD format
5. Convert amounts to numbers (remove commas, currency symbols)
6. Extract currency from context ($ = USD, ៛ = KHR, default = USD)
7. Generate customer_id if missing: CUST_<sanitized_name_uppercase>
8. If invoice date is missing, use current month start date
9. If due date is missing, use invoice date + 30 days

OUTPUT SCHEMA:
{
  "normalized_rows": [{
    "row_index": number,
    "customer_id": "string",
    "customer_name": "string (exact from input)",
    "amount": { "value": number, "currency": "USD|KHR" },
    "invoice_date": "YYYY-MM-DD",
    "due_date": "YYYY-MM-DD",
    "notes": "string",
    "validation_status": "VALID|WARNING|ERROR",
    "warnings": ["array of warnings"],
    "errors": ["array of errors"]
  }],
  "errors": []
}

EXAMPLES:
Input: { "customer_name": "សូ ពិសី", "amount_raw": "150,000 KHR", "date_raw": "31/12/2025" }
Output: {
  "normalized_rows": [{
    "row_index": 1,
    "customer_id": "CUST_SO_PISI",
    "customer_name": "សូ ពិសី",
    "amount": { "value": 150000, "currency": "KHR" },
    "invoice_date": "2025-12-01",
    "due_date": "2025-12-31",
    "notes": "",
    "validation_status": "VALID",
    "warnings": [],
    "errors": []
  }],
  "errors": []
}

Input: { "customer_name": "Acme Corp", "amount_raw": "$5,000", "date_raw": "01/01/2025" }
Output: {
  "normalized_rows": [{
    "row_index": 1,
    "customer_id": "CUST_ACME_CORP",
    "customer_name": "Acme Corp",
    "amount": { "value": 5000, "currency": "USD" },
    "invoice_date": "2025-01-01",
    "due_date": "2025-01-31",
    "notes": "",
    "validation_status": "VALID",
    "warnings": [],
    "errors": []
  }],
  "errors": []
}`;
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

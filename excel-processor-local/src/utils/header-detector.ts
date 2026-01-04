/**
 * Header Detection Utility
 *
 * Dynamically detects Khmer/English headers in Excel sheets
 * Supports fuzzy matching, two-row headers, and scoring-based selection
 */

/**
 * Column mapping result
 * Maps field names to column indices
 */
export interface HeaderMapping {
  home_id?: number;         // Column index for "លេខ ផ្ទះ"
  customer_name?: number;   // Column index for "ឈ្មោះអតិថិជន"
  phone?: number;           // Column index for "លេខទូរសព្ទអតិថិជន"
  due_date?: number;        // Column index for "ថ្ងៃបង់ប្រាក់"
  amount?: number;          // Column index for "ប្រាក់ត្រូវបង់"
  installment?: number;     // Column index for "លើកទី"
  notes?: number;           // Column index for "បរិយាយ"
}

/**
 * Header detection result
 */
export interface HeaderDetectionResult {
  headerRowIndex: number;       // 0-indexed row number where headers were found
  mapping: HeaderMapping;       // Column index mapping
  matchedHeaders: string[];     // List of matched headers (for debugging)
  unmatchedExpected: string[];  // Required headers that weren't found
  confidence: number;           // Overall confidence score (0-100)
}

/**
 * Configuration for header detection
 */
export interface HeaderDetectionConfig {
  maxRowsToScan?: number;       // Default: 25
  minRequiredHeaders?: number;  // Default: 4
  minConfidence?: number;       // Default: 70
}

/**
 * Expected header patterns (Khmer + English variations)
 * Each field has multiple variations to handle different spellings/spacing
 */
const HEADER_PATTERNS: Record<string, string[]> = {
  home_id: [
    'លេខ ផ្ទះ',
    'លេខផ្ទះ',
    'ផ្ទះលេខ',
    'home id',
    'house id',
    'home',
    'house code',
    'code',
    'id'
  ],
  customer_name: [
    'ឈ្មោះអតិថិជន',
    'ឈ្មោះ អតិថិជន',
    'អតិថិជន',
    'customer name',
    'name',
    'ឈ្មោះ'
  ],
  phone: [
    'លេខទូរសព្ទអតិថិជន',
    'លេខទូរសព្ទ',
    'លេខ ទូរសព្ទ',
    'ទូរសព្ទ',
    'phone',
    'tel',
    'contact'
  ],
  due_date: [
    'ថ្ងៃបង់ប្រាក់',
    'ថ្ងៃ បង់ប្រាក់',
    'កាលបរិច្ឆេទបង់',
    'payment date',
    'due date',
    'date',
    'ថ្ងៃ'
  ],
  amount: [
    'ប្រាក់ត្រូវបង់',
    'ប្រាក់ ត្រូវ បង់',
    'ចំនួនទឹកប្រាក់',
    'ប្រាក់',
    'amount',
    'usd',
    'price'
  ],
  installment: [
    'លើកទី',
    'លើក ទី',
    'installment',
    'payment no'
  ],
  notes: [
    'បរិយាយ',
    'កំណត់សម្គាល់',
    'ចំណាំ',
    'ផ្សេងៗ',
    'notes',
    'remark',
    'description'
  ]
};

/**
 * Normalize header text for matching
 * Handles:
 * - Zero-width characters
 * - Khmer punctuation ("៖")
 * - Extra spaces
 * - Case normalization
 */
export function normalizeHeader(text: string): string {
  if (!text) return '';

  return text
    .trim()
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')  // Remove zero-width chars
    .replace(/៖/g, ':')                      // Normalize Khmer colon
    .replace(/\s+/g, ' ')                    // Collapse multiple spaces
    .replace(/[:\-_]/g, ' ');                // Replace punctuation with space
}

/**
 * Score how well a cell value matches expected header patterns
 * Returns 0-100, higher = better match
 *
 * Scoring:
 * - 100: Exact match
 * - 90: Match without spaces
 * - 80: Cell contains pattern
 * - 70: Pattern contains cell
 * - 0: No match
 */
export function scoreHeaderMatch(cellValue: string, patterns: string[]): number {
  const normalized = normalizeHeader(cellValue);
  if (!normalized) return 0;

  let bestScore = 0;

  for (const pattern of patterns) {
    const normalizedPattern = normalizeHeader(pattern);
    if (!normalizedPattern) continue;

    // Exact match
    if (normalized === normalizedPattern) {
      bestScore = Math.max(bestScore, 100);
      continue;
    }

    // Match without spaces
    const noSpacesNormalized = normalized.replace(/\s/g, '');
    const noSpacesPattern = normalizedPattern.replace(/\s/g, '');
    if (noSpacesNormalized === noSpacesPattern) {
      bestScore = Math.max(bestScore, 90);
      continue;
    }

    // Partial matches
    if (normalized.includes(normalizedPattern)) {
      bestScore = Math.max(bestScore, 80);
    } else if (normalizedPattern.includes(normalized)) {
      bestScore = Math.max(bestScore, 70);
    }
  }

  return bestScore;
}

/**
 * Try to detect headers in a single row
 * Returns mapping and confidence score
 */
function detectHeadersInRow(
  row: any[],
  _rowIndex: number
): { mapping: Partial<HeaderMapping>; matchedHeaders: string[]; score: number } {
  const mapping: Partial<HeaderMapping> = {};
  const matchedHeaders: string[] = [];
  let totalScore = 0;
  let matchCount = 0;

  // Scan each cell in the row
  for (let colIdx = 0; colIdx < row.length; colIdx++) {
    const cellValue = String(row[colIdx] || '').trim();
    if (!cellValue) continue;

    let bestMatch: { field: string; score: number } | null = null;

    // Try to match against all expected headers
    for (const [fieldName, patterns] of Object.entries(HEADER_PATTERNS)) {
      const score = scoreHeaderMatch(cellValue, patterns);

      if (score > 60 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { field: fieldName, score };
      }
    }

    // If we found a good match, record it
    if (bestMatch && !mapping[bestMatch.field as keyof HeaderMapping]) {
      mapping[bestMatch.field as keyof HeaderMapping] = colIdx;
      matchedHeaders.push(`${bestMatch.field}="${cellValue}" (col ${colIdx}, score ${bestMatch.score})`);
      totalScore += bestMatch.score;
      matchCount++;
    }
  }

  const avgScore = matchCount > 0 ? totalScore / matchCount : 0;

  return { mapping, matchedHeaders, score: avgScore };
}

/**
 * Try to detect two-row headers (title row + actual header row)
 * Some Excel files have a merged title row above the actual headers
 */
function detectTwoRowHeaders(
  sheetData: any[][],
  rowIdx1: number,
  rowIdx2: number
): { mapping: Partial<HeaderMapping>; matchedHeaders: string[]; score: number } {
  // Combine cells from two rows (e.g., "Row 1 Cell" + "Row 2 Cell")
  const combinedRow: string[] = [];
  const maxCols = Math.max(
    (sheetData[rowIdx1] || []).length,
    (sheetData[rowIdx2] || []).length
  );

  for (let colIdx = 0; colIdx < maxCols; colIdx++) {
    const cell1 = String((sheetData[rowIdx1] || [])[colIdx] || '').trim();
    const cell2 = String((sheetData[rowIdx2] || [])[colIdx] || '').trim();

    // Try different combinations
    if (cell1 && cell2) {
      combinedRow[colIdx] = `${cell1} ${cell2}`;
    } else {
      combinedRow[colIdx] = cell1 || cell2;
    }
  }

  // Detect headers in the combined row
  return detectHeadersInRow(combinedRow, rowIdx2);
}

/**
 * Detect headers in Excel sheet data
 *
 * Algorithm:
 * 1. Scan first N rows (default 25)
 * 2. Try single-row header detection
 * 3. Try two-row header detection
 * 4. Pick best match based on:
 *    - Number of required headers found
 *    - Confidence score
 *
 * @param sheetData - 2D array of sheet data (from XLSX.utils.sheet_to_json)
 * @param config - Detection configuration
 * @returns Header detection result or null if no headers found
 */
export function detectHeaders(
  sheetData: any[][],
  config: HeaderDetectionConfig = {}
): HeaderDetectionResult | null {
  const {
    maxRowsToScan = 25,
    minRequiredHeaders = 4,
    minConfidence = 70
  } = config;

  if (!sheetData || sheetData.length === 0) {
    return null;
  }

  const maxRows = Math.min(maxRowsToScan, sheetData.length);
  const requiredFields = ['customer_name', 'amount', 'due_date'];

  let bestResult: {
    headerRowIndex: number;
    mapping: Partial<HeaderMapping>;
    matchedHeaders: string[];
    score: number;
  } | null = null;

  // Try single-row headers
  for (let rowIdx = 0; rowIdx < maxRows; rowIdx++) {
    const row = sheetData[rowIdx];
    if (!row || row.length === 0) continue;

    const result = detectHeadersInRow(row, rowIdx);
    const foundRequired = requiredFields.filter(f => result.mapping[f as keyof HeaderMapping] !== undefined);

    // Check if this is a viable header row
    if (foundRequired.length >= minRequiredHeaders && result.score >= minConfidence) {
      if (!bestResult || result.score > bestResult.score) {
        bestResult = {
          headerRowIndex: rowIdx,
          mapping: result.mapping,
          matchedHeaders: result.matchedHeaders,
          score: result.score
        };
      }
    }
  }

  // Try two-row headers (title row + header row)
  for (let rowIdx = 0; rowIdx < maxRows - 1; rowIdx++) {
    const result = detectTwoRowHeaders(sheetData, rowIdx, rowIdx + 1);
    const foundRequired = requiredFields.filter(f => result.mapping[f as keyof HeaderMapping] !== undefined);

    if (foundRequired.length >= minRequiredHeaders && result.score >= minConfidence) {
      if (!bestResult || result.score > bestResult.score) {
        bestResult = {
          headerRowIndex: rowIdx + 1,  // Use second row as header row
          mapping: result.mapping,
          matchedHeaders: result.matchedHeaders,
          score: result.score
        };
      }
    }
  }

  // Return best result
  if (!bestResult) {
    return null;
  }

  const unmatchedExpected = requiredFields.filter(f => bestResult.mapping[f as keyof HeaderMapping] === undefined);

  return {
    headerRowIndex: bestResult.headerRowIndex,
    mapping: bestResult.mapping as HeaderMapping,
    matchedHeaders: bestResult.matchedHeaders,
    unmatchedExpected,
    confidence: bestResult.score
  };
}

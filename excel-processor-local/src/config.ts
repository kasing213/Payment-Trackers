/**
 * Local Excel Processor Configuration
 * Loads and validates environment variables for local processor
 */

import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Local Configuration Interface
 */
export interface LocalConfig {
  // Railway API
  railwayApiUrl: string;
  apiKey: string;

  // OpenAI
  openaiApiKey: string;
  openaiModel: string;

  // Excel Processing
  excelUploadFolder: string;
  excelProcessingFolder: string;
  excelProcessedFolder: string;
  excelFailedFolder: string;
  excelBatchSize: number;

  // Multi-sheet Processing
  sheetsMode: 'all' | 'first' | 'allowlist' | 'denylist';
  sheetsAllowlist: string[];
  sheetsDenylist: string[];
  maxSheetsPerFile: number;

  // Header Detection
  headerScanRows: number;
  minRequiredHeaders: number;
}

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): LocalConfig {
  const config: LocalConfig = {
    // Railway API
    railwayApiUrl: process.env.RAILWAY_API_URL || 'http://localhost:3000',
    apiKey: process.env.API_KEY || '',

    // OpenAI
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',

    // Excel Processing
    excelUploadFolder: process.env.EXCEL_UPLOAD_FOLDER || 'd:/Payment-Tracker/uploads/excel',
    excelProcessingFolder: process.env.EXCEL_PROCESSING_FOLDER || 'd:/Payment-Tracker/uploads/processing',
    excelProcessedFolder: process.env.EXCEL_PROCESSED_FOLDER || 'd:/Payment-Tracker/uploads/processed',
    excelFailedFolder: process.env.EXCEL_FAILED_FOLDER || 'd:/Payment-Tracker/uploads/failed',
    excelBatchSize: parseInt(process.env.EXCEL_BATCH_SIZE || '10', 10),

    // Multi-sheet Processing
    sheetsMode: (process.env.SHEETS_MODE as 'all' | 'first' | 'allowlist' | 'denylist') || 'all',
    sheetsAllowlist: process.env.SHEETS_ALLOWLIST?.split(',').map(s => s.trim()).filter(s => s) || [],
    sheetsDenylist: process.env.SHEETS_DENYLIST?.split(',').map(s => s.trim()).filter(s => s) || [],
    maxSheetsPerFile: parseInt(process.env.MAX_SHEETS_PER_FILE || '20', 10),

    // Header Detection
    headerScanRows: parseInt(process.env.HEADER_SCAN_ROWS || '25', 10),
    minRequiredHeaders: parseInt(process.env.MIN_REQUIRED_HEADERS || '3', 10),
  };

  // Validate required fields
  validateConfig(config);

  return config;
}

/**
 * Validate configuration
 */
function validateConfig(config: LocalConfig): void {
  const errors: string[] = [];

  if (!config.railwayApiUrl) {
    errors.push('RAILWAY_API_URL is required');
  }

  if (!config.apiKey) {
    errors.push('API_KEY is required for Railway API authentication');
  }

  if (!config.openaiApiKey) {
    errors.push('OPENAI_API_KEY is required for Excel processing');
  }

  if (config.excelBatchSize < 1 || config.excelBatchSize > 50) {
    errors.push('EXCEL_BATCH_SIZE must be between 1 and 50');
  }

  if (!['all', 'first', 'allowlist', 'denylist'].includes(config.sheetsMode)) {
    errors.push('SHEETS_MODE must be one of: all, first, allowlist, denylist');
  }

  if (config.maxSheetsPerFile < 1 || config.maxSheetsPerFile > 100) {
    errors.push('MAX_SHEETS_PER_FILE must be between 1 and 100');
  }

  if (config.headerScanRows < 1 || config.headerScanRows > 100) {
    errors.push('HEADER_SCAN_ROWS must be between 1 and 100');
  }

  if (config.minRequiredHeaders < 1 || config.minRequiredHeaders > 10) {
    errors.push('MIN_REQUIRED_HEADERS must be between 1 and 10');
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuration validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`
    );
  }
}

/**
 * Get configuration singleton
 */
let cachedConfig: LocalConfig | null = null;

export function getConfig(): LocalConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

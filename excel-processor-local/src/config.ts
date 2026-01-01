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

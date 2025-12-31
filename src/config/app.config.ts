/**
 * Application Configuration
 * Loads and validates environment variables
 */

import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Application Configuration Interface
 */
export interface AppConfig {
  // Server
  port: number;
  nodeEnv: string;

  // MongoDB
  mongodbUri: string;
  mongodbDbName: string;

  // Telegram
  telegramBotToken: string;

  // Alert Processing
  alertPollIntervalMs: number;
  maxAlertRetries: number;

  // Date Checker
  dateCheckerCron: string;
  prealertDays: number;

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
export function loadConfig(): AppConfig {
  const config: AppConfig = {
    // Server
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    // MongoDB
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    mongodbDbName: process.env.MONGODB_DB_NAME || 'ar_tracker',

    // Telegram
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',

    // Alert Processing
    alertPollIntervalMs: parseInt(process.env.ALERT_POLL_INTERVAL_MS || '10000', 10),
    maxAlertRetries: parseInt(process.env.MAX_ALERT_RETRIES || '3', 10),

    // Date Checker
    dateCheckerCron: process.env.DATE_CHECKER_CRON || '0 9 * * *', // 9 AM daily
    prealertDays: parseInt(process.env.PREALERT_DAYS || '3', 10),

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
function validateConfig(config: AppConfig): void {
  const errors: string[] = [];

  if (!config.mongodbUri) {
    errors.push('MONGODB_URI is required');
  }

  if (!config.telegramBotToken) {
    console.warn('WARNING: TELEGRAM_BOT_TOKEN is not set - alert delivery will fail');
  }

  if (!config.openaiApiKey) {
    console.warn('WARNING: OPENAI_API_KEY is not set - Excel processing will fail');
  }

  if (config.port < 1 || config.port > 65535) {
    errors.push('PORT must be between 1 and 65535');
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
let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = loadConfig();
  }
  return cachedConfig;
}

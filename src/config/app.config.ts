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

  // API Authentication (Railway deployment)
  apiKey: string;

  // OpenAI and Excel processing moved to local processor
  // Railway deployment only hosts API endpoints
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

    // API Authentication
    apiKey: process.env.API_KEY || '',
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

  if (!config.apiKey) {
    errors.push('API_KEY is required for API authentication');
  }

  if (config.port < 1 || config.port > 65535) {
    errors.push('PORT must be between 1 and 65535');
  }

  // OpenAI and Excel validation removed - handled by local processor

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

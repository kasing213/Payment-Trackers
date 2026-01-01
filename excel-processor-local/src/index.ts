/**
 * Excel Processor (Local) - Entry Point
 * Standalone application that processes Excel files locally and syncs to Railway via API
 */

import { loadConfig } from './config';
import { ExcelParserService } from './services/excel-parser.service';
import { GPTProcessingService } from './services/gpt-processing.service';
import { DuplicateDetectionService } from './services/duplicate-detection.service';
import { RailwayAPIService } from './services/railway-api.service';
import { ExcelProcessorWorker } from './workers/excel-processor';

async function main() {
  console.log('='.repeat(60));
  console.log('Excel Processor (Local) - Starting...');
  console.log('='.repeat(60));

  try {
    // Load configuration
    const config = loadConfig();
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Railway API: ${config.railwayApiUrl}`);
    console.log(`OpenAI Model: ${config.openaiModel}`);
    console.log(`Batch Size: ${config.excelBatchSize} rows`);

    // Initialize Railway API client
    console.log('\nConnecting to Railway API...');
    const railwayApi = new RailwayAPIService(config.railwayApiUrl, config.apiKey);

    // Test Railway API connection
    const isHealthy = await railwayApi.healthCheck();
    if (!isHealthy) {
      console.error('ERROR: Cannot connect to Railway API.');
      console.error('Please check:');
      console.error('  1. RAILWAY_API_URL is correct');
      console.error('  2. API_KEY is valid');
      console.error('  3. Railway deployment is running');
      process.exit(1);
    }
    console.log('✓ Railway API connection successful');

    // Initialize services
    console.log('\nInitializing services...');
    const excelParserService = new ExcelParserService();
    console.log('✓ Excel Parser Service initialized');

    const gptProcessingService = new GPTProcessingService(
      config.openaiApiKey,
      config.openaiModel
    );
    console.log('✓ GPT Processing Service initialized');

    const duplicateDetectionService = new DuplicateDetectionService(railwayApi);
    console.log('✓ Duplicate Detection Service initialized');

    // Start Excel processor worker
    console.log('\nStarting Excel Processor Worker...');
    const excelWorker = new ExcelProcessorWorker(
      config.excelUploadFolder,
      config.excelProcessingFolder,
      config.excelProcessedFolder,
      config.excelFailedFolder,
      config.excelBatchSize,
      excelParserService,
      gptProcessingService,
      duplicateDetectionService,
      railwayApi
    );

    await excelWorker.start();

    console.log('='.repeat(60));
    console.log('Excel Processor (Local) - RUNNING');
    console.log('='.repeat(60));
    console.log(`Watching folder: ${config.excelUploadFolder}`);
    console.log('Drop Excel files (.xlsx) in the upload folder to process them.');
    console.log('Press Ctrl+C to stop.');
    console.log('='.repeat(60));

    // Graceful shutdown handler
    const shutdown = async () => {
      console.log('\n\nShutting down gracefully...');
      await excelWorker.stop();
      console.log('Excel Processor stopped.');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

  } catch (error) {
    console.error('Failed to start Excel processor:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
main().catch((error) => {
  console.error('Application startup failed:', error);
  process.exit(1);
});

/**
 * Application Entry Point
 * Initializes and starts the AR Event & Alert Engine
 */

import { getConfig } from './config/app.config';
import { getMongoDBClient } from './infrastructure/database/mongodb-client';
import { MongoEventStore } from './infrastructure/database/event-store.impl';
import { MongoARRepository } from './infrastructure/database/ar-repository.impl';
import { MongoAlertRepository } from './infrastructure/database/alert-repository.impl';
// import { EventReplayService } from './domain/services/event-replay'; // Not used in index.ts
import { AlertService } from './domain/services/alert-service';
import { TelegramClient } from './infrastructure/messaging/telegram-client';
import { AlertDeliveryService } from './infrastructure/messaging/alert-delivery';
import { CreateARCommand } from './application/commands/create-ar.command';
import { LogFollowUpCommand } from './application/commands/log-follow-up.command';
import { VerifyPaymentCommand } from './application/commands/verify-payment.command';
import { ChangeDueDateCommand } from './application/commands/change-due-date.command';
import { ChangeARStatusCommand } from './application/commands/change-ar-status.command';
import { CreateNextMonthARCommand } from './application/commands/create-next-month-ar.command';
import { GetARStateQuery } from './application/queries/get-ar-state.query';
import { GetPendingAlertsQuery } from './application/queries/get-pending-alerts.query';
import { createServer } from './api/server';
import { AlertProcessorWorker } from './workers/alert-processor';
import { DateCheckerWorker } from './workers/date-checker';
// Excel processing moved to local processor - Railway only hosts API
// import { ExcelProcessorWorker } from './workers/excel-processor';
// import { ExcelParserService } from './domain/services/excel-parser.service';
// import { GPTProcessingService } from './domain/services/gpt-processing.service';
// import { DuplicateDetectionService } from './domain/services/duplicate-detection.service';
import { ExcelImportLogRepository } from './infrastructure/database/excel-import-log-repository.impl';

/**
 * Main application class
 */
class Application {
  private mongoClient: any;
  private server: any;
  private alertWorker: AlertProcessorWorker | null = null;
  private dateCheckerWorker: DateCheckerWorker | null = null;
  // excelWorker removed - Excel processing now handled by local standalone processor

  async start(): Promise<void> {
    console.log('='.repeat(60));
    console.log('AR Event & Alert Engine - Starting...');
    console.log('='.repeat(60));

    try {
      // Load configuration
      const config = getConfig();
      console.log(`Environment: ${config.nodeEnv}`);
      console.log(`Port: ${config.port}`);

      // Connect to MongoDB
      console.log('Connecting to MongoDB...');
      this.mongoClient = getMongoDBClient(config.mongodbUri, config.mongodbDbName);
      await this.mongoClient.connect();

      const db = this.mongoClient.getDb();

      // Initialize repositories
      const eventStore = new MongoEventStore(db);
      const arRepository = new MongoARRepository(db);
      const alertRepository = new MongoAlertRepository(db);

      // Initialize services
      const alertService = new AlertService(eventStore, alertRepository);

      // Initialize Telegram
      console.log('Initializing Telegram client...');
      const telegramClient = new TelegramClient(config.telegramBotToken);
      const isConnected = await telegramClient.testConnection();
      if (!isConnected) {
        console.warn('Warning: Telegram connection test failed');
      } else {
        const botInfo = await telegramClient.getBotInfo();
        console.log(`Telegram bot connected: @${botInfo.username}`);
      }

      const alertDeliveryService = new AlertDeliveryService(
        telegramClient,
        eventStore,
        alertRepository
      );

      // Initialize commands
      const createARCommand = new CreateARCommand(eventStore, arRepository);
      const logFollowUpCommand = new LogFollowUpCommand(eventStore, arRepository);
      const changeDueDateCommand = new ChangeDueDateCommand(eventStore, arRepository);
      const changeARStatusCommand = new ChangeARStatusCommand(eventStore, arRepository);

      // Create monthly billing command (depends on createARCommand)
      const createNextMonthARCommand = new CreateNextMonthARCommand(arRepository, createARCommand);

      // Verify payment command with monthly billing
      const verifyPaymentCommand = new VerifyPaymentCommand(eventStore, arRepository, createNextMonthARCommand);

      // Initialize queries
      const getARStateQuery = new GetARStateQuery(arRepository);
      const getPendingAlertsQuery = new GetPendingAlertsQuery(alertRepository);

      // Initialize Excel import log repository (for API only, not for processing)
      const excelImportLogRepository = new ExcelImportLogRepository(db);
      await excelImportLogRepository.createIndexes();

      // Create Express server
      console.log('Creating HTTP server...');
      const app = createServer({
        createARCommand,
        logFollowUpCommand,
        verifyPaymentCommand,
        changeDueDateCommand,
        getARStateQuery,
        getPendingAlertsQuery,
        excelImportLogRepository,
      });

      // Start HTTP server
      this.server = app.listen(config.port, () => {
        console.log(`HTTP server listening on port ${config.port}`);
        console.log(`Health check: http://localhost:${config.port}/health`);
      });

      // Start background workers
      console.log('Starting background workers...');

      // Alert processor worker
      this.alertWorker = new AlertProcessorWorker(
        alertRepository,
        alertDeliveryService,
        config.alertPollIntervalMs
      );
      // Run in background (don't await)
      this.alertWorker.start().catch((error) => {
        console.error('Alert worker error:', error);
      });

      // Date checker worker (with status change command)
      this.dateCheckerWorker = new DateCheckerWorker(
        arRepository,
        alertService,
        changeARStatusCommand,
        createARCommand,
        {
          prealertDays: config.prealertDays,
          futureArMonthsAhead: config.futureArMonthsAhead
        }
      );
      this.dateCheckerWorker.start(config.dateCheckerCron);

      // Excel processing moved to local standalone processor
      // Railway deployment only hosts API endpoints for Excel import logs

      console.log('='.repeat(60));
      console.log('AR Event & Alert Engine - RUNNING');
      console.log('='.repeat(60));
    } catch (error) {
      console.error('Failed to start application:', error);
      await this.shutdown();
      process.exit(1);
    }
  }

  async shutdown(): Promise<void> {
    console.log('\nShutting down gracefully...');

    // Stop workers
    if (this.alertWorker) {
      this.alertWorker.stop();
    }
    if (this.dateCheckerWorker) {
      this.dateCheckerWorker.stop();
    }
    // Excel worker removed - runs in separate local process

    // Close HTTP server
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server.close(() => {
          console.log('HTTP server closed');
          resolve();
        });
      });
    }

    // Disconnect from MongoDB
    if (this.mongoClient) {
      await this.mongoClient.disconnect();
    }

    console.log('Shutdown complete');
  }
}

// Create and start application
const app = new Application();

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT');
  await app.shutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM');
  await app.shutdown();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  app.shutdown().then(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  app.shutdown().then(() => process.exit(1));
});

// Start the application
app.start().catch((error) => {
  console.error('Application startup failed:', error);
  process.exit(1);
});

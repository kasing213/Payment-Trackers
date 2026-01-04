/**
 * Excel Processor Worker
 *
 * Monitors upload folder for new Excel files and processes them automatically
 */

import * as chokidar from 'chokidar';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { ExcelParserService } from '../services/excel-parser.service';
import { GPTProcessingService } from '../services/gpt-processing.service';
import { DuplicateDetectionService } from '../services/duplicate-detection.service';
import { RailwayAPIService } from '../services/railway-api.service';
import { ExcelImportLog, NormalizedRowData } from '../models/excel-import';

/**
 * Excel Processor Worker
 * Watches for new Excel files and processes them
 */
export class ExcelProcessorWorker {
  private watcher: chokidar.FSWatcher | null = null;
  private isProcessing = false;
  private isShuttingDown = false;

  constructor(
    private uploadFolder: string,
    private processingFolder: string,
    private processedFolder: string,
    private failedFolder: string,
    private batchSize: number,
    private excelParserService: ExcelParserService,
    private gptProcessingService: GPTProcessingService,
    private duplicateDetectionService: DuplicateDetectionService,
    private railwayApi: RailwayAPIService
  ) {}

  /**
   * Start the Excel processor worker
   */
  async start(): Promise<void> {
    console.log(`[Excel Processor] Starting worker...`);
    console.log(`[Excel Processor] Watching folder: ${this.uploadFolder}`);

    // Ensure folders exist
    await this.ensureFoldersExist();

    // Initialize file watcher
    this.watcher = chokidar.watch(this.uploadFolder, {
      ignored: /(^|[\/\\])\../, // Ignore dotfiles
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });

    this.watcher.on('add', (filePath: string) => {
      if (this.isShuttingDown) return;

      // Only process .xlsx files
      if (path.extname(filePath).toLowerCase() === '.xlsx') {
        this.processFile(filePath).catch(error => {
          console.error(`[Excel Processor] Error processing file ${filePath}:`, error);
        });
      }
    });

    this.watcher.on('error', (error: Error) => {
      console.error('[Excel Processor] Watcher error:', error);
    });

    console.log('[Excel Processor] Worker started successfully');
  }

  /**
   * Stop the Excel processor worker
   */
  async stop(): Promise<void> {
    console.log('[Excel Processor] Stopping worker...');
    this.isShuttingDown = true;

    if (this.watcher) {
      await this.watcher.close();
    }

    // Wait for current processing to finish
    while (this.isProcessing) {
      await this.sleep(100);
    }

    console.log('[Excel Processor] Worker stopped');
  }

  /**
   * Process a single Excel file
   */
  private async processFile(filePath: string): Promise<void> {
    if (this.isProcessing) {
      console.log(`[Excel Processor] Already processing a file, queuing: ${filePath}`);
      return;
    }

    this.isProcessing = true;
    const fileName = path.basename(filePath);
    const import_id = uuidv4();

    console.log(`[Excel Processor] Processing file: ${fileName}`);

    // Initialize import log
    const importLog: ExcelImportLog = {
      import_id,
      file_name: fileName,
      started_at: new Date(),
      status: 'PROCESSING',
      total_rows: 0,
      successful_rows: 0,
      updated_rows: 0,
      duplicate_rows: 0,
      failed_rows: 0,
      errors: []
    };

    try {
      // Move file to processing folder
      const processingPath = path.join(this.processingFolder, fileName);
      await fs.rename(filePath, processingPath);
      console.log(`[Excel Processor] Moved to processing: ${fileName}`);

      // Parse Excel file
      const rawRows = await this.excelParserService.parseFile(processingPath, fileName);
      importLog.total_rows = rawRows.length;
      console.log(`[Excel Processor] Parsed ${rawRows.length} rows from ${fileName}`);

      // Build per-sheet stats
      const sheetStatsMap = new Map<string, {
        rows: typeof rawRows;
        header_row_index: number;
      }>();

      for (const row of rawRows) {
        if (!sheetStatsMap.has(row.sheet_name)) {
          sheetStatsMap.set(row.sheet_name, {
            rows: [],
            header_row_index: row.source.header_row_index || 0
          });
        }
        sheetStatsMap.get(row.sheet_name)!.rows.push(row);
      }

      importLog.sheets_processed = Array.from(sheetStatsMap.entries()).map(([sheet_name, data]) => ({
        sheet_name,
        rows_found: data.rows.length,
        rows_successful: 0,  // Will increment during processing
        rows_failed: 0,      // Will increment during processing
        header_row_index: data.header_row_index
      }));

      console.log(`[Excel Processor] Sheets processed: ${Array.from(sheetStatsMap.keys()).join(', ')}`);

      // Process rows in batches with GPT
      const normalizedRows: NormalizedRowData[] = [];

      for (let i = 0; i < rawRows.length; i += this.batchSize) {
        const batch = rawRows.slice(i, i + this.batchSize);
        console.log(`[Excel Processor] Processing batch ${Math.floor(i / this.batchSize) + 1}/${Math.ceil(rawRows.length / this.batchSize)}`);

        const normalized = await this.gptProcessingService.processBatch(batch);
        normalizedRows.push(...normalized);
      }

      // Process each normalized row
      for (const row of normalizedRows) {
        try {
          // Skip rows with errors
          if (row.validation_status === 'ERROR') {
            importLog.failed_rows++;
            importLog.errors.push({
              sheet_name: row.sheet_name,  // NEW: Track sheet
              row_index: row.row_index,
              error_type: 'VALIDATION_ERROR',
              error_message: row.errors.join(', '),
              raw_data: row
            });

            // Update per-sheet stats
            if (importLog.sheets_processed && row.sheet_name) {
              const sheetStat = importLog.sheets_processed.find(s => s.sheet_name === row.sheet_name);
              if (sheetStat) sheetStat.rows_failed++;
            }

            continue;
          }

          // Validate amount before sending to Railway API
          if (!row.amount || row.amount.value <= 0) {
            importLog.failed_rows++;
            importLog.errors.push({
              sheet_name: row.sheet_name,  // NEW: Track sheet
              row_index: row.row_index,
              error_type: 'VALIDATION_ERROR',
              error_message: `Amount must be greater than 0 (got: ${row.amount?.value || 0})`,
              raw_data: row
            });

            // Update per-sheet stats
            if (importLog.sheets_processed && row.sheet_name) {
              const sheetStat = importLog.sheets_processed.find(s => s.sheet_name === row.sheet_name);
              if (sheetStat) sheetStat.rows_failed++;
            }

            console.warn(`[Excel Processor] Row ${row.row_index}: Invalid amount (${row.amount?.value || 0}), skipping`);
            continue;
          }

          // Check for duplicates
          const existing = await this.duplicateDetectionService.detectDuplicate(row);

          if (!existing) {
            // New AR - create it via Railway API
            const result = await this.railwayApi.createAR({
              home_id: row.home_id,
              zone: row.sheet_name || 'UNKNOWN',  // Zone from sheet name (e.g., "Sros")
              customer_name: row.customer_name,
              amount: row.amount,
              invoice_date: row.invoice_date,
              due_date: row.due_date
            });

            importLog.successful_rows++;

            // Update per-sheet stats
            if (importLog.sheets_processed && row.sheet_name) {
              const sheetStat = importLog.sheets_processed.find(s => s.sheet_name === row.sheet_name);
              if (sheetStat) sheetStat.rows_successful++;
            }

            console.log(`[Excel Processor] Row ${row.row_index}: New AR created for ${row.customer_name} (AR ID: ${result.ar_id})`);

          } else {
            const existingZone = (existing.zone || '').trim();
            const incomingZone = (row.sheet_name || '').trim();

            if (existingZone && incomingZone && existingZone.toLowerCase() !== incomingZone.toLowerCase()) {
              importLog.failed_rows++;
              importLog.errors.push({
                sheet_name: row.sheet_name,
                row_index: row.row_index,
                error_type: 'ZONE_CONFLICT',
                error_message: `Zone mismatch for home_id ${row.home_id}: existing "${existing.zone}" vs incoming "${row.sheet_name}". Keeping existing zone.`,
                raw_data: row
              });

              if (importLog.sheets_processed && row.sheet_name) {
                const sheetStat = importLog.sheets_processed.find(s => s.sheet_name === row.sheet_name);
                if (sheetStat) sheetStat.rows_failed++;
              }

              console.warn(
                `[Excel Processor] Row ${row.row_index}: Zone conflict for home_id ${row.home_id} ` +
                `(${existing.zone} vs ${row.sheet_name}), skipping`
              );
              continue;
            }

            // Check if data changed
            const hasChanges = this.duplicateDetectionService.compareARData(existing, row);

            if (!hasChanges) {
              // Exact duplicate - SKIP
              importLog.duplicate_rows++;
              console.log(`[Excel Processor] Row ${row.row_index}: Exact duplicate, skipping`);

            } else {
              // Data changed - create update events
              const changes = this.duplicateDetectionService.getChanges(existing, row);
              console.log(`[Excel Processor] Row ${row.row_index}: Data changed - ${changes.changes.join(', ')}`);

              // Update due date if changed
              if (changes.due_date_changed) {
                await this.railwayApi.changeDueDate(
                  existing.ar_id,
                  row.due_date,
                  `Excel import update: ${changes.changes.join(', ')}`
                );
              }

              // Note: Amount changes would require a new event type (AMOUNT_CHANGED)
              // For now, we log the change but don't update the amount
              if (changes.amount_changed) {
                console.warn(
                  `[Excel Processor] Amount change detected for AR ${existing.ar_id} but not implemented yet. ` +
                  `${changes.changes.find(c => c.startsWith('Amount'))}`
                );
              }

              importLog.updated_rows++;
            }
          }

        } catch (error: any) {
          importLog.failed_rows++;
          importLog.errors.push({
            sheet_name: row.sheet_name,  // NEW: Track sheet
            row_index: row.row_index,
            error_type: 'PROCESSING_ERROR',
            error_message: error.message,
            raw_data: row
          });

          // Update per-sheet stats
          if (importLog.sheets_processed && row.sheet_name) {
            const sheetStat = importLog.sheets_processed.find(s => s.sheet_name === row.sheet_name);
            if (sheetStat) sheetStat.rows_failed++;
          }

          console.error(`[Excel Processor] Error processing row ${row.row_index}:`, error.message);
        }
      }

      // Mark as completed
      importLog.status = 'COMPLETED';
      importLog.completed_at = new Date();

      // Move to processed folder
      const timestamp = Date.now();
      const dateFolder = this.getDateFolder();
      const processedDir = path.join(this.processedFolder, dateFolder);
      await fs.mkdir(processedDir, { recursive: true });
      const safeBaseName = this.buildSafeBaseName(fileName);

      const processedPath = path.join(processedDir, `${safeBaseName}_${timestamp}.xlsx`);
      await fs.rename(processingPath, processedPath);

      // Save summary file
      const summaryPath = path.join(processedDir, `summary_${safeBaseName}_${timestamp}.json`);
      await fs.writeFile(summaryPath, JSON.stringify(importLog, null, 2));

      console.log(`[Excel Processor] Completed: ${fileName}`);
      console.log(
        `[Excel Processor] Summary: ${importLog.total_rows} total, ` +
        `${importLog.successful_rows} new, ${importLog.updated_rows} updated, ` +
        `${importLog.duplicate_rows} duplicates, ${importLog.failed_rows} failed`
      );

    } catch (error: any) {
      // Processing failed
      importLog.status = 'FAILED';
      importLog.completed_at = new Date();
      importLog.errors.push({
        row_index: 0,
        error_type: 'FILE_PROCESSING_ERROR',
        error_message: error.message
      });

      console.error(`[Excel Processor] Failed to process ${fileName}:`, error);

      // Move to failed folder
      try {
        const timestamp = Date.now();
        const dateFolder = this.getDateFolder();
        const failedDir = path.join(this.failedFolder, dateFolder);
        await fs.mkdir(failedDir, { recursive: true });
        const safeBaseName = this.buildSafeBaseName(fileName);

        const processingPath = path.join(this.processingFolder, fileName);
        const failedPath = path.join(failedDir, `${safeBaseName}_${timestamp}.xlsx`);

        // Try to move from processing folder, if file still in upload folder, move from there
        try {
          await fs.rename(processingPath, failedPath);
        } catch {
          await fs.rename(filePath, failedPath);
        }

        // Save error file
        const errorPath = path.join(failedDir, `error_${safeBaseName}_${timestamp}.json`);
        await fs.writeFile(errorPath, JSON.stringify(importLog, null, 2));

      } catch (moveError: any) {
        console.error(`[Excel Processor] Failed to move file to failed folder:`, moveError);
      }
    }

    // Save import log to Railway MongoDB via API
    try {
      await this.railwayApi.saveImportLog(importLog);
      console.log('[Excel Processor] Import log saved to Railway MongoDB');
    } catch (error: any) {
      console.error('[Excel Processor] Failed to save import log to Railway:', error);
    }

    this.isProcessing = false;
  }

  /**
   * Ensure all required folders exist
   */
  private async ensureFoldersExist(): Promise<void> {
    await fs.mkdir(this.uploadFolder, { recursive: true });
    await fs.mkdir(this.processingFolder, { recursive: true });
    await fs.mkdir(this.processedFolder, { recursive: true });
    await fs.mkdir(this.failedFolder, { recursive: true });
  }

  /**
   * Get current date folder (YYYY-MM-DD)
   */
  private getDateFolder(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Build a short, ASCII-safe base name to avoid path length errors
   */
  private buildSafeBaseName(fileName: string): string {
    const base = path.parse(fileName).name;
    const slug = base
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 32) || 'import';
    const hash = crypto.createHash('sha1').update(fileName).digest('hex').slice(0, 8);
    return `${slug}_${hash}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

import { ExcelImportLog } from '../models/excel-import';

/**
 * Excel Import Log Repository Interface
 *
 * Repository for tracking Excel import processing history
 */
export interface IExcelImportLogRepository {
  /**
   * Save an import log (create or update)
   */
  save(log: ExcelImportLog): Promise<void>;

  /**
   * Find import log by ID
   */
  findById(import_id: string): Promise<ExcelImportLog | null>;

  /**
   * Find import logs by status
   */
  findByStatus(status: 'PROCESSING' | 'COMPLETED' | 'FAILED'): Promise<ExcelImportLog[]>;

  /**
   * Find recent import logs (sorted by started_at desc)
   */
  findRecent(limit: number): Promise<ExcelImportLog[]>;

  /**
   * Find import log by file name
   */
  findByFileName(file_name: string): Promise<ExcelImportLog[]>;
}

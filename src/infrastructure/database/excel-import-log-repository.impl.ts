import { Collection, Db } from 'mongodb';
import { ExcelImportLog } from '../../domain/models/excel-import';
import { IExcelImportLogRepository } from '../../domain/repositories/excel-import-log-repository.interface';

/**
 * MongoDB implementation of Excel Import Log Repository
 */
export class ExcelImportLogRepository implements IExcelImportLogRepository {
  private collection: Collection<ExcelImportLog>;

  constructor(db: Db) {
    this.collection = db.collection<ExcelImportLog>('excel_import_logs');
  }

  async save(log: ExcelImportLog): Promise<void> {
    await this.collection.updateOne(
      { import_id: log.import_id },
      { $set: log },
      { upsert: true }
    );
  }

  async findById(import_id: string): Promise<ExcelImportLog | null> {
    return await this.collection.findOne({ import_id });
  }

  async findByStatus(status: 'PROCESSING' | 'COMPLETED' | 'FAILED'): Promise<ExcelImportLog[]> {
    return await this.collection
      .find({ status })
      .sort({ started_at: -1 })
      .toArray();
  }

  async findRecent(limit: number): Promise<ExcelImportLog[]> {
    return await this.collection
      .find({})
      .sort({ started_at: -1 })
      .limit(limit)
      .toArray();
  }

  async findByFileName(file_name: string): Promise<ExcelImportLog[]> {
    return await this.collection
      .find({ file_name })
      .sort({ started_at: -1 })
      .toArray();
  }

  /**
   * Create indexes for efficient querying
   */
  async createIndexes(): Promise<void> {
    await this.collection.createIndex({ import_id: 1 }, { unique: true });
    await this.collection.createIndex({ status: 1, started_at: -1 });
    await this.collection.createIndex({ file_name: 1, started_at: -1 });
  }
}

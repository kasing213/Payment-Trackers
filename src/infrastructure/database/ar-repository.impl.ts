/**
 * MongoDB AR Repository Implementation
 * Concrete implementation of AR state persistence using MongoDB
 */

import { Collection, Db } from 'mongodb';
import { IARRepository } from '../../domain/repositories/ar-repository.interface';
import { ARState, ARStatus } from '../../domain/models/ar';

/**
 * MongoDB AR Repository Implementation
 */
export class MongoARRepository implements IARRepository {
  private collection: Collection<ARState>;

  constructor(db: Db) {
    this.collection = db.collection<ARState>('ar_state');
  }

  /**
   * Save or update AR state with optimistic locking
   */
  async save(state: ARState): Promise<void> {
    const existingAR = await this.collection.findOne({ ar_id: state.ar_id });

    if (existingAR) {
      // Update existing AR with optimistic locking
      const result = await this.collection.updateOne(
        {
          ar_id: state.ar_id,
          version: state.version, // Match current version
        },
        {
          $set: {
            ...state,
            version: state.version + 1, // Increment version
            updated_at: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        throw new Error(
          `Optimistic lock failed for AR ${state.ar_id}: AR was modified concurrently`
        );
      }
    } else {
      // Insert new AR
      await this.collection.insertOne({
        ...state,
        created_at: new Date(),
        updated_at: new Date(),
      } as any);
    }
  }

  /**
   * Find AR by ID
   */
  async findById(ar_id: string): Promise<ARState | null> {
    const doc = await this.collection.findOne({ ar_id });
    return doc ? this.mapDocumentToARState(doc) : null;
  }

  /**
   * Find ARs by home ID
   */
  async findByHomeId(home_id: string): Promise<ARState[]> {
    const docs = await this.collection.find({ home_id }).toArray();
    return docs.map(this.mapDocumentToARState);
  }

  /**
   * Find ARs by zone
   */
  async findByZone(zone: string): Promise<ARState[]> {
    const docs = await this.collection.find({ zone }).toArray();
    return docs.map(this.mapDocumentToARState);
  }

  /**
   * Find ARs by status
   */
  async findByStatus(status: ARStatus): Promise<ARState[]> {
    const docs = await this.collection.find({ current_status: status }).toArray();
    return docs.map(this.mapDocumentToARState);
  }

  /**
   * Find ARs by due date and status
   */
  async findByDueDateAndStatus(due_date: Date, status: ARStatus): Promise<ARState[]> {
    const startOfDay = new Date(due_date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(due_date);
    endOfDay.setHours(23, 59, 59, 999);

    const docs = await this.collection
      .find({
        current_status: status,
        due_date: {
          $gte: startOfDay,
          $lte: endOfDay,
        },
      })
      .toArray();

    return docs.map(this.mapDocumentToARState);
  }

  /**
   * Find overdue ARs
   */
  async findOverdue(current_date: Date): Promise<ARState[]> {
    const today = new Date(current_date);
    today.setHours(0, 0, 0, 0);

    const docs = await this.collection
      .find({
        current_status: ARStatus.PENDING,
        due_date: { $lt: today },
      })
      .sort({ due_date: 1 })
      .toArray();

    return docs.map(this.mapDocumentToARState);
  }

  /**
   * Find ARs by sales ID
   */
  async findBySalesId(sales_id: string): Promise<ARState[]> {
    const docs = await this.collection.find({ assigned_sales_id: sales_id }).toArray();
    return docs.map(this.mapDocumentToARState);
  }

  /**
   * Find all ARs with pagination
   */
  async findAll(limit: number = 100, offset: number = 0): Promise<ARState[]> {
    const docs = await this.collection
      .find()
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    return docs.map(this.mapDocumentToARState);
  }

  /**
   * Delete AR state (for testing/cleanup only)
   */
  async delete(ar_id: string): Promise<void> {
    await this.collection.deleteOne({ ar_id });
  }

  /**
   * Map MongoDB document to ARState
   * Handles date conversion
   */
  private mapDocumentToARState(doc: any): ARState {
    return {
      ar_id: doc.ar_id,
      home_id: doc.home_id,
      zone: doc.zone,
      customer_name: doc.customer_name,
      amount: doc.amount,
      current_status: doc.current_status,
      invoice_date: doc.invoice_date instanceof Date ? doc.invoice_date : new Date(doc.invoice_date),
      due_date: doc.due_date instanceof Date ? doc.due_date : new Date(doc.due_date),
      paid_date: doc.paid_date ? (doc.paid_date instanceof Date ? doc.paid_date : new Date(doc.paid_date)) : undefined,
      assigned_sales_id: doc.assigned_sales_id,
      customer_chat_id: doc.customer_chat_id,
      manager_chat_id: doc.manager_chat_id,
      last_event_id: doc.last_event_id,
      last_event_at: doc.last_event_at instanceof Date ? doc.last_event_at : new Date(doc.last_event_at),
      event_count: doc.event_count,
      version: doc.version,
    };
  }
}

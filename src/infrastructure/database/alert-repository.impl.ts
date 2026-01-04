/**
 * MongoDB Alert Repository Implementation
 * Concrete implementation of alert queue persistence using MongoDB
 */

import { Collection, Db } from 'mongodb';
import { IAlertRepository } from '../../domain/repositories/alert-repository.interface';
import { Alert, AlertStatus } from '../../domain/models/alert';

/**
 * MongoDB Alert Repository Implementation
 */
export class MongoAlertRepository implements IAlertRepository {
  private collection: Collection<Alert>;

  constructor(db: Db) {
    this.collection = db.collection<Alert>('alert_queue');
  }

  /**
   * Save or update alert
   */
  async save(alert: Alert): Promise<void> {
    await this.collection.updateOne(
      { alert_id: alert.alert_id },
      { $set: { ...alert, updated_at: new Date() } },
      { upsert: true }
    );
  }

  /**
   * Find alert by ID
   */
  async findById(alert_id: string): Promise<Alert | null> {
    const doc = await this.collection.findOne({ alert_id });
    return doc ? this.mapDocumentToAlert(doc) : null;
  }

  /**
   * Find alerts by AR ID
   */
  async findByARId(ar_id: string): Promise<Alert[]> {
    const docs = await this.collection
      .find({ ar_id })
      .sort({ created_at: -1 })
      .toArray();

    return docs.map(this.mapDocumentToAlert);
  }

  /**
   * Find pending alerts
   */
  async findPending(): Promise<Alert[]> {
    const docs = await this.collection
      .find({ status: AlertStatus.QUEUED })
      .sort({ priority: -1, scheduled_for: 1 })
      .toArray();

    return docs.map(this.mapDocumentToAlert);
  }

  /**
   * Find pending alerts ready to process
   */
  async findPendingBySchedule(current_time: Date): Promise<Alert[]> {
    const docs = await this.collection
      .find({
        status: AlertStatus.QUEUED,
        scheduled_for: { $lte: current_time },
      })
      .sort({ priority: -1, scheduled_for: 1 })
      .limit(50) // Process max 50 alerts per batch
      .toArray();

    return docs.map(this.mapDocumentToAlert);
  }

  /**
   * Find alert by deduplication key
   * Used for idempotency to prevent duplicate alerts
   */
  async findByDedupKey(dedup_key: string): Promise<Alert | null> {
    const doc = await this.collection.findOne({ dedup_key });
    return doc ? this.mapDocumentToAlert(doc) : null;
  }

  /**
   * Find alerts by status
   */
  async findByStatus(status: AlertStatus): Promise<Alert[]> {
    const docs = await this.collection.find({ status }).toArray();
    return docs.map(this.mapDocumentToAlert);
  }

  /**
   * Find failed alerts
   */
  async findFailed(): Promise<Alert[]> {
    const docs = await this.collection
      .find({ status: AlertStatus.FAILED })
      .sort({ failed_at: -1 })
      .toArray();

    return docs.map(this.mapDocumentToAlert);
  }

  /**
   * Delete alert
   */
  async delete(alert_id: string): Promise<void> {
    await this.collection.deleteOne({ alert_id });
  }

  /**
   * Map MongoDB document to Alert
   */
  private mapDocumentToAlert(doc: any): Alert {
    return {
      alert_id: doc.alert_id,
      ar_id: doc.ar_id,
      dedup_key: doc.dedup_key,
      alert_type: doc.alert_type,
      target_type: doc.target_type,
      priority: doc.priority,
      delivery_address: doc.delivery_address,
      message_template: doc.message_template,
      message_data: doc.message_data,
      status: doc.status,
      attempts: doc.attempts,
      max_attempts: doc.max_attempts,
      scheduled_for: doc.scheduled_for instanceof Date ? doc.scheduled_for : new Date(doc.scheduled_for),
      sent_at: doc.sent_at ? (doc.sent_at instanceof Date ? doc.sent_at : new Date(doc.sent_at)) : undefined,
      failed_at: doc.failed_at ? (doc.failed_at instanceof Date ? doc.failed_at : new Date(doc.failed_at)) : undefined,
      error: doc.error,
      triggered_by_event_id: doc.triggered_by_event_id,
    };
  }
}

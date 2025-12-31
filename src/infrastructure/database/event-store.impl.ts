/**
 * MongoDB Event Store Implementation
 * Concrete implementation of event storage using MongoDB
 */

import { Collection, Db } from 'mongodb';
import { IEventStore, DomainEvent } from '../../domain/repositories/event-store.interface';
import { EventType } from '../../domain/events/types';

/**
 * MongoDB document structure for events
 */
interface EventDocument {
  event_id: string;
  ar_id: string;
  event_type: string;
  timestamp: Date;
  actor: any;
  payload: any;
  metadata: any;
  created_at: Date;
}

/**
 * MongoDB Event Store Implementation
 */
export class MongoEventStore implements IEventStore {
  private collection: Collection<EventDocument>;

  constructor(db: Db) {
    this.collection = db.collection<EventDocument>('events');
  }

  /**
   * Append event to store (idempotent)
   */
  async append(event: DomainEvent): Promise<void> {
    try {
      const doc: EventDocument = {
        event_id: event.event_id,
        ar_id: event.ar_id,
        event_type: event.event_type,
        timestamp: event.timestamp,
        actor: event.actor,
        payload: event.payload,
        metadata: event.metadata,
        created_at: new Date(),
      };

      await this.collection.insertOne(doc);
    } catch (error: any) {
      // If duplicate event_id (E11000), silently ignore (idempotent behavior)
      if (error.code === 11000) {
        console.log(`Event ${event.event_id} already exists (idempotent - skipping)`);
        return;
      }
      throw error;
    }
  }

  /**
   * Get all events for a specific AR
   */
  async getEventsForAR(ar_id: string): Promise<DomainEvent[]> {
    const docs = await this.collection
      .find({ ar_id })
      .sort({ timestamp: 1 })
      .toArray();

    return docs.map(this.mapDocumentToEvent);
  }

  /**
   * Get events by type within date range
   */
  async getEventsByType(
    event_type: EventType,
    from?: Date,
    to?: Date
  ): Promise<DomainEvent[]> {
    const query: any = { event_type };

    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = from;
      if (to) query.timestamp.$lte = to;
    }

    const docs = await this.collection
      .find(query)
      .sort({ timestamp: 1 })
      .toArray();

    return docs.map(this.mapDocumentToEvent);
  }

  /**
   * Stream all events (for full rebuild)
   */
  async *streamAllEvents(): AsyncIterableIterator<DomainEvent> {
    const cursor = this.collection.find().sort({ timestamp: 1 });

    for await (const doc of cursor) {
      yield this.mapDocumentToEvent(doc);
    }
  }

  /**
   * Get event count for AR
   */
  async getEventCount(ar_id: string): Promise<number> {
    return await this.collection.countDocuments({ ar_id });
  }

  /**
   * Map MongoDB document to domain event
   */
  private mapDocumentToEvent(doc: EventDocument): DomainEvent {
    // Convert Date objects if stored as strings
    const timestamp = doc.timestamp instanceof Date ? doc.timestamp : new Date(doc.timestamp);

    // Convert payload dates if they exist
    const payload = { ...doc.payload };
    if (payload.invoice_date && !(payload.invoice_date instanceof Date)) {
      payload.invoice_date = new Date(payload.invoice_date);
    }
    if (payload.due_date && !(payload.due_date instanceof Date)) {
      payload.due_date = new Date(payload.due_date);
    }
    if (payload.payment_date && !(payload.payment_date instanceof Date)) {
      payload.payment_date = new Date(payload.payment_date);
    }
    if (payload.next_action_date && !(payload.next_action_date instanceof Date)) {
      payload.next_action_date = new Date(payload.next_action_date);
    }
    if (payload.scheduled_for && !(payload.scheduled_for instanceof Date)) {
      payload.scheduled_for = new Date(payload.scheduled_for);
    }
    if (payload.sent_at && !(payload.sent_at instanceof Date)) {
      payload.sent_at = new Date(payload.sent_at);
    }
    if (payload.failed_at && !(payload.failed_at instanceof Date)) {
      payload.failed_at = new Date(payload.failed_at);
    }

    return {
      event_id: doc.event_id,
      ar_id: doc.ar_id,
      event_type: doc.event_type as EventType,
      timestamp,
      actor: doc.actor,
      payload,
      metadata: doc.metadata,
    } as DomainEvent;
  }
}

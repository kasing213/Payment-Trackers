/**
 * Event Store Interface (Repository Port)
 * Defines contract for event storage
 */

import { AREvent } from '../events/ar-events';
import { AlertEvent } from '../events/alert-events';
import { EventType } from '../events/types';

/**
 * Union of all domain events
 */
export type DomainEvent = AREvent | AlertEvent;

/**
 * Event Store Repository Interface
 * Implements event sourcing pattern - append-only event log
 */
export interface IEventStore {
  /**
   * Append a new event to the store
   * This operation is idempotent - duplicate event_ids are ignored
   *
   * @param event - The event to append
   * @throws Error if event cannot be appended (non-duplicate errors)
   */
  append(event: DomainEvent): Promise<void>;

  /**
   * Get all events for a specific AR, ordered by timestamp
   *
   * @param ar_id - AR identifier
   * @returns Array of events for the AR
   */
  getEventsForAR(ar_id: string): Promise<DomainEvent[]>;

  /**
   * Get events by type within a date range
   * Useful for analytics and reporting
   *
   * @param event_type - Type of events to retrieve
   * @param from - Optional start date
   * @param to - Optional end date
   * @returns Array of matching events
   */
  getEventsByType(
    event_type: EventType,
    from?: Date,
    to?: Date
  ): Promise<DomainEvent[]>;

  /**
   * Stream all events (for full state rebuild)
   * Use this for rebuilding all AR state from scratch
   *
   * @returns Async iterator of all events
   */
  streamAllEvents(): AsyncIterableIterator<DomainEvent>;

  /**
   * Get event count for an AR
   *
   * @param ar_id - AR identifier
   * @returns Number of events for the AR
   */
  getEventCount(ar_id: string): Promise<number>;
}

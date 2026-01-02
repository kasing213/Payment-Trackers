/**
 * Event Replay Service
 * Derives AR state from event history (pure function)
 * Enables rebuilding state from scratch
 */

import { AREvent, ARCreatedEvent } from '../events/ar-events';
import { ARState, ARStatus } from '../models/ar';
import { EventType } from '../events/types';

/**
 * Event Replay Service - Pure functions for state derivation
 */
export class EventReplayService {
  /**
   * Rebuild AR state from all events
   * This is a pure function - same events always produce same state
   *
   * @param events - Array of events for a single AR, ordered by timestamp
   * @returns Derived AR state
   * @throws Error if events array is empty or invalid
   */
  static replayEvents(events: AREvent[]): ARState {
    if (events.length === 0) {
      throw new Error('Cannot replay from empty event list');
    }

    // First event must be AR_CREATED
    const createdEvent = events[0];
    if (createdEvent.event_type !== EventType.AR_CREATED) {
      throw new Error('First event must be AR_CREATED');
    }

    // Initialize state from AR_CREATED event
    let state: ARState = this.initializeFromCreatedEvent(createdEvent as ARCreatedEvent);

    // Apply subsequent events
    for (let i = 1; i < events.length; i++) {
      state = this.applyEvent(state, events[i]);
    }

    return state;
  }

  /**
   * Initialize AR state from AR_CREATED event
   */
  private static initializeFromCreatedEvent(event: ARCreatedEvent): ARState {
    return {
      ar_id: event.ar_id,
      home_id: event.payload.home_id,
      zone: event.payload.zone,
      customer_name: event.payload.customer_name,
      amount: event.payload.amount,
      current_status: ARStatus.PENDING, // Initial status
      invoice_date: event.payload.invoice_date,
      due_date: event.payload.due_date,
      assigned_sales_id: event.payload.assigned_sales_id,
      customer_chat_id: event.payload.customer_chat_id,
      manager_chat_id: event.payload.manager_chat_id,
      last_event_id: event.event_id,
      last_event_at: event.timestamp,
      event_count: 1,
      version: 1,
    };
  }

  /**
   * Apply a single event to existing state
   * Returns new state (immutable update)
   */
  private static applyEvent(state: ARState, event: AREvent): ARState {
    // Create new state object (immutable)
    const updated: ARState = {
      ...state,
      last_event_id: event.event_id,
      last_event_at: event.timestamp,
      event_count: state.event_count + 1,
    };

    switch (event.event_type) {
      case EventType.STATUS_CHANGED:
        updated.current_status = event.payload.new_status;
        break;

      case EventType.PAYMENT_VERIFIED:
        updated.current_status = ARStatus.PAID;
        updated.paid_date = event.payload.payment_date;
        break;

      case EventType.DUE_DATE_CHANGED:
        updated.due_date = event.payload.new_due_date;
        break;

      case EventType.FOLLOW_UP_LOGGED:
        // Follow-up doesn't change materialized state
        // (notes are stored in events only)
        break;

      case EventType.AR_CREATED:
        // Should not happen (only first event)
        break;

      default:
        // Unknown event types are ignored (forward compatibility)
        // This includes alert events which don't affect AR state
        break;
    }

    return updated;
  }

  /**
   * Validate event sequence
   * Ensures events are properly ordered and valid
   *
   * @param events - Events to validate
   * @returns true if valid, throws Error otherwise
   */
  static validateEventSequence(events: AREvent[]): boolean {
    if (events.length === 0) {
      throw new Error('Event sequence cannot be empty');
    }

    // First event must be AR_CREATED
    if (events[0].event_type !== EventType.AR_CREATED) {
      throw new Error('First event must be AR_CREATED');
    }

    // All events must have same ar_id
    const ar_id = events[0].ar_id;
    for (const event of events) {
      if (event.ar_id !== ar_id) {
        throw new Error(`Event ${event.event_id} has different ar_id: ${event.ar_id} != ${ar_id}`);
      }
    }

    // Events should be ordered by timestamp
    for (let i = 1; i < events.length; i++) {
      if (events[i].timestamp < events[i - 1].timestamp) {
        console.warn('Events are not ordered by timestamp');
      }
    }

    return true;
  }
}

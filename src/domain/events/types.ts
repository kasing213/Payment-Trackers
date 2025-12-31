/**
 * Base Event Types and Enums
 * Foundation for all events in the AR Event & Alert Engine
 */

/**
 * All possible event types in the system
 */
export enum EventType {
  AR_CREATED = 'AR_CREATED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  FOLLOW_UP_LOGGED = 'FOLLOW_UP_LOGGED',
  ALERT_QUEUED = 'ALERT_QUEUED',
  ALERT_SENT = 'ALERT_SENT',
  ALERT_FAILED = 'ALERT_FAILED',
  PAYMENT_VERIFIED = 'PAYMENT_VERIFIED',
  DUE_DATE_CHANGED = 'DUE_DATE_CHANGED',
}

/**
 * Actor types - who triggered the event
 */
export enum ActorType {
  SYSTEM = 'SYSTEM',
  MANAGER = 'MANAGER',
  SALES = 'SALES',
}

/**
 * Actor information - identifies who performed the action
 */
export interface Actor {
  type: ActorType;
  user_id?: string;
}

/**
 * Event metadata for tracing and versioning
 */
export interface EventMetadata {
  correlation_id?: string; // Groups related events
  causation_id?: string;   // Event that caused this one
  version: number;         // Schema version for migrations
}

/**
 * Base structure for all events
 * All events must extend this interface
 */
export interface BaseEvent {
  event_id: string;        // Unique event identifier (UUID)
  ar_id: string;           // AR this event belongs to
  event_type: EventType;   // Type of event
  timestamp: Date;         // When the event occurred
  actor: Actor;            // Who triggered the event
  metadata: EventMetadata; // Additional metadata
}

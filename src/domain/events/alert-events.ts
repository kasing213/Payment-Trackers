/**
 * Alert-Specific Events
 * Defines all events related to alert lifecycle
 */

import { BaseEvent, EventType } from './types';
import { AlertType, TargetType } from '../models/alert';

/**
 * ALERT_QUEUED Event
 * Emitted when an alert is queued for delivery
 */
export interface AlertQueuedEvent extends BaseEvent {
  event_type: EventType.ALERT_QUEUED;
  payload: {
    alert_id: string;
    alert_type: AlertType;
    target_type: TargetType;
    priority: number;
    scheduled_for: Date;
  };
}

/**
 * ALERT_SENT Event
 * Emitted when an alert is successfully sent
 */
export interface AlertSentEvent extends BaseEvent {
  event_type: EventType.ALERT_SENT;
  payload: {
    alert_id: string;
    sent_at: Date;
    delivery_platform: string; // "TELEGRAM", "EMAIL", etc.
    delivery_id?: string;      // Platform-specific message ID
  };
}

/**
 * ALERT_FAILED Event
 * Emitted when an alert delivery fails
 */
export interface AlertFailedEvent extends BaseEvent {
  event_type: EventType.ALERT_FAILED;
  payload: {
    alert_id: string;
    failed_at: Date;
    error: string;     // Error message
    attempts: number;  // How many attempts made
  };
}

/**
 * Union type of all alert events
 */
export type AlertEvent =
  | AlertQueuedEvent
  | AlertSentEvent
  | AlertFailedEvent;

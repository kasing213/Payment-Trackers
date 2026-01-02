/**
 * AR-Specific Events
 * Defines all events related to AR lifecycle
 */

import { BaseEvent, EventType } from './types';
import { Money, ARStatus } from '../models/ar';

/**
 * AR_CREATED Event
 * Emitted when a new AR is created in the system
 */
export interface ARCreatedEvent extends BaseEvent {
  event_type: EventType.AR_CREATED;
  payload: {
    home_id: string;           // House/meter ID (e.g., "B101")
    zone: string;              // Area/route (e.g., "Sros")
    customer_name: string;     // Person living there
    amount: Money;
    invoice_date: Date;
    due_date: Date;
    assigned_sales_id?: string;
    customer_chat_id?: string; // Telegram chat_id for delivery
    manager_chat_id?: string;  // Manager's Telegram chat_id
  };
}

/**
 * STATUS_CHANGED Event
 * Emitted when AR status changes (e.g., PENDING → OVERDUE)
 */
export interface StatusChangedEvent extends BaseEvent {
  event_type: EventType.STATUS_CHANGED;
  payload: {
    old_status: ARStatus;
    new_status: ARStatus;
    reason: string; // Why status changed
  };
}

/**
 * FOLLOW_UP_LOGGED Event
 * Emitted when manager or sales logs a follow-up note
 */
export interface FollowUpLoggedEvent extends BaseEvent {
  event_type: EventType.FOLLOW_UP_LOGGED;
  payload: {
    notes: string;              // Follow-up notes
    next_action?: string;       // Planned next action
    next_action_date?: Date;    // When to take next action
  };
}

/**
 * PAYMENT_VERIFIED Event
 * Emitted when payment has been verified as received
 */
export interface PaymentVerifiedEvent extends BaseEvent {
  event_type: EventType.PAYMENT_VERIFIED;
  payload: {
    paid_amount: Money;
    payment_date: Date;
    verification_method: string; // How payment was verified
    verified_by: string;         // Who verified
  };
}

/**
 * DUE_DATE_CHANGED Event
 * Emitted when AR due date is changed (e.g., from Excel import update)
 */
export interface DueDateChangedEvent extends BaseEvent {
  event_type: EventType.DUE_DATE_CHANGED;
  payload: {
    old_due_date: Date;
    new_due_date: Date;
    reason: string; // Why due date changed
  };
}

/**
 * Union type of all AR events
 */
export type AREvent =
  | ARCreatedEvent
  | StatusChangedEvent
  | FollowUpLoggedEvent
  | PaymentVerifiedEvent
  | DueDateChangedEvent;

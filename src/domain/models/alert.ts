/**
 * Alert Domain Model
 * Represents queued alerts for delivery to customers, managers, or sales
 */

/**
 * Alert Type - classification of alerts
 */
export enum AlertType {
  PRE_ALERT = 'PRE_ALERT',       // Reminder before due date
  DUE = 'DUE',                   // On due date
  OVERDUE = 'OVERDUE',           // After due date
  ESCALATION = 'ESCALATION',     // Manager escalation
}

/**
 * Target Type - who should receive the alert
 */
export enum TargetType {
  CUSTOMER = 'CUSTOMER', // Alert to customer
  MANAGER = 'MANAGER',   // Alert to manager
  SALES = 'SALES',       // Alert to assigned sales person
}

/**
 * Alert Status - lifecycle of an alert in the queue
 */
export enum AlertStatus {
  QUEUED = 'QUEUED',         // Waiting to be sent
  PROCESSING = 'PROCESSING', // Currently being sent
  SENT = 'SENT',             // Successfully delivered
  FAILED = 'FAILED',         // Failed after max retries
}

/**
 * Delivery platform type
 */
export type DeliveryPlatform = 'TELEGRAM'; // Extensible for future (EMAIL, WHATSAPP, etc.)

/**
 * Delivery Address - where to send the alert
 * Abstracted to support multiple platforms
 */
export interface DeliveryAddress {
  platform: DeliveryPlatform;
  chat_id: string; // Platform-specific address (Telegram chat_id, email, etc.)
}

/**
 * Alert - queued alert waiting for delivery
 */
export interface Alert {
  // Identity
  alert_id: string;
  ar_id: string; // Which AR triggered this alert

  // Deduplication (prevents duplicate alerts)
  dedup_key?: string; // Unique key for idempotency (e.g., "ar123_DUE_2025-01-15")

  // Classification
  alert_type: AlertType;
  target_type: TargetType;
  priority: number; // 1 (low) to 5 (high)

  // Delivery information
  delivery_address: DeliveryAddress;

  // Message content
  message_template: string;            // Template name or message text
  message_data: Record<string, any>;  // Data to populate template

  // Status tracking
  status: AlertStatus;
  attempts: number;      // How many times we've tried to send
  max_attempts: number;  // Maximum retry attempts

  // Scheduling
  scheduled_for: Date; // When to send (allows delayed alerts)
  sent_at?: Date;      // When successfully sent
  failed_at?: Date;    // When final failure occurred
  error?: string;      // Error message if failed

  // Event linkage
  triggered_by_event_id: string; // Which event caused this alert
}

/**
 * Helper function to determine if alert is ready to process
 */
export function isReadyToProcess(alert: Alert, currentTime: Date = new Date()): boolean {
  return (
    alert.status === AlertStatus.QUEUED &&
    alert.scheduled_for <= currentTime
  );
}

/**
 * Helper function to determine if alert can be retried
 */
export function canRetry(alert: Alert): boolean {
  return alert.attempts < alert.max_attempts;
}

/**
 * Helper function to calculate next retry time (exponential backoff)
 */
export function getNextRetryTime(alert: Alert, baseDelayMs: number = 5 * 60 * 1000): Date {
  // Exponential backoff: baseDelay * 2^(attempts-1)
  const delayMs = baseDelayMs * Math.pow(2, alert.attempts - 1);
  return new Date(Date.now() + delayMs);
}

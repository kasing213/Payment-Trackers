/**
 * AR (Accounts Receivable) Domain Model
 * Core entity representing an accounts receivable record
 */

/**
 * AR Status - lifecycle states for an AR
 */
export enum ARStatus {
  PENDING = 'PENDING',         // Not yet paid, not overdue
  OVERDUE = 'OVERDUE',         // Past due date, not paid
  PAID = 'PAID',               // Payment verified
  WRITTEN_OFF = 'WRITTEN_OFF', // No longer pursuing payment
}

/**
 * Money value object
 * Represents a monetary amount with currency
 */
export interface Money {
  value: number;   // Decimal amount
  currency: string; // ISO currency code (USD, EUR, etc.)
}

/**
 * AR State - Materialized view of AR derived from events
 * This is the "current state" view that can be rebuilt from event history
 */
export interface ARState {
  // Identity
  ar_id: string;
  home_id: string;       // House/meter ID (e.g., "B101") - the billable entity
  zone: string;          // Area/route (e.g., "Sros") - current zone assignment
  customer_name: string; // Person living there (can change)

  // Financial data
  amount: Money;

  // Status
  current_status: ARStatus;

  // Important dates
  invoice_date: Date;
  due_date: Date;
  paid_date?: Date;

  // Assignment
  assigned_sales_id?: string;

  // Contact info (for alert delivery only - NOT for business logic)
  customer_chat_id?: string; // Telegram chat_id (delivery address)
  manager_chat_id?: string;  // Manager's Telegram chat_id

  // Event tracking metadata
  last_event_id: string;  // Last event that updated this state
  last_event_at: Date;    // When last event occurred
  event_count: number;    // Total number of events processed

  // Optimistic locking
  version: number; // For preventing concurrent update conflicts
}

/**
 * Helper function to determine if an AR is overdue
 */
export function isOverdue(ar: ARState, currentDate: Date = new Date()): boolean {
  if (ar.current_status === ARStatus.PAID || ar.current_status === ARStatus.WRITTEN_OFF) {
    return false;
  }

  const today = new Date(currentDate);
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(ar.due_date);
  dueDate.setHours(0, 0, 0, 0);

  return today > dueDate;
}

/**
 * Helper function to get days until/since due date
 * Returns positive number if overdue, negative if not yet due
 */
export function daysSinceDue(ar: ARState, currentDate: Date = new Date()): number {
  const today = new Date(currentDate);
  today.setHours(0, 0, 0, 0);

  const dueDate = new Date(ar.due_date);
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - dueDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

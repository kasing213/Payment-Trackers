/**
 * AR Repository Interface (Repository Port)
 * Defines contract for AR state persistence
 */

import { ARState, ARStatus } from '../models/ar';

/**
 * AR Repository Interface
 * Manages AR state (materialized view from events)
 */
export interface IARRepository {
  /**
   * Save or update AR state
   * Uses optimistic locking via version field
   *
   * @param state - AR state to save
   * @throws Error if optimistic lock fails
   */
  save(state: ARState): Promise<void>;

  /**
   * Find AR by ID
   *
   * @param ar_id - AR identifier
   * @returns AR state or null if not found
   */
  findById(ar_id: string): Promise<ARState | null>;

  /**
   * Find ARs by home ID
   *
   * @param home_id - Home/meter identifier (e.g., "B101")
   * @returns Array of AR states
   */
  findByHomeId(home_id: string): Promise<ARState[]>;

  /**
   * Find ARs by zone
   *
   * @param zone - Zone/area identifier (e.g., "Sros")
   * @returns Array of AR states
   */
  findByZone(zone: string): Promise<ARState[]>;

  /**
   * Find ARs by status
   *
   * @param status - AR status
   * @returns Array of AR states
   */
  findByStatus(status: ARStatus): Promise<ARState[]>;

  /**
   * Find ARs by due date and status
   * Useful for checking which ARs are due on a specific date
   *
   * @param due_date - Due date to match
   * @param status - AR status
   * @returns Array of AR states
   */
  findByDueDateAndStatus(due_date: Date, status: ARStatus): Promise<ARState[]>;

  /**
   * Find AR by home ID and due date
   * Used for duplicate prevention in monthly AR auto-creation
   *
   * @param home_id - Home/meter identifier
   * @param due_date - Due date to match
   * @returns AR state or null if not found
   */
  findByHomeIdAndDueDate(home_id: string, due_date: Date): Promise<ARState | null>;

  /**
   * Find overdue ARs
   * Returns ARs where due_date < current date and status is PENDING
   *
   * @param current_date - Current date to compare against
   * @returns Array of overdue AR states
   */
  findOverdue(current_date: Date): Promise<ARState[]>;

  /**
   * Find ARs assigned to a sales person
   *
   * @param sales_id - Sales person identifier
   * @returns Array of AR states
   */
  findBySalesId(sales_id: string): Promise<ARState[]>;

  /**
   * Get all ARs (use with caution - pagination recommended)
   *
   * @param limit - Maximum number of results
   * @param offset - Number of results to skip
   * @returns Array of AR states
   */
  findAll(limit?: number, offset?: number): Promise<ARState[]>;

  /**
   * Update AR status (called after STATUS_CHANGED event)
   *
   * @param ar_id - AR identifier
   * @param new_status - New status to set
   */
  updateStatus(ar_id: string, new_status: ARStatus): Promise<void>;

  /**
   * Update AR payment info (called after PAYMENT_VERIFIED event)
   *
   * @param ar_id - AR identifier
   * @param paid_amount - Amount paid
   * @param payment_date - Date payment was received
   */
  updatePayment(ar_id: string, paid_amount: { value: number; currency: string }, payment_date: Date): Promise<void>;

  /**
   * Delete AR state (use only for testing/cleanup)
   * NOT for normal operations (events are immutable)
   *
   * @param ar_id - AR identifier
   */
  delete(ar_id: string): Promise<void>;
}

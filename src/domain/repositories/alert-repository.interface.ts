/**
 * Alert Repository Interface (Repository Port)
 * Defines contract for alert queue persistence
 */

import { Alert, AlertStatus } from '../models/alert';

/**
 * Alert Repository Interface
 * Manages alert queue
 */
export interface IAlertRepository {
  /**
   * Save or update alert
   *
   * @param alert - Alert to save
   */
  save(alert: Alert): Promise<void>;

  /**
   * Find alert by ID
   *
   * @param alert_id - Alert identifier
   * @returns Alert or null if not found
   */
  findById(alert_id: string): Promise<Alert | null>;

  /**
   * Find alerts by AR ID
   *
   * @param ar_id - AR identifier
   * @returns Array of alerts
   */
  findByARId(ar_id: string): Promise<Alert[]>;

  /**
   * Find pending alerts (status = QUEUED)
   *
   * @returns Array of pending alerts
   */
  findPending(): Promise<Alert[]>;

  /**
   * Find pending alerts ready to process
   * Returns alerts where status=QUEUED and scheduled_for <= current_time
   *
   * @param current_time - Current time to compare against
   * @returns Array of ready alerts
   */
  findPendingBySchedule(current_time: Date): Promise<Alert[]>;

  /**
   * Find alert by deduplication key
   * Used for idempotency to prevent duplicate alerts
   *
   * @param dedup_key - Deduplication key
   * @returns Alert or null if not found
   */
  findByDedupKey(dedup_key: string): Promise<Alert | null>;

  /**
   * Find alerts by status
   *
   * @param status - Alert status
   * @returns Array of alerts
   */
  findByStatus(status: AlertStatus): Promise<Alert[]>;

  /**
   * Find failed alerts (for retry analysis)
   *
   * @returns Array of failed alerts
   */
  findFailed(): Promise<Alert[]>;

  /**
   * Delete alert (for testing/cleanup)
   *
   * @param alert_id - Alert identifier
   */
  delete(alert_id: string): Promise<void>;
}

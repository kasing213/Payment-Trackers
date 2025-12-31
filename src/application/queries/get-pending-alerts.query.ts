/**
 * Get Pending Alerts Query
 * Query handler for retrieving pending alerts
 */

import { Alert } from '../../domain/models/alert';

// This will be implemented once we have the alert repository
export interface IAlertRepository {
  findPending(): Promise<Alert[]>;
  findByARId(ar_id: string): Promise<Alert[]>;
}

/**
 * Get Pending Alerts Query Handler
 */
export class GetPendingAlertsQuery {
  constructor(private alertRepository: IAlertRepository) {}

  /**
   * Execute query to get all pending alerts
   *
   * @returns Array of pending alerts
   */
  async execute(): Promise<Alert[]> {
    return await this.alertRepository.findPending();
  }

  /**
   * Execute query to get alerts for a specific AR
   *
   * @param ar_id - AR identifier
   * @returns Array of alerts
   */
  async executeByAR(ar_id: string): Promise<Alert[]> {
    if (!ar_id || ar_id.trim() === '') {
      throw new Error('ar_id is required');
    }

    return await this.alertRepository.findByARId(ar_id);
  }
}

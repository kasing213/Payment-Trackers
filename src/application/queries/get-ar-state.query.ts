/**
 * Get AR State Query
 * Query handler for retrieving AR state
 */

import { IARRepository } from '../../domain/repositories/ar-repository.interface';
import { ARState } from '../../domain/models/ar';

/**
 * Get AR State Query Handler
 */
export class GetARStateQuery {
  constructor(private arRepository: IARRepository) {}

  /**
   * Execute query to get AR state by ID
   *
   * @param ar_id - AR identifier
   * @returns AR state or null if not found
   */
  async execute(ar_id: string): Promise<ARState | null> {
    if (!ar_id || ar_id.trim() === '') {
      throw new Error('ar_id is required');
    }

    return await this.arRepository.findById(ar_id);
  }

  /**
   * Execute query to get all ARs for a home
   *
   * @param home_id - Home/meter identifier (e.g., "B101")
   * @returns Array of AR states
   */
  async executeByHome(home_id: string): Promise<ARState[]> {
    if (!home_id || home_id.trim() === '') {
      throw new Error('home_id is required');
    }

    return await this.arRepository.findByHomeId(home_id);
  }

  /**
   * Execute query to get all ARs for a zone
   *
   * @param zone - Zone/area identifier (e.g., "Sros")
   * @returns Array of AR states
   */
  async executeByZone(zone: string): Promise<ARState[]> {
    if (!zone || zone.trim() === '') {
      throw new Error('zone is required');
    }

    return await this.arRepository.findByZone(zone);
  }

  /**
   * Execute query to get ARs assigned to a sales person
   *
   * @param sales_id - Sales person identifier
   * @returns Array of AR states
   */
  async executeBySales(sales_id: string): Promise<ARState[]> {
    if (!sales_id || sales_id.trim() === '') {
      throw new Error('sales_id is required');
    }

    return await this.arRepository.findBySalesId(sales_id);
  }
}

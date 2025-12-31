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
   * Execute query to get all ARs for a customer
   *
   * @param customer_id - Customer identifier
   * @returns Array of AR states
   */
  async executeByCustomer(customer_id: string): Promise<ARState[]> {
    if (!customer_id || customer_id.trim() === '') {
      throw new Error('customer_id is required');
    }

    return await this.arRepository.findByCustomerId(customer_id);
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

/**
 * Railway API Client Service
 * HTTP client for communicating with Railway-hosted AR API
 */

import axios, { AxiosInstance } from 'axios';
import { ExcelImportLog } from '../models/excel-import';

/**
 * Railway API Service
 * Provides HTTP methods to interact with Railway API endpoints
 */
export class RailwayAPIService {
  private client: AxiosInstance;

  constructor(
    railwayApiUrl: string,
    apiKey: string
  ) {
    this.client = axios.create({
      baseURL: railwayApiUrl,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      timeout: 30000  // 30 second timeout
    });
  }

  /**
   * Create new AR via Railway API
   * @param data - Normalized AR data from Excel
   * @returns Created AR ID
   */
  async createAR(data: {
    home_id: string;           // House/meter ID (e.g., "B101")
    zone: string;              // Zone/area (e.g., "Sros")
    customer_name: string;
    amount: { value: number; currency: string };
    invoice_date: Date;
    due_date: Date;
  }): Promise<{ ar_id: string }> {
    const response = await this.client.post('/api/ar', {
      home_id: data.home_id,
      zone: data.zone,
      customer_name: data.customer_name,
      amount: data.amount,
      invoice_date: data.invoice_date.toISOString(),
      due_date: data.due_date.toISOString()
    });

    return response.data;
  }

  /**
   * Change AR due date via Railway API
   * @param ar_id - AR ID to update
   * @param new_due_date - New due date
   * @param reason - Reason for change
   */
  async changeDueDate(ar_id: string, new_due_date: Date, reason: string): Promise<void> {
    await this.client.post(`/api/ar/${ar_id}/change-due-date`, {
      new_due_date: new_due_date.toISOString(),
      reason
    });
  }

  /**
   * Get AR state by ID
   * @param ar_id - AR ID to fetch
   * @returns AR state data
   */
  async getARState(ar_id: string): Promise<any> {
    const response = await this.client.get(`/api/ar/${ar_id}`);
    return response.data;
  }

  /**
   * Get ARs by home ID (for duplicate detection)
   * @param home_id - Home/meter ID to search (e.g., "B101")
   * @returns Array of AR states
   */
  async getARsByHome(home_id: string): Promise<any[]> {
    const response = await this.client.get(`/api/ar/home/${home_id}`);
    return response.data.ars || [];
  }

  /**
   * Save Excel import log to Railway MongoDB
   * @param log - Import log to save
   */
  async saveImportLog(log: ExcelImportLog): Promise<void> {
    await this.client.post('/api/excel-imports', log);
  }

  /**
   * Health check
   * @returns true if API is reachable and healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.data.status === 'healthy' || response.data.status === 'ok';
    } catch {
      return false;
    }
  }
}

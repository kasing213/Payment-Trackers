/**
 * Alert Processor Worker
 * Background worker that processes the alert queue
 */

import { IAlertRepository } from '../domain/repositories/alert-repository.interface';
import { AlertDeliveryService } from '../infrastructure/messaging/alert-delivery';

/**
 * Alert Processor Worker
 * Continuously polls the alert queue and processes pending alerts
 */
export class AlertProcessorWorker {
  private isRunning: boolean = false;
  private intervalMs: number;

  constructor(
    private alertRepository: IAlertRepository,
    private deliveryService: AlertDeliveryService,
    intervalMs: number = 10000 // Poll every 10 seconds by default
  ) {
    this.intervalMs = intervalMs;
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Alert processor worker is already running');
      return;
    }

    this.isRunning = true;
    console.log(`Alert processor worker started (polling every ${this.intervalMs / 1000}s)`);

    while (this.isRunning) {
      try {
        await this.processAlerts();
      } catch (error) {
        console.error('Error processing alerts:', error);
      }

      // Wait before next iteration
      await this.sleep(this.intervalMs);
    }

    console.log('Alert processor worker stopped');
  }

  /**
   * Stop the worker
   */
  stop(): void {
    this.isRunning = false;
    console.log('Stopping alert processor worker...');
  }

  /**
   * Process pending alerts
   */
  private async processAlerts(): Promise<void> {
    // Find alerts ready to send
    const currentTime = new Date();
    const alerts = await this.alertRepository.findPendingBySchedule(currentTime);

    if (alerts.length === 0) {
      return;
    }

    console.log(`Processing ${alerts.length} pending alerts...`);

    let successCount = 0;
    let failureCount = 0;

    for (const alert of alerts) {
      try {
        await this.deliveryService.deliverAlert(alert);
        successCount++;
      } catch (error) {
        // Error is already handled in deliveryService (logged as ALERT_FAILED event)
        failureCount++;
      }
    }

    console.log(
      `Alert batch processed: ${successCount} successful, ${failureCount} failed`
    );
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

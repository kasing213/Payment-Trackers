/**
 * Date Checker Worker
 * Background worker that checks for ARs due and queues appropriate alerts
 */

import * as cron from 'node-cron';
import { IARRepository } from '../domain/repositories/ar-repository.interface';
import { AlertService } from '../domain/services/alert-service';
import { ARStatus } from '../domain/models/ar';
import { AlertType, TargetType } from '../domain/models/alert';

/**
 * Date Checker Worker Configuration
 */
export interface DateCheckerConfig {
  prealertDays?: number; // Days before due date to send pre-alert (default: 3)
}

/**
 * Date Checker Worker
 * Runs on a cron schedule to check for due/overdue ARs and queue alerts
 */
export class DateCheckerWorker {
  private cronJob: cron.ScheduledTask | null = null;
  private prealertDays: number;

  constructor(
    private arRepository: IARRepository,
    private alertService: AlertService,
    config: DateCheckerConfig = {}
  ) {
    this.prealertDays = config.prealertDays || 3;
  }

  /**
   * Start the worker with cron schedule
   * Default: Run daily at 9:00 AM
   */
  start(cronSchedule: string = '0 9 * * *'): void {
    if (this.cronJob) {
      console.log('Date checker worker is already running');
      return;
    }

    this.cronJob = cron.schedule(cronSchedule, async () => {
      await this.run();
    });

    console.log(`Date checker worker started (cron: ${cronSchedule})`);

    // Run immediately on start
    this.run().catch((error) => {
      console.error('Error in initial date check run:', error);
    });
  }

  /**
   * Stop the worker
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('Date checker worker stopped');
    }
  }

  /**
   * Run the date checks manually
   */
  async run(): Promise<void> {
    console.log(`Running date checker at ${new Date().toISOString()}`);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      await this.checkDueARs(today);
      await this.checkOverdueARs(today);
      await this.checkPreAlerts(today);

      console.log('Date checker completed successfully');
    } catch (error) {
      console.error('Error in date checker:', error);
      throw error;
    }
  }

  /**
   * Check for ARs due today and queue alerts
   */
  private async checkDueARs(today: Date): Promise<void> {
    const dueARs = await this.arRepository.findByDueDateAndStatus(today, ARStatus.PENDING);

    console.log(`Found ${dueARs.length} ARs due today`);

    for (const ar of dueARs) {
      // Queue alert to customer (if chat_id available)
      if (ar.customer_chat_id) {
        await this.alertService.queueAlert({
          ar_id: ar.ar_id,
          alert_type: AlertType.DUE,
          target_type: TargetType.CUSTOMER,
          delivery_chat_id: ar.customer_chat_id,
          priority: 3,
          message_template: `Payment Reminder: Your invoice for ${ar.amount.value} ${ar.amount.currency} is due today. Customer: ${ar.customer_name}`,
          message_data: {
            ar_id: ar.ar_id,
            customer_name: ar.customer_name,
            amount: `${ar.amount.value} ${ar.amount.currency}`,
            due_date: ar.due_date.toISOString().split('T')[0],
          },
        });
      }

      // Queue alert to manager (for visibility)
      if (ar.manager_chat_id) {
        await this.alertService.queueAlert({
          ar_id: ar.ar_id,
          alert_type: AlertType.DUE,
          target_type: TargetType.MANAGER,
          delivery_chat_id: ar.manager_chat_id,
          priority: 2,
          message_template: `Manager Alert: AR ${ar.ar_id} for ${ar.customer_name} is due today (${ar.amount.value} ${ar.amount.currency})`,
          message_data: {
            ar_id: ar.ar_id,
            customer_name: ar.customer_name,
            amount: `${ar.amount.value} ${ar.amount.currency}`,
          },
        });
      }
    }
  }

  /**
   * Check for overdue ARs and queue escalation alerts
   */
  private async checkOverdueARs(today: Date): Promise<void> {
    const overdueARs = await this.arRepository.findOverdue(today);

    console.log(`Found ${overdueARs.length} overdue ARs`);

    for (const ar of overdueARs) {
      // Calculate days overdue
      const daysOverdue = Math.floor(
        (today.getTime() - ar.due_date.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Queue escalation to manager
      if (ar.manager_chat_id) {
        await this.alertService.queueAlert({
          ar_id: ar.ar_id,
          alert_type: AlertType.OVERDUE,
          target_type: TargetType.MANAGER,
          delivery_chat_id: ar.manager_chat_id,
          priority: 4,
          message_template: `OVERDUE Alert: AR ${ar.ar_id} for ${ar.customer_name} is ${daysOverdue} days overdue (${ar.amount.value} ${ar.amount.currency})`,
          message_data: {
            ar_id: ar.ar_id,
            customer_name: ar.customer_name,
            amount: `${ar.amount.value} ${ar.amount.currency}`,
            days_overdue: daysOverdue.toString(),
          },
        });
      }

      // Also notify customer if significantly overdue (e.g., more than 7 days)
      if (daysOverdue > 7 && ar.customer_chat_id) {
        await this.alertService.queueAlert({
          ar_id: ar.ar_id,
          alert_type: AlertType.OVERDUE,
          target_type: TargetType.CUSTOMER,
          delivery_chat_id: ar.customer_chat_id,
          priority: 4,
          message_template: `Payment Overdue: Your payment of ${ar.amount.value} ${ar.amount.currency} is now ${daysOverdue} days overdue. Please settle immediately.`,
          message_data: {
            amount: `${ar.amount.value} ${ar.amount.currency}`,
            days_overdue: daysOverdue.toString(),
          },
        });
      }
    }
  }

  /**
   * Check for upcoming due dates and queue pre-alerts
   */
  private async checkPreAlerts(today: Date): Promise<void> {
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + this.prealertDays);

    const upcomingARs = await this.arRepository.findByDueDateAndStatus(
      targetDate,
      ARStatus.PENDING
    );

    console.log(
      `Found ${upcomingARs.length} ARs due in ${this.prealertDays} days`
    );

    for (const ar of upcomingARs) {
      // Queue pre-alert to customer
      if (ar.customer_chat_id) {
        await this.alertService.queueAlert({
          ar_id: ar.ar_id,
          alert_type: AlertType.PRE_ALERT,
          target_type: TargetType.CUSTOMER,
          delivery_chat_id: ar.customer_chat_id,
          priority: 2,
          message_template: `Payment Reminder: Your payment of ${ar.amount.value} ${ar.amount.currency} is due in ${this.prealertDays} days (${ar.due_date.toISOString().split('T')[0]}).`,
          message_data: {
            amount: `${ar.amount.value} ${ar.amount.currency}`,
            days: this.prealertDays.toString(),
            due_date: ar.due_date.toISOString().split('T')[0],
          },
        });
      }
    }
  }
}

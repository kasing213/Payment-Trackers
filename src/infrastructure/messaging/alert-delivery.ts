/**
 * Alert Delivery Service
 * Orchestrates alert delivery through various channels (Telegram, etc.)
 */

import { v4 as uuidv4 } from 'uuid';
import { TelegramClient } from './telegram-client';
import { IEventStore } from '../../domain/repositories/event-store.interface';
import { IAlertRepository } from '../../domain/repositories/alert-repository.interface';
import { Alert, AlertStatus, getNextRetryTime, canRetry } from '../../domain/models/alert';
import { AlertSentEvent, AlertFailedEvent } from '../../domain/events/alert-events';
import { EventType, ActorType } from '../../domain/events/types';

/**
 * Alert Delivery Service
 */
export class AlertDeliveryService {
  constructor(
    private telegramClient: TelegramClient,
    private eventStore: IEventStore,
    private alertRepository: IAlertRepository
  ) {}

  /**
   * Deliver an alert
   *
   * @param alert - Alert to deliver
   * @throws Error if delivery fails (caller should handle)
   */
  async deliverAlert(alert: Alert): Promise<void> {
    // Mark alert as processing
    alert.status = AlertStatus.PROCESSING;
    alert.attempts += 1;
    await this.alertRepository.save(alert);

    try {
      // Format message from template
      const messageText = this.formatMessage(alert.message_template, alert.message_data);

      // Send based on platform
      let delivery_id: string | undefined;

      if (alert.delivery_address.platform === 'TELEGRAM') {
        const result = await this.telegramClient.sendMessage({
          chat_id: alert.delivery_address.chat_id,
          text: messageText,
        });
        delivery_id = result.message_id.toString();
      } else {
        throw new Error(`Unsupported delivery platform: ${alert.delivery_address.platform}`);
      }

      // Mark as sent
      alert.status = AlertStatus.SENT;
      alert.sent_at = new Date();
      await this.alertRepository.save(alert);

      // Log ALERT_SENT event
      const event: AlertSentEvent = {
        event_id: uuidv4(),
        ar_id: alert.ar_id,
        event_type: EventType.ALERT_SENT,
        timestamp: new Date(),
        actor: {
          type: ActorType.SYSTEM,
        },
        metadata: {
          version: 1,
        },
        payload: {
          alert_id: alert.alert_id,
          sent_at: alert.sent_at,
          delivery_platform: alert.delivery_address.platform,
          delivery_id,
        },
      };

      await this.eventStore.append(event);

      console.log(`Alert ${alert.alert_id} delivered successfully`);
    } catch (error: any) {
      // Handle delivery failure
      await this.handleDeliveryFailure(alert, error.message);
      throw error; // Re-throw for caller to handle
    }
  }

  /**
   * Handle delivery failure
   */
  private async handleDeliveryFailure(alert: Alert, errorMessage: string): Promise<void> {
    alert.error = errorMessage;

    // Check if we can retry
    if (canRetry(alert)) {
      // Reset to QUEUED with delayed schedule
      alert.status = AlertStatus.QUEUED;
      alert.scheduled_for = getNextRetryTime(alert);
      console.log(
        `Alert ${alert.alert_id} failed (attempt ${alert.attempts}/${alert.max_attempts}). ` +
        `Retry scheduled for ${alert.scheduled_for.toISOString()}`
      );
    } else {
      // Mark as permanently failed
      alert.status = AlertStatus.FAILED;
      alert.failed_at = new Date();
      console.error(
        `Alert ${alert.alert_id} permanently failed after ${alert.attempts} attempts: ${errorMessage}`
      );
    }

    await this.alertRepository.save(alert);

    // Log ALERT_FAILED event
    const event: AlertFailedEvent = {
      event_id: uuidv4(),
      ar_id: alert.ar_id,
      event_type: EventType.ALERT_FAILED,
      timestamp: new Date(),
      actor: {
        type: ActorType.SYSTEM,
      },
      metadata: {
        version: 1,
      },
      payload: {
        alert_id: alert.alert_id,
        failed_at: new Date(),
        error: errorMessage,
        attempts: alert.attempts,
      },
    };

    await this.eventStore.append(event);
  }

  /**
   * Format message from template
   * Simple placeholder replacement - can be enhanced with proper templating engine
   */
  private formatMessage(template: string, data: Record<string, any>): string {
    let message = template;

    // Replace placeholders like {{key}} with data[key]
    Object.keys(data).forEach((key) => {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      message = message.replace(placeholder, String(data[key]));
    });

    return message;
  }
}

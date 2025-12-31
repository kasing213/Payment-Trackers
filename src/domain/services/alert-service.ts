/**
 * Alert Service
 * Business logic for queueing alerts
 */

import { v4 as uuidv4 } from 'uuid';
import { IEventStore } from '../repositories/event-store.interface';
import { IAlertRepository } from '../repositories/alert-repository.interface';
import { Alert, AlertType, TargetType, AlertStatus, DeliveryPlatform } from '../models/alert';
import { AlertQueuedEvent } from '../events/alert-events';
import { EventType, ActorType } from '../events/types';

/**
 * Queue Alert Parameters
 */
export interface QueueAlertParams {
  ar_id: string;
  alert_type: AlertType;
  target_type: TargetType;
  delivery_chat_id: string;
  delivery_platform?: DeliveryPlatform;
  priority?: number;
  scheduled_for?: Date;
  message_template: string;
  message_data: Record<string, any>;
  triggered_by_event_id?: string;
}

/**
 * Alert Service
 */
export class AlertService {
  constructor(
    private eventStore: IEventStore,
    private alertRepository: IAlertRepository
  ) {}

  /**
   * Queue an alert for delivery
   *
   * @param params - Alert parameters
   * @returns alert_id of the queued alert
   */
  async queueAlert(params: QueueAlertParams): Promise<string> {
    const alert_id = uuidv4();
    const event_id = uuidv4();

    // Default values
    const priority = params.priority ?? this.getDefaultPriority(params.alert_type);
    const scheduled_for = params.scheduled_for ?? new Date();
    const delivery_platform = params.delivery_platform ?? 'TELEGRAM';

    // Create alert
    const alert: Alert = {
      alert_id,
      ar_id: params.ar_id,
      alert_type: params.alert_type,
      target_type: params.target_type,
      priority,
      delivery_address: {
        platform: delivery_platform,
        chat_id: params.delivery_chat_id,
      },
      message_template: params.message_template,
      message_data: params.message_data,
      status: AlertStatus.QUEUED,
      attempts: 0,
      max_attempts: 3,
      scheduled_for,
      triggered_by_event_id: params.triggered_by_event_id ?? '',
    };

    // Save alert to queue
    await this.alertRepository.save(alert);

    // Create ALERT_QUEUED event
    const event: AlertQueuedEvent = {
      event_id,
      ar_id: params.ar_id,
      event_type: EventType.ALERT_QUEUED,
      timestamp: new Date(),
      actor: {
        type: ActorType.SYSTEM,
      },
      metadata: {
        version: 1,
      },
      payload: {
        alert_id,
        alert_type: params.alert_type,
        target_type: params.target_type,
        priority,
        scheduled_for,
      },
    };

    // Append event to store
    await this.eventStore.append(event);

    console.log(`Alert queued: ${alert_id} for AR ${params.ar_id} (${params.alert_type})`);

    return alert_id;
  }

  /**
   * Get default priority based on alert type
   */
  private getDefaultPriority(alertType: AlertType): number {
    switch (alertType) {
      case AlertType.PRE_ALERT:
        return 2; // Low-medium priority
      case AlertType.DUE:
        return 3; // Medium priority
      case AlertType.OVERDUE:
        return 4; // High priority
      case AlertType.ESCALATION:
        return 5; // Critical priority
      default:
        return 3; // Default medium
    }
  }
}

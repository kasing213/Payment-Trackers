/**
 * Create AR Command
 * Command handler for creating a new AR
 */

import { v4 as uuidv4 } from 'uuid';
import { IEventStore } from '../../domain/repositories/event-store.interface';
import { IARRepository } from '../../domain/repositories/ar-repository.interface';
import { ARCreatedEvent } from '../../domain/events/ar-events';
import { EventType, ActorType } from '../../domain/events/types';
import { EventReplayService } from '../../domain/services/event-replay';
import { Money } from '../../domain/models/ar';

/**
 * Create AR Data Transfer Object
 */
export interface CreateARDTO {
  customer_id: string;
  customer_name: string;
  amount: Money;
  invoice_date: Date;
  due_date: Date;
  assigned_sales_id?: string;
  customer_chat_id?: string; // Telegram chat_id
  manager_chat_id?: string;  // Manager's Telegram chat_id
}

/**
 * Create AR Command Handler
 */
export class CreateARCommand {
  constructor(
    private eventStore: IEventStore,
    private arRepository: IARRepository
  ) {}

  /**
   * Execute command to create a new AR
   *
   * @param dto - AR creation data
   * @returns ar_id of the created AR
   */
  async execute(dto: CreateARDTO): Promise<string> {
    // Validate input
    this.validateInput(dto);

    const ar_id = uuidv4();
    const event_id = uuidv4();

    // Create AR_CREATED event
    const event: ARCreatedEvent = {
      event_id,
      ar_id,
      event_type: EventType.AR_CREATED,
      timestamp: new Date(),
      actor: {
        type: ActorType.SYSTEM,
      },
      metadata: {
        version: 1,
      },
      payload: {
        customer_id: dto.customer_id,
        customer_name: dto.customer_name,
        amount: dto.amount,
        invoice_date: dto.invoice_date,
        due_date: dto.due_date,
        assigned_sales_id: dto.assigned_sales_id,
        customer_chat_id: dto.customer_chat_id,
        manager_chat_id: dto.manager_chat_id,
      },
    };

    // Append event to store (idempotent)
    await this.eventStore.append(event);

    // Derive initial state from event
    const state = EventReplayService.replayEvents([event]);

    // Save to AR state collection
    await this.arRepository.save(state);

    console.log(`AR created: ${ar_id} for customer ${dto.customer_name}`);

    return ar_id;
  }

  /**
   * Validate input data
   */
  private validateInput(dto: CreateARDTO): void {
    if (!dto.customer_id || dto.customer_id.trim() === '') {
      throw new Error('customer_id is required');
    }

    if (!dto.customer_name || dto.customer_name.trim() === '') {
      throw new Error('customer_name is required');
    }

    if (!dto.amount || dto.amount.value <= 0) {
      throw new Error('amount must be greater than 0');
    }

    if (!dto.amount.currency || dto.amount.currency.trim() === '') {
      throw new Error('currency is required');
    }

    if (!dto.invoice_date) {
      throw new Error('invoice_date is required');
    }

    if (!dto.due_date) {
      throw new Error('due_date is required');
    }

    if (dto.due_date < dto.invoice_date) {
      throw new Error('due_date cannot be before invoice_date');
    }
  }
}

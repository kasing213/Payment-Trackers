/**
 * Change Due Date Command
 * Command handler for changing AR due date (e.g., from Excel import updates)
 */

import { v4 as uuidv4 } from 'uuid';
import { IEventStore } from '../../domain/repositories/event-store.interface';
import { IARRepository } from '../../domain/repositories/ar-repository.interface';
import { DueDateChangedEvent } from '../../domain/events/ar-events';
import { EventType, ActorType } from '../../domain/events/types';

/**
 * Change Due Date Data Transfer Object
 */
export interface ChangeDueDateDTO {
  ar_id: string;
  new_due_date: Date;
  reason: string;
  actor_user_id?: string;
  actor_type?: ActorType;
}

/**
 * Change Due Date Command Handler
 */
export class ChangeDueDateCommand {
  constructor(
    private eventStore: IEventStore,
    private arRepository: IARRepository
  ) {}

  /**
   * Execute command to change AR due date
   *
   * @param dto - Due date change data
   */
  async execute(dto: ChangeDueDateDTO): Promise<void> {
    // Validate input
    this.validateInput(dto);

    // Verify AR exists
    const ar = await this.arRepository.findById(dto.ar_id);
    if (!ar) {
      throw new Error(`AR ${dto.ar_id} not found`);
    }

    // Check if due date is actually changing
    if (ar.due_date.getTime() === dto.new_due_date.getTime()) {
      console.log(`AR ${dto.ar_id} due date unchanged, skipping event`);
      return; // No change needed
    }

    const event_id = uuidv4();

    // Create DUE_DATE_CHANGED event
    const event: DueDateChangedEvent = {
      event_id,
      ar_id: dto.ar_id,
      event_type: EventType.DUE_DATE_CHANGED,
      timestamp: new Date(),
      actor: {
        type: dto.actor_type || ActorType.SYSTEM,
        user_id: dto.actor_user_id
      },
      payload: {
        old_due_date: ar.due_date,
        new_due_date: dto.new_due_date,
        reason: dto.reason
      },
      metadata: {
        version: 1
      }
    };

    // Append event to event store
    await this.eventStore.append(event);

    // Update AR state in repository
    ar.due_date = dto.new_due_date;
    ar.last_event_id = event_id;
    ar.last_event_at = event.timestamp;
    ar.event_count += 1;
    ar.version += 1;

    await this.arRepository.save(ar);

    console.log(
      `AR ${dto.ar_id} due date changed from ` +
      `${ar.due_date.toISOString().split('T')[0]} to ` +
      `${dto.new_due_date.toISOString().split('T')[0]}`
    );
  }

  /**
   * Validate input data
   */
  private validateInput(dto: ChangeDueDateDTO): void {
    if (!dto.ar_id) {
      throw new Error('ar_id is required');
    }

    if (!dto.new_due_date || !(dto.new_due_date instanceof Date)) {
      throw new Error('new_due_date must be a valid Date');
    }

    if (!dto.reason || dto.reason.trim() === '') {
      throw new Error('reason is required');
    }

    // Validate due date is not in the past (more than 30 days ago)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (dto.new_due_date < thirtyDaysAgo) {
      throw new Error('new_due_date cannot be more than 30 days in the past');
    }
  }
}

/**
 * Log Follow-Up Command
 * Command handler for logging follow-up notes on an AR
 */

import { v4 as uuidv4 } from 'uuid';
import { IEventStore } from '../../domain/repositories/event-store.interface';
import { IARRepository } from '../../domain/repositories/ar-repository.interface';
import { FollowUpLoggedEvent } from '../../domain/events/ar-events';
import { EventType, ActorType } from '../../domain/events/types';

/**
 * Log Follow-Up Data Transfer Object
 */
export interface LogFollowUpDTO {
  ar_id: string;
  notes: string;
  next_action?: string;
  next_action_date?: Date;
  actor_user_id: string;
  actor_type: 'MANAGER' | 'SALES';
}

/**
 * Log Follow-Up Command Handler
 */
export class LogFollowUpCommand {
  constructor(
    private eventStore: IEventStore,
    private arRepository: IARRepository
  ) {}

  /**
   * Execute command to log a follow-up note
   *
   * @param dto - Follow-up data
   */
  async execute(dto: LogFollowUpDTO): Promise<void> {
    // Validate input
    this.validateInput(dto);

    // Verify AR exists
    const ar = await this.arRepository.findById(dto.ar_id);
    if (!ar) {
      throw new Error(`AR ${dto.ar_id} not found`);
    }

    const event_id = uuidv4();

    // Create FOLLOW_UP_LOGGED event
    const event: FollowUpLoggedEvent = {
      event_id,
      ar_id: dto.ar_id,
      event_type: EventType.FOLLOW_UP_LOGGED,
      timestamp: new Date(),
      actor: {
        type: dto.actor_type as ActorType,
        user_id: dto.actor_user_id,
      },
      metadata: {
        version: 1,
      },
      payload: {
        notes: dto.notes,
        next_action: dto.next_action,
        next_action_date: dto.next_action_date,
      },
    };

    // Append event to store
    await this.eventStore.append(event);

    // Update AR metadata (last_event info)
    // Follow-up doesn't change AR state, just metadata
    ar.last_event_id = event_id;
    ar.last_event_at = event.timestamp;
    ar.event_count += 1;

    await this.arRepository.save(ar);

    console.log(`Follow-up logged for AR ${dto.ar_id} by ${dto.actor_type} ${dto.actor_user_id}`);
  }

  /**
   * Validate input data
   */
  private validateInput(dto: LogFollowUpDTO): void {
    if (!dto.ar_id || dto.ar_id.trim() === '') {
      throw new Error('ar_id is required');
    }

    if (!dto.notes || dto.notes.trim() === '') {
      throw new Error('notes is required');
    }

    if (!dto.actor_user_id || dto.actor_user_id.trim() === '') {
      throw new Error('actor_user_id is required');
    }

    if (!['MANAGER', 'SALES'].includes(dto.actor_type)) {
      throw new Error('actor_type must be MANAGER or SALES');
    }
  }
}

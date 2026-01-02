import { IEventStore } from '../../domain/repositories/event-store.interface';
import { IARRepository } from '../../domain/repositories/ar-repository.interface';
import { StatusChangedEvent } from '../../domain/events/ar-events';
import { EventType, ActorType } from '../../domain/events/types';
import { ARStatus } from '../../domain/models/ar';
import { v4 as uuidv4 } from 'uuid';

export interface ChangeARStatusDTO {
  ar_id: string;
  new_status: ARStatus;
  reason: string;
  actor: { type: ActorType; user_id?: string };
}

/**
 * Change AR Status Command
 *
 * Transitions AR from one status to another, emitting STATUS_CHANGED event
 */
export class ChangeARStatusCommand {
  constructor(
    private eventStore: IEventStore,
    private arRepository: IARRepository
  ) {}

  async execute(dto: ChangeARStatusDTO): Promise<void> {
    // Validate input
    this.validateInput(dto);

    // Get current AR state
    const currentAR = await this.arRepository.findById(dto.ar_id);
    if (!currentAR) {
      throw new Error(`AR not found: ${dto.ar_id}`);
    }

    // Check if status actually changed
    if (currentAR.current_status === dto.new_status) {
      console.log(`AR ${dto.ar_id} already has status ${dto.new_status}`);
      return;  // No-op
    }

    // Create STATUS_CHANGED event
    const event: StatusChangedEvent = {
      event_id: uuidv4(),
      event_type: EventType.STATUS_CHANGED,
      ar_id: dto.ar_id,
      timestamp: new Date(),
      actor: dto.actor,
      payload: {
        old_status: currentAR.current_status,
        new_status: dto.new_status,
        reason: dto.reason
      },
      metadata: {
        version: 1
      }
    };

    // Persist event (idempotent)
    await this.eventStore.append(event);

    // Update materialized view
    await this.arRepository.updateStatus(dto.ar_id, dto.new_status);
  }

  private validateInput(dto: ChangeARStatusDTO): void {
    if (!dto.ar_id || dto.ar_id.trim() === '') {
      throw new Error('ar_id is required');
    }

    if (!dto.new_status) {
      throw new Error('new_status is required');
    }

    const validStatuses: ARStatus[] = [ARStatus.PENDING, ARStatus.OVERDUE, ARStatus.PAID, ARStatus.WRITTEN_OFF];
    if (!validStatuses.includes(dto.new_status)) {
      throw new Error(`Invalid status: ${dto.new_status}`);
    }

    if (!dto.reason || dto.reason.trim() === '') {
      throw new Error('reason is required');
    }
  }
}

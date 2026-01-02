/**
 * Verify Payment Command
 * Command handler for verifying payment received on an AR
 */

import { v4 as uuidv4 } from 'uuid';
import { IEventStore } from '../../domain/repositories/event-store.interface';
import { IARRepository } from '../../domain/repositories/ar-repository.interface';
import { PaymentVerifiedEvent } from '../../domain/events/ar-events';
import { EventType, ActorType } from '../../domain/events/types';
import { Money, ARStatus } from '../../domain/models/ar';
import { CreateNextMonthARCommand } from './create-next-month-ar.command';

/**
 * Verify Payment Data Transfer Object
 */
export interface VerifyPaymentDTO {
  ar_id: string;
  paid_amount: Money;
  payment_date: Date;
  verification_method: string; // e.g., "BANK_STATEMENT", "PAYMENT_GATEWAY", "MANUAL"
  verified_by: string;         // User ID who verified
}

/**
 * Verify Payment Command Handler
 */
export class VerifyPaymentCommand {
  constructor(
    private eventStore: IEventStore,
    private arRepository: IARRepository,
    private createNextMonthAR: CreateNextMonthARCommand
  ) {}

  /**
   * Execute command to verify payment
   *
   * @param dto - Payment verification data
   */
  async execute(dto: VerifyPaymentDTO): Promise<void> {
    // Validate input
    this.validateInput(dto);

    // Verify AR exists
    const ar = await this.arRepository.findById(dto.ar_id);
    if (!ar) {
      throw new Error(`AR ${dto.ar_id} not found`);
    }

    // Verify AR is not already paid
    if (ar.current_status === ARStatus.PAID) {
      throw new Error(`AR ${dto.ar_id} is already marked as paid`);
    }

    const event_id = uuidv4();

    // Create PAYMENT_VERIFIED event
    const event: PaymentVerifiedEvent = {
      event_id,
      ar_id: dto.ar_id,
      event_type: EventType.PAYMENT_VERIFIED,
      timestamp: new Date(),
      actor: {
        type: ActorType.MANAGER, // Payment verification is typically done by manager
        user_id: dto.verified_by,
      },
      metadata: {
        version: 1,
      },
      payload: {
        paid_amount: dto.paid_amount,
        payment_date: dto.payment_date,
        verification_method: dto.verification_method,
        verified_by: dto.verified_by,
      },
    };

    // Append event to store
    await this.eventStore.append(event);

    // Update AR state to PAID
    ar.current_status = ARStatus.PAID;
    ar.paid_date = dto.payment_date;
    ar.last_event_id = event_id;
    ar.last_event_at = event.timestamp;
    ar.event_count += 1;

    await this.arRepository.save(ar);

    console.log(`Payment verified for AR ${dto.ar_id}: ${dto.paid_amount.value} ${dto.paid_amount.currency}`);

    // Auto-create next month's AR (monthly billing)
    try {
      await this.createNextMonthAR.execute({ paid_ar_id: dto.ar_id });
    } catch (error) {
      console.error(`Failed to create next month AR for ${dto.ar_id}:`, error);
      // Don't fail the payment verification if AR creation fails
    }
  }

  /**
   * Validate input data
   */
  private validateInput(dto: VerifyPaymentDTO): void {
    if (!dto.ar_id || dto.ar_id.trim() === '') {
      throw new Error('ar_id is required');
    }

    if (!dto.paid_amount || dto.paid_amount.value <= 0) {
      throw new Error('paid_amount must be greater than 0');
    }

    if (!dto.paid_amount.currency || dto.paid_amount.currency.trim() === '') {
      throw new Error('currency is required');
    }

    if (!dto.payment_date) {
      throw new Error('payment_date is required');
    }

    if (!dto.verification_method || dto.verification_method.trim() === '') {
      throw new Error('verification_method is required');
    }

    if (!dto.verified_by || dto.verified_by.trim() === '') {
      throw new Error('verified_by is required');
    }
  }
}

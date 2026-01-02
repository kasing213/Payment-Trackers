import { CreateARCommand, CreateARDTO } from './create-ar.command';
import { IARRepository } from '../../domain/repositories/ar-repository.interface';

export interface CreateNextMonthARDTO {
  paid_ar_id: string;  // AR that was just paid
}

/**
 * Create Next Month AR Command
 *
 * Automatically creates next month's AR when current AR is paid (monthly billing)
 */
export class CreateNextMonthARCommand {
  constructor(
    private arRepository: IARRepository,
    private createARCommand: CreateARCommand
  ) {}

  async execute(dto: CreateNextMonthARDTO): Promise<{ ar_id: string }> {
    // Get the AR that was just paid
    const paidAR = await this.arRepository.findById(dto.paid_ar_id);
    if (!paidAR) {
      throw new Error(`Paid AR not found: ${dto.paid_ar_id}`);
    }

    // Calculate next month's due date
    const nextDueDate = new Date(paidAR.due_date);
    nextDueDate.setMonth(nextDueDate.getMonth() + 1);

    // Create new AR for next month
    const newARData: CreateARDTO = {
      home_id: paidAR.home_id,
      zone: paidAR.zone,
      customer_name: paidAR.customer_name,
      amount: paidAR.amount,  // Same amount
      invoice_date: new Date(),  // Today
      due_date: nextDueDate,  // Next month
      assigned_sales_id: paidAR.assigned_sales_id,
      customer_chat_id: paidAR.customer_chat_id,
      manager_chat_id: paidAR.manager_chat_id
    };

    const ar_id = await this.createARCommand.execute(newARData);

    console.log(
      `Auto-created next month AR ${ar_id} for home ${paidAR.home_id} ` +
      `(due: ${nextDueDate.toISOString().split('T')[0]})`
    );

    return { ar_id };
  }
}

/**
 * Date Helper Utilities
 *
 * Month-safe date operations and timezone normalization
 * for consistent AR billing and overdue calculations
 */

/**
 * Safely add months to a date (handles end-of-month edge cases)
 *
 * JavaScript's setMonth() can produce weird rollovers:
 * - Jan 31 + 1 month = Mar 2/3 (BAD)
 *
 * This function clamps to the last valid day of the target month:
 * - Jan 31 + 1 month = Feb 28/29 (GOOD)
 *
 * @param date - Source date
 * @param months - Number of months to add (can be negative)
 * @returns New date with months added (original date unmodified)
 *
 * @example
 * addMonths(new Date('2025-01-31'), 1) // => 2025-02-28
 * addMonths(new Date('2025-03-31'), 1) // => 2025-04-30
 * addMonths(new Date('2024-01-31'), 1) // => 2024-02-29 (leap year)
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();

  result.setMonth(result.getMonth() + months);

  // If day changed (e.g., Jan 31 → Mar 3), clamp to last day of month
  if (result.getDate() !== day) {
    result.setDate(0);  // Go to last day of previous month
  }

  return result;
}

/**
 * Normalize date to local midnight (Asia/Phnom_Penh timezone)
 *
 * Used for consistent date comparisons in AR overdue logic:
 * - today > due_date (AR becomes overdue day AFTER due date)
 *
 * @param date - Date to normalize
 * @returns Date set to 00:00:00.000 local time
 *
 * @example
 * toLocalMidnight(new Date('2025-12-25T15:30:00')) // => 2025-12-25T00:00:00
 */
export function toLocalMidnight(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

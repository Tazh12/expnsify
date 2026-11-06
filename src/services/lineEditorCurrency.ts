import type { BudgetLine } from '../store/budgetTypes';

type Convert = (amount: number, fromCurrency: string) => number;
type StoredAmounts = Pick<BudgetLine, 'expected' | 'actualOverride' | 'currency'>;

function toPreferred(amount: number, currency: string, preferred: string, convert: Convert): number {
  if (currency === preferred) return amount;
  return Math.round(convert(amount, currency) * 100) / 100;
}

/** The value the line editor shows for a stored amount: always in the preferred currency. */
export function editableAmount(amount: number, currency: string, preferred: string, convert: Convert): string {
  return String(toPreferred(amount, currency, preferred, convert));
}

/**
 * The amounts and currency to save from the line editor. The fields are in the
 * preferred currency, so a saved edit moves the line there. A line opened without
 * editing an amount keeps its stored values, so it doesn't pick up rounding.
 */
export function resolveLineAmounts({
  target, editing, untouched, expected, actual, preferred, convert,
}: {
  target: StoredAmounts | null;
  editing: boolean;
  untouched: boolean;
  expected: number;
  actual: number | null;
  preferred: string;
  convert: Convert;
}): StoredAmounts {
  if (target && editing && untouched) {
    return { expected: target.expected, actualOverride: target.actualOverride, currency: target.currency };
  }
  const retained = target?.actualOverride != null
    ? toPreferred(target.actualOverride, target.currency || 'USD', preferred, convert)
    : null;
  return { expected, actualOverride: actual ?? retained, currency: preferred };
}

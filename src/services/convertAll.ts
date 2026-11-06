export interface RateTable {
  base: string;
  rates: Record<string, number>;
}

/** A write failed after rates loaded. Rows already saved hold correct converted values. */
export class ConversionSaveError extends Error {}

function convertWith(table: RateTable, amount: number, from: string): number {
  if (from === table.base) return amount;
  const rate = table.rates[from];
  if (!rate) throw new Error(`No exchange rate from ${from} to ${table.base}`);
  return Math.round((amount / rate) * 100) / 100;
}

/**
 * Moves every row to `target` using rates loaded for `target`. All values are
 * worked out before the first write, so a rate problem leaves the data as it is.
 * The preferred currency changes last, once the rows are saved.
 */
export async function convertAllToCurrency({
  target, expenses, lines, loadRates, updateExpense, updateLine, setPreferred,
}: {
  target: string;
  expenses: { id: string; amount: number; currency: string }[];
  lines: { id: string; expected: number; actualOverride: number | null; currency: string }[];
  loadRates: (base: string) => Promise<RateTable>;
  updateExpense: (id: string, patch: { amount: number; currency: string }) => Promise<void>;
  updateLine: (id: string, patch: { expected: number; actualOverride?: number; currency: string }) => Promise<void>;
  setPreferred: (currency: string) => Promise<void>;
}): Promise<void> {
  const table = await loadRates(target);
  if (table.base !== target) throw new Error(`Rates are for ${table.base}, not ${target}`);

  const expenseUpdates = expenses
    .filter(e => e.currency !== target)
    .map(e => ({
      id: e.id,
      patch: { amount: convertWith(table, e.amount, e.currency), currency: target },
    }));
  const lineUpdates = lines
    .filter(l => l.currency !== target)
    .map(l => ({
      id: l.id,
      patch: {
        expected: convertWith(table, l.expected, l.currency),
        ...(l.actualOverride != null ? { actualOverride: convertWith(table, l.actualOverride, l.currency) } : {}),
        currency: target,
      },
    }));

  try {
    for (const { id, patch } of expenseUpdates) await updateExpense(id, patch);
    for (const { id, patch } of lineUpdates) await updateLine(id, patch);
  } catch (e) {
    throw new ConversionSaveError(e instanceof Error ? e.message : 'Save failed');
  }
  await setPreferred(target);
}

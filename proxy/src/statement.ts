// A bank or card statement lists many dated transactions. Spotting one in the
// extracted text skips a Groq call that could only guess at a single amount.
export const STATEMENT_MIN_ROWS = 5;

const DATE = /(?:^|\s)(\d{1,2}[./]\d{1,2}[./](?:\d{4}|\d{2})|\d{4}-\d{2}-\d{2})(?=\s)/;
// 12.40, -18,90, 4'250.00, 1 650.00
const AMOUNT = /-?\d{1,3}(?:['’ ]?\d{3})*[.,]\d{2}(?!\d)/;
const BALANCE = /\b(balance|saldo|solde|kontostand)\b/i;

export function countStatementRows(text: string): number {
  let rows = 0;
  for (const line of text.split(/\r?\n/)) {
    if (BALANCE.test(line)) continue;
    const date = DATE.exec(line);
    if (!date) continue;
    const rest = line.slice(date.index + date[0].length);
    if (AMOUNT.test(rest)) rows++;
  }
  return rows;
}

const CURRENCY_ALIASES: Record<string, string> = {
  'FR.': 'CHF', FR: 'CHF', 'SFR.': 'CHF', SFR: 'CHF',
  '€': 'EUR', '$': 'USD', 'US$': 'USD', '£': 'GBP',
};

/** The ISO code for a currency as printed, or null when none was read. */
export function normalizeCurrency(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  if (!code) return null;
  if (CURRENCY_ALIASES[code]) return CURRENCY_ALIASES[code];
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

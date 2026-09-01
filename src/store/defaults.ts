import type { BudgetSection } from './budgetTypes';
import { monthKey } from '../services/month';

export const DEFAULT_CATEGORIES = [
  { id: 'groceries', name: 'Groceries', color: '#B8D4B0', sort_order: 0 },
  { id: 'coffee',    name: 'Coffee',    color: '#E0A872', sort_order: 1 },
  { id: 'dining',    name: 'Dining',    color: '#D9846A', sort_order: 2 },
  { id: 'transport', name: 'Transport', color: '#7FA6C8', sort_order: 3 },
  { id: 'travel',    name: 'Travel',    color: '#A47BB9', sort_order: 4 },
  { id: 'home',      name: 'Home',      color: '#E8C570', sort_order: 5 },
  { id: 'software',  name: 'Software',  color: '#6F8E63', sort_order: 6 },
  { id: 'health',    name: 'Health',    color: '#C9A0DC', sort_order: 7 },
  { id: 'other',     name: 'Other',     color: '#8F8A80', sort_order: 8 },
];

/** Old placeholder names — used only to zero leftover demo amounts in Firebase. */
const SAMPLE_NAMES = new Set([
  'paycheck', 'rent', 'internet', 'phone', 'electricity', 'car insurance',
  'groceries', 'gas', 'coffee', 'dining', 'gym', 'buffer', 'retirement',
]);

export function sampleLineIdsToZero(lines: { id: string; name: string; expected: number }[]): string[] {
  return lines
    .filter(l => SAMPLE_NAMES.has(l.name.toLowerCase()) && l.expected !== 0)
    .map(l => l.id);
}

export function currentMonthKey(): string {
  return monthKey(new Date());
}

/** @deprecated Demo transactions are no longer seeded. Kept empty so old imports don't break. */
export const DEMO_TXNS: never[] = [];

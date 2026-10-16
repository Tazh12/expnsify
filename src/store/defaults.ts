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

export function currentMonthKey(): string {
  return monthKey(new Date());
}

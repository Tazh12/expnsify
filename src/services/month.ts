import { parseLocalDate } from './format';
import type { RepeatEvery } from '../store/budgetTypes';

export function monthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function parseMonthKey(key: string): { year: number; monthIndex: number } {
  const [y, m] = key.split('-').map(Number);
  return { year: y, monthIndex: (m || 1) - 1 };
}

export function expenseMonthKey(iso: string): string {
  const dateOnly = iso.match(/^(\d{4})-(\d{2})/);
  if (dateOnly) return `${dateOnly[1]}-${dateOnly[2]}`;
  const d = parseLocalDate(iso);
  if (isNaN(d.getTime())) return monthKey(new Date());
  return monthKey(d);
}

export function slugKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || `line${Date.now()}`;
}

/** Keep a new budget series distinct when the name slug is already in use. */
export function uniqueTemplateKey(base: string, taken: Iterable<string>): string {
  const used = taken instanceof Set ? taken : new Set(taken);
  const root = slugKey(base);
  if (!used.has(root)) return root;
  let n = 2;
  while (used.has(`${root}${n}`)) n += 1;
  return `${root}${n}`;
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function dueDateFor(month: string, dueDay: number): Date {
  const { year, monthIndex } = parseMonthKey(month);
  const dim = daysInMonth(year, monthIndex);
  return new Date(year, monthIndex, Math.min(dueDay, dim));
}

export function formatDueDate(month: string, dueDay: number): string {
  return dueDateFor(month, dueDay).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function repeatStepDays(every: RepeatEvery): number {
  if (every === 'week') return 7;
  if (every === 'twoWeeks') return 14;
  return 0;
}

/** First occurrence of a repeating due date inside `targetMonth`. */
export function dueDayInMonth(
  sourceMonth: string,
  dueDay: number,
  stepDays: number,
  targetMonth: string,
): number {
  const days = occurrenceDaysFromAnchor(sourceMonth, dueDay, stepDays, targetMonth);
  return days[0] ?? dueDay;
}

/** Remaining due days in `month` starting at `dueDay` (weekly / every 2 weeks). */
export function occurrenceDaysInMonth(month: string, dueDay: number, every: RepeatEvery): number[] {
  return occurrenceDaysFromAnchor(month, dueDay, repeatStepDays(every), month);
}

export function occurrenceDaysFromAnchor(
  sourceMonth: string,
  sourceDueDay: number,
  stepDays: number,
  targetMonth: string,
): number[] {
  if (stepDays <= 0) return [sourceDueDay];
  const { year, monthIndex } = parseMonthKey(targetMonth);
  const targetStart = new Date(year, monthIndex, 1);
  const targetEnd = new Date(year, monthIndex + 1, 0);
  let cursor = dueDateFor(sourceMonth, sourceDueDay);
  let guard = 0;
  while (cursor < targetStart && guard < 48) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + stepDays);
    guard += 1;
  }
  const days: number[] = [];
  while (cursor <= targetEnd && guard < 72) {
    days.push(cursor.getDate());
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + stepDays);
    guard += 1;
  }
  return days;
}

export function repeatGroupKey(line: { section: string; templateKey: string }): string {
  return `${line.section}::${line.templateKey}`;
}

export function monthTitle(key: string): string {
  const { year, monthIndex } = parseMonthKey(key);
  return new Date(year, monthIndex, 1).toLocaleDateString('en-US', { month: 'long' });
}

/** Near month-end, open next month so you can build that budget. */
export function defaultBudgetMonth(now = new Date()): Date {
  if (now.getDate() >= 25) return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return now;
}

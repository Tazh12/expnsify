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
  const d = new Date(iso);
  if (isNaN(d.getTime())) return monthKey(new Date());
  return monthKey(d);
}

export function slugKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 24) || `line${Date.now()}`;
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function dueDateFor(month: string, dueDay: number): Date {
  const { year, monthIndex } = parseMonthKey(month);
  const dim = daysInMonth(year, monthIndex);
  return new Date(year, monthIndex, Math.min(dueDay, dim));
}

/** Near month-end, open next month so you can build that budget. */
export function defaultBudgetMonth(now = new Date()): Date {
  if (now.getDate() >= 25) return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return now;
}

export function fmt(n: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    const sign = n < 0 ? '-' : '';
    return `${sign}${currency}${Math.abs(n).toFixed(2)}`;
  }
}

/**
 * Expense dates are calendar days (`YYYY-MM-DD` or `YYYY-MM-DDTHH:mm:ss`),
 * not UTC instants. `new Date("YYYY-MM-DD")` is UTC midnight and shifts
 * the local day backward in US timezones — parse the numeric parts as local.
 */
export function parseLocalDate(iso: string): Date {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?/);
  if (m) {
    return new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4] ?? 0),
      Number(m[5] ?? 0),
      Number(m[6] ?? 0),
    );
  }
  return new Date(iso);
}

export function toLocalDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}T00:00:00`;
}

export function currencySymbol(code: string): string {
  try {
    return (
      new Intl.NumberFormat('en-US', { style: 'currency', currency: code, minimumFractionDigits: 0 })
        .formatToParts(0)
        .find(p => p.type === 'currency')?.value ?? code
    );
  } catch {
    return code;
  }
}

export function dayLabel(iso: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = parseLocalDate(iso);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export function fmtTime(iso: string): string {
  return parseLocalDate(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

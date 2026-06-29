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
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

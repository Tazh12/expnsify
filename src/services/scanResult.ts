/** A scan with no positive amount didn't work, whatever else it filled in. */
export function isUsableScan(scan: { amount: number; confidence?: number | null }): boolean {
  return Number.isFinite(scan.amount) && scan.amount > 0;
}

/**
 * The currency a reviewed scan starts in: what the document shows, else the one most
 * budget lines use (the device's preferred currency defaults to USD), else that preference.
 */
export function reviewCurrency({ scanned, lineCurrencies, preferred, supported }: {
  scanned: string | null | undefined;
  lineCurrencies: string[];
  preferred: string;
  supported: readonly string[];
}): string {
  if (scanned && supported.includes(scanned)) return scanned;
  const counts = new Map<string, number>();
  for (const code of lineCurrencies) {
    if (supported.includes(code)) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [code, n] of counts) {
    if (!best || n > counts.get(best)!) best = code;
  }
  return best ?? preferred;
}

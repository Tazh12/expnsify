export type ScanErrorKind = 'auth' | 'busy' | 'unavailable' | 'unreadable' | 'pdf_unreadable' | 'statement';

export interface ScanError {
  kind: ScanErrorKind;
  /** For a statement: how many transactions it lists, when known. */
  transactions?: number;
}

export interface ScanFailure {
  title: string;
  message: string;
}

/** What a failed (non-limit) AI response means for the person scanning. 429s are handled as usage limits before this. */
export function scanErrorKind(status: number, body: string): ScanError {
  if (status === 401 || status === 403) return { kind: 'auth' };
  let parsed: { error?: unknown; transactions?: unknown } | null;
  try {
    parsed = JSON.parse(body) as { error?: unknown; transactions?: unknown } | null;
  } catch {
    parsed = null;
  }
  const error = parsed?.error;
  if (error === 'ai_busy') return { kind: 'busy' };
  if (error === 'unreadable') return { kind: 'unreadable' };
  if (error === 'pdf_unreadable') return { kind: 'pdf_unreadable' };
  if (error === 'statement') {
    const count = Number(parsed?.transactions);
    return Number.isFinite(count) && count > 0 ? { kind: 'statement', transactions: count } : { kind: 'statement' };
  }
  return { kind: 'unavailable' };
}

export function scanFailureCopy(error: ScanError): ScanFailure {
  switch (error.kind) {
    case 'auth':
      return { title: 'Please sign in again', message: 'Your session expired. You can still add this one by hand.' };
    case 'busy':
      return { title: 'Scanning is busy', message: 'Too many scans at once. Try again in a minute, or add it by hand.' };
    case 'unreadable':
      return { title: 'Could not find a total', message: 'Vadri could not read an amount. Try a sharper photo, or add it by hand.' };
    case 'pdf_unreadable':
      return { title: "Couldn't read this PDF", message: 'Vadri found no text or image in it. Try a screenshot of the receipt, or add it by hand.' };
    case 'statement':
      return {
        title: error.transactions
          ? `This looks like a statement with ${error.transactions} transactions`
          : 'This looks like a statement',
        message: 'Vadri scans one receipt or invoice at a time. Add the ones you need by hand for now.',
      };
    default:
      return { title: "Scanning isn't available right now", message: 'You can add it by hand.' };
  }
}

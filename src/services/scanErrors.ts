export type ScanErrorKind = 'auth' | 'busy' | 'unavailable';

export interface ScanFailure {
  title: string;
  message: string;
}

/** What a failed (non-limit) AI response means for the person scanning. 429s are handled as usage limits before this. */
export function scanErrorKind(status: number, body: string): ScanErrorKind {
  if (status === 401 || status === 403) return 'auth';
  let error: unknown;
  try {
    error = (JSON.parse(body) as { error?: unknown })?.error;
  } catch {
    error = undefined;
  }
  return error === 'ai_busy' ? 'busy' : 'unavailable';
}

export function scanFailureCopy(kind: ScanErrorKind): ScanFailure {
  if (kind === 'auth') {
    return { title: 'Please sign in again', message: 'Your session expired. You can still add this one by hand.' };
  }
  if (kind === 'busy') {
    return { title: 'Scanning is busy', message: 'Too many scans at once. Try again in a minute, or add it by hand.' };
  }
  return { title: "Scanning isn't available right now", message: 'You can add it by hand.' };
}

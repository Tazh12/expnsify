export const RECEIPT_STORAGE_ENABLED = false;

export function isDurableReceiptUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  if (uri.startsWith('https://') || uri.startsWith('http://')) return true;
  if (uri.startsWith('file://') && uri.includes('/Documents/receipts/')) return true;
  return false;
}

export function pickReceiptUriToStore(
  uploaded: string | null | undefined,
  localDurable: string | null | undefined,
): string | null {
  if (isDurableReceiptUri(uploaded)) return uploaded!;
  if (isDurableReceiptUri(localDurable)) return localDurable!;
  return null;
}

export function resolveReceiptUriToPersist(
  uri: string | null | undefined,
  storageEnabled = RECEIPT_STORAGE_ENABLED,
): string | null {
  if (!storageEnabled) return null;
  return isDurableReceiptUri(uri) ? uri! : null;
}

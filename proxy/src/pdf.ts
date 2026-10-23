export interface PdfText {
  /** null when the PDF has no text layer (a scan) or could not be parsed. */
  text: string | null;
  /** Why parsing failed. Absent when the PDF parsed, with or without text. */
  error?: string;
}

// Needs wrangler 4: wrangler 3's esbuild broke PDF.js's static class blocks in the
// bundle ("Cannot set properties of undefined (setting '_isSameOrigin')").
// test/workerd.test.ts runs this through the real bundle.
export async function extractPdfText(b64: string): Promise<PdfText> {
  try {
    const { getDocumentProxy, extractText } = await import('unpdf');
    const pdf = await getDocumentProxy(decodeBase64(b64));
    const result = await extractText(pdf, { mergePages: true });
    const text = Array.isArray(result.text) ? result.text.join('\n') : String(result.text ?? '');
    return { text: text.trim().length > 12 ? text : null };
  } catch (e) {
    return { text: null, error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) };
  }
}

export function looksLikePaymentText(text: string): boolean {
  return /(?:\$|usd|eur|gbp|cad|mxn)?\s*\d{1,7}(?:[.,]\d{2})\b|\b(total|paid|amount|invoice|receipt)\b/i.test(text);
}

export function extractJpegFromPdf(b64: string): string | null {
  try {
    const bytes = decodeBase64(b64);
    let best: Uint8Array | null = null;
    for (let i = 0; i < bytes.length - 1; i++) {
      if (bytes[i] !== 0xFF || bytes[i + 1] !== 0xD8) continue;
      for (let j = i + 2; j < bytes.length - 1; j++) {
        if (bytes[j] === 0xFF && bytes[j + 1] === 0xD9) {
          const slice = bytes.subarray(i, j + 2);
          if (slice.length > 8000 && (!best || slice.length > best.length)) best = slice;
          i = j;
          break;
        }
      }
    }
    return best ? encodeBase64(best) : null;
  } catch (e) {
    console.error('pdf jpeg extract failed', e);
    return null;
  }
}

export function decodeBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

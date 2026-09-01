import type { Category } from '../store/useCategories';
import type { BudgetLine } from '../store/budgetTypes';

const proxyUrl = process.env.EXPO_PUBLIC_PROXY_URL ?? '';

export interface ScannedExpense {
  merchant: string;
  amount: number;
  currency: string;
  date: string;
  category: {
    id: string;
    name: string;
    isNew: boolean;
    suggestedColor?: string;
  };
  note: string | null;
  confidence: number;
  lineId: string | null;
  matchConfidence: number | null;
  isPaymentConfirmation: boolean;
}

export interface ScanLine {
  id: string;
  name: string;
  expected: number;
  dueDay: number | null;
  section: string;
  paid: boolean;
}

function toScanLines(lines: BudgetLine[]): ScanLine[] {
  return lines.map(l => ({
    id: l.id,
    name: l.name,
    expected: l.expected,
    dueDay: l.dueDay,
    section: l.section,
    paid: l.paid,
  }));
}

export async function scanImage(
  imageBase64: string,
  categories: Category[],
  mimeType = 'image/jpeg',
  budgetLines: BudgetLine[] = [],
): Promise<ScannedExpense | null> {
  return scan({
    imageBase64,
    mimeType,
    categories,
    lines: toScanLines(budgetLines),
  });
}

export async function scanText(
  text: string,
  categories: Category[],
  budgetLines: BudgetLine[] = [],
): Promise<ScannedExpense | null> {
  return scan({ text, categories, lines: toScanLines(budgetLines) });
}

export async function scanPdf(
  pdfBase64: string,
  categories: Category[],
  budgetLines: BudgetLine[] = [],
): Promise<ScannedExpense | null> {
  return scan({ pdfBase64, categories, lines: toScanLines(budgetLines) });
}

async function scan(body: {
  imageBase64?: string;
  mimeType?: string;
  text?: string;
  pdfBase64?: string;
  categories: Category[];
  lines: ScanLine[];
}): Promise<ScannedExpense | null> {
  try {
    const res = await fetch(`${proxyUrl}/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: body.imageBase64,
        mimeType: body.mimeType,
        text: body.text,
        pdfBase64: body.pdfBase64,
        categories: body.categories.map(c => ({ id: c.id, name: c.name })),
        lines: body.lines,
      }),
    });
    if (!res.ok) {
      console.error('scan failed', res.status, await res.text());
      return null;
    }
    const json = await res.json() as ScannedExpense;
    return {
      ...json,
      lineId: json.lineId ?? null,
      matchConfidence: json.matchConfidence ?? null,
      isPaymentConfirmation: Boolean(json.isPaymentConfirmation),
    };
  } catch (e) {
    console.error('scan error', e);
    return null;
  }
}

export async function transcribeAudio(uri: string): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('audio', {
      uri,
      type: 'audio/m4a',
      name: 'audio.m4a',
    } as unknown as Blob);

    const res = await fetch(`${proxyUrl}/transcribe`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) return null;
    const json = await res.json() as { text: string };
    return json.text ?? null;
  } catch {
    return null;
  }
}

import type { Category } from '../store/useCategories';
import type { BudgetLine } from '../store/budgetTypes';
import * as FileSystem from 'expo-file-system/legacy';

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
    const amount = Number(json.amount);
    if (!Number.isFinite(amount)) {
      console.error('scan missing amount', json);
      return null;
    }
    return {
      ...json,
      amount,
      lineId: json.lineId ?? null,
      matchConfidence: json.matchConfidence ?? null,
      isPaymentConfirmation: Boolean(json.isPaymentConfirmation),
    };
  } catch (e) {
    console.error('scan error', e);
    return null;
  }
}

async function uriToBase64(uri: string): Promise<string> {
  if (uri.startsWith('blob:') || uri.startsWith('data:') || uri.startsWith('http')) {
    const res = await fetch(uri);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

function audioMeta(uri: string): { mimeType: string } {
  const lower = uri.toLowerCase();
  if (lower.includes('webm')) return { mimeType: 'audio/webm' };
  if (lower.includes('.wav')) return { mimeType: 'audio/wav' };
  return { mimeType: 'audio/m4a' };
}

export async function transcribeAudio(uri: string): Promise<string | null> {
  try {
    const audioBase64 = await uriToBase64(uri);
    const { mimeType } = audioMeta(uri);
    const res = await fetch(`${proxyUrl}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioBase64, mimeType }),
    });
    if (!res.ok) {
      console.error('transcribe failed', res.status, await res.text());
      return null;
    }
    const json = await res.json() as { text: string };
    return json.text ?? null;
  } catch (e) {
    console.error('transcribe error', e);
    return null;
  }
}

import type { Category } from '../store/useCategories';
import type { BudgetLine } from '../store/budgetTypes';
import type { Expense, LineItem } from '../store/useExpenses';
import * as FileSystem from 'expo-file-system/legacy';
import { auth } from './firebase';
import { publishAiLimit, publishAiUsage, type AiBlockCode, type UsageSnapshot } from './aiUsageBridge';
import { scanErrorKind, scanFailureCopy, type ScanErrorKind } from './scanErrors';

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
  line_items: LineItem[];
}

export type AiUsage = UsageSnapshot;

export class ScanRequestError extends Error {
  kind: ScanErrorKind;
  status?: number;

  constructor(kind: ScanErrorKind, status?: number) {
    super(scanFailureCopy(kind).title);
    this.kind = kind;
    this.status = status;
  }
}

export class AiLimitError extends Error {
  used: number;
  limit: number;
  resetsAt: string;
  code: AiBlockCode;

  constructor(body: { used?: number; limit?: number; resetsAt?: string; error?: string }) {
    super(
      body.error === 'rate_limited' ? 'Too many AI requests. Wait a minute and try again.'
        : body.error === 'account_required' ? 'Create an account to use AI.'
          : 'You have used this month’s AI actions.',
    );
    this.code = body.error === 'rate_limited' || body.error === 'account_required' ? body.error : 'limit_reached';
    this.used = body.used ?? 0;
    this.limit = body.limit ?? 10;
    this.resetsAt = body.resetsAt ?? '';
  }
}

let lastLimited = false;

export function takeAiLimit(): boolean {
  const hit = lastLimited;
  lastLimited = false;
  return hit;
}

async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...extra };
  const user = auth.currentUser;
  if (user) headers.Authorization = `Bearer ${await user.getIdToken()}`;
  return headers;
}

function readUsage(res: Response): AiUsage | null {
  const used = res.headers.get('X-Ai-Used');
  const limit = res.headers.get('X-Ai-Limit');
  if (used == null || limit == null) return null;
  return {
    used: Number(used) || 0,
    limit: Number(limit) || 10,
    resetsAt: res.headers.get('X-Ai-Resets'),
    plan: res.headers.get('X-Ai-Plan') === 'paid' ? 'paid' : 'free',
  };
}

function remember(res: Response) {
  const usage = readUsage(res);
  if (usage) publishAiUsage(usage);
}

async function rejectIfNotOk(label: string, res: Response): Promise<void> {
  if (res.ok) return;
  const body = await res.text();
  console.error(label, res.status, body.slice(0, 500));
  throw new ScanRequestError(scanErrorKind(res.status, body), res.status);
}

// Guests can't use AI. Stop before the request so they see the account prompt, not an error.
function rejectGuest(): void {
  if (!auth.currentUser?.isAnonymous) return;
  const error = new AiLimitError({ error: 'account_required' });
  publishAiLimit(error);
  throw error;
}

async function throwIfLimited(res: Response): Promise<void> {
  if (res.status === 403) {
    const body = await res.clone().json().catch(() => ({})) as { error?: string };
    if (body.error !== 'account_required') return;
    const error = new AiLimitError(body);
    publishAiLimit(error);
    throw error;
  }
  if (res.status !== 429) return;
  let body: { used?: number; limit?: number; resetsAt?: string; error?: string } = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  const error = new AiLimitError(body);
  publishAiLimit(error);
  throw error;
}

function lineItemsOf(raw: unknown): LineItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is { name: string; amount?: number } => !!item && typeof (item as { name?: unknown }).name === 'string')
    .map(item => ({ name: item.name.trim(), amount: Number(item.amount) || 0 }))
    .filter(item => item.name);
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
    rejectGuest();
    const res = await fetch(`${proxyUrl}/scan`, {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        imageBase64: body.imageBase64,
        mimeType: body.mimeType,
        text: body.text,
        pdfBase64: body.pdfBase64,
        categories: body.categories.map(c => ({ id: c.id, name: c.name })),
        lines: body.lines,
      }),
    });
    await throwIfLimited(res);
    await rejectIfNotOk('scan failed', res);
    remember(res);
    const json = await res.json() as ScannedExpense;
    const amount = Number(json.amount);
    if (!Number.isFinite(amount)) {
      console.error('scan missing amount', res.status);
      return null;
    }
    return {
      ...json,
      amount,
      lineId: json.lineId ?? null,
      matchConfidence: json.matchConfidence ?? null,
      isPaymentConfirmation: Boolean(json.isPaymentConfirmation),
      line_items: lineItemsOf(json.line_items),
    };
  } catch (e) {
    if (e instanceof AiLimitError) {
      lastLimited = true;
      return null;
    }
    if (e instanceof ScanRequestError) throw e;
    console.error('scan error', e instanceof Error ? e.message : e);
    throw new ScanRequestError('unavailable');
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
    rejectGuest();
    const audioBase64 = await uriToBase64(uri);
    const { mimeType } = audioMeta(uri);
    const res = await fetch(`${proxyUrl}/transcribe`, {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ audioBase64, mimeType }),
    });
    await throwIfLimited(res);
    await rejectIfNotOk('transcribe failed', res);
    remember(res);
    const json = await res.json() as { text: string };
    return json.text ?? null;
  } catch (e) {
    if (e instanceof AiLimitError) {
      lastLimited = true;
      return null;
    }
    if (e instanceof ScanRequestError) throw e;
    console.error('transcribe error', e instanceof Error ? e.message : e);
    throw new ScanRequestError('unavailable');
  }
}

export async function fetchUsage(): Promise<AiUsage | null> {
  if (!proxyUrl || !auth.currentUser || auth.currentUser.isAnonymous) return null;
  try {
    const res = await fetch(`${proxyUrl}/usage`, { headers: await authHeaders() });
    if (!res.ok) return null;
    const json = await res.json() as AiUsage;
    return {
      used: json.used ?? 0,
      limit: json.limit ?? 10,
      resetsAt: json.resetsAt ?? null,
      plan: json.plan === 'paid' ? 'paid' : 'free',
    };
  } catch {
    return null;
  }
}

export async function fetchInsights(
  expenses: Pick<Expense, 'merchant' | 'amount' | 'currency' | 'date' | 'category_id' | 'note' | 'line_items'>[],
  categories: { id: string; name: string }[],
): Promise<string[]> {
  rejectGuest();
  const res = await fetch(`${proxyUrl}/insights`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ expenses, categories }),
  });
  await throwIfLimited(res);
  if (!res.ok) {
    console.error('insights failed', res.status, (await res.text()).slice(0, 500));
    return [];
  }
  remember(res);
  const json = await res.json() as { insights?: string[] };
  return Array.isArray(json.insights) ? json.insights.filter(line => typeof line === 'string' && line.trim()) : [];
}

export async function askTally(
  question: string,
  expenses: Pick<Expense, 'id' | 'merchant' | 'amount' | 'date' | 'category_id' | 'note' | 'line_items'>[],
): Promise<string[]> {
  rejectGuest();
  const res = await fetch(`${proxyUrl}/ask`, {
    method: 'POST',
    headers: await authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      question,
      expenses: expenses.map(t => ({
        id: t.id,
        merchant: t.merchant,
        amount: t.amount,
        date: t.date,
        category_id: t.category_id,
        note: t.note,
        items: (t.line_items ?? []).map(item => item.name),
      })),
    }),
  });
  await throwIfLimited(res);
  if (!res.ok) {
    console.error('ask failed', res.status, (await res.text()).slice(0, 500));
    return [];
  }
  remember(res);
  const json = await res.json() as { ids?: string[] };
  return Array.isArray(json.ids) ? json.ids.filter(id => typeof id === 'string') : [];
}

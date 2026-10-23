import type { BudgetLine, BudgetSection } from '../store/budgetTypes';
import type { Expense } from '../store/useExpenses';
import { expenseMonthKey, occurrenceDaysFromAnchor, repeatGroupKey, repeatStepDays } from './month';

export function expenseMatchesLine(e: Expense, line: BudgetLine): boolean {
  if (e.line_id === line.id) return true;
  if (e.line_id) return false;
  if (e.category_id !== line.templateKey) return false;
  if (expenseMonthKey(e.date) !== line.month) return false;
  const wantIncome = line.section === 'income';
  return (e.type === 'income') === wantIncome;
}

export function lineActual(
  line: BudgetLine,
  expenses: Expense[],
  convert: (amount: number, currency: string) => number,
): number {
  const fromTxns = expenses
    .filter(e => expenseMatchesLine(e, line))
    .reduce((s, e) => s + convert(e.amount, e.currency), 0);
  if (line.section === 'income' && line.actualOverride != null) return line.actualOverride;
  return fromTxns;
}

export function isUnbudgeted(e: Expense, monthLines: BudgetLine[]): boolean {
  if (e.type === 'income') return false;
  if (e.line_id) return false;
  if (e.unbudgeted) return true;
  return !monthLines.some(l => l.section !== 'income' && l.templateKey === e.category_id);
}

export interface MonthSummary {
  expectedIncome: number;
  actualIncome: number;
  assigned: number;
  leftToBudget: number;
  spent: number;
  unpaidCount: number;
}

export function summarizeMonth(
  lines: BudgetLine[],
  expenses: Expense[],
  convert: (amount: number, currency: string) => number,
): MonthSummary {
  const income = lines.filter(l => l.section === 'income');
  const assignedLines = lines.filter(l => l.section !== 'income');
  const expectedIncome = income.reduce((s, l) => s + convert(l.expected, l.currency), 0);
  const actualIncome = income.reduce((s, l) => s + lineActual(l, expenses, convert), 0);
  const assigned = assignedLines.reduce((s, l) => s + convert(l.expected, l.currency), 0);
  const spent = assignedLines.reduce((s, l) => s + lineActual(l, expenses, convert), 0);
  const unpaidCount = assignedLines.filter(l => !l.paid && (l.dueDay != null || l.automated)).length;
  return {
    expectedIncome,
    actualIncome,
    assigned,
    leftToBudget: expectedIncome - assigned,
    spent,
    unpaidCount,
  };
}

export function sectionTotal(
  lines: BudgetLine[],
  section: BudgetSection,
  expenses: Expense[],
  convert: (amount: number, currency: string) => number,
): { expected: number; actual: number } {
  const subset = lines.filter(l => l.section === section);
  return {
    expected: subset.reduce((s, l) => s + convert(l.expected, l.currency), 0),
    actual: subset.reduce((s, l) => s + lineActual(l, expenses, convert), 0),
  };
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const SECTION_KEYS: { section: 'bills' | 'variable' | 'debt' | 'investments'; keys: string[] }[] = [
  { section: 'bills', keys: [
    'rent', 'mortgage', 'lease', 'hoa', 'internet', 'wifi', 'broadband',
    'phone', 'mobile', 'verizon', 'at&t', 'tmobile',
    'electric', 'electricity', 'utility', 'utilities', 'water', 'sewer',
    'trash', 'garbage', 'insurance', 'premium', 'cable', 'streaming',
  ]},
  { section: 'debt', keys: [
    'loan', 'debt', 'credit', 'visa', 'mastercard', 'amex',
    'student', 'carpayment', 'principal',
  ]},
  { section: 'investments', keys: [
    '401k', '401', 'ira', 'roth', 'rrsp', 'tfsa', 'retirement',
    'brokerage', 'invest', 'etf', 'index', 'stock', 'savings',
  ]},
  { section: 'variable', keys: [
    'groc', 'food', 'coffee', 'dining', 'restaurant', 'lunch', 'dinner',
    'uber', 'lyft', 'fuel', 'petrol', 'gym', 'fitness', 'entertain',
    'shop', 'cloth', 'travel', 'vacation', 'buffer', 'fun', 'personal', 'gas',
  ]},
];

function nameHitsKey(name: string, key: string): boolean {
  const words = name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const compact = words.join('');
  if (words.includes(key) || compact === key) return true;
  if (key.length >= 4 && (compact.includes(key) || words.some(w => w.startsWith(key)))) return true;
  return false;
}

export function inferBudgetSection(name: string): 'bills' | 'variable' | 'debt' | 'investments' {
  const trimmed = name.trim();
  if (!trimmed) return 'variable';
  for (const { section, keys } of SECTION_KEYS) {
    if (keys.some(k => nameHitsKey(trimmed, k))) return section;
  }
  return 'variable';
}

export function inferDestination(name: string, groups: { id: string; label: string }[] = []): string {
  const trimmed = name.trim();
  if (!trimmed) return 'variable';
  for (const g of groups) {
    if (g.id === 'income') continue;
    if (nameHitsKey(trimmed, g.label) || nameHitsKey(trimmed, g.id)) return g.id;
  }
  return inferBudgetSection(name);
}

export function findLineByName(
  name: string,
  lines: BudgetLine[],
  prefer?: BudgetSection,
): BudgetLine | undefined {
  const n = norm(name);
  if (!n) return undefined;
  const pool = prefer ? lines.filter(l => l.section === prefer) : lines;
  return pool.find(l => norm(l.name) === n);
}

export function matchLine(
  merchant: string,
  amount: number,
  dateIso: string | null,
  lines: BudgetLine[],
): { line: BudgetLine; confidence: number } | null {
  const spendable = lines.filter(l => l.section !== 'income');
  if (spendable.length === 0) return null;
  const m = norm(merchant);
  const day = dateIso ? Number((dateIso.match(/^\d{4}-\d{2}-(\d{2})/) ?? [])[1]) : NaN;

  let best: { line: BudgetLine; score: number } | null = null;
  for (const line of spendable) {
    let score = 0;
    const n = norm(line.name);
    if (n && m && (m.includes(n) || n.includes(m))) score += 0.55;
    else if (n && m.length > 2) {
      const shorter = n.length < m.length ? n : m;
      const longer = n.length < m.length ? m : n;
      if (longer.includes(shorter)) score += 0.35;
    }
    if (line.expected > 0 && amount > 0) {
      const delta = Math.abs(amount - line.expected) / line.expected;
      if (delta <= 0.05) score += 0.35;
      else if (delta <= 0.15) score += 0.15;
    }
    if (line.dueDay != null && !isNaN(day)) {
      const dist = Math.abs(line.dueDay - day);
      if (dist === 0) score += 0.15;
      else if (dist <= 3) score += 0.08;
    }
    if (!line.paid) score += 0.05;
    if (!best || score > best.score) best = { line, score };
  }
  if (!best || best.score < 0.35) return null;
  return { line: best.line, confidence: Math.min(1, best.score) };
}

export function upcomingLines(lines: BudgetLine[], limit = 3): BudgetLine[] {
  return lines
    .filter(l => l.section !== 'income' && l.dueDay != null && !l.paid)
    .sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99))
    .slice(0, limit);
}

export interface IncomeCarryOffer {
  templateKey: string;
  name: string;
  expected: number;
  currency: string;
  count: number;
  sourceMonth: string;
  proto: BudgetLine;
}

export function incomeCarryOffers(allLines: BudgetLine[], month: string): IncomeCarryOffer[] {
  const sourceMonth = [...new Set(allLines.filter(l => l.section === 'income' && l.recurring).map(l => l.month))]
    .filter(m => m < month)
    .sort()
    .reverse()[0];
  if (!sourceMonth) return [];

  const present = new Set(
    allLines.filter(l => l.month === month && l.section === 'income').map(l => l.templateKey),
  );
  const source = allLines.filter(l => l.month === sourceMonth && l.section === 'income' && l.recurring);
  const groups = new Map<string, BudgetLine[]>();
  for (const line of source) {
    const key = repeatGroupKey(line);
    const bucket = groups.get(key);
    if (bucket) bucket.push(line);
    else groups.set(key, [line]);
  }

  const offers: IncomeCarryOffer[] = [];
  for (const members of groups.values()) {
    const proto = members.slice().sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99))[0];
    if (present.has(proto.templateKey)) continue;
    const step = repeatStepDays(proto.repeatEvery);
    const count = proto.dueDay != null && step > 0
      ? occurrenceDaysFromAnchor(sourceMonth, proto.dueDay, step, month).length
      : 1;
    offers.push({
      templateKey: proto.templateKey,
      name: proto.name,
      expected: proto.expected,
      currency: proto.currency,
      count: Math.max(1, count),
      sourceMonth,
      proto,
    });
  }
  return offers;
}

export function repeatCadenceLabel(line: BudgetLine): string {
  if (!line.recurring) return 'once';
  if (line.repeatEvery === 'week') return 'weekly';
  if (line.repeatEvery === 'twoWeeks') return 'every 2 weeks';
  return 'monthly';
}

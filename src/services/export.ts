import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Expense } from '../store/useExpenses';
import type { BudgetLine } from '../store/budgetTypes';
import { fmt } from './format';

function escapeCsv(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function expensesToCsv(
  expenses: Expense[],
  lines: BudgetLine[],
  convert?: (amount: number, currency: string) => number,
  preferredCurrency = 'USD',
): string {
  const header = convert
    ? 'Date,Merchant,Line,Type,Amount,Currency,ConvertedAmount,PreferredCurrency,Unbudgeted,Note\n'
    : 'Date,Merchant,Line,Type,Amount,Currency,Unbudgeted,Note\n';
  const rows = expenses.map(t => {
    const line = lines.find(l => l.id === t.line_id)
      ?? lines.find(l => l.month === t.date.slice(0, 7) && l.templateKey === t.category_id);
    const cells = [
      t.date,
      t.merchant,
      line?.name ?? t.category_id,
      t.type,
      String(t.amount),
      t.currency,
    ];
    if (convert) {
      cells.push(convert(t.amount, t.currency || 'USD').toFixed(2), preferredCurrency);
    }
    cells.push(String(t.unbudgeted), t.note ?? '');
    return cells.map(escapeCsv).join(',');
  }).join('\n');
  return header + rows;
}

export async function exportMonthPdf(args: {
  monthLabel: string;
  expenses: Expense[];
  lines: BudgetLine[];
  currency: string;
  leftToBudget: number;
  spent: number;
  convert?: (amount: number, currency: string) => number;
}): Promise<void> {
  const { monthLabel, expenses, lines, currency, leftToBudget, spent, convert } = args;
  const rows = expenses.map(t => {
    const line = lines.find(l => l.id === t.line_id);
    const items = (t.line_items ?? []).map(i => escapeHtml(i.name)).join(', ');
    const converted = convert ? fmt(convert(t.amount, t.currency || 'USD'), currency) : '';
    return `<tr>
      <td>${escapeHtml(t.date.slice(0, 10))}</td>
      <td>${escapeHtml(t.merchant)}</td>
      <td>${escapeHtml(line?.name ?? t.category_id)}</td>
      <td>${escapeHtml(fmt(t.amount, t.currency))}</td>
      <td>${escapeHtml(converted)}</td>
      <td>${escapeHtml(items || t.note || '')}</td>
    </tr>`;
  }).join('');

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <style>
    body { font-family: -apple-system, Helvetica, sans-serif; color: #1c1915; padding: 32px; }
    h1 { font-weight: 500; font-size: 28px; margin: 0 0 4px; }
    p { color: #6b645c; margin: 0 0 8px; }
    .total { font-size: 22px; margin: 12px 0 28px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e6e0d6; font-size: 13px; }
    th { font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase; color: #6b645c; }
  </style>
</head>
<body>
  <h1>Vadri</h1>
  <p>${escapeHtml(monthLabel)}</p>
  <div class="total">${escapeHtml(fmt(spent, currency))} spent · ${escapeHtml(fmt(leftToBudget, currency))} left to budget</div>
  <table>
    <thead><tr><th>Date</th><th>Merchant</th><th>Line</th><th>Original</th><th>Converted</th><th>Items</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6">No activity this month.</td></tr>'}</tbody>
  </table>
</body>
</html>`;

  const file = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: 'Export PDF' });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

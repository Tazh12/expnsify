export type BuiltinSection = 'income' | 'bills' | 'variable' | 'debt' | 'investments';
export type BudgetSection = string;

export type PaidSource = 'manual' | 'receipt' | 'share' | null;

export interface BudgetLine {
  id: string;
  month: string;
  section: BudgetSection;
  name: string;
  expected: number;
  actualOverride: number | null;
  currency: string;
  dueDay: number | null;
  automated: boolean;
  notifyDaysBefore: number | null;
  observation: string | null;
  recurring: boolean;
  sortOrder: number;
  templateKey: string;
  paid: boolean;
  paidAt: string | null;
  paidSource: PaidSource;
  color: string;
}

export interface SectionMeta {
  id: string;
  label: string;
  hint: string;
  color: string;
  builtin: boolean;
}

export const SECTIONS: SectionMeta[] = [
  { id: 'income',      label: 'Income',      hint: 'what you expect to take in',            color: '#B8D4B0', builtin: true },
  { id: 'bills',       label: 'Bills',       hint: 'needs — rent, utilities, insurance',    color: '#7FA6C8', builtin: true },
  { id: 'variable',    label: 'Variable',    hint: 'groceries, gas, the fun stuff',         color: '#E0A872', builtin: true },
  { id: 'debt',        label: 'Debt',        hint: 'what should go out this month',         color: '#D9846A', builtin: true },
  { id: 'investments', label: 'Investments', hint: 'where the rest is going',               color: '#A47BB9', builtin: true },
];

export const SECTION_COLORS: Record<string, string> = Object.fromEntries(
  SECTIONS.map(s => [s.id, s.color]),
);

export function sectionColor(id: string, extra?: { id: string; color: string }[]): string {
  return extra?.find(s => s.id === id)?.color ?? SECTION_COLORS[id] ?? SECTION_COLORS.variable;
}

export function mergeSections(custom: { id: string; label: string; hint?: string | null; color: string }[]): SectionMeta[] {
  const used = new Set(SECTIONS.map(s => s.id));
  return [
    ...SECTIONS,
    ...custom.filter(c => !used.has(c.id)).map(c => ({
      id: c.id,
      label: c.label,
      hint: c.hint || 'your group',
      color: c.color,
      builtin: false,
    })),
  ];
}

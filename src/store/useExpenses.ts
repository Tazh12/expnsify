import { create } from 'zustand';
import {
  collection, doc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { parseLocalDate } from '../services/format';
import { useRates } from './useRates';

export type TxnType = 'expense' | 'income';
export type TxnSource = 'manual' | 'voice' | 'photo' | 'share' | 'pdf' | null;

export interface Expense {
  id: string;
  merchant: string;
  category_id: string;
  amount: number;
  currency: string;
  date: string;
  note: string | null;
  receipt_uri: string | null;
  confidence: number | null;
  line_id: string | null;
  type: TxnType;
  unbudgeted: boolean;
  source: TxnSource;
}

interface ExpensesState {
  expenses: Expense[];
  loaded: boolean;
  uid: string | null;
  subscribe: (uid: string) => () => void;
  reset: () => void;
  add: (expense: Expense) => Promise<void>;
  update: (id: string, patch: Partial<Omit<Expense, 'id'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  byDay: (expenses?: Expense[]) => [string, Expense[]][];
  byCategory: (expenses?: Expense[]) => Record<string, number>;
  byWeek: (expenses?: Expense[]) => { label: string; amount: number }[];
  total: (expenses?: Expense[]) => number;
  forMonth: (year: number, month: number) => Expense[];
}

function expCol(uid: string) {
  return collection(db, 'users', uid, 'expenses');
}

function groupByDay(txns: Expense[]): [string, Expense[]][] {
  const map = new Map<string, Expense[]>();
  for (const t of txns) {
    const d = t.date.slice(0, 10);
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(t);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

function fromDoc(id: string, raw: Record<string, unknown>): Expense {
  return {
    id,
    merchant: String(raw.merchant ?? ''),
    category_id: String(raw.category_id ?? 'other'),
    amount: Number(raw.amount ?? 0),
    currency: String(raw.currency ?? 'USD'),
    date: String(raw.date ?? ''),
    note: raw.note == null ? null : String(raw.note),
    receipt_uri: raw.receipt_uri == null ? null : String(raw.receipt_uri),
    confidence: raw.confidence == null ? null : Number(raw.confidence),
    line_id: raw.line_id == null ? null : String(raw.line_id),
    type: raw.type === 'income' ? 'income' : 'expense',
    unbudgeted: Boolean(raw.unbudgeted),
    source: (raw.source as TxnSource) ?? null,
  };
}

export const useExpenses = create<ExpensesState>((set, get) => ({
  expenses: [],
  loaded: false,
  uid: null,

  subscribe: (uid) => {
    set({ uid });
    const q = query(expCol(uid), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const expenses = snap.docs.map(d => fromDoc(d.id, d.data() as Record<string, unknown>));
      set({ expenses, loaded: true });
    });
    return unsub;
  },

  reset: () => set({ expenses: [], loaded: false, uid: null }),

  add: async (expense) => {
    const uid = get().uid;
    if (!uid) return;
    const { id, ...data } = expense;
    await setDoc(doc(expCol(uid), id), {
      ...data,
      note: data.note ?? null,
      receipt_uri: data.receipt_uri ?? null,
      confidence: data.confidence ?? null,
      line_id: data.line_id ?? null,
      type: data.type ?? 'expense',
      unbudgeted: data.unbudgeted ?? !data.line_id,
      source: data.source ?? null,
    });
  },

  update: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    await updateDoc(doc(expCol(uid), id), patch as Record<string, unknown>);
  },

  remove: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(doc(expCol(uid), id));
  },

  byDay: (expenses) => groupByDay(expenses ?? get().expenses),

  byCategory: (expenses) => {
    const { convert } = useRates.getState();
    const totals: Record<string, number> = {};
    for (const t of (expenses ?? get().expenses)) {
      if (t.type === 'income') continue;
      totals[t.category_id] = (totals[t.category_id] ?? 0) + convert(t.amount, t.currency);
    }
    return totals;
  },

  byWeek: (expenses) => {
    const { convert } = useRates.getState();
    const txns = (expenses ?? get().expenses).filter(t => t.type !== 'income');
    const weeks: Record<number, number> = {};
    for (const t of txns) {
      const d = parseLocalDate(t.date);
      const day = d.getDay();
      const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((day + 6) % 7));
      const key = `${monday.getFullYear()}${String(monday.getMonth() + 1).padStart(2, '0')}${String(monday.getDate()).padStart(2, '0')}`;
      const n = parseInt(key, 10);
      weeks[n] = (weeks[n] ?? 0) + convert(t.amount, t.currency);
    }
    const sorted = Object.entries(weeks).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    return sorted.map(([, amount], i) => ({ label: `W${i + 1}`, amount }));
  },

  total: (expenses) => {
    const { convert } = useRates.getState();
    return (expenses ?? get().expenses)
      .filter(t => t.type !== 'income')
      .reduce((s, t) => s + convert(t.amount, t.currency), 0);
  },

  forMonth: (year, month) =>
    get().expenses.filter(t => {
      const d = parseLocalDate(t.date);
      return d.getFullYear() === year && d.getMonth() === month;
    }),
}));

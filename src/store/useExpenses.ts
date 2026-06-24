import { create } from 'zustand';
import {
  collection, doc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, writeBatch,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { DEMO_TXNS } from './defaults';

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

export const useExpenses = create<ExpensesState>((set, get) => ({
  expenses: [],
  loaded: false,
  uid: null,

  subscribe: (uid) => {
    set({ uid });
    const q = query(expCol(uid), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, async (snap) => {
      if (snap.empty) {
        const batch = writeBatch(db);
        for (const t of DEMO_TXNS) {
          batch.set(doc(expCol(uid), t.id), {
            merchant: t.merchant,
            category_id: t.category_id,
            amount: t.amount,
            currency: t.currency,
            date: t.date,
            note: t.note ?? null,
            receipt_uri: null,
            confidence: t.confidence ?? null,
          });
        }
        await batch.commit();
        return;
      }

      // Migrate stale demo entries: if all data is the original demo set with old dates,
      // re-date them to the current month so they appear on the home screen.
      const demoIds = new Set(DEMO_TXNS.map(t => t.id));
      const docs = snap.docs;
      const allAreDemo = docs.length === DEMO_TXNS.length && docs.every(d => demoIds.has(d.id));
      if (allAreDemo) {
        const now = new Date();
        const anyStale = docs.some(d => {
          const date = new Date((d.data() as Expense).date);
          return date.getFullYear() !== now.getFullYear() || date.getMonth() !== now.getMonth();
        });
        if (anyStale) {
          const batch = writeBatch(db);
          for (const t of DEMO_TXNS) {
            batch.update(doc(expCol(uid), t.id), { date: t.date });
          }
          await batch.commit();
          return;
        }
      }

      const expenses = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Expense, 'id'>) }));
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
    });
  },

  update: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    await updateDoc(doc(expCol(uid), id), patch);
  },

  remove: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(doc(expCol(uid), id));
  },

  byDay: (expenses) => groupByDay(expenses ?? get().expenses),

  byCategory: (expenses) => {
    const totals: Record<string, number> = {};
    for (const t of (expenses ?? get().expenses)) {
      totals[t.category_id] = (totals[t.category_id] ?? 0) + t.amount;
    }
    return totals;
  },

  byWeek: (expenses) => {
    const txns = expenses ?? get().expenses;
    const weeks: Record<number, number> = {};
    for (const t of txns) {
      const d = new Date(t.date);
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - ((day + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      const n = parseInt(key.replace(/-/g, ''), 10);
      weeks[n] = (weeks[n] ?? 0) + t.amount;
    }
    const sorted = Object.entries(weeks).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    return sorted.map(([, amount], i) => ({ label: `W${i + 1}`, amount }));
  },

  total: (expenses) =>
    (expenses ?? get().expenses).reduce((s, t) => s + t.amount, 0),

  forMonth: (year, month) =>
    get().expenses.filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() === month;
    }),
}));

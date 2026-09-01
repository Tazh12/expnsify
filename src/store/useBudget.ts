import { create } from 'zustand';
import {
  collection, doc, setDoc, updateDoc, deleteDoc,
  onSnapshot, writeBatch,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { uid as makeId } from '../services/format';
import { slugKey } from '../services/month';
import { sampleLineIdsToZero } from './defaults';
import { SECTION_COLORS, type BudgetLine, type BudgetSection } from './budgetTypes';

interface BudgetState {
  lines: BudgetLine[];
  loaded: boolean;
  uid: string | null;
  ensuring: Record<string, boolean>;
  subscribe: (uid: string) => () => void;
  reset: () => void;
  ensureMonth: (month: string) => Promise<void>;
  add: (line: Omit<BudgetLine, 'id'> & { id?: string }) => Promise<BudgetLine>;
  update: (id: string, patch: Partial<Omit<BudgetLine, 'id'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  removeMany: (ids: string[]) => Promise<void>;
  forMonth: (month: string) => BudgetLine[];
}

function linesCol(uid: string) {
  return collection(db, 'users', uid, 'budgetLines');
}

function fromDoc(id: string, raw: Record<string, unknown>): BudgetLine {
  return {
    id,
    month: String(raw.month ?? ''),
    section: (raw.section as BudgetSection) ?? 'variable',
    name: String(raw.name ?? ''),
    expected: Number(raw.expected ?? 0),
    actualOverride: raw.actualOverride == null ? null : Number(raw.actualOverride),
    currency: String(raw.currency ?? 'USD'),
    dueDay: raw.dueDay == null ? null : Number(raw.dueDay),
    automated: Boolean(raw.automated),
    notifyDaysBefore: raw.notifyDaysBefore == null ? null : Number(raw.notifyDaysBefore),
    observation: raw.observation == null ? null : String(raw.observation),
    recurring: raw.recurring !== false,
    sortOrder: Number(raw.sortOrder ?? 0),
    templateKey: String(raw.templateKey ?? slugKey(String(raw.name ?? id))),
    paid: Boolean(raw.paid),
    paidAt: raw.paidAt == null ? null : String(raw.paidAt),
    paidSource: (raw.paidSource as BudgetLine['paidSource']) ?? null,
    color: String(raw.color ?? SECTION_COLORS.variable),
  };
}

function toDoc(line: Omit<BudgetLine, 'id'>): Record<string, unknown> {
  return {
    month: line.month,
    section: line.section,
    name: line.name,
    expected: line.expected,
    actualOverride: line.actualOverride,
    currency: line.currency,
    dueDay: line.dueDay,
    automated: line.automated,
    notifyDaysBefore: line.notifyDaysBefore,
    observation: line.observation,
    recurring: line.recurring,
    sortOrder: line.sortOrder,
    templateKey: line.templateKey,
    paid: line.paid,
    paidAt: line.paidAt,
    paidSource: line.paidSource,
    color: line.color,
  };
}

function copyLine(src: BudgetLine, month: string, sortOrder: number): Omit<BudgetLine, 'id'> {
  return {
    month,
    section: src.section,
    name: src.name,
    expected: src.expected,
    actualOverride: null,
    currency: src.currency,
    dueDay: src.dueDay,
    automated: src.automated,
    notifyDaysBefore: src.notifyDaysBefore,
    observation: src.observation,
    recurring: src.recurring,
    sortOrder,
    templateKey: src.templateKey,
    paid: false,
    paidAt: null,
    paidSource: null,
    color: src.color,
  };
}

export const useBudget = create<BudgetState>((set, get) => ({
  lines: [],
  loaded: false,
  uid: null,
  ensuring: {},

  subscribe: (uid) => {
    set({ uid });
    const unsub = onSnapshot(linesCol(uid), (snap) => {
      const lines = snap.docs.map(d => fromDoc(d.id, d.data() as Record<string, unknown>));
      const zero = sampleLineIdsToZero(lines);
      if (zero.length > 0) {
        const batch = writeBatch(db);
        for (const id of zero) batch.update(doc(linesCol(uid), id), { expected: 0, actualOverride: null });
        batch.commit().catch(() => {});
        set({
          lines: lines.map(l => zero.includes(l.id) ? { ...l, expected: 0, actualOverride: null } : l),
          loaded: true,
        });
        return;
      }
      set({ lines, loaded: true });
    });
    return unsub;
  },

  reset: () => set({ lines: [], loaded: false, uid: null, ensuring: {} }),

  ensureMonth: async (month) => {
    const { uid, lines, ensuring } = get();
    if (!uid || ensuring[month]) return;
    if (lines.some(l => l.month === month)) return;

    set({ ensuring: { ...ensuring, [month]: true } });
    try {
      const months = [...new Set(get().lines.map(l => l.month))].sort().reverse();
      const sourceMonth = months.find(m => m < month) ?? months[0];
      const source = sourceMonth ? get().lines.filter(l => l.month === sourceMonth && l.recurring) : [];
      if (source.length === 0) return;

      const batch = writeBatch(db);
      source.forEach((l, i) => {
        const id = makeId();
        batch.set(doc(linesCol(uid), id), toDoc(copyLine(l, month, i)));
      });
      await batch.commit();
    } finally {
      const next = { ...get().ensuring };
      delete next[month];
      set({ ensuring: next });
    }
  },

  add: async (line) => {
    const uidStr = get().uid;
    if (!uidStr) throw new Error('Not signed in');
    const id = line.id ?? makeId();
    const monthLines = get().lines.filter(l => l.month === line.month && l.section === line.section);
    const full: BudgetLine = {
      id,
      month: line.month,
      section: line.section,
      name: line.name,
      expected: line.expected,
      actualOverride: line.actualOverride ?? null,
      currency: line.currency,
      dueDay: line.dueDay ?? null,
      automated: line.automated ?? false,
      notifyDaysBefore: line.notifyDaysBefore ?? null,
      observation: line.observation ?? null,
      recurring: line.recurring ?? true,
      sortOrder: line.sortOrder ?? monthLines.length,
      templateKey: line.templateKey || slugKey(line.name),
      paid: line.paid ?? false,
      paidAt: line.paidAt ?? null,
      paidSource: line.paidSource ?? null,
      color: line.color,
    };
    await setDoc(doc(linesCol(uidStr), id), toDoc(full));
    return full;
  },

  update: async (id, patch) => {
    const uidStr = get().uid;
    if (!uidStr) return;
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) cleaned[k] = v;
    }
    await updateDoc(doc(linesCol(uidStr), id), cleaned);
  },

  remove: async (id) => {
    const uidStr = get().uid;
    if (!uidStr) return;
    await deleteDoc(doc(linesCol(uidStr), id));
  },

  removeMany: async (ids) => {
    const uidStr = get().uid;
    if (!uidStr || ids.length === 0) return;
    const batch = writeBatch(db);
    for (const id of ids) batch.delete(doc(linesCol(uidStr), id));
    await batch.commit();
  },

  forMonth: (month) =>
    get().lines
      .filter(l => l.month === month)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
}));

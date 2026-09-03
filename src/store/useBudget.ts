import { create } from 'zustand';
import {
  collection, doc, setDoc, updateDoc, deleteDoc,
  onSnapshot, writeBatch,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { uid as makeId } from '../services/format';
import { dueDayInMonth, occurrenceDaysFromAnchor, repeatGroupKey, repeatStepDays, slugKey } from '../services/month';
import { parseRepeatEvery, SECTION_COLORS, type BudgetLine, type BudgetSection } from './budgetTypes';

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
  addMany: (lines: Array<Omit<BudgetLine, 'id'> & { id?: string }>) => Promise<BudgetLine[]>;
  forMonth: (month: string) => BudgetLine[];
  dedupeRepeats: (month: string) => Promise<void>;
  carryIncome: (month: string, templateKeys: string[]) => Promise<void>;
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
    // Prefer `planned`: an old client used to clobber `expected` on common names like Rent.
    expected: Number(raw.planned ?? raw.expected ?? 0),
    actualOverride: raw.actualOverride == null ? null : Number(raw.actualOverride),
    currency: String(raw.currency ?? 'USD'),
    dueDay: raw.dueDay == null ? null : Number(raw.dueDay),
    automated: Boolean(raw.automated),
    notifyDaysBefore: raw.notifyDaysBefore == null ? null : Number(raw.notifyDaysBefore),
    observation: raw.observation == null ? null : String(raw.observation),
    recurring: raw.recurring !== false,
    repeatEvery: parseRepeatEvery(raw.repeatEvery),
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
    planned: line.expected,
    actualOverride: line.actualOverride,
    currency: line.currency,
    dueDay: line.dueDay,
    automated: line.automated,
    notifyDaysBefore: line.notifyDaysBefore,
    observation: line.observation,
    recurring: line.recurring,
    repeatEvery: line.repeatEvery,
    sortOrder: line.sortOrder,
    templateKey: line.templateKey,
    paid: line.paid,
    paidAt: line.paidAt,
    paidSource: line.paidSource,
    color: line.color,
  };
}

function copyLine(src: BudgetLine, month: string, sortOrder: number, dueDay = src.dueDay): Omit<BudgetLine, 'id'> {
  return {
    month,
    section: src.section,
    name: src.name,
    expected: src.expected,
    actualOverride: null,
    currency: src.currency,
    dueDay,
    automated: src.section === 'income' ? false : src.automated,
    notifyDaysBefore: src.section === 'income' ? null : src.notifyDaysBefore,
    observation: src.observation,
    recurring: src.recurring,
    repeatEvery: src.repeatEvery,
    sortOrder,
    templateKey: src.templateKey,
    paid: false,
    paidAt: null,
    paidSource: null,
    color: src.color,
  };
}

function groupRepeating(lines: BudgetLine[]): BudgetLine[][] {
  const groups = new Map<string, BudgetLine[]>();
  for (const line of lines) {
    const key = repeatGroupKey(line);
    const bucket = groups.get(key);
    if (bucket) bucket.push(line);
    else groups.set(key, [line]);
  }
  return [...groups.values()];
}

function seedFromSource(source: BudgetLine[], sourceMonth: string, targetMonth: string): Omit<BudgetLine, 'id'>[] {
  const out: Omit<BudgetLine, 'id'>[] = [];
  let order = 0;
  for (const members of groupRepeating(source)) {
    const proto = members.slice().sort((a, b) => (a.dueDay ?? 99) - (b.dueDay ?? 99))[0];
    const step = repeatStepDays(proto.repeatEvery);
    if (step > 0 && proto.dueDay != null) {
      const days = occurrenceDaysFromAnchor(sourceMonth, proto.dueDay, step, targetMonth);
      for (const day of days) out.push(copyLine(proto, targetMonth, order++, day));
    } else {
      const dueDay = proto.dueDay == null
        ? null
        : dueDayInMonth(sourceMonth, proto.dueDay, step, targetMonth);
      out.push(copyLine(proto, targetMonth, order++, dueDay));
    }
  }
  return out;
}

function keepBestDuplicate(a: BudgetLine, b: BudgetLine): BudgetLine {
  if (a.actualOverride != null && b.actualOverride == null) return a;
  if (b.actualOverride != null && a.actualOverride == null) return b;
  if (a.paid && !b.paid) return a;
  if (b.paid && !a.paid) return b;
  if (a.sortOrder !== b.sortOrder) return a.sortOrder < b.sortOrder ? a : b;
  return a.id < b.id ? a : b;
}

const monthLocks = new Set<string>();
let stopBudget: (() => void) | null = null;

export const useBudget = create<BudgetState>((set, get) => ({
  lines: [],
  loaded: false,
  uid: null,
  ensuring: {},

  subscribe: (uid) => {
    stopBudget?.();
    set({ uid });
    const unsub = onSnapshot(linesCol(uid), (snap) => {
      const lines = snap.docs.map(d => fromDoc(d.id, d.data() as Record<string, unknown>));
      set({ lines, loaded: true });
    });
    stopBudget = unsub;
    return () => {
      if (stopBudget === unsub) {
        unsub();
        stopBudget = null;
      }
    };
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
      const source = sourceMonth
        ? get().lines.filter(l => l.month === sourceMonth && l.recurring && l.section !== 'income')
        : [];
      if (source.length === 0) return;

      const seeded = seedFromSource(source, sourceMonth, month);
      if (seeded.length === 0) return;
      const batch = writeBatch(db);
      seeded.forEach((line) => {
        const id = makeId();
        batch.set(doc(linesCol(uid), id), toDoc(line));
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
      repeatEvery: parseRepeatEvery(line.repeatEvery),
      sortOrder: line.sortOrder ?? monthLines.length,
      templateKey: line.templateKey || slugKey(line.name),
      paid: line.paid ?? false,
      paidAt: line.paidAt ?? null,
      paidSource: line.paidSource ?? null,
      color: line.color,
    };
    set({ lines: [...get().lines.filter(l => l.id !== id), full] });
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
    if ('expected' in cleaned) cleaned.planned = cleaned.expected;
    set({
      lines: get().lines.map(l => l.id === id ? { ...l, ...patch } : l),
    });
    await updateDoc(doc(linesCol(uidStr), id), cleaned);
  },

  addMany: async (rows) => {
    const uidStr = get().uid;
    if (!uidStr || rows.length === 0) return [];
    const batch = writeBatch(db);
    const created: BudgetLine[] = [];
    for (const line of rows) {
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
        automated: line.section === 'income' ? false : (line.automated ?? false),
        notifyDaysBefore: line.section === 'income' ? null : (line.notifyDaysBefore ?? null),
        observation: line.observation ?? null,
        recurring: line.recurring ?? true,
        repeatEvery: parseRepeatEvery(line.repeatEvery),
        sortOrder: line.sortOrder ?? monthLines.length + created.length,
        templateKey: line.templateKey || slugKey(line.name),
        paid: line.paid ?? false,
        paidAt: line.paidAt ?? null,
        paidSource: line.paidSource ?? null,
        color: line.color,
      };
      created.push(full);
      batch.set(doc(linesCol(uidStr), id), toDoc(full));
    }
    const createdIds = new Set(created.map(l => l.id));
    set({ lines: [...get().lines.filter(l => !createdIds.has(l.id)), ...created] });
    await batch.commit();
    return created;
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

  dedupeRepeats: async (month) => {
    const lock = `dedupe:${month}`;
    if (monthLocks.has(lock)) return;
    monthLocks.add(lock);
    const uidStr = get().uid;
    if (!uidStr) {
      monthLocks.delete(lock);
      return;
    }
    try {
      const drop: string[] = [];
      const monthLines = get().lines.filter(l => l.month === month && l.recurring);
      for (const members of groupRepeating(monthLines)) {
        const byDay = new Map<string, BudgetLine[]>();
        for (const line of members) {
          const key = `${line.dueDay ?? 'none'}::${line.name.trim().toLowerCase()}`;
          const bucket = byDay.get(key);
          if (bucket) bucket.push(line);
          else byDay.set(key, [line]);
        }
        for (const bucket of byDay.values()) {
          if (bucket.length < 2) continue;
          const keep = bucket.reduce(keepBestDuplicate);
          for (const line of bucket) {
            if (line.id !== keep.id) drop.push(line.id);
          }
        }
      }
      if (drop.length === 0) return;
      const dropSet = new Set(drop);
      set({ lines: get().lines.filter(l => !dropSet.has(l.id)) });
      const batch = writeBatch(db);
      for (const id of drop) batch.delete(doc(linesCol(uidStr), id));
      await batch.commit();
    } finally {
      monthLocks.delete(lock);
    }
  },

  carryIncome: async (month, templateKeys) => {
    const uidStr = get().uid;
    if (!uidStr || templateKeys.length === 0) return;
    const keys = new Set(templateKeys);
    const sourceMonth = [...new Set(get().lines.filter(l => l.section === 'income' && l.recurring).map(l => l.month))]
      .filter(m => m < month)
      .sort()
      .reverse()[0];
    if (!sourceMonth) return;
    const source = get().lines.filter(l =>
      l.month === sourceMonth && l.section === 'income' && l.recurring && keys.has(l.templateKey)
    );
    if (source.length === 0) return;
    const already = new Set(
      get().lines.filter(l => l.month === month && l.section === 'income').map(l => l.templateKey),
    );
    const seeded = seedFromSource(
      source.filter(l => !already.has(l.templateKey)),
      sourceMonth,
      month,
    );
    if (seeded.length === 0) return;
    await get().addMany(seeded);
  },

  forMonth: (month) =>
    get().lines
      .filter(l => l.month === month)
      .sort((a, b) => a.sortOrder - b.sortOrder || (a.dueDay ?? 99) - (b.dueDay ?? 99) || a.name.localeCompare(b.name)),
}));

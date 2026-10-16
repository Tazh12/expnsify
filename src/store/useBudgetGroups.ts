import { create } from 'zustand';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { slugKey } from '../services/month';
import { SWATCHES } from '../theme';
import { mergeSections, type SectionMeta } from './budgetTypes';

export interface BudgetGroup {
  id: string;
  label: string;
  hint: string | null;
  color: string;
  sortOrder: number;
}

interface GroupsState {
  groups: BudgetGroup[];
  all: SectionMeta[];
  spend: SectionMeta[];
  loaded: boolean;
  uid: string | null;
  subscribe: (uid: string) => () => void;
  reset: () => void;
  add: (label: string) => Promise<string>;
  rename: (id: string, label: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function derived(groups: BudgetGroup[]) {
  const all = mergeSections(groups);
  return { groups, all, spend: all.filter(s => s.id !== 'income') };
}

const EMPTY = derived([]);

function groupsCol(uid: string) {
  return collection(db, 'users', uid, 'budgetGroups');
}

export const useBudgetGroups = create<GroupsState>((set, get) => ({
  ...EMPTY,
  loaded: false,
  uid: null,

  subscribe: (uid) => {
    set({ uid });
    const unsub = onSnapshot(groupsCol(uid), (snap) => {
      const groups = snap.docs
        .map(d => {
          const raw = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            label: String(raw.label ?? d.id),
            hint: raw.hint == null ? null : String(raw.hint),
            color: String(raw.color ?? SWATCHES[0]),
            sortOrder: Number(raw.sortOrder ?? 0),
          } satisfies BudgetGroup;
        })
        .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
      set({ ...derived(groups), loaded: true });
    });
    return unsub;
  },

  reset: () => set({ ...EMPTY, loaded: false, uid: null }),

  add: async (label) => {
    const uid = get().uid;
    const name = label.trim();
    if (!uid || !name) return 'variable';
    const id = slugKey(name);
    const existing = get().all.find(
      s => s.id === id || s.label.toLowerCase() === name.toLowerCase(),
    );
    if (existing) return existing.id;
    const color = SWATCHES[get().groups.length % SWATCHES.length];
    await setDoc(doc(groupsCol(uid), id), {
      label: name,
      hint: null,
      color,
      sortOrder: get().groups.length,
    });
    return id;
  },

  rename: async (id, label) => {
    const uid = get().uid;
    const name = label.trim();
    if (!uid || !name) return;
    await updateDoc(doc(groupsCol(uid), id), { label: name });
  },

  remove: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    await deleteDoc(doc(groupsCol(uid), id));
  },
}));

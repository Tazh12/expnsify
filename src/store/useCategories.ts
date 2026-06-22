import { create } from 'zustand';
import {
  collection, doc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, writeBatch, getDocs, where,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { SWATCHES } from '../theme';
import { DEFAULT_CATEGORIES } from './defaults';

export interface Category {
  id: string;
  name: string;
  color: string;
  source: 'seed' | 'user' | 'ai';
  sort_order: number;
  archived: number;
}

interface CategoriesState {
  categories: Category[];
  loaded: boolean;
  uid: string | null;
  subscribe: (uid: string) => () => void;
  reset: () => void;
  add: (cat: Omit<Category, 'sort_order' | 'archived'>) => Promise<void>;
  update: (id: string, patch: Partial<Pick<Category, 'name' | 'color' | 'sort_order' | 'archived'>>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  nextColor: () => string;
}

function catsCol(uid: string) {
  return collection(db, 'users', uid, 'categories');
}

export const useCategories = create<CategoriesState>((set, get) => ({
  categories: [],
  loaded: false,
  uid: null,

  subscribe: (uid) => {
    set({ uid });
    const q = query(catsCol(uid), orderBy('sort_order', 'asc'));
    const unsub = onSnapshot(q, async (snap) => {
      if (snap.empty) {
        const batch = writeBatch(db);
        for (const cat of DEFAULT_CATEGORIES) {
          batch.set(doc(catsCol(uid), cat.id), {
            name: cat.name,
            color: cat.color,
            source: 'seed',
            sort_order: cat.sort_order,
            archived: 0,
          });
        }
        await batch.commit();
        return;
      }
      const categories = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Category, 'id'>) }));
      set({ categories, loaded: true });
    });
    return unsub;
  },

  reset: () => set({ categories: [], loaded: false, uid: null }),

  add: async (cat) => {
    const uid = get().uid;
    if (!uid) return;
    const cats = get().categories;
    await setDoc(doc(catsCol(uid), cat.id), {
      name: cat.name,
      color: cat.color,
      source: cat.source,
      sort_order: cats.length,
      archived: 0,
    });
  },

  update: async (id, patch) => {
    const uid = get().uid;
    if (!uid) return;
    await updateDoc(doc(catsCol(uid), id), patch);
  },

  remove: async (id) => {
    const uid = get().uid;
    if (!uid) return;
    const expSnap = await getDocs(
      query(collection(db, 'users', uid, 'expenses'), where('category_id', '==', id))
    );
    const batch = writeBatch(db);
    expSnap.docs.forEach(d => batch.update(d.ref, { category_id: 'other' }));
    batch.delete(doc(catsCol(uid), id));
    await batch.commit();
  },

  nextColor: () => {
    const cats = get().categories;
    const usedColors = new Set(cats.map(c => c.color));
    return SWATCHES.find(s => !usedColors.has(s)) ?? SWATCHES[cats.length % SWATCHES.length];
  },
}));

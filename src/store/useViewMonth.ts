import { create } from 'zustand';
import { defaultBudgetMonth } from '../services/month';

interface ViewMonthState {
  month: Date;
  setMonth: (month: Date) => void;
  shiftMonth: (delta: number) => void;
}

export const useViewMonth = create<ViewMonthState>((set, get) => ({
  month: defaultBudgetMonth(),
  setMonth: (month) => set({ month }),
  shiftMonth: (delta) => {
    const next = new Date(get().month);
    next.setMonth(next.getMonth() + delta);
    set({ month: next });
  },
}));

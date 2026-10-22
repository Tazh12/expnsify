import { create } from 'zustand';
import { fetchUsage, type AiUsage } from '../services/groq';
import { setAiUsageListeners, type AiBlockCode } from '../services/aiUsageBridge';

interface AiUsageState extends AiUsage {
  loaded: boolean;
  blocked: { used: number; limit: number; resetsAt: string; code: AiBlockCode } | null;
  refresh: () => Promise<void>;
  apply: (usage: AiUsage) => void;
  showBlock: (block: NonNullable<AiUsageState['blocked']>) => void;
  clearBlock: () => void;
}

const EMPTY: AiUsage = { used: 0, limit: 10, resetsAt: null, plan: 'free' };

export const useAiUsage = create<AiUsageState>((set) => ({
  ...EMPTY,
  loaded: false,
  blocked: null,

  refresh: async () => {
    const usage = await fetchUsage();
    if (!usage) return;
    set({ ...usage, loaded: true });
  },

  apply: (usage) => set({ ...usage, loaded: true }),

  showBlock: (blocked) => set(blocked.code === 'account_required' ? { blocked } : {
    blocked,
    used: blocked.used,
    limit: blocked.limit,
    resetsAt: blocked.resetsAt,
    loaded: true,
  }),

  clearBlock: () => set({ blocked: null }),
}));

setAiUsageListeners(
  (usage) => useAiUsage.getState().apply(usage),
  (blocked) => useAiUsage.getState().showBlock(blocked),
);

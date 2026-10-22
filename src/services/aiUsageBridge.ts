export type AiBlockCode = 'limit_reached' | 'rate_limited' | 'account_required';

export interface UsageSnapshot {
  used: number;
  limit: number;
  resetsAt: string | null;
  plan: 'free' | 'paid';
}

type UsageListener = (usage: UsageSnapshot) => void;
type LimitListener = (block: { used: number; limit: number; resetsAt: string; code: AiBlockCode }) => void;

let onUsage: UsageListener | null = null;
let onLimit: LimitListener | null = null;

export function setAiUsageListeners(usage: UsageListener, limit: LimitListener) {
  onUsage = usage;
  onLimit = limit;
}

export function publishAiUsage(usage: UsageSnapshot) {
  onUsage?.(usage);
}

export function publishAiLimit(block: { used: number; limit: number; resetsAt: string; code: AiBlockCode }) {
  onLimit?.(block);
}

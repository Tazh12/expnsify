import { useEffect, useMemo } from 'react';
import { monthKey } from '../services/month';
import { syncNotifications } from '../services/notifications';
import { useBudget } from '../store/useBudget';
import { useSettings } from '../store/useSettings';

export function useNotificationSync() {
  const loaded = useBudget(s => s.loaded);
  const allLines = useBudget(s => s.lines);
  const notifyBudget = useSettings(s => s.notifyBudget);
  const budgetReminderDay = useSettings(s => s.budgetReminderDay);
  const notifyDueDates = useSettings(s => s.notifyDueDates);

  const now = new Date();
  const key = monthKey(now);
  const nextKey = now.getDate() >= 25
    ? monthKey(new Date(now.getFullYear(), now.getMonth() + 1, 1))
    : null;
  const lines = useMemo(
    () => allLines.filter(l => l.month === key || l.month === nextKey),
    [allLines, key, nextKey],
  );

  useEffect(() => {
    if (!loaded) return;
    syncNotifications({
      notifyBudget,
      budgetReminderDay,
      notifyDueDates,
      lines,
    }).catch(() => {});
  }, [loaded, lines, key, notifyBudget, budgetReminderDay, notifyDueDates]);
}

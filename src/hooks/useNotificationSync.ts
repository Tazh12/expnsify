import { useEffect, useMemo } from 'react';
import { monthKey } from '../services/month';
import { syncNotifications } from '../services/notifications';
import { useBudget } from '../store/useBudget';
import { useSettings } from '../store/useSettings';
import { useViewMonth } from '../store/useViewMonth';

export function useNotificationSync() {
  const month = useViewMonth(s => s.month);
  const key = monthKey(month);
  const loaded = useBudget(s => s.loaded);
  const allLines = useBudget(s => s.lines);
  const notifyBudget = useSettings(s => s.notifyBudget);
  const budgetReminderDay = useSettings(s => s.budgetReminderDay);
  const notifyDueDates = useSettings(s => s.notifyDueDates);

  const lines = useMemo(
    () => allLines.filter(l => l.month === key),
    [allLines, key],
  );

  useEffect(() => {
    if (!loaded || lines.length === 0) return;
    syncNotifications({
      notifyBudget,
      budgetReminderDay,
      notifyDueDates,
      lines,
      month: key,
    }).catch(() => {});
  }, [loaded, lines, key, notifyBudget, budgetReminderDay, notifyDueDates]);
}

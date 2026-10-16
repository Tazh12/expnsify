import { Platform } from 'react-native';
import type { BudgetLine } from '../store/budgetTypes';
import { dueDateFor, monthKey } from './month';

const BUDGET_ID = 'monthly-budget-reminder';
const DUE_PREFIX = 'due-';

type NotificationsMod = typeof import('expo-notifications');

let Notifications: NotificationsMod | null = null;

async function load(): Promise<NotificationsMod | null> {
  if (Platform.OS === 'web') return null;
  if (Notifications) return Notifications;
  try {
    Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    return Notifications;
  } catch {
    return null;
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  const N = await load();
  if (!N) return false;
  const existing = await N.getPermissionsAsync();
  if (existing.granted) return true;
  const asked = await N.requestPermissionsAsync();
  return asked.granted;
}

export async function syncNotifications(opts: {
  notifyBudget: boolean;
  budgetReminderDay: number;
  notifyDueDates: boolean;
  lines: BudgetLine[];
}): Promise<void> {
  const N = await load();
  if (!N) return;
  const ok = await requestNotificationPermission();
  if (!ok) return;

  await N.cancelAllScheduledNotificationsAsync();

  if (opts.notifyBudget) {
    const day = Math.min(28, Math.max(1, opts.budgetReminderDay || 1));
    await N.scheduleNotificationAsync({
      identifier: BUDGET_ID,
      content: {
        title: 'Time to budget',
        body: 'Sit down for 10 minutes and give every dollar a job.',
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.CALENDAR,
        day,
        hour: 9,
        minute: 0,
        repeats: true,
      },
    });
  }

  if (opts.notifyDueDates) {
    const now = new Date();
    const currentKey = monthKey(now);
    const nextKey = monthKey(new Date(now.getFullYear(), now.getMonth() + 1, 1));
    const allowNext = now.getDate() >= 25;
    for (const line of opts.lines) {
      if (line.section === 'income' || line.paid || line.dueDay == null) continue;
      if (line.month !== currentKey && !(allowNext && line.month === nextKey)) continue;
      const due = dueDateFor(line.month, line.dueDay);
      const lead = line.notifyDaysBefore ?? 1;
      const when = new Date(due);
      when.setDate(when.getDate() - lead);
      when.setHours(9, 0, 0, 0);
      if (when.getTime() <= Date.now()) continue;
      await N.scheduleNotificationAsync({
        identifier: `${DUE_PREFIX}${line.id}`,
        content: {
          title: line.automated ? `${line.name} comes out soon` : `Pay ${line.name}`,
          body: line.automated
            ? `${line.name} is auto-pay on the ${ordinal(line.dueDay)}.`
            : `${line.name} is due on the ${ordinal(line.dueDay)}.`,
        },
        trigger: {
          type: N.SchedulableTriggerInputTypes.DATE,
          date: when,
        },
      });
    }
  }
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export function ordinalDay(n: number): string {
  return ordinal(n);
}

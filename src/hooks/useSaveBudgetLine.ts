import { useBudget } from '../store/useBudget';
import type { BudgetLine } from '../store/budgetTypes';
import { occurrenceDaysInMonth, repeatStepDays, uniqueTemplateKey } from '../services/month';

export function useSaveBudgetLine() {
  const { addMany, update, lines: allLines } = useBudget();

  return async (payload: Omit<BudgetLine, 'id'> & { id?: string }) => {
    const isNew = !payload.id;
    let templateKey = payload.templateKey;
    if (isNew) {
      const takenKeys = new Set(
        allLines
          .filter(l => l.month === payload.month && l.section === payload.section)
          .map(l => l.templateKey),
      );
      templateKey = uniqueTemplateKey(payload.templateKey || payload.name, takenKeys);
    }
    const saved = { ...payload, templateKey };

    const step = saved.recurring ? repeatStepDays(saved.repeatEvery) : 0;
    const days = step > 0 && saved.dueDay != null
      ? occurrenceDaysInMonth(saved.month, saved.dueDay, saved.repeatEvery)
      : [saved.dueDay];

    const series = allLines.filter(l =>
      l.month === saved.month
      && l.section === saved.section
      && l.templateKey === templateKey
    );

    if (saved.id) {
      const { id, ...patch } = saved;
      await update(id, patch);
      for (const sib of series) {
        if (sib.id === id || sib.paid) continue;
        await update(sib.id, {
          name: saved.name,
          expected: saved.expected,
          observation: saved.observation,
          recurring: saved.recurring,
          repeatEvery: saved.repeatEvery,
          currency: saved.currency,
        });
      }
      return;
    }

    const taken = new Set(series.map(l => l.dueDay));
    const fresh = days.filter(day => !taken.has(day ?? null));
    if (fresh.length === 0) return;
    await addMany(fresh.map((day, i) => ({
      ...saved,
      dueDay: day ?? null,
      actualOverride: i === 0 ? saved.actualOverride : null,
      sortOrder: (saved.sortOrder ?? 0) + i,
    })));
  };
}

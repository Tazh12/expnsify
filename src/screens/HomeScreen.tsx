import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTheme } from '../theme';
import { Card, Icon, Tap, CarryIncomeCard } from '../components';
import { AddMenu } from '../components/AddMenu';
import { BudgetRing } from '../components/BudgetRing';
import { BudgetSection } from '../components/BudgetSection';
import { UpcomingPayments } from '../components/UpcomingPayments';
import { LineEditor } from '../flows/LineEditor';
import { useBudget } from '../store/useBudget';
import { useExpenses } from '../store/useExpenses';
import { useRates } from '../store/useRates';
import { useSettings } from '../store/useSettings';
import { useBudgetGroups } from '../store/useBudgetGroups';
import { fmt } from '../services/format';
import { monthKey, occurrenceDaysInMonth, repeatStepDays, uniqueTemplateKey } from '../services/month';
import { incomeCarryOffers, lineActual, summarizeMonth } from '../services/budget';
import { syncNotifications } from '../services/notifications';
import { type BudgetLine, type BudgetSection as BudgetSectionId } from '../store/budgetTypes';
import { useLayout } from '../hooks/useLayout';

interface Props {
  month: Date;
  onChangeMonth: (delta: number) => void;
}

export function HomeScreen({ month, onChangeMonth }: Props) {
  const C = useTheme();
  const { isWide } = useLayout();
  const key = monthKey(month);
  const { forMonth, ensureMonth, addMany, update, remove, loaded, dedupeRepeats, carryIncome, lines: allLines } = useBudget();
  const allMeta = useBudgetGroups(s => s.all);
  const lines = forMonth(key);
  const { expenses } = useExpenses();
  const { convert } = useRates();
  const settings = useSettings();
  const { preferredCurrency } = settings;

  const [editor, setEditor] = useState<{ section: BudgetSectionId; line: BudgetLine | null } | null>(null);
  const [skipCarry, setSkipCarry] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!loaded) return;
    ensureMonth(key)
      .then(() => dedupeRepeats(key))
      .catch(() => {});
  }, [key, loaded]);

  useEffect(() => {
    if (!loaded || lines.length === 0) return;
    syncNotifications({
      notifyBudget: settings.notifyBudget,
      budgetReminderDay: settings.budgetReminderDay,
      notifyDueDates: settings.notifyDueDates,
      lines,
      month: key,
    }).catch(() => {});
  }, [loaded, lines, key, settings.notifyBudget, settings.budgetReminderDay, settings.notifyDueDates]);

  const monthExpenses = useMemo(
    () => expenses.filter(e => e.date.slice(0, 7) === key),
    [expenses, key],
  );

  const actuals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const line of lines) {
      map[line.id] = lineActual(line, monthExpenses, convert);
    }
    return map;
  }, [lines, monthExpenses, convert]);

  const summary = useMemo(
    () => summarizeMonth(lines, monthExpenses, convert),
    [lines, monthExpenses, convert],
  );
  const carryOffers = useMemo(
    () => skipCarry[key] ? [] : incomeCarryOffers(allLines, key),
    [allLines, key, skipCarry],
  );

  const monthLabel = month.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const [mName, mYear] = monthLabel.split(' ');
  const leftColor = summary.leftToBudget === 0 ? C.sage : summary.leftToBudget < 0 ? C.rose : C.cream;
  const over = summary.assigned > 0 && summary.spent > summary.assigned;
  const noPlan = summary.assigned <= 0;

  const saveLine = async (payload: Omit<BudgetLine, 'id'> & { id?: string }) => {
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

  const togglePaid = async (line: BudgetLine) => {
    await update(line.id, {
      paid: !line.paid,
      paidAt: !line.paid ? new Date().toISOString() : null,
      paidSource: !line.paid ? 'manual' : null,
    });
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: isWide ? 32 : 20,
          paddingBottom: isWide ? 48 : 120,
          maxWidth: isWide ? 1100 : undefined,
          width: '100%' as any,
          alignSelf: isWide ? 'center' : undefined,
        }}
        showsVerticalScrollIndicator={false}
      >
        {isWide && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
              <Tap onPress={() => onChangeMonth(-1)} style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="chev-l" size={16} stroke={C.cream}/>
              </Tap>
              <Text style={{ fontFamily: C.fonts.serif, fontSize: 24, color: C.cream, letterSpacing: -0.3 }} numberOfLines={1}>
                {mName}{' '}
                <Text style={{ color: C.muted, fontStyle: 'italic' }}>{mYear}</Text>
              </Text>
              <Tap onPress={() => onChangeMonth(1)} style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="chev-r" size={16} stroke={C.cream}/>
              </Tap>
            </View>
            <AddMenu
              onAddBudget={() => setEditor({ section: 'variable', line: null })}
              onAddIncome={() => setEditor({ section: 'income', line: null })}
            />
          </View>
        )}

        <View style={{
          flexDirection: isWide ? 'row' : 'column',
          alignItems: 'center',
          gap: isWide ? 36 : 8,
          paddingVertical: 12,
          marginBottom: 8,
        }}>
          <BudgetRing
            spent={summary.spent}
            assigned={summary.assigned}
            currency={preferredCurrency}
            size={isWide ? 188 : 168}
          />
          <View style={{ flex: 1, alignItems: isWide ? 'flex-start' : 'center', width: '100%' }}>
            <Text style={{
              fontFamily: C.fonts.serif, fontSize: isWide ? 32 : 26, color: C.cream,
              letterSpacing: -0.4, textAlign: isWide ? 'left' : 'center',
            }}>
              {noPlan ? 'No budget yet' : over ? 'Overspent' : 'On track'}
            </Text>
            <Text style={{
              marginTop: 8, color: C.muted, fontSize: 15, lineHeight: 22,
              textAlign: isWide ? 'left' : 'center', maxWidth: 340,
            }}>
              {noPlan
                ? 'Tap Add to add income, then add rent, groceries, and the rest. We’ll put each line in the right place.'
                : over
                  ? `Spent ${fmt(summary.spent, preferredCurrency)} of ${fmt(summary.assigned, preferredCurrency)} planned.`
                  : `Spent ${fmt(summary.spent, preferredCurrency)} of ${fmt(summary.assigned, preferredCurrency)} planned.`}
            </Text>
            {!isWide && (
              <View style={{ marginTop: 16 }}>
                <AddMenu
                  quiet
                  onAddBudget={() => setEditor({ section: 'variable', line: null })}
                  onAddIncome={() => setEditor({ section: 'income', line: null })}
                />
              </View>
            )}
          </View>
        </View>

        <Card style={{ padding: 16, marginTop: 8, marginBottom: 8 }}>
          <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.05, textTransform: 'uppercase' }}>
            Left to budget
          </Text>
          <Text style={{ fontFamily: C.fonts.serif, fontSize: 28, color: leftColor, marginTop: 4 }}>
            {fmt(summary.leftToBudget, preferredCurrency)}
          </Text>
          <Text style={{ marginTop: 4, color: C.muted, fontSize: 13 }}>
            {summary.leftToBudget === 0
              ? 'Every dollar has a job.'
              : summary.leftToBudget < 0
                ? 'Over-assigned — pull something back.'
                : 'Income that still needs a job.'}
          </Text>
        </Card>

        <CarryIncomeCard
          month={key}
          offers={carryOffers}
          preferredCurrency={preferredCurrency}
          onAdd={() => {
            carryIncome(key, carryOffers.map(o => o.templateKey)).catch(() => {});
          }}
          onSkip={() => setSkipCarry(s => ({ ...s, [key]: true }))}
        />

        <UpcomingPayments
          lines={lines}
          preferredCurrency={preferredCurrency}
          onPress={(line) => setEditor({ section: line.section, line })}
        />

        {allMeta.map(s => {
          const sectionLines = lines.filter(l => l.section === s.id);
          if (sectionLines.length === 0) return null;
          return (
            <BudgetSection
              key={s.id}
              section={s.id}
              label={s.label}
              hint={s.hint}
              lines={sectionLines}
              actuals={actuals}
              preferredCurrency={preferredCurrency}
              onPressLine={(line) => setEditor({ section: line.section, line })}
              onTogglePaid={togglePaid}
              wide={isWide}
            />
          );
        })}
      </ScrollView>

      <LineEditor
        open={!!editor}
        section={editor?.section ?? 'variable'}
        month={key}
        currency={preferredCurrency}
        initial={editor?.line ?? null}
        existing={lines}
        onSave={saveLine}
        onDelete={editor?.line ? () => remove(editor.line!.id) : undefined}
        onClose={() => setEditor(null)}
      />
    </>
  );
}

export { TxnRow } from '../components/TxnRow';

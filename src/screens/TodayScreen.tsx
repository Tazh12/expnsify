import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useTheme } from '../theme';
import { Card, Tap, BottomSheet } from '../components';
import { useLayout } from '../hooks/useLayout';
import { useViewMonth } from '../store/useViewMonth';
import { useBudget } from '../store/useBudget';
import { useExpenses, type Expense } from '../store/useExpenses';
import { useRates } from '../store/useRates';
import { useSettings } from '../store/useSettings';
import { useBudgetGroups } from '../store/useBudgetGroups';
import { fmt, dayLabel } from '../services/format';
import { dueDateFor, formatDueDate, monthKey, monthTitle } from '../services/month';
import { isUnbudgeted, lineActual, summarizeMonth } from '../services/budget';
import { useSaveBudgetLine } from '../hooks/useSaveBudgetLine';
import { LineEditor } from '../flows/LineEditor';
import type { BudgetLine, BudgetSection } from '../store/budgetTypes';

function dueWithinWeek(line: BudgetLine, month: string, now = new Date()): boolean {
  if (line.section === 'income' || line.paid || line.dueDay == null) return false;
  const due = dueDateFor(month, line.dueDay);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return due >= start && due <= end;
}

export function TodayScreen({
  onOpenPlan,
  onOpenActivity,
}: {
  onOpenPlan: () => void;
  onOpenActivity: () => void;
}) {
  const C = useTheme();
  const { isWide } = useLayout();
  const month = useViewMonth(s => s.month);
  const key = monthKey(month);
  const { forMonth, ensureMonth, update, remove, loaded } = useBudget();
  const lines = forMonth(key);
  const groups = useBudgetGroups(s => s.all);
  const { expenses, update: updateExpense } = useExpenses();
  const { convert } = useRates();
  const { preferredCurrency } = useSettings();
  const saveLine = useSaveBudgetLine();

  const [assigning, setAssigning] = useState<Expense | null>(null);
  const [editor, setEditor] = useState<BudgetLine | null>(null);

  useEffect(() => {
    if (!loaded) return;
    ensureMonth(key).catch(() => {});
  }, [key, loaded]);

  const monthExpenses = useMemo(
    () => expenses.filter(e => e.date.slice(0, 7) === key),
    [expenses, key],
  );
  const summary = useMemo(
    () => summarizeMonth(lines, monthExpenses, convert),
    [lines, monthExpenses, convert],
  );

  const leftToSpend = summary.assigned - summary.spent;
  const overspentMonth = leftToSpend < 0;
  const bar = summary.assigned > 0
    ? Math.min(summary.spent / summary.assigned, 1)
    : (summary.spent > 0 ? 1 : 0);

  const unbudgeted = monthExpenses.filter(e => isUnbudgeted(e, lines));
  const dueSoon = lines.filter(l => dueWithinWeek(l, key));
  const overLines = lines.filter(l => {
    if (l.section === 'income' || l.expected <= 0) return false;
    return lineActual(l, monthExpenses, convert) > l.expected;
  });
  const attention = unbudgeted.length + dueSoon.length + overLines.length;
  const recent = [...monthExpenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const spendGroups = groups.filter(g => g.id !== 'income');
  const noPlan = lines.length === 0;

  const assign = async (line: BudgetLine) => {
    if (!assigning) return;
    await updateExpense(assigning.id, {
      line_id: line.id,
      category_id: line.templateKey,
      unbudgeted: false,
    });
    setAssigning(null);
  };

  const markPaid = async (line: BudgetLine) => {
    await update(line.id, {
      paid: true,
      paidAt: new Date().toISOString(),
      paidSource: 'manual',
    });
  };

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: isWide ? 32 : 20,
          paddingBottom: isWide ? 48 : 120,
          maxWidth: isWide ? 760 : undefined,
          width: '100%' as const,
          alignSelf: isWide ? 'center' : undefined,
        }}
      >
        {noPlan ? (
          <Tap onPress={onOpenPlan} accessibilityLabel={`Build ${monthTitle(key)}'s plan`} style={{ marginTop: 12 }}>
            <Card style={{ padding: 22 }}>
              <Text style={{ fontFamily: C.fonts.serif, fontSize: 28, color: C.cream, letterSpacing: -0.3 }}>
                Build {monthTitle(key)}'s plan →
              </Text>
              <Text style={{ marginTop: 8, color: C.muted, fontSize: 15, lineHeight: 22 }}>
                Give every dollar a job, then Today can tell you what’s left.
              </Text>
            </Card>
          </Tap>
        ) : (
          <>
            <Text style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>Left to spend this month</Text>
            <Text style={{
              fontFamily: C.fonts.serif, fontSize: 48, letterSpacing: -1, marginTop: 4,
              color: overspentMonth ? C.rose : C.cream,
            }}>
              {fmt(leftToSpend, preferredCurrency)}
            </Text>
            <View style={{
              marginTop: 14, height: 4, borderRadius: 2, backgroundColor: C.surface, overflow: 'hidden',
            }}>
              <View style={{
                width: `${Math.round(bar * 100)}%`, height: 4,
                backgroundColor: overspentMonth ? C.rose : C.sage,
              }}/>
            </View>
            <Tap
              onPress={onOpenPlan}
              accessibilityLabel="Open plan"
              style={{
                alignSelf: 'flex-start', marginTop: 14,
                paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999,
                backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
              }}
            >
              <Text style={{ fontSize: 13, color: summary.leftToBudget < 0 ? C.rose : C.cream }}>
                {summary.leftToBudget === 0
                  ? '✓ Every dollar assigned'
                  : summary.leftToBudget < 0
                    ? `Over-assigned by ${fmt(Math.abs(summary.leftToBudget), preferredCurrency)} →`
                    : `${fmt(summary.leftToBudget, preferredCurrency)} to assign →`}
              </Text>
            </Tap>
          </>
        )}

        {attention > 0 && (
          <View style={{ marginTop: 28 }}>
            <Text style={{ fontFamily: C.fonts.serif, fontSize: 22, color: C.cream, marginBottom: 10 }}>
              Needs attention
            </Text>
            <Card style={{ overflow: 'hidden' }}>
              {unbudgeted.map(expense => (
                <AttentionRow
                  key={expense.id}
                  title={expense.merchant || 'Expense'}
                  detail={`${fmt(convert(expense.amount, expense.currency || 'USD'), preferredCurrency)} needs a line`}
                  action="Assign line"
                  onPress={() => setAssigning(expense)}
                />
              ))}
              {dueSoon.map(line => (
                <AttentionRow
                  key={line.id}
                  title={line.name}
                  detail={`Due ${formatDueDate(key, line.dueDay ?? 1)}`}
                  action="Mark paid"
                  onPress={() => markPaid(line)}
                />
              ))}
              {overLines.map(line => (
                <AttentionRow
                  key={`over-${line.id}`}
                  title={line.name}
                  detail={`${fmt(lineActual(line, monthExpenses, convert), preferredCurrency)} of ${fmt(line.expected, preferredCurrency)}`}
                  action="Adjust"
                  onPress={() => setEditor(line)}
                />
              ))}
            </Card>
          </View>
        )}

        {recent.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <Text style={{ fontFamily: C.fonts.serif, fontSize: 22, color: C.cream, marginBottom: 10 }}>
              Recent
            </Text>
            <Card style={{ overflow: 'hidden' }}>
              {recent.map(expense => (
                <View
                  key={expense.id}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    paddingVertical: 12, paddingHorizontal: 16,
                    borderBottomWidth: 0.5, borderBottomColor: C.hair,
                  }}
                >
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={{ fontSize: 15, color: C.cream }} numberOfLines={1}>{expense.merchant || 'Expense'}</Text>
                    <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{dayLabel(expense.date.slice(0, 10))}</Text>
                  </View>
                  <Text style={{ fontSize: 14, color: expense.type === 'income' ? C.sage : C.cream }}>
                    {fmt(convert(expense.amount, expense.currency || 'USD'), preferredCurrency)}
                  </Text>
                </View>
              ))}
              <Tap onPress={onOpenActivity} accessibilityLabel="See all activity" style={{ padding: 16 }}>
                <Text style={{ fontSize: 14, color: C.sage, fontWeight: '600' }}>See all</Text>
              </Tap>
            </Card>
          </View>
        )}
      </ScrollView>

      <BottomSheet visible={!!assigning} onClose={() => setAssigning(null)}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }} keyboardShouldPersistTaps="handled">
          <Text style={{ fontFamily: C.fonts.serif, fontSize: 26, color: C.cream, marginBottom: 6 }}>
            Assign line
          </Text>
          <Text style={{ color: C.muted, fontSize: 13, marginBottom: 16 }}>
            {assigning?.merchant}
          </Text>
          {spendGroups.map(group => {
            const groupLines = lines.filter(l => l.section === group.id);
            if (groupLines.length === 0) return null;
            return (
              <View key={group.id} style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 8 }}>
                  {group.label}
                </Text>
                {groupLines.map(line => (
                  <Tap
                    key={line.id}
                    onPress={() => assign(line)}
                    style={{
                      paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: C.hair,
                    }}
                  >
                    <Text style={{ fontSize: 15, color: C.cream }}>{line.name}</Text>
                  </Tap>
                ))}
              </View>
            );
          })}
          {lines.filter(l => l.section !== 'income').length === 0 && (
            <Text style={{ color: C.muted, fontSize: 14 }}>Add a line on Plan first.</Text>
          )}
        </ScrollView>
      </BottomSheet>

      <LineEditor
        open={!!editor}
        section={(editor?.section ?? 'variable') as BudgetSection}
        month={key}
        currency={preferredCurrency}
        initial={editor}
        existing={lines}
        onSave={saveLine}
        onDelete={editor ? () => remove(editor.id) : undefined}
        onClose={() => setEditor(null)}
      />
    </>
  );
}

function AttentionRow({
  title, detail, action, onPress,
}: {
  title: string;
  detail: string;
  action: string;
  onPress: () => void;
}) {
  const C = useTheme();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 12, paddingHorizontal: 16,
      borderBottomWidth: 0.5, borderBottomColor: C.hair,
    }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, color: C.cream }} numberOfLines={1}>{title}</Text>
        <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{detail}</Text>
      </View>
      <Tap
        onPress={onPress}
        accessibilityLabel={action}
        style={{
          minHeight: 44, justifyContent: 'center',
          paddingHorizontal: 12, borderRadius: 12, backgroundColor: C.surface,
        }}
      >
        <Text style={{ fontSize: 13, color: C.sage, fontWeight: '600' }}>{action}</Text>
      </Tap>
    </View>
  );
}

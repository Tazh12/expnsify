import React, { useMemo } from 'react';
import {
  View, Text, ScrollView, Alert,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../theme';
import { Card, Icon, Tap, PageHeader, SectionHeader, SettingsRow } from '../components';
import { useExpenses } from '../store/useExpenses';
import { useBudget } from '../store/useBudget';
import { useRates } from '../store/useRates';
import { useSettings } from '../store/useSettings';
import { useBudgetGroups } from '../store/useBudgetGroups';
import { fmt } from '../services/format';
import { monthKey } from '../services/month';
import { useViewMonth } from '../store/useViewMonth';
import { lineActual, summarizeMonth, sectionTotal } from '../services/budget';
import { type BudgetSection } from '../store/budgetTypes';
import { useLayout } from '../hooks/useLayout';
import { ordinalDay } from '../services/notifications';
import { exportMonthPdf } from '../services/export';

interface Props { onOpenRecap?: () => void }

export function InsightsScreen({ onOpenRecap }: Props) {
  const C = useTheme();
  const { isWide } = useLayout();
  const { expenses } = useExpenses();
  const { forMonth, ensureMonth, loaded } = useBudget();
  const { convert } = useRates();
  const { preferredCurrency } = useSettings();
  const spend = useBudgetGroups(s => s.spend);
  const month = useViewMonth(s => s.month);
  const shiftMonth = useViewMonth(s => s.shiftMonth);
  const key = monthKey(month);
  const lines = forMonth(key);

  React.useEffect(() => {
    if (loaded) ensureMonth(key).catch(() => {});
  }, [key, loaded]);

  const monthExpenses = useMemo(
    () => expenses.filter(e => e.date.slice(0, 7) === key),
    [expenses, key],
  );
  const summary = useMemo(
    () => summarizeMonth(lines, monthExpenses, convert),
    [lines, monthExpenses, convert],
  );

  const unpaid = lines.filter(l => l.section !== 'income' && !l.paid && l.dueDay != null);
  const overspent = lines.filter(l => {
    if (l.section === 'income' || l.expected <= 0) return false;
    return lineActual(l, monthExpenses, convert) > l.expected;
  });

  const monthLabel = month.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const exportCsv = async () => {
    const header = 'Date,Merchant,Line,Type,Amount,Currency,Unbudgeted,Note\n';
    const rows = monthExpenses.map(t => {
      const line = lines.find(l => l.id === t.line_id);
      return `"${t.date}","${t.merchant}","${line?.name ?? t.category_id}","${t.type}","${t.amount}","${t.currency}","${t.unbudgeted}","${t.note ?? ''}"`;
    }).join('\n');
    const path = FileSystem.cacheDirectory + 'expnsify-budget.csv';
    await FileSystem.writeAsStringAsync(path, header + rows, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export budget' });
  };

  const exportPdf = async () => {
    try {
      await exportMonthPdf({
        monthLabel,
        expenses: monthExpenses,
        lines,
        currency: preferredCurrency,
        leftToBudget: summary.leftToBudget,
        spent: summary.spent,
      });
    } catch (e) {
      console.error('pdf export', e);
      Alert.alert('Could not export PDF', 'Please try again.');
    }
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: isWide ? 32 : 20, paddingBottom: isWide ? 48 : 120, maxWidth: isWide ? 900 : undefined, width: '100%' as any, alignSelf: isWide ? 'center' : undefined }}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader title="Insights" tagline="plan versus reality"/>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 8 }}>
        <Tap onPress={() => shiftMonth(-1)} style={{
          width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface,
          borderWidth: 0.5, borderColor: C.hair, alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="chev-l" size={16} stroke={C.cream}/>
        </Tap>
        <Text style={{ fontFamily: C.fonts.serif, fontSize: 20, color: C.cream, flex: 1 }}>
          {monthLabel}
        </Text>
        <Tap onPress={() => shiftMonth(1)} style={{
          width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface,
          borderWidth: 0.5, borderColor: C.hair, alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="chev-r" size={16} stroke={C.cream}/>
        </Tap>
      </View>

      <Card style={{ marginTop: 12, padding: 18 }}>
        <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.05, textTransform: 'uppercase' }}>Left to budget</Text>
        <Text style={{
          fontFamily: C.fonts.serif, fontSize: 36, marginTop: 6,
          color: summary.leftToBudget === 0 ? C.sage : summary.leftToBudget < 0 ? C.rose : C.cream,
        }}>
          {fmt(summary.leftToBudget, preferredCurrency)}
        </Text>
        <View style={{ flexDirection: 'row', gap: 18, marginTop: 14 }}>
          <Stat label="Expected in" value={fmt(summary.expectedIncome, preferredCurrency)} C={C}/>
          <Stat label="Assigned" value={fmt(summary.assigned, preferredCurrency)} C={C}/>
          <Stat label="Spent" value={fmt(summary.spent, preferredCurrency)} C={C}/>
        </View>
      </Card>

      <SectionHeader title="By section"/>
      <Card style={{ padding: 18 }}>
        {spend.filter(s => {
          const tot = sectionTotal(lines, s.id as BudgetSection, monthExpenses, convert);
          return tot.expected !== 0 || tot.actual !== 0;
        }).map((s, i, arr) => {
          const tot = sectionTotal(lines, s.id as BudgetSection, monthExpenses, convert);
          const max = Math.max(tot.expected, tot.actual, 1);
          return (
            <View key={s.id} style={{ paddingVertical: 12, borderBottomWidth: i === arr.length - 1 ? 0 : 0.5, borderBottomColor: C.hair }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 14, color: C.cream }}>{s.label}</Text>
                <Text style={{ fontSize: 13, color: tot.actual > tot.expected && tot.expected > 0 ? C.rose : C.muted }}>
                  {fmt(tot.actual, preferredCurrency)} / {fmt(tot.expected, preferredCurrency)}
                </Text>
              </View>
              <View style={{ height: 6, backgroundColor: C.surface2, borderRadius: 3, overflow: 'hidden' }}>
                <View style={{
                  height: '100%',
                  width: `${Math.min(100, (tot.actual / max) * 100)}%`,
                  backgroundColor: tot.actual > tot.expected && tot.expected > 0 ? C.rose : C.sage,
                  borderRadius: 3,
                }}/>
              </View>
            </View>
          );
        })}
      </Card>

      <SectionHeader title="Unpaid bills"/>
      <Card style={{ overflow: 'hidden' }}>
        {unpaid.length === 0 && (
          <Text style={{ color: C.muted, fontStyle: 'italic', textAlign: 'center', padding: 20 }}>All caught up.</Text>
        )}
        {unpaid.map((l, i) => (
          <View key={l.id} style={{
            flexDirection: 'row', justifyContent: 'space-between', padding: 16,
            borderBottomWidth: i === unpaid.length - 1 ? 0 : 0.5, borderBottomColor: C.hair,
          }}>
            <View>
              <Text style={{ fontSize: 15, color: C.cream }}>{l.name}</Text>
              <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                Due {l.dueDay != null ? ordinalDay(l.dueDay) : '—'}{l.automated ? ' · auto-pay' : ''}
              </Text>
            </View>
            <Text style={{ fontSize: 15, color: C.cream }}>{fmt(l.expected, preferredCurrency)}</Text>
          </View>
        ))}
      </Card>

      {overspent.length > 0 && (
        <>
          <SectionHeader title="Overspent"/>
          <Card style={{ overflow: 'hidden' }}>
            {overspent.map((l, i) => {
              const actual = lineActual(l, monthExpenses, convert);
              return (
                <View key={l.id} style={{
                  flexDirection: 'row', justifyContent: 'space-between', padding: 16,
                  borderBottomWidth: i === overspent.length - 1 ? 0 : 0.5, borderBottomColor: C.hair,
                }}>
                  <Text style={{ fontSize: 15, color: C.rose }}>{l.name}</Text>
                  <Text style={{ fontSize: 14, color: C.rose }}>
                    {fmt(actual, preferredCurrency)} / {fmt(l.expected, preferredCurrency)}
                  </Text>
                </View>
              );
            })}
          </Card>
        </>
      )}

      <SectionHeader title="This week"/>
      <Card style={{ padding: 4 }}>
        <SettingsRow
          icon={<Icon name="sparkles" size={18} stroke={C.sage}/>}
          label="Weekly comparison"
          detail="Your spending, side by side"
          onPress={onOpenRecap}
          isLast
        />
      </Card>

      <SectionHeader title="Export"/>
      <Card style={{ padding: 4 }}>
        <SettingsRow icon={<Icon name="export" size={18} stroke={C.cream}/>} label="Export this month as .csv" detail="Budget + activity" onPress={exportCsv}/>
        <SettingsRow icon={<Icon name="export" size={18} stroke={C.cream}/>} label="Export this month as PDF" detail="Same month, for sharing" onPress={exportPdf} isLast/>
      </Card>
    </ScrollView>
  );
}

function Stat({ label, value, C }: { label: string; value: string; C: ReturnType<typeof useTheme> }) {
  return (
    <View>
      <Text style={{ fontSize: 11, color: C.muted }}>{label}</Text>
      <Text style={{ fontSize: 14, color: C.cream, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

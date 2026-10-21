import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { useTheme } from '../theme';
import { Card, PageHeader, SectionHeader, SettingsRow, Icon, Tap, EmptyState } from '../components';
import { useExpenses, type Expense } from '../store/useExpenses';
import { useBudget } from '../store/useBudget';
import { useRates } from '../store/useRates';
import { useSettings } from '../store/useSettings';
import { useBudgetGroups } from '../store/useBudgetGroups';
import { useCategories } from '../store/useCategories';
import { fmt, parseLocalDate } from '../services/format';
import { monthKey } from '../services/month';
import { useViewMonth } from '../store/useViewMonth';
import { lineActual, summarizeMonth, sectionTotal } from '../services/budget';
import { type BudgetLine, type BudgetSection } from '../store/budgetTypes';
import { useLayout } from '../hooks/useLayout';
import { exportMonthPdf, expensesToCsv } from '../services/export';
import { AiLimitError, fetchInsights } from '../services/groq';

type Span = 'week' | 'month';

function prevMonthKey(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return monthKey(new Date(year, month - 2, 1));
}

function inRange(iso: string, start: Date, end: Date): boolean {
  const d = parseLocalDate(iso);
  return d >= start && d <= end;
}

function spendOf(list: Expense[], convert: (amount: number, currency: string) => number): number {
  return list
    .filter(t => t.type !== 'income')
    .reduce((sum, t) => sum + convert(t.amount, t.currency || 'USD'), 0);
}

function lineName(expense: Expense, lines: BudgetLine[]): string {
  const month = expense.date.slice(0, 7);
  const line = lines.find(l => l.id === expense.line_id)
    ?? lines.find(l => l.month === month && l.templateKey === expense.category_id && l.section !== 'income');
  return line?.name ?? 'Unbudgeted';
}

export function InsightsScreen() {
  const C = useTheme();
  const { isWide } = useLayout();
  const { expenses } = useExpenses();
  const { forMonth, ensureMonth, loaded, lines: allLines } = useBudget();
  const { convert } = useRates();
  const { preferredCurrency } = useSettings();
  const spend = useBudgetGroups(s => s.spend);
  const { categories } = useCategories();
  const month = useViewMonth(s => s.month);
  const key = monthKey(month);
  const lines = forMonth(key);
  const [span, setSpan] = useState<Span>('month');
  const [insights, setInsights] = useState<string[]>([]);
  const [insightState, setInsightState] = useState<'idle' | 'loading' | 'done'>('idle');

  React.useEffect(() => {
    if (loaded) ensureMonth(key).catch(() => {});
  }, [key, loaded]);

  React.useEffect(() => {
    setInsights([]);
    setInsightState('idle');
  }, [key, span]);

  const monthExpenses = useMemo(
    () => expenses.filter(e => e.date.slice(0, 7) === key),
    [expenses, key],
  );
  const summary = useMemo(
    () => summarizeMonth(lines, monthExpenses, convert),
    [lines, monthExpenses, convert],
  );

  const comparison = useMemo(() => {
    const now = new Date();
    if (span === 'week') {
      const dow = (now.getDay() + 6) % 7;
      const start = new Date(now); start.setDate(now.getDate() - dow); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
      const prevStart = new Date(start); prevStart.setDate(start.getDate() - 7);
      const prevEnd = new Date(start); prevEnd.setDate(start.getDate() - 1); prevEnd.setHours(23, 59, 59, 999);
      const current = expenses.filter(t => inRange(t.date, start, end));
      const previous = expenses.filter(t => inRange(t.date, prevStart, prevEnd));
      const points = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(start); day.setDate(start.getDate() + i);
        const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
        return spendOf(expenses.filter(t => inRange(t.date, day, dayEnd)), convert);
      });
      return {
        current, previous, points,
        labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
        comparedWith: 'last week',
      };
    }
    const prevKey = prevMonthKey(key);
    const current = expenses.filter(t => t.date.slice(0, 7) === key);
    const previous = expenses.filter(t => t.date.slice(0, 7) === prevKey);
    const [year, monthIndex] = key.split('-').map(Number);
    const days = new Date(year, monthIndex, 0).getDate();
    const weeks = Math.ceil(days / 7);
    const points = Array.from({ length: weeks }, (_, i) => {
      const start = new Date(year, monthIndex - 1, i * 7 + 1);
      const end = new Date(year, monthIndex - 1, Math.min(days, (i + 1) * 7), 23, 59, 59, 999);
      return spendOf(current.filter(t => inRange(t.date, start, end)), convert);
    });
    const prevName = new Date(year, monthIndex - 2, 1).toLocaleString('en-US', { month: 'long' });
    return {
      current, previous, points,
      labels: Array.from({ length: weeks }, (_, i) => `W${i + 1}`),
      comparedWith: prevName,
    };
  }, [span, expenses, key, convert]);

  const spent = spendOf(comparison.current, convert);
  const prevSpent = spendOf(comparison.previous, convert);
  const pct = spent > 0 && prevSpent > 0 ? Math.round(((spent - prevSpent) / prevSpent) * 100) : null;
  const periodWord = span === 'week' ? 'this week' : 'this month';
  const headline = spent <= 0
    ? `Nothing logged yet ${periodWord}`
    : `You spent ${fmt(spent, preferredCurrency)}${pct == null || pct === 0 ? '' : `, ${Math.abs(pct)}% ${pct < 0 ? 'less' : 'more'} than ${comparison.comparedWith}`}.`;

  const topLine = useMemo(() => {
    const totals = new Map<string, number>();
    for (const expense of comparison.current) {
      if (expense.type === 'income') continue;
      const name = lineName(expense, allLines);
      totals.set(name, (totals.get(name) ?? 0) + convert(expense.amount, expense.currency || 'USD'));
    }
    const top = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
    return top && top[1] > 0 ? top[0] : null;
  }, [comparison.current, allLines, convert]);

  const overspent = lines.filter(l => {
    const planned = convert(l.expected, l.currency || 'USD');
    if (l.section === 'income' || planned <= 0) return false;
    return lineActual(l, monthExpenses, convert) > planned;
  });
  const monthLabel = month.toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const exportCsv = async () => {
    const path = FileSystem.cacheDirectory + 'vadri-budget.csv';
    await FileSystem.writeAsStringAsync(path, expensesToCsv(monthExpenses, lines, convert, preferredCurrency), { encoding: FileSystem.EncodingType.UTF8 });
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
        convert,
      });
    } catch (e) {
      console.error('pdf export', e);
      Alert.alert('Could not export PDF', 'Please try again.');
    }
  };

  const generateInsights = async () => {
    if (insightState === 'loading') return;
    setInsightState('loading');
    try {
      const notes = await fetchInsights(
        comparison.current.filter(t => t.type !== 'income').map(t => ({
          merchant: t.merchant,
          amount: convert(t.amount, t.currency || 'USD'),
          currency: preferredCurrency,
          date: t.date,
          category_id: t.category_id,
          note: t.note,
          line_items: t.line_items,
        })),
        categories.map(c => ({ id: c.id, name: c.name })),
      );
      setInsights(notes);
      setInsightState('done');
    } catch (e) {
      if (!(e instanceof AiLimitError)) setInsightState('idle');
      else setInsightState('idle');
    }
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: isWide ? 32 : 20, paddingBottom: isWide ? 48 : 120, maxWidth: isWide ? 900 : undefined, width: '100%' as const, alignSelf: isWide ? 'center' : undefined }}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader title="Insights"/>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        {(['week', 'month'] as Span[]).map(id => (
          <Tap
            key={id}
            onPress={() => setSpan(id)}
            style={{
              minHeight: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: 'center',
              backgroundColor: span === id ? C.sage : C.surface,
              borderWidth: 0.5, borderColor: span === id ? C.sage : C.hair,
            }}
          >
            <Text style={{ fontSize: 13, color: span === id ? '#0E0E0C' : C.cream, fontWeight: '600' }}>
              {id === 'week' ? 'Week' : 'Month'}
            </Text>
          </Tap>
        ))}
      </View>

      <Text style={{ fontFamily: C.fonts.serif, fontSize: 28, color: C.cream, marginTop: 16, letterSpacing: -0.3, lineHeight: 34 }}>
        {headline}
      </Text>
      {topLine && (
        <Text style={{ marginTop: 8, color: C.muted, fontSize: 15 }}>Most spent on {topLine}</Text>
      )}
      {spent <= 0 ? (
        <EmptyState icon="cal" title="Nothing to compare yet" line="Add an expense and this comparison will fill in."/>
      ) : (
        <Card style={{ padding: 16, marginTop: 16 }}>
          <Sparkline points={comparison.points} xLabels={comparison.labels}/>
        </Card>
      )}

      <Card style={{ padding: 16, marginTop: 16 }}>
        <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.04, textTransform: 'uppercase' }}>
          Optional AI notes
        </Text>
        <Text style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 18 }}>
          The comparison above is calculated on this device. Generate insights sends this period to the model and uses one AI action.
        </Text>
        {insights.map((line, i) => (
          <Text key={i} style={{ fontSize: 15, color: C.cream, marginTop: 12, lineHeight: 21 }}>{line}</Text>
        ))}
        {insightState === 'done' && insights.length === 0 && (
          <Text style={{ fontSize: 14, color: C.muted, marginTop: 12 }}>No extra notes for this period.</Text>
        )}
        <Tap
          onPress={generateInsights}
          haptic
          style={{ marginTop: 14, minHeight: 44, borderRadius: 12, backgroundColor: C.sage, alignItems: 'center', justifyContent: 'center' }}
        >
          {insightState === 'loading'
            ? <ActivityIndicator color="#0E0E0C"/>
            : <Text style={{ fontSize: 14, fontWeight: '600', color: '#0E0E0C' }}>Generate insights</Text>}
        </Tap>
      </Card>

      <Card style={{ marginTop: 16, padding: 18 }}>
        <View style={{ flexDirection: 'row', gap: 18 }}>
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
                    {fmt(actual, preferredCurrency)} / {fmt(convert(l.expected, l.currency || 'USD'), preferredCurrency)}
                  </Text>
                </View>
              );
            })}
          </Card>
        </>
      )}

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
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 11, color: C.muted }}>{label}</Text>
      <Text style={{ fontSize: 14, color: C.cream, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

function Sparkline({ points, xLabels }: { points: number[]; xLabels: string[] }) {
  const C = useTheme();
  const w = 280;
  const h = 60;
  const max = Math.max(...points, 1);
  const n = Math.max(points.length, 1);
  const pts = points.map((p, i) => ({
    x: n === 1 ? w / 2 : (i / (n - 1)) * w,
    y: h - (p / max) * (h - 4) - 2,
  }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = pts.length > 0 ? `${path} L ${pts[pts.length - 1].x.toFixed(1)} ${h} L 0 ${h} Z` : '';

  return (
    <View>
      {pts.length > 0 && (
        <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
          <Defs>
            <SvgGrad id="insight-spark" x1="0" x2="0" y1="0" y2="1">
              <Stop offset="0%" stopColor={C.sage} stopOpacity="0.35"/>
              <Stop offset="100%" stopColor={C.sage} stopOpacity="0"/>
            </SvgGrad>
          </Defs>
          <Path d={area} fill="url(#insight-spark)"/>
          <Path d={path} fill="none" stroke={C.sage} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          {pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r="2" fill={C.sage}/>)}
        </Svg>
      )}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        {xLabels.map((label, i) => (
          <Text key={i} style={{ fontSize: 10, color: C.subtle }}>{label}</Text>
        ))}
      </View>
    </View>
  );
}

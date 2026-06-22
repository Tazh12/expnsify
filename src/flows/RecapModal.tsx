import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGrad, Stop } from 'react-native-svg';
import { useTheme } from '../theme';
import { Card, Icon, Tap } from '../components';
import { useExpenses, type Expense } from '../store/useExpenses';
import { useCategories } from '../store/useCategories';
import { fmt } from '../services/format';

// ─── Shared type (mirrors ReportsScreen's DateFilter) ─────────────────────────

export type RangeId = 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom';

export interface DateFilter {
  rangeId: RangeId;
  customFrom: string; // YYYY-MM-DD
  customTo: string;
}

// ─── Period helpers ───────────────────────────────────────────────────────────

type BucketType = 'day' | 'week' | 'month';

interface PeriodInfo {
  currentStart: Date;
  currentEnd: Date;
  prevStart: Date;
  prevEnd: Date;
  label: string;       // "This month"
  prevLabel: string;   // "last month"
  bucketType: BucketType;
  numBuckets: number;
  xLabels: string[];
}

function getPeriodInfo(filter: DateFilter, now: Date): PeriodInfo {
  switch (filter.rangeId) {
    case 'week': {
      const dow = (now.getDay() + 6) % 7;
      const cs = new Date(now); cs.setDate(now.getDate() - dow); cs.setHours(0,0,0,0);
      const ce = new Date(cs); ce.setDate(cs.getDate() + 6); ce.setHours(23,59,59,999);
      const ps = new Date(cs); ps.setDate(cs.getDate() - 7);
      const pe = new Date(cs); pe.setDate(cs.getDate() - 1); pe.setHours(23,59,59,999);
      return {
        currentStart: cs, currentEnd: ce, prevStart: ps, prevEnd: pe,
        label: 'This week', prevLabel: 'last week',
        bucketType: 'day', numBuckets: 7,
        xLabels: ['M','T','W','T','F','S','S'],
      };
    }
    case 'month': {
      const cs = new Date(now.getFullYear(), now.getMonth(), 1);
      const ce = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23,59,59,999);
      const ps = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const pe = new Date(cs.getTime() - 1);
      const weeksInMonth = Math.ceil(ce.getDate() / 7);
      return {
        currentStart: cs, currentEnd: ce, prevStart: ps, prevEnd: pe,
        label: now.toLocaleString('en-US', { month: 'long' }), prevLabel: 'last month',
        bucketType: 'week', numBuckets: weeksInMonth,
        xLabels: Array.from({ length: weeksInMonth }, (_, i) => `W${i+1}`),
      };
    }
    case 'quarter': {
      const cs = new Date(now); cs.setMonth(now.getMonth() - 3); cs.setHours(0,0,0,0);
      const ce = new Date(now); ce.setHours(23,59,59,999);
      const ps = new Date(cs); ps.setMonth(cs.getMonth() - 3);
      const pe = new Date(cs.getTime() - 1);
      const monthNames = Array.from({ length: 3 }, (_, i) => {
        const d = new Date(cs); d.setMonth(cs.getMonth() + i);
        return d.toLocaleString('en-US', { month: 'short' });
      });
      return {
        currentStart: cs, currentEnd: ce, prevStart: ps, prevEnd: pe,
        label: 'Last 3 months', prevLabel: 'previous quarter',
        bucketType: 'month', numBuckets: 3,
        xLabels: monthNames,
      };
    }
    case 'year': {
      const cs = new Date(now.getFullYear(), 0, 1);
      const ce = new Date(now.getFullYear(), 11, 31, 23,59,59,999);
      const ps = new Date(now.getFullYear() - 1, 0, 1);
      const pe = new Date(now.getFullYear() - 1, 11, 31, 23,59,59,999);
      return {
        currentStart: cs, currentEnd: ce, prevStart: ps, prevEnd: pe,
        label: `${now.getFullYear()}`, prevLabel: `${now.getFullYear() - 1}`,
        bucketType: 'month', numBuckets: 12,
        xLabels: ['J','F','M','A','M','J','J','A','S','O','N','D'],
      };
    }
    case 'all': {
      const cs = new Date(0);
      const ce = new Date(now); ce.setHours(23,59,59,999);
      return {
        currentStart: cs, currentEnd: ce, prevStart: new Date(0), prevEnd: new Date(0),
        label: 'All time', prevLabel: '',
        bucketType: 'month', numBuckets: 12,
        xLabels: ['J','F','M','A','M','J','J','A','S','O','N','D'],
      };
    }
    case 'custom': {
      const from = filter.customFrom ? new Date(filter.customFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
      const to   = filter.customTo   ? new Date(filter.customTo + 'T23:59:59') : new Date(now);
      const spanMs   = Math.max(to.getTime() - from.getTime(), 86400000);
      const spanDays = Math.ceil(spanMs / 86400000);
      const ps = new Date(from.getTime() - spanMs);
      const pe = new Date(from.getTime() - 1);
      const bucketType: BucketType = spanDays <= 14 ? 'day' : spanDays <= 90 ? 'week' : 'month';
      const numBuckets = Math.min(
        bucketType === 'day' ? spanDays : bucketType === 'week' ? Math.ceil(spanDays / 7) : Math.ceil(spanDays / 30),
        12,
      );
      const xLabels = Array.from({ length: numBuckets }, (_, i) => `${i+1}`);
      const rangeStr = filter.customFrom && filter.customTo
        ? `${filter.customFrom} → ${filter.customTo}` : 'Custom range';
      return {
        currentStart: from, currentEnd: to, prevStart: ps, prevEnd: pe,
        label: rangeStr, prevLabel: 'previous period',
        bucketType, numBuckets,
        xLabels,
      };
    }
  }
}

function buildSparkline(
  expenses: Expense[],
  periodInfo: PeriodInfo,
): number[] {
  const { currentStart, bucketType, numBuckets } = periodInfo;

  return Array.from({ length: numBuckets }, (_, i) => {
    let bStart: Date, bEnd: Date;
    if (bucketType === 'day') {
      bStart = new Date(currentStart); bStart.setDate(currentStart.getDate() + i); bStart.setHours(0,0,0,0);
      bEnd   = new Date(bStart); bEnd.setHours(23,59,59,999);
    } else if (bucketType === 'week') {
      bStart = new Date(currentStart); bStart.setDate(currentStart.getDate() + i * 7); bStart.setHours(0,0,0,0);
      bEnd   = new Date(bStart); bEnd.setDate(bStart.getDate() + 6); bEnd.setHours(23,59,59,999);
    } else {
      bStart = new Date(currentStart.getFullYear(), currentStart.getMonth() + i, 1);
      bEnd   = new Date(currentStart.getFullYear(), currentStart.getMonth() + i + 1, 0, 23,59,59,999);
    }
    return expenses
      .filter(t => { const d = new Date(t.date); return d >= bStart && d <= bEnd; })
      .reduce((s, t) => s + t.amount, 0);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

const DEFAULT_FILTER: DateFilter = { rangeId: 'week', customFrom: '', customTo: '' };

interface Props {
  open: boolean;
  onClose: () => void;
  dateFilter?: DateFilter;
}

export function RecapModal({ open, onClose, dateFilter = DEFAULT_FILTER }: Props) {
  const C = useTheme();
  const { expenses } = useExpenses();
  const { categories } = useCategories();
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

  const now = new Date();
  const period = getPeriodInfo(dateFilter, now);

  const current = expenses.filter(t => { const d = new Date(t.date); return d >= period.currentStart && d <= period.currentEnd; });
  const prev    = expenses.filter(t => { const d = new Date(t.date); return d >= period.prevStart    && d <= period.prevEnd; });

  const currentTotal = current.reduce((s, t) => s + t.amount, 0);
  const prevTotal    = prev.reduce((s, t) => s + t.amount, 0);
  const pct = prevTotal > 0 ? Math.round(((currentTotal - prevTotal) / prevTotal) * 100) : null;

  const byCat = current.reduce<Record<string, number>>((acc, t) => {
    acc[t.category_id] = (acc[t.category_id] ?? 0) + t.amount; return acc;
  }, {});
  const topCatEntry = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  const topCatName  = topCatEntry ? (catMap[topCatEntry[0]]?.name ?? topCatEntry[0]) : null;

  const sparkPoints = buildSparkline(current, period);

  // Date subtitle for week (Mon May 4 — Sun May 10)
  function ordinal(n: number) { const s=['th','st','nd','rd'],v=n%100; return n+(s[(v-20)%10]??s[v]??s[0]); }
  function fmtDay(d: Date) {
    return `${d.toLocaleString('en-US',{weekday:'short'})} ${d.toLocaleString('en-US',{month:'short'})} ${ordinal(d.getDate())}`;
  }
  const subtitle = dateFilter.rangeId === 'week'
    ? `${fmtDay(period.currentStart)} — ${fmtDay(period.currentEnd)}`
    : dateFilter.rangeId === 'custom' && dateFilter.customFrom
      ? period.label
      : undefined;

  const periodVerb = {
    week: 'this week', month: 'this month', quarter: 'last 3 months',
    year: 'this year', all: 'overall', custom: 'in this period',
  }[dateFilter.rangeId];

  return (
    <Modal visible={open} transparent animationType="fade">
      <BlurView intensity={60} tint="dark" style={{ flex: 1, justifyContent: 'center', padding: 16 }}>
        <TouchableOpacity style={{ position: 'absolute', inset: 0 } as any} onPress={onClose}/>
        <View style={{
          backgroundColor: C.bgElev,
          borderRadius: 32, borderWidth: 0.5, borderColor: C.hairStrong,
          padding: 24, maxHeight: '88%' as any,
        }}>
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={{ fontSize: 11, color: C.sage, letterSpacing: 0.06, textTransform: 'uppercase' }}>
                  ✦ {period.label}
                </Text>
                {subtitle && (
                  <Text style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{subtitle}</Text>
                )}
                <Text style={{ fontFamily: C.fonts.serif, fontSize: 36, color: C.cream, lineHeight: 38, letterSpacing: -0.4, marginTop: 6 }}>
                  The <Text style={{ fontStyle: 'italic' }}>recap</Text>.
                </Text>
              </View>
              <Tap onPress={onClose} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="x" size={16} stroke={C.muted}/>
              </Tap>
            </View>

            {/* Pull quote */}
            <View style={{ paddingVertical: 24, borderBottomWidth: 0.5, borderBottomColor: C.hair, marginTop: 12 }}>
              <Text style={{ fontFamily: C.fonts.serifItalic, fontSize: 20, color: C.cream, lineHeight: 26 }}>
                {currentTotal > 0
                  ? `"You spent ${fmt(currentTotal)} ${periodVerb}${pct != null && pct !== 0 ? `, ${Math.abs(pct)}% ${pct < 0 ? 'less' : 'more'} than ${period.prevLabel}` : ''}."`
                  : `"No expenses logged ${periodVerb} yet."`}
              </Text>
            </View>

            {/* Stat cards */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 }}>
              <StatCard label="You spent" val={fmt(currentTotal)} hint={periodVerb} emph/>
              {pct != null && (
                <StatCard
                  label={`vs ${period.prevLabel}`}
                  val={`${pct > 0 ? '↑' : pct < 0 ? '↓' : '='} ${Math.abs(pct)}%`}
                  hint={pct < 0 ? 'less' : pct > 0 ? 'more' : 'same'}
                  color={pct < 0 ? C.sage : C.rose}
                />
              )}
              {topCatName && (
                <StatCard label="Most spent on" val={topCatName} hint={topCatEntry ? fmt(topCatEntry[1]) : ''}/>
              )}
              <StatCard label="Transactions" val={`${current.length}`} hint={periodVerb}/>
            </View>

            {/* Sparkline */}
            <Card style={{ padding: 16, marginTop: 18 }}>
              <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.04, textTransform: 'uppercase', marginBottom: 8 }}>
                {period.bucketType === 'day' ? 'Daily flow' : period.bucketType === 'week' ? 'Weekly flow' : 'Monthly flow'}
              </Text>
              <Sparkline points={sparkPoints} xLabels={period.xLabels}/>
            </Card>

            <Tap onPress={onClose} haptic style={{ marginTop: 18, paddingVertical: 14, borderRadius: 14, backgroundColor: C.surface2, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: C.cream }}>Got it</Text>
            </Tap>
          </ScrollView>
        </View>
      </BlurView>
    </Modal>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, val, hint, emph, color }: { label: string; val: string; hint: string; emph?: boolean; color?: string }) {
  const C = useTheme();
  return (
    <View style={{ width: '47%', padding: 16, backgroundColor: C.surface, borderRadius: 16, borderWidth: 0.5, borderColor: C.hair }}>
      <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.04, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ fontFamily: C.fonts.serif, fontSize: emph ? 32 : 24, color: color ?? C.cream, marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>
        {val}
      </Text>
      <Text style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{hint}</Text>
    </View>
  );
}

function Sparkline({ points, xLabels }: { points: number[]; xLabels: string[] }) {
  const C = useTheme();
  const w = 280, h = 60;
  const max = Math.max(...points, 1);
  const n = points.length;
  const pts = points.map((p, i) => ({
    x: n === 1 ? w / 2 : (i / (n - 1)) * w,
    y: h - (p / max) * (h - 4) - 2,
  }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = path + ` L ${pts[pts.length-1].x.toFixed(1)} ${h} L 0 ${h} Z`;

  // Show labels: max 7 evenly spaced to avoid crowding
  const step = Math.max(1, Math.ceil(xLabels.length / 7));
  const visibleLabels = xLabels.map((l, i) => ({ l, show: i % step === 0 || i === xLabels.length - 1 }));

  return (
    <View>
      <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
        <Defs>
          <SvgGrad id="sf" x1="0" x2="0" y1="0" y2="1">
            <Stop offset="0%" stopColor={C.sage} stopOpacity="0.35"/>
            <Stop offset="100%" stopColor={C.sage} stopOpacity="0"/>
          </SvgGrad>
        </Defs>
        <Path d={area} fill="url(#sf)"/>
        <Path d={path} fill="none" stroke={C.sage} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        {pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r="2" fill={C.sage}/>)}
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        {visibleLabels.map((item, i) => (
          <Text key={i} style={{ fontSize: 10, color: item.show ? C.subtle : 'transparent' }}>
            {item.l}
          </Text>
        ))}
      </View>
    </View>
  );
}

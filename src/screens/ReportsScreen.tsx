import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Alert, Modal,
  TextInput, Pressable, StyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../theme';
import { Card, Icon, Tap } from '../components';
import { useExpenses } from '../store/useExpenses';
import { useCategories } from '../store/useCategories';
import { useRates } from '../store/useRates';
import { useSettings } from '../store/useSettings';
import { fmt } from '../services/format';
import { RecapModal } from '../flows/RecapModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type RangeId = 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom';

interface DateFilter {
  rangeId: RangeId;
  customFrom: string; // YYYY-MM-DD
  customTo: string;
}

const RANGES: { id: RangeId; label: string }[] = [
  { id: 'week',    label: 'This week' },
  { id: 'month',   label: 'This month' },
  { id: 'quarter', label: '3 months' },
  { id: 'year',    label: 'This year' },
  { id: 'all',     label: 'All time' },
];

const QUICK_RANGES: RangeId[] = ['week', 'month', 'quarter'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function applyDateFilter(
  expenses: ReturnType<typeof useExpenses.getState>['expenses'],
  f: DateFilter,
) {
  const now = new Date();
  return expenses.filter(t => {
    const d = new Date(t.date);
    switch (f.rangeId) {
      case 'week': {
        const s = new Date(now); s.setDate(now.getDate() - 7); s.setHours(0,0,0,0);
        return d >= s;
      }
      case 'month':
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      case 'quarter': {
        const s = new Date(now); s.setMonth(now.getMonth() - 3);
        return d >= s;
      }
      case 'year':
        return d.getFullYear() === now.getFullYear();
      case 'all':
        return true;
      case 'custom': {
        if (f.customFrom && d < new Date(f.customFrom)) return false;
        if (f.customTo && d > new Date(f.customTo + 'T23:59:59')) return false;
        return true;
      }
    }
  });
}

// ─── Comparison bars ──────────────────────────────────────────────────────────

interface CompBar {
  label: string;
  sublabel?: string;
  amount: number;
  isCurrent: boolean;
}

function sumInRange(
  expenses: ReturnType<typeof useExpenses.getState>['expenses'],
  start: Date,
  end: Date,
  cats: string[],
): number {
  const { convert } = useRates.getState();
  return expenses
    .filter(t => {
      const d = new Date(t.date);
      return d >= start && d <= end && (cats.length === 0 || cats.includes(t.category_id));
    })
    .reduce((s, t) => s + convert(t.amount, t.currency), 0);
}

function buildComparisonBars(
  allExpenses: ReturnType<typeof useExpenses.getState>['expenses'],
  dateFilter: DateFilter,
  activeCats: string[],
): { bars: CompBar[]; title: string } {
  const now = new Date();

  switch (dateFilter.rangeId) {
    case 'week': {
      const dow = (now.getDay() + 6) % 7;
      const thisStart = new Date(now); thisStart.setDate(now.getDate() - dow); thisStart.setHours(0,0,0,0);
      const bars: CompBar[] = [-2, -1, 0].map(offset => {
        const s = new Date(thisStart); s.setDate(thisStart.getDate() + offset * 7);
        const e = new Date(s); e.setDate(s.getDate() + 6); e.setHours(23,59,59,999);
        const label = offset === 0 ? 'This wk'
          : offset === -1 ? 'Last wk' : '2wk ago';
        return { label, amount: sumInRange(allExpenses, s, e, activeCats), isCurrent: offset === 0 };
      });
      return { bars, title: 'Weekly comparison' };
    }
    case 'month': {
      const bars: CompBar[] = [-2, -1, 0].map(offset => {
        const s = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        const e = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23,59,59,999);
        const label = s.toLocaleString('en-US', { month: 'short' });
        const sublabel = offset < 0 ? `${s.getFullYear()}` : undefined;
        return { label, sublabel, amount: sumInRange(allExpenses, s, e, activeCats), isCurrent: offset === 0 };
      });
      return { bars, title: 'Monthly comparison' };
    }
    case 'quarter': {
      const bars: CompBar[] = [-2, -1, 0].map(offset => {
        const e = new Date(now); e.setMonth(now.getMonth() + offset * 3); e.setHours(23,59,59,999);
        const s = new Date(e); s.setMonth(e.getMonth() - 3); s.setHours(0,0,0,0);
        const mo = s.toLocaleString('en-US', { month: 'short' });
        const label = offset === 0 ? 'Now' : `${mo} '${String(s.getFullYear()).slice(2)}`;
        return { label, amount: sumInRange(allExpenses, s, e, activeCats), isCurrent: offset === 0 };
      });
      return { bars, title: 'Quarterly comparison' };
    }
    case 'year': {
      const bars: CompBar[] = [-2, -1, 0].map(offset => {
        const yr = now.getFullYear() + offset;
        const s = new Date(yr, 0, 1); const e = new Date(yr, 11, 31, 23,59,59,999);
        return { label: `${yr}`, amount: sumInRange(allExpenses, s, e, activeCats), isCurrent: offset === 0 };
      });
      return { bars, title: 'Year over year' };
    }
    case 'all': {
      const bars: CompBar[] = [-2, -1, 0].map(offset => {
        const yr = now.getFullYear() + offset;
        const s = new Date(yr, 0, 1); const e = new Date(yr, 11, 31, 23,59,59,999);
        return { label: `${yr}`, amount: sumInRange(allExpenses, s, e, activeCats), isCurrent: offset === 0 };
      });
      return { bars, title: 'Year over year' };
    }
    case 'custom': {
      const from = dateFilter.customFrom ? new Date(dateFilter.customFrom) : new Date(now.getFullYear(), now.getMonth(), 1);
      const to   = dateFilter.customTo   ? new Date(dateFilter.customTo + 'T23:59:59') : new Date(now);
      const spanMs = Math.max(to.getTime() - from.getTime(), 86400000);
      const bars: CompBar[] = [-2, -1, 0].map(offset => {
        const s = new Date(from.getTime() + offset * spanMs);
        const e = new Date(to.getTime()  + offset * spanMs);
        const label = offset === 0 ? 'Current'
          : offset === -1 ? 'Previous' : '2 ago';
        return { label, amount: sumInRange(allExpenses, s, e, activeCats), isCurrent: offset === 0 };
      });
      return { bars, title: 'Period comparison' };
    }
  }
}

function dateLabel(f: DateFilter): string {
  if (f.rangeId === 'custom') {
    const from = f.customFrom || '…';
    const to   = f.customTo   || '…';
    return `${from} → ${to}`;
  }
  return RANGES.find(r => r.id === f.rangeId)?.label ?? f.rangeId;
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

interface Props { onOpenRecap?: () => void }

export function ReportsScreen({ onOpenRecap }: Props) {
  const C = useTheme();
  const { expenses } = useExpenses();
  const { categories } = useCategories();
  const { convert, rates } = useRates();
  const { preferredCurrency } = useSettings();
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

  const [dateFilter, setDateFilter] = useState<DateFilter>({ rangeId: 'month', customFrom: '', customTo: '' });
  const [activeCats, setActiveCats] = useState<string[]>([]);  // empty = all

  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [catSheetOpen,  setCatSheetOpen]  = useState(false);
  const [recapOpen,     setRecapOpen]     = useState(false);

  const dateFiltered = useMemo(() =>
    applyDateFilter(expenses, dateFilter),
    [expenses, dateFilter],
  );

  const filtered = useMemo(() =>
    activeCats.length === 0
      ? dateFiltered
      : dateFiltered.filter(t => activeCats.includes(t.category_id)),
    [dateFiltered, activeCats],
  );

  const catTotals = useMemo(() =>
    filtered.reduce<Record<string, number>>((acc, t) => {
      acc[t.category_id] = (acc[t.category_id] ?? 0) + convert(t.amount, t.currency); return acc;
    }, {}),
    [filtered, convert, rates],
  );

  const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const maxCat  = sortedCats[0]?.[1] ?? 1;

  // Top 3 cats by spend (for chip preview)
  const topCatIds = useMemo(() =>
    Object.entries(
      dateFiltered.reduce<Record<string, number>>((acc, t) => {
        acc[t.category_id] = (acc[t.category_id] ?? 0) + convert(t.amount, t.currency); return acc;
      }, {}),
    )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id),
    [dateFiltered, convert, rates],
  );

  const { bars: compBars, title: chartTitle } = useMemo(
    () => buildComparisonBars(expenses, dateFilter, activeCats),
    [expenses, dateFilter, activeCats, rates],
  );
  const maxBar = Math.max(...compBars.map(b => b.amount), 1);

  const exportCsv = async () => {
    const header = 'Date,Merchant,Category,Amount,Currency,Note\n';
    const rows = filtered.map(t =>
      `"${t.date}","${t.merchant}","${catMap[t.category_id]?.name ?? t.category_id}","${t.amount}","${t.currency}","${t.note ?? ''}"`
    ).join('\n');
    const path = FileSystem.cacheDirectory + 'tally-export.csv';
    await FileSystem.writeAsStringAsync(path, header + rows, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export expenses' });
  };

  const total = filtered.reduce((s, t) => s + convert(t.amount, t.currency), 0);

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingTop: 8, paddingBottom: 6 }}>
          <Text style={{ fontFamily: C.fonts.serif, fontSize: 38, color: C.cream, letterSpacing: -0.5 }}>
            Reports
          </Text>
          <Text style={{ fontFamily: C.fonts.serifItalic, color: C.muted, marginTop: 6, fontSize: 18 }}>
            your money, examined
          </Text>
        </View>

        {/* ── Date range row ── */}
        <SectionHeader title="Date range"/>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: 6, paddingRight: 4 }}
          >
            {QUICK_RANGES.map(id => {
              const label = RANGES.find(r => r.id === id)!.label;
              const on = dateFilter.rangeId === id;
              return (
                <Tap
                  key={id}
                  onPress={() => setDateFilter({ rangeId: id, customFrom: '', customTo: '' })}
                  style={[sh.pill, {
                    backgroundColor: on ? C.sage : C.surface,
                    borderColor: on ? C.sage : C.hair,
                  }]}
                >
                  <Text style={{ fontSize: 12, fontFamily: C.fonts.regular, color: on ? '#0E0E0C' : C.cream }}>
                    {label}
                  </Text>
                </Tap>
              );
            })}
            {/* Show active range chip if it's not one of the quick 3 */}
            {!QUICK_RANGES.includes(dateFilter.rangeId) && (
              <Tap
                onPress={() => setDateSheetOpen(true)}
                style={[sh.pill, { backgroundColor: C.sage, borderColor: C.sage }]}
              >
                <Text style={{ fontSize: 12, fontFamily: C.fonts.regular, color: '#0E0E0C' }}>
                  {dateLabel(dateFilter)}
                </Text>
              </Tap>
            )}
          </ScrollView>
          {/* Filter icon */}
          <FilterIconBtn
            active={!QUICK_RANGES.includes(dateFilter.rangeId)}
            onPress={() => setDateSheetOpen(true)}
            C={C}
          />
        </View>

        {/* ── Category row ── */}
        <SectionHeader title="Categories"/>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: 6, paddingRight: 4 }}
          >
            {topCatIds.map(id => {
              const cat = catMap[id];
              if (!cat) return null;
              const on = activeCats.length === 0 || activeCats.includes(id);
              return (
                <Tap
                  key={id}
                  onPress={() => {
                    setActiveCats(prev =>
                      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
                    );
                  }}
                  style={[sh.pill, {
                    backgroundColor: on ? `${cat.color}38` : C.surface,
                    borderColor: on ? cat.color : C.hair,
                    flexDirection: 'row', alignItems: 'center', gap: 5,
                  }]}
                >
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: on ? cat.color : C.muted }}/>
                  <Text style={{ fontSize: 12, fontFamily: C.fonts.regular, color: on ? cat.color : C.muted }}>
                    {cat.name}
                  </Text>
                </Tap>
              );
            })}
          </ScrollView>
          {/* Filter icon */}
          <FilterIconBtn
            active={activeCats.length > 0}
            onPress={() => setCatSheetOpen(true)}
            C={C}
          />
        </View>

        {/* Summary stat */}
        {filtered.length > 0 && (
          <Card style={{ marginTop: 20, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.05 }}>
                Total spent
              </Text>
              <Text style={{ fontFamily: C.fonts.serif, fontSize: 30, color: C.cream, marginTop: 4 }}>
                {fmt(total, preferredCurrency)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.05 }}>
                Transactions
              </Text>
              <Text style={{ fontFamily: C.fonts.serif, fontSize: 30, color: C.cream, marginTop: 4 }}>
                {filtered.length}
              </Text>
            </View>
          </Card>
        )}

        {/* Recap teaser */}
        <Tap onPress={() => setRecapOpen(true)} style={{ marginTop: 16 }}>
          <View style={{ backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hairStrong, borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.sageGlow, borderWidth: 0.5, borderColor: C.sageDeep, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="sparkles" size={22} stroke={C.sage} sw={1.4}/>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: C.sage, letterSpacing: 0.05, textTransform: 'uppercase', marginBottom: 2 }}>
                {RANGES.find(r => r.id === dateFilter.rangeId)?.label ?? 'Range'} recap · ready
              </Text>
              <Text style={{ fontFamily: C.fonts.serif, fontSize: 18, color: C.cream }}>
                See your <Text style={{ fontStyle: 'italic' }}>spending breakdown</Text>.
              </Text>
            </View>
            <Icon name="chev-r" size={18} stroke={C.muted}/>
          </View>
        </Tap>

        {/* Comparison bar chart */}
        <SectionHeader title={chartTitle}/>
        <Card style={{ padding: 22 }}>
          {/* Δ annotation */}
          {(() => {
            const cur  = compBars.find(b => b.isCurrent)?.amount  ?? 0;
            const prev = compBars[compBars.length - 2]?.amount ?? 0;
            const pct  = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
            return pct != null ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 }}>
                <View style={{
                  paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
                  backgroundColor: pct <= 0 ? C.sageGlow : `${C.rose}22`,
                }}>
                  <Text style={{ fontSize: 12, fontFamily: C.fonts.regular, color: pct <= 0 ? C.sage : C.rose }}>
                    {pct > 0 ? `↑ ${pct}%` : pct < 0 ? `↓ ${Math.abs(pct)}%` : '= 0%'} vs previous
                  </Text>
                </View>
              </View>
            ) : null;
          })()}

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12, height: 130 }}>
            {compBars.map((bar, i) => {
              const h = maxBar > 0 ? Math.max((bar.amount / maxBar) * 100, bar.amount > 0 ? 4 : 0) : 0;
              return (
                <View key={i} style={{ flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 0 }}>
                  {/* Amount label */}
                  <Text style={{
                    fontSize: 11,
                    color: bar.isCurrent ? C.cream : C.muted,
                    marginBottom: 6,
                    marginTop: 'auto' as any,
                  }}>
                    {bar.amount > 0 ? fmt(bar.amount, preferredCurrency).replace(/\.00$/, '') : '—'}
                  </Text>
                  {/* Bar */}
                  <View style={{
                    width: '100%', borderRadius: 8,
                    backgroundColor: bar.isCurrent ? C.sage : C.surface2,
                    height: `${h}%` as any,
                    minHeight: bar.amount > 0 ? 6 : 0,
                    opacity: bar.isCurrent ? 1 : 0.55,
                  }}/>
                  {/* Label row */}
                  <View style={{ alignItems: 'center', marginTop: 8, gap: 1 }}>
                    <Text style={{
                      fontSize: 12,
                      fontFamily: bar.isCurrent ? C.fonts.semibold : C.fonts.regular,
                      color: bar.isCurrent ? C.cream : C.muted,
                    }}>
                      {bar.label}
                    </Text>
                    {bar.sublabel && (
                      <Text style={{ fontSize: 10, color: C.subtle }}>{bar.sublabel}</Text>
                    )}
                  </View>
                </View>
              );
            })}
            {compBars.every(b => b.amount === 0) && (
              <View style={{ position: 'absolute', inset: 0 as any, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: C.muted, fontStyle: 'italic' }}>No data for these periods</Text>
              </View>
            )}
          </View>
        </Card>

        {/* By category */}
        <SectionHeader title="By category"/>
        <Card style={{ padding: 18 }}>
          {sortedCats.map(([id, val], i) => {
            const meta = catMap[id];
            if (!meta) return null;
            return (
              <View key={id} style={{ paddingVertical: 10, borderBottomWidth: i === sortedCats.length - 1 ? 0 : 0.5, borderBottomColor: C.hair }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: meta.color }}/>
                    <Text style={{ fontSize: 14, color: C.cream }}>{meta.name}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 13, color: C.cream }}>{fmt(val, preferredCurrency)}</Text>
                    <Text style={{ fontSize: 11, color: C.muted }}>{Math.round(val / (total || 1) * 100)}%</Text>
                  </View>
                </View>
                <View style={{ height: 4, backgroundColor: C.surface2, borderRadius: 2, overflow: 'hidden' }}>
                  <View style={{ height: '100%', width: `${(val / maxCat) * 100}%`, backgroundColor: meta.color, borderRadius: 2 }}/>
                </View>
              </View>
            );
          })}
          {sortedCats.length === 0 && (
            <Text style={{ color: C.muted, fontStyle: 'italic', textAlign: 'center', padding: 16 }}>
              No data for this range
            </Text>
          )}
        </Card>

        {/* Export */}
        <SectionHeader title="Export"/>
        <Card style={{ padding: 4 }}>
          <SettingsRow icon={<Icon name="export" size={18} stroke={C.cream}/>}  label="Export as .csv"  detail="Plain text"    onPress={exportCsv}/>
          <SettingsRow icon={<Icon name="doc"    size={18} stroke={C.muted}/>}  label="Export as .xlsx" detail="Coming soon"   onPress={() => Alert.alert('Coming in v1.1')}/>
          <SettingsRow icon={<Icon name="doc"    size={18} stroke={C.muted}/>}  label="Export as PDF"   detail="Coming soon"   onPress={() => Alert.alert('Coming in v1.1')}/>
          <SettingsRow icon={<Icon name="image"  size={18} stroke={C.muted}/>}  label="Download .zip"   detail="Coming soon"   onPress={() => Alert.alert('Coming in v1.1')} isLast/>
        </Card>
      </ScrollView>

      {/* ── Sheets ── */}
      <DateRangeSheet
        open={dateSheetOpen}
        current={dateFilter}
        onApply={(f) => { setDateFilter(f); setDateSheetOpen(false); }}
        onClose={() => setDateSheetOpen(false)}
      />
      <CategorySheet
        open={catSheetOpen}
        selected={activeCats}
        categories={categories.filter(c => !c.archived)}
        catTotalsAll={dateFiltered.reduce<Record<string, number>>((acc, t) => {
          acc[t.category_id] = (acc[t.category_id] ?? 0) + convert(t.amount, t.currency); return acc;
        }, {})}
        onApply={(cats) => { setActiveCats(cats); setCatSheetOpen(false); }}
        onClose={() => setCatSheetOpen(false)}
      />
      <RecapModal
        open={recapOpen}
        onClose={() => setRecapOpen(false)}
        dateFilter={dateFilter}
      />
    </>
  );
}

// ─── Filter icon button ───────────────────────────────────────────────────────

function FilterIconBtn({ active, onPress, C }: { active: boolean; onPress: () => void; C: any }) {
  return (
    <Tap
      onPress={onPress}
      haptic
      style={{
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: active ? C.sage : C.surface,
        borderWidth: 0.5, borderColor: active ? C.sage : C.hair,
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {active ? (
        <Icon name="filter" size={15} stroke="#0E0E0C" sw={2}/>
      ) : (
        <View style={{ gap: 3.5, alignItems: 'center' }}>
          <View style={{ width: 14, height: 1.5, backgroundColor: C.cream, borderRadius: 1 }}/>
          <View style={{ width: 10, height: 1.5, backgroundColor: C.cream, borderRadius: 1 }}/>
          <View style={{ width: 6,  height: 1.5, backgroundColor: C.cream, borderRadius: 1 }}/>
        </View>
      )}
      {active && (
        <View style={{ position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4, backgroundColor: '#0E0E0C' }}/>
      )}
    </Tap>
  );
}

// ─── Date Range Sheet ─────────────────────────────────────────────────────────

function DateRangeSheet({
  open, current, onApply, onClose,
}: {
  open: boolean;
  current: DateFilter;
  onApply: (f: DateFilter) => void;
  onClose: () => void;
}) {
  const C = useTheme();
  const [local, setLocal] = useState<DateFilter>(current);
  React.useEffect(() => { if (open) setLocal(current); }, [open]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Sheet open={open} onClose={onClose}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Text style={{ fontFamily: C.fonts.serif, fontSize: 26, color: C.cream }}>Date range</Text>
        <Tap onPress={() => { setLocal({ rangeId: 'month', customFrom: '', customTo: '' }); }}>
          <Text style={{ fontSize: 13, color: C.muted }}>Reset</Text>
        </Tap>
      </View>

      {/* Preset pills */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {RANGES.map(r => {
          const on = local.rangeId === r.id;
          return (
            <Pressable
              key={r.id}
              onPress={() => setLocal(f => ({ ...f, rangeId: r.id }))}
              style={[sh.pill, { backgroundColor: on ? C.sage : C.surface, borderColor: on ? C.sage : C.hair }]}
            >
              <Text style={{ fontSize: 13, fontFamily: C.fonts.regular, color: on ? '#0E0E0C' : C.cream }}>
                {r.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setLocal(f => ({ ...f, rangeId: 'custom' }))}
          style={[sh.pill, {
            backgroundColor: local.rangeId === 'custom' ? C.sage : C.surface,
            borderColor: local.rangeId === 'custom' ? C.sage : C.hair,
          }]}
        >
          <Text style={{ fontSize: 13, fontFamily: C.fonts.regular, color: local.rangeId === 'custom' ? '#0E0E0C' : C.cream }}>
            Custom range
          </Text>
        </Pressable>
      </View>

      {/* Custom inputs */}
      {local.rangeId === 'custom' && (
        <View style={{ gap: 12, marginBottom: 24 }}>
          <DateInput
            label="From"
            value={local.customFrom}
            onChange={v => setLocal(f => ({ ...f, customFrom: v }))}
            placeholder={`e.g. ${today}`}
            C={C}
          />
          <DateInput
            label="To"
            value={local.customTo}
            onChange={v => setLocal(f => ({ ...f, customTo: v }))}
            placeholder={`e.g. ${today}`}
            C={C}
          />
        </View>
      )}

      {/* Apply */}
      <Tap onPress={() => onApply(local)} haptic style={{ backgroundColor: C.sage, borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}>
        <Text style={{ color: '#0E0E0C', fontFamily: C.fonts.semibold, fontSize: 15 }}>Apply</Text>
      </Tap>
    </Sheet>
  );
}

function DateInput({ label, value, onChange, placeholder, C }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; C: any }) {
  return (
    <View>
      <Text style={{ fontSize: 11, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.05, marginBottom: 8 }}>
        {label}
      </Text>
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
        borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
      }}>
        <Icon name="chev-r" size={14} stroke={C.muted}/>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={C.subtle}
          style={{ flex: 1, fontSize: 14, color: C.cream, fontFamily: C.fonts.regular }}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />
      </View>
    </View>
  );
}

// ─── Category Sheet ───────────────────────────────────────────────────────────

function CategorySheet({
  open, selected, categories, catTotalsAll, onApply, onClose,
}: {
  open: boolean;
  selected: string[];
  categories: { id: string; name: string; color: string }[];
  catTotalsAll: Record<string, number>;
  onApply: (cats: string[]) => void;
  onClose: () => void;
}) {
  const C = useTheme();
  const { preferredCurrency } = useSettings();
  const [local, setLocal] = useState<string[]>(selected);
  React.useEffect(() => { if (open) setLocal(selected); }, [open]);

  // Sort by spending desc
  const sorted = [...categories].sort((a, b) =>
    (catTotalsAll[b.id] ?? 0) - (catTotalsAll[a.id] ?? 0)
  );
  const maxAmt = Math.max(...sorted.map(c => catTotalsAll[c.id] ?? 0), 1);

  function toggle(id: string) {
    setLocal(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  }

  return (
    <Sheet open={open} onClose={onClose}>
      {/* Header */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Text style={{ fontFamily: C.fonts.serif, fontSize: 26, color: C.cream }}>Categories</Text>
        <Tap onPress={() => setLocal([])}>
          <Text style={{ fontSize: 13, color: C.muted }}>All</Text>
        </Tap>
      </View>

      {/* Category rows with mini bar */}
      <View style={{ gap: 10, marginBottom: 28 }}>
        {sorted.map(cat => {
          const on = local.length === 0 || local.includes(cat.id);
          const amt = catTotalsAll[cat.id] ?? 0;
          const barW = (amt / maxAmt) * 100;
          return (
            <Pressable key={cat.id} onPress={() => toggle(cat.id)} style={[
              sh.catRow,
              {
                backgroundColor: local.includes(cat.id) ? `${cat.color}18` : C.surface,
                borderColor: local.includes(cat.id) ? cat.color : C.hair,
              },
            ]}>
              {/* Checkbox */}
              <View style={[sh.check, {
                borderColor: local.includes(cat.id) ? cat.color : C.subtle,
                backgroundColor: local.includes(cat.id) ? cat.color : 'transparent',
              }]}>
                {local.includes(cat.id) && (
                  <Icon name="check" size={10} stroke="#0E0E0C" sw={3}/>
                )}
              </View>

              {/* Name + bar */}
              <View style={{ flex: 1, gap: 5 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 14, color: on ? cat.color : C.muted, fontFamily: C.fonts.regular }}>
                    {cat.name}
                  </Text>
                  {amt > 0 && (
                    <Text style={{ fontSize: 13, color: on ? C.cream : C.subtle }}>{fmt(amt, preferredCurrency)}</Text>
                  )}
                </View>
                {amt > 0 && (
                  <View style={{ height: 3, backgroundColor: C.surface2, borderRadius: 2, overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${barW}%`, backgroundColor: cat.color, opacity: on ? 1 : 0.3, borderRadius: 2 }}/>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Apply */}
      <Tap onPress={() => onApply(local)} haptic style={{ backgroundColor: C.sage, borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}>
        <Text style={{ color: '#0E0E0C', fontFamily: C.fonts.semibold, fontSize: 15 }}>
          {local.length === 0 ? 'Show all categories' : `Show ${local.length} categor${local.length === 1 ? 'y' : 'ies'}`}
        </Text>
      </Tap>
    </Sheet>
  );
}

// ─── Shared Sheet wrapper ─────────────────────────────────────────────────────

function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const C = useTheme();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <BlurView intensity={40} tint="dark" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose}/>
        <View style={[sh.sheet, { backgroundColor: C.bgElev, borderColor: C.hairStrong }]}>
          <View style={[sh.grabber, { backgroundColor: C.subtle }]}/>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }}
          >
            {children}
          </ScrollView>
        </View>
      </BlurView>
    </Modal>
  );
}

// ─── Reusable components ─────────────────────────────────────────────────────

export function SectionHeader({ title, action }: { title: string; action?: string }) {
  const C = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 24, paddingBottom: 12 }}>
      <Text style={{ fontFamily: C.fonts.serif, fontSize: 22, color: C.cream, letterSpacing: -0.2 }}>{title}</Text>
      {action && <Text style={{ fontSize: 13, color: C.muted }}>{action}</Text>}
    </View>
  );
}

export function SettingsRow({
  icon, label, detail, isLast, onPress, control,
}: {
  icon?: React.ReactNode;
  label: string;
  detail?: string;
  isLast?: boolean;
  onPress?: () => void;
  control?: React.ReactNode;
}) {
  const C = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.6 : 1} style={{
      flexDirection: 'row', alignItems: 'center', gap: 14,
      padding: 14, paddingHorizontal: 16,
      borderBottomWidth: isLast ? 0 : 0.5, borderBottomColor: C.hair,
    }}>
      {icon && (
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </View>
      )}
      <Text style={{ flex: 1, fontSize: 14, color: C.cream }}>{label}</Text>
      {detail && <Text style={{ fontSize: 13, color: C.muted }}>{detail}</Text>}
      {control}
      {onPress && !control && <Icon name="chev-r" size={14} stroke={C.subtle}/>}
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sh = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 999, borderWidth: 0.5,
  },
  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 0.5,
  },
  check: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderWidth: 0.5, paddingTop: 12, maxHeight: '85%' as any,
  },
  grabber: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 16,
  },
});

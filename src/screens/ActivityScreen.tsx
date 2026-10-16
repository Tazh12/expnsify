import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, Modal, Pressable,
  TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { useTheme } from '../theme';
import { Card, Icon, Tap, TxnRow, PageHeader } from '../components';
import { useExpenses, type Expense } from '../store/useExpenses';
import { useCategories } from '../store/useCategories';
import { useBudget } from '../store/useBudget';
import { useRates } from '../store/useRates';
import { useSettings } from '../store/useSettings';
import { fmt, dayLabel, parseLocalDate, toLocalDateISO } from '../services/format';
import { isUnbudgeted, lineActual, expenseMatchesLine } from '../services/budget';
import { monthKey } from '../services/month';
import { useViewMonth } from '../store/useViewMonth';
import { useBudgetGroups } from '../store/useBudgetGroups';
import { DatePicker } from '../components/DatePicker';
import { TxnDetailModal } from './TxnDetailModal';
import { AddSheet } from '../flows/AddSheet';
import { askTally, AiLimitError } from '../services/groq';

// ─── Types ────────────────────────────────────────────────────────────────────

type DateRange = 'all' | 'today' | 'week' | 'month' | 'custom';

interface Filters {
  dateRange: DateRange;
  customFrom: string;
  customTo: string;
  lineIds: string[];
  merchants: string[];
}

const EMPTY_FILTERS: Filters = {
  dateRange: 'all',
  customFrom: '',
  customTo: '',
  lineIds: [],
  merchants: [],
};

type Quick = 'needs' | 'expense' | 'income' | null;

function filtersActive(f: Filters) {
  return f.dateRange !== 'all' || f.lineIds.length > 0 || f.merchants.length > 0;
}

function matchesQuery(t: Expense, q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  if (t.merchant.toLowerCase().includes(needle)) return true;
  if (t.note?.toLowerCase().includes(needle)) return true;
  return (t.line_items ?? []).some(item => item.name.toLowerCase().includes(needle));
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function ActivityScreen() {
  const C = useTheme();
  const { expenses, byDay, remove } = useExpenses();
  const { categories } = useCategories();
  const { lines } = useBudget();
  const groups = useBudgetGroups(s => s.all);
  const month = useViewMonth(s => s.month);
  const monthKeyValue = monthKey(month);
  const { convert } = useRates();
  const { preferredCurrency } = useSettings();
  const catMap = {
    ...Object.fromEntries(categories.map(c => [c.id, c])),
    ...Object.fromEntries(lines.map(l => [l.templateKey, { name: l.name, color: l.color }])),
    ...Object.fromEntries(lines.map(l => [l.id, { name: l.name, color: l.color }])),
  };

  const [q, setQ] = useState('');
  const [asking, setAsking] = useState(false);
  const [askedIds, setAskedIds] = useState<string[] | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [allTime, setAllTime] = useState(false);
  const [quick, setQuick] = useState<Quick>(null);
  const [detailExpense, setDetailExpense] = useState<Expense | null>(null);
  const [editTarget, setEditTarget] = useState<Expense | null>(null);
  const detailCategory = detailExpense
    ? (categories.find(c => c.id === detailExpense.category_id)
      ?? (() => {
        const line = lines.find(l => l.id === detailExpense.line_id || l.templateKey === detailExpense.category_id);
        return line ? { id: line.id, name: line.name, color: line.color, source: 'user' as const, sort_order: 0, archived: 0 } : null;
      })())
    : null;

  const filtered = useMemo(() => {
    const now = new Date();
    return expenses.filter(t => {
      // Text search
      if (askedIds) {
        if (!askedIds.includes(t.id)) return false;
      } else if (q && !matchesQuery(t, q)) return false;

      if (!allTime && t.date.slice(0, 7) !== monthKeyValue) return false;

      if (quick === 'needs' && !isUnbudgeted(t, lines.filter(l => l.month === t.date.slice(0, 7)))) return false;
      if (quick === 'expense' && t.type !== 'expense') return false;
      if (quick === 'income' && t.type !== 'income') return false;

      // Date range
      const d = parseLocalDate(t.date);
      if (filters.dateRange === 'today') {
        if (d.toDateString() !== now.toDateString()) return false;
      } else if (filters.dateRange === 'week') {
        const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
        if (d < weekAgo) return false;
      } else if (filters.dateRange === 'month') {
        if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return false;
      } else if (filters.dateRange === 'custom') {
        if (filters.customFrom && d < parseLocalDate(filters.customFrom)) return false;
        if (filters.customTo) {
          const to = parseLocalDate(filters.customTo);
          to.setHours(23, 59, 59, 999);
          if (d > to) return false;
        }
      }

      if (filters.lineIds.length > 0) {
        const selected = lines.filter(l => filters.lineIds.includes(l.id));
        const hit = selected.some(l =>
          expenseMatchesLine(t, l)
          || t.line_id === l.id
          || (t.line_id == null && t.category_id === l.templateKey),
        );
        if (!hit) return false;
      }

      // Merchants
      if (filters.merchants.length > 0 && !filters.merchants.includes(t.merchant)) return false;

      return true;
    });
  }, [expenses, q, filters, askedIds, allTime, monthKeyValue, quick, lines]);

  const ask = async () => {
    const question = q.trim();
    if (!question || asking) return;
    setAsking(true);
    try {
      const ids = await askTally(question, expenses);
      setAskedIds(ids);
    } catch (e) {
      if (!(e instanceof AiLimitError)) {
        Alert.alert('Could not ask Tally', 'Try again in a moment.');
      }
    } finally {
      setAsking(false);
    }
  };

  const grouped = byDay(filtered);
  const active = filtersActive(filters);

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader title="Activity"/>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
          <QuickChip label="All time" on={allTime} onPress={() => setAllTime(v => !v)} C={C}/>
          <QuickChip label="Needs a line" on={quick === 'needs'} onPress={() => setQuick(q => q === 'needs' ? null : 'needs')} C={C}/>
          <QuickChip label="Expenses" on={quick === 'expense'} onPress={() => setQuick(q => q === 'expense' ? null : 'expense')} C={C}/>
          <QuickChip label="Income" on={quick === 'income'} onPress={() => setQuick(q => q === 'income' ? null : 'income')} C={C}/>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }}>
          <View style={{
            flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
            borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
          }}>
            <Icon name="search" size={16} stroke={C.muted}/>
            <TextInput
              value={q}
              placeholder="Search merchants, notes, items"
              onChangeText={(text) => { setQ(text); setAskedIds(null); }}
              placeholderTextColor={C.subtle}
              style={{ flex: 1, fontSize: 14, color: C.cream, fontFamily: C.fonts.regular }}
            />
            {q.length > 0 && (
              <Tap onPress={() => { setQ(''); setAskedIds(null); }}>
                <Icon name="x" size={14} stroke={C.muted}/>
              </Tap>
            )}
          </View>

          {/* Filter button */}
          <Tap
            onPress={() => setFilterOpen(true)}
            haptic
            style={{
              width: 44, height: 44, borderRadius: 14,
              backgroundColor: active ? C.sage : C.surface,
              borderWidth: 0.5, borderColor: active ? C.sage : C.hair,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <FilterIcon color={active ? '#0E0E0C' : C.cream}/>
            {active && (
              <View style={{
                position: 'absolute', top: 7, right: 7,
                width: 7, height: 7, borderRadius: 4,
                backgroundColor: '#0E0E0C',
              }}/>
            )}
          </Tap>
        </View>

        {/* Active filter chips */}
        {active && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
            {filters.dateRange !== 'all' && (
              <Chip label={DATE_LABELS[filters.dateRange]} onRemove={() => setFilters(f => ({ ...f, dateRange: 'all', customFrom: '', customTo: '' }))} C={C}/>
            )}
            {filters.lineIds.map(id => {
              const line = lines.find(l => l.id === id);
              return (
                <Chip
                  key={id}
                  label={line?.name ?? id}
                  color={line?.color}
                  onRemove={() => setFilters(f => ({ ...f, lineIds: f.lineIds.filter(x => x !== id) }))}
                  C={C}
                />
              );
            })}
            {filters.merchants.map(m => (
              <Chip key={m} label={m} onRemove={() => setFilters(f => ({ ...f, merchants: f.merchants.filter(x => x !== m) }))} C={C}/>
            ))}
            <Tap onPress={() => setFilters(EMPTY_FILTERS)}>
              <Text style={{ fontSize: 12, color: C.muted, paddingVertical: 4, paddingHorizontal: 2 }}>Clear all</Text>
            </Tap>
          </View>
        )}

        {/* Grouped transactions */}
        <View style={{ marginTop: 20 }}>
          {grouped.map(([day, items]) => {
            const dayTotal = items.reduce((a, b) => a + convert(b.amount, b.currency ?? 'USD'), 0);
            return (
              <View key={day} style={{ marginBottom: 18 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 8, paddingHorizontal: 4 }}>
                  <Text style={{ fontFamily: C.fonts.serifItalic, fontSize: 15, color: C.muted }}>{dayLabel(day)}</Text>
                  <Text style={{ fontSize: 12, color: C.subtle }}>{fmt(dayTotal, preferredCurrency)}</Text>
                </View>
                <Card style={{ overflow: 'hidden' }}>
                  {items.map((t, i) => (
                    <TxnRow
                      key={t.id}
                      t={t}
                      catMap={catMap}
                      isLast={i === items.length - 1}
                      unbudgeted={isUnbudgeted(t, lines.filter(l => l.month === t.date.slice(0, 7)))}
                      overspend={(() => {
                        const line = lines.find(l => l.id === t.line_id);
                        if (!line || line.section === 'income') return false;
                        const planned = convert(line.expected, line.currency || 'USD');
                        return lineActual(line, expenses, convert) > planned && planned > 0;
                      })()}
                      onViewDetail={(exp) => setDetailExpense(exp)}
                      onEdit={() => setEditTarget(t)}
                      onDelete={() => Alert.alert(
                        'Delete expense?',
                        `Remove "${t.merchant}" from your tally?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => remove(t.id) },
                        ],
                      )}
                    />
                  ))}
                </Card>
              </View>
            );
          })}
          {grouped.length === 0 && (
            <View style={{ padding: 48, alignItems: 'center' }}>
              <Text style={{ fontFamily: C.fonts.serifItalic, fontSize: 20, color: C.muted }}>
                {askedIds ? 'Tally didn’t find a match.' : 'nothing matches.'}
              </Text>
              {q.trim().length > 0 && !askedIds && (
                <Tap
                  onPress={ask}
                  haptic
                  style={{
                    marginTop: 16, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 14,
                    backgroundColor: C.sage,
                  }}
                >
                  {asking
                    ? <ActivityIndicator color="#0E0E0C"/>
                    : <Text style={{ color: '#0E0E0C', fontSize: 14, fontWeight: '600' }}>Ask Tally</Text>}
                </Tap>
              )}
              {q.trim().length > 0 && !askedIds && (
                <Text style={{ fontSize: 12, color: C.subtle, marginTop: 8 }}>Uses one AI action</Text>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onChange={setFilters}
        lines={lines.filter(l => l.month === monthKeyValue && l.section !== 'income')}
        groups={groups.filter(g => g.id !== 'income')}
        allMerchants={[...new Set(expenses.map(e => e.merchant))].sort()}
      />

      <TxnDetailModal
        expense={detailExpense ? (expenses.find(e => e.id === detailExpense.id) ?? detailExpense) : null}
        category={detailCategory}
        onClose={() => setDetailExpense(null)}
        onEdit={detailExpense ? () => {
          setEditTarget(detailExpense);
          setDetailExpense(null);
        } : undefined}
        onDelete={detailExpense ? () => {
          const target = detailExpense;
          Alert.alert(
            'Delete expense?',
            `Remove "${target.merchant}" from your tally?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => { remove(target.id); setDetailExpense(null); } },
            ],
          );
        } : undefined}
      />

      <AddSheet
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        editExpense={editTarget ?? undefined}
      />
    </>
  );
}

// ─── Filter Sheet ─────────────────────────────────────────────────────────────

const DATE_LABELS: Record<DateRange, string> = {
  all: 'All time',
  today: 'Today',
  week: 'Last 7 days',
  month: 'This month',
  custom: 'Custom range',
};

function FilterSheet({
  open, onClose, filters, onChange, lines, groups, allMerchants,
}: {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  onChange: (f: Filters) => void;
  lines: { id: string; name: string; color: string; section: string }[];
  groups: { id: string; label: string }[];
  allMerchants: string[];
}) {
  const C = useTheme();
  const [local, setLocal] = useState<Filters>(filters);
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);

  React.useEffect(() => { if (open) setLocal(filters); }, [open]);

  function apply() { onChange(local); onClose(); }
  function reset() { setLocal(EMPTY_FILTERS); onChange(EMPTY_FILTERS); onClose(); }

  function toggleLine(id: string) {
    setLocal(f => ({
      ...f,
      lineIds: f.lineIds.includes(id) ? f.lineIds.filter(c => c !== id) : [...f.lineIds, id],
    }));
  }
  function toggleMerchant(m: string) {
    setLocal(f => ({
      ...f,
      merchants: f.merchants.includes(m) ? f.merchants.filter(x => x !== m) : [...f.merchants, m],
    }));
  }

  return (
    <>
    <BottomSheet visible={open} onClose={onClose}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ fontFamily: C.fonts.serif, fontSize: 26, color: C.cream }}>Filters</Text>
              <Tap onPress={reset}>
                <Text style={{ fontSize: 13, color: C.muted }}>Reset</Text>
              </Tap>
            </View>

            {/* Date range */}
            <SectionLabel title="Date range" C={C}/>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {(Object.keys(DATE_LABELS) as DateRange[]).map(key => (
                <Pressable
                  key={key}
                  onPress={() => setLocal(f => ({ ...f, dateRange: key, customFrom: key === 'custom' ? f.customFrom : '', customTo: key === 'custom' ? f.customTo : '' }))}
                  style={[
                    sh.pill,
                    { backgroundColor: local.dateRange === key ? C.sage : C.surface, borderColor: local.dateRange === key ? C.sage : C.hair },
                  ]}
                >
                  <Text style={{ fontSize: 13, fontFamily: C.fonts.regular, color: local.dateRange === key ? '#0E0E0C' : C.cream }}>
                    {DATE_LABELS[key]}
                  </Text>
                </Pressable>
              ))}
            </View>
            {local.dateRange === 'custom' && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: -8, marginBottom: 20 }}>
                <Tap onPress={() => setPicking('from')} style={[sh.pill, { backgroundColor: C.surface, borderColor: C.hair }]}>
                  <Text style={{ fontSize: 13, color: C.cream }}>{local.customFrom || 'From'}</Text>
                </Tap>
                <Tap onPress={() => setPicking('to')} style={[sh.pill, { backgroundColor: C.surface, borderColor: C.hair }]}>
                  <Text style={{ fontSize: 13, color: C.cream }}>{local.customTo || 'To'}</Text>
                </Tap>
              </View>
            )}

            <SectionLabel title="Budget lines" C={C}/>
            {groups.map(group => {
              const groupLines = lines.filter(l => l.section === group.id);
              if (groupLines.length === 0) return null;
              return (
                <View key={group.id} style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>{group.label}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {groupLines.map(line => {
                      const on = local.lineIds.includes(line.id);
                      return (
                        <Pressable
                          key={line.id}
                          onPress={() => toggleLine(line.id)}
                          style={[sh.pill, { backgroundColor: on ? `${line.color}33` : C.surface, borderColor: on ? line.color : C.hair }]}
                        >
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: line.color }}/>
                          <Text style={{ fontSize: 13, fontFamily: C.fonts.regular, color: on ? line.color : C.cream }}>
                            {line.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {/* Merchants */}
            <SectionLabel title="Merchants" C={C}/>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
              {allMerchants.slice(0, 30).map(m => {
                const on = local.merchants.includes(m);
                return (
                  <Pressable
                    key={m}
                    onPress={() => toggleMerchant(m)}
                    style={[sh.pill, { backgroundColor: on ? C.sageGlow : C.surface, borderColor: on ? C.sage : C.hair }]}
                  >
                    <Text style={{ fontSize: 13, fontFamily: C.fonts.regular, color: on ? C.sage : C.cream }} numberOfLines={1}>
                      {m}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Apply button */}
          <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
            <Tap onPress={apply} haptic style={{
              backgroundColor: C.sage, borderRadius: 14,
              paddingVertical: 15, alignItems: 'center',
            }}>
              <Text style={{ color: '#0E0E0C', fontFamily: C.fonts.semibold, fontSize: 15 }}>Apply filters</Text>
            </Tap>
          </View>
    </BottomSheet>
      <DatePicker
        visible={picking != null}
        value={parseLocalDate((picking === 'to' ? local.customTo : local.customFrom) || toLocalDateISO(new Date()))}
        presentation="sheet"
        onSelect={(d) => {
          const iso = toLocalDateISO(d);
          setLocal(f => picking === 'to' ? { ...f, customTo: iso } : { ...f, customFrom: iso });
          setPicking(null);
        }}
        onClose={() => setPicking(null)}
      />
    </>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function QuickChip({ label, on, onPress, C }: { label: string; on: boolean; onPress: () => void; C: any }) {
  return (
    <Tap
      onPress={onPress}
      style={{
        minHeight: 44, paddingHorizontal: 14, borderRadius: 22, justifyContent: 'center',
        backgroundColor: on ? C.sage : C.surface,
        borderWidth: 0.5, borderColor: on ? C.sage : C.hair,
      }}
    >
      <Text style={{ fontSize: 13, color: on ? '#0E0E0C' : C.cream }}>{label}</Text>
    </Tap>
  );
}

function SectionLabel({ title, C }: { title: string; C: any }) {
  return (
    <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase', marginBottom: 10 }}>
      {title}
    </Text>
  );
}

function Chip({ label, color, onRemove, C }: { label: string; color?: string; onRemove: () => void; C: any }) {
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: color ? `${color}22` : C.surface,
      borderWidth: 0.5, borderColor: color ?? C.hair,
      borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10,
    }}>
      {color && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }}/>}
      <Text style={{ fontSize: 12, color: color ?? C.cream, fontFamily: C.fonts.regular }}>{label}</Text>
      <Tap
        onPress={onRemove}
        accessibilityLabel={`Remove ${label}`}
        style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ fontSize: 12, color: C.muted }}>✕</Text>
      </Tap>
    </View>
  );
}

function FilterIcon({ color }: { color: string }) {
  return (
    <View style={{ gap: 4, alignItems: 'center' }}>
      <View style={{ width: 16, height: 1.5, backgroundColor: color, borderRadius: 1 }}/>
      <View style={{ width: 11, height: 1.5, backgroundColor: color, borderRadius: 1 }}/>
      <View style={{ width: 6,  height: 1.5, backgroundColor: color, borderRadius: 1 }}/>
    </View>
  );
}

const sh = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 7, paddingHorizontal: 13,
    borderRadius: 20, borderWidth: 0.5,
  },
});

import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, Modal, Pressable,
  TouchableOpacity, StyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme';
import { Card, Icon, Tap } from '../components';
import { useExpenses, type Expense } from '../store/useExpenses';
import { useCategories } from '../store/useCategories';
import { fmt, dayLabel } from '../services/format';
import { TxnRow } from './HomeScreen';
import { TxnDetailModal } from './TxnDetailModal';

// ─── Types ────────────────────────────────────────────────────────────────────

type DateRange = 'all' | 'today' | 'week' | 'month' | 'custom';

interface Filters {
  dateRange: DateRange;
  customFrom: string;   // ISO date string YYYY-MM-DD
  customTo: string;
  categories: string[]; // empty = all
  merchants: string[];  // empty = all
}

const EMPTY_FILTERS: Filters = {
  dateRange: 'all',
  customFrom: '',
  customTo: '',
  categories: [],
  merchants: [],
};

function filtersActive(f: Filters) {
  return f.dateRange !== 'all' || f.categories.length > 0 || f.merchants.length > 0;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function ActivityScreen() {
  const C = useTheme();
  const { expenses, byDay } = useExpenses();
  const { categories } = useCategories();
  const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

  const [q, setQ] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [detailExpense, setDetailExpense] = useState<Expense | null>(null);
  const detailCategory = detailExpense ? (categories.find(c => c.id === detailExpense.category_id) ?? null) : null;

  const filtered = useMemo(() => {
    const now = new Date();
    return expenses.filter(t => {
      // Text search
      if (q && !t.merchant.toLowerCase().includes(q.toLowerCase())) return false;

      // Date range
      const d = new Date(t.date);
      if (filters.dateRange === 'today') {
        if (d.toDateString() !== now.toDateString()) return false;
      } else if (filters.dateRange === 'week') {
        const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
        if (d < weekAgo) return false;
      } else if (filters.dateRange === 'month') {
        if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return false;
      } else if (filters.dateRange === 'custom') {
        if (filters.customFrom && d < new Date(filters.customFrom)) return false;
        if (filters.customTo && d > new Date(filters.customTo + 'T23:59:59')) return false;
      }

      // Categories
      if (filters.categories.length > 0 && !filters.categories.includes(t.category_id)) return false;

      // Merchants
      if (filters.merchants.length > 0 && !filters.merchants.includes(t.merchant)) return false;

      return true;
    });
  }, [expenses, q, filters]);

  const grouped = byDay(filtered);
  const active = filtersActive(filters);

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingTop: 8, paddingBottom: 6 }}>
          <Text style={{ fontFamily: C.fonts.serif, fontSize: 38, color: C.cream, lineHeight: 40, letterSpacing: -0.5 }}>
            Transactions
          </Text>
          <Text style={{ fontFamily: C.fonts.serifItalic, color: C.muted, marginTop: 6, fontSize: 18 }}>
            everything, in order
          </Text>
        </View>

        {/* Search + Filter row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }}>
          <View style={{
            flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
            borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
          }}>
            <Icon name="search" size={16} stroke={C.muted}/>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search merchants"
              placeholderTextColor={C.subtle}
              style={{ flex: 1, fontSize: 14, color: C.cream, fontFamily: C.fonts.regular }}
            />
            {q.length > 0 && (
              <Tap onPress={() => setQ('')}>
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
            {filters.categories.map(id => (
              <Chip key={id} label={catMap[id]?.name ?? id} color={catMap[id]?.color} onRemove={() => setFilters(f => ({ ...f, categories: f.categories.filter(c => c !== id) }))} C={C}/>
            ))}
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
            const dayTotal = items.reduce((a, b) => a + b.amount, 0);
            return (
              <View key={day} style={{ marginBottom: 18 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 8, paddingHorizontal: 4 }}>
                  <Text style={{ fontFamily: C.fonts.serifItalic, fontSize: 15, color: C.muted }}>{dayLabel(day)}</Text>
                  <Text style={{ fontSize: 12, color: C.subtle }}>{fmt(dayTotal)}</Text>
                </View>
                <Card style={{ overflow: 'hidden' }}>
                  {items.map((t, i) => (
                    <TxnRow
                      key={t.id}
                      t={t}
                      catMap={catMap}
                      isLast={i === items.length - 1}
                      onViewDetail={(exp) => setDetailExpense(exp as Expense)}
                    />
                  ))}
                </Card>
              </View>
            );
          })}
          {grouped.length === 0 && (
            <View style={{ padding: 60, alignItems: 'center' }}>
              <Text style={{ fontFamily: C.fonts.serifItalic, fontSize: 20, color: C.muted }}>nothing matches.</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        onChange={setFilters}
        categories={categories}
        allMerchants={[...new Set(expenses.map(e => e.merchant))].sort()}
      />

      <TxnDetailModal
        expense={detailExpense}
        category={detailCategory}
        onClose={() => setDetailExpense(null)}
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
  open, onClose, filters, onChange, categories, allMerchants,
}: {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  onChange: (f: Filters) => void;
  categories: { id: string; name: string; color: string }[];
  allMerchants: string[];
}) {
  const C = useTheme();
  const [local, setLocal] = useState<Filters>(filters);

  // Sync when opening
  React.useEffect(() => { if (open) setLocal(filters); }, [open]);

  function apply() { onChange(local); onClose(); }
  function reset() { setLocal(EMPTY_FILTERS); onChange(EMPTY_FILTERS); onClose(); }

  function toggleCat(id: string) {
    setLocal(f => ({
      ...f,
      categories: f.categories.includes(id) ? f.categories.filter(c => c !== id) : [...f.categories, id],
    }));
  }
  function toggleMerchant(m: string) {
    setLocal(f => ({
      ...f,
      merchants: f.merchants.includes(m) ? f.merchants.filter(x => x !== m) : [...f.merchants, m],
    }));
  }

  return (
    <Modal visible={open} transparent animationType="slide">
      <BlurView intensity={40} tint="dark" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose}/>
        <View style={{
          backgroundColor: C.bgElev,
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          borderWidth: 0.5, borderColor: C.hairStrong,
          paddingTop: 12, paddingBottom: 40, maxHeight: '85%' as any,
        }}>
          {/* Grabber */}
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.subtle, alignSelf: 'center', marginBottom: 16 }}/>

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
              {(Object.keys(DATE_LABELS) as DateRange[]).filter(k => k !== 'custom').map(key => (
                <Pressable
                  key={key}
                  onPress={() => setLocal(f => ({ ...f, dateRange: key, customFrom: '', customTo: '' }))}
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

            {/* Categories */}
            <SectionLabel title="Categories" C={C}/>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {categories.filter(c => !c.archived).map(cat => {
                const on = local.categories.includes(cat.id);
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => toggleCat(cat.id)}
                    style={[sh.pill, { backgroundColor: on ? `${cat.color}33` : C.surface, borderColor: on ? cat.color : C.hair }]}
                  >
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cat.color }}/>
                    <Text style={{ fontSize: 13, fontFamily: C.fonts.regular, color: on ? cat.color : C.cream }}>
                      {cat.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

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
        </View>
      </BlurView>
    </Modal>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

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
      <Tap onPress={onRemove} style={{ marginLeft: 2 }}>
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

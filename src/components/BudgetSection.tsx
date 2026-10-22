import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { amountStyle, useTheme } from '../theme';
import { Card } from './Card';
import { Tap } from './Tap';
import { Icon } from './Icon';
import { BudgetRow } from './BudgetRow';
import { fmt } from '../services/format';
import { useRates } from '../store/useRates';
import type { BudgetLine, BudgetSection } from '../store/budgetTypes';
import { SECTIONS } from '../store/budgetTypes';

const OPEN_KEY = '@tally:plan-sections-open';
const ROW_ENTER = FadeInDown.duration(260).easing(Easing.bezier(0.23, 1, 0.32, 1));
const openCache = new Map<string, boolean>();
let openLoaded = false;
let openLoading: Promise<void> | null = null;

function loadOpenMap(): Promise<void> {
  if (openLoaded) return Promise.resolve();
  if (!openLoading) {
    openLoading = AsyncStorage.getItem(OPEN_KEY).then(raw => {
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, boolean>;
        for (const [id, value] of Object.entries(parsed)) {
          if (typeof value === 'boolean') openCache.set(id, value);
        }
      }
      openLoaded = true;
    }).catch(() => {
      openLoaded = true;
    });
  }
  return openLoading;
}

function rememberOpen(section: string, open: boolean) {
  openCache.set(section, open);
  const saved: Record<string, boolean> = {};
  openCache.forEach((value, id) => { saved[id] = value; });
  AsyncStorage.setItem(OPEN_KEY, JSON.stringify(saved)).catch(() => {});
}

export function BudgetSection({
  section, label, hint, lines, actuals, preferredCurrency, onPressLine, onTogglePaid, wide, onAddLine, animateRows,
}: {
  section: BudgetSection;
  label?: string;
  hint?: string;
  lines: BudgetLine[];
  actuals: Record<string, number>;
  preferredCurrency: string;
  onPressLine: (line: BudgetLine) => void;
  onTogglePaid: (line: BudgetLine) => void;
  wide?: boolean;
  onAddLine?: () => void;
  /** Rows added after mount slide in. Off in the Plan tab, where lines change often. */
  animateRows?: boolean;
}) {
  const C = useTheme();
  const { convert } = useRates();
  const meta = SECTIONS.find(s => s.id === section);
  const title = label ?? meta?.label ?? section;
  const subtitle = hint ?? meta?.hint ?? '';
  const [open, setOpen] = useState(() => openCache.get(section) ?? true);

  useEffect(() => {
    let active = true;
    loadOpenMap().then(() => {
      if (!active) return;
      const saved = openCache.get(section);
      if (typeof saved === 'boolean') setOpen(saved);
    });
    return () => { active = false; };
  }, [section]);

  const toggle = () => {
    setOpen(current => {
      const next = !current;
      rememberOpen(section, next);
      return next;
    });
  };
  const expected = lines.reduce((s, l) => s + convert(l.expected, l.currency || 'USD'), 0);
  const actual = lines.reduce((s, l) => s + (actuals[l.id] ?? 0), 0);

  return (
    <View style={{ marginBottom: 8 }}>
      <Tap onPress={toggle} style={{
        flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
        paddingTop: 20, paddingBottom: 10, paddingHorizontal: 4,
      }}>
        <View>
          <Text style={{ fontFamily: C.fonts.serif, fontSize: 22, color: C.cream, letterSpacing: -0.2 }}>
            {title}
          </Text>
          <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{subtitle}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={{ fontSize: 12, color: C.muted, ...amountStyle('regular') }}>
            {fmt(actual, preferredCurrency)} / {fmt(expected, preferredCurrency)}
          </Text>
          <Icon name={open ? 'chev-d' : 'chev-r'} size={14} stroke={C.muted}/>
        </View>
      </Tap>

      {open && (
        <Card style={{ overflow: 'hidden' }}>
          {wide && (
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingVertical: 8, paddingHorizontal: 16,
              borderBottomWidth: 0.5, borderBottomColor: C.hair,
            }}>
              <View style={{ width: 22 }}/>
              <Text style={{ flex: 2.2, fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase' }}>Item</Text>
              <Text style={{ flex: 1, textAlign: 'right', fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase' }}>Expected</Text>
              <Text style={{ flex: 1, textAlign: 'right', fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase' }}>Actual</Text>
              <Text style={{ flex: 1, textAlign: 'right', fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase' }}>Left</Text>
              <Text style={{ width: 72, textAlign: 'right', fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase' }}>Due</Text>
              <Text style={{ width: 72, textAlign: 'right', fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase' }}>Status</Text>
            </View>
          )}
          {lines.map(line => {
            const act = actuals[line.id] ?? 0;
            const planned = convert(line.expected, line.currency || 'USD');
            const remaining = planned - act;
            const overspend = !!(line.section !== 'income' && act > planned && planned > 0);
            const row = (
              <BudgetRow
                key={line.id}
                line={line}
                actual={act}
                remaining={remaining}
                overspend={overspend}
                preferredCurrency={preferredCurrency}
                onPress={() => onPressLine(line)}
                onTogglePaid={section === 'income' ? undefined : () => onTogglePaid(line)}
                wide={wide}
              />
            );
            return animateRows
              ? <Animated.View key={line.id} entering={ROW_ENTER}>{row}</Animated.View>
              : row;
          })}
          {lines.length === 0 && (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ fontFamily: C.fonts.serifItalic, fontSize: 16, color: C.muted }}>
                nothing here yet.
              </Text>
            </View>
          )}
          {onAddLine && (
            <Tap onPress={onAddLine} haptic style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              paddingVertical: 12, paddingHorizontal: 16,
              borderTopWidth: lines.length > 0 ? 0 : 0.5, borderTopColor: C.hair,
            }}>
              <View style={{
                width: 22, height: 22, borderRadius: 11,
                borderWidth: 1.5, borderColor: C.subtle, borderStyle: 'dashed',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="plus" size={10} stroke={C.muted} sw={2}/>
              </View>
              <Text style={{ fontSize: 14, color: C.muted, fontWeight: '500' }}>Add</Text>
            </Tap>
          )}
        </Card>
      )}
    </View>
  );
}

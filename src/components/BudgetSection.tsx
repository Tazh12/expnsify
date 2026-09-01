import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme';
import { Card } from './Card';
import { Tap } from './Tap';
import { Icon } from './Icon';
import { BudgetRow } from './BudgetRow';
import { fmt } from '../services/format';
import type { BudgetLine, BudgetSection } from '../store/budgetTypes';
import { SECTIONS } from '../store/budgetTypes';

export function BudgetSection({
  section, label, hint, lines, actuals, preferredCurrency, onPressLine, onTogglePaid, wide,
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
}) {
  const C = useTheme();
  const meta = SECTIONS.find(s => s.id === section);
  const title = label ?? meta?.label ?? section;
  const subtitle = hint ?? meta?.hint ?? '';
  const [open, setOpen] = useState(true);
  const expected = lines.reduce((s, l) => s + l.expected, 0);
  const actual = lines.reduce((s, l) => s + (actuals[l.id] ?? 0), 0);

  return (
    <View style={{ marginBottom: 8 }}>
      <Tap onPress={() => setOpen(o => !o)} style={{
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
          <Text style={{ fontSize: 12, color: C.muted, fontVariant: ['tabular-nums'] }}>
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
            const remaining = line.expected - act;
            const overspend = !!(line.section !== 'income' && act > line.expected && line.expected > 0);
            return (
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
          })}
          {lines.length === 0 && (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ fontFamily: C.fonts.serifItalic, fontSize: 16, color: C.muted }}>
                nothing here yet.
              </Text>
            </View>
          )}
        </Card>
      )}
    </View>
  );
}

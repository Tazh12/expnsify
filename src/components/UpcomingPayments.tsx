import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme';
import { Card } from './Card';
import { Tap } from './Tap';
import { Icon } from './Icon';
import { fmt } from '../services/format';
import { useRates } from '../store/useRates';
import { ordinalDay } from '../services/notifications';
import { upcomingLines } from '../services/budget';
import type { BudgetLine } from '../store/budgetTypes';

export function UpcomingPayments({
  lines, onPress, preferredCurrency,
}: {
  lines: BudgetLine[];
  onPress: (line: BudgetLine) => void;
  preferredCurrency: string;
}) {
  const C = useTheme();
  const { convert } = useRates();
  const upcoming = upcomingLines(lines, 4);
  if (upcoming.length === 0) return null;

  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontFamily: C.fonts.serif, fontSize: 22, color: C.cream, letterSpacing: -0.2, paddingTop: 8, paddingBottom: 10 }}>
        Upcoming
      </Text>
      <Card style={{ overflow: 'hidden' }}>
        {upcoming.map((line, i) => (
          <Tap
            key={line.id}
            onPress={() => onPress(line)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              paddingVertical: 12, paddingHorizontal: 16,
              borderBottomWidth: i === upcoming.length - 1 ? 0 : 0.5,
              borderBottomColor: C.hair,
            }}
          >
            <View style={{
              width: 40, alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.04, textTransform: 'uppercase' }}>
                {line.dueDay != null ? ordinalDay(line.dueDay) : '—'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, color: C.cream, fontWeight: '500' }}>{line.name}</Text>
              <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                {line.automated ? 'Auto-pay' : 'You pay'} · {fmt(convert(line.expected, line.currency || 'USD'), preferredCurrency)}
              </Text>
            </View>
            <Icon name="chev-r" size={14} stroke={C.subtle}/>
          </Tap>
        ))}
      </Card>
    </View>
  );
}

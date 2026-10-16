import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme';
import { Tap } from './Tap';
import { Icon } from './Icon';
import { fmt } from '../services/format';
import { useRates } from '../store/useRates';
import { ordinalDay } from '../services/notifications';
import { repeatHint, type BudgetLine } from '../store/budgetTypes';

export function BudgetRow({
  line, actual, remaining, overspend, preferredCurrency, onPress, onTogglePaid, wide,
}: {
  line: BudgetLine;
  actual: number;
  remaining: number;
  overspend: boolean;
  preferredCurrency: string;
  onPress: () => void;
  onTogglePaid?: () => void;
  wide?: boolean;
}) {
  const C = useTheme();
  const { convert } = useRates();
  const isIncome = line.section === 'income';
  const planned = convert(line.expected, line.currency || 'USD');
  const left = isIncome ? actual - planned : planned - actual;
  const leftColor = overspend ? C.rose : left === 0 && !isIncome ? C.muted : C.cream;
  const due = line.dueDay != null ? ordinalDay(line.dueDay) : null;
  const cadence = line.recurring ? repeatHint(line.repeatEvery ?? 'month') : null;

  if (wide) {
    return (
      <Tap onPress={onPress} style={{
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 12, paddingHorizontal: 16,
        borderBottomWidth: 0.5, borderBottomColor: C.hair,
        gap: 12,
      }}>
        {onTogglePaid && (
          <PaidCheck paid={line.paid} onPress={onTogglePaid}/>
        )}
        <View style={{ flex: 2.2, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: line.color }}/>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 15, color: C.cream, fontWeight: '500' }} numberOfLines={1}>{line.name}</Text>
            {line.observation ? (
              <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }} numberOfLines={1}>{line.observation}</Text>
            ) : null}
          </View>
        </View>
        <Text style={{ flex: 1, textAlign: 'right', fontSize: 14, color: C.muted, fontVariant: ['tabular-nums'] }}>
          {fmt(planned, preferredCurrency)}
        </Text>
        <Text style={{ flex: 1, textAlign: 'right', fontSize: 14, color: C.cream, fontVariant: ['tabular-nums'] }}>
          {fmt(actual, preferredCurrency)}
        </Text>
        <Text style={{ flex: 1, textAlign: 'right', fontSize: 14, color: leftColor, fontVariant: ['tabular-nums'] }}>
          {fmt(left, preferredCurrency)}
        </Text>
        <Text style={{ width: 72, textAlign: 'right', fontSize: 12, color: C.muted }}>
          {due ?? '—'}
        </Text>
        <Text style={{ width: 72, textAlign: 'right', fontSize: 12, color: line.paid ? C.sage : overspend ? C.rose : C.muted }}>
          {line.paid ? 'Paid' : overspend ? 'Over' : line.automated && !isIncome ? 'Auto-pay' : 'Open'}
        </Text>
      </Tap>
    );
  }

  return (
    <Tap onPress={onPress} style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 12, paddingHorizontal: 16,
      borderBottomWidth: 0.5, borderBottomColor: C.hair,
    }}>
      {onTogglePaid && <PaidCheck paid={line.paid} onPress={onTogglePaid}/>}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: line.color }}/>
          <Text style={{ flex: 1, fontSize: 15, color: C.cream, fontWeight: '500' }} numberOfLines={1}>
            {line.name}
          </Text>
        </View>
        <Text style={{ fontSize: 11, color: C.muted, marginTop: 3, marginLeft: 16 }}>
          {due ? `Due ${due}` : 'No due date'}
          {cadence ? ` · ${cadence}` : ''}
          {line.automated && !isIncome ? ' · auto-pay' : ''}
          {line.observation ? ` · ${line.observation}` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={{ fontSize: 15, color: leftColor, fontWeight: '500', fontVariant: ['tabular-nums'] }}>
          {fmt(isIncome ? actual : left, preferredCurrency)}
        </Text>
        <Text style={{ fontSize: 11, color: C.muted, marginTop: 2, fontVariant: ['tabular-nums'] }}>
          {fmt(actual, preferredCurrency)} / {fmt(planned, preferredCurrency)}
        </Text>
      </View>
    </Tap>
  );
}

function PaidCheck({ paid, onPress }: { paid: boolean; onPress: () => void }) {
  const C = useTheme();
  return (
    <Tap onPress={onPress} haptic style={{
      width: 22, height: 22, borderRadius: 6,
      borderWidth: 1.5, borderColor: paid ? C.sage : C.subtle,
      backgroundColor: paid ? C.sage : 'transparent',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {paid ? <Icon name="check" size={12} stroke="#0E0E0C" sw={3}/> : null}
    </Tap>
  );
}

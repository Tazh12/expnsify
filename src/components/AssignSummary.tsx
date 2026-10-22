import React from 'react';
import { Text } from 'react-native';
import { amountStyle, useTheme } from '../theme';
import { fmt } from '../services/format';
import { Card } from './Card';

/** The Plan tab's "Income − Assigned = left to assign" line. */
export function AssignSummary({
  income, assigned, currency,
}: {
  income: number;
  assigned: number;
  currency: string;
}) {
  const C = useTheme();
  const left = income - assigned;
  const leftColor = left < 0 ? C.alertInk : C.success;

  return (
    <Card style={{ padding: 16, marginTop: 8, marginBottom: 8 }}>
      <Text style={{ fontSize: 15, color: C.text, lineHeight: 22 }}>
        Income <Text style={amountStyle()}>{fmt(income, currency)}</Text>
        {'  −  '}
        Assigned <Text style={amountStyle()}>{fmt(assigned, currency)}</Text>
        {'  =  '}
        <Text style={{ color: leftColor, ...amountStyle('semibold') }}>
          {fmt(left, currency)}
        </Text>
        <Text style={{ color: leftColor, fontFamily: C.fonts.semibold }}> to assign</Text>
      </Text>
    </Card>
  );
}

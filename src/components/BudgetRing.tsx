import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '../theme';
import { AnimatedNumber } from './AnimatedNumber';
import { currencySymbol } from '../services/format';

export function BudgetRing({
  spent,
  assigned,
  currency,
  size = 168,
}: {
  spent: number;
  assigned: number;
  currency: string;
  size?: number;
}) {
  const C = useTheme();
  const remaining = assigned - spent;
  const over = assigned > 0 && spent > assigned;
  const progress = assigned <= 0 ? 0 : Math.min(spent / assigned, 1);
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * progress;
  const ring = over ? C.rose : C.sage;
  const center = remaining;
  const empty = assigned <= 0;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={C.hairStrong} strokeWidth={stroke} fill="none"
        />
        {!empty && progress > 0 && (
          <Circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={ring} strokeWidth={stroke} fill="none"
            strokeDasharray={`${dash} ${c - dash}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <Text style={{ fontSize: 12, color: C.muted, letterSpacing: 0.04, textTransform: 'uppercase' }}>
        {empty ? 'Plan' : over ? 'Over' : 'Left in plan'}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
        <Text style={{ fontFamily: C.fonts.serif, fontSize: 16, color: C.muted, lineHeight: 36 }}>
          {currencySymbol(currency)}
        </Text>
        <AnimatedNumber
          value={empty ? 0 : Math.abs(center)}
          duration={900}
          style={{
            fontFamily: C.fonts.serif, fontSize: 28, lineHeight: 36,
            color: empty ? C.muted : over ? C.rose : C.cream,
          }}
        />
      </View>
    </View>
  );
}

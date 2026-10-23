import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { amountStyle, useTheme } from '../theme';
import { Tap } from '../components/Tap';
import { Icon } from '../components/Icon';
import { fmt } from '../services/format';
import type { BudgetLine } from '../store/budgetTypes';
import type { ScannedExpense } from '../services/groq';

/**
 * Drawn inside the Add sheet. As its own sheet it was a second modal over that one,
 * which iOS doesn't present: the Add sheet stayed up empty, only its handle showing.
 */
export function CompletePaymentCard({
  line, scanned, preferredCurrency, onConfirm, onEdit,
}: {
  line: BudgetLine;
  scanned: ScannedExpense;
  preferredCurrency: string;
  onConfirm: () => void;
  onEdit: () => void;
}) {
  const C = useTheme();

  return (
    <View style={{ paddingBottom: 8 }}>
      <Text style={{ fontSize: 11, color: C.link, letterSpacing: 0.05, textTransform: 'uppercase', marginBottom: 8 }}>
        Payment confirmation
      </Text>
      <Text
        style={{ fontFamily: C.fonts.serif, fontSize: 24, color: C.cream, letterSpacing: -0.3 }}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        Mark {line.name} as paid?
      </Text>
      <Text style={{ fontSize: 14, color: C.muted, marginTop: 12, lineHeight: 20 }}>
        {scanned.merchant} · <Text style={amountStyle('regular')}>{fmt(scanned.amount, scanned.currency || preferredCurrency)}</Text>
        {scanned.matchConfidence != null ? ` · ${Math.round(scanned.matchConfidence * 100)}% match` : ''}
      </Text>

      <Tap onPress={onConfirm} haptic style={{ marginTop: 24 }}>
        <LinearGradient
          colors={[C.sage, C.sageDeep]}
          start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
          style={{ height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Icon name="check" size={18} stroke={C.onPrimary} sw={2.2}/>
          <Text style={{ fontSize: 15, fontWeight: '600', color: C.onPrimary }}>Mark as paid</Text>
        </LinearGradient>
      </Tap>

      <Tap onPress={onEdit} style={{ alignItems: 'center', paddingTop: 16 }}>
        <Text style={{ fontSize: 13, color: C.muted }}>Review details instead</Text>
      </Tap>
    </View>
  );
}

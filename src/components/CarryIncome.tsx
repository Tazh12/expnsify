import React from 'react';
import { View, Text } from 'react-native';
import { amountStyle, useTheme } from '../theme';
import { Card } from './Card';
import { Tap } from './Tap';
import { fmt } from '../services/format';
import { monthTitle } from '../services/month';
import { repeatCadenceLabel, type IncomeCarryOffer } from '../services/budget';

export function CarryIncomeCard({
  month,
  offers,
  preferredCurrency,
  onAdd,
  onSkip,
  onDecline,
}: {
  month: string;
  offers: IncomeCarryOffer[];
  preferredCurrency: string;
  onAdd: () => void;
  onSkip: () => void;
  onDecline: () => void;
}) {
  const C = useTheme();
  if (offers.length === 0) return null;
  const dest = monthTitle(month);
  const from = monthTitle(offers[0].sourceMonth);
  const totalTimes = offers.reduce((s, o) => s + o.count, 0);

  return (
    <Card style={{ padding: 16, marginTop: 8, marginBottom: 8 }}>
      <Text style={{ fontFamily: C.fonts.serif, fontSize: 22, color: C.cream, letterSpacing: -0.2 }}>
        Add income to {dest}?
      </Text>
      <Text style={{ fontSize: 13, color: C.muted, marginTop: 6, lineHeight: 18 }}>
        {offers.length === 1
          ? `${offers[0].name} was ${repeatCadenceLabel(offers[0].proto)} in ${from}. Add it here too?`
          : `${offers.length} paychecks from ${from} aren’t in ${dest} yet.`}
      </Text>
      <View style={{ marginTop: 12, gap: 8 }}>
        {offers.map(o => (
          <View key={o.templateKey} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
            <Text style={{ flex: 1, fontSize: 14, color: C.cream }} numberOfLines={1}>
              {o.name}
            </Text>
            <Text style={{ fontSize: 13, color: C.muted, ...amountStyle('regular') }}>
              {o.count > 1 ? `${o.count}× ` : ''}{fmt(o.expected, o.currency || preferredCurrency)}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginTop: 16 }}>
        <Tap
          onPress={onAdd}
          haptic
          accessibilityLabel={`Add income to ${dest}`}
          style={{
            flex: 1, minHeight: 44, borderRadius: 14,
            backgroundColor: C.sage, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: C.onPrimary }}>
            {offers.length === 1 && totalTimes > 1 ? `Add ${totalTimes} to ${dest}` : `Add to ${dest}`}
          </Text>
        </Tap>
        <Tap onPress={onSkip} accessibilityLabel="Not now" style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, color: C.muted }}>Not now</Text>
        </Tap>
        <Tap onPress={onDecline} accessibilityLabel="Don't add" style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={{ fontSize: 14, color: C.muted }}>Don't add</Text>
        </Tap>
      </View>
    </Card>
  );
}

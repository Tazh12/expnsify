import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { amountStyle, useTheme } from '../theme';
import { currencySymbol } from '../services/format';
import { Card } from './Card';
import { Tap } from './Tap';
import { Icon } from './Icon';

/** The large amount at the top of a scanned or typed expense. Read-only without onChangeAmount. */
export function AmountCard({
  amount, currencyCode, onChangeAmount, onPressCurrency, footnote,
}: {
  amount: string;
  currencyCode: string;
  onChangeAmount?: (v: string) => void;
  onPressCurrency?: () => void;
  footnote?: string | null;
}) {
  const C = useTheme();
  const valueStyle = { ...amountStyle('semibold'), fontSize: 52, lineHeight: 64, color: C.text, flex: 1 };

  return (
    <Card style={{ padding: 20, marginBottom: 12 }}>
      <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.06, textTransform: 'uppercase' }}>Amount</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 20 }}>
        <Text style={{ fontSize: 16, color: C.muted, lineHeight: 64 }}>
          {currencySymbol(currencyCode)}
        </Text>
        {onChangeAmount ? (
          <TextInput
            value={amount}
            onChangeText={onChangeAmount}
            keyboardType="decimal-pad"
            style={valueStyle}
            placeholderTextColor={C.muted}
            placeholder="0.00"
          />
        ) : (
          <Text style={[valueStyle, !amount && { color: C.muted }]}>{amount || '0.00'}</Text>
        )}
        <Tap
          onPress={onPressCurrency}
          disabled={!onPressCurrency}
          accessibilityLabel="Change currency"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 8, minHeight: 44 }}
        >
          <Text style={{ fontSize: 13, color: C.muted }}>{currencyCode}</Text>
          <Icon name="chev-r" size={11} stroke={C.muted}/>
        </Tap>
      </View>
      {footnote ? (
        <Text style={{ fontSize: 12, color: C.muted, marginTop: 6, ...amountStyle('regular') }}>
          {footnote}
        </Text>
      ) : null}
    </Card>
  );
}

export function ReviewRow({ label, value, onEdit, onPress, muted, last }: { label: string; value: string; onEdit?: (v: string) => void; onPress?: () => void; muted?: boolean; last?: boolean }) {
  const C = useTheme();
  const [editing, setEditing] = useState(false);

  return (
    <TouchableOpacity
      onPress={() => (onPress ? onPress() : setEditing(true))}
      disabled={!onPress && !onEdit}
      style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 14, paddingHorizontal: 16,
        borderBottomWidth: last ? 0 : 0.5, borderBottomColor: C.hair,
      }}
    >
      <Text style={{ fontSize: 13, color: C.muted }}>{label}</Text>
      {editing && onEdit && !onPress ? (
        <TextInput
          value={value}
          onChangeText={onEdit}
          onBlur={() => setEditing(false)}
          autoFocus
          style={{ fontSize: 14, color: C.cream, textAlign: 'right', minWidth: 120 }}
        />
      ) : (
        <Text style={{ fontSize: 14, color: muted ? C.muted : C.cream }}>{value || '—'}</Text>
      )}
    </TouchableOpacity>
  );
}

import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { Tap } from '../components/Tap';
import { Icon } from '../components/Icon';
import { fmt } from '../services/format';
import type { BudgetLine } from '../store/budgetTypes';
import type { ScannedExpense } from '../services/groq';

export function CompletePaymentSheet({
  open, line, scanned, preferredCurrency, onConfirm, onEdit, onClose,
}: {
  open: boolean;
  line: BudgetLine | null;
  scanned: ScannedExpense | null;
  preferredCurrency: string;
  onConfirm: () => void;
  onEdit: () => void;
  onClose: () => void;
}) {
  const C = useTheme();
  if (!open || !line || !scanned) return null;

  return (
    <BottomSheet visible={open} onClose={onClose}>
      <View style={{ paddingHorizontal: 22 }}>
          <Text style={{ fontSize: 11, color: C.sage, letterSpacing: 0.05, textTransform: 'uppercase', marginBottom: 8 }}>
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
            {scanned.merchant} · {fmt(scanned.amount, scanned.currency || preferredCurrency)}
            {scanned.matchConfidence != null ? ` · ${Math.round(scanned.matchConfidence * 100)}% match` : ''}
          </Text>

          <Tap onPress={onConfirm} haptic style={{ marginTop: 24 }}>
            <LinearGradient
              colors={[C.sage, C.sageDeep]}
              start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
              style={{ height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Icon name="check" size={18} stroke="#0E0E0C" sw={2.2}/>
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#0E0E0C' }}>Mark as paid</Text>
            </LinearGradient>
          </Tap>

          <Tap onPress={onEdit} style={{ alignItems: 'center', paddingTop: 16 }}>
            <Text style={{ fontSize: 13, color: C.muted }}>Review details instead</Text>
          </Tap>
      </View>
    </BottomSheet>
  );
}

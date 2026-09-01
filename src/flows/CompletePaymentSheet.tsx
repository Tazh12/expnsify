import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
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
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={50} tint={C.isLight ? 'light' : 'dark'} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose}/>
        <View style={{
          backgroundColor: C.bgElev,
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          borderWidth: 0.5, borderColor: C.hairStrong,
          paddingTop: 12, paddingHorizontal: 22, paddingBottom: 40,
        }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.subtle, alignSelf: 'center', marginBottom: 20 }}/>
          <Text style={{ fontSize: 11, color: C.sage, letterSpacing: 0.05, textTransform: 'uppercase', marginBottom: 8 }}>
            Payment confirmation
          </Text>
          <Text style={{ fontFamily: C.fonts.serif, fontSize: 28, color: C.cream, letterSpacing: -0.3, lineHeight: 32 }}>
            Mark <Text style={{ fontStyle: 'italic' }}>{line.name}</Text> as paid?
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
      </BlurView>
    </Modal>
  );
}

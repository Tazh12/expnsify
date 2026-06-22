import React from 'react';
import {
  View, Text, Modal, ScrollView, Image, TouchableOpacity,
  StyleSheet, Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme';
import { Icon, Tap } from '../components';
import type { Expense } from '../store/useExpenses';
import type { Category } from '../store/useCategories';
import { fmt } from '../services/format';

interface Props {
  expense: Expense | null;
  category: Category | null;
  onClose: () => void;
}

function fmtFull(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function TxnDetailModal({ expense: t, category, onClose }: Props) {
  const C = useTheme();
  const [imgError, setImgError] = React.useState(false);

  if (!t) return null;

  const cat = category ?? { name: t.category_id, color: C.muted } as any;
  const hasReceipt = !!t.receipt_uri && !imgError;
  const confidencePct = t.confidence != null ? Math.round(t.confidence * 100) : null;

  return (
    <Modal visible={!!t} transparent animationType="slide" onRequestClose={onClose}>
      <BlurView intensity={50} tint="dark" style={{ flex: 1, justifyContent: 'flex-end' }}>
        {/* Tap-away dismiss */}
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose}/>

        <View style={[sh.sheet, { backgroundColor: C.bgElev, borderColor: C.hairStrong }]}>
          {/* Grabber */}
          <View style={[sh.grabber, { backgroundColor: C.subtle }]}/>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            {/* Receipt image */}
            {hasReceipt && (
              <View style={sh.imgWrap}>
                <Image
                  source={{ uri: t.receipt_uri! }}
                  style={sh.img}
                  resizeMode="cover"
                  onError={() => setImgError(true)}
                />
                {/* Gradient overlay at bottom of image */}
                <View style={[sh.imgFade, { backgroundColor: C.bgElev }]}/>
              </View>
            )}

            <View style={{ paddingHorizontal: 22, paddingTop: hasReceipt ? 0 : 8 }}>
              {/* Close button */}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: hasReceipt ? 12 : 20 }}>
                <Tap onPress={onClose} style={[sh.closeBtn, { backgroundColor: C.surface, borderColor: C.hair }]}>
                  <Icon name="x" size={14} stroke={C.muted}/>
                </Tap>
              </View>

              {/* Category badge */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <View style={[sh.catDot, { backgroundColor: cat.color }]}/>
                <Text style={{ fontSize: 12, color: cat.color, fontFamily: C.fonts.regular, letterSpacing: 0.05 }}>
                  {cat.name}
                </Text>
                {confidencePct != null && (
                  <View style={[sh.badge, { borderColor: C.hair, backgroundColor: C.surface }]}>
                    <Text style={{ fontSize: 10, color: C.muted }}>AI {confidencePct}%</Text>
                  </View>
                )}
              </View>

              {/* Merchant + amount */}
              <Text
                style={{ fontFamily: C.fonts.serif, fontSize: 30, color: C.cream, lineHeight: 34, letterSpacing: -0.4 }}
                numberOfLines={2}
              >
                {t.merchant}
              </Text>
              <Text style={{ fontFamily: C.fonts.serif, fontSize: 40, color: C.cream, marginTop: 6, letterSpacing: -1 }}>
                {fmt(t.amount)}
                <Text style={{ fontSize: 18, color: C.muted }}> {t.currency || 'USD'}</Text>
              </Text>

              {/* Date */}
              <Text style={{ fontSize: 13, color: C.muted, marginTop: 12 }}>{fmtFull(t.date)}</Text>

              {/* Divider */}
              <View style={[sh.divider, { backgroundColor: C.hair }]}/>

              {/* Note */}
              <Row
                label="Note"
                value={t.note || '—'}
                C={C}
                valueColor={t.note ? C.cream : C.subtle}
              />

              {/* Receipt */}
              <Row
                label="Receipt"
                value={t.receipt_uri ? (imgError ? 'Could not load' : 'Attached above') : 'No attachment'}
                C={C}
                valueColor={t.receipt_uri && !imgError ? C.sage : C.subtle}
              />

              {/* No receipt placeholder */}
              {!hasReceipt && !t.receipt_uri && (
                <View style={[sh.noReceiptBox, { backgroundColor: C.surface, borderColor: C.hair }]}>
                  <Icon name="receipt" size={28} stroke={C.subtle}/>
                  <Text style={{ fontSize: 13, color: C.subtle, marginTop: 8 }}>No receipt attached</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </BlurView>
    </Modal>
  );
}

function Row({
  label, value, C, valueColor,
}: {
  label: string;
  value: string;
  C: any;
  valueColor?: string;
}) {
  return (
    <View style={sh.row}>
      <Text style={{ fontSize: 12, color: C.muted, width: 80 }}>{label}</Text>
      <Text style={{ flex: 1, fontSize: 14, color: valueColor ?? C.cream }}>{value}</Text>
    </View>
  );
}

const sh = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 0.5,
    paddingTop: 12,
    maxHeight: '88%' as any,
    overflow: 'hidden',
  },
  grabber: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: 4,
  },
  imgWrap: {
    width: '100%',
    height: 260,
    position: 'relative',
  },
  img: {
    width: '100%',
    height: '100%',
  },
  imgFade: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 60,
    opacity: 0.85,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 0.5,
    alignItems: 'center', justifyContent: 'center',
  },
  catDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  badge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 10, borderWidth: 0.5,
  },
  divider: {
    height: 0.5, marginVertical: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  noReceiptBox: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 0.5,
    borderStyle: 'dashed',
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

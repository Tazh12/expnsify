import React from 'react';
import {
  View, Text, Modal, ScrollView, Image, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTheme } from '../theme';
import { Icon, Tap } from '../components';
import { useExpenses, type Expense } from '../store/useExpenses';
import type { Category } from '../store/useCategories';
import { useRates } from '../store/useRates';
import { useSettings } from '../store/useSettings';
import { useAuth } from '../store/useAuth';
import { fmt, parseLocalDate } from '../services/format';
import { isDurableReceiptUri, RECEIPT_STORAGE_ENABLED } from '../services/receiptUri';
import { uploadReceipt } from '../services/receipts';

interface Props {
  expense: Expense | null;
  category: Category | null;
  onClose: () => void;
}

function fmtFull(iso: string) {
  const d = parseLocalDate(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function TxnDetailModal({ expense: t, category, onClose }: Props) {
  const C = useTheme();
  const [imgError, setImgError] = React.useState(false);
  const [attaching, setAttaching] = React.useState(false);

  React.useEffect(() => {
    setImgError(false);
  }, [t?.id, t?.receipt_uri]);

  const attachReceipt = async () => {
    if (!t || attaching || !RECEIPT_STORAGE_ENABLED) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Photo library access needed', 'Please enable photo library access in Settings to attach a receipt.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.5,
      mediaTypes: ['images'],
    });
    if (result.canceled || !result.assets[0]) return;
    setAttaching(true);
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      const { user } = useAuth.getState();
      const uri = await uploadReceipt(manipulated.uri, user?.uid);
      if (!uri) {
        Alert.alert(
          'Could not save receipt',
          'The photo could not be stored. Sign in and try again after Storage is enabled.',
        );
        return;
      }
      await useExpenses.getState().update(t.id, { receipt_uri: uri });
      setImgError(false);
    } catch (e) {
      console.error('attachReceipt failed', e);
      Alert.alert('Could not save receipt', 'Please try again.');
    } finally {
      setAttaching(false);
    }
  };

  if (!t) return null;

  const { convert } = useRates.getState();
  const { preferredCurrency } = useSettings.getState();
  const convertedAmount = convert(t.amount, t.currency ?? 'USD');
  const showOriginal = !!t.currency && t.currency !== preferredCurrency;

  const cat = category ?? { name: t.category_id, color: C.muted } as any;
  const displayUri = isDurableReceiptUri(t.receipt_uri) ? t.receipt_uri : null;
  const hasReceipt = !!displayUri && !imgError;
  const lostReceipt = !!t.receipt_uri && !displayUri;
  const isPdf = (displayUri ?? '').toLowerCase().includes('.pdf');
  const receiptLabel = hasReceipt
    ? (isPdf ? 'PDF attached' : 'Attached above')
    : RECEIPT_STORAGE_ENABLED
      ? (lostReceipt || imgError ? 'Not saved — tap to add' : 'No attachment')
      : 'Not stored';

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
            {hasReceipt && !isPdf && (
              <View style={sh.imgWrap}>
                <Image
                  source={{ uri: displayUri! }}
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
              </View>

              {/* Merchant + amount */}
              <Text
                style={{ fontFamily: C.fonts.serif, fontSize: 30, color: C.cream, lineHeight: 34, letterSpacing: -0.4 }}
                numberOfLines={2}
              >
                {t.merchant}
              </Text>
              <Text style={{ fontFamily: C.fonts.serif, fontSize: 40, color: C.cream, marginTop: 6, letterSpacing: -1 }}>
                {fmt(convertedAmount, preferredCurrency)}
                <Text style={{ fontSize: 18, color: C.muted }}> {preferredCurrency}</Text>
              </Text>
              {showOriginal && (
                <Text style={{ fontSize: 14, color: C.muted, marginTop: 4 }}>
                  Originally {t.currency} {t.amount.toFixed(2)}
                </Text>
              )}

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

              {(t.line_items?.length ?? 0) > 0 && (
                <View style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 12, color: C.muted, width: 80, marginBottom: 6 }}>Items</Text>
                  {t.line_items.map((item, i) => (
                    <View key={`${item.name}-${i}`} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                      <Text style={{ flex: 1, fontSize: 14, color: C.cream }} numberOfLines={1}>{item.name}</Text>
                      {item.amount > 0 && (
                        <Text style={{ fontSize: 13, color: C.muted, marginLeft: 8 }}>{item.amount.toFixed(2)}</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {t.location?.address && (
                <Row label="Near" value={t.location.address} C={C}/>
              )}

              {/* Receipt */}
              <Tap
                onPress={RECEIPT_STORAGE_ENABLED ? attachReceipt : undefined}
                style={sh.row}
              >
                <Text style={{ fontSize: 12, color: C.muted, width: 80 }}>Receipt</Text>
                {attaching ? (
                  <ActivityIndicator size="small" color={C.sage}/>
                ) : (
                  <Text style={{ flex: 1, fontSize: 14, color: hasReceipt ? C.sage : C.subtle }}>
                    {receiptLabel}
                  </Text>
                )}
              </Tap>

              {/* No receipt placeholder */}
              {!hasReceipt && (
                <View style={[sh.noReceiptBox, { backgroundColor: C.surface, borderColor: C.hair }]}>
                  <Icon name="receipt" size={28} stroke={C.subtle}/>
                  <Text style={{ fontSize: 13, color: C.subtle, marginTop: 8, textAlign: 'center' }}>
                    {RECEIPT_STORAGE_ENABLED
                      ? (lostReceipt || imgError ? 'Photo was not saved to the cloud' : 'No receipt attached')
                      : "Photos are read to fill the expense. They aren't stored yet."}
                  </Text>
                  {RECEIPT_STORAGE_ENABLED && (
                    <Tap onPress={attachReceipt}>
                      <Text style={{ fontSize: 12, color: C.sage, marginTop: 6 }}>
                        {attaching ? 'Saving…' : 'Tap to add a photo'}
                      </Text>
                    </Tap>
                  )}
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

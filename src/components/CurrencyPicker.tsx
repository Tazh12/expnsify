import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, TextInput,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Tap } from './Tap';
import { FRANKFURTER_CURRENCIES } from '../store/useRates';

const CURRENCY_NAMES: Record<string, string> = {
  AUD: 'Australian Dollar', BGN: 'Bulgarian Lev',   BRL: 'Brazilian Real',
  CAD: 'Canadian Dollar',   CHF: 'Swiss Franc',      CNY: 'Chinese Yuan',
  CZK: 'Czech Koruna',      DKK: 'Danish Krone',     EUR: 'Euro',
  GBP: 'British Pound',     HKD: 'Hong Kong Dollar', HUF: 'Hungarian Forint',
  IDR: 'Indonesian Rupiah', ILS: 'Israeli Shekel',   INR: 'Indian Rupee',
  ISK: 'Icelandic Krona',   JPY: 'Japanese Yen',     KRW: 'South Korean Won',
  MXN: 'Mexican Peso',      MYR: 'Malaysian Ringgit',NOK: 'Norwegian Krone',
  NZD: 'New Zealand Dollar',PHP: 'Philippine Peso',  PLN: 'Polish Zloty',
  RON: 'Romanian Leu',      SEK: 'Swedish Krona',    SGD: 'Singapore Dollar',
  THB: 'Thai Baht',         TRY: 'Turkish Lira',     USD: 'US Dollar',
  ZAR: 'South African Rand',
};

interface Props {
  visible: boolean;
  current: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}

export function CurrencyPickerSheet({ visible, current, onSelect, onClose }: Props) {
  const C = useTheme();
  const [q, setQ] = useState('');

  const filtered = FRANKFURTER_CURRENCIES.filter(
    code => q === '' ||
      code.toLowerCase().includes(q.toLowerCase()) ||
      CURRENCY_NAMES[code]?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <BlurView intensity={40} tint={C.isLight ? 'light' : 'dark'} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose}/>
        <View style={{
          backgroundColor: C.bgElev,
          borderTopLeftRadius: 28, borderTopRightRadius: 28,
          borderWidth: 0.5, borderColor: C.hairStrong,
          paddingTop: 12, maxHeight: '80%' as any,
        }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.subtle, alignSelf: 'center', marginBottom: 16 }}/>

          {/* Header */}
          <View style={{ paddingHorizontal: 22, marginBottom: 12 }}>
            <Text style={{ fontFamily: C.fonts.serif, fontSize: 26, color: C.cream, marginBottom: 14 }}>
              Currency
            </Text>
            {/* Search */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
              borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
            }}>
              <Icon name="search" size={16} stroke={C.muted}/>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search currencies"
                placeholderTextColor={C.subtle}
                style={{ flex: 1, fontSize: 14, color: C.cream, fontFamily: C.fonts.regular }}
                autoCapitalize="characters"
              />
              {q.length > 0 && (
                <Tap onPress={() => setQ('')}>
                  <Icon name="x" size={14} stroke={C.muted}/>
                </Tap>
              )}
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 40 }}
          >
            {filtered.map((code, i) => {
              const on = code === current;
              return (
                <Tap
                  key={code}
                  onPress={() => { onSelect(code); onClose(); }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 14,
                    paddingVertical: 14,
                    borderBottomWidth: i === filtered.length - 1 ? 0 : 0.5,
                    borderBottomColor: C.hair,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, color: on ? C.sage : C.cream, fontWeight: on ? '600' : '400' }}>
                      {code}
                    </Text>
                    <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                      {CURRENCY_NAMES[code] ?? code}
                    </Text>
                  </View>
                  {on && <Icon name="check" size={16} stroke={C.sage} sw={2.2}/>}
                </Tap>
              );
            })}
          </ScrollView>
        </View>
      </BlurView>
    </Modal>
  );
}

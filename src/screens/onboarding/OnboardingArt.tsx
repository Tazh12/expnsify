import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, type Theme } from '../../theme';
import { Icon } from '../../components';
import { VadriMark } from '../../components/VadriLogo';

// Small product vignettes drawn with views, so they follow the theme and stay crisp at any size.

export function WelcomeArt() {
  const C = useTheme();
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View style={{
        position: 'absolute', width: 236, height: 236, borderRadius: 118,
        backgroundColor: C.amber, opacity: 0.32,
      }} />
      <View style={{
        position: 'absolute', width: 176, height: 176, borderRadius: 88,
        borderWidth: 1, borderColor: C.hair,
      }} />
      <VadriMark width={112} />
    </View>
  );
}

export function ScanVoiceArt() {
  const C = useTheme();
  const s = styles(C);
  return (
    <View style={{ width: 280, alignItems: 'center' }}>
      <View style={s.row}>
        <View style={[s.card, s.receipt]}>
          <Icon name="receipt" size={16} stroke={C.muted} />
          <Text style={s.receiptName}>Corner Café</Text>
          <View style={s.rule} />
          <View style={s.receiptLine}><Text style={s.small}>Flat white</Text><Text style={s.small}>4.50</Text></View>
          <View style={s.rule} />
          <View style={s.receiptLine}><Text style={s.smallStrong}>Total</Text><Text style={s.smallStrong}>$4.50</Text></View>
        </View>
        <View style={s.voice}>
          <Icon name="mic" size={14} stroke={C.onPrimary} />
          <Text style={s.voiceText}>“coffee 4.50”</Text>
        </View>
      </View>

      <View style={s.arrow}>
        <Icon name="chev-d" size={18} stroke={C.subtle} />
      </View>

      <View style={[s.card, s.line]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={s.lineName}>Coffee</Text>
          <Text style={s.small}><Text style={s.smallStrong}>$4.50</Text> of $40</Text>
        </View>
        <View style={s.track}>
          <View style={[s.fill, { width: '11%' }]} />
        </View>
      </View>
    </View>
  );
}

export function ZeroBasedArt() {
  const C = useTheme();
  const s = styles(C);
  return (
    <View style={[s.card, { width: 280, padding: 22 }]}>
      <View style={s.eqRow}><Text style={s.eqLabel}>Income</Text><Text style={s.eqValue}>$3,200</Text></View>
      <View style={s.eqRow}><Text style={s.eqLabel}>Assigned</Text><Text style={s.eqValue}>− $3,200</Text></View>
      <View style={[s.rule, { marginVertical: 14 }]} />
      <View style={[s.eqRow, { alignItems: 'baseline' }]}>
        <Text style={s.eqLabel}>Left to assign</Text>
        <Text style={s.zero}>$0</Text>
      </View>
      <View style={s.tag}>
        <Icon name="check" size={12} stroke={C.success} sw={2.2} />
        <Text style={s.tagText}>Every dollar has a job</Text>
      </View>
    </View>
  );
}

function styles(C: Theme) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    card: {
      backgroundColor: C.surface, borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth, borderColor: C.hairStrong,
      shadowColor: C.shadow, shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    },
    receipt: { width: 132, padding: 14, transform: [{ rotate: '-4deg' }] },
    receiptName: { fontFamily: C.fonts.semibold, fontSize: 13, color: C.cream, marginTop: 8 },
    receiptLine: { flexDirection: 'row', justifyContent: 'space-between' },
    rule: { height: StyleSheet.hairlineWidth, backgroundColor: C.hairStrong, marginVertical: 8 },
    small: { fontFamily: C.fonts.regular, fontSize: 12, color: C.muted },
    smallStrong: { fontFamily: C.fonts.semibold, fontSize: 12, color: C.cream },
    voice: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: C.sage, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14,
      transform: [{ rotate: '3deg' }],
    },
    voiceText: { fontFamily: C.fonts.medium, fontSize: 13, color: C.onPrimary },
    arrow: { marginVertical: 14 },
    line: { width: 260, padding: 16 },
    lineName: { fontFamily: C.fonts.semibold, fontSize: 15, color: C.cream },
    track: { height: 6, borderRadius: 3, backgroundColor: C.surfaceMuted, marginTop: 12, overflow: 'hidden' },
    fill: { height: 6, borderRadius: 3, backgroundColor: C.sageDeep },
    eqRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 4 },
    eqLabel: { fontFamily: C.fonts.regular, fontSize: 15, color: C.muted },
    eqValue: { fontFamily: C.fonts.medium, fontSize: 15, color: C.cream, fontVariant: ['tabular-nums'] },
    zero: { fontFamily: C.fonts.serif, fontSize: 40, color: C.success },
    tag: {
      flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start',
      marginTop: 14, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999,
      backgroundColor: C.primarySoft,
    },
    tagText: { fontFamily: C.fonts.medium, fontSize: 12, color: C.cream },
  });
}

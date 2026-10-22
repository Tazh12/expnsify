import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';

// A fictional café receipt on thermal paper. No real business, card or person.
// Portland, Oregon has no sales tax, so the total matches the $4.50 the slide logs.

const PAPER = '#FAF8F1';
const INK = '#2E2D2A';
const FADED = '#6E6B63';
const MONO = 'GeistMono_400Regular';
const MONO_BOLD = 'GeistMono_500Medium';
export const RECEIPT_WIDTH = 196;
const TEETH = 14;
const DASHES = '- '.repeat(40);

export function Receipt() {
  return (
    <View style={s.tilt}>
      <View style={s.paper}>
        <Image
          source={require('../../../assets/onboarding/paper-grain.png')}
          resizeMode="repeat"
          style={[StyleSheet.absoluteFillObject, { opacity: 0.55 }]}
        />
        <Text style={s.shop}>CORNER CAFÉ</Text>
        <Text style={s.center}>418 NW Larch St</Text>
        <Text style={s.center}>Portland, OR 97209</Text>
        <Text style={[s.center, { marginTop: 8 }]}>10/22/26   8:14 AM</Text>
        <Text style={s.center}>Order 0417 · Reg 2</Text>

        <Text style={s.dash} numberOfLines={1} ellipsizeMode="clip">{DASHES}</Text>
        <Row left="1  Flat white 12oz" right="4.50" />
        <Text style={s.dash} numberOfLines={1} ellipsizeMode="clip">{DASHES}</Text>
        <Row left="Subtotal" right="4.50" faded />
        <Row left="Tax" right="0.00" faded />
        <Row left="TOTAL" right="$4.50" bold />
        <Row left="Card" right="4.50" faded />
        <Text style={[s.center, { marginTop: 10 }]}>Thank you!</Text>
      </View>
      <Svg width={RECEIPT_WIDTH} height={7} viewBox={`0 0 ${TEETH * 2} 2`} preserveAspectRatio="none">
        <Polygon
          fill={PAPER}
          points={Array.from({ length: TEETH * 2 + 1 }, (_, i) => `${i},${i % 2 === 0 ? 0 : 2}`).join(' ')}
        />
      </Svg>
    </View>
  );
}

function Row({ left, right, bold, faded }: { left: string; right: string; bold?: boolean; faded?: boolean }) {
  const style = [s.line, bold && { fontFamily: MONO_BOLD, color: INK, fontSize: 12 }, faded && { color: FADED }];
  return (
    <View style={s.row}>
      <Text style={style}>{left}</Text>
      <Text style={style}>{right}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  // A receipt lying on a table, seen slightly from above.
  tilt: {
    width: RECEIPT_WIDTH,
    transform: [{ perspective: 900 }, { rotateX: '14deg' }, { rotateZ: '-2.5deg' }],
  },
  paper: {
    backgroundColor: PAPER, paddingHorizontal: 14, paddingTop: 16, paddingBottom: 10,
    overflow: 'hidden',
  },
  shop: { fontFamily: MONO_BOLD, fontSize: 14, letterSpacing: 1.5, color: INK, textAlign: 'center', marginBottom: 4 },
  center: { fontFamily: MONO, fontSize: 10, lineHeight: 14, color: FADED, textAlign: 'center' },
  dash: { fontFamily: MONO, fontSize: 10, lineHeight: 12, color: '#B3AFA4', marginVertical: 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  line: { fontFamily: MONO, fontSize: 11, lineHeight: 17, color: INK },
});

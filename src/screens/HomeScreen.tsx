import React, { useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  Animated, PanResponder,
} from 'react-native';
import Svg, { Circle, Path, LinearGradient as SvgLinearGradient, Stop, Defs } from 'react-native-svg';
import { useTheme } from '../theme';
import { Card, Icon, Tap, AnimatedNumber } from '../components';
import { useExpenses } from '../store/useExpenses';
import { useCategories } from '../store/useCategories';
import { fmt, dayLabel, fmtTime } from '../services/format';

interface Props {
  month: Date;
  onChangeMonth: (delta: number) => void;
  onOpenAdd: () => void;
  onOpenRecap: () => void;
  onSeeAll: () => void;
}

export function HomeScreen({ month, onChangeMonth, onOpenAdd, onOpenRecap, onSeeAll }: Props) {
  const C = useTheme();
  const { forMonth, byCategory } = useExpenses();
  const { categories } = useCategories();

  const txns = forMonth(month.getFullYear(), month.getMonth());
  const total = txns.reduce((s, t) => s + t.amount, 0);
  const recent = txns.slice(0, 5);
  const catTotals = byCategory(txns);

  const catMap = Object.fromEntries(categories.map(c => [c.id, c]));

  const slices = Object.entries(catTotals)
    .map(([id, value]) => ({ id, value, color: catMap[id]?.color ?? '#888', name: catMap[id]?.name ?? id }))
    .sort((a, b) => b.value - a.value);

  const monthLabel = month.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const [mName, mYear] = monthLabel.split(' ');

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Month Switcher */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 18 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Tap onPress={() => onChangeMonth(-1)} style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="chev-l" size={16} stroke={C.cream}/>
          </Tap>
          <View>
            <Text style={{ fontFamily: C.fonts.serif, fontSize: 24, color: C.cream, letterSpacing: -0.3 }}>
              {mName}{' '}
              <Text style={{ color: C.muted, fontStyle: 'italic' }}>{mYear}</Text>
            </Text>
          </View>
          <Tap onPress={() => onChangeMonth(1)} style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="chev-r" size={16} stroke={C.cream}/>
          </Tap>
        </View>
      </View>

      {/* Hero Amount */}
      <View style={{ paddingBottom: 24 }}>
        <Text style={{ color: C.muted, fontSize: 13, marginBottom: 6 }}>You spent</Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 8 }}>
          <Text style={{ fontFamily: C.fonts.serif, fontSize: 18, color: C.muted, lineHeight: 72 }}>$</Text>
          <AnimatedNumber
            value={total}
            duration={1100}
            style={{ fontFamily: C.fonts.serif, fontSize: 64, lineHeight: 72, color: C.cream }}
          />
        </View>
        <Text style={{ marginTop: 10, color: C.cream, fontSize: 14 }}>
          across{' '}
          <Text style={{ fontFamily: C.fonts.serifItalic, fontSize: 16 }}>{txns.length}</Text>
          {' '}transactions{' '}
          <Text style={{ color: C.muted }}>this month</Text>
        </Text>
      </View>

      {/* Donut */}
      {slices.length > 0 && <DonutCard slices={slices} total={total}/>}

      {/* Recap teaser */}
      <Tap onPress={onOpenRecap} style={{ marginTop: 16 }}>
        <RecapTeaser/>
      </Tap>

      {/* Recent */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 24, paddingBottom: 12 }}>
        <Text style={{ fontFamily: C.fonts.serif, fontSize: 22, color: C.cream, letterSpacing: -0.2 }}>Recent</Text>
        <Tap onPress={onSeeAll}><Text style={{ fontSize: 13, color: C.sage }}>See all →</Text></Tap>
      </View>

      <Card style={{ overflow: 'hidden' }}>
        {recent.map((t, i) => (
          <TxnRow key={t.id} t={t} catMap={catMap} isLast={i === recent.length - 1}/>
        ))}
        {recent.length === 0 && (
          <View style={{ padding: 32, alignItems: 'center' }}>
            <Text style={{ fontFamily: C.fonts.serifItalic, fontSize: 18, color: C.muted }}>no expenses yet.</Text>
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

function DonutCard({ slices, total }: { slices: { id: string; value: number; color: string; name: string }[]; total: number }) {
  const C = useTheme();
  const [active, setActive] = React.useState<number | null>(null);
  const size = 180;
  const r = 68, cx = size / 2, cy = size / 2, sw = 16;
  const circ = 2 * Math.PI * r;
  let acc = 0;

  const focus = active != null ? slices[active] : null;
  const top = slices[0];

  function handleDonutPress(evt: { nativeEvent: { locationX: number; locationY: number } }) {
    const { locationX, locationY } = evt.nativeEvent;
    const dx = locationX - cx;
    const dy = locationY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Only respond if touch is within the donut ring
    if (dist < r - sw || dist > r + sw) return;
    // Compute angle; SVG is rotated -90deg so offset by +90deg
    let angle = (Math.atan2(dy, dx) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
    const fraction = angle / (2 * Math.PI);
    let cumulative = 0;
    for (let i = 0; i < slices.length; i++) {
      cumulative += slices[i].value / total;
      if (fraction <= cumulative) {
        setActive(active === i ? null : i);
        return;
      }
    }
    setActive(null);
  }

  return (
    <Card style={{ padding: 20, marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
        <View
          style={{ width: size, height: size, position: 'relative' }}
          onStartShouldSetResponder={() => true}
          onResponderGrant={handleDonutPress}
        >
          <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }} pointerEvents="none">
            {slices.map((s, i) => {
              const frac = s.value / total;
              const dash = frac * circ;
              const off = -acc;
              acc += dash;
              const dim = active != null && active !== i;
              return (
                <Circle
                  key={s.id}
                  cx={cx} cy={cy} r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={active === i ? sw + 4 : sw}
                  strokeDasharray={`${dash - 2} ${circ - dash + 2}`}
                  strokeDashoffset={off}
                  opacity={dim ? 0.25 : 1}
                />
              );
            })}
          </Svg>
          <View style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 11, color: C.muted, letterSpacing: 0.04, textTransform: 'uppercase' }}>
              {focus ? focus.name : 'Top'}
            </Text>
            <Text style={{ fontFamily: C.fonts.serif, fontSize: 26, color: C.cream, lineHeight: 30, marginTop: 2 }}>
              {fmt(focus ? focus.value : top?.value ?? 0)}
            </Text>
            <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
              {focus
                ? `${Math.round(focus.value / total * 100)}%`
                : top?.name ?? ''}
            </Text>
          </View>
        </View>

        <View style={{ flex: 1, gap: 8 }}>
          {slices.slice(0, 5).map((s, i) => (
            <TouchableOpacity key={s.id} onPress={() => setActive(active === i ? null : i)} style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              opacity: active != null && active !== i ? 0.4 : 1,
            }}>
              <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: s.color }}/>
              <Text style={{ flex: 1, fontSize: 13, color: C.cream }}>{s.name}</Text>
              <Text style={{ fontSize: 12, color: C.muted }}>
                {Math.round(s.value / total * 100)}%
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </Card>
  );
}

function RecapTeaser() {
  const C = useTheme();
  return (
    <View style={{
      backgroundColor: C.surface,
      borderWidth: 0.5, borderColor: C.hairStrong,
      borderRadius: 22, padding: 18,
      flexDirection: 'row', alignItems: 'center', gap: 14,
    }}>
      <View style={{
        width: 44, height: 44, borderRadius: 14,
        backgroundColor: C.sageGlow,
        borderWidth: 0.5, borderColor: C.sageDeep,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="sparkles" size={22} stroke={C.sage} sw={1.4}/>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 11, color: C.sage, letterSpacing: 0.05, textTransform: 'uppercase', marginBottom: 2 }}>
          Weekly recap · ready
        </Text>
        <Text style={{ fontFamily: C.fonts.serif, fontSize: 18, color: C.cream, lineHeight: 22 }}>
          Tap to see your{' '}
          <Text style={{ fontStyle: 'italic' }}>spending insights</Text>.
        </Text>
      </View>
      <Icon name="chev-r" size={18} stroke={C.muted}/>
    </View>
  );
}

const REVEAL_W = 68;

export function TxnRow({
  t, catMap, isLast = false, onViewDetail,
}: {
  t: { id: string; merchant: string; category_id: string; amount: number; date: string; note: string | null; receipt_uri?: string | null; confidence?: number | null; currency?: string };
  catMap: Record<string, { name: string; color: string }>;
  isLast?: boolean;
  onViewDetail?: (t: any) => void;
}) {
  const C = useTheme();
  const cat = catMap[t.category_id] ?? { name: t.category_id, color: C.muted };
  const initial = cat.name[0]?.toUpperCase() ?? '?';

  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        onViewDetail != null && Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (!onViewDetail) return;
        const base = isOpen.current ? REVEAL_W : 0;
        const next = Math.max(0, Math.min(REVEAL_W + 12, base + g.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        if (!onViewDetail) return;
        const base = isOpen.current ? REVEAL_W : 0;
        const end = base + g.dx;
        if (end > REVEAL_W * 0.45) {
          Animated.spring(translateX, { toValue: REVEAL_W, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
          isOpen.current = true;
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 30, bounciness: 4 }).start();
          isOpen.current = false;
        }
      },
    })
  ).current;

  function close() {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, speed: 30 }).start();
    isOpen.current = false;
  }

  return (
    <View style={{
      overflow: 'hidden',
      borderBottomWidth: isLast ? 0 : 0.5,
      borderBottomColor: C.hair,
    }}>
      {/* Eye action revealed behind the row */}
      {onViewDetail && (
        <View style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: REVEAL_W,
          backgroundColor: C.sageGlow,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <TouchableOpacity
            onPress={() => { close(); onViewDetail(t); }}
            style={{
              width: 42, height: 42, borderRadius: 21,
              backgroundColor: C.sage,
              alignItems: 'center', justifyContent: 'center',
            }}
            activeOpacity={0.8}
          >
            <Icon name="eye" size={18} stroke="#0E0E0C" sw={2}/>
          </TouchableOpacity>
        </View>
      )}

      {/* Row content — slides right on swipe */}
      <Animated.View
        {...(onViewDetail ? pan.panHandlers : {})}
        style={[
          { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, paddingHorizontal: 18, backgroundColor: C.bgElev },
          onViewDetail ? { transform: [{ translateX }] } : undefined,
        ]}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={isOpen.current ? close : undefined}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14 }}
        >
          <View style={{
            width: 36, height: 36, borderRadius: 36 * 0.32,
            backgroundColor: `${cat.color}2e`,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontFamily: C.fonts.serifItalic, fontSize: 18, color: cat.color }}>
              {initial}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, color: C.cream, fontWeight: '500' }} numberOfLines={1}>
              {t.merchant}
            </Text>
            <Text style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
              {cat.name}{t.note ? ` · ${t.note}` : ''}
            </Text>
          </View>
        </TouchableOpacity>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 15, color: C.cream, fontWeight: '500', fontVariant: ['tabular-nums'] }}>
            {fmt(t.amount)}
          </Text>
          <Text style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{fmtTime(t.date)}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

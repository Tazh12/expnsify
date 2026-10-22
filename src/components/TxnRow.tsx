import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing, Extrapolation, interpolate, useAnimatedReaction, useAnimatedStyle,
  useReducedMotion, useSharedValue, withSpring, withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';
import { amountStyle, useTheme } from '../theme';
import { Icon } from './Icon';
import { Tap } from './Tap';
import { useRates } from '../store/useRates';
import { useSettings } from '../store/useSettings';
import { useOpenRow } from '../store/useOpenRow';
import { fmt } from '../services/format';
import type { Expense } from '../store/useExpenses';

// Snap points: swipe right to the view action, left to edit and delete.
// Each width holds its buttons whole, with the row's own padding on both sides.
const VIEW_W = 76;
const EDIT_W = 136;
const BTN = 44;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// Where the finger would come to rest if it kept decelerating.
function project(velocity: number, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

// The further past the edge, the less the row follows.
function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

function snapHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function TxnRow({
  t, catMap, isLast = false, onViewDetail, onEdit, onDelete, unbudgeted, overspend,
}: {
  t: Expense;
  catMap: Record<string, { name: string; color: string }>;
  isLast?: boolean;
  onViewDetail?: (t: Expense) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  unbudgeted?: boolean;
  overspend?: boolean;
}) {
  const C = useTheme();
  const { width: screenW } = useWindowDimensions();
  const reduced = useReducedMotion();
  const { convert } = useRates.getState();
  const { preferredCurrency } = useSettings.getState();
  const convertedAmount = convert(t.amount, t.currency ?? 'USD');
  const showOriginal = !!t.currency && t.currency !== preferredCurrency;
  const cat = catMap[t.category_id] ?? { name: t.category_id, color: C.muted };
  const initial = cat.name[0]?.toUpperCase() ?? '?';
  const warn = unbudgeted || overspend || t.unbudgeted;
  const amountColor = warn ? C.alertInk : t.type === 'income' ? C.success : C.text;

  const hasView = onViewDetail != null;
  const hasEdit = onEdit != null || onDelete != null;
  const maxX = hasView ? VIEW_W : 0;
  const minX = hasEdit ? -EDIT_W : 0;

  const x = useSharedValue(0);
  const start = useSharedValue(0);
  const dragging = useSharedValue(false);
  // Which snap point the drag has reached: -1 edit, 0 none, 1 view. Drives the haptic.
  const reached = useSharedValue(0);
  const openRef = useRef(false);

  const settle = (to: number, velocity = 0) => {
    'worklet';
    return reduced
      ? withTiming(to, { duration: 200, easing: EASE_OUT })
      : withSpring(to, { duration: 300, dampingRatio: 0.8, velocity, overshootClamping: to === 0 });
  };

  const markOpen = (open: boolean) => {
    openRef.current = open;
    const store = useOpenRow.getState();
    if (open) store.setOpen(t.id);
    else if (store.openId === t.id) store.setOpen(null);
  };

  const close = () => {
    if (!openRef.current) return;
    openRef.current = false;
    x.set(settle(0));
  };

  // Another row opened, or a touch landed outside this one.
  useEffect(() => useOpenRow.subscribe(s => {
    if (s.openId !== t.id && openRef.current) close();
  }), [t.id, reduced]);

  useEffect(() => () => {
    if (useOpenRow.getState().openId === t.id) useOpenRow.getState().setOpen(null);
  }, [t.id]);

  const pan = useMemo(() => Gesture.Pan()
    .enabled(hasView || hasEdit)
    .activeOffsetX([-10, 10])
    .failOffsetY([-8, 8])
    .onStart(() => {
      start.set(x.get());
      dragging.set(true);
    })
    .onUpdate((e) => {
      const raw = start.get() + e.translationX;
      let next = raw;
      if (raw > maxX) next = maxX + rubberband(raw - maxX, screenW);
      else if (raw < minX) next = minX + rubberband(raw - minX, screenW);
      x.set(next);
    })
    .onEnd((e) => {
      const projected = x.get() + project(e.velocityX);
      const points = [minX, 0, maxX];
      let target = 0;
      for (const p of points) {
        if (Math.abs(projected - p) < Math.abs(projected - target)) target = p;
      }
      // A flick that opens without the drag reaching the snap point still gets its click.
      if (target !== 0 && reached.get() !== Math.sign(target)) scheduleOnRN(snapHaptic);
      x.set(settle(target, e.velocityX));
      scheduleOnRN(markOpen, target !== 0);
    })
    .onFinalize(() => {
      dragging.set(false);
      reached.set(0);
    }), [hasView, hasEdit, maxX, minX, screenW, reduced, t.id]);

  // One haptic as the drag reaches a snap point, none per frame.
  useAnimatedReaction(
    () => {
      // From position alone, so grabbing a row that is already open doesn't count as reaching it.
      const v = x.get();
      if (maxX > 0 && v >= maxX) return 1;
      if (minX < 0 && v <= minX) return -1;
      return 0;
    },
    (now, prev) => {
      if (!dragging.get() || now === prev) return;
      if (now !== 0) {
        reached.set(now);
        scheduleOnRN(snapHaptic);
      }
    },
    [maxX, minX],
  );

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const viewLayer = useAnimatedStyle(() => ({ opacity: x.get() > 0 ? 1 : 0 }));
  const editLayer = useAnimatedStyle(() => ({ opacity: x.get() < 0 ? 1 : 0 }));
  const viewBtn = useAnimatedStyle(() => {
    const p = interpolate(x.get(), [0, VIEW_W], [0, 1], Extrapolation.CLAMP);
    return reduced ? { opacity: p } : { opacity: p, transform: [{ scale: 0.85 + 0.15 * p }] };
  });
  const editBtns = useAnimatedStyle(() => {
    const p = interpolate(x.get(), [-EDIT_W, 0], [1, 0], Extrapolation.CLAMP);
    return reduced ? { opacity: p } : { opacity: p, transform: [{ scale: 0.85 + 0.15 * p }] };
  });

  const act = (fn?: () => void) => () => {
    close();
    markOpen(false);
    fn?.();
  };

  const a11yActions = [
    ...(onViewDetail ? [{ name: 'view', label: 'View details' }] : []),
    ...(onEdit ? [{ name: 'edit', label: 'Edit' }] : []),
    ...(onDelete ? [{ name: 'delete', label: 'Delete' }] : []),
  ];

  return (
    <View
      onTouchStart={() => useOpenRow.getState().markTouch(t.id)}
      style={{
        overflow: 'hidden',
        borderBottomWidth: isLast ? 0 : 0.5,
        borderBottomColor: C.hair,
      }}
    >
      {hasView && (
        // Full width, so a rubber-banded row never shows a gap behind it.
        <Animated.View style={[{
          position: 'absolute', left: 0, top: 0, bottom: 0, right: 0,
          backgroundColor: C.sageGlow,
        }, viewLayer]}>
          <View style={{ width: VIEW_W, height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={viewBtn}>
              <Tap
                onPress={act(() => onViewDetail!(t))}
                accessibilityLabel="View details"
                style={{
                  width: BTN, height: BTN, borderRadius: BTN / 2,
                  backgroundColor: C.sage,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon name="eye" size={18} stroke={C.onPrimary} sw={2}/>
              </Tap>
            </Animated.View>
          </View>
        </Animated.View>
      )}

      {hasEdit && (
        <Animated.View style={[{
          position: 'absolute', left: 0, top: 0, bottom: 0, right: 0,
          backgroundColor: C.surface2,
          alignItems: 'flex-end',
        }, editLayer]}>
          <Animated.View style={[{
            width: EDIT_W, height: '100%',
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
          }, editBtns]}>
            {onEdit && (
              <Tap
                onPress={act(onEdit)}
                accessibilityLabel="Edit"
                style={{
                  width: BTN, height: BTN, borderRadius: BTN / 2,
                  backgroundColor: C.sage,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon name="edit" size={17} stroke={C.onPrimary} sw={1.9}/>
              </Tap>
            )}
            {onDelete && (
              <Tap
                onPress={act(onDelete)}
                accessibilityLabel="Delete"
                style={{
                  width: BTN, height: BTN, borderRadius: BTN / 2,
                  backgroundColor: C.rose,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon name="trash" size={17} stroke={C.onPrimary} sw={1.9}/>
              </Tap>
            )}
          </Animated.View>
        </Animated.View>
      )}

      <GestureDetector gesture={pan}>
        <Animated.View style={[
          { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, paddingHorizontal: 18, backgroundColor: C.bgElev },
          rowStyle,
        ]}>
          <Pressable
            onPress={() => {
              if (openRef.current) { close(); markOpen(false); }
              else onViewDetail?.(t);
            }}
            accessibilityRole="button"
            accessibilityActions={a11yActions}
            onAccessibilityAction={(e) => {
              const name = e.nativeEvent.actionName;
              if (name === 'view') onViewDetail?.(t);
              else if (name === 'edit') onEdit?.();
              else if (name === 'delete') onDelete?.();
            }}
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
              <Text style={{ fontSize: 12, color: warn ? C.rose : C.muted, marginTop: 2 }} numberOfLines={1}>
                {warn ? (unbudgeted || t.unbudgeted ? 'Unbudgeted' : 'Over budget') : cat.name}
                {(t.line_items?.length ?? 0) > 0 ? ` · ${t.line_items.length} item${t.line_items.length === 1 ? '' : 's'}` : ''}
                {t.location?.address ? ` · near ${t.location.address}` : ''}
                {t.note && !warn ? ` · ${t.note}` : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 15, color: amountColor, ...amountStyle() }}>
                {t.type === 'income' ? '+' : ''}{fmt(convertedAmount, preferredCurrency)}
              </Text>
              {showOriginal && (
                <Text style={{ fontSize: 11, color: C.muted, marginTop: 1, ...amountStyle('regular') }}>
                  {t.currency} {t.amount.toFixed(2)}
                </Text>
              )}
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '../theme';
import { Icon, Tap } from '../components';
import type { CaptureMethod } from './AddSheet';

export interface Anchor { x: number; y: number; width: number; height: number }

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const MENU_W = 236;
const EDGE = 16;
const GAP = 10;

const OPTIONS: { id: CaptureMethod; icon: string; label: string }[] = [
  { id: 'photo', icon: 'cam', label: 'Scan receipt' },
  { id: 'voice', icon: 'mic', label: 'Say it' },
  { id: 'manual', icon: 'edit', label: 'Type it' },
  { id: 'file', icon: 'doc', label: 'Upload PDF' },
];

/** A small menu that grows out of the capture button. `anchor` null means closed. */
export function CaptureChooser({
  anchor, onPick, onClose,
}: {
  anchor: Anchor | null;
  onPick: (m: CaptureMethod) => void;
  onClose: () => void;
}) {
  const C = useTheme();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  // Keep the last anchor while the menu animates out.
  const [shown, setShown] = useState<Anchor | null>(anchor);

  useEffect(() => {
    if (anchor) {
      setShown(anchor);
      progress.set(withTiming(1, { duration: 200, easing: EASE_OUT }));
    } else if (shown) {
      progress.set(withTiming(0, { duration: 140, easing: EASE_OUT }, (done) => {
        if (done) scheduleOnRN(setShown, null);
      }));
    }
  }, [anchor]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const menuStyle = useAnimatedStyle(() => {
    const p = progress.get();
    if (reduced) return { opacity: p };
    return {
      opacity: p,
      transform: [{ translateY: (1 - p) * 6 }, { scale: 0.95 + 0.05 * p }],
    };
  });

  if (!shown) return null;

  const above = shown.y + shown.height / 2 > screenH / 2;
  const left = Math.min(screenW - MENU_W - EDGE, Math.max(EDGE, shown.x + shown.width / 2 - MENU_W / 2));
  const vertical = above
    ? { bottom: screenH - shown.y + GAP }
    : { top: shown.y + shown.height + GAP };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={anchor ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: C.scrimSoft }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[
          {
            position: 'absolute', left, width: MENU_W, ...vertical,
            backgroundColor: C.bgElev, borderRadius: 20, padding: 6,
            transformOrigin: above ? 'bottom' : 'top',
            // It floats over the screen, so it carries the one shadow.
            shadowColor: C.shadow, shadowOffset: { width: 0, height: 10 },
            shadowOpacity: C.isLight ? 0.14 : 0.4, shadowRadius: 24, elevation: 12,
          },
          menuStyle,
        ]}
      >
        {OPTIONS.map(o => (
          <Tap
            key={o.id}
            onPress={() => onPick(o.id)}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              minHeight: 52, paddingHorizontal: 14, borderRadius: 14,
            }}
          >
            <Icon name={o.icon} size={20} stroke={C.sage} sw={1.8}/>
            <Text style={{ fontSize: 16, fontWeight: '500', color: C.cream }}>{o.label}</Text>
          </Tap>
        ))}
      </Animated.View>
    </View>
  );
}

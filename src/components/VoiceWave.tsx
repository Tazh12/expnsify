import React, { useCallback } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import { Icon } from './Icon';

export const WAVE_BARS = 28;
const BAR_WIDTH = 3;
const BAR_GAP = 3;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/** A rolling window of mic levels (0–1), newest on the right. Writing never re-renders React. */
export function useVoiceLevels(count = WAVE_BARS) {
  const levels = useSharedValue<number[]>(Array(count).fill(0));
  const push = useCallback((level: number) => {
    const v = Math.max(0, Math.min(1, level));
    levels.set(prev => [...prev.slice(1), v]);
  }, [levels]);
  const reset = useCallback(() => {
    levels.set(Array(count).fill(0));
  }, [levels, count]);
  return { levels, push, reset };
}

/** Maps an expo-av metering reading (dBFS, about −160 to 0) to 0–1. */
export function meterToLevel(db: number | undefined): number {
  if (db == null || !Number.isFinite(db)) return 0;
  return Math.pow(Math.max(0, (db + 55) / 55), 1.6);
}

export function VoiceWave({ levels, count = WAVE_BARS, height = 40 }: {
  levels: SharedValue<number[]>;
  count?: number;
  height?: number;
}) {
  const C = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{
        width: 48, height: 48, borderRadius: 24, backgroundColor: C.sage,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon name="mic" size={20} stroke={C.onPrimary} sw={2}/>
      </View>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', gap: BAR_GAP, height }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {Array.from({ length: count }, (_, i) => (
          <Bar key={i} index={i} levels={levels} height={height} color={C.sage} />
        ))}
      </View>
    </View>
  );
}

function Bar({ index, levels, height, color }: {
  index: number;
  levels: SharedValue<number[]>;
  height: number;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const v = levels.get()[index] ?? 0;
    return {
      opacity: 0.35 + v * 0.65,
      transform: [{ scaleY: withTiming(Math.max(0.1, v), { duration: 90, easing: EASE_OUT }) }],
    };
  });
  return (
    <Animated.View style={[{
      width: BAR_WIDTH, height, borderRadius: BAR_WIDTH / 2, backgroundColor: color,
    }, style]} />
  );
}

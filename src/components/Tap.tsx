import React, { useRef } from 'react';
import { Pressable, Animated, StyleSheet, ViewStyle, PressableProps } from 'react-native';
import * as Haptics from 'expo-haptics';

interface TapProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  haptic?: boolean;
}

const LAYOUT_KEYS = new Set([
  'flex', 'flexGrow', 'flexShrink', 'flexBasis',
  'width', 'minWidth', 'maxWidth',
  'height', 'minHeight', 'maxHeight',
  'alignSelf',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd',
  'position', 'top', 'left', 'right', 'bottom', 'start', 'end',
]);

function splitStyle(style?: ViewStyle | ViewStyle[]): { layout: ViewStyle; visual: ViewStyle } {
  const flat = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  const layout: ViewStyle = {};
  const visual: ViewStyle = {};
  for (const key of Object.keys(flat) as (keyof ViewStyle)[]) {
    const value = flat[key];
    if (value == null) continue;
    if (LAYOUT_KEYS.has(key) || key.startsWith('margin')) {
      (layout as Record<string, unknown>)[key] = value;
    } else {
      (visual as Record<string, unknown>)[key] = value;
    }
  }
  return { layout, visual };
}

export function Tap({ children, onPress, style, haptic = false, ...rest }: TapProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const { layout, visual } = splitStyle(style);
  const fillsParent =
    layout.flex != null || layout.flexGrow != null || layout.flexBasis != null ||
    layout.width != null || layout.height != null || layout.minHeight != null || layout.minWidth != null;

  const onIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  };
  const onOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();
  };

  const handlePress = (e: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress?.(e);
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={onIn}
      onPressOut={onOut}
      style={layout}
      {...rest}
    >
      <Animated.View style={[
        fillsParent ? { alignSelf: 'stretch', flexGrow: 1 } : null,
        layout.minHeight != null ? { minHeight: layout.minHeight } : null,
        layout.height != null ? { height: layout.height } : null,
        { transform: [{ scale }] },
        visual,
      ]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

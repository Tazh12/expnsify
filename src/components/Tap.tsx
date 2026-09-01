import React, { useRef } from 'react';
import { Pressable, Animated, ViewStyle, PressableProps } from 'react-native';
import * as Haptics from 'expo-haptics';

interface TapProps extends Omit<PressableProps, 'style'> {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  haptic?: boolean;
}

export function Tap({ children, onPress, style, haptic = false, ...rest }: TapProps) {
  const scale = useRef(new Animated.Value(1)).current;

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
      {...rest}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style as ViewStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

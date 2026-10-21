import React, { useRef, useEffect } from 'react';
import { Pressable, Animated } from 'react-native';
import { useTheme } from '../theme';

interface ToggleProps {
  on: boolean;
  onChange?: (val: boolean) => void;
}

export function Toggle({ on, onChange }: ToggleProps) {
  const C = useTheme();
  const pos = useRef(new Animated.Value(on ? 18 : 2)).current;
  const bg = useRef(new Animated.Value(on ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(pos, { toValue: on ? 18 : 2, useNativeDriver: false, speed: 40 }),
      Animated.timing(bg, { toValue: on ? 1 : 0, duration: 200, useNativeDriver: false }),
    ]).start();
  }, [on]);

  const backgroundColor = bg.interpolate({
    inputRange: [0, 1],
    outputRange: [C.surface2, C.sage],
  });

  return (
    <Pressable onPress={() => onChange?.(!on)}>
      <Animated.View style={{
        width: 40, height: 24, borderRadius: 12,
        backgroundColor,
        borderWidth: 0.5,
        borderColor: on ? C.sage : C.hair,
        justifyContent: 'center',
      }}>
        <Animated.View style={{
          position: 'absolute',
          left: pos,
          width: 19, height: 19, borderRadius: 9.5,
          backgroundColor: on ? C.onPrimary : C.cream,
        }}/>
      </Animated.View>
    </Pressable>
  );
}

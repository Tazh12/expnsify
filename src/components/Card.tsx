import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export function Card({ children, style }: CardProps) {
  const C = useTheme();
  return (
    <View style={[{
      backgroundColor: C.surface,
      borderWidth: 0.5,
      borderColor: C.hair,
      borderRadius: 22,
    }, style]}>
      {children}
    </View>
  );
}

import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme';

export function SectionHeader({ title, action }: { title: string; action?: string }) {
  const C = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 24, paddingBottom: 12 }}>
      <Text style={{ fontFamily: C.fonts.serif, fontSize: 22, color: C.cream, letterSpacing: -0.2 }}>{title}</Text>
      {action ? <Text style={{ fontSize: 13, color: C.muted }}>{action}</Text> : null}
    </View>
  );
}

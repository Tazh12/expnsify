import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme';

export function PageHeader({ title, tagline }: { title: string; tagline?: string }) {
  const C = useTheme();
  return (
    <View style={{ paddingTop: 8, paddingBottom: 6 }}>
      <Text
        style={{ fontFamily: C.fonts.serif, fontSize: 32, color: C.cream, lineHeight: 36, letterSpacing: -0.4 }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {title}
      </Text>
      {tagline ? (
        <Text style={{ fontFamily: C.fonts.serifItalic, color: C.muted, marginTop: 6, fontSize: 18 }}>
          {tagline}
        </Text>
      ) : null}
    </View>
  );
}

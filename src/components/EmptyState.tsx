import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Tap } from './Tap';

export function EmptyState({
  icon, title, line, actionLabel, onAction,
}: {
  icon: string;
  title: string;
  line: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const C = useTheme();
  return (
    <View style={{ paddingVertical: 36, paddingHorizontal: 16, alignItems: 'center' }}>
      <View style={{
        width: 56, height: 56, borderRadius: 18, backgroundColor: C.surface,
        alignItems: 'center', justifyContent: 'center', marginBottom: 14,
      }}>
        <Icon name={icon} size={26} stroke={C.muted}/>
      </View>
      <Text style={{ fontFamily: C.fonts.serif, fontSize: 22, color: C.cream, textAlign: 'center' }}>
        {title}
      </Text>
      <Text style={{ marginTop: 8, fontSize: 14, lineHeight: 20, color: C.muted, textAlign: 'center', maxWidth: 280 }}>
        {line}
      </Text>
      {actionLabel && onAction ? (
        <Tap
          onPress={onAction}
          haptic
          accessibilityLabel={actionLabel}
          style={{
            marginTop: 16, minHeight: 44, paddingHorizontal: 18, borderRadius: 14,
            backgroundColor: C.sage, alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ color: C.onPrimary, fontSize: 14, fontWeight: '600' }}>{actionLabel}</Text>
        </Tap>
      ) : null}
    </View>
  );
}

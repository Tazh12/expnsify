import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme';
import { Icon } from './Icon';

export function SettingsRow({
  icon, label, detail, isLast, onPress, control,
}: {
  icon?: React.ReactNode;
  label: string;
  detail?: string;
  isLast?: boolean;
  onPress?: () => void;
  control?: React.ReactNode;
}) {
  const C = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.6 : 1} style={{
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingVertical: 12, paddingHorizontal: 16, minHeight: 44,
      borderBottomWidth: isLast ? 0 : 0.5, borderBottomColor: C.hair,
    }}>
      {icon && (
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: C.surface2, alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </View>
      )}
      <Text style={{ flex: 1, fontSize: 14, color: C.cream }} numberOfLines={2}>{label}</Text>
      {detail ? <Text style={{ flexShrink: 1, fontSize: 13, color: C.muted, textAlign: 'right' }} numberOfLines={2}>{detail}</Text> : null}
      {control}
      {onPress && !control && <Icon name="chev-r" size={14} stroke={C.subtle}/>}
    </TouchableOpacity>
  );
}

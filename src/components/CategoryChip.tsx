import React from 'react';
import { View, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { useTheme } from '../theme';
import { Icon } from './Icon';

interface Props {
  label: string;
  color: string;
  selected?: boolean;
  aiSuggested?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export function CategoryChip({ label, color, selected, aiSuggested, onPress, style }: Props) {
  const C = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={[{
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
      backgroundColor: selected ? `${color}38` : C.surface,
      borderWidth: 0.5,
      borderColor: selected ? color : C.hair,
    }, style]}>
      <View style={{ width: 6, height: 6, borderRadius: 1, backgroundColor: color }}/>
      <Text style={{ fontSize: 12, fontWeight: '500', color: selected ? color : C.cream }}>
        {label}
      </Text>
      {aiSuggested && (
        <Text style={{ fontSize: 11, color: C.sage }}>✦ suggested</Text>
      )}
    </TouchableOpacity>
  );
}

export function NewCategoryChip({ onPress, style }: { onPress?: () => void; style?: ViewStyle }) {
  const C = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={[{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
      backgroundColor: C.surface,
      borderWidth: 0.5,
      borderColor: C.hair,
    }, style]}>
      <Icon name="plus" size={12} stroke={C.muted} sw={2}/>
      <Text style={{ fontSize: 12, fontWeight: '500', color: C.muted }}>New</Text>
    </TouchableOpacity>
  );
}

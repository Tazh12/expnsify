import React from 'react';
import { View, Text, Platform, Keyboard, InputAccessoryView as RNInputAccessoryView } from 'react-native';
import { useTheme } from '../theme';
import { Tap } from './Tap';
import { Icon } from './Icon';

interface KeyboardAccessoryProps {
  nativeID: string;
}

/**
 * A keyboard accessory view that shows a "Hide keyboard" button above the keyboard.
 * Usage: Attach the nativeID to TextInput via inputAccessoryViewID prop.
 */
export function KeyboardAccessory({ nativeID }: KeyboardAccessoryProps) {
  const C = useTheme();

  if (Platform.OS !== 'ios') return null;

  return (
    <RNInputAccessoryView nativeID={nativeID}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: C.surface,
          borderTopWidth: 0.5,
          borderTopColor: C.hair,
        }}
      >
        <Tap
          onPress={() => Keyboard.dismiss()}
          accessibilityLabel="Hide keyboard"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Icon name="chev-d" size={14} stroke={C.sage} sw={2} />
          <Text style={{ fontSize: 15, color: C.sage, fontWeight: '600' }}>Done</Text>
        </Tap>
      </View>
    </RNInputAccessoryView>
  );
}

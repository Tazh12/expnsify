import React from 'react';
import { View, Text, Image } from 'react-native';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Tap } from './Tap';
import type { TabId } from './TabBar';

export function AppHeader({
  tab,
  month,
  onChangeMonth,
}: {
  tab: TabId;
  month: Date;
  onChangeMonth: (delta: number) => void;
}) {
  const C = useTheme();
  const onHome = tab === 'home';
  const monthLabel = month.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const [mName, mYear] = monthLabel.split(' ');

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 8, minHeight: 52, gap: 10,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <Image
          source={require('../../assets/app-icon-transparent.png')}
          style={{ width: 24, height: 24 }}
          resizeMode="contain"
        />
        <Text style={{ fontSize: 14, fontWeight: '500', color: C.cream, letterSpacing: 0.02 }}>
          expnsify
        </Text>
      </View>

      {onHome && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 }}>
          <Tap
            onPress={() => onChangeMonth(-1)}
            accessibilityLabel="Previous month"
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="chev-l" size={16} stroke={C.cream}/>
          </Tap>
          <Text
            style={{ fontFamily: C.fonts.serif, fontSize: 20, color: C.cream, letterSpacing: -0.3, flexShrink: 1 }}
            numberOfLines={1}
          >
            {mName}{' '}
            <Text style={{ color: C.muted, fontStyle: 'italic' }}>{mYear}</Text>
          </Text>
          <Tap
            onPress={() => onChangeMonth(1)}
            accessibilityLabel="Next month"
            style={{
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="chev-r" size={16} stroke={C.cream}/>
          </Tap>
        </View>
      )}
    </View>
  );
}

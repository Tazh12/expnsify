import React from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Tap } from './Tap';
import { useAuth } from '../store/useAuth';
import { VadriMark } from './VadriLogo';

export function AppHeader({
  month,
  onChangeMonth,
  onOpenSettings,
  showBrand = true,
}: {
  month: Date;
  onChangeMonth: (delta: number) => void;
  onOpenSettings: () => void;
  showBrand?: boolean;
}) {
  const C = useTheme();
  const { width } = useWindowDimensions();
  const user = useAuth(s => s.user);
  const compact = width < 430;
  const monthLabel = month.toLocaleString('en-US', { month: compact ? 'short' : 'long', year: 'numeric' });
  const [mName, mYear] = monthLabel.split(' ');
  const initial = (user?.displayName || user?.email || '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 20, paddingVertical: 8, minHeight: 52, gap: 10,
    }}>
      {showBrand ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <VadriMark width={26} dark={!C.isLight} />
        </View>
      ) : <View style={{ width: 8 }}/>}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0, flex: showBrand ? undefined : 1 }}>
        <Tap
          onPress={() => onChangeMonth(-1)}
          accessibilityLabel="Previous month"
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="chev-l" size={16} stroke={C.cream}/>
          </View>
        </Tap>
        <Text
          style={{ fontFamily: C.fonts.serif, fontSize: 20, color: C.cream, letterSpacing: -0.3, flexShrink: 1 }}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {mName}{' '}
          <Text style={{ color: C.muted, fontStyle: 'italic' }}>{mYear}</Text>
        </Text>
        <Tap
          onPress={() => onChangeMonth(1)}
          accessibilityLabel="Next month"
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: C.surface, borderWidth: 0.5, borderColor: C.hair,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="chev-r" size={16} stroke={C.cream}/>
          </View>
        </Tap>
      </View>

      <Tap
        onPress={onOpenSettings}
        accessibilityLabel="Settings"
        style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: C.sage, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}
      >
        <Text style={{ fontFamily: C.fonts.serifItalic, fontSize: 16, color: C.onPrimary }}>{initial}</Text>
      </Tap>
    </View>
  );
}

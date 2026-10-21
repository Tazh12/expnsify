import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../theme';
import { Tap } from './Tap';
import { Icon } from './Icon';
import { TabBar, type TabId } from './TabBar';
import { VadriMark, VadriWordmark } from './VadriLogo';

const NAV: { id: TabId; icon: string; label: string }[] = [
  { id: 'today', icon: 'cal', label: 'Today' },
  { id: 'plan', icon: 'wallet', label: 'Plan' },
  { id: 'activity', icon: 'list', label: 'Activity' },
  { id: 'insights', icon: 'chart', label: 'Insights' },
];

export function AppShell({
  tab, onTab, onAdd, isWide, children,
}: {
  tab: TabId;
  onTab: (id: TabId) => void;
  onAdd: () => void;
  isWide: boolean;
  children: React.ReactNode;
}) {
  const C = useTheme();

  if (!isWide) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ flex: 1 }}>{children}</View>
        <TabBar tab={tab} onTab={onTab} onAdd={onAdd}/>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: C.bg }}>
      <View style={{
        width: 220, borderRightWidth: 0.5, borderRightColor: C.hair,
        paddingTop: 24, paddingHorizontal: 14, backgroundColor: C.bgElev,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, marginBottom: 28 }}>
          <VadriMark width={22} dark={!C.isLight} />
          <VadriWordmark width={78} dark={!C.isLight} />
        </View>

        {NAV.map(item => {
          const on = tab === item.id;
          return (
            <Tap
              key={item.id}
              onPress={() => onTab(item.id)}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12,
                backgroundColor: on ? C.sageGlow : 'transparent',
                marginBottom: 4,
              }}
            >
              <Icon name={item.icon} size={18} stroke={on ? C.sage : C.muted} sw={on ? 2 : 1.6}/>
              <Text style={{ fontSize: 14, fontWeight: on ? '600' : '500', color: on ? C.cream : C.muted }}>
                {item.label}
              </Text>
            </Tap>
          );
        })}

        <Tap onPress={onAdd} haptic accessibilityLabel="Scan or add an expense" style={{
          marginTop: 18, backgroundColor: C.sage, borderRadius: 14,
          paddingVertical: 12, alignItems: 'center',
        }}>
          <Text style={{ color: C.onPrimary, fontWeight: '600', fontSize: 14 }}>Scan / Add</Text>
        </Tap>
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { Icon } from './Icon';

export type TabId = 'home' | 'txns' | 'reports' | 'settings';

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'home',     icon: 'home',  label: 'Budget' },
  { id: 'txns',     icon: 'list',  label: 'Activity' },
  { id: 'reports',  icon: 'chart', label: 'Reports' },
  { id: 'settings', icon: 'gear',  label: 'Settings' },
];

interface Props {
  tab: TabId;
  onTab: (id: TabId) => void;
  onAdd: () => void;
}

export function TabBar({ tab, onTab, onAdd }: Props) {
  const C = useTheme();

  return (
    <View style={{
      position: 'absolute', bottom: 22, left: 14, right: 14,
      borderRadius: 34, overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: C.isLight ? 0.16 : 0.45,
      shadowRadius: 20,
      elevation: 10,
    }}>
      <BlurView
        intensity={C.isLight ? 46 : 80}
        tint={C.isLight ? 'light' : 'dark'}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 8, paddingVertical: 10,
          borderWidth: 0.5, borderColor: C.hairStrong, borderRadius: 34,
          gap: 2,
        }}
      >
        <LinearGradient
          pointerEvents="none"
          colors={C.isLight
            ? ['rgba(255,255,255,0.65)', 'rgba(255,255,255,0.22)']
            : ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.0)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '60%' }}
        />

        {TABS.slice(0, 2).map(t => <TabItem key={t.id} item={t} active={tab === t.id} onPress={() => onTab(t.id)}/>)}

        <TouchableOpacity
          onPress={onAdd}
          activeOpacity={0.8}
          accessibilityLabel="Add transaction"
          style={{ width: 56, height: 56, borderRadius: 28, overflow: 'hidden', marginHorizontal: 4 }}
        >
          <LinearGradient
            colors={[C.sage, C.sageDeep]}
            start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="plus" size={26} stroke="#0E0E0C" sw={2.4}/>
          </LinearGradient>
        </TouchableOpacity>

        {TABS.slice(2).map(t => <TabItem key={t.id} item={t} active={tab === t.id} onPress={() => onTab(t.id)}/>)}
      </BlurView>
    </View>
  );
}

function TabItem({ item, active, onPress }: { item: { icon: string; label: string }; active: boolean; onPress: () => void }) {
  const C = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={{ flex: 1 }}>
      <View style={{
        height: 56, borderRadius: 22, overflow: 'hidden',
        alignItems: 'center', justifyContent: 'center', gap: 4,
      }}>
        {active && (
          <BlurView
            intensity={C.isLight ? 70 : 40}
            tint={C.isLight ? 'light' : 'dark'}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              borderRadius: 22, borderWidth: 0.5,
              borderColor: C.isLight ? 'rgba(255,255,255,0.7)' : C.hairStrong,
              backgroundColor: C.isLight ? 'rgba(255,255,255,0.30)' : 'rgba(255,255,255,0.06)',
            }}
          />
        )}
        <Icon name={item.icon} size={22} stroke={active ? C.sage : C.muted} sw={active ? 2 : 1.6}/>
        <Text style={{ fontSize: 11, fontWeight: active ? '600' : '500', color: active ? C.cream : C.muted, letterSpacing: 0.02 }}>
          {item.label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

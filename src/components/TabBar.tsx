import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme';
import { Icon } from './Icon';

export type TabId = 'home' | 'txns' | 'reports' | 'settings';

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'home',     icon: 'home',  label: 'Home' },
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
      shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.45, shadowRadius: 20,
      elevation: 10,
    }}>
      <BlurView intensity={80} tint="dark" style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 8, paddingVertical: 10,
        borderWidth: 0.5, borderColor: C.hairStrong, borderRadius: 34,
        gap: 2,
      }}>
        {TABS.slice(0, 2).map(t => <TabItem key={t.id} item={t} active={tab === t.id} onPress={() => onTab(t.id)}/>)}

        {/* Add button */}
        <TouchableOpacity onPress={onAdd} activeOpacity={0.8} style={{ width: 56, height: 56, borderRadius: 28, overflow: 'hidden', marginHorizontal: 4 }}>
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
    <TouchableOpacity onPress={onPress} style={{
      flex: 1, height: 56, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center', gap: 4,
      backgroundColor: active ? C.surface2 : 'transparent',
    }}>
      <Icon name={item.icon} size={22} stroke={active ? C.sage : C.muted} sw={active ? 2 : 1.6}/>
      <Text style={{ fontSize: 11, fontWeight: active ? '600' : '500', color: active ? C.cream : C.muted, letterSpacing: 0.02 }}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );
}

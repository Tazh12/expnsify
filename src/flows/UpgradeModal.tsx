import React from 'react';
import { View, Text, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme';
import { Tap } from '../components';
import { useAiUsage } from '../store/useAiUsage';

export function UpgradeModal() {
  const C = useTheme();
  const blocked = useAiUsage(s => s.blocked);
  const clearBlock = useAiUsage(s => s.clearBlock);
  if (!blocked) return null;

  const when = blocked.resetsAt
    ? new Date(blocked.resetsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : 'next month';
  const title = blocked.code === 'rate_limited' ? 'Slow down a moment' : 'AI actions used up';
  const body = blocked.code === 'rate_limited'
    ? 'Tally limits how many AI requests can run in a minute. Wait a bit, then try again. Adding an expense by hand still works.'
    : `You have used ${blocked.used} of ${blocked.limit} AI actions this month. They reset on ${when}. Manual entry, budgets, charts, and export keep working. Paid plans are not available yet.`;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={clearBlock}>
      <BlurView intensity={50} tint="dark" style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <View style={{
          backgroundColor: C.bgElev, borderRadius: 24, borderWidth: 0.5, borderColor: C.hairStrong, padding: 22,
        }}>
          <Text style={{ fontSize: 11, color: C.link, letterSpacing: 0.06, textTransform: 'uppercase' }}>Free plan</Text>
          <Text style={{ fontFamily: C.fonts.serif, fontSize: 28, color: C.cream, marginTop: 8, letterSpacing: -0.3 }}>{title}</Text>
          <Text style={{ color: C.muted, fontSize: 15, lineHeight: 22, marginTop: 12 }}>{body}</Text>
          <Tap
            onPress={clearBlock}
            haptic
            style={{ marginTop: 20, paddingVertical: 14, borderRadius: 14, backgroundColor: C.sage, alignItems: 'center' }}
          >
            <Text style={{ color: C.onPrimary, fontSize: 15, fontWeight: '600' }}>Got it</Text>
          </Tap>
        </View>
      </BlurView>
    </Modal>
  );
}

export function aiRemainingLabel(used: number, limit: number, loaded: boolean): string {
  if (!loaded) return 'Checking this month’s AI actions';
  const left = Math.max(0, limit - used);
  return `${left} of ${limit} left this month`;
}

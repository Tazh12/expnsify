import React from 'react';
import { View, Text, Modal } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme';
import { Tap } from '../components';
import { useAiUsage } from '../store/useAiUsage';
import { useAccountPrompt } from './CreateAccountSheet';

type Blocked = NonNullable<ReturnType<typeof useAiUsage.getState>['blocked']>;

/** Why an AI action stopped, and what to do instead. Used in its own modal and inside the Add sheet. */
export function AiBlockedCard({
  blocked, onDismiss, onCreateAccount,
}: {
  blocked: Blocked;
  onDismiss: () => void;
  onCreateAccount: () => void;
}) {
  const C = useTheme();
  const needsAccount = blocked.code === 'account_required';
  const isPro = useAiUsage(s => s.plan) === 'paid';

  const when = blocked.resetsAt
    ? new Date(blocked.resetsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : 'next month';
  const title = needsAccount ? 'Create an account to scan'
    : blocked.code === 'rate_limited' ? 'Slow down a moment' : 'AI actions used up';
  const body = needsAccount
    ? 'Scanning receipts, voice entry and insights need a free account. Everything you added as a guest stays. Typing an expense works now.'
    : blocked.code === 'rate_limited'
    ? 'Vadri limits how many AI requests can run in a minute. Wait a bit, then try again. Adding an expense by hand still works.'
    : `You have used ${blocked.used} of ${blocked.limit} AI actions this month. They reset on ${when}. Manual entry, budgets, charts, and export keep working.${isPro ? '' : ' Paid plans are not available yet.'}`;

  return (
    <View>
      <Text style={{ fontSize: 11, color: C.link, letterSpacing: 0.06, textTransform: 'uppercase' }}>{needsAccount ? 'Guest' : isPro ? 'Pro plan' : 'Free plan'}</Text>
      <Text style={{ fontFamily: C.fonts.serif, fontSize: 28, color: C.cream, marginTop: 8, letterSpacing: -0.3 }}>{title}</Text>
      <Text style={{ color: C.muted, fontSize: 15, lineHeight: 22, marginTop: 12 }}>{body}</Text>
      {needsAccount && (
        <Tap
          onPress={onCreateAccount}
          haptic
          style={{ marginTop: 20, paddingVertical: 14, borderRadius: 14, backgroundColor: C.sage, alignItems: 'center' }}
        >
          <Text style={{ color: C.onPrimary, fontSize: 15, fontWeight: '600' }}>Create account</Text>
        </Tap>
      )}
      <Tap
        onPress={onDismiss}
        haptic={!needsAccount}
        style={needsAccount
          ? { marginTop: 8, paddingVertical: 14, alignItems: 'center' }
          : { marginTop: 20, paddingVertical: 14, borderRadius: 14, backgroundColor: C.sage, alignItems: 'center' }}
      >
        <Text style={needsAccount
          ? { color: C.muted, fontSize: 15, fontWeight: '500' }
          : { color: C.onPrimary, fontSize: 15, fontWeight: '600' }}>{needsAccount ? 'Not now' : 'Got it'}</Text>
      </Tap>
    </View>
  );
}

/**
 * The same notice as a modal, for AI actions outside the Add sheet.
 * App leaves it unmounted while the sheet is open: iOS won't present a second modal over it.
 */
export function UpgradeModal() {
  const C = useTheme();
  const blocked = useAiUsage(s => s.blocked);
  const clearBlock = useAiUsage(s => s.clearBlock);
  const showAccount = useAccountPrompt(s => s.show);
  if (!blocked) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={clearBlock}>
      <BlurView intensity={50} tint="dark" style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <View style={{
          backgroundColor: C.bgElev, borderRadius: 24, borderWidth: 0.5, borderColor: C.hairStrong, padding: 22,
        }}>
          <AiBlockedCard
            blocked={blocked}
            onDismiss={clearBlock}
            // Let this modal finish closing before the sheet presents.
            onCreateAccount={() => { clearBlock(); setTimeout(showAccount, 350); }}
          />
        </View>
      </BlurView>
    </Modal>
  );
}

export function aiRemainingLabel(used: number, limit: number, loaded: boolean, plan: 'free' | 'paid'): string {
  if (!loaded) return 'Checking this month’s AI actions';
  const left = Math.max(0, limit - used);
  return `${plan === 'paid' ? 'Pro' : 'Free'} · ${left} of ${limit} left this month`;
}

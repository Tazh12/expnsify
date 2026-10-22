import React, { useEffect, useState } from 'react';
import { View, Text, Modal, SafeAreaView } from 'react-native';
import { create } from 'zustand';
import { useTheme } from '../theme';
import { Tap, Icon } from '../components';
import { VadriMark } from '../components/VadriLogo';
import { useAuth } from '../store/useAuth';
import { SignInChoices } from '../screens/onboarding/SignInChoices';
import AuthScreen from '../screens/AuthScreen';

export const useAccountPrompt = create<{ open: boolean; show: () => void; hide: () => void }>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));

/** Lets a guest create an account. Their uid is linked, so everything they added is kept. */
export function CreateAccountSheet() {
  const C = useTheme();
  const open = useAccountPrompt(s => s.open);
  const hide = useAccountPrompt(s => s.hide);
  const isGuest = useAuth(s => !!s.user?.isAnonymous);
  const rev = useAuth(s => s.rev);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(false);

  useEffect(() => {
    if (open && !isGuest) hide();
  }, [open, isGuest, rev, hide]);

  useEffect(() => {
    if (!open) setEmail(false);
  }, [open]);

  return (
    <Modal visible={open && isGuest} animationType="slide" presentationStyle="pageSheet" onRequestClose={hide}>
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        {email ? (
          <AuthScreen initialTab="register" onBack={() => setEmail(false)} />
        ) : (
          <View style={{ flex: 1, paddingHorizontal: 28, paddingBottom: 16 }}>
            <View style={{ alignItems: 'flex-end', paddingTop: 12 }}>
              <Tap
                onPress={hide}
                accessibilityLabel="Close"
                style={{
                  width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Icon name="x" size={16} stroke={C.muted} />
              </Tap>
            </View>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <VadriMark width={52} dark={!C.isLight} />
              <Text style={{
                fontFamily: C.fonts.serif, fontSize: 34, lineHeight: 40, color: C.cream,
                letterSpacing: -0.5, marginTop: 24, textAlign: 'center',
              }}>
                Keep your budget.
              </Text>
              <Text style={{
                fontFamily: C.fonts.regular, fontSize: 16, lineHeight: 23, color: C.muted,
                marginTop: 12, textAlign: 'center', maxWidth: 340,
              }}>
                Create an account to unlock scan and voice and keep your plan on every device. Everything you added stays.
              </Text>
            </View>
            <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center' }}>
              <SignInChoices busy={busy} setBusy={setBusy} />
              <Tap
                onPress={() => setEmail(true)}
                disabled={busy}
                style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 10 }}
              >
                <Text style={{ fontFamily: C.fonts.medium, fontSize: 14, color: C.link }}>Use email instead</Text>
              </Tap>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

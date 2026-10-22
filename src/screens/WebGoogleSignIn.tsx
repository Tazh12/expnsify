import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { GoogleAuthProvider, linkWithPopup, signInWithPopup } from 'firebase/auth';
import { useTheme } from '../theme';
import { firebaseAuth, isCancelledSignIn, useAuth } from '../store/useAuth';
import { useAiUsage } from '../store/useAiUsage';

/** Starts Google sign-in. A guest is linked to the Google account so their data is kept. */
export function useGoogleSignIn(setLoading: (v: boolean) => void) {
  const start = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const current = firebaseAuth.currentUser;
      if (current?.isAnonymous) {
        try {
          const linked = await linkWithPopup(current, provider);
          useAuth.setState(s => ({ user: linked.user, rev: s.rev + 1 }));
          useAiUsage.getState().refresh();
        } catch (e) {
          const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : '';
          if (code !== 'auth/credential-already-in-use') throw e;
          const existing = GoogleAuthProvider.credentialFromError(e as never);
          if (existing) await useAuth.getState().signInWithProvider(existing);
        }
      } else {
        await signInWithPopup(firebaseAuth, provider);
      }
    } catch (e: unknown) {
      if (!isCancelledSignIn(e)) {
        const msg = e instanceof Error ? e.message : 'Google sign-in failed.';
        Alert.alert('Error', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return { ready: true, start: () => { start(); } };
}

export function WebGoogleSignIn({
  loading,
  setLoading,
}: {
  loading: boolean;
  setLoading: (v: boolean) => void;
}) {
  const theme = useTheme();
  const s = styles(theme);
  const google = useGoogleSignIn(setLoading);

  return (
    <>
      <View style={s.divider}>
        <View style={s.dividerLine} />
        <Text style={s.dividerText}>or</Text>
        <View style={s.dividerLine} />
      </View>
      <Pressable
        style={({ pressed }) => [s.googleBtn, pressed && { opacity: 0.85 }]}
        onPress={google.start}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color={theme.cream} />
          : <Text style={s.googleText}>Continue with Google</Text>}
      </Pressable>
    </>
  );
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
    dividerLine: { flex: 1, height: 1, backgroundColor: theme.hair },
    dividerText: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.muted },
    googleBtn: {
      backgroundColor: theme.surface, borderRadius: 12,
      paddingVertical: 14, alignItems: 'center',
      borderWidth: 1, borderColor: theme.hairStrong,
    },
    googleText: { color: theme.cream, fontFamily: theme.fonts.medium, fontSize: 15 },
  });
}

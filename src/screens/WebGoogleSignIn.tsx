import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { useTheme } from '../theme';
import { firebaseAuth } from '../store/useAuth';

export function WebGoogleSignIn({
  loading,
  setLoading,
}: {
  loading: boolean;
  setLoading: (v: boolean) => void;
}) {
  const theme = useTheme();
  const s = styles(theme);

  const onPress = async () => {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(firebaseAuth, provider);
    } catch (e: unknown) {
      const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: string }).code) : '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        const msg = e instanceof Error ? e.message : 'Google sign-in failed.';
        Alert.alert('Error', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <View style={s.divider}>
        <View style={s.dividerLine} />
        <Text style={s.dividerText}>or</Text>
        <View style={s.dividerLine} />
      </View>
      <Pressable
        style={({ pressed }) => [s.googleBtn, pressed && { opacity: 0.85 }]}
        onPress={onPress}
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

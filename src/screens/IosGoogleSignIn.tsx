import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider } from 'firebase/auth';
import { useTheme } from '../theme';
import { IOS_CLIENT_ID, useAuth } from '../store/useAuth';

WebBrowser.maybeCompleteAuthSession();

/** Starts Google sign-in. A guest is linked to the Google account so their data is kept. */
export function useGoogleSignIn(setLoading: (v: boolean) => void) {
  const signInWithProvider = useAuth(s => s.signInWithProvider);
  const [request, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    iosClientId: IOS_CLIENT_ID,
  });

  useEffect(() => {
    if (googleResponse?.type !== 'success') return;
    const { id_token } = googleResponse.params;
    const credential = GoogleAuthProvider.credential(id_token);
    setLoading(true);
    signInWithProvider(credential)
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'Google sign-in failed.';
        Alert.alert('Error', msg);
      })
      .finally(() => setLoading(false));
  }, [googleResponse, setLoading, signInWithProvider]);

  return { ready: !!request, start: () => { googlePromptAsync(); } };
}

export function IosGoogleSignIn({
  loading,
  setLoading,
}: {
  loading: boolean;
  setLoading: (v: boolean) => void;
}) {
  const theme = useTheme();
  const google = useGoogleSignIn(setLoading);

  const s = styles(theme);

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
        <Text style={s.googleText}>Continue with Google</Text>
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

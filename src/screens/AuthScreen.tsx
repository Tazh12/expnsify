import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { useTheme } from '../theme';
import { useAuth, IOS_CLIENT_ID, firebaseAuth } from '../store/useAuth';

WebBrowser.maybeCompleteAuthSession();

type Tab = 'login' | 'register';

export default function AuthScreen() {
  const theme = useTheme();
  const { signInEmail, registerEmail } = useAuth();

  const [tab, setTab] = useState<Tab>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [, googleResponse, googlePromptAsync] = Google.useAuthRequest({
    iosClientId: IOS_CLIENT_ID,
  });

  React.useEffect(() => {
    if (googleResponse?.type === 'success') {
      const { id_token } = googleResponse.params;
      const credential = GoogleAuthProvider.credential(id_token);
      setLoading(true);
      signInWithCredential(firebaseAuth, credential)
        .catch((e: unknown) => {
          const msg = e instanceof Error ? e.message : 'Google sign-in failed.';
          Alert.alert('Error', msg);
        })
        .finally(() => setLoading(false));
    }
  }, [googleResponse]);

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter email and password.');
      return;
    }
    setLoading(true);
    try {
      if (tab === 'login') {
        await signInEmail(email.trim(), password);
      } else {
        if (!name.trim()) {
          Alert.alert('Missing name', 'Please enter your name.');
          setLoading(false);
          return;
        }
        await registerEmail(email.trim(), password, name.trim());
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.';
      Alert.alert('Error', msg);
    }
    setLoading(false);
  }

  const s = styles(theme);

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.inner}>
        <Text style={s.wordmark}>expnsify</Text>
        <Text style={s.sub}>Track every expense effortlessly</Text>

        <View style={s.tabRow}>
          {(['login', 'register'] as Tab[]).map(t => (
            <Pressable key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                {t === 'login' ? 'Sign in' : 'Create account'}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={s.form}>
          {tab === 'register' && (
            <TextInput
              style={s.input}
              placeholder="Name"
              placeholderTextColor={theme.muted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              textContentType="name"
            />
          )}
          <TextInput
            style={s.input}
            placeholder="Email"
            placeholderTextColor={theme.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextInput
            style={s.input}
            placeholder="Password"
            placeholderTextColor={theme.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType={tab === 'login' ? 'password' : 'newPassword'}
          />

          <Pressable
            style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#0E0E0C" />
              : <Text style={s.btnText}>{tab === 'login' ? 'Sign in' : 'Create account'}</Text>
            }
          </Pressable>

          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>or</Text>
            <View style={s.dividerLine} />
          </View>

          <Pressable
            style={({ pressed }) => [s.googleBtn, pressed && { opacity: 0.85 }]}
            onPress={() => googlePromptAsync()}
            disabled={loading}
          >
            <Text style={s.googleText}>Continue with Google</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.bg },
    inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 40 },
    wordmark: {
      fontFamily: theme.fonts.serifItalic,
      fontSize: 52, color: theme.cream, textAlign: 'center', letterSpacing: -1, marginBottom: 4,
    },
    sub: {
      fontFamily: theme.fonts.regular, fontSize: 14,
      color: theme.muted, textAlign: 'center', marginBottom: 36,
    },
    tabRow: {
      flexDirection: 'row', backgroundColor: theme.surface,
      borderRadius: 12, padding: 4, marginBottom: 24,
    },
    tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
    tabActive: { backgroundColor: theme.bg },
    tabText: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.muted },
    tabTextActive: { color: theme.cream, fontFamily: theme.fonts.medium },
    form: { gap: 12 },
    input: {
      backgroundColor: theme.surface, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 14,
      color: theme.cream, fontFamily: theme.fonts.regular, fontSize: 15,
    },
    btn: {
      backgroundColor: theme.sage, borderRadius: 12,
      paddingVertical: 14, alignItems: 'center', marginTop: 4,
    },
    btnText: { color: '#0E0E0C', fontFamily: theme.fonts.semibold, fontSize: 15 },
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

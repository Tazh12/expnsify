import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Image,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { useTheme } from '../theme';
import { useAuth } from '../store/useAuth';

const GoogleSignIn = Platform.OS === 'web'
  ? require('./WebGoogleSignIn').WebGoogleSignIn as typeof import('./WebGoogleSignIn').WebGoogleSignIn
  : require('./IosGoogleSignIn').IosGoogleSignIn as typeof import('./IosGoogleSignIn').IosGoogleSignIn;

type Tab = 'login' | 'register';

export default function AuthScreen() {
  const theme = useTheme();
  const { signInEmail, registerEmail, sendPasswordReset } = useAuth();

  const [tab, setTab] = useState<Tab>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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
      <Image
        source={require('../../assets/app-icon-transparent.png')}
        style={s.brandIcon}
        resizeMode="contain"
      />
      <View style={s.inner}>
        <Text style={s.wordmark}>Vadri</Text>
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

          {tab === 'login' && (
            <Pressable
              style={s.forgotBtn}
              onPress={async () => {
                if (!email.trim()) {
                  Alert.alert('Enter your email', 'Type the email for this account, then tap Forgot password.');
                  return;
                }
                try {
                  await sendPasswordReset(email.trim());
                  Alert.alert('Check your email', 'We sent a link to reset your password.');
                } catch (e: unknown) {
                  const msg = e instanceof Error ? e.message : 'Please try again.';
                  Alert.alert('Could not send reset', msg);
                }
              }}
            >
              <Text style={s.forgot}>Forgot password</Text>
            </Pressable>
          )}

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

          <GoogleSignIn loading={loading} setLoading={setLoading} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function styles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    root: { flex: 1, width: '100%', backgroundColor: theme.bg },
    brandIcon: {
      position: 'absolute', top: Platform.OS === 'ios' ? 58 : 24, right: 24,
      width: 38, height: 38,
    },
    inner: {
      flex: 1, alignSelf: 'stretch', maxWidth: 440,
      justifyContent: 'center', marginHorizontal: 20, paddingBottom: 40,
    },
    wordmark: {
      fontFamily: theme.fonts.serifItalic,
      fontSize: 52, color: theme.cream, textAlign: 'center', letterSpacing: -1, marginBottom: 4,
    },
    sub: {
      fontFamily: theme.fonts.regular, fontSize: 14,
      color: theme.muted, textAlign: 'center', marginBottom: 36,
    },
    tabRow: {
      width: '100%', flexDirection: 'column', backgroundColor: theme.surface,
      borderRadius: 12, padding: 4, marginBottom: 24, gap: 4,
    },
    tab: {
      width: '100%', minHeight: 44,
      paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },
    tabActive: { backgroundColor: theme.bg },
    tabText: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.muted, textAlign: 'center', width: '100%' },
    forgotBtn: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
    forgot: { color: theme.muted, fontSize: 13 },
    tabTextActive: { color: theme.cream, fontFamily: theme.fonts.medium },
    form: { width: '100%', gap: 12 },
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
  });
}

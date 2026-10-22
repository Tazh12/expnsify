import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Platform, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme, type Theme } from '../../theme';
import { Tap } from '../../components';
import { useAuth, isCancelledSignIn } from '../../store/useAuth';

const { useGoogleSignIn } = Platform.OS === 'web'
  ? require('../WebGoogleSignIn') as typeof import('../WebGoogleSignIn')
  : require('../IosGoogleSignIn') as typeof import('../IosGoogleSignIn');

type AppleModule = typeof import('expo-apple-authentication');
const Apple: AppleModule | null = Platform.OS === 'ios'
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ? require('expo-apple-authentication') as AppleModule
  : null;

const BUTTON_HEIGHT = 52;
const RADIUS = 14;

/** Apple and Google sign-in, laid out as equals. Apple shows only where the device supports it. */
export function SignInChoices({ busy, setBusy }: { busy: boolean; setBusy: (v: boolean) => void }) {
  const C = useTheme();
  const s = styles(C);
  const signInApple = useAuth(st => st.signInApple);
  const google = useGoogleSignIn(setBusy);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    Apple?.isAvailableAsync().then(setAppleAvailable).catch(() => {});
  }, []);

  const onApple = useCallback(async () => {
    setBusy(true);
    try {
      await signInApple();
    } catch (e) {
      if (!isCancelledSignIn(e)) {
        Alert.alert('Apple sign-in failed', e instanceof Error ? e.message : 'Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }, [setBusy, signInApple]);

  return (
    <View style={{ gap: 10 }}>
      {Apple && appleAvailable && (
        <View pointerEvents={busy ? 'none' : 'auto'} style={{ opacity: busy ? 0.6 : 1 }}>
          <Apple.AppleAuthenticationButton
            buttonType={Apple.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={C.isLight
              ? Apple.AppleAuthenticationButtonStyle.BLACK
              : Apple.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={RADIUS}
            style={{ height: BUTTON_HEIGHT, width: '100%' }}
            onPress={onApple}
          />
        </View>
      )}
      <Tap
        onPress={google.start}
        disabled={busy || !google.ready}
        accessibilityRole="button"
        accessibilityLabel="Sign in with Google"
        style={s.google}
      >
        <GoogleG />
        <Text style={s.googleText}>Sign in with Google</Text>
      </Tap>
    </View>
  );
}

/** Primary "Try it free" button: starts a guest session with no account. */
export function TryFreeButton({ busy, setBusy }: { busy: boolean; setBusy: (v: boolean) => void }) {
  const C = useTheme();
  const s = styles(C);
  const signInGuest = useAuth(st => st.signInGuest);

  const onPress = async () => {
    setBusy(true);
    try {
      await signInGuest();
    } catch (e) {
      const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '';
      Alert.alert(
        'Could not start',
        code === 'auth/admin-restricted-operation'
          ? 'Guest mode isn’t available right now. Sign in with Apple or Google to start.'
          : code === 'auth/network-request-failed'
            ? 'Check your connection and try again.'
            : 'Please try again.',
      );
      setBusy(false);
    }
  };

  return (
    <Tap
      onPress={onPress}
      disabled={busy}
      haptic
      accessibilityRole="button"
      accessibilityLabel="Try it free, no account needed"
      style={s.primary}
    >
      {busy
        ? <ActivityIndicator color={C.onPrimary} />
        : <Text style={s.primaryText}>Try it free</Text>}
    </Tap>
  );
}

function GoogleG() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </Svg>
  );
}

function styles(C: Theme) {
  return StyleSheet.create({
    primary: {
      height: BUTTON_HEIGHT, borderRadius: RADIUS, backgroundColor: C.sage,
      alignItems: 'center', justifyContent: 'center',
    },
    primaryText: { color: C.onPrimary, fontFamily: C.fonts.semibold, fontSize: 17 },
    google: {
      height: BUTTON_HEIGHT, borderRadius: RADIUS, backgroundColor: C.surface,
      borderWidth: 1, borderColor: C.hairStrong,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    },
    googleText: { color: C.cream, fontFamily: C.fonts.medium, fontSize: 17 },
  });
}

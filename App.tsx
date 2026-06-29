import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StatusBar, Modal, SafeAreaView, ActivityIndicator,
  Image, AppState,
} from 'react-native';
import { useFonts, InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold } from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import * as Localization from 'expo-localization';
import { BlurView } from 'expo-blur';
import { ThemeContext, buildTheme } from './src/theme';
import { useSettings } from './src/store/useSettings';
import { useRates, FRANKFURTER_CURRENCIES } from './src/store/useRates';
import { useCategories } from './src/store/useCategories';
import { useExpenses } from './src/store/useExpenses';
import { useAuth, onAuthStateChanged, firebaseAuth } from './src/store/useAuth';
import { Tap } from './src/components';

import { TabBar, type TabId } from './src/components/TabBar';
import { HomeScreen } from './src/screens/HomeScreen';
import { ActivityScreen } from './src/screens/ActivityScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { CategoriesScreen } from './src/screens/CategoriesScreen';
import AuthScreen from './src/screens/AuthScreen';
import { AddSheet } from './src/flows/AddSheet';
import { RecapModal } from './src/flows/RecapModal';

export default function App() {
  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_400Regular,
    GeistMono_500Medium,
  });

  const settings = useSettings();
  const { setUser, setInitializing, initializing, user } = useAuth();
  const { subscribe: subCats, reset: resetCats } = useCategories();
  const { subscribe: subExp, reset: resetExp } = useExpenses();

  const unsubCats = useRef<(() => void) | null>(null);
  const unsubExp = useRef<(() => void) | null>(null);

  const [tab, setTab] = useState<TabId>('home');
  const [addOpen, setAddOpen] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [month, setMonth] = useState(new Date());
  const [localeCurrency, setLocaleCurrency] = useState<string | null>(null);

  // Boot: load settings → hydrate rate cache → fetch if stale
  useEffect(() => {
    (async () => {
      await settings.load();
      const { preferredCurrency } = useSettings.getState();
      await useRates.getState().loadCache();
      if (useRates.getState().isStale()) {
        useRates.getState().fetch(preferredCurrency);
      }
    })();
  }, []);

  // AppState: re-fetch rates when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && useRates.getState().isStale()) {
        useRates.getState().fetch(useSettings.getState().preferredCurrency);
      }
    });
    return () => sub.remove();
  }, []);

  // First-launch currency detection
  useEffect(() => {
    if (!settings.loaded || settings.currencyPrompted || !user) return;
    try {
      const locales = Localization.getLocales();
      const code = locales[0]?.currencyCode;
      if (code && code !== 'USD' && (FRANKFURTER_CURRENCIES as readonly string[]).includes(code)) {
        setLocaleCurrency(code);
      } else {
        settings.set('currencyPrompted', true);
      }
    } catch {
      settings.set('currencyPrompted', true);
    }
  }, [settings.loaded, user]);

  // Firebase auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      setUser(firebaseUser);
      setInitializing(false);

      if (firebaseUser) {
        unsubCats.current = subCats(firebaseUser.uid);
        unsubExp.current = subExp(firebaseUser.uid);
      } else {
        unsubCats.current?.();
        unsubExp.current?.();
        unsubCats.current = null;
        unsubExp.current = null;
        resetCats();
        resetExp();
      }
    });
    return unsub;
  }, []);

  const theme = buildTheme(settings.palette, settings.accent, settings.fontId);
  const isLight = settings.palette === 'cream';

  if (!fontsLoaded || initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0E0E0C', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#B8D4B0" />
      </View>
    );
  }

  if (!user) {
    return (
      <ThemeContext.Provider value={theme}>
        <StatusBar barStyle="light-content" backgroundColor="#0E0E0C" />
        <AuthScreen />
      </ThemeContext.Provider>
    );
  }

  const onChangeMonth = (delta: number) => {
    const m = new Date(month);
    m.setMonth(m.getMonth() + delta);
    setMonth(m);
  };

  const screen = (() => {
    switch (tab) {
      case 'home':
        return (
          <HomeScreen
            month={month}
            onChangeMonth={onChangeMonth}
            onOpenAdd={() => setAddOpen(true)}
            onOpenRecap={() => setRecapOpen(true)}
            onSeeAll={() => setTab('txns')}
          />
        );
      case 'txns':
        return <ActivityScreen />;
      case 'reports':
        return <ReportsScreen onOpenRecap={() => setRecapOpen(true)} />;
      case 'settings':
        return <SettingsScreen onOpenCategories={() => setCatsOpen(true)} />;
    }
  })();

  return (
    <ThemeContext.Provider value={theme}>
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={theme.bg} />
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <SafeAreaView style={{ backgroundColor: theme.bg }}>
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            paddingHorizontal: 20, paddingVertical: 8,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Image
                source={require('./assets/app-icon-transparent.png')}
                style={{ width: 24, height: 24 }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: 14, fontWeight: '500', color: theme.cream, letterSpacing: 0.02 }}>
                expnsify
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: theme.muted, letterSpacing: 0.06, textTransform: 'uppercase' }}>
              ✦ AI · on
            </Text>
          </View>
        </SafeAreaView>

        <View style={{ flex: 1 }}>
          {screen}
        </View>

        <TabBar tab={tab} onTab={setTab} onAdd={() => setAddOpen(true)} />

        <AddSheet open={addOpen} onClose={() => setAddOpen(false)} />
        <RecapModal open={recapOpen} onClose={() => setRecapOpen(false)} />

        <Modal visible={catsOpen} animationType="slide" presentationStyle="fullScreen">
          <ThemeContext.Provider value={theme}>
            <CategoriesScreen onClose={() => setCatsOpen(false)} />
          </ThemeContext.Provider>
        </Modal>

        {/* First-launch currency prompt */}
        <Modal visible={!!localeCurrency} transparent animationType="fade">
          <BlurView intensity={60} tint={isLight ? 'light' : 'dark'} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <View style={{
              backgroundColor: theme.bgElev,
              borderRadius: 24, padding: 24, width: '100%',
              borderWidth: 0.5, borderColor: theme.hairStrong,
              gap: 12,
            }}>
              <Text style={{ fontFamily: theme.fonts.serif, fontSize: 26, color: theme.cream, lineHeight: 30 }}>
                Welcome to{' '}
                <Text style={{ fontStyle: 'italic' }}>expnsify</Text>
              </Text>
              <Text style={{ fontSize: 14, color: theme.muted, lineHeight: 20 }}>
                Your device is set to{' '}
                <Text style={{ color: theme.cream }}>{localeCurrency}</Text>.
                {' '}Use it as your preferred currency?
              </Text>
              <Tap
                haptic
                onPress={() => {
                  settings.set('preferredCurrency', localeCurrency!);
                  settings.set('currencyPrompted', true);
                  setLocaleCurrency(null);
                }}
                style={{
                  backgroundColor: theme.sage, borderRadius: 14,
                  paddingVertical: 14, alignItems: 'center', marginTop: 4,
                }}
              >
                <Text style={{ color: '#0E0E0C', fontWeight: '600', fontSize: 15 }}>
                  Yes, use {localeCurrency}
                </Text>
              </Tap>
              <Tap
                onPress={() => {
                  settings.set('currencyPrompted', true);
                  setLocaleCurrency(null);
                }}
                style={{ paddingVertical: 10, alignItems: 'center' }}
              >
                <Text style={{ color: theme.muted, fontSize: 14 }}>Not now, keep USD</Text>
              </Tap>
            </View>
          </BlurView>
        </Modal>
      </View>
    </ThemeContext.Provider>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StatusBar, Modal, SafeAreaView, ActivityIndicator, Image } from 'react-native';
import { useFonts, InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold } from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { ThemeContext, buildTheme } from './src/theme';
import { useSettings } from './src/store/useSettings';
import { useCategories } from './src/store/useCategories';
import { useExpenses } from './src/store/useExpenses';
import { useAuth, onAuthStateChanged, firebaseAuth } from './src/store/useAuth';

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

  useEffect(() => {
    settings.load();
  }, []);

  // Firebase auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      setUser(firebaseUser);
      setInitializing(false);

      if (firebaseUser) {
        // Subscribe to Firestore data
        unsubCats.current = subCats(firebaseUser.uid);
        unsubExp.current = subExp(firebaseUser.uid);
      } else {
        // Clean up subscriptions and reset data
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

  // Not logged in → auth screen
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
      </View>
    </ThemeContext.Provider>
  );
}

import React, { useEffect, useRef, useState } from 'react';
import {
  View, StatusBar, Modal, SafeAreaView, ActivityIndicator,
  AppState, Platform,
} from 'react-native';
import { useFonts, InstrumentSerif_400Regular, InstrumentSerif_400Regular_Italic } from '@expo-google-fonts/instrument-serif';
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold } from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { ComicNeue_400Regular, ComicNeue_400Regular_Italic, ComicNeue_700Bold } from '@expo-google-fonts/comic-neue';
import { ThemeContext, buildTheme } from './src/theme';
import { useSettings } from './src/store/useSettings';
import { useRates } from './src/store/useRates';
import { useCategories } from './src/store/useCategories';
import { useExpenses } from './src/store/useExpenses';
import { useBudget } from './src/store/useBudget';
import { useBudgetGroups } from './src/store/useBudgetGroups';
import { useAuth, onAuthStateChanged, firebaseAuth } from './src/store/useAuth';
import { useLayout } from './src/hooks/useLayout';
import { AppShell } from './src/components/AppShell';
import { AppHeader } from './src/components/AppHeader';
import type { TabId } from './src/components/TabBar';
import { TodayScreen } from './src/screens/TodayScreen';
import { PlanScreen } from './src/screens/PlanScreen';
import { ActivityScreen } from './src/screens/ActivityScreen';
import { InsightsScreen } from './src/screens/InsightsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import AuthScreen from './src/screens/AuthScreen';
import { AddSheet } from './src/flows/AddSheet';
import { UpgradeModal } from './src/flows/UpgradeModal';
import { useAiUsage } from './src/store/useAiUsage';
import { useViewMonth } from './src/store/useViewMonth';
import { useNotificationSync } from './src/hooks/useNotificationSync';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_400Regular,
    GeistMono_500Medium,
    ComicNeue_400Regular,
    ComicNeue_400Regular_Italic,
    ComicNeue_700Bold,
  });
  const [fontWaitOver, setFontWaitOver] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFontWaitOver(true), Platform.OS === 'web' ? 1200 : 4000);
    return () => clearTimeout(t);
  }, []);
  const fontsReady = fontsLoaded || !!fontError || fontWaitOver;

  const settings = useSettings();
  const { isWide } = useLayout();
  useNotificationSync();
  const { setUser, setInitializing, initializing, user } = useAuth();
  const { subscribe: subCats, reset: resetCats } = useCategories();
  const { subscribe: subExp, reset: resetExp } = useExpenses();
  const { subscribe: subBudget, reset: resetBudget } = useBudget();
  const { subscribe: subGroups, reset: resetGroups } = useBudgetGroups();

  const unsubCats = useRef<(() => void) | null>(null);
  const unsubExp = useRef<(() => void) | null>(null);
  const unsubBudget = useRef<(() => void) | null>(null);
  const unsubGroups = useRef<(() => void) | null>(null);

  const [tab, setTab] = useState<TabId>('today');
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const month = useViewMonth(s => s.month);
  const shiftMonth = useViewMonth(s => s.shiftMonth);
  const [pendingShare, setPendingShare] = useState<{ uri: string; mimeType?: string } | null>(null);

  useEffect(() => {
    (async () => {
      await settings.load();
      const { preferredCurrency } = useSettings.getState();
      await useRates.getState().loadCache();
      if (useRates.getState().isStale()) {
        useRates.getState().fetch(preferredCurrency);
      }
    })().catch(() => {});
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && useRates.getState().isStale()) {
        useRates.getState().fetch(useSettings.getState().preferredCurrency);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(
      firebaseAuth,
      (firebaseUser) => {
        setUser(firebaseUser);
        setInitializing(false);

        if (firebaseUser) {
          useAiUsage.getState().refresh();
          unsubCats.current = subCats(firebaseUser.uid);
          unsubExp.current = subExp(firebaseUser.uid);
          unsubBudget.current = subBudget(firebaseUser.uid);
          unsubGroups.current = subGroups(firebaseUser.uid);
        } else {
          unsubCats.current?.();
          unsubExp.current?.();
          unsubBudget.current?.();
          unsubGroups.current?.();
          unsubCats.current = null;
          unsubExp.current = null;
          unsubBudget.current = null;
          unsubGroups.current = null;
          resetCats();
          resetExp();
          resetBudget();
          resetGroups();
        }
      },
      () => setInitializing(false),
    );
    // Don't blank the web app if IndexedDB/auth persistence never resolves.
    const t = setTimeout(() => setInitializing(false), 2500);
    return () => {
      unsub();
      clearTimeout(t);
    };
  }, []);

  useIncomingShare((file) => {
    setPendingShare(file);
    setAddOpen(true);
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const onDragOver = (e: DragEvent) => { e.preventDefault(); };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      const uri = URL.createObjectURL(file);
      setPendingShare({ uri, mimeType: file.type || 'application/pdf' });
      setAddOpen(true);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  const theme = buildTheme(settings.palette, settings.fontId);
  const isLight = theme.isLight;

  if (!fontsReady || initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <ThemeContext.Provider value={theme}>
        <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={theme.background} />
        <AuthScreen />
      </ThemeContext.Provider>
    );
  }

  const screen = (() => {
    switch (tab) {
      case 'today':
        return <TodayScreen onOpenPlan={() => setTab('plan')} onOpenActivity={() => setTab('activity')} />;
      case 'plan':
        return <PlanScreen />;
      case 'activity':
        return <ActivityScreen onScan={() => setAddOpen(true)} />;
      case 'insights':
        return <InsightsScreen />;
    }
  })();

  const header = (
    <AppHeader
      month={month}
      onChangeMonth={shiftMonth}
      onOpenSettings={() => setSettingsOpen(true)}
      showBrand={!isWide}
    />
  );

  return (
    <ThemeContext.Provider value={theme}>
      <StatusBar barStyle={isLight ? 'dark-content' : 'light-content'} backgroundColor={theme.bg} />
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {!isWide && (
          <SafeAreaView style={{ backgroundColor: theme.bg }}>
            {header}
          </SafeAreaView>
        )}

        <AppShell
          tab={tab}
          onTab={setTab}
          onAdd={() => setAddOpen(true)}
          isWide={isWide}
        >
          <View style={{ flex: 1 }}>
            {isWide && header}
            {screen}
          </View>
        </AppShell>

        <AddSheet
          open={addOpen}
          onClose={() => { setAddOpen(false); setPendingShare(null); }}
          pendingShare={pendingShare}
        />
        <UpgradeModal />

        <Modal visible={settingsOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setSettingsOpen(false)}>
          <ThemeContext.Provider value={theme}>
            <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
              <SettingsScreen onClose={() => setSettingsOpen(false)} />
            </SafeAreaView>
          </ThemeContext.Provider>
        </Modal>
      </View>
    </ThemeContext.Provider>
  );
}

function useIncomingShare(onShare: (file: { uri: string; mimeType?: string }) => void) {
  const onShareRef = useRef(onShare);
  onShareRef.current = onShare;

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let unsub: (() => void) | undefined;
    try {
      // Optional native share extension. Present after an EAS build with the plugin.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('expo-share-intent') as {
        addChangeListener?: (cb: (ev: { files?: { path: string; mimeType?: string }[] }) => void) => { remove: () => void };
        getShareIntent?: () => { files?: { path: string; mimeType?: string }[] } | null;
      };
      const emit = (files?: { path: string; mimeType?: string }[]) => {
        const f = files?.[0];
        if (f?.path) onShareRef.current({ uri: f.path, mimeType: f.mimeType });
      };
      emit(mod.getShareIntent?.()?.files);
      const sub = mod.addChangeListener?.((ev) => emit(ev.files));
      if (sub) unsub = () => sub.remove();
    } catch {
      // Share extension not installed — in-app file pick still works.
    }
    return () => unsub?.();
  }, []);
}
